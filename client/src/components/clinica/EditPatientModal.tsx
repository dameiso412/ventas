import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { useState, useEffect } from "react";
import type { ClinicPatient } from "../../../../drizzle/schema";

interface EditPatientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  patient: ClinicPatient | null;
}

export default function EditPatientModal({ open, onClose, onSave, patient }: EditPatientModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [treatment, setTreatment] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (patient) {
      setName(patient.patientName);
      setEmail(patient.patientEmail || "");
      setPhone(patient.patientPhone || "");
      setTreatment(patient.treatmentType || "");
      setAmount(String(patient.initialAmount || "0"));
    }
  }, [patient]);

  const handleSave = () => {
    onSave({
      patientName: name,
      patientEmail: email || null,
      patientPhone: phone || null,
      treatmentType: treatment || null,
      initialAmount: amount || "0",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-pink-400" />
            Editar Paciente
          </DialogTitle>
          <DialogDescription>
            Modifica la informacion del paciente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Telefono</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tratamiento</Label>
            <Input value={treatment} onChange={e => setTreatment(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Monto Inicial</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name} className="bg-pink-600 hover:bg-pink-700">
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
