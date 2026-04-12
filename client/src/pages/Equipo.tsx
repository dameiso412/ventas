import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, UserCheck, UserX, Users, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const ROL_LABELS: Record<string, string> = {
  SETTER: "Setter",
  CLOSER: "Closer",
  SETTER_CLOSER: "Setter & Closer",
};

const ROL_COLORS: Record<string, string> = {
  SETTER: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  CLOSER: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  SETTER_CLOSER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

export default function Equipo() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", rol: "SETTER" as string, correo: "", telefono: "" });

  const utils = trpc.useUtils();
  const { data: members = [], isLoading } = trpc.team.list.useQuery();

  const createMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      toast.success("Miembro agregado");
      utils.team.list.invalidate();
      setShowAdd(false);
      setForm({ nombre: "", rol: "SETTER", correo: "", telefono: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.team.update.useMutation({
    onSuccess: () => {
      toast.success("Miembro actualizado");
      utils.team.list.invalidate();
      setEditId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = (id: number, currentActive: boolean) => {
    updateMutation.mutate({ id, activo: !currentActive });
  };

  const startEdit = (m: any) => {
    setEditId(m.id);
    setForm({ nombre: m.nombre, rol: m.rol, correo: m.correo || "", telefono: m.telefono || "" });
  };

  const handleSave = () => {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form, rol: form.rol as any });
    } else {
      createMutation.mutate({ nombre: form.nombre, rol: form.rol as any, correo: form.correo || undefined, telefono: form.telefono || undefined });
    }
  };

  const activos = members.filter(m => m.activo);
  const inactivos = members.filter(m => !m.activo);

  const MemberForm = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Nombre</Label>
        <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo" />
      </div>
      <div>
        <Label className="text-xs">Rol</Label>
        <Select value={form.rol} onValueChange={v => setForm(p => ({ ...p, rol: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SETTER">Setter</SelectItem>
            <SelectItem value="CLOSER">Closer</SelectItem>
            <SelectItem value="SETTER_CLOSER">Setter & Closer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Correo (opcional)</Label>
          <Input value={form.correo} onChange={e => setForm(p => ({ ...p, correo: e.target.value }))} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <Label className="text-xs">Teléfono (opcional)</Label>
          <Input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="+56 9 1234 5678" />
        </div>
      </div>
      <Button onClick={handleSave} className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
        {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editId ? "Guardar Cambios" : "Agregar Miembro"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona los perfiles de setters y closers
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) { setEditId(null); setForm({ nombre: "", rol: "SETTER", correo: "", telefono: "" }); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo Miembro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Miembro" : "Nuevo Miembro del Equipo"}</DialogTitle>
            </DialogHeader>
            <MemberForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Setters</p>
          <p className="text-2xl font-bold mt-1 text-blue-400">
            {activos.filter(m => m.rol === "SETTER" || m.rol === "SETTER_CLOSER").length}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Closers</p>
          <p className="text-2xl font-bold mt-1 text-purple-400">
            {activos.filter(m => m.rol === "CLOSER" || m.rol === "SETTER_CLOSER").length}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Activos</p>
          <p className="text-2xl font-bold mt-1">{activos.length}</p>
        </Card>
      </div>

      {/* Active Members */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Cargando equipo...</div>
      ) : (
        <div className="space-y-2">
          {activos.map(m => (
            <Card key={m.id} className="p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {m.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.nombre}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 ${ROL_COLORS[m.rol]}`}>
                    {ROL_LABELS[m.rol]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {m.correo && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.correo}</span>
                  )}
                  {m.telefono && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.telefono}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { startEdit(m); setShowAdd(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => toggleActive(m.id, true)}
                >
                  <UserX className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Inactive Members */}
      {inactivos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <UserX className="h-4 w-4" /> Inactivos
          </h2>
          {inactivos.map(m => (
            <Card key={m.id} className="p-4 flex items-center gap-4 opacity-50 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                {m.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">{m.nombre}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 opacity-50">
                    {ROL_LABELS[m.rol]}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-400"
                onClick={() => toggleActive(m.id, false)}
              >
                <UserCheck className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
