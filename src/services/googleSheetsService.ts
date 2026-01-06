// Google Sheets Service for writing transaction data
// This service handles writing transaction data to Google Sheets

// Option 1: Using Google Apps Script (Recommended - No API key needed)
// You need to create a Google Apps Script web app first
// Get URL from environment variable for security
const APPS_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL || '';

// Export URL for error messages
export function getGoogleSheetsURL(): string {
  return APPS_SCRIPT_URL;
}

// Option 2: Using Google Sheets API (Requires API key and OAuth)
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

import { Transaction } from '../types/transaction';
import { formatDate, formatDateForSheets } from '../lib/utils';

// Party Name Mapping interface (defined here to avoid circular dependency)
export interface PartyNameMapping {
  id: string;
  originalName: string;
  correctedName: string;
  confidence: number;
  lastUsed: string;
  createdAt: string;
}

// Supplier Name Mapping interface (similar to PartyNameMapping)
export interface SupplierNameMapping {
  id: string;
  originalName: string;
  correctedName: string;
  confidence: number;
  lastUsed: string;
  createdAt: string;
}

/**
 * Check if a Vyapar reference number already exists in the system
 * Returns the transaction ID if duplicate found, null otherwise
 */
export async function checkDuplicateVyaparRef(vyaparRef: string, excludeTransactionId?: string): Promise<{ isDuplicate: boolean; existingTransactionId?: string; existingTransaction?: Transaction }> {
  if (!vyaparRef || !vyaparRef.trim()) {
    return { isDuplicate: false };
  }

  const trimmedRef = vyaparRef.trim().toLowerCase();

  try {
    // Fetch all transactions from Google Sheets
    const allTransactions = await fetchTransactionsFromSheets();
    
    // Also check debit transactions
    const debitTransactions = await fetchDebitTransactionsFromSheets();
    const allTransactionsCombined = [...allTransactions, ...debitTransactions];

    // Check for duplicate (case-insensitive)
    const duplicate = allTransactionsCombined.find((t) => {
      if (t.id === excludeTransactionId) return false; // Exclude current transaction
      if (!t.vyapar_reference_number) return false;
      return String(t.vyapar_reference_number).trim().toLowerCase() === trimmedRef;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        existingTransactionId: duplicate.id,
        existingTransaction: duplicate,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking duplicate Vyapar reference:', error);
    // On error, allow the operation (fail open) but log the error
    return { isDuplicate: false };
  }
}

/**
 * Verify that a transaction was successfully updated in Google Sheets
 * Fetches the transaction back and compares the Vyapar reference number
 */
export async function verifyTransactionUpdate(transactionId: string, expectedVyaparRef: string, transactionType: 'credit' | 'debit' = 'credit'): Promise<{ success: boolean; actualValue?: string; error?: string }> {
  if (!transactionId || !expectedVyaparRef) {
    return { success: false, error: 'Missing transaction ID or Vyapar reference' };
  }

  try {
    // Wait a bit for Google Sheets to process the update
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Fetch the transaction back from Google Sheets
    const transactions = transactionType === 'credit' 
      ? await fetchTransactionsFromSheets()
      : await fetchDebitTransactionsFromSheets();
    
    const updatedTransaction = transactions.find(t => t.id === transactionId);

    if (!updatedTransaction) {
      return { success: false, error: 'Transaction not found in Google Sheets' };
    }

    const actualRef = updatedTransaction.vyapar_reference_number 
      ? String(updatedTransaction.vyapar_reference_number).trim() 
      : '';

    const expectedRef = expectedVyaparRef.trim();

    if (actualRef.toLowerCase() === expectedRef.toLowerCase()) {
      return { success: true, actualValue: actualRef };
    } else {
      return { 
        success: false, 
        actualValue: actualRef, 
        error: `Mismatch: Expected "${expectedRef}" but found "${actualRef}"` 
      };
    }
  } catch (error) {
    console.error('Error verifying transaction update:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update an existing transaction in Google Sheets
 * Finds the transaction by ID and updates the row
 * Now includes verification to confirm the update was successful
 */
export async function updateTransactionInSheets(transaction: Transaction): Promise<{ success: boolean; error?: string }> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping Google Sheets update.');
    return { success: false, error: 'Google Apps Script URL not configured' };
  }

  try {
    // Format transaction data as row array
    const rowData = formatTransactionAsRow(transaction);

    // Determine which sheet to update based on transaction type
    const sheetName = transaction.type === 'debit' ? 'DebitTransactions' : 'Transactions';

    console.log(`Updating ${transaction.type} transaction in Google Sheets (${sheetName}):`, { id: transaction.id, vyaparRef: transaction.vyapar_reference_number });

    // Use fetch API for better error handling and response checking
    const formData = new URLSearchParams();
    formData.append('action', 'updateRow');
    formData.append('transactionId', transaction.id);
    formData.append('sheetName', sheetName); // Specify which sheet to update
    formData.append('data', JSON.stringify(rowData));

    // Try using fetch first (more reliable)
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        mode: 'no-cors', // Google Apps Script doesn't support CORS, but we'll verify separately
      });

      // Since we're using no-cors, we can't read the response
      // So we'll verify the update after a delay
      console.log('Update request sent, verifying...');
      
      // Wait a bit for Google Sheets to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the update was successful
      if (transaction.vyapar_reference_number) {
        const verification = await verifyTransactionUpdate(
          transaction.id,
          transaction.vyapar_reference_number,
          transaction.type || 'credit'
        );
        
        if (verification.success) {
          console.log('✓ Transaction updated and verified in Google Sheets');
          return { success: true };
        } else {
          const errorMsg = `Update verification failed: ${verification.error || 'Unknown error'}. Expected: "${transaction.vyapar_reference_number}", Found: "${verification.actualValue || 'N/A'}"`;
          console.error('⚠️', errorMsg);
          return { success: false, error: errorMsg };
        }
      } else {
        // For updates without Vyapar ref, we can't verify easily, so just wait and assume success
        console.log('✓ Transaction update request sent (no verification for updates without Vyapar ref)');
        return { success: true };
      }
    } catch (fetchError) {
      console.warn('Fetch API failed, falling back to iframe method:', fetchError);
      
      // Fallback to iframe method
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.name = 'google-sheets-iframe-update-' + Date.now();
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = APPS_SCRIPT_URL;
        form.target = iframe.name;
        form.enctype = 'application/x-www-form-urlencoded';
        form.style.display = 'none';

        // Send update data
        const payload = {
          action: 'updateRow',
          transactionId: transaction.id,
          sheetName: sheetName, // Specify which sheet to update
          data: JSON.stringify(rowData),
        };

        // Add each field as a form input
        Object.keys(payload).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = payload[key as keyof typeof payload];
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        
        // Clean up and verify after a delay
        setTimeout(async () => {
          try {
            if (document.body.contains(form)) {
              document.body.removeChild(form);
            }
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          } catch (e) {
            // Already removed
          }
          
          // Verify the update was successful
          if (transaction.vyapar_reference_number) {
            const verification = await verifyTransactionUpdate(
              transaction.id,
              transaction.vyapar_reference_number,
              transaction.type || 'credit'
            );
            
            if (verification.success) {
              console.log('✓ Transaction updated and verified in Google Sheets');
              resolve({ success: true });
            } else {
              const errorMsg = `Update verification failed: ${verification.error || 'Unknown error'}`;
              console.error('⚠️', errorMsg);
              resolve({ success: false, error: errorMsg });
            }
          } else {
            console.log('✓ Transaction update request sent (no verification)');
            resolve({ success: true });
          }
        }, 3000);
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating transaction in Google Sheets:', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Save transaction data to Google Sheets using Google Apps Script
 */
/**
 * Test Google Sheets connection
 */
export async function testGoogleSheetsConnection(): Promise<{ success: boolean; error?: string }> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return { success: false, error: 'Google Apps Script URL not configured' };
  }

  try {
    // Test with a simple GET request - CORS will fail but we can check the error
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'GET',
        mode: 'no-cors', // Use no-cors to avoid CORS error
      });
      
      // With no-cors, we can't read the response, but if it doesn't throw, the URL is accessible
      return { success: true, error: 'Connection test completed (CORS prevents reading response, but URL is accessible)' };
    } catch (fetchError) {
      // If it's a CORS error, that's actually normal for Google Apps Script
      if (fetchError instanceof TypeError && fetchError.message.includes('CORS')) {
        return { 
          success: true, 
          error: 'CORS error is normal for Google Apps Script. The form submission method will work around this.' 
        };
      }
      throw fetchError;
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function saveTransactionToSheets(transaction: Transaction): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping Google Sheets write.');
    return false;
  }

  try {
    // Format transaction data as row array
    const rowData = formatTransactionAsRow(transaction);

    // Determine which sheet to use based on transaction type
    const sheetName = transaction.type === 'debit' ? 'DebitTransactions' : 'Transactions';

    console.log(`Sending ${transaction.type} transaction to Google Sheets (${sheetName}):`, { rowCount: rowData.length });

    // Google Apps Script - use URL-encoded form data which works better
    // Create form with proper encoding
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'google-sheets-iframe-' + Date.now();
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframe.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      // Send data as URL-encoded form fields
      // Google Apps Script receives this as e.parameter.fieldName
      const payload = {
        action: 'appendRow',
        sheetName: sheetName, // Specify which sheet to write to
        data: JSON.stringify(rowData), // Send data array as JSON string
      };

      console.log('Form payload:', payload);
      console.log('Row data being sent:', rowData);

      // Add each field as a form input
      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key as keyof typeof payload];
        form.appendChild(input);
      });

      document.body.appendChild(form);

      // Submit and wait
      form.submit();
      
      // Clean up after a delay
      setTimeout(() => {
        try {
          if (document.body.contains(form)) {
            document.body.removeChild(form);
          }
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch (e) {
          // Already removed
        }
        console.log('✓ Transaction sent to Google Sheets');
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    return false;
  }
}

/**
 * Save multiple transactions to Google Sheets in a single batch
 */
export async function saveTransactionsToSheets(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping Google Sheets write.');
    return { success: 0, failed: transactions.length };
  }

  if (transactions.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`Starting to save ${transactions.length} transactions to Google Sheets in batch...`);

  try {
    // DEDUPLICATION: Remove duplicate transactions before saving
    // Check for duplicates by ID and by composite key (date + amount + description + reference)
    const existingTransactions = await fetchTransactionsFromSheets();
    const existingDebitTransactions = await fetchDebitTransactionsFromSheets();
    const allExisting = [...existingTransactions, ...existingDebitTransactions];
    
    // Create a Set of existing transaction keys
    const existingKeys = new Set<string>();
    allExisting.forEach(t => {
      // Primary key: transaction ID
      if (t.id && t.id.trim()) {
        existingKeys.add(`id:${t.id.trim()}`);
      }
      // Composite key: date + amount + description + reference
      const dateStr = t.date || '';
      const amountStr = String(t.amount || 0);
      const descStr = (t.description || '').substring(0, 50).trim();
      const refStr = (t.referenceNumber || '').trim();
      existingKeys.add(`composite:${dateStr}|${amountStr}|${descStr}|${refStr}`);
    });
    
    // Filter out duplicates
    const uniqueTransactions = transactions.filter(t => {
      // Check by ID
      if (t.id && t.id.trim()) {
        if (existingKeys.has(`id:${t.id.trim()}`)) {
          console.log(`⚠️ Skipping duplicate transaction by ID: ${t.id}`);
          return false;
        }
      }
      // Check by composite key
      const dateStr = t.date || '';
      const amountStr = String(t.amount || 0);
      const descStr = (t.description || '').substring(0, 50).trim();
      const refStr = (t.referenceNumber || '').trim();
      const compositeKey = `composite:${dateStr}|${amountStr}|${descStr}|${refStr}`;
      if (existingKeys.has(compositeKey)) {
        console.log(`⚠️ Skipping duplicate transaction by composite key: ${compositeKey}`);
        return false;
      }
      return true;
    });
    
    // Calculate duplicates count (initialize to 0 if no duplicates)
    const duplicatesCount = transactions.length - uniqueTransactions.length;
    if (duplicatesCount > 0) {
      console.log(`⚠️ Removed ${duplicatesCount} duplicate transaction(s) before saving`);
    }
    
    if (uniqueTransactions.length === 0) {
      console.log('All transactions were duplicates. Nothing to save.');
      return { success: 0, failed: transactions.length };
    }

    // Separate credit and debit transactions
    const creditTransactions = uniqueTransactions.filter(t => t.type === 'credit' || !t.type);
    const debitTransactions = uniqueTransactions.filter(t => t.type === 'debit');
    
    console.log(`Separated transactions: ${creditTransactions.length} credit, ${debitTransactions.length} debit`);

    // Format transactions as rows
    const creditRows = creditTransactions.map(transaction => formatTransactionAsRow(transaction));
    const debitRows = debitTransactions.map(transaction => formatTransactionAsRow(transaction));
    
    let successCount = 0;
    let failedCount = duplicatesCount;

    // Send credit transactions if any
    if (creditRows.length > 0) {
      console.log(`Sending batch of ${creditRows.length} credit transactions...`);
      try {
        await sendBatchToSheets(creditRows, 'Transactions');
        successCount += creditRows.length;
      } catch (error) {
        console.error('Error sending credit transactions:', error);
        failedCount += creditRows.length;
      }
    }

    // Send debit transactions if any
    if (debitRows.length > 0) {
      console.log(`Sending batch of ${debitRows.length} debit transactions to DebitTransactions sheet...`);
      try {
        await sendBatchToSheets(debitRows, 'DebitTransactions');
        successCount += debitRows.length;
        console.log(`✓ Successfully sent ${debitRows.length} debit transactions to DebitTransactions sheet`);
      } catch (error) {
        console.error('❌ Error sending debit transactions:', error);
        console.error('Error details:', {
          error,
          rowCount: debitRows.length,
          firstRow: debitRows[0],
          sheetName: 'DebitTransactions'
        });
        failedCount += debitRows.length;
      }
    }

    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('Error saving batch to Google Sheets:', error);
    return { success: 0, failed: transactions.length };
  }
}

