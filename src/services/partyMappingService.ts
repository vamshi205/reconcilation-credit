// Import Google Sheets functions and interface
import { 
  fetchPartyMappingsFromSheets, 
  savePartyMappingToSheets, 
  updatePartyMappingInSheets,
  isGoogleSheetsConfigured,
  PartyNameMapping,
  fetchPartiesFromSheets,
  findMatchingParties
} from './googleSheetsService';

// Re-export for backward compatibility
export type { PartyNameMapping };

// Cache for party mappings (loaded from Google Sheets)
let mappingsCache: PartyNameMapping[] = [];
let mappingsCacheTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Cache for parties list (loaded from Google Sheets)
let partiesCache: string[] = [];
let partiesCacheTime: number = 0;
const PARTIES_CACHE_DURATION = 300000; // 5 minutes cache (parties list changes less frequently)

export class PartyMappingService {
  /**
   * Get all party name mappings from Google Sheets
   */
  static async getMappings(): Promise<PartyNameMapping[]> {
    // Use cache if available and fresh
    const now = Date.now();
    if (mappingsCache.length > 0 && (now - mappingsCacheTime) < CACHE_DURATION) {
      return mappingsCache;
    }

    if (isGoogleSheetsConfigured()) {
      try {
        mappingsCache = await fetchPartyMappingsFromSheets();
        mappingsCacheTime = now;
        return mappingsCache;
      } catch (error) {
        console.error('Error fetching party mappings from Google Sheets:', error);
        return mappingsCache; // Return cached data on error
      }
    }
    
    return [];
  }

  /**
   * Save all mappings (saves to Google Sheets)
   */
  static async saveMappings(mappings: PartyNameMapping[]): Promise<void> {
    mappingsCache = mappings;
    mappingsCacheTime = Date.now();
    
    if (isGoogleSheetsConfigured()) {
      // Save each mapping to Google Sheets
      for (const mapping of mappings) {
        await savePartyMappingToSheets(mapping);
      }
    }
  }

  /**
   * Get mapping for a specific original name (async)
   */
  static async getMapping(originalName: string): Promise<PartyNameMapping | undefined> {
    if (!originalName) return undefined;
    
    const mappings = await this.getMappings();
    const normalized = originalName.trim().toLowerCase().replace(/\s+/g, " ");
    return mappings.find(
      (m) => m.originalName.toLowerCase().replace(/\s+/g, " ") === normalized
    );
  }

  /**
   * Get all parties from Google Sheets (cached)
   */
  static async getParties(): Promise<string[]> {
    const now = Date.now();
    if (partiesCache.length > 0 && (now - partiesCacheTime) < PARTIES_CACHE_DURATION) {
      return partiesCache;
    }

    if (isGoogleSheetsConfigured()) {
      try {
        partiesCache = await fetchPartiesFromSheets();
        partiesCacheTime = now;
        return partiesCache;
      } catch (error) {
        console.error('Error fetching parties from Google Sheets:', error);
        return partiesCache; // Return cached data on error
      }
    }
    
    return [];
  }

  /**
   * Find party names from narration using word-by-word matching against parties list
   * Returns top 2-3 matches
   */
  static async findPartiesFromNarration(narration: string, maxMatches: number = 3): Promise<string[]> {
    if (!narration || narration.trim().length < 5) return [];
    
    const parties = await this.getParties();
    if (parties.length === 0) return [];
    
    // Use word-by-word matching to find top matches
    return findMatchingParties(narration, parties, maxMatches);
  }

