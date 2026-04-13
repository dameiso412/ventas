import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

const LOSS_CATEGORIES = [
  { value: "price", label: "Precio / Financiero" },
  { value: "timing", label: "Timing / No es el momento" },
  { value: "competition", label: "Eligio competencia" },
  { value: "no_show", label: "No se presento" },
  { value: "trust", label: "Falta de confianza" },
  { value: "results", label: "Expectativas de resultados" },
  { value: "other", label: "Otra razon" },
];

interface LossReasonModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { category: string; subcategory: string; lossType: string; notes?: string; estimatedValue?: string }) => void;
  patientName: string;
  lossType: "no_show" | "no_sale" | "cancelled";
}

export default function LossReasonModal({ open, onClose, onSubmit, patientName, lossType }: LossReasonModalProps) {
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

  const handleSubmit = () => {
    onSubmit({
      category,
      subcategory: category,
      lossType,
      notes: notes || undefined,
      estimatedValue: estimatedValue || undefined,
    });
    setCategory("");
    setNotes("");
    setEstimatedValue("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Razon de Perdida
          </DialogTitle>
          <DialogDescription>
            Registrar razon de perdida para {patientName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                {LOSS_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor Estimado Perdido</Label>
            <input
              type="number"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={estimatedValue}
              onChange={e => setEstimatedValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!category} className="bg-amber-600 hover:bg-amber-700">
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