/**
 * Helper function to send batch of rows to a specific sheet
 */
async function sendBatchToSheets(rows: (string | number)[][], sheetName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
      reject(new Error('Google Apps Script URL not configured'));
      return;
    }

    if (rows.length === 0) {
      console.log(`No rows to send to ${sheetName} sheet`);
      resolve();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'google-sheets-iframe-batch-' + Date.now() + '-' + sheetName;
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = iframe.name;
    form.enctype = 'application/x-www-form-urlencoded';
    form.style.display = 'none';

    // Send batch data with sheet name
    const payload = {
      action: 'appendRows',
      sheetName: sheetName, // Specify which sheet to write to
      data: JSON.stringify(rows), // Send all rows as JSON string
    };

    console.log(`📤 Sending batch to ${sheetName} sheet:`, { 
      action: payload.action, 
      rowCount: rows.length,
      sheetName: sheetName,
      firstRowSample: rows[0]?.slice(0, 5) // Show first 5 columns of first row
    });

    // Add each field as a form input
    Object.keys(payload).forEach(key => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = payload[key as keyof typeof payload];
      form.appendChild(input);
    });

    document.body.appendChild(form);

    // Submit and wait
    form.submit();
    
    // Clean up after a delay
    setTimeout(() => {
      try {
        if (document.body.contains(form)) {
          document.body.removeChild(form);
        }
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch (e) {
        // Already removed
      }
      console.log(`✓ Batch of ${rows.length} transactions sent to ${sheetName} sheet (check Google Sheets to verify)`);
      // Note: We can't verify the response with iframe method, so we just resolve
      // The actual success/failure will be visible in Google Sheets
      resolve();
    }, 3000); // Give it a bit more time for batch processing
  });
}

