import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import {
  Flame, Thermometer, Plus, Phone, MessageCircle, Mail,
  Instagram, Facebook, ExternalLink, Clock, DollarSign,
  CheckCircle2, XCircle, ArrowRight, Trash2, Pencil,
  AlertTriangle, Calendar, Send, Users, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { useStatusColors } from "@/hooks/useStatusColors";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

type FollowUp = {
  id: number;
  leadId: number | null;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  instagram: string | null;
  facebook: string | null;
  tipo: "HOT" | "WARM";
  prioridad: "RED_HOT" | "HOT" | "WARM" | "COLD";
  estado: "ACTIVO" | "CERRADO_GANADO" | "CERRADO_PERDIDO" | "MOVIDO_A_WARM" | "ARCHIVADO";
  ultimaObjecion: string | null;
  montoEstimado: string | null;
  productoInteres: "PIF" | "SETUP_MONTHLY" | "POR_DEFINIR" | null;
  ultimoFollowUp: string | null;
  proximoFollowUp: string | null;
  totalFollowUps: number | null;
  closerAsignado: string | null;
  notas: string | null;
  linkCRM: string | null;
  creadoDesde: string;
  createdAt: string;
  updatedAt: string;
};

// ==================== KPI Card ====================
function KPICard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string | number; icon: any; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{title}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// ==================== Priority Badge ====================
function PriorityBadge({ prioridad }: { prioridad: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    RED_HOT: { bg: "bg-red-500/20 dark:bg-red-500/20", text: "text-red-700 dark:text-red-400", label: "RED HOT" },
    HOT: { bg: "bg-amber-500/20 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", label: "HOT" },
    WARM: { bg: "bg-blue-500/20 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-400", label: "WARM" },
    COLD: { bg: "bg-slate-500/20 dark:bg-slate-500/20", text: "text-slate-700 dark:text-slate-400", label: "COLD" },
  };
  const c = config[prioridad] || config.HOT;
  return <Badge variant="outline" className={`${c.bg} ${c.text} border-0 font-semibold text-[10px]`}>{c.label}</Badge>;
}

// ==================== Urgency Indicator ====================
function UrgencyIndicator({ proximoFollowUp }: { proximoFollowUp: string | null }) {
  if (!proximoFollowUp) return <span className="text-xs text-muted-foreground">Sin fecha</span>;
  const next = new Date(proximoFollowUp);
  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 animate-pulse" />
        <span className="text-xs font-semibold text-red-700 dark:text-red-400">Vencido ({Math.abs(diffDays)}d)</span>
      </div>
    );
  }
  if (diffDays === 0) {
    return (
      <div className="flex items-center gap-1">
        <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">HOY</span>
      </div>
    );
  }
  if (diffDays <= 2) {
    return (
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
        <span className="text-xs text-amber-700 dark:text-amber-400">{diffDays}d</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{diffDays}d</span>
    </div>
  );
}

