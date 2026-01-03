// Import Google Sheets functions and interface
import { 
  fetchSupplierMappingsFromSheets, 
  saveSupplierMappingToSheets, 
  updateSupplierMappingInSheets,
  isGoogleSheetsConfigured,
  SupplierNameMapping,
  fetchSuppliersFromSheets,
  findMatchingParties
} from './googleSheetsService';

// Re-export for backward compatibility
export type { SupplierNameMapping };

// Cache for supplier mappings (loaded from Google Sheets)
let mappingsCache: SupplierNameMapping[] = [];
let mappingsCacheTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Cache for suppliers list (loaded from Google Sheets)
let suppliersCache: string[] = [];
let suppliersCacheTime: number = 0;
const SUPPLIERS_CACHE_DURATION = 300000; // 5 minutes cache (suppliers list changes less frequently)

export class SupplierMappingService {
  /**
   * Get all supplier name mappings from Google Sheets
   */
  static async getMappings(): Promise<SupplierNameMapping[]> {
    // Use cache if available and fresh
    const now = Date.now();
    if (mappingsCache.length > 0 && (now - mappingsCacheTime) < CACHE_DURATION) {
      return mappingsCache;
    }

    if (isGoogleSheetsConfigured()) {
      try {
        mappingsCache = await fetchSupplierMappingsFromSheets();
        mappingsCacheTime = now;
        return mappingsCache;
      } catch (error) {
        console.error('Error fetching supplier mappings from Google Sheets:', error);
        return mappingsCache; // Return cached data on error
      }
    }
    
    return [];
  }

  /**
   * Save all mappings (saves to Google Sheets)
   */
  static async saveMappings(mappings: SupplierNameMapping[]): Promise<void> {
    mappingsCache = mappings;
    mappingsCacheTime = Date.now();
    
    if (isGoogleSheetsConfigured()) {
      // Save each mapping to Google Sheets
      for (const mapping of mappings) {
        await saveSupplierMappingToSheets(mapping);
      }
    }
  }

  /**
   * Get mapping for a specific original name (async)
   */
  static async getMapping(originalName: string): Promise<SupplierNameMapping | undefined> {
    if (!originalName) return undefined;
    
    const mappings = await this.getMappings();
    const normalized = originalName.trim().toLowerCase().replace(/\s+/g, " ");
    return mappings.find(
      (m) => m.originalName.toLowerCase().replace(/\s+/g, " ") === normalized
    );
  }

  /**
   * Get all suppliers from Google Sheets (cached)
   */
  static async getSuppliers(): Promise<string[]> {
    const now = Date.now();
    if (suppliersCache.length > 0 && (now - suppliersCacheTime) < SUPPLIERS_CACHE_DURATION) {
      return suppliersCache;
    }

    if (isGoogleSheetsConfigured()) {
      try {
        suppliersCache = await fetchSuppliersFromSheets();
        suppliersCacheTime = now;
        return suppliersCache;
      } catch (error) {
        console.error('Error fetching suppliers from Google Sheets:', error);
        return suppliersCache; // Return cached data on error
      }
    }
    
    return [];
  }

  /**
   * Find supplier names from narration using word-by-word matching against suppliers list
   * Returns top 2-3 matches
   */
  static async findSuppliersFromNarration(narration: string, maxMatches: number = 3): Promise<string[]> {
    if (!narration || narration.trim().length < 5) return [];
    
    const suppliers = await this.getSuppliers();
    if (suppliers.length === 0) return [];
    
    // Use word-by-word matching to find top matches
    return findMatchingParties(narration, suppliers, maxMatches);
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
    const normalizedWords = normalized.split(/\s+/).filter(w => w.length > 3);
    
    for (const mapping of mappings) {
      const mappingNormalized = mapping.originalName.toLowerCase().replace(/\s+/g, " ");
      const mappingWords = mappingNormalized.split(/\s+/).filter(w => w.length > 3);
      
      if (normalized.includes(mappingNormalized) || mappingNormalized.includes(normalized)) {
        const matchingWords = normalizedWords.filter(w => mappingWords.includes(w));
        const totalSignificantWords = Math.max(normalizedWords.length, mappingWords.length);
        const overlapRatio = matchingWords.length / totalSignificantWords;
        
        if (overlapRatio >= 0.5 && matchingWords.length >= 2) {
          return mapping.correctedName;
        }
      }
      
      if (normalizedWords.length >= 2 && mappingWords.length >= 2) {
        const matchingWords = normalizedWords.filter(w => mappingWords.includes(w));
        const minWords = Math.min(normalizedWords.length, mappingWords.length);
        if (matchingWords.length >= Math.ceil(minWords * 0.75) && matchingWords.length >= 2) {
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
   */
  static async learnMapping(originalName: string, correctedName: string): Promise<void> {
    if (!originalName || !correctedName) return;
    
    const normalizedOriginal = originalName.trim().toLowerCase().replace(/\s+/g, " ");
    const normalizedCorrected = correctedName.trim();
    
    if (normalizedOriginal === normalizedCorrected.toLowerCase()) return;

    const mappings = await this.getMappings();
    const existingIndex = mappings.findIndex(
      (m) => m.originalName.toLowerCase().replace(/\s+/g, " ") === normalizedOriginal
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = mappings[existingIndex];
      if (existing.correctedName.toLowerCase() !== normalizedCorrected.toLowerCase()) {
        mappings[existingIndex] = {
          ...existing,
          correctedName: normalizedCorrected,
          confidence: Math.min(existing.confidence + 1, 10),
          lastUsed: now,
        };
        await updateSupplierMappingInSheets(mappings[existingIndex]);
      } else {
        mappings[existingIndex] = {
          ...existing,
          confidence: Math.min(existing.confidence + 1, 10),
          lastUsed: now,
        };
        await updateSupplierMappingInSheets(mappings[existingIndex]);
      }
    } else {
      const newMapping: SupplierNameMapping = {
        id: `supplier_mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalName: originalName.trim(),
        correctedName: normalizedCorrected,
        confidence: 1,
        lastUsed: now,
        createdAt: now,
      };
      mappings.push(newMapping);
      await saveSupplierMappingToSheets(newMapping);
    }

    mappingsCache = mappings;
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
    updates: Partial<Pick<SupplierNameMapping, "originalName" | "correctedName">>
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
      await updateSupplierMappingInSheets(mappings[index]);
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
  static async getMappingsByConfidence(): Promise<SupplierNameMapping[]> {
    const mappings = await this.getMappings();
    return mappings.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get mappings sorted by last used (most recent first) - async
   */
  static async getMappingsByLastUsed(): Promise<SupplierNameMapping[]> {
    const mappings = await this.getMappings();
    return mappings.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }
}

