import { useState, useEffect } from "react";
import { SupplierMappingService, SupplierNameMapping } from "../services/supplierMappingService";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Edit2, Trash2, Sparkles, Check, X } from "lucide-react";
import { cn } from "../lib/utils";

export function SupplierMappings() {
  const [mappings, setMappings] = useState<SupplierNameMapping[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState<string>("");
  const [editCorrected, setEditCorrected] = useState<string>("");

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const allMappings = await SupplierMappingService.getMappingsByLastUsed();
      setMappings(allMappings);
    } catch (error) {
      console.error('Error loading supplier mappings:', error);
      setMappings([]);
    }
  };

  const handleStartEdit = (mapping: SupplierNameMapping) => {
    setEditingId(mapping.id);
    setEditOriginal(mapping.originalName);
    setEditCorrected(mapping.correctedName);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editOriginal.trim() || !editCorrected.trim()) return;

    try {
      await SupplierMappingService.updateMapping(editingId, {
        originalName: editOriginal.trim(),
        correctedName: editCorrected.trim(),
      });

      setEditingId(null);
      setEditOriginal("");
      setEditCorrected("");
      await loadMappings();
    } catch (error) {
      console.error('Error updating supplier mapping:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditOriginal("");
    setEditCorrected("");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this mapping?")) {
      try {
        await SupplierMappingService.deleteMapping(id);
        await loadMappings();
      } catch (error) {
        console.error('Error deleting supplier mapping:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-display font-bold text-gradient">
          Supplier Name Mappings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage learned supplier name corrections
          <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
            {mappings.length} mappings
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Learned Mappings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No mappings learned yet.</p>
              <p className="text-sm mt-2">
                Edit supplier names in the Transactions page to start learning mappings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {editingId === mapping.id ? (
                    <>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={editOriginal}
                          onChange={(e) => setEditOriginal(e.target.value)}
                          placeholder="Original name"
                          className="text-sm"
                        />
                        <Input
                          value={editCorrected}
                          onChange={(e) => setEditCorrected(e.target.value)}
                          placeholder="Corrected name"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="p-2 hover:bg-green-100 rounded"
                          title="Save"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-2 hover:bg-red-100 rounded"
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3">
                        <span className="font-medium text-muted-foreground">
                          {mapping.originalName}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-primary">
                          {mapping.correctedName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (Confidence: {mapping.confidence}/10)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(mapping)}
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(mapping.id)}
                          className="p-2 hover:bg-red-100 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Learning:</strong> When you edit a supplier name in
            the Transactions page, the system automatically learns the mapping.
          </p>
          <p>
            <strong className="text-foreground">Suggestions:</strong> When a transaction has a
            supplier name that matches a learned mapping, a suggestion badge appears.
          </p>
          <p>
            <strong className="text-foreground">Confidence:</strong> Each time you apply a
            suggestion, the confidence increases (up to 10).
          </p>
          <p>
            <strong className="text-foreground">Auto-apply:</strong> Mappings are automatically
            applied during CSV upload if a match is found.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