// ==================== Log Activity Dialog ====================
function LogActivityDialog({ followUp, onSuccess }: { followUp: FollowUp; onSuccess: () => void }) {
  const [accion, setAccion] = useState<string>("LLAMADA");
  const [detalle, setDetalle] = useState("");
  const [open, setOpen] = useState(false);
  const logMutation = trpc.followUps.logActivity.useMutation({
    onSuccess: () => {
      toast.success("Actividad registrada");
      setDetalle("");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const acciones = [
    { value: "LLAMADA", label: "Llamada", icon: Phone },
    { value: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
    { value: "EMAIL", label: "Email", icon: Mail },
    { value: "DM_INSTAGRAM", label: "DM Instagram", icon: Instagram },
    { value: "DM_FACEBOOK", label: "DM Facebook", icon: Facebook },
    { value: "NOTA", label: "Nota interna", icon: Pencil },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <Send className="h-3 w-3" /> Log
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar Follow-Up: {followUp.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {acciones.map(a => (
              <button
                key={a.value}
                onClick={() => setAccion(a.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition-all ${
                  accion === a.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <a.icon className="h-4 w-4" />
                {a.label}
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs">Detalle / Notas</Label>
            <Textarea
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
              placeholder="¿Qué pasó? ¿Cuál fue la respuesta? ¿Próximo paso?"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
          <Button
            size="sm"
            onClick={() => logMutation.mutate({
              followUpId: followUp.id,
              accion: accion as any,
              detalle: detalle || undefined,
            })}
            disabled={logMutation.isPending}
          >
            {logMutation.isPending ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Quick Edit Dialog ====================
function QuickEditDialog({ followUp, onSuccess }: { followUp: FollowUp; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ultimaObjecion: followUp.ultimaObjecion || "",
    montoEstimado: followUp.montoEstimado || "0",
    productoInteres: followUp.productoInteres || "POR_DEFINIR",
    proximoFollowUp: (() => {
      if (!followUp.proximoFollowUp) return "";
      try {
        const d = new Date(String(followUp.proximoFollowUp));
        return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      } catch { return ""; }
    })(),
    closerAsignado: followUp.closerAsignado || "",
    notas: followUp.notas || "",
    prioridad: followUp.prioridad,
  });

  const updateMutation = trpc.followUps.update.useMutation({
    onSuccess: () => {
      toast.success("Follow-up actualizado");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const data: any = { ...form };
    if (data.proximoFollowUp) {
      data.proximoFollowUp = new Date(data.proximoFollowUp + "T10:00:00");
    } else {
      delete data.proximoFollowUp;
    }
    updateMutation.mutate({ id: followUp.id, data });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) setForm({
        ultimaObjecion: followUp.ultimaObjecion || "",
        montoEstimado: followUp.montoEstimado || "0",
        productoInteres: followUp.productoInteres || "POR_DEFINIR",
        proximoFollowUp: (() => {
          if (!followUp.proximoFollowUp) return "";
          try {
            const d = new Date(String(followUp.proximoFollowUp));
            return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
          } catch { return ""; }
        })(),
        closerAsignado: followUp.closerAsignado || "",
        notas: followUp.notas || "",
        prioridad: followUp.prioridad,
      });
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Editar: {followUp.nombre}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={v => setForm(f => ({ ...f, prioridad: v as any }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RED_HOT">RED HOT</SelectItem>
                  <SelectItem value="HOT">HOT</SelectItem>
                  <SelectItem value="WARM">WARM</SelectItem>
                  <SelectItem value="COLD">COLD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Producto de Interés</Label>
              <Select value={form.productoInteres} onValueChange={v => setForm(f => ({ ...f, productoInteres: v as "PIF" | "SETUP_MONTHLY" | "POR_DEFINIR" }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIF">PIF (Pago Completo)</SelectItem>
                  <SelectItem value="SETUP_MONTHLY">Setup + Monthly</SelectItem>
                  <SelectItem value="POR_DEFINIR">Por Definir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Monto Estimado ($)</Label>
              <Input type="number" value={form.montoEstimado} onChange={e => setForm(f => ({ ...f, montoEstimado: e.target.value }))} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">Próximo Follow-Up</Label>
              <Input type="date" value={form.proximoFollowUp} onChange={e => setForm(f => ({ ...f, proximoFollowUp: e.target.value }))} className="mt-1 h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Closer Asignado</Label>
            <TeamMemberSelect value={form.closerAsignado} onValueChange={v => setForm(f => ({ ...f, closerAsignado: v }))} role="CLOSER" placeholder="Seleccionar closer" className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs">Última Objeción</Label>
            <Textarea value={form.ultimaObjecion} onChange={e => setForm(f => ({ ...f, ultimaObjecion: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="¿Cuál fue la última objeción?" />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="Notas adicionales..." />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Create Follow-Up Dialog ====================
function CreateFollowUpDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: "", correo: "", telefono: "", instagram: "", facebook: "",
    tipo: "HOT" as "HOT" | "WARM",
    prioridad: "HOT" as "RED_HOT" | "HOT" | "WARM" | "COLD",
    ultimaObjecion: "", montoEstimado: "0",
    productoInteres: "POR_DEFINIR" as "PIF" | "SETUP_MONTHLY" | "POR_DEFINIR",
    proximoFollowUp: "",
    closerAsignado: "",
    notas: "", linkCRM: "",
  });

  const createMutation = trpc.followUps.create.useMutation({
    onSuccess: () => {
      toast.success("Follow-up creado");
      setOpen(false);
      setForm({
        nombre: "", correo: "", telefono: "", instagram: "", facebook: "",
        tipo: "HOT", prioridad: "HOT", ultimaObjecion: "", montoEstimado: "0",
        productoInteres: "POR_DEFINIR", proximoFollowUp: "",
        closerAsignado: "", notas: "", linkCRM: "",
      });
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    const data: any = { ...form };
    if (data.proximoFollowUp) {
      data.proximoFollowUp = new Date(data.proximoFollowUp + "T10:00:00");
    } else {
      delete data.proximoFollowUp;
    }
    // Clean empty strings
    Object.keys(data).forEach(k => { if (data[k] === "") delete data[k]; });
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo Follow-Up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="mt-1 h-9" placeholder="Nombre del contacto" />
            </div>
            <div>
              <Label className="text-xs">Correo</Label>
              <Input value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="mt-1 h-9" placeholder="email@ejemplo.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className="mt-1 h-9" placeholder="+52..." />
            </div>
            <div>
              <Label className="text-xs">Instagram</Label>
              <Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} className="mt-1 h-9" placeholder="@usuario" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Lista</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">Hot List</SelectItem>
                  <SelectItem value="WARM">Warm List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={v => setForm(f => ({ ...f, prioridad: v as any }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RED_HOT">RED HOT</SelectItem>
                  <SelectItem value="HOT">HOT</SelectItem>
                  <SelectItem value="WARM">WARM</SelectItem>
                  <SelectItem value="COLD">COLD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Producto</Label>
              <Select value={form.productoInteres} onValueChange={v => setForm(f => ({ ...f, productoInteres: v as any }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIF">PIF</SelectItem>
                  <SelectItem value="SETUP_MONTHLY">Setup + Monthly</SelectItem>
                  <SelectItem value="POR_DEFINIR">Por Definir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Monto Estimado ($)</Label>
              <Input type="number" value={form.montoEstimado} onChange={e => setForm(f => ({ ...f, montoEstimado: e.target.value }))} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">Próximo Follow-Up</Label>
              <Input type="date" value={form.proximoFollowUp} onChange={e => setForm(f => ({ ...f, proximoFollowUp: e.target.value }))} className="mt-1 h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Closer Asignado</Label>
            <TeamMemberSelect value={form.closerAsignado} onValueChange={v => setForm(f => ({ ...f, closerAsignado: v }))} role="CLOSER" placeholder="Seleccionar closer" className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs">Última Objeción</Label>
            <Textarea value={form.ultimaObjecion} onChange={e => setForm(f => ({ ...f, ultimaObjecion: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="¿Cuál fue la objeción principal?" />
          </div>
          <div>
            <Label className="text-xs">Link CRM (GHL)</Label>
            <Input value={form.linkCRM} onChange={e => setForm(f => ({ ...f, linkCRM: e.target.value }))} className="mt-1 h-9" placeholder="https://app.gohighlevel.com/..." />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className="mt-1 text-sm" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
          <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creando..." : "Crear Follow-Up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Follow-Up Row ====================
function FollowUpRow({ fu, onRefresh }: { fu: FollowUp; onRefresh: () => void }) {
  const colors = useStatusColors();
  const utils = trpc.useUtils();

  const updateMutation = trpc.followUps.update.useMutation({
    onSuccess: () => {
      utils.followUps.list.invalidate();
      utils.followUps.stats.invalidate();
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.followUps.delete.useMutation({
    onSuccess: () => {
      toast.success("Follow-up eliminado");
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleMarkClosed = (won: boolean) => {
    updateMutation.mutate({
      id: fu.id,
      data: { estado: won ? "CERRADO_GANADO" : "CERRADO_PERDIDO" },
    });
    toast.success(won ? "Marcado como cerrado (ganado)" : "Marcado como cerrado (perdido)");
  };

  const handleMoveToWarm = () => {
    updateMutation.mutate({
      id: fu.id,
      data: { tipo: "WARM", estado: "MOVIDO_A_WARM" },
    });
    toast.success("Movido a Warm List");
  };

  const handleMoveToHot = () => {
    updateMutation.mutate({
      id: fu.id,
      data: { tipo: "HOT", estado: "ACTIVO" },
    });
    toast.success("Movido a Hot List");
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
      {/* Name + Contact */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <PriorityBadge prioridad={fu.prioridad} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{fu.nombre || "Sin nombre"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {fu.telefono && (
                <a href={`https://wa.me/${fu.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener"
                  className="text-[10px] text-green-600 dark:text-green-400 hover:underline flex items-center gap-0.5">
                  <MessageCircle className="h-2.5 w-2.5" /> WA
                </a>
              )}
              {fu.instagram && (
                <a href={fu.instagram.startsWith("http") ? fu.instagram : `https://instagram.com/${fu.instagram.replace("@", "")}`}
                  target="_blank" rel="noopener"
                  className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-0.5">
                  <Instagram className="h-2.5 w-2.5" /> IG
                </a>
              )}
              {fu.linkCRM && (
                <a href={fu.linkCRM} target="_blank" rel="noopener"
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <ExternalLink className="h-2.5 w-2.5" /> CRM
                </a>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Objeción */}
      <td className="py-2.5 px-3 max-w-[200px]">
        <p className="text-xs text-muted-foreground truncate" title={fu.ultimaObjecion || ""}>
          {fu.ultimaObjecion || <span className="italic opacity-50">Sin objeción</span>}
        </p>
      </td>

      {/* Monto */}
      <td className="py-2.5 px-3 text-right">
        <span className="text-sm font-medium" style={{ color: colors.primary }}>
          ${parseFloat(fu.montoEstimado || "0").toLocaleString()}
        </span>
        <p className="text-[10px] text-muted-foreground">
          {fu.productoInteres === "PIF" ? "PIF" : fu.productoInteres === "SETUP_MONTHLY" ? "Setup+Mo" : "—"}
        </p>
      </td>

      {/* Last FU */}
      <td className="py-2.5 px-3 text-center">
        <span className="text-xs text-muted-foreground">{formatDate(fu.ultimoFollowUp)}</span>
        {fu.totalFollowUps ? (
          <p className="text-[10px] text-muted-foreground">#{fu.totalFollowUps}</p>
        ) : null}
      </td>

      {/* Next FU */}
      <td className="py-2.5 px-3 text-center">
        <UrgencyIndicator proximoFollowUp={fu.proximoFollowUp} />
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(fu.proximoFollowUp)}</p>
      </td>

      {/* Closer */}
      <td className="py-2.5 px-3 text-center">
        <span className="text-xs">{fu.closerAsignado || "—"}</span>
      </td>

      {/* Actions */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
          <LogActivityDialog followUp={fu} onSuccess={onRefresh} />
          <QuickEditDialog followUp={fu} onSuccess={onRefresh} />
          {fu.tipo === "HOT" ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleMoveToWarm} title="Mover a Warm List">
              <ArrowRight className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-amber-600 dark:text-amber-400" onClick={handleMoveToHot} title="Mover a Hot List">
              <Flame className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-green-600 dark:text-green-400" onClick={() => handleMarkClosed(true)} title="Cerrado Ganado">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-600 dark:text-red-400" onClick={() => handleMarkClosed(false)} title="Cerrado Perdido">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground hover:text-destructive" onClick={() => {
            if (confirm("¿Eliminar este follow-up?")) deleteMutation.mutate({ id: fu.id });
          }} title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ==================== Follow-Up Table ====================
function FollowUpTable({ data, onRefresh, emptyMessage }: {
  data: FollowUp[];
  onRefresh: () => void;
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacto</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Última Objeción</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Monto</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Último FU</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Próximo FU</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Closer</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map(fu => <FollowUpRow key={fu.id} fu={fu} onRefresh={onRefresh} />)}
        </tbody>
      </table>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function FollowUps() {
  const colors = useStatusColors();
  const [tab, setTab] = useState("hot");
  const [closerFilter, setCloserFilter] = useState("all");

  const { data: allFollowUps = [], isLoading, refetch } = trpc.followUps.list.useQuery({ estado: "ACTIVO" });
  const { data: stats } = trpc.followUps.stats.useQuery();

  const handleRefresh = () => { refetch(); };

  // Split into Hot and Warm lists
  const hotList = useMemo(() => {
    let list = (allFollowUps as FollowUp[]).filter(f => f.tipo === "HOT");
    if (closerFilter !== "all") list = list.filter(f => f.closerAsignado === closerFilter);
    // Sort: overdue first, then by next FU date
    return list.sort((a, b) => {
      const aDate = a.proximoFollowUp ? new Date(a.proximoFollowUp).getTime() : Infinity;
      const bDate = b.proximoFollowUp ? new Date(b.proximoFollowUp).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [allFollowUps, closerFilter]);

  const warmList = useMemo(() => {
    let list = (allFollowUps as FollowUp[]).filter(f => f.tipo === "WARM");
    if (closerFilter !== "all") list = list.filter(f => f.closerAsignado === closerFilter);
    return list.sort((a, b) => {
      const aDate = a.proximoFollowUp ? new Date(a.proximoFollowUp).getTime() : Infinity;
      const bDate = b.proximoFollowUp ? new Date(b.proximoFollowUp).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [allFollowUps, closerFilter]);

  // Count overdue
  const now = new Date();
  const overdueHot = hotList.filter(f => f.proximoFollowUp && new Date(f.proximoFollowUp) < now).length;
  const overdueWarm = warmList.filter(f => f.proximoFollowUp && new Date(f.proximoFollowUp) < now).length;

  const totalPipeline = (allFollowUps as FollowUp[]).reduce(
    (sum, f) => sum + parseFloat(f.montoEstimado || "0"), 0
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted/30 rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-xl" />)}
        </div>
        <div className="h-96 bg-muted/30 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-Up Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema E-ID: Hot List (diaria) + Warm List (semanal) — Follow-up es dinero gratis
          </p>
        </div>
        <CreateFollowUpDialog onSuccess={handleRefresh} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard title="Hot List" value={stats?.hotCount ?? 0} icon={Flame} color={colors.warning} subtitle={overdueHot > 0 ? `${overdueHot} vencidos` : "Al día"} />
        <KPICard title="Warm List" value={stats?.warmCount ?? 0} icon={Thermometer} color={colors.info} subtitle={overdueWarm > 0 ? `${overdueWarm} vencidos` : "Al día"} />
        <KPICard title="Pipeline Total" value={`$${totalPipeline.toLocaleString()}`} icon={DollarSign} color={colors.primary} subtitle={`${stats?.totalActivos ?? 0} activos`} />
        <KPICard title="Cerrados (Ganados)" value={stats?.cerradosGanados ?? 0} icon={CheckCircle2} color={colors.good} />
        <KPICard title="Cerrados (Perdidos)" value={stats?.cerradosPerdidos ?? 0} icon={XCircle} color={colors.bad} />
        <KPICard title="Vencidos Hoy" value={stats?.vencidos ?? 0} icon={AlertTriangle} color={(stats?.vencidos ?? 0) > 0 ? colors.bad : colors.good} subtitle="Necesitan acción" />
      </div>

      {/* Closer Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground">Filtrar por Closer:</Label>
        <TeamMemberSelect value={closerFilter} onValueChange={setCloserFilter} role="CLOSER" includeAll allLabel="Todos" className="w-40 h-8 text-xs" />
      </div>

      {/* Tabs: Hot List / Warm List */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/30 border border-border/30">
          <TabsTrigger value="hot" className="gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400">
            <Flame className="h-3.5 w-3.5" />
            Hot List
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{hotList.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="warm" className="gap-1.5 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">
            <Thermometer className="h-3.5 w-3.5" />
            Warm List
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{warmList.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot" className="mt-4">
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-amber-500" />
                    Hot List — Limpiar TODOS LOS DÍAS
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contactos con alta probabilidad de cerrar en los próximos 7 días. Revisar y contactar cada uno diariamente.
                  </p>
                </div>
                {overdueHot > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {overdueHot} vencidos
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <FollowUpTable data={hotList} onRefresh={handleRefresh} emptyMessage="No hay follow-ups en la Hot List. Agrega contactos que puedan cerrar esta semana." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warm" className="mt-4">
          <Card className="border-blue-500/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-blue-500" />
                    Warm List — Limpiar 1x por Semana (Sábado, 2 horas)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contactos a 30+ días de decisión. Enviar mensaje personalizado semanal: "Hey NAME, ¿resolviste PROBLEMA?"
                  </p>
                </div>
                {overdueWarm > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-0">
                    {overdueWarm} pendientes
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <FollowUpTable data={warmList} onRefresh={handleRefresh} emptyMessage="No hay follow-ups en la Warm List. Mueve aquí contactos que necesitan más tiempo." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Philosophy Reminder */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Filosofía E-ID: Follow-Up = Dinero Gratis</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                La mayoría de los closers piensan que están "por encima" del follow-up. La realidad es que el follow-up sistemático
                es la fuente de ingresos más fácil. <strong>Hot List:</strong> contactar TODOS los días, sin excepción.
                <strong> Warm List:</strong> bloquear 2 horas el sábado para mensajes personalizados. No usar plantillas genéricas —
                personalizar basándose en la última objeción y situación del contacto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
