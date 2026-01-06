import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Transaction } from "../types/transaction";
import { StorageService } from "../services/storageService";
import { PartyMappingService } from "../services/partyMappingService";
import { fetchTransactionsFromSheets, isGoogleSheetsConfigured } from "../services/googleSheetsService";
import { AuthService } from "../services/authService";
import { formatDate } from "../lib/utils";
import { DatePicker } from "../components/ui/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Search, CheckCircle2, X, Edit2, Check, XCircle, Sparkles, RefreshCw, Pencil, List, Grid, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Clock, Printer, ArrowRightLeft, LogOut, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { Label } from "../components/ui/Label";
import { Modal } from "../components/ui/Modal";

type ViewType = "pending" | "completed" | "hold" | "selfTransfer";

export function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<ViewType>("pending");
  
  // Check for party name and view in URL query params
  useEffect(() => {
    const partyParam = searchParams.get('party');
    const viewParam = searchParams.get('view') as ViewType | null;
    
    if (partyParam) {
      setSearchQuery(partyParam);
    }
    
    if (viewParam && ['pending', 'completed', 'hold', 'selfTransfer'].includes(viewParam)) {
      setView(viewParam);
    }
    
    // Clear the URL parameters after setting
    if (partyParam || viewParam) {
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
  const [showSimilarTransactions, setShowSimilarTransactions] = useState<{ transactionId: string; suggestedName: string } | null>(null);
  const [similarTransactions, setSimilarTransactions] = useState<Transaction[]>([]);
  const [showModalSimilarTransactions, setShowModalSimilarTransactions] = useState<{ suggestedName: string } | null>(null);
  const [modalSimilarTransactions, setModalSimilarTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [partySuggestions, setPartySuggestions] = useState<Record<string, string[] | null>>({});
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // View mode for pending transactions (list or grid)
  const [pendingViewMode, setPendingViewMode] = useState<"list" | "grid">("list");
  // Sort state per view - stored in localStorage
  const [sortColumn, setSortColumn] = useState<"date" | "narration" | "amount" | "party" | "vyaparRef" | null>(() => {
    const currentView = searchParams.get('view') as ViewType | null || "pending";
    const saved = localStorage.getItem(`transactionSort_${currentView}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.column || null;
    }
    // Default: completed view sorts by updatedAt (null means use default), others by date
    return currentView === "completed" ? null : "date";
  });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
    const currentView = searchParams.get('view') as ViewType | null || "pending";
    const saved = localStorage.getItem(`transactionSort_${currentView}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.direction || "desc";
    }
    return "desc";
  });
  
  // Update sort state when view changes
  useEffect(() => {
    const saved = localStorage.getItem(`transactionSort_${view}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSortColumn(parsed.column || null);
      setSortDirection(parsed.direction || "desc");
    } else {
      // Default: completed view sorts by updatedAt (null means use default), others by date
      setSortColumn(view === "completed" ? null : "date");
      setSortDirection("desc");
    }
  }, [view]);
  
  // Column widths state - stored in localStorage per view
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Initialize with current view (defaults to "pending")
    const currentView = searchParams.get('view') as ViewType | null || "pending";
    const saved = localStorage.getItem(`transactionColumnWidths_${currentView}`);
    return saved ? JSON.parse(saved) : {};
  });
  
  // Update column widths when view changes
  useEffect(() => {
    const saved = localStorage.getItem(`transactionColumnWidths_${view}`);
    setColumnWidths(saved ? JSON.parse(saved) : {});
  }, [view]);

  // Close similar transactions tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSimilarTransactions) {
        const target = event.target as HTMLElement;
        if (!target.closest('.similar-transactions-tooltip')) {
          setShowSimilarTransactions(null);
        }
      }
      if (showModalSimilarTransactions) {
        const target = event.target as HTMLElement;
        if (!target.closest('.modal-similar-transactions-tooltip')) {
          setShowModalSimilarTransactions(null);
        }
      }
    };

    if (showSimilarTransactions || showModalSimilarTransactions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSimilarTransactions, showModalSimilarTransactions]);
  
  // Resizing state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  
  // Selected transaction state - persists across view switches
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('selectedTransactionId');
    return saved || null;
  });
  
  // Helper function to handle column sorting
  const handleSort = (column: "date" | "narration" | "amount" | "party" | "vyaparRef") => {
    let newColumn: typeof column | null = column;
    let newDirection: "asc" | "desc" = "desc";
    
    if (sortColumn === column) {
      // Toggle direction if same column
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      // Set new column with default descending
      newColumn = column;
      newDirection = "desc";
    }
    
    setSortColumn(newColumn);
    setSortDirection(newDirection);
    
    // Save to localStorage per view
    localStorage.setItem(`transactionSort_${view}`, JSON.stringify({
      column: newColumn,
      direction: newDirection
    }));
  };
  
  // Helper function to get sort icon for a column
  const getSortIcon = (column: "date" | "narration" | "amount" | "party" | "vyaparRef") => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  };

  // Use ref to capture current view during resize
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + diff); // Minimum width 50px
    
    setColumnWidths(prev => {
      const updated = { ...prev, [resizingColumn]: newWidth };
      // Save with view-specific key using ref to get current view
      localStorage.setItem(`transactionColumnWidths_${viewRef.current}`, JSON.stringify(updated));
      return updated;
    });
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Add resize listeners
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // Get column width helper
  const getColumnWidth = (columnKey: string, defaultWidth: number = 150): number => {
    return columnWidths[columnKey] || defaultWidth;
  };

  // Handle transaction selection
  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    // Persist to localStorage
    localStorage.setItem('selectedTransactionId', transactionId);
  };
  // Modal state for editing transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalPartyName, setModalPartyName] = useState("");
  const [modalVyaparRef, setModalVyaparRef] = useState("");
  const [modalSuggestions, setModalSuggestions] = useState<string[]>([]);
  const [isSavingToSheets, setIsSavingToSheets] = useState(false);
  const [duplicateError, setDuplicateError] = useState<{ message: string; existingTransaction?: Transaction; transactionId?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inlineErrors, setInlineErrors] = useState<Record<string, { message: string; existingTransaction?: Transaction; transactionId?: string }>>({});
  const [inlineLoading, setInlineLoading] = useState<Record<string, boolean>>({});
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    icon: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'warning' | 'info' | 'danger';
  } | null>(null);

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
          alert('Failed to load transactions from database. Please check your connection and try refreshing.');
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
      // BUT: Don't update if user is currently typing (to prevent focus loss)
      if (focusedInputId.current === null) {
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

    // Apply sorting based on selected column
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        
        switch (sortColumn) {
          case "date":
            comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case "narration":
            comparison = (a.description || "").localeCompare(b.description || "");
            break;
          case "amount":
            comparison = a.amount - b.amount;
            break;
          case "party":
            comparison = (a.partyName || "").localeCompare(b.partyName || "");
            break;
          case "vyaparRef":
            const refA = (a.vyapar_reference_number || "").toLowerCase();
            const refB = (b.vyapar_reference_number || "").toLowerCase();
            comparison = refA.localeCompare(refB);
            break;
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    } else {
      // Default sorting based on view
      if (view === "completed") {
        // For completed: sort by updatedAt (most recently completed first)
        filtered = [...filtered].sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA; // Most recent first
        });
      } else {
        // Default: newest first by date
      filtered = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    }

    return filtered;
    // Note: inputValues is accessed via closure but not in dependencies
    // This prevents re-renders while typing, but filter still works correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, searchQuery, view, dateFrom, dateTo, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, view, dateFrom, dateTo]);

  // Clear selected transaction when view changes
  useEffect(() => {
    setSelectedTransactionId(null);
    localStorage.removeItem('selectedTransactionId');
  }, [view]);

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
          foundSuggestion = await PartyMappingService.getSuggestedName(transaction.partyName, transaction.description);
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
          const matchedParties = await PartyMappingService.findPartiesFromNarration(desc, 3);
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
                foundSuggestion = await PartyMappingService.getSuggestedName(extractedLower, transaction.description);
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
                  foundSuggestion = await PartyMappingService.getSuggestedName(extracted, transaction.description);
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
                  foundSuggestion = await PartyMappingService.getSuggestedName(phrase, transaction.description);
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
              foundSuggestion = await PartyMappingService.getSuggestedName(cleanedDesc, transaction.description);
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
        // Clear previous error for this transaction
        setInlineErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[id];
          return newErrors;
        });
        
        // Show loading state
        setInlineLoading((prev) => ({ ...prev, [id]: true }));
        
        try {
        // Check for duplicate Vyapar reference number
        const { checkDuplicateVyaparRef, verifyTransactionUpdate } = await import('../services/googleSheetsService');
        const duplicateCheck = await checkDuplicateVyaparRef(finalValue.trim(), id);
        
        if (duplicateCheck.isDuplicate && duplicateCheck.existingTransaction) {
          const existing = duplicateCheck.existingTransaction;
            
            setInlineErrors((prev) => ({
              ...prev,
              [id]: {
                message: `This Vyapar reference number "${finalValue.trim()}" already exists`,
                existingTransaction: existing,
                transactionId: duplicateCheck.existingTransactionId
              }
            }));
            setInlineLoading((prev) => {
              const newLoading = { ...prev };
              delete newLoading[id];
              return newLoading;
            });
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
          await StorageService.updateTransaction(id, updates, transaction);
          
          // Clear loading state
          setInlineLoading((prev) => {
            const newLoading = { ...prev };
            delete newLoading[id];
            return newLoading;
          });
        } catch (error) {
          console.error('Error saving transaction:', error);
          setInlineErrors((prev) => ({
            ...prev,
            [id]: { message: "Failed to save transaction. Please try again." }
          }));
          setInlineLoading((prev) => {
            const newLoading = { ...prev };
            delete newLoading[id];
            return newLoading;
          });
        }
      }
    }
  };

  // Handle cancel (X icon)
  const handleCancel = (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (!transaction) return;
    
    setConfirmationModal({
      isOpen: true,
      title: "Cancel Transaction",
      message: `Are you sure you want to cancel this transaction?\n\n` +
        `This will:\n` +
        `• Remove the "Added to Vyapar" status\n` +
        `• Clear the Vyapar reference number\n` +
        `• Move the transaction back to pending\n\n` +
        `The transaction data (date, amount, narration, party name) will remain unchanged.`,
      icon: <X className="h-8 w-8 text-red-600" />,
      variant: 'danger',
      confirmText: "Yes, Cancel Transaction",
      cancelText: "Keep Transaction",
      onConfirm: () => {
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
        
        setConfirmationModal(null);
      }
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
            PartyMappingService.getSuggestedName(t.partyName, t.description).then(suggested => {
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
      const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    setConfirmationModal({
      isOpen: true,
      title: "Put Transaction on Hold",
      message: `Are you sure you want to put this transaction on HOLD?\n\n` +
        `This will mark the transaction as held. You can hold transactions without entering Vyapar reference number.\n` +
        `The Vyapar reference number and party name will remain unchanged.`,
      icon: <Clock className="h-8 w-8 text-yellow-600" />,
      variant: 'warning',
      confirmText: "Yes, Put on Hold",
      cancelText: "Cancel",
      onConfirm: () => {
        StorageService.updateTransaction(transactionId, { hold: true }, transaction);
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, hold: true, date: t.date } : t))
        );
        // Switch to hold view
        setView("hold");
        setConfirmationModal(null);
      }
    });
  };

  // Handle Unhold
  const handleUnhold = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    setConfirmationModal({
      isOpen: true,
      title: "Remove Hold",
      message: `Are you sure you want to remove the HOLD status from this transaction?\n\n` +
        `This will make the transaction available for processing again.`,
      icon: <XCircle className="h-8 w-8 text-yellow-600" />,
      variant: 'info',
      confirmText: "Yes, Remove Hold",
      cancelText: "Cancel",
      onConfirm: () => {
    StorageService.updateTransaction(transactionId, { hold: false }, transaction);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hold: false, date: t.date } : t))
    );
        setConfirmationModal(null);
      }
    });
  };

  // Handle Set Self Transfer
  const handleSetSelfTransfer = (transactionId: string) => {
      const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    setConfirmationModal({
      isOpen: true,
      title: "Mark as Self Transfer",
      message: `Are you sure you want to mark this transaction as SELF TRANSFER?\n\n` +
        `This will move the transaction to the Self Transfer view. Self transfer transactions are internal transfers between your own accounts.`,
      icon: <ArrowRightLeft className="h-8 w-8 text-purple-600" />,
      variant: 'info',
      confirmText: "Yes, Mark as Self Transfer",
      cancelText: "Cancel",
      onConfirm: () => {
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
        setConfirmationModal(null);
      }
    });
  };

  // Handle Unset Self Transfer
  const handleUnsetSelfTransfer = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    
    setConfirmationModal({
      isOpen: true,
      title: "Remove Self Transfer",
      message: `Are you sure you want to remove the SELF TRANSFER status from this transaction?\n\n` +
        `This will make the transaction available for normal processing again.`,
      icon: <XCircle className="h-8 w-8 text-purple-600" />,
      variant: 'info',
      confirmText: "Yes, Remove Self Transfer",
      cancelText: "Cancel",
      onConfirm: () => {
    StorageService.updateTransaction(transactionId, { selfTransfer: false }, transaction);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, selfTransfer: false, date: t.date } : t))
    );
        setConfirmationModal(null);
      }
    });
  };

  // Find similar transactions from completed queue - only show transactions completed with this exact party name
  const findSimilarTransactions = (transaction: Transaction, suggestedName: string): Transaction[] => {
    // Get all completed transactions
    const completedTransactions = transactions.filter((t) => {
      const isChecked = Boolean(t.added_to_vyapar || t.inVyapar);
      const storageRef = t.vyapar_reference_number ? String(t.vyapar_reference_number).trim() : '';
      const hasReference = Boolean(storageRef);
      const hasPartyName = Boolean(t.partyName && t.partyName.trim() !== '');
      const isCompleted = isChecked && hasReference && hasPartyName;
      const isHold = t.hold === true;
      const isSelfTransfer = t.selfTransfer === true;
      return isCompleted && !isHold && !isSelfTransfer;
    });

    // Find transactions where party name exactly matches the suggested name
    const suggestedNameLower = suggestedName.toLowerCase().trim();
    const similar = completedTransactions.filter((t) => {
      if (t.id === transaction.id) return false; // Exclude current transaction
      
      const tPartyName = (t.partyName || '').toLowerCase().trim();
      
      // Only show transactions where party name matches the suggested name
      return tPartyName === suggestedNameLower;
    });

    // Sort by date (most recent first) and limit to 5
    return similar
      .sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.date).getTime();
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.date).getTime();
        return dateB - dateA; // Most recent first
      })
      .slice(0, 5);
  };

  // Handle show similar transactions
  const handleShowSimilarTransactions = (transactionId: string, suggestedName: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const similar = findSimilarTransactions(transaction, suggestedName);
    setSimilarTransactions(similar);
    setShowSimilarTransactions({ transactionId, suggestedName });
  };

  // Handle show similar transactions in modal
  const handleShowModalSimilarTransactions = (suggestedName: string) => {
    if (!editingTransaction) return;
    
    const similar = findSimilarTransactions(editingTransaction, suggestedName);
    setModalSimilarTransactions(similar);
    setShowModalSimilarTransactions({ suggestedName });
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
      
      // Try word-by-word matching first (returns top 2-3 matches)
      const matchedParties = await PartyMappingService.findPartiesFromNarration(desc, 3);
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
          const suggested = await PartyMappingService.getSuggestedName(extractedName, editingTransaction.description);
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
          const suggested = await PartyMappingService.getSuggestedName(part, editingTransaction.description);
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
    setIsSavingToSheets(false);
    setDuplicateError(null);
    setShowModalSimilarTransactions(null);
    setModalSimilarTransactions([]);
    setSaveSuccess(false);
  };

  // Handle submitting transaction from modal (move to completed)
  const handleSubmitTransaction = async () => {
    if (!editingTransaction) return;
    
    // Clear previous errors and success messages
    setDuplicateError(null);
    setSaveSuccess(false);
    
    const partyName = modalPartyName.trim();
    const vyaparRef = modalVyaparRef.trim();
    
    if (!partyName || !vyaparRef) {
      setDuplicateError({ message: "Please enter both Party Name and Vyapar Reference Number" });
      return;
    }
    
    // Check for duplicate Vyapar reference number
    setIsSavingToSheets(true);
    try {
    const { checkDuplicateVyaparRef, verifyTransactionUpdate } = await import('../services/googleSheetsService');
    const duplicateCheck = await checkDuplicateVyaparRef(vyaparRef, editingTransaction.id);
    
    if (duplicateCheck.isDuplicate && duplicateCheck.existingTransaction) {
      const existing = duplicateCheck.existingTransaction;
      const existingDate = existing.date || 'N/A';
      const existingAmount = existing.amount || 0;
      const existingParty = existing.partyName || 'N/A';
      
        setDuplicateError({
          message: `This Vyapar reference number "${vyaparRef}" already exists`,
          existingTransaction: existing,
          transactionId: duplicateCheck.existingTransactionId
        });
        setIsSavingToSheets(false);
      return; // Prevent submission
    }
    
    // Update transaction with party name and Vyapar ref
    // NEVER UPDATE DATE - preserve original date
      const now = new Date().toISOString();
    const updatedTransaction = {
      ...editingTransaction,
      partyName,
      vyapar_reference_number: vyaparRef,
      added_to_vyapar: true,
      hold: false, // Remove hold if it was on hold
      date: editingTransaction.date, // Explicitly preserve original date
        updatedAt: now, // Set updatedAt to current time for sorting
    };
    
    // Update local state first
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTransaction.id ? updatedTransaction : t
      )
    );
    
    // Save to Google Sheets (this will show error if it fails)
      await StorageService.updateTransaction(editingTransaction.id, {
      partyName,
      vyapar_reference_number: vyaparRef,
      added_to_vyapar: true,
      hold: false,
        updatedAt: now, // Include updatedAt in the update
    }, updatedTransaction);
    
    // Learn from narration
    if (editingTransaction.description) {
      PartyMappingService.autoTrainFromNarration(editingTransaction.description, partyName).catch(err => {
        console.error('Error training party mapping:', err);
      });
    }
    
      // Show success message
      setSaveSuccess(true);
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        handleCloseEditModal();
      }, 1500);
    } catch (error) {
      console.error('Error saving transaction:', error);
      setDuplicateError({ message: "Failed to save transaction. Please try again." });
      setIsSavingToSheets(false);
    }
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
          <title>${view.charAt(0).toUpperCase() + view.slice(1)} Transactions Report</title>
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
              width: 12%;
              white-space: nowrap;
            }
            .narration-col {
              width: 40%;
            }
            .amount-col {
              width: 18%;
              text-align: right;
              white-space: nowrap;
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
            <h1>${view.charAt(0).toUpperCase() + view.slice(1)} Transactions Report</h1>
            <div class="subtitle">Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="date-col">Date</th>
                <th class="narration-col">Narration</th>
                <th class="amount-col">Amount</th>
                ${view !== 'selfTransfer' ? '<th class="party-col">Party Name</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map((t) => {
                return `
                  <tr>
                    <td class="date-col">${formatDate(t.date)}</td>
                    <td class="narration-col">${t.description || ''}</td>
                    <td class="amount-col">₹${t.amount.toLocaleString('en-IN')}</td>
                    ${view !== 'selfTransfer' ? `<td class="party-col">${t.partyName || '&nbsp;'}</td>` : ''}
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gradient">
            Transactions
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            <span className="block sm:inline">Manage deposit transactions and track Vyapar entries</span>
            <span className="ml-0 sm:ml-2 mt-1 sm:mt-0 inline-block px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs sm:text-sm font-medium">
              {filteredTransactions.length} found
            </span>
            {isGoogleSheetsConfigured() && lastSyncTime && (
              <span className="block sm:inline sm:ml-3 mt-1 sm:mt-0 text-xs sm:text-sm text-slate-500">
                • Last synced: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        {isGoogleSheetsConfigured() && (
          <Button
            variant="outline"
            onClick={loadTransactions}
            disabled={isLoading}
              className="flex items-center gap-1 sm:gap-2 border-slate-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 shadow-sm text-xs sm:text-sm px-2 sm:px-4"
          >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Refresh'}</span>
          </Button>
        )}
          <Button
            variant="outline"
            onClick={() => {
              setConfirmationModal({
                isOpen: true,
                title: "Logout",
                message: `Are you sure you want to logout?\n\n` +
                  `You will be redirected to the login page.`,
                icon: <LogOut className="h-8 w-8 text-red-600" />,
                variant: 'danger',
                confirmText: "Yes, Logout",
                cancelText: "Cancel",
                onConfirm: () => {
                  AuthService.logout();
                  navigate("/login", { replace: true });
                }
              });
            }}
            className="flex items-center gap-1 sm:gap-2 border-slate-300 hover:bg-red-50 hover:border-red-400 hover:text-red-700 shadow-sm px-2 sm:px-4"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Tabs - Minimal & Clean */}
      <div className="flex gap-1 sm:gap-2 border-b border-border/60 bg-card/50 rounded-t-lg p-1 overflow-x-auto">
        <button
          onClick={() => setView("pending")}
          className={cn(
            "px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold rounded-lg transition-all duration-200 relative text-xs sm:text-sm whitespace-nowrap flex-shrink-0",
            view === "pending"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Pending
          {view === "pending" && filteredTransactions.length > 0 && (
            <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs font-bold">
              {filteredTransactions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView("completed")}
          className={cn(
            "px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap flex-shrink-0",
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
            "px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap flex-shrink-0",
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
            "px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap flex-shrink-0",
            view === "selfTransfer"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className="hidden sm:inline">Self Transfer</span>
          <span className="sm:hidden">Self</span>
        </button>
      </div>

      {view === "pending" ? (
        // Minimal & Clean Pending Transactions UI
        <div className="space-y-4 animate-fade-in">
          {/* Stats & Search Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stats Cards - Compact */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    variant={sortColumn === "date" && sortDirection === "desc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSortColumn("date");
                      setSortDirection("desc");
                    }}
                    className="flex-1 h-8 text-xs"
                  >
                    <ArrowDown className="h-3 w-3 mr-1" />
                    Newest
                  </Button>
                  <Button
                    type="button"
                    variant={sortColumn === "date" && sortDirection === "asc" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSortColumn("date");
                      setSortDirection("asc");
                    }}
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
              <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3 sm:gap-2">
                <div className="w-full sm:flex-1 sm:min-w-[140px]">
                  <Label htmlFor="dateFrom" className="text-xs font-semibold mb-1.5 block">From Date</Label>
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
                    className="h-9 text-sm w-full"
                  />
                </div>
                <div className="w-full sm:flex-1 sm:min-w-[140px]">
                  <Label htmlFor="dateTo" className="text-xs font-semibold mb-1.5 block">To Date</Label>
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
                    className="h-9 text-sm w-full"
                  />
                </div>
                <div className="w-full sm:w-auto flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  disabled={filteredTransactions.length === 0}
                    className="h-9 flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
                  title="Print/Save as PDF"
                >
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Print PDF</span>
                    <span className="sm:hidden">Print</span>
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
                      setSortColumn("date");
                      setSortDirection("desc");
                  }}
                    className="h-9 text-xs sm:text-sm"
                >
                  Clear
                </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Filters for Completed and Hold Transactions
        <div className="space-y-4">
          {/* Search Filter */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Date Range, Sort, and Actions */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3 sm:gap-4">
          {/* Date Range Filters */}
                <div className="w-full sm:flex-1 sm:min-w-[140px]">
                  <Label htmlFor="dateFromCompleted" className="text-xs font-semibold mb-1.5 block">From Date</Label>
              <DatePicker
                id="dateFromCompleted"
                value={dateFrom}
                onChange={(value) => {
                  if (view === "completed") setDateFromCompleted(value);
                  else if (view === "hold") setDateFromHold(value);
                  else setDateFromSelfTransfer(value);
                }}
                placeholder="DD/MM/YYYY"
                    className="h-9 text-sm w-full"
              />
            </div>
                <div className="w-full sm:flex-1 sm:min-w-[140px]">
                  <Label htmlFor="dateToCompleted" className="text-xs font-semibold mb-1.5 block">To Date</Label>
              <DatePicker
                id="dateToCompleted"
                value={dateTo}
                onChange={(value) => {
                  if (view === "completed") setDateToCompleted(value);
                  else if (view === "hold") setDateToHold(value);
                      else setDateFromSelfTransfer(value);
                }}
                placeholder="DD/MM/YYYY"
                    className="h-9 text-sm w-full"
              />
            </div>
                
                {/* Sort by Date */}
                <div className="w-full sm:w-auto sm:min-w-[160px]">
                  <Label className="text-xs font-semibold mb-1.5 block">Sort by Date</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                      variant={sortColumn === "date" && sortDirection === "asc" ? "default" : "outline"}
                    size="sm"
                      onClick={() => {
                        setSortColumn("date");
                        setSortDirection("asc");
                      }}
                      className="flex-1 h-9 text-xs sm:text-sm"
                    >
                      <ArrowUp className="h-3.5 w-3.5 mr-1" />
                    Oldest
                  </Button>
                  <Button
                    type="button"
                      variant={sortColumn === "date" && sortDirection === "desc" ? "default" : "outline"}
                    size="sm"
                      onClick={() => {
                        setSortColumn("date");
                        setSortDirection("desc");
                      }}
                      className="flex-1 h-9 text-xs sm:text-sm"
                    >
                      <ArrowDown className="h-3.5 w-3.5 mr-1" />
                    Newest
                  </Button>
                </div>
            </div>
                
                {/* Print Button */}
                <div className="w-full sm:w-auto sm:min-w-[120px]">
                  <Label className="text-xs font-semibold mb-1.5 block">Actions</Label>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrint}
                    disabled={filteredTransactions.length === 0}
                    className="h-9 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full text-xs sm:text-sm"
                    title="Print/Save as PDF"
                  >
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Print PDF</span>
                    <span className="sm:hidden">Print</span>
                  </Button>
                </div>
                
                {/* Clear All Button */}
                <div className="w-full sm:w-auto sm:min-w-[90px]">
                  <Label className="text-xs font-semibold mb-1.5 block opacity-0">Clear</Label>
              <Button
                variant="outline"
                    size="sm"
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
                      setSortColumn(null);
                }}
                    className="h-9 w-full text-xs sm:text-sm"
              >
                  Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
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
                          <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300" style={{ width: '60px' }}>
                            Select
                          </th>
                          <th 
                            className="p-2 sm:p-3 text-left text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('date', 130) }}
                          >
                            <div className="flex items-center gap-2">
                              <span>Date</span>
                              <button
                                type="button"
                                onClick={() => handleSort("date")}
                                className="p-1 hover:bg-accent rounded"
                                title="Sort by date"
                              >
                                {getSortIcon("date")}
                              </button>
                            </div>
                            <div
                              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleResizeStart(e, 'date', getColumnWidth('date', 130));
                              }}
                            />
                          </th>
                          <th 
                            className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('narration', 500) }}
                          >
                            <div className="flex items-center gap-2">
                              <span>Narration</span>
                              <button
                                type="button"
                                onClick={() => handleSort("narration")}
                                className="p-1 hover:bg-accent rounded"
                                title="Sort by narration"
                              >
                                {getSortIcon("narration")}
                              </button>
                            </div>
                            <div
                              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleResizeStart(e, 'narration', getColumnWidth('narration', 500));
                              }}
                            />
                          </th>
                          <th 
                            className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('bankRef', 140) }}
                          >
                            Bank Ref No.
                            <div
                              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleResizeStart(e, 'bankRef', getColumnWidth('bankRef', 140));
                              }}
                            />
                          </th>
                          <th 
                            className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('amount', 130) }}
                          >
                            <div className="flex items-center gap-2">
                              <span>Amount</span>
                              <button
                                type="button"
                                onClick={() => handleSort("amount")}
                                className="p-1 hover:bg-accent rounded"
                                title="Sort by amount"
                              >
                                {getSortIcon("amount")}
                              </button>
                            </div>
                            <div
                              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleResizeStart(e, 'amount', getColumnWidth('amount', 130));
                              }}
                            />
                          </th>
                          <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300" style={{ width: '80px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className={cn(
                              "border-b border-slate-300 bg-card hover:bg-muted/50 transition-colors",
                              selectedTransactionId === transaction.id && "bg-blue-50 border-blue-300 border-l-4 border-l-blue-500"
                            )}
                          >
                            <td className="p-3 text-center border-r border-slate-300" style={{ width: '60px' }}>
                              <input
                                type="radio"
                                name="selectedTransaction"
                                checked={selectedTransactionId === transaction.id}
                                onChange={() => handleSelectTransaction(transaction.id)}
                                className="h-4 w-4 text-primary cursor-pointer"
                                title="Select this transaction"
                              />
                            </td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm border-r border-slate-300 whitespace-nowrap" style={{ width: getColumnWidth('date', 120) }}>{formatDate(transaction.date)}</td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm border-r border-slate-300" style={{ width: getColumnWidth('narration', 300) }}>{transaction.description}</td>
                            <td 
                              className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground border-r border-slate-300 break-words" 
                              style={{ 
                                width: getColumnWidth('bankRef', 120),
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                maxWidth: getColumnWidth('bankRef', 120)
                              }}
                              title={transaction.referenceNumber || undefined}
                            >
                              {transaction.referenceNumber || "-"}
                            </td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm font-semibold text-foreground border-r border-slate-300" style={{ width: getColumnWidth('amount', 120) }}>
                              ₹{transaction.amount.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                disabled={selectedTransactionId !== transaction.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  if (selectedTransactionId !== transaction.id) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  handleOpenEditModal(transaction);
                                }}
                                className={cn(
                                  "flex-shrink-0 transition-opacity p-1.5 rounded border",
                                  selectedTransactionId === transaction.id
                                    ? "hover:opacity-80 cursor-pointer hover:bg-primary/10 border-primary/20"
                                    : "opacity-40 cursor-not-allowed border-gray-300 bg-gray-100"
                                )}
                                title={selectedTransactionId === transaction.id ? "Edit transaction" : "Please select this transaction first"}
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
                    <th className="p-2 sm:p-3 text-center text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300" style={{ width: '60px' }}>
                      Select
                    </th>
                    <th 
                      className="p-2 sm:p-3 text-left text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                      style={{ width: getColumnWidth('date', 120) }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Date</span>
                        <button
                          type="button"
                          onClick={() => handleSort("date")}
                          className="p-1 hover:bg-accent rounded"
                          title="Sort by date"
                        >
                          {getSortIcon("date")}
                        </button>
                      </div>
                      <div
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResizeStart(e, 'date', getColumnWidth('date', 120));
                        }}
                      />
                    </th>
                  <th 
                    className="p-3 text-left text-sm font-medium text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                    style={{ width: getColumnWidth('narration', 300) }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Narration</span>
                      <button
                        type="button"
                        onClick={() => handleSort("narration")}
                        className="p-1 hover:bg-accent rounded"
                        title="Sort by narration"
                      >
                        {getSortIcon("narration")}
                      </button>
                    </div>
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleResizeStart(e, 'narration', getColumnWidth('narration', 300));
                      }}
                    />
                  </th>
                  <th 
                    className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                    style={{ width: getColumnWidth('bankRef', 120) }}
                  >
                    Bank Ref No.
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleResizeStart(e, 'bankRef', getColumnWidth('bankRef', 120));
                      }}
                    />
                  </th>
                  {view !== "selfTransfer" && (
                    <th 
                      className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('party', 180) }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Party</span>
                        <button
                          type="button"
                          onClick={() => handleSort("party")}
                          className="p-1 hover:bg-accent rounded"
                          title="Sort by party"
                        >
                          {getSortIcon("party")}
                        </button>
                      </div>
                      <div
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                                handleResizeStart(e, 'party', getColumnWidth('party', 180));
                        }}
                      />
                    </th>
                  )}
                  <th 
                    className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                    style={{ width: getColumnWidth('amount', 120) }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Amount</span>
                      <button
                        type="button"
                        onClick={() => handleSort("amount")}
                        className="p-1 hover:bg-accent rounded"
                        title="Sort by amount"
                      >
                        {getSortIcon("amount")}
                        </button>
                      </div>
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleResizeStart(e, 'amount', getColumnWidth('amount', 120));
                      }}
                    />
                    </th>
                  {(view !== "hold" && view !== "selfTransfer") && (
                    <th 
                      className="p-3 text-left text-sm font-bold text-muted-foreground border-b-2 border-slate-300 border-r border-slate-300 relative"
                            style={{ width: getColumnWidth('vyaparRef', 180) }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Vyapar Ref No.</span>
                        <button
                          type="button"
                          onClick={() => handleSort("vyaparRef")}
                          className="p-1 hover:bg-accent rounded"
                          title="Sort by Vyapar reference"
                        >
                          {getSortIcon("vyaparRef")}
                        </button>
                      </div>
                      <div
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-transparent z-10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                                handleResizeStart(e, 'vyaparRef', getColumnWidth('vyaparRef', 180));
                        }}
                      />
                    </th>
                  )}
                    <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-bold text-muted-foreground border-b-2 border-slate-300" style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                      <td colSpan={view === "selfTransfer" ? 7 : view === "hold" ? 8 : 9} className="p-8 text-center text-muted-foreground border-b border-slate-300">
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
                          !transaction.hold && !transaction.selfTransfer && isAdded && "bg-green-50",
                          selectedTransactionId === transaction.id && "bg-blue-50 border-blue-300 border-l-4 border-l-blue-500"
                        )}
                      >
                        <td className="p-3 text-center border-r border-slate-300" style={{ width: '60px' }}>
                          <input
                            type="radio"
                            name="selectedTransaction"
                            checked={selectedTransactionId === transaction.id}
                            onChange={() => handleSelectTransaction(transaction.id)}
                            className="h-4 w-4 text-primary cursor-pointer"
                            title="Select this transaction"
                          />
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm border-r border-slate-300 whitespace-nowrap" style={{ width: getColumnWidth('date', 120) }}>{formatDate(transaction.date)}</td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm border-r border-slate-300" style={{ width: getColumnWidth('narration', 300) }}>{transaction.description}</td>
                        <td 
                          className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground border-r border-slate-300 break-words" 
                          style={{ 
                            width: getColumnWidth('bankRef', 120),
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            maxWidth: getColumnWidth('bankRef', 120)
                          }}
                          title={transaction.referenceNumber || undefined}
                        >
                          {transaction.referenceNumber || "-"}
                        </td>
                        {view !== "selfTransfer" && (
                          <td className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground border-r border-slate-300" style={{ width: getColumnWidth('party', 150) }}>
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

                              // For completed transactions, just show the party name (no editing, no suggestions)
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
                                                <div key={idx} className="flex items-center gap-1 relative">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      // If clicking on Info icon, show similar transactions
                                                      const target = e.target as HTMLElement;
                                                      if (target.closest('.info-icon-button') || target.closest('svg')) {
                                                        e.stopPropagation();
                                                        handleShowSimilarTransactions(transaction.id, suggested);
                                                      } else {
                                                        // Otherwise, apply the suggestion
                                                        handleApplySuggestion(transaction.id, transaction.partyName, suggested);
                                                      }
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                    title={`Suggested: ${suggested}`}
                                                  >
                                                    <Sparkles className="h-3 w-3" />
                                                    → {suggested}
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleShowSimilarTransactions(transaction.id, suggested);
                                                      }}
                                                      className="info-icon-button p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded transition-colors flex-shrink-0 ml-1"
                                                      title="Why this suggestion? Click to see transactions completed with this party name"
                                                    >
                                                      <Info className="h-3 w-3" />
                                                    </button>
                                                  </button>
                                                  {showSimilarTransactions?.transactionId === transaction.id && 
                                                   showSimilarTransactions?.suggestedName === suggested && (
                                                    <div className="similar-transactions-tooltip absolute right-0 top-full mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-[300px] max-w-[400px] max-h-[300px] overflow-y-auto">
                                                      <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-semibold text-gray-700">Transactions Completed with: {suggested}</h4>
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowSimilarTransactions(null);
                                                          }}
                                                          className="text-gray-400 hover:text-gray-600"
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </button>
                                                      </div>
                                                      {similarTransactions.length > 0 ? (
                                                        <div className="space-y-2">
                                                          {similarTransactions.map((t) => (
                                                            <div key={t.id} className="text-xs border-b border-gray-200 pb-2 last:border-0">
                                                              <div className="font-medium text-gray-900">{formatDate(t.date)}</div>
                                                              <div className="text-gray-700 mt-0.5">₹{t.amount.toLocaleString()}</div>
                                                              <div className="text-gray-600 mt-0.5 line-clamp-2">{t.description || '-'}</div>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      ) : (
                                                        <div className="text-xs text-gray-500">No similar transactions found</div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
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
                                          title="Edit party name"
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
                              );
                            })()}
                          </div>
                        </td>
                        )}
                        <td className="p-2 sm:p-3 text-xs sm:text-sm font-semibold text-green-600 border-r border-slate-300" style={{ width: getColumnWidth('amount', 120) }}>
                          ₹{transaction.amount.toLocaleString()}
                        </td>
                        {(view !== "hold" && view !== "selfTransfer") && (
                          <td className="p-3 border-r border-slate-300" style={{ width: getColumnWidth('vyaparRef', 150) }}>
                            <div className="flex items-center gap-2">
                              {(() => {
                                // Check if transaction is completed
                                const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
                                const isCompleted = isAdded && hasReference && hasPartyName;

                                // For completed transactions (but not self transfer), show read-only value
                                // Self transfer transactions should always allow editing Vyapar ref
                                if (isCompleted && !transaction.selfTransfer) {
                                  return (
                                    <span className="text-sm font-semibold text-blue-600">
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
                                    // Clear error when user types
                                    if (inlineErrors[transaction.id]) {
                                      setInlineErrors((prev) => {
                                        const newErrors = { ...prev };
                                        delete newErrors[transaction.id];
                                        return newErrors;
                                      });
                                    }
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
                                  className={cn(
                                    "w-full max-w-xs border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20",
                                    inlineErrors[transaction.id] && "border-red-500 focus:border-red-500"
                                  )}
                                  id={`input-${transaction.id}`}
                                  disabled={inlineLoading[transaction.id]}
                                />
                              );
                            })()}
                            {/* Inline Error Message */}
                            {inlineErrors[transaction.id] && (
                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="font-semibold text-red-900 mb-1">{inlineErrors[transaction.id].message}</p>
                                    {inlineErrors[transaction.id].existingTransaction && (
                                      <div className="mt-2 p-2 bg-white rounded border border-red-200">
                                        <p className="font-medium text-red-800 mb-1">Existing Transaction:</p>
                                        <div className="space-y-0.5 text-red-700">
                                          <p><span className="font-medium">ID:</span> {inlineErrors[transaction.id].transactionId || 'N/A'}</p>
                                          <p><span className="font-medium">Date:</span> {formatDate(inlineErrors[transaction.id].existingTransaction?.date || 'N/A')}</p>
                                          <p><span className="font-medium">Amount:</span> ₹{inlineErrors[transaction.id].existingTransaction?.amount?.toLocaleString() || '0'}</p>
                                          <p><span className="font-medium">Party:</span> {inlineErrors[transaction.id].existingTransaction?.partyName || 'N/A'}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Inline Loading State */}
                            {inlineLoading[transaction.id] && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span>Saving data. Please wait...</span>
                              </div>
                            )}
                          </div>
                        </td>
                        )}
                        <td className="p-2 sm:p-3" style={{ width: '100px' }}>
                          <div className="flex items-center gap-2">
                            {/* Cancel button for completed transactions - moves back to pending */}
                            {(() => {
                              const hasPartyName = Boolean(transaction.partyName && transaction.partyName.trim() !== '');
                              const isCompleted = isAdded && hasReference && hasPartyName;
                              const isSelected = selectedTransactionId === transaction.id;
                              
                              // Show cancel button only for completed transactions
                              if (isCompleted && view === "completed") {
                                return (
                                <button
                                  type="button"
                                    disabled={!isSelected}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                      if (!isSelected) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                        return;
                                      }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCancel(transaction.id);
                                  }}
                                    className={cn(
                                      "flex-shrink-0 transition-opacity p-1.5 rounded border",
                                      isSelected 
                                        ? "hover:opacity-80 cursor-pointer hover:bg-red-50 border-red-200" 
                                        : "opacity-40 cursor-not-allowed border-gray-300 bg-gray-100"
                                    )}
                                    title={isSelected ? "Cancel transaction and move back to pending" : "Please select this transaction first"}
                                >
                                  <X className="h-5 w-5 text-red-600" />
                                </button>
                                );
                              }
                              return null;
                            })()}
                            {transaction.hold ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={selectedTransactionId !== transaction.id}
                                onClick={() => {
                                  if (selectedTransactionId === transaction.id) {
                                    handleUnhold(transaction.id);
                                  }
                                }}
                                className={cn(
                                  "p-2",
                                  selectedTransactionId === transaction.id
                                    ? "bg-yellow-50 hover:bg-yellow-100"
                                    : "bg-gray-100 opacity-40 cursor-not-allowed"
                                )}
                                title={selectedTransactionId === transaction.id ? "Unhold" : "Please select this transaction first"}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={selectedTransactionId !== transaction.id}
                                onClick={() => {
                                  if (selectedTransactionId === transaction.id) {
                                    handleSetHold(transaction.id);
                                  }
                                }}
                                className={cn(
                                  "p-2",
                                  selectedTransactionId === transaction.id
                                    ? "bg-yellow-50 hover:bg-yellow-100"
                                    : "bg-gray-100 opacity-40 cursor-not-allowed"
                                )}
                                title={selectedTransactionId === transaction.id ? "Hold" : "Please select this transaction first"}
                              >
                                <Clock className="h-4 w-4 text-yellow-700" />
                              </Button>
                            )}
                            {transaction.selfTransfer ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={selectedTransactionId !== transaction.id}
                                onClick={() => {
                                  if (selectedTransactionId === transaction.id) {
                                    handleUnsetSelfTransfer(transaction.id);
                                  }
                                }}
                                className={cn(
                                  "p-2",
                                  selectedTransactionId === transaction.id
                                    ? "bg-purple-50 hover:bg-purple-100"
                                    : "bg-gray-100 opacity-40 cursor-not-allowed"
                                )}
                                title={selectedTransactionId === transaction.id ? "Remove Self Transfer" : "Please select this transaction first"}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={selectedTransactionId !== transaction.id}
                                onClick={() => {
                                  if (selectedTransactionId === transaction.id) {
                                    handleSetSelfTransfer(transaction.id);
                                  }
                                }}
                                className={cn(
                                  "p-2",
                                  selectedTransactionId === transaction.id
                                    ? "bg-purple-50 hover:bg-purple-100"
                                    : "bg-gray-100 opacity-40 cursor-not-allowed"
                                )}
                                title={selectedTransactionId === transaction.id ? "Self Transfer" : "Please select this transaction first"}
                              >
                                <ArrowRightLeft className="h-4 w-4 text-purple-700" />
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
          <div className="space-y-3">
            {/* Transaction Details (Read-only) */}
            <div className="space-y-2 p-2.5 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-0.5 block">Date</Label>
                  <p className="text-xs font-bold text-slate-900 whitespace-nowrap">{formatDate(editingTransaction.date)}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-0.5 block">Amount</Label>
                  <p className="text-xs font-bold text-green-600">
                    ₹{editingTransaction.amount.toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-0.5 block">Narration</Label>
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{editingTransaction.description}</p>
              </div>
              {editingTransaction.referenceNumber && (
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-0.5 block">Bank Ref No.</Label>
                  <p className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-700">
                    {editingTransaction.referenceNumber}
                  </p>
                </div>
              )}
            </div>

            {/* Party Name Input */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-party-name" className="text-xs font-semibold">
                Party Name <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Input
                id="modal-party-name"
                value={modalPartyName}
                onChange={(e) => setModalPartyName(e.target.value)}
                placeholder="Enter party name"
                className="w-full h-10 input-modern text-sm"
              />
              {modalSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {modalSuggestions
                    .filter(s => s !== modalPartyName)
                    .slice(0, 3)
                    .map((suggestion, idx) => (
                      <div key={idx} className="flex items-center gap-1 relative">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            // If clicking on Info icon, show similar transactions
                            const target = e.target as HTMLElement;
                            if (target.closest('.info-icon-button') || target.closest('svg')) {
                              e.stopPropagation();
                              handleShowModalSimilarTransactions(suggestion);
                            } else {
                              // Otherwise, use the suggestion
                              setModalPartyName(suggestion);
                            }
                          }}
                          className="flex-shrink-0 text-xs h-7 px-2"
                          title={`Use suggested: ${suggestion}`}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          {suggestion}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowModalSimilarTransactions(suggestion);
                            }}
                            className="info-icon-button p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded transition-colors flex-shrink-0 ml-0.5"
                            title="Why this suggestion? Click to see transactions completed with this party name"
                          >
                            <Info className="h-2.5 w-2.5" />
                          </button>
                        </Button>
                        {showModalSimilarTransactions?.suggestedName === suggestion && (
                          <div className="modal-similar-transactions-tooltip absolute right-0 top-full mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-[250px] max-w-[320px] max-h-[250px] overflow-y-auto">
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-xs font-semibold text-gray-700">Completed: {suggestion}</h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowModalSimilarTransactions(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            {modalSimilarTransactions.length > 0 ? (
                              <div className="space-y-1.5">
                                {modalSimilarTransactions.map((t) => (
                                  <div key={t.id} className="text-xs border-b border-gray-200 pb-1.5 last:border-0">
                                    <div className="font-medium text-gray-900">{formatDate(t.date)}</div>
                                    <div className="text-gray-700 mt-0.5">₹{t.amount.toLocaleString()}</div>
                                    <div className="text-gray-600 mt-0.5 line-clamp-1">{t.description || '-'}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">No similar transactions found</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Vyapar Reference Number Input */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-vyapar-ref" className="text-xs font-semibold">
                Vyapar Reference <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Input
                id="modal-vyapar-ref"
                value={modalVyaparRef}
                onChange={(e) => {
                  setModalVyaparRef(e.target.value);
                  // Clear error when user types
                  if (duplicateError) setDuplicateError(null);
                }}
                placeholder="Enter Vyapar reference number"
                className={cn("h-10 input-modern text-sm", duplicateError && "border-red-500 focus:border-red-500")}
                disabled={isSavingToSheets}
              />
            </div>

            {/* Loading State */}
            {isSavingToSheets && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-900">Saving data. Please wait...</p>
                </div>
              </div>
            )}

            {/* Duplicate Error Message */}
            {duplicateError && !isSavingToSheets && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-900 mb-1.5">Duplicate Vyapar Reference</p>
                    <p className="text-xs text-red-800 mb-2">{duplicateError.message}</p>
                    {duplicateError.existingTransaction && (
                      <div className="mt-2 p-2 bg-white rounded border border-red-200">
                        <p className="text-xs font-semibold text-red-900 mb-1">Existing Transaction:</p>
                        <div className="space-y-0.5 text-xs text-red-800">
                          <p><span className="font-medium">Date:</span> {formatDate(duplicateError.existingTransaction.date || 'N/A')}</p>
                          <p><span className="font-medium">Amount:</span> ₹{duplicateError.existingTransaction.amount?.toLocaleString() || '0'}</p>
                          <p><span className="font-medium">Party:</span> {duplicateError.existingTransaction.partyName || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-red-700 mt-2">Please use a different reference number.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-900">Transaction saved successfully!</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 pt-3 border-t border-border">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCloseEditModal}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <div className="flex gap-1.5">
                <Button 
                  onClick={handleMoveToHold}
                  variant="outline"
                  size="sm"
                  className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 text-xs h-9 px-3"
                >
                  Hold
                </Button>
                <Button 
                  onClick={handleMoveToSelfTransfer}
                  variant="outline"
                  size="sm"
                  className="border-purple-500 text-purple-700 hover:bg-purple-50 text-xs h-9 px-3"
                >
                  Self Transfer
                </Button>
                <Button 
                  onClick={handleSubmitTransaction}
                  size="sm"
                  className="btn-gradient text-xs h-9 px-3"
                  disabled={isSavingToSheets}
                >
                  {isSavingToSheets ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      {confirmationModal && (
        <Modal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(null)}
          title=""
        >
          <div className="space-y-6">
            {/* Icon and Title */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={cn(
                "p-4 rounded-full",
                confirmationModal.variant === 'warning' && "bg-yellow-100",
                confirmationModal.variant === 'info' && "bg-blue-100",
                confirmationModal.variant === 'danger' && "bg-red-100"
              )}>
                {confirmationModal.icon}
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                {confirmationModal.title}
              </h3>
            </div>

            {/* Message */}
            <div className="text-center">
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {confirmationModal.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setConfirmationModal(null)}
              >
                {confirmationModal.cancelText || "Cancel"}
              </Button>
              <Button
                onClick={confirmationModal.onConfirm}
                className={cn(
                  confirmationModal.variant === 'warning' && "bg-yellow-600 hover:bg-yellow-700",
                  confirmationModal.variant === 'info' && "bg-blue-600 hover:bg-blue-700",
                  confirmationModal.variant === 'danger' && "bg-red-600 hover:bg-red-700",
                  !confirmationModal.variant && "btn-gradient"
                )}
              >
                {confirmationModal.confirmText || "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
