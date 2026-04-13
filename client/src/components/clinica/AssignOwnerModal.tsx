import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { useState } from "react";

interface AssignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (ownerId: string) => void;
  members: Array<{ userId: string; displayName: string | null; role: string }>;
  patientName: string;
}

export default function AssignOwnerModal({ open, onClose, onAssign, members, patientName }: AssignOwnerModalProps) {
  const [selectedOwner, setSelectedOwner] = useState("");

  const handleAssign = () => {
    if (selectedOwner) {
      onAssign(selectedOwner);
      setSelectedOwner("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-pink-400" />
            Asignar Responsable
          </DialogTitle>
          <DialogDescription>
            Selecciona quien sera el responsable de {patientName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedOwner} onValueChange={setSelectedOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar miembro..." />
            </SelectTrigger>
            <SelectContent>
              {members.map(m => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.displayName || m.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedOwner} className="bg-pink-600 hover:bg-pink-700">
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