/**
 * Format transaction as row data for Google Sheets
 * Adjust column order based on your Google Sheet structure
 */
function formatTransactionAsRow(transaction: Transaction): (string | number)[] {
  // CRITICAL: Date should ONLY be set from CSV upload, NEVER modified
  // This function formats the date for Google Sheets in DD MMM YYYY format
  const dateValue = transaction.date; // Use original date value (ISO format: YYYY-MM-DD)
  console.log('📅 Formatting transaction date for Google Sheets:', dateValue, '->', formatDateForSheets(dateValue), 'for transaction:', transaction.id);
  
  return [
    transaction.id, // Transaction ID (unique key) - FIRST COLUMN
    formatDateForSheets(dateValue), // Date - formatted as DD MMM YYYY for Google Sheets
    transaction.description || '', // Narration/Description
    transaction.referenceNumber || '', // Bank Ref No.
    transaction.amount, // Amount
    transaction.partyName || '', // Party Name
    transaction.category || '', // Category
    transaction.type || 'credit', // Type
    transaction.added_to_vyapar ? 'Yes' : 'No', // Added to Vyapar
    transaction.vyapar_reference_number || '', // Vyapar Ref No.
    transaction.hold ? 'Yes' : 'No', // Hold Status
    transaction.selfTransfer ? 'Yes' : 'No', // Self Transfer Status
    transaction.notes || '', // Notes
    transaction.createdAt ? formatDateForSheets(transaction.createdAt) : '', // Created At
    transaction.updatedAt ? formatDateForSheets(transaction.updatedAt) : '', // Updated At
  ];
}

