import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { PartyMappingService } from "../services/partyMappingService";
import { fetchDebitTransactionsFromSheets, isGoogleSheetsConfigured } from "../services/googleSheetsService";
import { formatDate } from "../lib/utils";
import { DatePicker } from "../components/ui/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Search, CheckCircle2, X, Edit2, Check, XCircle, Sparkles, RefreshCw, Pencil, List, Grid, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Clock, Printer } from "lucide-react";
import { cn } from "../lib/utils";
import { Label } from "../components/ui/Label";
import { Modal } from "../components/ui/Modal";

type ViewType = "pending" | "completed" | "hold" | "selfTransfer";

export function DebitTransactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<ViewType>("pending");
  
  // Check for supplier name and view in URL query params
  useEffect(() => {
    const supplierParam = searchParams.get('supplier') || searchParams.get('party');
    const viewParam = searchParams.get('view') as ViewType | null;
    
    if (supplierParam) {
      setSearchQuery(supplierParam);
    }
    
    if (viewParam && ['pending', 'completed', 'hold', 'selfTransfer'].includes(viewParam)) {
      setView(viewParam);
    }
    
    // Clear the URL parameters after setting
    if (supplierParam || viewParam) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  // Date filters - local to each view
  const [dateFromPending, setDateFromPending] = useState("");
  const [dateToPending, setDateToPending] = useState("");
  const [dateFromCompleted, setDateFromCompleted] = useState("");
  const [dateToCompleted, setDateToCompleted] = useState("");
  const [dateFromHold, setDateFromHold] = useState("");
  const [dateToHold, setDateToHold] = useState("");
  const [dateFromSelfTransfer, setDateFromSelfTransfer] = useState("");
  const [dateToSelfTransfer, setDateToSelfTransfer] = useState("");
  
  // Get current view's date filters
  const dateFrom = view === "pending" ? dateFromPending : 
                   view === "completed" ? dateFromCompleted :
                   view === "hold" ? dateFromHold : dateFromSelfTransfer;
  const dateTo = view === "pending" ? dateToPending : 
                 view === "completed" ? dateToCompleted :
                 view === "hold" ? dateToHold : dateToSelfTransfer;
  // Local state for input values to prevent focus loss
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const focusedInputId = useRef<string | null>(null);
  const isLoadingRef = useRef<boolean>(false); // Track loading state to prevent concurrent loads
  const loadingSuggestionsRef = useRef<Set<string>>(new Set()); // Track which transactions are loading suggestions
  // State for editing party names
  const [editingPartyName, setEditingPartyName] = useState<string | null>(null);
  const [editingPartyValue, setEditingPartyValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [partySuggestions, setPartySuggestions] = useState<Record<string, string[] | null>>({});
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // View mode for pending transactions (list or grid)
  const [pendingViewMode, setPendingViewMode] = useState<"list" | "grid">("list");
  // Sort state for date field
  const [dateSort, setDateSort] = useState<"asc" | "desc" | null>(null);
  // Modal state for editing transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalPartyName, setModalPartyName] = useState("");
  const [modalVyaparRef, setModalVyaparRef] = useState("");
  const [modalSuggestions, setModalSuggestions] = useState<string[]>([]);

  // Load transactions from Google Sheets (single source of truth - no local storage fallback)
  const loadTransactions = useCallback(async () => {
    // Don't reload if user is currently typing in an input
    if (focusedInputId.current !== null) {
      return;
    }
    
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log('Load already in progress, skipping...');
      return;
    }
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    try {
      let allTransactions: Transaction[] = [];
      
      // ALWAYS fetch from Google Sheets (single source of truth)
      if (isGoogleSheetsConfigured()) {
        try {
          const sheetsTransactions = await fetchDebitTransactionsFromSheets();
          // Always use what's in Google Sheets, even if empty
          allTransactions = sheetsTransactions;
          setLastSyncTime(new Date());
          console.log(`Loaded ${sheetsTransactions.length} debit transactions from Google Sheets`);
        } catch (error) {
          console.error('Error fetching from Google Sheets:', error);
          // On error, show empty list (don't fallback to local storage)
          allTransactions = [];
          alert('Failed to load debit transactions from Google Sheets. Please check your connection and try refreshing.');
        }
      } else {
        // If Google Sheets not configured, show empty list
        console.warn('Google Sheets not configured. Showing empty transaction list.');
        allTransactions = [];
      }
      
    // Migrate legacy inVyapar to added_to_vyapar
    allTransactions = allTransactions.map((t) => {
      if (t.inVyapar !== undefined && t.added_to_vyapar === undefined) {
        t.added_to_vyapar = t.inVyapar;
      }
      return t;
    });
      
      // Deduplicate transactions by ID (in case Google Sheets returns duplicates)
      // Also handle cases where ID might be missing by using a composite key
      const uniqueTransactionsMap = new Map<string, Transaction>();
      const seenKeys = new Set<string>();
      
      allTransactions.forEach((t) => {
        let key: string;
        
        // Primary: Use transaction ID if available
        if (t.id && t.id.trim() !== '') {
          key = `id:${t.id.trim()}`;
        } else {
          // Fallback: Create a composite key from date + amount + description + reference number
          const dateStr = t.date || '';
          const amountStr = String(t.amount || 0);
          const descStr = (t.description || '').substring(0, 50).trim(); // First 50 chars
          const refStr = (t.referenceNumber || '').trim();
          key = `composite:${dateStr}|${amountStr}|${descStr}|${refStr}`;
        }
        
        // Only add if we haven't seen this key before
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueTransactionsMap.set(key, t);
        }
      });
      
      const uniqueTransactions = Array.from(uniqueTransactionsMap.values());
      
      // Log if duplicates were found
      if (allTransactions.length !== uniqueTransactions.length) {
        console.log(`Removed ${allTransactions.length - uniqueTransactions.length} duplicate transactions`);
      }
      
    // Only show withdrawals (debits)
      const debitTransactions = uniqueTransactions.filter((t) => t.type === "debit");
      
      // Replace transactions completely (don't append)
      // Use functional update to ensure we're replacing, not merging with previous state
      // BUT: Don't update if user is currently typing (to prevent focus loss)
      if (focusedInputId.current === null) {
        setTransactions(() => {
          // Return a completely new array to ensure React sees it as a change
          return [...debitTransactions];
        });
    
    // Sync input values with transactions (but don't overwrite focused input)
    setInputValues((prev) => {
      const newValues = { ...prev };
      debitTransactions.forEach((t) => {
        if (focusedInputId.current !== t.id && t.vyapar_reference_number) {
          newValues[t.id] = t.vyapar_reference_number;
        }
      });
      return newValues;
    });
      } else {
        // User is typing - skip transaction updates completely to prevent focus loss
        // We'll update after the user finishes typing (on blur)
        console.log('Skipping transaction update - user is typing in input');
        return; // Don't update anything while user is typing
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial load only - no auto-refresh
    // User must manually click refresh button to reload data
    loadTransactions();
  }, [loadTransactions]);

  // Filter transactions based on view, date, and search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply view filter
    // Note: We check inputValues inside the filter function, but don't include it in dependencies
    // This prevents re-renders while typing, but still shows correct filtering
    if (view === "pending") {
      // Pending: Transactions that are NOT completed and NOT on hold and NOT self transfer
      filtered = filtered.filter((t) => {
        const isHold = t.hold === true;
        if (isHold) return false; // Exclude hold transactions
        const isSelfTransfer = t.selfTransfer === true;
        if (isSelfTransfer) return false; // Exclude self transfer transactions
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number ? String(t.vyapar_reference_number).trim() : '';
        const localRef = inputValues[t.id] ? String(inputValues[t.id]).trim() : '';
        const hasReference = Boolean(storageRef || localRef);
        const hasPartyName = Boolean(t.partyName && t.partyName.trim() !== '');
        // Show if NOT completed (not all: checked, has reference, AND has party name)
        return !(isChecked && hasReference && hasPartyName);
      });
    } else if (view === "completed") {
      // Completed: BOTH checkbox checked AND reference number entered AND party name entered (and not on hold and not self transfer)
      filtered = filtered.filter((t) => {
        const isHold = t.hold === true;
        if (isHold) return false; // Exclude hold transactions
        const isSelfTransfer = t.selfTransfer === true;
        if (isSelfTransfer) return false; // Exclude self transfer transactions
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number ? String(t.vyapar_reference_number).trim() : '';
        const localRef = inputValues[t.id] ? String(inputValues[t.id]).trim() : '';
        const hasReference = Boolean(storageRef || localRef);
        const hasPartyName = Boolean(t.partyName && t.partyName.trim() !== '');
        // Require ALL: checkbox checked, reference number, AND party name
        return isChecked && hasReference && hasPartyName;
      });
    } else if (view === "hold") {
      // Hold: Transactions that are marked as hold
      filtered = filtered.filter((t) => t.hold === true);
    } else if (view === "selfTransfer") {
      // Self Transfer: Transactions that are marked as self transfer
      filtered = filtered.filter((t) => t.selfTransfer === true);
    }

    // Apply date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((t) => {
        const tDate = new Date(t.date);
        if (dateFrom && tDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (tDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          t.partyName.toLowerCase().includes(query) ||
          t.referenceNumber?.toLowerCase().includes(query) ||
          t.vyapar_reference_number?.toLowerCase().includes(query)
      );
    }

    // Apply date sorting if enabled, otherwise default to newest first
    if (dateSort) {
      filtered = [...filtered].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateSort === "asc" ? dateA - dateB : dateB - dateA;
      });
    } else {
      // Default: newest first
      filtered = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return filtered;
    // Note: inputValues is accessed via closure but not in dependencies
    // This prevents re-renders while typing, but filter still works correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, searchQuery, view, dateFrom, dateTo, dateSort]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, view, dateFrom, dateTo]);

  // Load suggestions for visible transactions when page changes or transactions load
  useEffect(() => {
    // Load suggestions for all visible (paginated) transactions
    paginatedTransactions.forEach(transaction => {
      // Skip if already loading or already checked
      if (partySuggestions[transaction.id] !== undefined || loadingSuggestionsRef.current.has(transaction.id)) {
        return;
      }

      // Skip suggestions for completed transactions
      const isAdded = transaction.added_to_vyapar || transaction.inVyapar;
      const hasRef = Boolean(
        (transaction.vyapar_reference_number ? String(transaction.vyapar_reference_number).trim() : '') ||
        (inputValues[transaction.id] ? String(inputValues[transaction.id]).trim() : '')
      );
      const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
      const isCompleted = isAdded && hasRef && hasPartyName;
      
      if (isCompleted) {
        // Don't load suggestions for completed transactions
        setPartySuggestions(prev => ({ ...prev, [transaction.id]: null }));
        return;
      }

      loadingSuggestionsRef.current.add(transaction.id);
      
      (async () => {
        let foundSuggestion: string | null = null;
        
        // If transaction has a party name, check for suggestions for that name
        if (transaction.partyName) {
          foundSuggestion = await PartyMappingService.getSuggestedName(transaction.partyName);
          if (foundSuggestion && foundSuggestion.trim().length > 0 && foundSuggestion !== transaction.partyName) {
            setPartySuggestions(prev => ({ ...prev, [transaction.id]: [foundSuggestion] }));
            loadingSuggestionsRef.current.delete(transaction.id);
            return;
          }
        }
        
        // If no party name or no suggestion found, extract from description (like CSVUpload does)
        if (transaction.description && !foundSuggestion) {
          const desc = transaction.description.trim();
          let extractedPartyName: string | null = null;
          
          // NEW METHOD 0: Word-by-word matching against parties list from Google Sheets (PRIORITY)
          const matchedParties = await PartyMappingService.findSuppliersFromNarration(desc, 3);
          if (matchedParties.length > 0) {
            // Filter out blank/empty recommendations
            const validParties = matchedParties.filter(p => p && p.trim().length > 0);
            if (validParties.length > 0) {
              // Store multiple suggestions
              setPartySuggestions(prev => ({ ...prev, [transaction.id]: validParties }));
              // Don't continue to other methods - we found matches from the parties list
              loadingSuggestionsRef.current.delete(transaction.id);
              return; // Exit early
            }
          }
          
          // Continue to other methods if no valid matches found
          {
            // Method 1: Extract text between colons (CHQ DEP patterns like "CHQ DEP - HYDERABAD - CTS CLG2 - WBO HYD: COMPANY NAME :BANK")
            const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w&]+?)\s*:/i);
            if (colonPattern && colonPattern[1]) {
              const extracted = colonPattern[1].trim();
              // Filter out common bank names and locations
              const excludeWords = ['union bank', 'state bank', 'canara bank', 'punjab national', 'indian bank', 'hyderabad', 'wbo', 'cts', 'clg'];
              const extractedLower = extracted.toLowerCase();
              const shouldExclude = excludeWords.some(word => extractedLower.includes(word));
              if (!shouldExclude && extracted.length > 3 && extracted.length < 100) {
                extractedPartyName = extracted;
                // Check if we have a learned mapping for this extracted name
                foundSuggestion = await PartyMappingService.getSuggestedName(extractedLower);
                // Only use suggestion if it's not blank
                if (!foundSuggestion || foundSuggestion.trim().length === 0) {
                  foundSuggestion = null;
                }
                // If we found a clear party name from colon pattern, STOP searching further
                // Don't continue to other methods - we've found the actual party name in the narration
                // Only show suggestion if we have a learned mapping, otherwise let user enter it manually
              }
            }
            
            // Method 2: Extract from patterns (enhanced for sample data) - only if we haven't found a clear party name from colon pattern
            if (!foundSuggestion && !extractedPartyName) {
            const patterns = [
              // NEFT CR-XXXX-COMPANY NAME-SRI RAJA... pattern
              /(?:NEFT|IMPS|RTGS)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:SRI\s+RAJA|SRI\s+RAJESHWARI|[A-Z]{2,4}\d{6,})/i,
              // CHQ DEP patterns with company name before bank name
              /CHQ\s+DEP[^:]*:\s*([A-Z][A-Z\s\w&]+?)\s*:[A-Z\s]+BANK/i,
              // Generic NEFT/IMPS patterns
              /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
              /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w&]+?)(?:\s*-\s*\d+|\s*$)/i,
              /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
            ];
            
            for (const pattern of patterns) {
              const match = desc.match(pattern);
              if (match && match[1]) {
                const extracted = match[1].trim().toLowerCase();
                // Filter out "SRI RAJA" patterns and other unwanted text
                if (!extracted.includes('sri raja') && extracted.length > 3 && extracted.length < 100) {
                  foundSuggestion = await PartyMappingService.getSuggestedName(extracted);
                  // Only use suggestion if it's not blank
                  if (foundSuggestion && foundSuggestion.trim().length > 0) {
                    break;
                  } else {
                    foundSuggestion = null;
                  }
                }
              }
            }
          }
          
          // Method 3: Extract meaningful parts - only if we haven't found a clear party name from colon pattern
          if (!foundSuggestion && !extractedPartyName) {
            const parts = desc
              .split(/[\s\-:]+/)
              .filter(p => p.length > 2)
              .filter(p => !/^\d+$/.test(p))
              .filter(p => !/^[A-Z]{2,4}\d+$/.test(p))
              .filter(p => !/^[A-Z]{2,4}N\d+$/.test(p))
              .filter(p => !/^\d{10,}$/.test(p))
              .filter(p => !/^[A-Z0-9@]+$/.test(p) && p.length > 5)
              .filter(p => !/^(NEFT|IMPS|RTGS|UPI|FT|CHQ|CR|DR|DEP|HYDERABAD|CTS|CLG|WBO|HYD|TPT|SRR)$/i.test(p));
            
            // Try sequences of 2-4 words
            for (let i = 0; i < parts.length - 1 && !foundSuggestion; i++) {
              for (let len = 2; len <= 4 && i + len <= parts.length; len++) {
                const phrase = parts.slice(i, i + len).join(" ").toLowerCase();
                if (phrase.length > 5 && phrase.length < 80) {
                  foundSuggestion = await PartyMappingService.getSuggestedName(phrase);
                  // Only use suggestion if it's not blank
                  if (foundSuggestion && foundSuggestion.trim().length > 0) {
                    break;
                  } else {
                    foundSuggestion = null;
                  }
                }
              }
            }
          }
          
          // Method 4: Clean full description - only if we haven't found a clear party name yet
          if (!foundSuggestion && !extractedPartyName) {
            let cleanedDesc = desc
              .replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
              .replace(/\b[A-Z]{2,4}\d{6,}\b/gi, " ")
              .replace(/\b[A-Z]{2,4}N\d{10,}\b/gi, " ")
              .replace(/\b\d{10,}\b/g, " ")
              .replace(/X{6,}/gi, " ")
              .replace(/@[A-Z0-9]+/gi, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            
            if (cleanedDesc.length > 5) {
              foundSuggestion = await PartyMappingService.getSuggestedName(cleanedDesc);
              // Only use suggestion if it's not blank
              if (!foundSuggestion || foundSuggestion.trim().length === 0) {
                foundSuggestion = null;
              }
            }
          }
          }
        }
        
        // Update suggestions cache
        if (foundSuggestion && foundSuggestion.trim().length > 0) {
          // Convert single suggestion to array format
          setPartySuggestions(prev => ({ ...prev, [transaction.id]: [foundSuggestion] }));
        } else {
          // Mark as checked (no suggestion) to prevent re-checking
          setPartySuggestions(prev => ({ ...prev, [transaction.id]: null }));
        }
        
        loadingSuggestionsRef.current.delete(transaction.id);
      })().catch(() => {
        setPartySuggestions(prev => ({ ...prev, [transaction.id]: null }));
        loadingSuggestionsRef.current.delete(transaction.id);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, startIndex, endIndex, filteredTransactions.length]); // Reload when page changes or transaction count changes

  // Handle checkbox toggle
  const handleToggleVyapar = (id: string, checked: boolean) => {
    const transaction = transactions.find((t) => t.id === id);
    const hasRef = Boolean(
      (transaction?.vyapar_reference_number ? String(transaction.vyapar_reference_number).trim() : '') ||
      (inputValues[id] ? String(inputValues[id]).trim() : '')
    );
    const hasPartyName = Boolean(transaction?.partyName && transaction.partyName.trim() !== '');
    const isCompleted = checked && hasRef && hasPartyName;
    
    const updates: any = { added_to_vyapar: checked };
    
    // If transaction becomes completed and was on hold, remove hold
    if (isCompleted && transaction?.hold) {
      updates.hold = false;
    }
    
    if (!transaction) return;
    StorageService.updateTransaction(id, updates, transaction);
    
    if (!checked) {
      // Clear reference number - already included in updates above
      // Clear local input value
      setInputValues((prev) => {
        const newValues = { ...prev };
        delete newValues[id];
        return newValues;
      });
    }
    // Update transaction in local state immediately - NEVER UPDATE DATE
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              added_to_vyapar: checked,
              vyapar_reference_number: checked ? t.vyapar_reference_number : undefined,
              hold: isCompleted && t.hold ? false : t.hold,
              date: t.date, // Explicitly preserve original date
            }
          : t
      )
    );
  };

  // Handle reference number change
  const handleReferenceChange = (id: string, value: string) => {
    // ONLY update local input state - don't update transactions state while typing
    // This prevents re-renders that cause focus loss
    setInputValues((prev) => ({ ...prev, [id]: value }));
    // Save to Google Sheets in background (async, doesn't cause re-render)
    // Use setTimeout to debounce updates
    setTimeout(() => {
      const transaction = transactions.find((t) => t.id === id);
      if (transaction) {
        StorageService.updateTransaction(id, { vyapar_reference_number: value || undefined }, transaction);
      }
    }, 500);
  };

  // Handle confirm (tick icon)
  const handleConfirm = async (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (transaction) {
      const finalValue = inputValues[id] ?? transaction.vyapar_reference_number ?? "";
      if (finalValue.trim()) {
        // Check for duplicate Vyapar reference number
        const { checkDuplicateVyaparRef, verifyTransactionUpdate } = await import('../services/googleSheetsService');
        const duplicateCheck = await checkDuplicateVyaparRef(finalValue.trim(), id);
        
        if (duplicateCheck.isDuplicate && duplicateCheck.existingTransaction) {
          const existing = duplicateCheck.existingTransaction;
          const existingDate = existing.date || 'N/A';
          const existingAmount = existing.amount || 0;
          const existingParty = existing.partyName || 'N/A';
          
          alert(
            `❌ DUPLICATE VYAPAR REFERENCE NUMBER!\n\n` +
            `This Vyapar reference number "${finalValue.trim()}" already exists:\n\n` +
            `Transaction ID: ${duplicateCheck.existingTransactionId}\n` +
            `Date: ${existingDate}\n` +
            `Amount: ₹${existingAmount.toLocaleString()}\n` +
            `Supplier: ${existingParty}\n\n` +
            `Please use a different Vyapar reference number.`
          );
          return; // Prevent submission
        }
        
        // Remove hold status when completing transaction
        const updates: any = {
          added_to_vyapar: true,
          vyapar_reference_number: finalValue.trim(),
        };
        
        // If transaction was on hold, remove hold status
        if (transaction.hold) {
          updates.hold = false;
        }
        
        // Ensure checkbox is checked and save to Google Sheets
        // Update local state first for immediate UI feedback
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  added_to_vyapar: true,
                  vyapar_reference_number: finalValue.trim(),
                  hold: false, // Remove hold when completed
                  date: t.date, // Explicitly preserve original date
                }
              : t
          )
        );
        
        // Clear local input value
        setInputValues((prev) => {
          const newValues = { ...prev };
          delete newValues[id];
          return newValues;
        });
        
        // Clear focus tracking
        focusedInputId.current = null;
        
        // Save to Google Sheets (this will show error if it fails)
        StorageService.updateTransaction(id, updates, transaction);
        
        alert("Transaction moved to completed transactions");
      }
    }
  };

  // Handle cancel (X icon)
  const handleCancel = (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (!transaction) return;
    
    StorageService.updateTransaction(id, {
      added_to_vyapar: false,
      vyapar_reference_number: undefined,
    }, transaction);
    
    // Clear focus tracking
    focusedInputId.current = null;
    
    // Update local state
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              added_to_vyapar: false,
              vyapar_reference_number: undefined,
            }
          : t
      )
    );
    
    // Clear local input value
    setInputValues((prev) => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  // Handle party name edit start
  const handleStartEditPartyName = (transactionId: string, currentName: string) => {
    setEditingPartyName(transactionId);
    setEditingPartyValue(currentName);
  };

  // Handle party name edit save
  const handleSavePartyName = async (transactionId: string, originalName: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    const newName = editingPartyValue.trim();
    
    // Update UI immediately (optimistic update) - don't wait for async operations
    setEditingPartyName(null);
    setEditingPartyValue("");
    
    if (!newName) {
      // Allow saving empty name (user can clear it)
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, partyName: "", date: t.date } : t
        )
      );
      // Update in background (already async inside)
      StorageService.updateTransaction(transactionId, {
        partyName: "",
      }, transaction);
      return;
    }

    if (newName === originalName) {
      return;
    }

    // Update local state immediately with the NEW party name
    // BUT: Don't update if user is currently typing in Vyapar ref input (to prevent focus loss)
    if (focusedInputId.current !== transactionId) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, partyName: newName, date: t.date } : t
        )
      );
    }
    
    // Create updated transaction object with the new party name for Google Sheets
    // NEVER UPDATE DATE - preserve original date
    const updatedTransactionForSheets = { 
      ...transaction, 
      partyName: newName,
      date: transaction.date, // Explicitly preserve original date
    };

    // Run learning operations in background (don't block UI)
    // AUTOMATIC TRAINING: System learns multiple patterns from narration automatically
    // When user enters party name, system extracts and learns ALL possible patterns
    // Examples:
    // "NEFT CR-SBIN0002776-MERCURE MEDI SURGE INNOVATIONS PRIV-SRI RAJA RAJESHWARI ORTHO-SBINN52025110406690875"
    // "SRI RAJA RAJESHWARI ORTHO PLUS CR - 50200090155304 - SRI BALAJI PHARMACY"
    // "FT - CR - 50200114785646 - SREE LAKSHMI GAYATRI HOSPITALS PVT LTD"
    // Note: transaction is already declared above on line 318
    (async () => {
    if (transaction && transaction.description) {
      const desc = transaction.description.trim();
      const partyNameLower = newName.toLowerCase();
      const partyWords = partyNameLower.split(/\s+/).filter(w => w.length > 2);
      
      // Track all learned patterns for this party name
      const learnedPatterns: string[] = [];
      
      // AUTOMATIC TRAINING METHOD 1: Extract text between transaction codes and account numbers
      // Learn ALL matching patterns automatically (not just the first one)
      const patterns = [
        // NEFT CR-SBIN0002776-MERCURE MEDI SURGE...-SBINN52025110406690875
        /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
        // CODE - NUMBER - PARTYNAME - NUMBER
        /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w]+?)(?:\s*-\s*\d+|\s*$)/i,
        // UPI-YASHIKA SURGICALS-KEERAM1@YBL (party name early)
        /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
      ];
      
      // Learn from ALL patterns that match (automatic training)
      for (const pattern of patterns) {
        const match = desc.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim().toLowerCase();
          const significantWords = partyWords.filter(w => w.length > 3);
          const hasMatch = significantWords.length > 0 && 
            significantWords.some(word => extracted.includes(word));
          
          if (hasMatch && extracted.length > 3 && extracted.length < 100 && !learnedPatterns.includes(extracted)) {
            await PartyMappingService.learnMapping(extracted, newName).catch(err => {
              console.error('Error learning mapping:', err);
            });
            learnedPatterns.push(extracted);
          }
        }
      }
      
      // AUTOMATIC TRAINING METHOD 2: Find party name as it appears in narration (most reliable)
      // Learn the exact pattern as it appears
      if (partyWords.length >= 1) {
        const partyNamePattern = partyWords
          .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[\\s\\-:]+');
        const nameMatch = desc.match(new RegExp(`(${partyNamePattern})`, 'i'));
        if (nameMatch && nameMatch[1]) {
          const extracted = nameMatch[1].trim();
          const cleaned = extracted.replace(/^[\s\-:]+|[\s\-:]+$/g, '').replace(/[\s\-:]+/g, ' ');
          if (cleaned.length > 3 && cleaned.length < 100 && !learnedPatterns.includes(cleaned.toLowerCase())) {
            await PartyMappingService.learnMapping(cleaned.toLowerCase(), newName).catch(err => {
              console.error('Error learning mapping:', err);
            });
            learnedPatterns.push(cleaned.toLowerCase());
          }
        }
      }
      
      // AUTOMATIC TRAINING METHOD 3: Extract text between colons (for CHQ DEP patterns)
      const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w]+?)\s*:/i);
      if (colonPattern && colonPattern[1]) {
        const extracted = colonPattern[1].trim().toLowerCase();
        const significantWords = partyWords.filter(w => w.length > 3);
        const hasMatch = significantWords.length > 0 && 
          significantWords.some(word => extracted.includes(word));
        
        if (hasMatch && extracted.length > 3 && extracted.length < 100 && !learnedPatterns.includes(extracted)) {
          await PartyMappingService.learnMapping(extracted, newName).catch(err => {
            console.error('Error learning mapping:', err);
          });
          learnedPatterns.push(extracted);
        }
      }
      
      // AUTOMATIC TRAINING METHOD 4: Extract ALL meaningful parts from narration
      // System automatically learns multiple variations
      const parts = desc
        .split(/[\s\-:]+/)
        .filter(p => p.length > 2)
        .filter(p => !/^\d+$/.test(p))
        .filter(p => !/^[A-Z]{2,4}\d+$/.test(p))
        .filter(p => !/^[A-Z]{2,4}N\d+$/.test(p))
        .filter(p => !/^\d{10,}$/.test(p))
        .filter(p => !/^[A-Z0-9@]+$/.test(p) && p.length > 5)
        .filter(p => !/^(NEFT|IMPS|RTGS|UPI|FT|CHQ|CR|DR|DEP|HYDERABAD|CTS|CLG|WBO|HYD|TPT|SRR)$/i.test(p));
      
      // Learn ALL sequences that contain party name words (not just one)
      for (let i = 0; i < parts.length; i++) {
        for (let len = 1; len <= 6 && i + len <= parts.length; len++) {
          const phrase = parts.slice(i, i + len).join(" ");
          const phraseLower = phrase.toLowerCase();
          const hasMatch = partyWords.some(word => word.length > 3 && phraseLower.includes(word));
          
          if (hasMatch && phrase.length > 5 && phrase.length < 100 && !learnedPatterns.includes(phraseLower)) {
            await PartyMappingService.learnMapping(phraseLower, newName).catch(err => {
              console.error('Error learning mapping:', err);
            });
            learnedPatterns.push(phraseLower);
          }
        }
      }
      
      // AUTOMATIC TRAINING METHOD 5: Learn from cleaned full description
      let cleanedDesc = desc
        .replace(/REF\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
        .replace(/TXN\s*ID[:\-]?\s*[A-Z0-9]+/gi, " ")
        .replace(/UTR[:\-]?\s*[A-Z0-9]+/gi, " ")
        .replace(/CHQ\s*NO[:\-]?\s*[A-Z0-9]+/gi, " ")
        .replace(/\b[A-Z]{2,4}\d{6,}\b/gi, " ")
        .replace(/\b[A-Z]{2,4}N\d{10,}\b/gi, " ")
        .replace(/\b\d{10,}\b/g, " ")
        .replace(/X{6,}/gi, " ")
        .replace(/@[A-Z0-9]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      
      if (cleanedDesc.length > 5 && !learnedPatterns.includes(cleanedDesc)) {
        await PartyMappingService.learnMapping(cleanedDesc, newName).catch(err => {
          console.error('Error learning mapping:', err);
        });
        learnedPatterns.push(cleanedDesc);
      }
      
      // AUTOMATIC TRAINING METHOD 6: Learn key phrases (first 2-4 words, last 2-4 words)
      // This helps system recognize partial matches
      const allWords = cleanedDesc.split(/\s+/).filter(w => w.length > 2);
      if (allWords.length >= 2) {
        // Learn first 2-4 words
        for (let len = 2; len <= 4 && len <= allWords.length; len++) {
          const phrase = allWords.slice(0, len).join(" ");
          if (phrase.length > 5 && !learnedPatterns.includes(phrase)) {
            const hasMatch = partyWords.some(word => word.length > 3 && phrase.includes(word));
            if (hasMatch) {
              await PartyMappingService.learnMapping(phrase, newName).catch(err => {
                console.error('Error learning mapping:', err);
              });
              learnedPatterns.push(phrase);
            }
          }
        }
        
        // Learn last 2-4 words
        for (let len = 2; len <= 4 && len <= allWords.length; len++) {
          const phrase = allWords.slice(-len).join(" ");
          if (phrase.length > 5 && !learnedPatterns.includes(phrase)) {
            const hasMatch = partyWords.some(word => word.length > 3 && phrase.includes(word));
            if (hasMatch) {
              await PartyMappingService.learnMapping(phrase, newName).catch(err => {
                console.error('Error learning mapping:', err);
              });
              learnedPatterns.push(phrase);
            }
          }
        }
      }
      
      console.log(`🤖 Auto-trained ${learnedPatterns.length} patterns for "${newName}" from narration`);
    }

    // Also learn from original name if it exists (for corrections)
    if (originalName && originalName.trim() !== "" && originalName !== newName) {
        await PartyMappingService.learnMapping(originalName, newName).catch(err => {
          console.error('Error learning mapping:', err);
        });
    }

      // Update transaction in Google Sheets (background - already async inside)
      // IMPORTANT: Pass the updated transaction with the new party name to ensure correct save
    StorageService.updateTransaction(transactionId, {
      partyName: newName,
      }, updatedTransactionForSheets);

    // Also manually trigger training from narration for this transaction
    if (transaction && transaction.description) {
        await PartyMappingService.autoTrainFromNarration(transaction.description, newName).catch(err => {
          console.error('Error training from narration:', err);
        });
      }

      // Clear suggestions cache for all transactions to force reload with fresh mappings
      // This ensures newly learned mappings are immediately available for all transactions
      setPartySuggestions({});
      loadingSuggestionsRef.current.clear();
      
      // Reload suggestions for all visible transactions after a short delay
      // This allows the Google Sheets cache to be refreshed and new mappings to be available
      setTimeout(() => {
        paginatedTransactions.forEach(t => {
          if (t.partyName && !loadingSuggestionsRef.current.has(t.id)) {
            loadingSuggestionsRef.current.add(t.id);
            PartyMappingService.getSuggestedName(t.partyName).then(suggested => {
              if (suggested && suggested.trim().length > 0 && suggested !== t.partyName) {
                setPartySuggestions(prev => ({ ...prev, [t.id]: [suggested] }));
              }
              loadingSuggestionsRef.current.delete(t.id);
            }).catch(() => {
              loadingSuggestionsRef.current.delete(t.id);
            });
          }
        });
      }, 1000);
    })().catch(err => {
      console.error('Error in background learning:', err);
    });
  };

  // Handle party name edit cancel
  const handleCancelPartyNameEdit = () => {
    setEditingPartyName(null);
    setEditingPartyValue("");
  };

  // Get suggestion from narration (for transactions without party names)
  // Note: getSuggestionFromNarration is now removed - suggestions are handled via async calls in the UI
  // This function is kept for backward compatibility but returns null
  // The actual suggestion logic is now in the render code using async PartyMappingService calls
  const getSuggestionFromNarration = (description: string | undefined): string | null => {
    // This function is deprecated - suggestions are now handled asynchronously in the UI
    return null;
  };

  // Handle Hold status
  const handleSetHold = (transactionId: string) => {
    const confirmed = window.confirm(
      "Do you want to put this transaction on HOLD?\n\n" +
      "This will mark the transaction as held. You can hold transactions without entering Vyapar reference number.\n" +
      "The Vyapar reference number and supplier name will remain unchanged."
    );
    
    if (confirmed) {
      const transaction = transactions.find((t) => t.id === transactionId);
      if (transaction) {
        StorageService.updateTransaction(transactionId, { hold: true }, transaction);
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, hold: true, date: t.date } : t))
        );
        // Switch to hold view
        setView("hold");
      }
    }
  };

  // Handle Unhold
  const handleUnhold = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    StorageService.updateTransaction(transactionId, { hold: false }, transaction);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hold: false, date: t.date } : t))
    );
  };

  // Handle Set Self Transfer
  const handleSetSelfTransfer = (transactionId: string) => {
    const confirmed = window.confirm("Move this transaction to Self Transfer?");
    
    if (confirmed) {
      const transaction = transactions.find((t) => t.id === transactionId);
      if (transaction) {
        // CRITICAL: NEVER UPDATE DATE - preserve original date from CSV upload
        const originalDate = transaction.date;
        console.log('🔒 Preserving original date:', originalDate, 'for transaction:', transactionId);
        
        // Only update selfTransfer flag, never date
        StorageService.updateTransaction(transactionId, { selfTransfer: true }, transaction);
        setTransactions((prev) =>
          prev.map((t) => {
            if (t.id === transactionId) {
              // Ensure date is preserved
              const updated = { ...t, selfTransfer: true, date: originalDate };
              if (updated.date !== originalDate) {
                console.error('❌ ERROR: Date was modified! Restoring original date.');
                updated.date = originalDate;
              }
              return updated;
            }
            return t;
          })
        );
        // Switch to self transfer view
        setView("selfTransfer");
      }
    }
  };

  // Handle Unset Self Transfer
  const handleUnsetSelfTransfer = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    StorageService.updateTransaction(transactionId, { selfTransfer: false }, transaction);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, selfTransfer: false, date: t.date } : t))
    );
  };

  // Handle apply suggestion
  const handleApplySuggestion = async (transactionId: string, originalName: string, suggestedName: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    // Learn the mapping (async)
    await PartyMappingService.learnMapping(originalName, suggestedName).catch(err => {
      console.error('Error learning party mapping:', err);
    });

    // Update transaction
    StorageService.updateTransaction(transactionId, {
      partyName: suggestedName,
    }, transaction);

    // Also learn from narration if available
    if (transaction && transaction.description) {
      PartyMappingService.autoTrainFromNarration(transaction.description, suggestedName).catch(err => {
        console.error('Error training party mapping:', err);
      });
    }

    // Update local state - NEVER UPDATE DATE
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, partyName: suggestedName, date: t.date } : t
      )
    );
  };

  // Handle opening edit modal for pending transactions
  const handleOpenEditModal = async (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalPartyName(transaction.partyName || "");
    setModalVyaparRef(transaction.vyapar_reference_number || "");
    setModalSuggestions([]); // Reset suggestions
    
    // Load suggestions for this transaction
    if (transaction.description) {
      const desc = transaction.description.trim();
      let foundSuggestions: string[] = []; // Track suggestions locally
      
      // Try word-by-word matching first (returns top 2-3 matches) - USE SUPPLIERS for debit transactions
      const matchedParties = await PartyMappingService.findSuppliersFromNarration(desc, 3);
      if (matchedParties.length > 0) {
        // Filter out blank/empty recommendations
        const validParties = matchedParties.filter(p => p && p.trim().length > 0);
        if (validParties.length > 0) {
          foundSuggestions = validParties;
        }
      }
      
      // If no suggestions from word-by-word matching, try pattern extraction
      if (foundSuggestions.length === 0) {
        // Try to extract party name from description using various patterns
        const patterns = [
          /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
          /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w]+?)(?:\s*-\s*\d+|\s*$)/i,
          /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
        ];
        
        let extractedName = "";
        for (const pattern of patterns) {
          const match = desc.match(pattern);
          if (match && match[1]) {
            extractedName = match[1].trim();
            break;
          }
        }
        
        // If we extracted a name, try to get suggestion for it
        if (extractedName) {
          const suggested = await PartyMappingService.getSuggestedName(extractedName);
          if (suggested && suggested.trim().length > 0) {
            foundSuggestions = [suggested];
          }
        }
      }
      
      // If no suggestion yet, try to get suggestions from the description itself
      if (foundSuggestions.length === 0) {
        // Try getting suggestions from cleaned description parts
        const parts = desc
          .split(/[\s\-:]+/)
          .filter(p => p.length > 3)
          .filter(p => !/^\d+$/.test(p))
          .filter(p => !/^[A-Z]{2,4}\d+$/.test(p))
          .filter(p => !/^\d{10,}$/.test(p))
          .slice(0, 5); // Take first 5 meaningful parts
        
        const tempSuggestions: string[] = [];
        for (const part of parts) {
          const suggested = await PartyMappingService.getSuggestedName(part);
          if (suggested && suggested.trim().length > 0 && !tempSuggestions.includes(suggested)) {
            tempSuggestions.push(suggested);
            if (tempSuggestions.length >= 3) break;
          }
        }
        if (tempSuggestions.length > 0) {
          foundSuggestions = tempSuggestions;
        }
      }
      
      // Set all found suggestions at once
      if (foundSuggestions.length > 0) {
        setModalSuggestions(foundSuggestions);
      }
    }
  };

  // Handle closing edit modal
  const handleCloseEditModal = () => {
    setEditingTransaction(null);
    setModalPartyName("");
    setModalVyaparRef("");
    setModalSuggestions([]);
  };

  // Handle submitting transaction from modal (move to completed)
  const handleSubmitTransaction = async () => {
    if (!editingTransaction) return;
    
    const partyName = modalPartyName.trim();
    const vyaparRef = modalVyaparRef.trim();
    
    if (!partyName || !vyaparRef) {
      alert("Please enter both Supplier Name and Vyapar Reference Number");
      return;
    }
    
    // Check for duplicate Vyapar reference number
    const { checkDuplicateVyaparRef, verifyTransactionUpdate } = await import('../services/googleSheetsService');
    const duplicateCheck = await checkDuplicateVyaparRef(vyaparRef, editingTransaction.id);
    
    if (duplicateCheck.isDuplicate && duplicateCheck.existingTransaction) {
      const existing = duplicateCheck.existingTransaction;
      const existingDate = existing.date || 'N/A';
      const existingAmount = existing.amount || 0;
      const existingParty = existing.partyName || 'N/A';
      
      alert(
        `❌ DUPLICATE VYAPAR REFERENCE NUMBER!\n\n` +
        `This Vyapar reference number "${vyaparRef}" already exists:\n\n` +
        `Transaction ID: ${duplicateCheck.existingTransactionId}\n` +
        `Date: ${existingDate}\n` +
        `Amount: ₹${existingAmount.toLocaleString()}\n` +
        `Supplier: ${existingParty}\n\n` +
        `Please use a different Vyapar reference number.`
      );
      return; // Prevent submission
    }
    
    // Update transaction with party name and Vyapar ref
    // NEVER UPDATE DATE - preserve original date
    const updatedTransaction = {
      ...editingTransaction,
      partyName,
      vyapar_reference_number: vyaparRef,
      added_to_vyapar: true,
      hold: false, // Remove hold if it was on hold
      date: editingTransaction.date, // Explicitly preserve original date
    };
    
    // Update local state first
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransaction.id ? updatedTransaction : t
      )
    );
    
    // Close modal
    handleCloseEditModal();
    
    // Save to Google Sheets (this will show error if it fails)
    StorageService.updateTransaction(editingTransaction.id, {
      partyName,
      vyapar_reference_number: vyaparRef,
      added_to_vyapar: true,
      hold: false,
    }, updatedTransaction);
    
    // Learn from narration
    if (editingTransaction.description) {
      PartyMappingService.autoTrainFromNarration(editingTransaction.description, partyName).catch(err => {
        console.error('Error training party mapping:', err);
      });
    }
    
    alert("Transaction moved to completed!");
  };

  // Handle moving transaction to hold from modal
  const handleMoveToHold = async () => {
    if (!editingTransaction) return;
    
    // Update transaction to hold status
    // NEVER UPDATE DATE - preserve original date
    const updatedTransaction = {
      ...editingTransaction,
      hold: true,
      // Don't require party name or vyapar ref for hold
      partyName: modalPartyName.trim() || editingTransaction.partyName || undefined,
      vyapar_reference_number: modalVyaparRef.trim() || editingTransaction.vyapar_reference_number || undefined,
      date: editingTransaction.date, // Explicitly preserve original date
    };
    
    // Save to Google Sheets
    StorageService.updateTransaction(editingTransaction.id, {
      hold: true,
      partyName: updatedTransaction.partyName,
      vyapar_reference_number: updatedTransaction.vyapar_reference_number,
    }, updatedTransaction);
    
    // Learn from narration if party name was provided
    if (editingTransaction.description && modalPartyName.trim()) {
      PartyMappingService.autoTrainFromNarration(editingTransaction.description, modalPartyName.trim()).catch(err => {
        console.error('Error training party mapping:', err);
      });
    }

    // Update local state
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransaction.id ? updatedTransaction : t
      )
    );
    
    // Close modal
    handleCloseEditModal();
    
    alert("Transaction moved to hold!");
  };

  // Handle moving transaction to self transfer from modal
  const handleMoveToSelfTransfer = async () => {
    if (!editingTransaction) return;
    
    // CRITICAL: NEVER UPDATE DATE - Date should only be set from CSV upload, never modified
    // Store original date to ensure it's never changed
    const originalDate = editingTransaction.date;
    console.log('🔒 Preserving original date:', originalDate, 'for transaction:', editingTransaction.id);
    
    // Update transaction to self transfer status
    // NEVER UPDATE DATE - preserve original date from CSV upload
    const updatedTransaction = {
      ...editingTransaction,
      selfTransfer: true,
      // Don't require party name or vyapar ref for self transfer
      partyName: modalPartyName.trim() || editingTransaction.partyName || undefined,
      vyapar_reference_number: modalVyaparRef.trim() || editingTransaction.vyapar_reference_number || undefined,
      date: originalDate, // CRITICAL: Always use original date, never update
    };
    
    // Verify date hasn't changed
    if (updatedTransaction.date !== originalDate) {
      console.error('❌ ERROR: Date was modified! Restoring original date.');
      updatedTransaction.date = originalDate;
    }
    
    // Save to Google Sheets - only send fields that can be updated, NEVER date
    StorageService.updateTransaction(editingTransaction.id, {
      selfTransfer: true,
      partyName: updatedTransaction.partyName,
      vyapar_reference_number: updatedTransaction.vyapar_reference_number,
      // DO NOT include date in updates - it will be preserved from fullTransaction
    }, updatedTransaction);
    
    // Learn from narration if party name was provided
    if (editingTransaction.description && modalPartyName.trim()) {
      PartyMappingService.autoTrainFromNarration(editingTransaction.description, modalPartyName.trim()).catch(err => {
        console.error('Error training party mapping:', err);
      });
    }

    // Update local state
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransaction.id ? updatedTransaction : t
      )
    );
    
    // Close modal
    handleCloseEditModal();
    
    alert("Transaction moved to self transfer!");
  };

  // Print/PDF export function
  const handlePrint = () => {
    if (filteredTransactions.length === 0) {
      alert("No transactions to print. Please adjust your filters.");
      return;
    }

    // Create print-friendly HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the transactions.");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pending Transactions Report</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              margin: 0;
              padding: 20px;
              color: #000;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .header .subtitle {
              margin-top: 5px;
              font-size: 14px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #333;
              color: #fff;
              padding: 10px;
              text-align: left;
              font-weight: bold;
              border: 2px solid #000;
            }
            td {
              padding: 10px;
              border: 1px solid #000;
              vertical-align: top;
            }
            .date-col {
              width: 15%;
              white-space: nowrap;
            }
            .narration-col {
              width: 55%;
            }
            .party-col {
              width: 30%;
              min-height: 30px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Pending Transactions Report</h1>
            <div class="subtitle">Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="date-col">Date</th>
                <th class="narration-col">Narration</th>
                <th class="party-col">Supplier Name</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map((t) => {
                return `
                  <tr>
                    <td class="date-col">${formatDate(t.date)}</td>
                    <td class="narration-col">${t.description || ''}</td>
                    <td class="party-col">&nbsp;</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-gradient">
            Debit Transactions
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage withdrawal transactions and track Vyapar entries
            <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
              {filteredTransactions.length} found
            </span>
            {isGoogleSheetsConfigured() && lastSyncTime && (
              <span className="ml-3 text-sm text-slate-500">
                • Last synced: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        {isGoogleSheetsConfigured() && (
          <Button
            variant="outline"
            onClick={loadTransactions}
            disabled={isLoading}
            className="flex items-center gap-2 border-slate-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        )}
      </div>

      {/* Tabs - Minimal & Clean */}
      <div className="flex gap-2 border-b border-border/60 bg-card/50 rounded-t-lg p-1">
        <button
          onClick={() => setView("pending")}
          className={cn(
            "px-6 py-3 font-semibold rounded-lg transition-all duration-200 relative",
            view === "pending"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Pending
          {view === "pending" && filteredTransactions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs font-bold">
              {filteredTransactions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView("completed")}
          className={cn(
            "px-6 py-3 font-semibold rounded-lg transition-all duration-200",
            view === "completed"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Completed
        </button>
        <button
          onClick={() => setView("hold")}
          className={cn(
            "px-6 py-3 font-semibold rounded-lg transition-all duration-200",
            view === "hold"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Hold
        </button>
        <button
          onClick={() => setView("selfTransfer")}
          className={cn(
            "px-6 py-3 font-semibold rounded-lg transition-all duration-200",
            view === "selfTransfer"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Self Transfer
        </button>
      </div>

      {view === "pending" ? (
        // Minimal & Clean Pending Transactions UI
        <div className="space-y-4 animate-fade-in">
          {/* Stats & Search Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stats Cards - Compact */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <Card className="glass-card border border-border/60 animate-scale-in">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pending Count</p>
                      <p className="text-2xl font-bold text-foreground">
                        {filteredTransactions.length}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card border border-border/60 animate-scale-in" style={{ animationDelay: '50ms' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{filteredTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <span className="text-xl font-bold text-muted-foreground">₹</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search & Sort - Compact */}
            <Card className="glass-card border border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant={dateSort === "desc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateSort(dateSort === "desc" ? null : "desc")}
                    className="flex-1 h-8 text-xs"
                  >
                    <ArrowDown className="h-3 w-3 mr-1" />
                    Newest
                  </Button>
                  <Button
                    type="button"
                    variant={dateSort === "asc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateSort(dateSort === "asc" ? null : "asc")}
                    className="flex-1 h-8 text-xs"
                  >
                    <ArrowUp className="h-3 w-3 mr-1" />
                    Oldest
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Date Range Filter - Compact */}
          <Card className="glass-card border border-border/60">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="dateFrom" className="text-xs font-semibold mb-1.5 block">From Date (DD/MM/YYYY)</Label>
                  <DatePicker
                    id="dateFrom"
                    value={dateFrom}
                    onChange={(value) => {
                      if (view === "pending") setDateFromPending(value);
                      else if (view === "completed") setDateFromCompleted(value);
                      else if (view === "hold") setDateFromHold(value);
                      else setDateFromSelfTransfer(value);
                    }}
                    placeholder="DD/MM/YYYY"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="dateTo" className="text-xs font-semibold mb-1.5 block">To Date (DD/MM/YYYY)</Label>
                  <DatePicker
                    id="dateTo"
                    value={dateTo}
                    onChange={(value) => {
                      if (view === "pending") setDateToPending(value);
                      else if (view === "completed") setDateToCompleted(value);
                      else if (view === "hold") setDateToHold(value);
                      else setDateToSelfTransfer(value);
                    }}
                    placeholder="DD/MM/YYYY"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  disabled={filteredTransactions.length === 0}
                  className="h-9 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  title="Print/Save as PDF"
                >
                  <Printer className="h-4 w-4" />
                  Print PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (view === "pending") {
                      setDateFromPending("");
                      setDateToPending("");
                    } else if (view === "completed") {
                      setDateFromCompleted("");
                      setDateToCompleted("");
                    } else if (view === "hold") {
                      setDateFromHold("");
                      setDateToHold("");
                    } else {
                      setDateFromSelfTransfer("");
                      setDateToSelfTransfer("");
                    }
                    setDateSort(null);
                  }}
                  className="h-9"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Filters for Completed and Hold Transactions
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Filters */}
            <div className="grid gap-4 md:grid-cols-5">
            <div>
                <Label htmlFor="dateFromCompleted">From Date (DD/MM/YYYY)</Label>
              <DatePicker
                id="dateFromCompleted"
                value={dateFrom}
                onChange={(value) => {
                  if (view === "completed") setDateFromCompleted(value);
                  else if (view === "hold") setDateFromHold(value);
                  else setDateFromSelfTransfer(value);
                }}
                placeholder="DD/MM/YYYY"
                className="h-9 text-sm"
              />
            </div>
            <div>
                <Label htmlFor="dateToCompleted">To Date (DD/MM/YYYY)</Label>
              <DatePicker
                id="dateToCompleted"
                value={dateTo}
                onChange={(value) => {
                  if (view === "completed") setDateToCompleted(value);
                  else if (view === "hold") setDateToHold(value);
                  else setDateToSelfTransfer(value);
                }}
                placeholder="DD/MM/YYYY"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label>Actions</Label>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                disabled={filteredTransactions.length === 0}
                className="h-9 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full"
                title="Print/Save as PDF"
              >
                <Printer className="h-4 w-4" />
                Print PDF
              </Button>
            </div>
              <div>
                <Label>Sort by Date</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={dateSort === "asc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateSort(dateSort === "asc" ? null : "asc")}
                    className="flex-1"
                  >
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Oldest
                  </Button>
                  <Button
                    type="button"
                    variant={dateSort === "desc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateSort(dateSort === "desc" ? null : "desc")}
                    className="flex-1"
                  >
                    <ArrowDown className="h-4 w-4 mr-1" />
                    Newest
                  </Button>
                </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (view === "completed") {
                    setDateFromCompleted("");
                    setDateToCompleted("");
                  } else if (view === "hold") {
                    setDateFromHold("");
                    setDateToHold("");
                  } else {
                    setDateFromSelfTransfer("");
                    setDateToSelfTransfer("");
                  }
                  setDateSort(null);
                }}
              >
                  Clear All
              </Button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </CardContent>
      </Card>
      )}

      {view === "pending" ? (
        // NEW: Modern Card-Based Transaction List
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-2">No pending transactions</p>
                <p className="text-sm text-muted-foreground">Upload transactions or adjust your filters</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Clean Table Grid */}
              <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
              <thead className="bg-muted">
                <tr>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Date</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Narration</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Bank Ref No.</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Amount</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className="border-b border-slate-300 bg-card hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-3 text-sm border-r border-slate-300 whitespace-nowrap">{formatDate(transaction.date)}</td>
                            <td className="p-3 text-sm border-r border-slate-300">{transaction.description}</td>
                            <td className="p-3 text-sm text-muted-foreground border-r border-slate-300">
                              {transaction.referenceNumber || "-"}
                            </td>
                            <td className="p-3 text-sm font-semibold text-foreground border-r border-slate-300">
                              ₹{transaction.amount.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(transaction)}
                                className="p-2 hover:bg-primary/10 rounded-md transition-colors"
                                title="Edit transaction"
                              >
                                <Pencil className="h-4 w-4 text-primary" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagination - Always show */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground font-medium">
                        Page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
                        <span className="font-bold text-foreground">{totalPages}</span> •{" "}
                        <span className="font-bold text-primary">{filteredTransactions.length}</span> total transactions
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="itemsPerPage" className="text-sm font-medium">Show:</Label>
                        <select
                          id="itemsPerPage"
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="flex h-9 w-20 rounded-md border-2 border-slate-400 bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-2"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="border-slate-300 hover:bg-primary/5 hover:border-primary/40"
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={cn("min-w-[40px]", currentPage === pageNum ? "btn-gradient" : "border-slate-300 hover:bg-primary/5 hover:border-primary/40")}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="border-slate-300 hover:bg-primary/5 hover:border-primary/40"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            </>
          )}
        </div>
      ) : (
        // Table layout for completed and hold transactions - matching pending style
        <>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Added to Vyapar</th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">
                      <div className="flex items-center gap-2">
                        <span>Date</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (dateSort === "asc") {
                              setDateSort("desc");
                            } else if (dateSort === "desc") {
                              setDateSort(null);
                            } else {
                              setDateSort("asc");
                            }
                          }}
                          className="p-1 hover:bg-accent rounded"
                          title="Sort by date"
                        >
                          {dateSort === "asc" ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : dateSort === "desc" ? (
                            <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Narration</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Bank Ref No.</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Amount</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Party</th>
                  {(view !== "hold" && view !== "selfTransfer") && (
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300">Vyapar Ref No.</th>
                  )}
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                      <td colSpan={view === "hold" || view === "selfTransfer" ? 7 : 8} className="p-8 text-center text-muted-foreground border-b border-slate-300">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                    paginatedTransactions.map((transaction) => {
                    const isAdded = transaction.added_to_vyapar || transaction.inVyapar;
                      const storageRef = transaction.vyapar_reference_number ? String(transaction.vyapar_reference_number).trim() : '';
                      const localRef = inputValues[transaction.id] ? String(inputValues[transaction.id]).trim() : '';
                    const hasReference = Boolean(storageRef || localRef);
                    const showIcons = isAdded && hasReference;

                    // For completed and hold transactions, show full view (unchanged)
                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-b border-slate-300 bg-card hover:bg-muted/50 transition-colors group",
                          transaction.hold && "bg-yellow-50",
                          transaction.selfTransfer && "bg-purple-50",
                          !transaction.hold && !transaction.selfTransfer && isAdded && "bg-green-50"
                        )}
                      >
                        <td className="p-3 border-r border-slate-300">
                          <Checkbox
                            checked={isAdded}
                            onChange={(e) => handleToggleVyapar(transaction.id, e.target.checked)}
                            disabled={transaction.hold === true || transaction.selfTransfer === true}
                            title={transaction.hold ? "Cannot modify - transaction is on hold" : transaction.selfTransfer ? "Cannot modify - transaction is a self transfer" : ""}
                          />
                        </td>
                        <td className="p-3 text-sm border-r border-slate-300 whitespace-nowrap">{formatDate(transaction.date)}</td>
                        <td className="p-3 text-sm border-r border-slate-300">{transaction.description}</td>
                        <td className="p-3 text-sm text-muted-foreground border-r border-slate-300">
                          {transaction.referenceNumber || "-"}
                        </td>
                        <td className="p-3 text-sm font-semibold text-green-600 border-r border-slate-300">
                          ₹{transaction.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            {(() => {
                              // Check if transaction is completed
                              const isAdded = transaction.added_to_vyapar || transaction.inVyapar;
                              const hasRef = Boolean(
                                (transaction.vyapar_reference_number ? String(transaction.vyapar_reference_number).trim() : '') ||
                                (inputValues[transaction.id] ? String(inputValues[transaction.id]).trim() : '')
                              );
                              const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
                              const isCompleted = isAdded && hasRef && hasPartyName;

                              // For completed transactions, just show the supplier name (no editing, no suggestions)
                              if (isCompleted) {
                                return (
                                  <span className="text-sm">{transaction.partyName || "-"}</span>
                                );
                              }

                              // For non-completed transactions, allow editing and show suggestions
                              if (editingPartyName === transaction.id) {
                                return (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editingPartyValue}
                                  onChange={(e) => setEditingPartyValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSavePartyName(transaction.id, transaction.partyName || "");
                                    } else if (e.key === "Escape") {
                                      handleCancelPartyNameEdit();
                                    }
                                  }}
                                  className="w-40 h-7 text-xs border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  placeholder="Enter supplier name"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSavePartyName(transaction.id, transaction.partyName || "")}
                                  className="p-1 hover:bg-green-100 rounded"
                                  title="Save"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelPartyNameEdit}
                                  className="p-1 hover:bg-red-100 rounded"
                                  title="Cancel"
                                >
                                  <XCircle className="h-3 w-3 text-red-600" />
                                </button>
                              </div>
                                );
                              }

                              return (
                              <div className="flex items-center gap-2 group/party">
                                {transaction.partyName ? (
                                  <>
                                    <span>{transaction.partyName}</span>
                                    {(() => {
                                        const suggestions = partySuggestions[transaction.id];
                                      if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
                                        // Show multiple suggestions that are different from current party name
                                        const differentSuggestions = suggestions.filter(s => s !== transaction.partyName);
                                        if (differentSuggestions.length > 0) {
                                          return (
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {differentSuggestions.slice(0, 3).map((suggested, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  onClick={() => handleApplySuggestion(transaction.id, transaction.partyName, suggested)}
                                                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                  title={`Suggested: ${suggested}`}
                                                >
                                                  <Sparkles className="h-3 w-3" />
                                                  → {suggested}
                                                </button>
                                              ))}
                                            </div>
                                          );
                                        }
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditPartyName(transaction.id, transaction.partyName || "")}
                                          className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover/party:opacity-100 transition-opacity"
                                          title="Edit supplier name"
                                        >
                                          <Edit2 className="h-3 w-3 text-gray-500" />
                                        </button>
                                      );
                                    })()}
                                  </>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {(() => {
                                        const suggestions = partySuggestions[transaction.id];
                                        if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
                                          // Show up to 3 suggestions
                                          return (
                                            <>
                                              {suggestions.slice(0, 3).map((suggested, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  onClick={() => handleApplySuggestion(transaction.id, "", suggested)}
                                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                  title={`Suggested: ${suggested}`}
                                                >
                                                  <Sparkles className="h-3 w-3" />
                                                  {suggested}
                                                </button>
                                              ))}
                                            </>
                                          );
                                        }
                                        return (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditPartyName(transaction.id, "")}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground border border-dashed rounded hover:bg-gray-50 transition-colors"
                                    title="Click to add supplier name"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    Add supplier name
                                  </button>
                                        );
                                      })()}
                              </div>
                            )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        {(view !== "hold" && view !== "selfTransfer") && (
                          <td className="p-3 border-r border-slate-300">
                            <div className="flex items-center gap-2">
                              {(() => {
                                // Check if transaction is completed
                                const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
                                const isCompleted = isAdded && hasReference && hasPartyName;

                                // For completed transactions (but not self transfer), show read-only value
                                // Self transfer transactions should always allow editing Vyapar ref
                                if (isCompleted && !transaction.selfTransfer) {
                                  return (
                                    <span className="text-sm text-muted-foreground">
                                      {transaction.vyapar_reference_number || "-"}
                                    </span>
                                  );
                                }

                                // For non-completed transactions, allow editing
                                // Always allow editing the Vyapar reference number (even if checkbox not checked)
                                return (
                            <Input
                              key={`input-${transaction.id}`}
                              value={inputValues[transaction.id] ?? transaction.vyapar_reference_number ?? ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                    // Don't prevent default - we need the input to work normally
                                    const value = e.target.value;
                                    handleReferenceChange(transaction.id, value);
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                    // Set focus tracking immediately - this prevents auto-refresh from interrupting
                                focusedInputId.current = transaction.id;
                                // Ensure we have the current value in local state
                                if (!inputValues[transaction.id] && transaction.vyapar_reference_number) {
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [transaction.id]: transaction.vyapar_reference_number || "",
                                  }));
                                }
                                    // Force focus to stay - prevent any re-renders from stealing focus
                                    const inputElement = e.target as HTMLInputElement;
                                    setTimeout(() => {
                                      if (document.activeElement !== inputElement) {
                                        inputElement.focus();
                                      }
                                    }, 10);
                                  }}
                                  onKeyDown={(e) => {
                                    // Prevent any key handlers from interfering
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => {
                                    // Prevent any click handlers from interfering
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    // Prevent any click handlers from interfering
                                    e.stopPropagation();
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                // Save the final value when user leaves the input
                                const finalValue = inputValues[transaction.id] ?? "";
                                    const isChecked = transaction.added_to_vyapar || transaction.inVyapar;
                                    const hasRef = finalValue.trim().length > 0;
                                    const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
                                    const isCompleted = isChecked && hasRef && hasPartyName;
                                    
                                if (finalValue !== (transaction.vyapar_reference_number || "")) {
                                      const updates: any = {
                                    vyapar_reference_number: finalValue || undefined,
                                      };
                                      
                                      // If transaction becomes completed and was on hold, remove hold
                                      if (isCompleted && transaction.hold) {
                                        updates.hold = false;
                                      }
                                      
                                      StorageService.updateTransaction(transaction.id, updates, transaction);
                                      
                                  // Update transaction state after blur - NEVER UPDATE DATE
                                  setTransactions((prev) =>
                                    prev.map((t) =>
                                      t.id === transaction.id
                                            ? { 
                                                ...t, 
                                                vyapar_reference_number: finalValue || undefined,
                                                hold: isCompleted && t.hold ? false : t.hold,
                                                date: t.date // Explicitly preserve original date
                                              }
                                        : t
                                    )
                                  );
                                }
                                    // Clear focus tracking after a delay
                                setTimeout(() => {
                                      // Only clear if input is no longer focused
                                      const activeElement = document.activeElement as HTMLInputElement;
                                      if (activeElement?.tagName !== "INPUT" || 
                                          activeElement?.id !== `input-${transaction.id}`) {
                                    focusedInputId.current = null;
                                  }
                                    }, 300);
                                  }}
                                  placeholder="Enter Vyapar ref no."
                                  className="w-full max-w-xs border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  id={`input-${transaction.id}`}
                                />
                              );
                            })()}
                            {showIcons && (
                              <>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleConfirm(transaction.id);
                                  }}
                                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer p-1"
                                  title="Confirm and move to Completed"
                                >
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCancel(transaction.id);
                                  }}
                                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer p-1"
                                  title="Cancel and deselect"
                                >
                                  <X className="h-5 w-5 text-red-600" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        )}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {transaction.hold ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnhold(transaction.id)}
                                className="text-xs bg-yellow-50 hover:bg-yellow-100"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Unhold
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetHold(transaction.id)}
                                className="text-xs bg-yellow-50 hover:bg-yellow-100"
                              >
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                Hold
                              </Button>
                            )}
                            {transaction.selfTransfer ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnsetSelfTransfer(transaction.id)}
                                className="text-xs bg-purple-50 hover:bg-purple-100"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Remove Self Transfer
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetSelfTransfer(transaction.id)}
                                className="text-xs bg-purple-50 hover:bg-purple-100"
                              >
                                Self Transfer
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Pagination Controls - matching pending style */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground font-medium">
                Page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
                <span className="font-bold text-foreground">{totalPages}</span> •{" "}
                <span className="font-bold text-primary">{filteredTransactions.length}</span> total transactions
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="itemsPerPageCompleted" className="text-sm font-medium">Show:</Label>
                <select
                  id="itemsPerPageCompleted"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="flex h-9 w-20 rounded-md border-2 border-slate-400 bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-2"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="border-slate-300 hover:bg-primary/5 hover:border-primary/40"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn("min-w-[40px]", currentPage === pageNum ? "btn-gradient" : "border-slate-300 hover:bg-primary/5 hover:border-primary/40")}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="border-slate-300 hover:bg-primary/5 hover:border-primary/40"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={editingTransaction !== null}
        onClose={handleCloseEditModal}
        title="Add Transaction Details"
      >
        {editingTransaction && (
          <div className="space-y-6">
            {/* Transaction Details (Read-only) */}
            <div className="space-y-4 p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Date</Label>
                  <p className="text-base font-bold text-slate-900 whitespace-nowrap">{formatDate(editingTransaction.date)}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Amount</Label>
                  <p className="text-base font-bold text-green-600">
                    ₹{editingTransaction.amount.toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Narration</Label>
                <p className="text-sm text-slate-700 leading-relaxed">{editingTransaction.description}</p>
              </div>
              {editingTransaction.referenceNumber && (
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Bank Ref No.</Label>
                  <p className="text-sm font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 text-slate-700">
                    {editingTransaction.referenceNumber}
                  </p>
                </div>
              )}
            </div>

            {/* Party Name Input */}
            <div className="space-y-2">
              <Label htmlFor="modal-party-name" className="text-sm font-semibold">
                Supplier Name <span className="text-muted-foreground text-xs">(Optional for Hold/Self Transfer)</span>
              </Label>
              <Input
                id="modal-party-name"
                value={modalPartyName}
                onChange={(e) => setModalPartyName(e.target.value)}
                placeholder="Enter supplier name"
                className="w-full h-12 input-modern"
              />
              {modalSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {modalSuggestions
                    .filter(s => s !== modalPartyName)
                    .slice(0, 3)
                    .map((suggestion, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="secondary"
                        onClick={() => setModalPartyName(suggestion)}
                        className="flex-shrink-0"
                        title={`Use suggested: ${suggestion}`}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Use: {suggestion}
                      </Button>
                    ))}
                </div>
              )}
            </div>

            {/* Vyapar Reference Number Input */}
            <div className="space-y-2">
              <Label htmlFor="modal-vyapar-ref" className="text-sm font-semibold">
                Vyapar Reference Number <span className="text-muted-foreground text-xs">(Optional for Hold/Self Transfer)</span>
              </Label>
              <Input
                id="modal-vyapar-ref"
                value={modalVyaparRef}
                onChange={(e) => setModalVyaparRef(e.target.value)}
                placeholder="Enter Vyapar reference number"
                className="h-12 input-modern"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-6 border-t border-border">
              <Button 
                variant="outline" 
                onClick={handleCloseEditModal}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={handleMoveToHold}
                  variant="outline"
                  className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                >
                  Move to Hold
                </Button>
                <Button 
                  onClick={handleMoveToSelfTransfer}
                  variant="outline"
                  className="border-purple-500 text-purple-700 hover:bg-purple-50"
                >
                  Move to Self Transfer
                </Button>
                <Button 
                  onClick={handleSubmitTransaction}
                  className="btn-gradient"
                >
                  Submit & Move to Completed
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
