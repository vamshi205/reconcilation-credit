// Import Google Sheets functions and interface
import { 
  fetchPartyMappingsFromSheets, 
  savePartyMappingToSheets, 
  updatePartyMappingInSheets,
  isGoogleSheetsConfigured,
  PartyNameMapping
} from './googleSheetsService';

// Re-export for backward compatibility
export type { PartyNameMapping };

// Cache for party mappings (loaded from Google Sheets)
let mappingsCache: PartyNameMapping[] = [];
let mappingsCacheTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

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
    
    // Then, try partial match - check if the party name contains or is contained in any learned pattern
    // This helps when we learned "sri raja rajeswari ortho" but the transaction has "sri raja rajeswari ortho plus"
    const normalizedWords = normalized.split(/\s+/).filter(w => w.length > 2);
    
    // Find mappings where the original name contains significant words from the party name
    for (const mapping of mappings) {
      const mappingNormalized = mapping.originalName.toLowerCase().replace(/\s+/g, " ");
      const mappingWords = mappingNormalized.split(/\s+/).filter(w => w.length > 2);
      
      // Check if there's significant overlap (at least 2 words match)
      const matchingWords = normalizedWords.filter(w => mappingWords.includes(w));
      if (matchingWords.length >= 2 && mappingWords.length >= 2) {
        // If the learned pattern is longer/more specific, use it
        if (mappingNormalized.length > normalized.length * 0.8) {
          return mapping.correctedName;
        }
      }
      
      // Also check if the party name contains the learned pattern
      if (normalized.includes(mappingNormalized) || mappingNormalized.includes(normalized)) {
        // Prefer the more specific/corrected name
        if (mapping.correctedName.length > normalized.length) {
          return mapping.correctedName;
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

    // Method 1: Extract from colons (CHQ DEP patterns)
    const colonPattern = desc.match(/:\s*([A-Z][A-Z\s\w]+?)\s*:/i);
    if (colonPattern && colonPattern[1]) {
      const extracted = colonPattern[1].trim().toLowerCase();
      if (extracted.length > 3 && extracted.length < 100) {
        extractedPatterns.push(extracted);
      }
    }

    // Method 2: Extract between transaction codes and account numbers
    const patterns = [
      /(?:NEFT|IMPS|RTGS|UPI|FT)\s*(?:CR|DR)?[\s\-]+[A-Z0-9]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z]{4,}|[A-Z]{2}\d{10,}|\d{10,})/i,
      /(?:NEFT|IMPS|RTGS|UPI|FT|CHQ)\s*(?:CR|DR)?[\s\-]+\d+[\s\-]+([A-Z][A-Z\s\w]+?)(?:\s*-\s*\d+|\s*$)/i,
      /(?:UPI|NEFT|IMPS)[\s\-]+[\d\-@]+[\s\-]+([A-Z][A-Z\s\w]+?)[\s\-]+(?:[A-Z0-9@]+|\d+)/i,
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