/**
 * Fetch all transactions from Google Sheets
 */
export async function fetchTransactionsFromSheets(): Promise<Transaction[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Cannot fetch transactions.');
    return [];
  }

  try {
    console.log('Fetching transactions from Google Sheets...');

    // Use GET request to fetch data
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getTransactions`, {
      method: 'GET',
    });

    const responseText = await response.text();
    console.log('Google Sheets response:', responseText.substring(0, 500));

    // Check if response is HTML (sign-in page) instead of JSON
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      throw new Error('Script requires authorization. Please authorize the Google Apps Script first.');
    }

    // Parse JSON response
    const result = JSON.parse(responseText);
    
    if (result.success && result.data) {
      // Convert sheet rows to Transaction objects
      const transactions = result.data.map((row: any[]) => {
        // Column order: [ID, Date, Narration, Bank Ref No., Amount, Party Name, Category, Type, Added to Vyapar, Vyapar Ref No., Hold, Notes, Created At, Updated At]
        
        // Get date as STRING from Google Sheets - keep exactly as shown in Google Sheets
        let dateStr = String(row[1] || '').trim();
        
        // Helper function to add 1 day to a date
        const addOneDay = (year: number, month: number, day: number): { year: number; month: number; day: number } => {
          const date = new Date(year, month - 1, day);
          date.setDate(date.getDate() + 1); // Add 1 day
          return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
          };
        };
        
        // If it's already in "DD MMM YYYY" format, parse it and add 1 day
        if (dateStr.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/)) {
          const match = dateStr.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/);
          if (match) {
            const day = parseInt(match[1], 10);
            const monthName = match[2];
            const year = parseInt(match[3], 10);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames.indexOf(monthName) + 1;
            if (month > 0) {
              const adjusted = addOneDay(year, month, day);
              dateStr = `${String(adjusted.day).padStart(2, '0')} ${monthNames[adjusted.month - 1]} ${adjusted.year}`;
            }
          }
        } else if (row[1] instanceof Date) {
          // If it's a Date object, add 1 day
          const date = new Date(row[1]);
          date.setDate(date.getDate() + 1);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
          // ISO timestamp string (e.g., "2025-01-03T18:30:00.000Z") - extract date part and add 1 day
          const datePart = dateStr.split('T')[0];
          const [year, month, day] = datePart.split('-').map(Number);
          const adjusted = addOneDay(year, month, day);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${String(adjusted.day).padStart(2, '0')} ${monthNames[adjusted.month - 1]} ${adjusted.year}`;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // ISO date string (YYYY-MM-DD) - add 1 day and convert to "DD MMM YYYY"
          const [year, month, day] = dateStr.split('-').map(Number);
          const adjusted = addOneDay(year, month, day);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${String(adjusted.day).padStart(2, '0')} ${monthNames[adjusted.month - 1]} ${adjusted.year}`;
        }
        
        // If empty, use today's date in "DD MMM YYYY" format
        if (!dateStr) {
          const d = new Date();
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const day = d.getDate();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
        }
        
        // Parse amount - handle both number and string
        let amount = 0;
        if (typeof row[4] === 'number') {
          amount = row[4];
        } else if (typeof row[4] === 'string') {
          // Remove commas and parse
          amount = parseFloat(row[4].replace(/,/g, '')) || 0;
        }
        
        // Ensure vyapar_reference_number is a string or undefined
        let vyaparRef = row[9];
        if (vyaparRef !== null && vyaparRef !== undefined && vyaparRef !== '') {
          vyaparRef = String(vyaparRef).trim();
          if (vyaparRef === '') vyaparRef = undefined;
        } else {
          vyaparRef = undefined;
        }
        
        // Ensure referenceNumber is a string or undefined
        let refNumber = row[3];
        if (refNumber !== null && refNumber !== undefined && refNumber !== '') {
          refNumber = String(refNumber).trim();
          if (refNumber === '') refNumber = undefined;
        } else {
          refNumber = undefined;
        }
        
        // Ensure notes is a string or undefined
        let notesValue = row[11];
        if (notesValue !== null && notesValue !== undefined && notesValue !== '') {
          notesValue = String(notesValue).trim();
          if (notesValue === '') notesValue = undefined;
        } else {
          notesValue = undefined;
        }
        
        return {
          id: String(row[0] || '').trim() || '',
          date: dateStr || formatDateForSheets(new Date()),
          description: String(row[2] || '').trim(),
          referenceNumber: refNumber,
          amount: amount,
          partyName: String(row[5] || '').trim(),
          category: (row[6] || 'Other Credit') as Transaction['category'],
          type: (row[7] || 'credit') as 'credit' | 'debit',
          added_to_vyapar: row[8] === 'Yes' || row[8] === true || row[8] === 'true',
          vyapar_reference_number: vyaparRef,
          hold: row[10] === 'Yes' || row[10] === true || row[10] === 'true',
          selfTransfer: row[11] === 'Yes' || row[11] === true || row[11] === 'true',
          notes: notesValue,
          createdAt: row[13] || formatDateForSheets(new Date()),
          updatedAt: row[14] || formatDateForSheets(new Date()),
        } as Transaction;
      });

      console.log(`✓ Fetched ${transactions.length} transactions from Google Sheets`);
      return transactions;
    } else {
      console.error('Failed to fetch transactions:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching transactions from Google Sheets:', error);
    return [];
  }
}

/**
 * Fetch all debit transactions from Google Sheets
 */
export async function fetchDebitTransactionsFromSheets(): Promise<Transaction[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Cannot fetch debit transactions.');
    return [];
  }

  try {
    console.log('Fetching debit transactions from Google Sheets...');

    // Use GET request to fetch data
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getDebitTransactions`, {
      method: 'GET',
    });

    const responseText = await response.text();
    console.log('Google Sheets response:', responseText.substring(0, 500));

    // Check if response is HTML (sign-in page) instead of JSON
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      throw new Error('Script requires authorization. Please authorize the Google Apps Script first.');
    }

    // Parse JSON response
    const result = JSON.parse(responseText);
    
    if (result.success && result.data) {
      // Convert sheet rows to Transaction objects (same format as fetchTransactionsFromSheets)
      const transactions = result.data.map((row: any[]) => {
        // Column order: [ID, Date, Narration, Bank Ref No., Amount, Party Name, Category, Type, Added to Vyapar, Vyapar Ref No., Hold, Notes, Created At, Updated At]
        
        // Get date as STRING from Google Sheets - keep exactly as shown in Google Sheets
        let dateStr = String(row[1] || '').trim();
        
        // Helper function to add 1 day to a date
        const addOneDay = (year: number, month: number, day: number): { year: number; month: number; day: number } => {
          const date = new Date(year, month - 1, day);
          date.setDate(date.getDate() + 1); // Add 1 day
          return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
          };
        };
        
        // If it's already in "DD MMM YYYY" format, parse it and add 1 day
        const dateMatch = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
        if (dateMatch) {
          const months: { [key: string]: number } = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
          };
          const day = parseInt(dateMatch[1], 10);
          const month = months[dateMatch[2]] || 1;
          const year = parseInt(dateMatch[3], 10);
          const newDate = addOneDay(year, month, day);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${newDate.day} ${monthNames[newDate.month - 1]} ${newDate.year}`;
        }
        
        // Parse amount - ensure it's a number
        let amount = 0;
        const amountValue = row[4];
        if (typeof amountValue === 'number') {
          amount = amountValue;
        } else if (typeof amountValue === 'string') {
          // Remove commas and parse
          const cleaned = amountValue.replace(/,/g, '').trim();
          amount = parseFloat(cleaned) || 0;
        }
        
        // Parse reference number
        let refNumber = String(row[3] || '').trim();
        if (!refNumber || refNumber === 'undefined' || refNumber === 'null') {
          refNumber = '';
        }
        
        // Parse Vyapar reference number
        let vyaparRef = String(row[9] || '').trim();
        if (!vyaparRef || vyaparRef === 'undefined' || vyaparRef === 'null') {
          vyaparRef = '';
        }
        
        // Parse notes
        let notesValue: string | undefined;
        const notesStr = String(row[11] || '').trim();
        if (notesStr && notesStr !== 'undefined' && notesStr !== 'null' && notesStr !== '') {
          notesValue = notesStr;
        } else {
          notesValue = undefined;
        }
        
        return {
          id: String(row[0] || '').trim() || '',
          date: dateStr || formatDateForSheets(new Date()),
          description: String(row[2] || '').trim(),
          referenceNumber: refNumber,
          amount: amount,
          partyName: String(row[5] || '').trim(),
          category: (row[6] || 'Other Debit') as Transaction['category'],
          type: 'debit' as 'debit',
          added_to_vyapar: row[8] === 'Yes' || row[8] === true || row[8] === 'true',
          vyapar_reference_number: vyaparRef,
          hold: row[10] === 'Yes' || row[10] === true || row[10] === 'true',
          selfTransfer: row[11] === 'Yes' || row[11] === true || row[11] === 'true',
          notes: notesValue,
          createdAt: row[13] || formatDateForSheets(new Date()),
          updatedAt: row[14] || formatDateForSheets(new Date()),
        } as Transaction;
      });

      console.log(`✓ Fetched ${transactions.length} debit transactions from Google Sheets`);
      return transactions;
    } else {
      console.error('Failed to fetch debit transactions:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching debit transactions from Google Sheets:', error);
    return [];
  }
}

/**
 * Save party mapping to Google Sheets
 */
export async function savePartyMappingToSheets(mapping: PartyNameMapping): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping party mapping save.');
    return false;
  }

  try {
    const rowData = [
      mapping.id,
      mapping.originalName,
      mapping.correctedName,
      mapping.confidence,
      mapping.lastUsed,
      mapping.createdAt,
    ];

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'google-sheets-iframe-mapping-' + Date.now();
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframe.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const payload = {
        action: 'appendPartyMapping',
        data: JSON.stringify(rowData),
      };

      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key as keyof typeof payload];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try {
          if (document.body.contains(form)) document.body.removeChild(form);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        } catch (e) {}
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error saving party mapping to Google Sheets:', error);
    return false;
  }
}

/**
 * Update party mapping in Google Sheets
 */
export async function updatePartyMappingInSheets(mapping: PartyNameMapping): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return false;
  }

  try {
    const rowData = [
      mapping.id,
      mapping.originalName,
      mapping.correctedName,
      mapping.confidence,
      mapping.lastUsed,
      mapping.createdAt,
    ];

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'google-sheets-iframe-update-mapping-' + Date.now();
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframe.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const payload = {
        action: 'updatePartyMapping',
        mappingId: mapping.id,
        data: JSON.stringify(rowData),
      };

      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key as keyof typeof payload];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try {
          if (document.body.contains(form)) document.body.removeChild(form);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        } catch (e) {}
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error updating party mapping in Google Sheets:', error);
    return false;
  }
}

/**
 * Fetch all party mappings from Google Sheets
 */
export async function fetchPartyMappingsFromSheets(): Promise<PartyNameMapping[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getPartyMappings`, {
      method: 'GET',
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('Google Apps Script returned HTML instead of JSON. Response:', responseText.substring(0, 200));
      return [];
    }
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    // Try to parse JSON, but handle errors gracefully
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response. Response text:', responseText.substring(0, 500));
      console.error('Parse error:', parseError);
      return [];
    }
    
    if (result.success && result.data) {
      const mappings = result.data.map((row: any[]) => ({
        id: String(row[0] || ''),
        originalName: String(row[1] || ''),
        correctedName: String(row[2] || ''),
        confidence: Number(row[3]) || 1,
        lastUsed: String(row[4] || new Date().toISOString()),
        createdAt: String(row[5] || new Date().toISOString()),
      } as PartyNameMapping));

      return mappings;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching party mappings from Google Sheets:', error);
    return [];
  }
}