  /**
   * Get suggested name for an original name (async)
   * Checks for exact match first, then partial matches
   */
  static async getSuggestedName(originalName: string): Promise<string | null> {
    if (!originalName) return null;
    
    // Normalize the input for lookup
    const normalized = originalName.trim().toLowerCase().replace(/\s+/g, " ");
    const mappings = await this.getMappings();
    
    // First, try exact match
    const exactMatch = mappings.find(
      (m) => m.originalName.toLowerCase().replace(/\s+/g, " ") === normalized
    );
    if (exactMatch) {
      return exactMatch.correctedName;
    }
    
    // Then, try partial match - but be very strict to avoid false positives
    // Only suggest if the extracted name is clearly similar to a learned pattern
    // This helps when we learned "sri raja rajeswari ortho" but the transaction has "sri raja rajeswari ortho plus"
    const normalizedWords = normalized.split(/\s+/).filter(w => w.length > 3); // Only consider words longer than 3 chars
    
    // Find mappings where the original name is clearly similar to the extracted name
    for (const mapping of mappings) {
      const mappingNormalized = mapping.originalName.toLowerCase().replace(/\s+/g, " ");
      const mappingWords = mappingNormalized.split(/\s+/).filter(w => w.length > 3);
      
      // STRICT MATCHING: Only suggest if:
      // 1. The extracted name contains the learned pattern (e.g., "ortho plus" contains "ortho")
      // 2. OR the learned pattern contains the extracted name (e.g., "ortho" is in "ortho plus")
      // 3. AND they share at least 50% of significant words
      if (normalized.includes(mappingNormalized) || mappingNormalized.includes(normalized)) {
        // Check word overlap to ensure they're actually similar
        const matchingWords = normalizedWords.filter(w => mappingWords.includes(w));
        const totalSignificantWords = Math.max(normalizedWords.length, mappingWords.length);
        const overlapRatio = matchingWords.length / totalSignificantWords;
        
        // Only suggest if there's at least 50% word overlap AND at least 2 matching words
        if (overlapRatio >= 0.5 && matchingWords.length >= 2) {
          return mapping.correctedName;
        }
      }
      
      // Also check for very close matches (e.g., "archana hospitals" vs "archana hospitals pvt ltd")
      // But only if they share most of their words
      if (normalizedWords.length >= 2 && mappingWords.length >= 2) {
        const matchingWords = normalizedWords.filter(w => mappingWords.includes(w));
        const minWords = Math.min(normalizedWords.length, mappingWords.length);
        // Require at least 75% of words to match for very similar names
        if (matchingWords.length >= Math.ceil(minWords * 0.75) && matchingWords.length >= 2) {
          // Additional check: the names should be similar in length (within 50% difference)
          const lengthRatio = Math.min(normalized.length, mappingNormalized.length) / 
                             Math.max(normalized.length, mappingNormalized.length);
          if (lengthRatio >= 0.5) {
            return mapping.correctedName;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Learn a new mapping or update existing one (async)
   * When user edits party name from "vamshi" to "krishna", this is called
   */
  static async learnMapping(originalName: string, correctedName: string): Promise<void> {
    if (!originalName || !correctedName) return;
    
    // Normalize both names for comparison
    const normalizedOriginal = originalName.trim().toLowerCase().replace(/\s+/g, " ");
    const normalizedCorrected = correctedName.trim();
    
    if (normalizedOriginal === normalizedCorrected.toLowerCase()) return; // No change needed

    const mappings = await this.getMappings();
    const existingIndex = mappings.findIndex(
      (m) => m.originalName.toLowerCase().replace(/\s+/g, " ") === normalizedOriginal
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing mapping - increase confidence
      const existing = mappings[existingIndex];
      // Only update if the corrected name is different
      if (existing.correctedName.toLowerCase() !== normalizedCorrected.toLowerCase()) {
        mappings[existingIndex] = {
          ...existing,
          correctedName: normalizedCorrected,
          confidence: Math.min(existing.confidence + 1, 10), // Cap at 10
          lastUsed: now,
        };
        // Update in Google Sheets
        await updatePartyMappingInSheets(mappings[existingIndex]);
      } else {
        // Same correction, just update confidence and last used
        mappings[existingIndex] = {
          ...existing,
          confidence: Math.min(existing.confidence + 1, 10),
          lastUsed: now,
        };
        // Update in Google Sheets
        await updatePartyMappingInSheets(mappings[existingIndex]);
      }
    } else {
      // Create new mapping
      const newMapping: PartyNameMapping = {
        id: `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalName: originalName.trim(), // Keep original case for display
        correctedName: normalizedCorrected,
        confidence: 1,
        lastUsed: now,
        createdAt: now,
      };
      mappings.push(newMapping);
      // Save to Google Sheets
      await savePartyMappingToSheets(newMapping);
    }

    // Update cache and invalidate to force refresh on next getMappings call
    // This ensures new mappings are immediately available for suggestions
    mappingsCache = mappings;
    mappingsCacheTime = 0; // Invalidate cache so next call fetches fresh data from Google Sheets
    
    // Invalidate cache to force refresh on next getMappings call
    // This ensures new mappings are immediately available
    mappingsCacheTime = 0;
  }

  /**
   * Apply mapping to a name (returns corrected name if mapping exists) - async
   */
  static async applyMapping(name: string): Promise<string> {
    const suggested = await this.getSuggestedName(name);
    return suggested || name;
  }

  /**
   * Delete a mapping (async)
   */
  static async deleteMapping(id: string): Promise<void> {
    const mappings = await this.getMappings();
    const filtered = mappings.filter((m) => m.id !== id);
    mappingsCache = filtered;
    mappingsCacheTime = Date.now();
    await this.saveMappings(filtered);
  }

  /**
   * Update a mapping (async)
   */
  static async updateMapping(
    id: string,
    updates: Partial<Pick<PartyNameMapping, "originalName" | "correctedName">>
  ): Promise<void> {
    const mappings = await this.getMappings();
    const index = mappings.findIndex((m) => m.id === id);
    if (index >= 0) {
      mappings[index] = {
        ...mappings[index],
        ...updates,
        lastUsed: new Date().toISOString(),
      };
      mappingsCache = mappings;
      mappingsCacheTime = Date.now();
      await updatePartyMappingInSheets(mappings[index]);
      await this.saveMappings(mappings);
    }
  }

  /**
   * Check if a name has a mapping (async)
   */
  static async hasMapping(name: string): Promise<boolean> {
    const mapping = await this.getMapping(name);
    return mapping !== undefined;
  }

  /**
   * Get mappings sorted by confidence (highest first) - async
   */
  static async getMappingsByConfidence(): Promise<PartyNameMapping[]> {
    const mappings = await this.getMappings();
    return mappings.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get mappings sorted by last used (most recent first) - async
   */
  static async getMappingsByLastUsed(): Promise<PartyNameMapping[]> {
    const mappings = await this.getMappings();
    return mappings.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }

  /**
   * AUTOMATIC TRAINING: Extract and learn patterns from narration automatically (async)
   * This trains the system from narrations even when party name is blank
   * When a party name is later added, the system will have already learned patterns
   */
  static async autoTrainFromNarration(narration: string, partyName?: string): Promise<void> {
    if (!narration || narration.trim().length < 5) return;

    const desc = narration.trim();
    
    // Extract potential party names from narration
    const extractedPatterns: string[] = [];

    // Method 1: Extract from colons (CHQ DEP patterns like "CHQ DEP - HYDERABAD - CTS CLG2 - WBO HYD: COMPANY NAME :BANK")
    const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w&]+?)\s*:/i);
    if (colonPattern && colonPattern[1]) {
      const extracted = colonPattern[1].trim().toLowerCase();
      // Filter out common bank names and locations
      const excludeWords = ['union bank', 'state bank', 'canara bank', 'punjab national', 'hyderabad', 'wbo', 'cts', 'clg'];
      const shouldExclude = excludeWords.some(word => extracted.includes(word));
      if (!shouldExclude && extracted.length > 3 && extracted.length < 100) {
        extractedPatterns.push(extracted);
      }
    }

    // Method 2: Extract from NEFT/IMPS patterns (NEFT CR-XXXX-COMPANY NAME-XXXX)
    // Pattern: NEFT CR-XXXX-COMPANY NAME-XXXX or NEFT CR-XXXX-COMPANY NAME-ACCOUNT
    const neftPattern1 = desc.match(/(?:NEFT|IMPS|RTGS)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2,4}\d{6,}|SRI\s+RAJA|SRI\s+RAJESHWARI)/i);
    if (neftPattern1 && neftPattern1[1]) {
      const extracted = neftPattern1[1].trim().toLowerCase();
      if (extracted.length > 3 && extracted.length < 100 && !extracted.includes('sri raja')) {
        extractedPatterns.push(extracted);
      }
    }

    // Method 3: Extract between transaction codes and account numbers (enhanced patterns)
    const patterns = [
      // NEFT CR-XXXX-COMPANY NAME-SRI RAJA... or NEFT CR-XXXX-COMPANY NAME-ACCOUNT
      /(?:NEFT|IMPS|RTGS)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:SRI\s+RAJA|SRI\s+RAJESHWARI|[A-Z]{2,4}\d{6,})/i,
      // CHQ DEP patterns with company name before bank name
      /CHQ\s+DEP[^:]*:\s*([A-Z][A-Z\s\w&]+?)\s*:[A-Z\s]+BANK/i,
      // UPI patterns
      /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w&]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
      // Generic pattern for transactions with company names
      /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w&]+?)(?:\s*-\s*\d+|\s*$)/i,
    ];

    for (const pattern of patterns) {
      const match = desc.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim().toLowerCase();
        if (extracted.length > 3 && extracted.length < 100 && !extractedPatterns.includes(extracted)) {
          extractedPatterns.push(extracted);
        }
      }
    }

    // Method 3: Extract meaningful parts
    const parts = desc
      .split(/[\s\-:]+/)
      .filter(p => p.length > 2)
      .filter(p => !/^\d+$/.test(p))
      .filter(p => !/^[A-Z]{2,4}\d+$/.test(p))
      .filter(p => !/^[A-Z]{2,4}N\d+$/.test(p))
      .filter(p => !/^\d{10,}$/.test(p))
      .filter(p => !/^[A-Z0-9@]+$/.test(p) && p.length > 5)
      .filter(p => !/^(NEFT|IMPS|RTGS|UPI|FT|CHQ|CR|DR|DEP|HYDERABAD|CTS|CLG|WBO|HYD|TPT|SRR)$/i.test(p));

    // Extract sequences of 2-4 words that look like party names
    for (let i = 0; i < parts.length - 1; i++) {
      for (let len = 2; len <= 4 && i + len <= parts.length; len++) {
        const phrase = parts.slice(i, i + len).join(" ").toLowerCase();
        if (phrase.length > 5 && phrase.length < 80 && !extractedPatterns.includes(phrase)) {
          extractedPatterns.push(phrase);
        }
      }
    }

    // Method 4: Clean full description
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

    if (cleanedDesc.length > 5 && !extractedPatterns.includes(cleanedDesc)) {
      extractedPatterns.push(cleanedDesc);
    }

    // If party name is provided, learn all extracted patterns
    if (partyName && partyName.trim()) {
      const finalPartyName = partyName.trim();
      for (const pattern of extractedPatterns) {
        if (pattern.length > 3) {
          await this.learnMapping(pattern, finalPartyName);
        }
      }
      console.log(`🤖 Auto-trained from narration: ${extractedPatterns.length} patterns → "${finalPartyName}"`);
    } else {
      // Even without party name, store potential patterns for future learning
      // When user later adds party name, these patterns will be available
      extractedPatterns.forEach((pattern) => {
        if (pattern.length > 5) {
          // Store as a "potential" mapping with low confidence
          // This helps the system recognize similar patterns later
          const existing = this.getMapping(pattern);
          if (!existing) {
            // Don't create mapping without party name, but we can track patterns
            // This will be learned when party name is added
          }
        }
      });
    }
  }
}

