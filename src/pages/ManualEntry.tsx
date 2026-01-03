import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Select } from "../components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { StorageService } from "../services/storageService";
import { Transaction, TransactionType } from "../types/transaction";
import { generateId } from "../lib/utils";
import { Save, ChevronDown, X } from "lucide-react";
import { isGoogleSheetsConfigured, saveTransactionToSheets } from "../services/googleSheetsService";
import { PartyMappingService } from "../services/partyMappingService";
import { SupplierMappingService } from "../services/supplierMappingService";

interface FormData {
  date: string;
  amount: string;
  description: string;
  type: TransactionType;
  partyName: string;
  transferType: "CASH" | "UPI";
  notes: string;
}

export function ManualEntry() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      type: "credit",
      transferType: "CASH",
    },
  });

  const transactionType = watch("type");
  const description = watch("description");
  const partyName = watch("partyName");

  // Load party/supplier options based on transaction type
  useEffect(() => {
    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        if (transactionType === "credit") {
          // Load parties for credit transactions
          const parties = await PartyMappingService.getParties();
          const sortedParties = parties.sort();
          setNameOptions(sortedParties);
          setFilteredOptions(sortedParties);
        } else {
          // Load suppliers for debit transactions
          const suppliers = await SupplierMappingService.getSuppliers();
          const sortedSuppliers = suppliers.sort();
          setNameOptions(sortedSuppliers);
          setFilteredOptions(sortedSuppliers);
        }
      } catch (error) {
        console.error('Error loading name options:', error);
        setNameOptions([]);
        setFilteredOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    loadOptions();
    setSearchTerm("");
    setValue("partyName", "");
  }, [transactionType, setValue]);

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === "") {
      setFilteredOptions(nameOptions);
    } else {
      const term = searchTerm.trim().toLowerCase();
      const filtered = nameOptions.filter(option => {
        if (!option) return false;
        return option.toLowerCase().includes(term);
      });
      setFilteredOptions(filtered);
    }
  }, [searchTerm, nameOptions]);

  // Auto-suggest based on description when description changes
  useEffect(() => {
    const loadSuggestionFromDescription = async () => {
      if (!description || description.trim().length < 3 || partyName) {
        return;
      }

      try {
        let suggestion: string | null = null;
        if (transactionType === "credit") {
          const suggestions = await PartyMappingService.findPartiesFromNarration(description.trim(), 1);
          if (suggestions.length > 0 && suggestions[0]) {
            suggestion = suggestions[0];
          }
        } else {
          const suggestions = await SupplierMappingService.findSuppliersFromNarration(description.trim(), 1);
          if (suggestions.length > 0 && suggestions[0]) {
            suggestion = suggestions[0];
          }
        }

        // Auto-fill if suggestion found and field is empty
        if (suggestion) {
          setValue("partyName", suggestion, { shouldValidate: false });
          setSearchTerm(suggestion);
        }
      } catch (error) {
        console.error('Error loading suggestion from description:', error);
      }
    };

    // Debounce the suggestion
    const timeoutId = setTimeout(loadSuggestionFromDescription, 1000);
    return () => clearTimeout(timeoutId);
  }, [description, transactionType, partyName, setValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (option: string) => {
    setValue("partyName", option, { shouldValidate: true });
    setSearchTerm(option);
    setIsDropdownOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setValue("partyName", value, { shouldValidate: true });
    // Keep dropdown open when typing
    if (value.trim().length > 0) {
      setIsDropdownOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (nameOptions.length > 0 && !isDropdownOpen) {
      setIsDropdownOpen(true);
    }
  };
  
  const handleInputClick = () => {
    if (nameOptions.length > 0 && !isDropdownOpen) {
      setIsDropdownOpen(true);
    }
  };

  const handleClear = () => {
    setSearchTerm("");
    setValue("partyName", "", { shouldValidate: false });
    setIsDropdownOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const transaction: Transaction = {
        id: generateId(),
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description,
        type: data.type,
        category: data.type === "credit" ? "Credit Sale" : "Purchase", // Default category based on type
        partyName: data.partyName.trim() || "Unknown",
        referenceNumber: data.transferType, // Transfer type (CASH or UPI)
        notes: data.notes || undefined,
        added_to_vyapar: false,
        vyapar_reference_number: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // NO LOCAL STORAGE - Save directly to Google Sheets
      StorageService.addTransaction(transaction);
      
      // Save to Google Sheets if configured
      if (isGoogleSheetsConfigured()) {
        try {
          await saveTransactionToSheets(transaction);
        } catch (error) {
          console.error('Error saving to Google Sheets:', error);
        }
      }
      
      StorageService.updatePartyBalance(
        transaction.partyName,
        transaction.amount,
        transaction.type
      );

      reset();
      setSearchTerm("");
      setIsDropdownOpen(false);
      alert("Transaction added successfully!");
      navigate("/transactions");
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-display font-bold text-gradient">
          Manual Entry
        </h1>
        <p className="text-muted-foreground mt-2">Add a new transaction manually</p>
      </div>

      <Card className="glass-card border-2 border-border/60 animate-fade-in">
        <CardHeader className="bg-muted/30 border-b border-border/60">
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-semibold">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date", { required: "Date is required" })}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                />
                {errors.date && (
                  <p className="text-sm text-destructive mt-1">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold">Type *</Label>
                <Select 
                  id="type" 
                  {...register("type", { required: true })}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount", {
                    required: "Amount is required",
                    min: { value: 0.01, message: "Amount must be greater than 0" },
                  })}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                />
                {errors.amount && (
                  <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferType" className="text-sm font-semibold">Transfer Type *</Label>
                <Select 
                  id="transferType" 
                  {...register("transferType", { required: "Transfer type is required" })}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                </Select>
                {errors.transferType && (
                  <p className="text-sm text-destructive mt-1">{errors.transferType.message}</p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">Description *</Label>
                <Input
                  id="description"
                  placeholder="Transaction description or narration"
                  {...register("description", { required: "Description is required" })}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="partyName" className="text-sm font-semibold">
                  {transactionType === "credit" ? "Party Name *" : "Supplier Name *"}
                </Label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Input
                      id="partyName"
                      ref={(e) => {
                        inputRef.current = e;
                        register("partyName", { 
                          required: transactionType === "credit" 
                            ? "Party name is required" 
                            : "Supplier name is required",
                          minLength: { value: 2, message: "Name must be at least 2 characters" }
                        }).ref(e);
                      }}
                      value={searchTerm}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onClick={handleInputClick}
                      placeholder={
                        isLoadingOptions 
                          ? "Loading options..." 
                          : transactionType === "credit" 
                            ? "Search or select a party name..." 
                            : "Search or select a supplier name..."}
                      className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all pr-20"
                      disabled={isLoadingOptions}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClear();
                          }}
                          className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 text-slate-500" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDropdownOpen(!isDropdownOpen);
                          if (!isDropdownOpen && inputRef.current) {
                            inputRef.current.focus();
                          }
                        }}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                      >
                        <ChevronDown 
                          className={`h-5 w-5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                      </button>
                    </div>
                  </div>
                  
                  {/* Dropdown List */}
                  {isDropdownOpen && !isLoadingOptions && nameOptions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredOptions.length > 0 ? (
                        <ul className="py-1">
                          {filteredOptions.map((option) => {
                            // Highlight matching text
                            const searchLower = searchTerm.toLowerCase();
                            const optionLower = option.toLowerCase();
                            const index = optionLower.indexOf(searchLower);
                            
                            return (
                              <li
                                key={option}
                                onClick={() => handleSelectOption(option)}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                              >
                                {index >= 0 ? (
                                  <>
                                    {option.substring(0, index)}
                                    <span className="bg-yellow-200 font-semibold">
                                      {option.substring(index, index + searchTerm.length)}
                                    </span>
                                    {option.substring(index + searchTerm.length)}
                                  </>
                                ) : (
                                  option
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : searchTerm.trim().length > 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          No {transactionType === "credit" ? "parties" : "suppliers"} found matching "{searchTerm}". 
                          You can type a custom name.
                        </div>
                      ) : (
                        <ul className="py-1">
                          {nameOptions.slice(0, 20).map((option) => (
                            <li
                              key={option}
                              onClick={() => handleSelectOption(option)}
                              className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                            >
                              {option}
                            </li>
                          ))}
                          {nameOptions.length > 20 && (
                            <li className="px-4 py-2 text-xs text-slate-500 text-center">
                              Showing first 20. Type to search...
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {isLoadingOptions && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-4 text-center text-sm text-slate-500">
                      Loading {transactionType === "credit" ? "parties" : "suppliers"}...
                    </div>
                  )}
                </div>
                {errors.partyName && (
                  <p className="text-sm text-destructive mt-1">{errors.partyName.message}</p>
                )}
                {nameOptions.length > 0 && !isLoadingOptions && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {nameOptions.length} {transactionType === "credit" ? "parties" : "suppliers"} available. Type to search or click to select.
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes (optional)"
                  {...register("notes")}
                  className="h-11 border-2 border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-border">
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="btn-gradient px-8 py-2.5 text-base font-semibold"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Saving..." : "Save Transaction"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setSearchTerm("");
                  setIsDropdownOpen(false);
                }}
                disabled={isSubmitting}
                className="px-8 py-2.5 text-base font-semibold border-2"
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