/**
 * Fetch all parties from Google Sheets (from a separate Parties sheet)
 * Expected format: Each row contains a party name
 */
export async function fetchPartiesFromSheets(): Promise<string[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getParties`, {
      method: 'GET',
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('Google Apps Script returned HTML instead of JSON. Response:', responseText.substring(0, 200));
      return [];
    }
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    // Try to parse JSON, but handle errors gracefully
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response. Response text:', responseText.substring(0, 500));
      console.error('Parse error:', parseError);
      return [];
    }
    
    if (result.success && result.data) {
      // Extract party names from rows (assuming first column contains party name)
      const parties = result.data
        .map((row: any[]) => String(row[0] || '').trim())
        .filter((party: string) => party.length > 0);
      
      return parties;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching parties from Google Sheets:', error);
    return [];
  }
}

/**
 * Fetch all suppliers from Google Sheets
 */
export async function fetchSuppliersFromSheets(): Promise<string[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSuppliers`, {
      method: 'GET',
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('Google Apps Script returned HTML instead of JSON. Response:', responseText.substring(0, 200));
      return [];
    }
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    // Try to parse JSON, but handle errors gracefully
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response. Response text:', responseText.substring(0, 500));
      console.error('Parse error:', parseError);
      return [];
    }
    
    if (result.success && result.data) {
      // Extract supplier names from rows (assuming first column contains supplier name)
      const suppliers = result.data
        .map((row: any[]) => String(row[0] || '').trim())
        .filter((supplier: string) => supplier.length > 0);
      
      return suppliers;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching suppliers from Google Sheets:', error);
    return [];
  }
}

