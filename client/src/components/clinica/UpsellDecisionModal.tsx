import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

interface UpsellDecisionModalProps {
  open: boolean;
  onClose: () => void;
  onDecision: (decision: string, data: { productId?: string; price?: string; notes?: string }) => void;
  products: Array<{ id: string; name: string; price: string }>;
  patientName: string;
}

export default function UpsellDecisionModal({ open, onClose, onDecision, products, patientName }: UpsellDecisionModalProps) {
  const [decision, setDecision] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onDecision(decision, {
      productId: selectedProduct || undefined,
      price: price || undefined,
      notes: notes || undefined,
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setDecision("");
    setSelectedProduct("");
    setPrice("");
    setNotes("");
  };

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setPrice(product.price);
  };

  return (
    <Dialog open={open} onOpenChange={() => { resetForm(); onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple-400" />
            Decision de Upsell
          </DialogTitle>
          <DialogDescription>
            {patientName} - Selecciona la decision de upsell
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={decision === "completed" ? "default" : "outline"}
              className={decision === "completed" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => setDecision("completed")}
            >
              Acepto
            </Button>
            <Button
              variant={decision === "declined" ? "default" : "outline"}
              className={decision === "declined" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => setDecision("declined")}
            >
              Rechazo
            </Button>
            <Button
              variant={decision === "postponed" ? "default" : "outline"}
              className={decision === "postponed" ? "bg-amber-600 hover:bg-amber-700" : ""}
              onClick={() => setDecision("postponed")}
            >
              Pospuso
            </Button>
          </div>

          {decision === "completed" && (
            <>
              <div>
                <Label className="text-xs">Producto</Label>
                <Select value={selectedProduct} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - ${Number(p.price).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Precio Upsell</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!decision} className="bg-purple-600 hover:bg-purple-700">
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
