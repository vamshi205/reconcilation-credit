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

/**
 * Update an existing transaction in Google Sheets
 * Finds the transaction by ID and updates the row
 */
export async function updateTransactionInSheets(transaction: Transaction): Promise<boolean> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === '') {
    console.warn('Google Apps Script URL not configured. Skipping Google Sheets update.');
    return false;
  }

  try {
    // Format transaction data as row array
    const rowData = formatTransactionAsRow(transaction);

    console.log('Updating transaction in Google Sheets:', { id: transaction.id });

    // Google Apps Script - use URL-encoded form data
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
        data: JSON.stringify(rowData), // Send full row data as JSON string
      };

      console.log('Update payload:', payload);

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
        console.log('✓ Transaction updated in Google Sheets');
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    console.error('Error updating transaction in Google Sheets:', error);
    return false;
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

    console.log('Sending transaction to Google Sheets:', { rowCount: rowData.length });

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
    // Format all transactions as rows
    const allRows = transactions.map(transaction => formatTransactionAsRow(transaction));
    
    console.log(`Sending batch of ${allRows.length} transactions...`);

    // Send all transactions in one POST request
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'google-sheets-iframe-batch-' + Date.now();
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = iframe.name;
    form.enctype = 'application/x-www-form-urlencoded';
    form.style.display = 'none';

    // Send batch data
    const payload = {
      action: 'appendRows',
      data: JSON.stringify(allRows), // Send all rows as JSON string
    };

    console.log('Batch payload:', { action: payload.action, rowCount: allRows.length });

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
    return new Promise((resolve) => {
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
        console.log(`✓ Batch of ${transactions.length} transactions sent to Google Sheets`);
        resolve({ success: transactions.length, failed: 0 });
      }, 3000); // Give it a bit more time for batch processing
    });
  } catch (error) {
    console.error('Error saving batch to Google Sheets:', error);
    return { success: 0, failed: transactions.length };
  }
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
        
        // Parse date - Handle all formats and convert to "DD MMM YYYY" format to match Google Sheets
        let dateStr = row[1];
        if (dateStr instanceof Date) {
          // Extract date components directly without timezone conversion
          const year = dateStr.getFullYear();
          const month = dateStr.getMonth() + 1;
          const day = dateStr.getDate();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          // Store in "DD MMM YYYY" format to match Google Sheets
          dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
        } else if (typeof dateStr === 'string') {
          // If already in "DD MMM YYYY" format (e.g., "02 Jan 2025"), keep it as-is
          if (dateStr.match(/^\d{1,2}\s+\w{3}\s+\d{4}$/)) {
            // Keep the original format from Google Sheets
            dateStr = dateStr;
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // ISO date format (YYYY-MM-DD), convert to "DD MMM YYYY"
            const [year, month, day] = dateStr.split('-').map(Number);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
            }
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
            // ISO timestamp format (YYYY-MM-DDTHH:mm:ss.sssZ), extract date part and convert
            const datePart = dateStr.split('T')[0];
            const [year, month, day] = datePart.split('-').map(Number);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
            }
          } else {
            // For other formats, try to parse and convert
            try {
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = parsedDate.getMonth() + 1;
                const day = parsedDate.getDate();
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                dateStr = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
              }
            } catch (e) {
              // Keep original if parsing fails
            }
          }
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
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    const result = JSON.parse(responseText);
    
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
    
    if (responseText.includes('Sign in') || responseText.includes('Google Account')) {
      console.error('Google Apps Script requires authorization.');
      return [];
    }

    const result = JSON.parse(responseText);
    
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
    .filter(word => !/^(pvt|ltd|limited|private|inc|incorporated|llp|llc|and|the|of|for|to|in|on|at|by|with|from)$/i.test(word)); // Filter common business words
  
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