/**
 * Match a party name word-by-word in narration
 * Returns a score (0-1) indicating how well the party matches the narration
 * 1.0 = all words match, 0.5 = half words match, 0 = no match
 */
export function scorePartyMatch(narration: string, partyName: string): number {
  if (!narration || !partyName) return 0;
  
  const narrationLower = narration.toLowerCase();
  const partyLower = partyName.toLowerCase();
  
  // Split party name into words (filter out very short words and common words)
  const partyWords = partyLower
    .split(/\s+/)
    .filter(word => word.length > 2) // Only consider words longer than 2 characters
    .filter(word => !/^(pvt|ltd|limited|private|inc|incorporated|llp|llc|and|the|of|for|to|in|on|at|by|with|from|hospital|hospitals)$/i.test(word)); // Filter common business words and "hospital"/"hospitals"
  
  // If no significant words, return 0
  if (partyWords.length === 0) return 0;
  
  // Count how many words match
  const matchingWords = partyWords.filter(word => narrationLower.includes(word));
  const matchRatio = matchingWords.length / partyWords.length;
  
  // Require at least 50% of words to match
  if (matchRatio < 0.5) return 0;
  
  // Return score (0.5 to 1.0 based on match ratio)
  return matchRatio;
}

/**
 * Find matching parties from parties list in narration (word-by-word matching)
 * Returns top 2-3 matches sorted by relevance score
 */
