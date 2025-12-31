import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { PartyMappingService } from "../services/partyMappingService";
import { fetchTransactionsFromSheets, isGoogleSheetsConfigured } from "../services/googleSheetsService";
import { formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Search, CheckCircle2, X, Edit2, Check, XCircle, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { Label } from "../components/ui/Label";

type ViewType = "pending" | "completed" | "hold";

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<ViewType>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
  const [partySuggestions, setPartySuggestions] = useState<Record<string, string | null>>({});
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

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
          const sheetsTransactions = await fetchTransactionsFromSheets();
          // Always use what's in Google Sheets, even if empty
          allTransactions = sheetsTransactions;
          setLastSyncTime(new Date());
          console.log(`Loaded ${sheetsTransactions.length} transactions from Google Sheets`);
        } catch (error) {
          console.error('Error fetching from Google Sheets:', error);
          // On error, show empty list (don't fallback to local storage)
          allTransactions = [];
          alert('Failed to load transactions from Google Sheets. Please check your connection and try refreshing.');
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
      
      // Only show deposits (credits)
      const creditTransactions = uniqueTransactions.filter((t) => t.type === "credit");
      
      // Replace transactions completely (don't append)
      // Use functional update to ensure we're replacing, not merging with previous state
      setTransactions(() => {
        // Return a completely new array to ensure React sees it as a change
        return [...creditTransactions];
      });
      
      // Sync input values with transactions (but don't overwrite focused input)
      setInputValues((prev) => {
        const newValues = { ...prev };
        creditTransactions.forEach((t) => {
          if (focusedInputId.current !== t.id && t.vyapar_reference_number) {
            newValues[t.id] = t.vyapar_reference_number;
          }
        });
        return newValues;
      });
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    const loadAndRefresh = async () => {
      if (!isMounted) return;
      await loadTransactions();
    };
    
    // Initial load
    loadAndRefresh();
    
    // Auto-refresh every 30 seconds (only if component is still mounted)
    intervalId = setInterval(() => {
      if (isMounted) {
        loadAndRefresh();
      }
    }, 30000);
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadTransactions]);

  // Filter transactions based on view, date, and search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply view filter
    // Note: We check inputValues inside the filter function, but don't include it in dependencies
    // This prevents re-renders while typing, but still shows correct filtering
    if (view === "pending") {
      // Pending: Transactions that are NOT completed and NOT on hold
      filtered = filtered.filter((t) => {
        const isHold = t.hold === true;
        if (isHold) return false; // Exclude hold transactions
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number ? String(t.vyapar_reference_number).trim() : '';
        const localRef = inputValues[t.id] ? String(inputValues[t.id]).trim() : '';
        const hasReference = Boolean(storageRef || localRef);
        // Show if NOT completed (not both checked and has reference)
        return !(isChecked && hasReference);
      });
    } else if (view === "completed") {
      // Completed: BOTH checkbox checked AND reference number entered (and not on hold)
      filtered = filtered.filter((t) => {
        const isHold = t.hold === true;
        if (isHold) return false; // Exclude hold transactions
        const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
        const storageRef = t.vyapar_reference_number ? String(t.vyapar_reference_number).trim() : '';
        const localRef = inputValues[t.id] ? String(inputValues[t.id]).trim() : '';
        const hasReference = Boolean(storageRef || localRef);
        return isChecked && hasReference;
      });
    } else if (view === "hold") {
      // Hold: Transactions that are marked as hold
      filtered = filtered.filter((t) => t.hold === true);
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

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Note: inputValues is accessed via closure but not in dependencies
    // This prevents re-renders while typing, but filter still works correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, searchQuery, view, dateFrom, dateTo]);

  // Pagination calculations
  const itemsPerPage = 50;
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

      loadingSuggestionsRef.current.add(transaction.id);
      
      (async () => {
        let foundSuggestion: string | null = null;
        
        // If transaction has a party name, check for suggestions for that name
        if (transaction.partyName) {
          foundSuggestion = await PartyMappingService.getSuggestedName(transaction.partyName);
          if (foundSuggestion && foundSuggestion !== transaction.partyName) {
            setPartySuggestions(prev => ({ ...prev, [transaction.id]: foundSuggestion }));
            loadingSuggestionsRef.current.delete(transaction.id);
            return;
          }
        }
        
        // If no party name or no suggestion found, extract from description (like CSVUpload does)
        if (transaction.description && !foundSuggestion) {
          const desc = transaction.description.trim();
          
          // Method 1: Extract text between colons
          const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w]+?)\s*:/i);
          if (colonPattern && colonPattern[1]) {
            const extracted = colonPattern[1].trim().toLowerCase();
            if (extracted.length > 3 && extracted.length < 100) {
              foundSuggestion = await PartyMappingService.getSuggestedName(extracted);
            }
          }
          
          // Method 2: Extract from patterns
          if (!foundSuggestion) {
            const patterns = [
              /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
              /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w]+?)(?:\s*-\s*\d+|\s*$)/i,
              /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
            ];
            
            for (const pattern of patterns) {
              const match = desc.match(pattern);
              if (match && match[1]) {
                const extracted = match[1].trim().toLowerCase();
                if (extracted.length > 3 && extracted.length < 100) {
                  foundSuggestion = await PartyMappingService.getSuggestedName(extracted);
                  if (foundSuggestion) break;
                }
              }
            }
          }
          
          // Method 3: Extract meaningful parts
          if (!foundSuggestion) {
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
                  if (foundSuggestion) break;
                }
              }
            }
          }
          
          // Method 4: Clean full description
          if (!foundSuggestion) {
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
            }
          }
        }
        
        // Update suggestions cache
        if (foundSuggestion) {
          setPartySuggestions(prev => ({ ...prev, [transaction.id]: foundSuggestion }));
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
    const isCompleted = checked && hasRef;
    
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
    // Update transaction in local state immediately
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              added_to_vyapar: checked,
              vyapar_reference_number: checked ? t.vyapar_reference_number : undefined,
              hold: isCompleted && t.hold ? false : t.hold,
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
  const handleConfirm = (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (transaction) {
      const finalValue = inputValues[id] ?? transaction.vyapar_reference_number ?? "";
      if (finalValue.trim()) {
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
        StorageService.updateTransaction(id, updates, transaction);
        
        // Clear focus tracking
        focusedInputId.current = null;
        
        // Update local state
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  added_to_vyapar: true,
                  vyapar_reference_number: finalValue.trim(),
                  hold: false, // Remove hold when completed
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
          t.id === transactionId ? { ...t, partyName: "" } : t
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
    
    // Update local state immediately
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, partyName: newName } : t
      )
    );

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
      StorageService.updateTransaction(transactionId, {
        partyName: newName,
      }, transaction);

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
              if (suggested && suggested !== t.partyName) {
                setPartySuggestions(prev => ({ ...prev, [t.id]: suggested }));
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
      "The Vyapar reference number and party name will remain unchanged."
    );
    
    if (confirmed) {
      const transaction = transactions.find((t) => t.id === transactionId);
      if (transaction) {
        StorageService.updateTransaction(transactionId, { hold: true }, transaction);
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, hold: true } : t))
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
      prev.map((t) => (t.id === transactionId ? { ...t, hold: false } : t))
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

    // Update local state
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, partyName: suggestedName } : t
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Manage deposit transactions and track Vyapar entries ({filteredTransactions.length} found)
            {isGoogleSheetsConfigured() && lastSyncTime && (
              <span className="ml-2 text-xs">
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
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh from Sheets'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setView("pending")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            view === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Transactions
        </button>
        <button
          onClick={() => setView("completed")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            view === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Completed Transactions
        </button>
        <button
          onClick={() => setView("hold")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            view === "hold"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Hold Transactions
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Filters */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear Dates
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
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left text-sm font-medium">Added to Vyapar</th>
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Narration</th>
                  <th className="p-3 text-left text-sm font-medium">Bank Ref No.</th>
                  <th className="p-3 text-left text-sm font-medium">Amount</th>
                  <th className="p-3 text-left text-sm font-medium">Party</th>
                  <th className="p-3 text-left text-sm font-medium">Vyapar Ref No.</th>
                  <th className="p-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((transaction) => {
                    // Suggestions are now loaded via useEffect when page/transactions change
                    // This prevents blocking the render with async calls
                    
                    const isAdded = transaction.added_to_vyapar || transaction.inVyapar;
                    // Check both storage and local input values
                    const storageRef = transaction.vyapar_reference_number ? String(transaction.vyapar_reference_number).trim() : '';
                    const localRef = inputValues[transaction.id] ? String(inputValues[transaction.id]).trim() : '';
                    const hasReference = Boolean(storageRef || localRef);
                    const showIcons = isAdded && hasReference;

                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-t transition-colors group",
                          transaction.hold && "bg-yellow-50",
                          !transaction.hold && isAdded && "bg-green-50"
                        )}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={isAdded}
                            onChange={(e) => handleToggleVyapar(transaction.id, e.target.checked)}
                            disabled={transaction.hold === true}
                            title={transaction.hold ? "Cannot modify - transaction is on hold" : ""}
                          />
                        </td>
                        <td className="p-3 text-sm">{formatDate(transaction.date)}</td>
                        <td className="p-3 text-sm">{transaction.description}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {transaction.referenceNumber || "-"}
                        </td>
                        <td className="p-3 text-sm font-semibold text-green-600">
                          ₹{transaction.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            {editingPartyName === transaction.id ? (
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
                                  className="w-40 h-7 text-xs"
                                  placeholder="Enter party name"
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
                            ) : (
                              <div className="flex items-center gap-2 group/party">
                                {transaction.partyName ? (
                                  <>
                                    <span>{transaction.partyName}</span>
                                    {(() => {
                                      const suggested = partySuggestions[transaction.id] || null;
                                      if (suggested && suggested !== transaction.partyName) {
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleApplySuggestion(transaction.id, transaction.partyName, suggested)}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                            title={`Suggested: ${suggested}`}
                                          >
                                            <Sparkles className="h-3 w-3" />
                                            → {suggested}
                                          </button>
                                        );
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditPartyName(transaction.id, transaction.partyName || "")}
                                          className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover/party:opacity-100 transition-opacity"
                                          title="Edit party name"
                                        >
                                          <Edit2 className="h-3 w-3 text-gray-500" />
                                        </button>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const suggested = partySuggestions[transaction.id] || null;
                                      if (suggested) {
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleApplySuggestion(transaction.id, "", suggested)}
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                            title={`Suggested: ${suggested}`}
                                          >
                                            <Sparkles className="h-3 w-3" />
                                            {suggested}
                                          </button>
                                        );
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditPartyName(transaction.id, "")}
                                          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground border border-dashed rounded hover:bg-gray-50 transition-colors"
                                          title="Click to add party name"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                          Add party name
                                        </button>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Input
                              key={`input-${transaction.id}`}
                              value={inputValues[transaction.id] ?? transaction.vyapar_reference_number ?? ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleReferenceChange(transaction.id, e.target.value);
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                focusedInputId.current = transaction.id;
                                // Ensure we have the current value in local state
                                if (!inputValues[transaction.id] && transaction.vyapar_reference_number) {
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [transaction.id]: transaction.vyapar_reference_number || "",
                                  }));
                                }
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                // Save the final value when user leaves the input
                                const finalValue = inputValues[transaction.id] ?? "";
                                const isChecked = transaction.added_to_vyapar || transaction.inVyapar;
                                const hasRef = finalValue.trim().length > 0;
                                const isCompleted = isChecked && hasRef;
                                
                                if (finalValue !== (transaction.vyapar_reference_number || "")) {
                                  const updates: any = {
                                    vyapar_reference_number: finalValue || undefined,
                                  };
                                  
                                  // If transaction becomes completed and was on hold, remove hold
                                  if (isCompleted && transaction.hold) {
                                    updates.hold = false;
                                  }
                                  
                                  StorageService.updateTransaction(transaction.id, updates, transaction);
                                  
                                  // Update transaction state after blur
                                  setTransactions((prev) =>
                                    prev.map((t) =>
                                      t.id === transaction.id
                                        ? { 
                                            ...t, 
                                            vyapar_reference_number: finalValue || undefined,
                                            hold: isCompleted && t.hold ? false : t.hold
                                          }
                                        : t
                                    )
                                  );
                                }
                                // Small delay to allow button clicks
                                setTimeout(() => {
                                  if (document.activeElement?.tagName !== "BUTTON") {
                                    focusedInputId.current = null;
                                  }
                                }, 200);
                              }}
                              placeholder={isAdded ? "Enter Vyapar ref..." : "Check box to enable"}
                              disabled={!isAdded}
                              className={cn(
                                "w-full max-w-xs transition-all",
                                !isAdded && "bg-muted opacity-50 cursor-not-allowed",
                                isAdded && "bg-white opacity-100"
                              )}
                            />
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
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {transaction.hold ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnhold(transaction.id)}
                                className="text-xs"
                              >
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
                                Hold
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
          
          {/* Pagination Controls */}
          {filteredTransactions.length > itemsPerPage && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transactions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
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
                        className="min-w-[40px]"
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
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
