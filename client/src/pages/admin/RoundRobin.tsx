/**
 * /admin/round-robin — config UI del Weighted Round-Robin de agendas.
 *
 * Tres bloques verticales:
 *   1. Header: estado activo/inactivo de la regla AGENDA_NUEVA + toggle.
 *   2. Distribución actual: tabla con Target % vs Real % por setter, contador
 *      de asignaciones, y badge ⬅ próximo en el setter al que le toca según
 *      el algoritmo (preview read-only).
 *   3. Editor de targets: lista de setters seleccionables del team.list y
 *      su % editable. Σ debe ser 100, "Guardar" deshabilitado si no.
 *   4. Histórico: últimos 50 assignments para auditar.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Users, AlertTriangle, ListChecks } from "lucide-react";

const EVENT_TYPE = "AGENDA_NUEVA";

interface TargetDraft {
  // Drizzle row id (existe solo si ya estaba persistido).
  id?: number;
  setterName: string;
  percentage: number;
  activo: number;
}

export default function RoundRobin() {
  const utils = trpc.useUtils();

  const rulesQuery = trpc.roundRobin.listRules.useQuery();
  const rule = rulesQuery.data?.find((r) => r.eventType === EVENT_TYPE);

  const statsQuery = trpc.roundRobin.stats.useQuery(
    { ruleId: rule?.id ?? 0 },
    { enabled: !!rule?.id, staleTime: 30 * 1000 }
  );

  const previewQuery = trpc.roundRobin.preview.useQuery(
    { eventType: EVENT_TYPE },
    { enabled: !!rule?.id && rule?.activo === 1, staleTime: 30 * 1000 }
  );

  const historyQuery = trpc.roundRobin.history.useQuery(
    { ruleId: rule?.id ?? 0, limit: 50 },
    { enabled: !!rule?.id, staleTime: 30 * 1000 }
  );

  const teamQuery = trpc.team.list.useQuery({});

  // Drafts locales de targets — el editor edita esta lista, "Guardar" hace
  // setTargets que reemplaza todo en la DB.
  const [drafts, setDrafts] = useState<TargetDraft[] | null>(null);

  // Inicializa los drafts cuando la rule carga la primera vez (o cuando cambian
  // los targets en DB después de un save).
  useEffect(() => {
    if (rule) {
      setDrafts(rule.targets.map((t) => ({
        id: t.id, setterName: t.setterName, percentage: t.percentage, activo: t.activo,
      })));
    }
  }, [rule?.id, rule?.targets.map((t) => `${t.id}:${t.percentage}:${t.activo}`).join("|")]);

  const updateRule = trpc.roundRobin.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Regla actualizada");
      utils.roundRobin.listRules.invalidate();
      utils.roundRobin.preview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setTargetsMutation = trpc.roundRobin.setTargets.useMutation({
    onSuccess: () => {
      toast.success("Targets guardados");
      utils.roundRobin.listRules.invalidate();
      utils.roundRobin.stats.invalidate();
      utils.roundRobin.preview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const settersDisponibles = useMemo(() => {
    return (teamQuery.data ?? []).filter((m) =>
      (m.rol === "SETTER" || m.rol === "SETTER_CLOSER") && m.activo
    );
  }, [teamQuery.data]);

  const sumActiva = (drafts ?? []).filter((d) => d.activo === 1).reduce((a, b) => a + (b.percentage || 0), 0);
  const sumOk = (drafts ?? []).every((d) => d.activo !== 1) || sumActiva === 100;

  const addRow = () => {
    setDrafts((prev) => [...(prev ?? []), { setterName: "", percentage: 0, activo: 1 }]);
  };
  const removeRow = (idx: number) => {
    setDrafts((prev) => (prev ?? []).filter((_, i) => i !== idx));
  };
  const updateRow = (idx: number, patch: Partial<TargetDraft>) => {
    setDrafts((prev) => (prev ?? []).map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  const handleSave = () => {
    if (!rule) return;
    if (!sumOk) {
      toast.error(`La suma de % activos debe ser 100. Actual: ${sumActiva}.`);
      return;
    }
    const targets = (drafts ?? [])
      .filter((d) => d.setterName.trim().length > 0)
      .map((d) => ({
        setterName: d.setterName.trim(),
        percentage: Number(d.percentage) || 0,
        activo: d.activo,
      }));
    setTargetsMutation.mutate({ ruleId: rule.id, targets });
  };

  const handleToggleRule = () => {
    if (!rule) return;
    updateRule.mutate({ id: rule.id, activo: rule.activo === 1 ? 0 : 1 });
  };

  if (rulesQuery.isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando...</div>;
  }

  if (!rule) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No se encontró la regla AGENDA_NUEVA. Verificá que la migración 0012 corrió y el seed se insertó.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = rule.activo === 1;
  const stats = statsQuery.data ?? [];
  const totalAsignadas = stats.reduce((a, s) => a + s.count, 0);
  const previewSetter = previewQuery.data?.setterName ?? null;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* HEADER */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Round-Robin de Agendas
            {isActive ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">Activo</Badge>
            ) : (
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground text-xs">Inactivo</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{isActive ? "Asignando" : "Pausado"}</span>
            <Switch checked={isActive} onCheckedChange={handleToggleRule} />
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isActive
            ? "Cada agenda nueva (DEMO/INTRO) que entra al CRM via webhook se asigna a un setter según los % configurados."
            : "Las agendas se crean sin setter asignado (legacy). Activá para empezar a distribuir automáticamente."}
        </CardContent>
      </Card>

      {/* DISTRIBUCIÓN ACTUAL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Distribución actual
            <span className="text-xs text-muted-foreground font-normal">— {totalAsignadas} agendas distribuidas</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Setter</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Target %</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Real %</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Asignadas</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sin asignaciones todavía.</td></tr>
                )}
                {stats.map((s) => (
                  <tr key={s.setterName} className="border-b border-border/30">
                    <td className="py-2 px-3 font-medium">
                      {s.setterName}
                      {!s.activo && <Badge variant="outline" className="ml-2 text-[10px]">inactivo</Badge>}
                    </td>
                    <td className="text-right py-2 px-3">{s.percentageTarget}%</td>
                    <td className="text-right py-2 px-3 text-muted-foreground">{s.percentageReal.toFixed(1)}%</td>
                    <td className="text-right py-2 px-3">{s.count}</td>
                    <td className="py-2 px-3">
                      {previewSetter === s.setterName && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">⬅ próximo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* EDITOR DE TARGETS */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Setters y porcentajes</CardTitle>
          <div className={`text-xs ${sumOk ? "text-emerald-400" : "text-red-400"}`}>
            Σ activos = {sumActiva}% {sumOk ? "✓" : "(debe ser 100)"}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(drafts ?? []).map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Switch
                checked={d.activo === 1}
                onCheckedChange={(v) => updateRow(idx, { activo: v ? 1 : 0 })}
              />
              <Select value={d.setterName} onValueChange={(v) => updateRow(idx, { setterName: v })}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Seleccionar setter..." />
                </SelectTrigger>
                <SelectContent>
                  {settersDisponibles.map((s) => (
                    <SelectItem key={s.id} value={s.nombre}>{s.nombre}</SelectItem>
                  ))}
                  {/* Fallback: si el target ya guardado tiene un nombre que ya no
                      existe en team_members (renombre/desactivado), permitirlo
                      como opción para no perder la fila. */}
                  {d.setterName && !settersDisponibles.some((s) => s.nombre === d.setterName) && (
                    <SelectItem value={d.setterName}>
                      {d.setterName} <span className="text-muted-foreground">(no en equipo)</span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number" min={0} max={100}
                value={d.percentage}
                onChange={(e) => updateRow(idx, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Agregar setter
            </Button>
            <Button onClick={handleSave} disabled={!sumOk || setTargetsMutation.isPending}>
              {setTargetsMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            La suma de % de los setters <em>activos</em> debe ser 100. Setters inactivos quedan sin participar pero no se eliminan (por si los reactivás).
          </p>
        </CardContent>
      </Card>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Histórico (últimos 50)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Asignado</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Setter</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sin historial.</td></tr>
                )}
                {(historyQuery.data ?? []).map((h) => (
                  <tr key={h.id} className="border-b border-border/30">
                    <td className="py-2 px-3 text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 px-3">#{h.leadId} {h.leadNombre ? `· ${h.leadNombre}` : ""}</td>
                    <td className="py-2 px-3">{h.setterName}</td>
                    <td className="py-2 px-3 text-muted-foreground">{h.tipo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