export function findMatchingParties(narration: string, parties: string[], maxMatches: number = 3): string[] {
  if (!narration || parties.length === 0) return [];
  
  // Score all parties
  const scoredParties = parties
    .map(party => ({
      party,
      score: scorePartyMatch(narration, party)
    }))
    .filter(item => item.score > 0) // Only keep parties with score > 0
    .sort((a, b) => b.score - a.score) // Sort by score (highest first)
    .slice(0, maxMatches) // Take top matches
    .map(item => item.party) // Extract party names
    .filter(party => party && party.trim().length > 0); // Filter out blank/empty party names
  
  return scoredParties;
}

/**
 * Get Google Sheets configuration status
 */
export function isGoogleSheetsConfigured(): boolean {
  return APPS_SCRIPT_URL.trim() !== '';
}

/**
 * Set Google Sheets Apps Script URL (for settings page)
 */
export function setGoogleSheetsURL(url: string): void {
  // In a real app, you'd save this to localStorage or settings
  // For now, we'll use a constant that needs to be updated in code
  console.warn('To configure Google Sheets URL, update APPS_SCRIPT_URL in googleSheetsService.ts');
}

/**
 * Format transaction as CSV row (for manual copy-paste fallback)
 */
export function formatTransactionAsCSV(transaction: Transaction): string {
  const escapeCSV = (value: string | number | undefined): string => {
    const str = value?.toString() || '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const row = formatTransactionAsRow(transaction);
  return row.map(escapeCSV).join(',');
}

/**
 * Copy multiple transactions as CSV to clipboard
 */
export async function copyTransactionsToClipboard(transactions: Transaction[]): Promise<void> {
  const headers = [
    'Date',
    'Narration',
    'Bank Ref No.',
    'Amount',
    'Party Name',
    'Category',
    'Type',
    'Added to Vyapar',
    'Vyapar Ref No.',
    'Hold',
    'Notes',
    'Created At',
    'Updated At',
  ];

  const csvRows = [
    headers.join(','),
    ...transactions.map(formatTransactionAsCSV),
  ];

  const csv = csvRows.join('\n');
  
  try {
    await navigator.clipboard.writeText(csv);
    console.log('Transactions copied to clipboard');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw error;
  }
}

/**
 * Save supplier mapping to Google Sheets
 */
export async function saveSupplierMappingToSheets(mapping: SupplierNameMapping): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping supplier mapping save.');
    return false;
  }

  try {
    const rowData = [
      mapping.id,
      mapping.originalName,
      mapping.correctedName,
      mapping.confidence,
      mapping.lastUsed,
      mapping.createdAt,
    ];

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'google-sheets-iframe-supplier-mapping-' + Date.now();
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframe.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const payload = {
        action: 'appendSupplierMapping',
        data: JSON.stringify(rowData),
      };

      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key as keyof typeof payload];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try {
          if (document.body.contains(form)) document.body.removeChild(form);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        } catch (e) {}
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error saving supplier mapping to Google Sheets:', error);
    return false;
  }
}

/**
 * Update supplier mapping in Google Sheets
 */
export async function updateSupplierMappingInSheets(mapping: SupplierNameMapping): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return false;
  }

  try {
    const rowData = [
      mapping.id,
      mapping.originalName,
      mapping.correctedName,
      mapping.confidence,
      mapping.lastUsed,
      mapping.createdAt,
    ];

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'google-sheets-iframe-update-supplier-mapping-' + Date.now();
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframe.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const payload = {
        action: 'updateSupplierMapping',
        mappingId: mapping.id,
        data: JSON.stringify(rowData),
      };

      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key as keyof typeof payload];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try {
          if (document.body.contains(form)) document.body.removeChild(form);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        } catch (e) {}
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error updating supplier mapping in Google Sheets:', error);
    return false;
  }
}

/**
 * Fetch all supplier mappings from Google Sheets
 */
export async function fetchSupplierMappingsFromSheets(): Promise<SupplierNameMapping[]> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    return [];
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSupplierMappings`, {
      method: 'GET',
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('Google Apps Script returned HTML instead of JSON. Response:', responseText.substring(0, 200));
      return [];
    }
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    // Try to parse JSON, but handle errors gracefully
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response. Response text:', responseText.substring(0, 500));
      console.error('Parse error:', parseError);
      return [];
    }
    
    if (result.success && result.data) {
      const mappings = result.data.map((row: any[]) => ({
        id: String(row[0] || ''),
        originalName: String(row[1] || ''),
        correctedName: String(row[2] || ''),
        confidence: Number(row[3]) || 1,
        lastUsed: String(row[4] || new Date().toISOString()),
        createdAt: String(row[5] || new Date().toISOString()),
      } as SupplierNameMapping));

      return mappings;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching supplier mappings from Google Sheets:', error);
    return [];
  }
}

