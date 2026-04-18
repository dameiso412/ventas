/**
 * Prospección > Tracker — réplica del sheet "Tracker DM en Frío" (doc 4).
 *
 * Matriz 12 columnas (Ene…Dic) + Total × N filas:
 *
 *   Volúmenes (5 filas):
 *     Initiated (A), Message Seen (MS), Interested (B), Calendly (C), Booked (D)
 *
 *   Ratios principales (5 filas):
 *     MSR (MS/A), PRR (B/MS), CSR (C/A), ABR (D/A), CAR (Fo.Acc/Fo.Sent)
 *
 *   Transiciones (2 filas):
 *     B → C (C/B), C → D (D/C)
 *
 * Semáforo por celda de ratio vs umbral de `prospecting_goals` — verde/amarillo/rojo.
 *
 * Export CSV: estructura plana que se pega tal cual en Excel/Sheets.
 *
 * Filtros:
 *   - Año — default año actual, últimos 5 años seleccionables.
 *   - Setter — admin elige cualquiera o "Todos" (sin filtro); setter ve su propio nombre fijo.
 *
 * Gating: setterProcedure.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableProperties, Download, AlertTriangle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";

// ==================== Constants ====================

const MESES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

// ==================== Types ====================

type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

type MonthRow = {
  month: number;
  a: number; ms: number; b: number; c: number; d: number;
  followsSent: number; followsAccepted: number;
  likes: number; comments: number;
  msr: number | null;
  prr: number | null;
  csr: number | null;
  abr: number | null;
  car: number | null;
  bToC: number | null;
  cToD: number | null;
};

type RatioKey = "msr" | "prr" | "csr" | "abr" | "car" | "bToC" | "cToD";

type RowDef = {
  key: string;
  label: string;
  type: "volume" | "ratio";
  getter: (m: MonthRow) => number | null;
  thresholdKey?: "msr_min" | "prr_min" | "csr_min" | "abr_min" | "car_min";
  hint?: string;
};

const ROWS: RowDef[] = [
  { key: "a",  label: "Initiated (A)",      type: "volume", getter: (m) => m.a,   hint: "DMs Trojan Horse enviados" },
  { key: "ms", label: "Message Seen (MS)",  type: "volume", getter: (m) => m.ms,  hint: "DMs con ✓✓ azul" },
  { key: "b",  label: "Interested (B)",     type: "volume", getter: (m) => m.b,   hint: "Respuestas positivas / permiso" },
  { key: "c",  label: "Calendly Sent (C)",  type: "volume", getter: (m) => m.c,   hint: "Enlaces Calendly enviados" },
  { key: "d",  label: "Booked (D)",         type: "volume", getter: (m) => m.d,   hint: "Citas reservadas" },
  { key: "msr", label: "MSR (A → MS)",      type: "ratio",  getter: (m) => m.msr,  thresholdKey: "msr_min", hint: "MS / A · mín 40%" },
  { key: "prr", label: "PRR (MS → B)",      type: "ratio",  getter: (m) => m.prr,  thresholdKey: "prr_min", hint: "B / MS · mín 6%" },
  { key: "csr", label: "CSR (C / A)",       type: "ratio",  getter: (m) => m.csr,  thresholdKey: "csr_min", hint: "C / A · mín 3%" },
  { key: "abr", label: "ABR (D / A)",       type: "ratio",  getter: (m) => m.abr,  thresholdKey: "abr_min", hint: "D / A · mín 2%" },
  { key: "car", label: "CAR (Follows)",     type: "ratio",  getter: (m) => m.car,  thresholdKey: "car_min", hint: "Aceptados / Enviados · mín 50%" },
  { key: "bToC", label: "B → C",            type: "ratio",  getter: (m) => m.bToC, hint: "C / B — cuántos interesados reciben Calendly" },
  { key: "cToD", label: "C → D",            type: "ratio",  getter: (m) => m.cToD, hint: "D / C — cuántos Calendly se convierten en cita" },
];

// ==================== Helpers ====================

function getSemaforo(value: number | null, threshold: number | null): Semaforo {
  if (value === null || threshold === null || threshold <= 0) return "gris";
  if (value >= threshold) return "verde";
  if (value >= threshold * 0.75) return "amarillo";
  return "rojo";
}

const SEMAFORO_CELL: Record<Semaforo, string> = {
  verde:    "text-emerald-500",
  amarillo: "text-amber-500",
  rojo:     "text-rose-500",
  gris:     "text-muted-foreground",
};

function formatPercent(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatCount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0";
  return v.toLocaleString("es-CL");
}

/**
 * Build CSV text from the breakdown. Quotes strings with commas, escapes
 * embedded quotes. Adds a header block with year+setter context.
 */
function buildCsv(
  year: number,
  setterLabel: string,
  months: MonthRow[],
  total: MonthRow,
): string {
  const esc = (s: string | number | null): string => {
    if (s === null) return "";
    const str = String(s);
    if (/[,"\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines: string[] = [];
  lines.push(`Año,${esc(year)}`);
  lines.push(`Setter,${esc(setterLabel)}`);
  lines.push("");
  // Header row
  lines.push(["Métrica", ...MESES_CORTO, "Total"].map(esc).join(","));
  // Data rows
  for (const row of ROWS) {
    const cells: string[] = [esc(row.label)];
    for (const m of months) {
      const v = row.getter(m);
      if (row.type === "ratio") {
        cells.push(v === null ? "" : `${v.toFixed(2)}%`);
      } else {
        cells.push(v === null ? "" : String(v));
      }
    }
    const tv = row.getter(total);
    if (row.type === "ratio") {
      cells.push(tv === null ? "" : `${tv.toFixed(2)}%`);
    } else {
      cells.push(tv === null ? "" : String(tv));
    }
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==================== Main page ====================

export default function ProspeccionTracker() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const ownName = user?.name ?? "";
  const { setters } = useTeamMembers();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  // Setter — "" = Todos (sin filtro). Setter sees only their own name locked.
  const [selectedSetter, setSelectedSetter] = useState<string>(isAdmin ? "" : ownName);

  const effectiveSetter = isAdmin ? (selectedSetter || undefined) : (ownName || undefined);

  const { data, isLoading } = trpc.prospecting.monthlyBreakdown.useQuery({
    year,
    setter: effectiveSetter,
  });

  const { data: goals } = trpc.prospecting.listGoals.useQuery();

  const thresholdMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of goals ?? []) {
      const v = parseFloat(String(g.value));
      if (Number.isFinite(v)) map[g.key] = v;
    }
    return map;
  }, [goals]);

  const setterLabel = effectiveSetter ?? "Todos";

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const handleExport = () => {
    if (!data) return;
    const csv = buildCsv(year, setterLabel, data.months as MonthRow[], data.total as MonthRow);
    const fname = `prospeccion-tracker-${year}-${setterLabel.replace(/\s+/g, "_").toLowerCase()}.csv`;
    downloadCsv(fname, csv);
  };

  const totalA = data?.total.a ?? 0;
  const lowVolume = totalA > 0 && totalA < 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-primary" />
            Tracker mensual
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Matriz 12 meses × volumen y ratios — réplica del sheet Cold DM System. Export CSV para mantener Excel en paralelo.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-9 bg-card/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin ? (
            <Select value={selectedSetter || "__todos"} onValueChange={(v) => setSelectedSetter(v === "__todos" ? "" : v)}>
              <SelectTrigger className="w-[200px] h-9 bg-card/50">
                <SelectValue placeholder="Setter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos los setters</SelectItem>
                {setters.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="h-9 px-3 text-sm border-primary/30">
              {ownName || "Sin nombre"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data || isLoading}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Low-volume warning */}
      {lowVolume && (
        <div className="text-xs flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Muestra chica:</strong> en {year} se registraron {totalA} DMs Trojan Horse. El doc 2 recomienda ≥100 para que los ratios dejen de ser ruido estadístico.
          </div>
        </div>
      )}

      {/* Matrix */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Actividad {year} · {setterLabel}</span>
            {isLoading && <span className="text-xs text-muted-foreground">Cargando…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !data ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/20 z-10 min-w-[180px]">
                      Métrica
                    </th>
                    {MESES_CORTO.map((m, idx) => {
                      const isCurrent = idx + 1 === (new Date().getMonth() + 1) && year === currentYear;
                      return (
                        <th
                          key={m}
                          className={`text-right px-2 py-2 font-semibold text-xs uppercase tracking-wider min-w-[64px] ${
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          }`}
                          title={MESES_LARGO[idx]}
                        >
                          {m}
                        </th>
                      );
                    })}
                    <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-primary bg-primary/5 min-w-[80px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, rowIdx) => {
                    const prev = ROWS[rowIdx - 1];
                    // Divider between volume block and ratio block
                    const boundary = prev && prev.type !== row.type;
                    const threshold = row.thresholdKey ? (thresholdMap[row.thresholdKey] ?? null) : null;
                    return (
                      <tr
                        key={row.key}
                        className={`hover:bg-muted/20 transition-colors ${
                          boundary ? "border-t-2 border-border/60" : "border-b border-border/30"
                        }`}
                      >
                        <td className="px-3 py-2 sticky left-0 bg-card/50 backdrop-blur z-10">
                          <div className="flex flex-col">
                            <span className={`font-medium text-sm ${row.type === "ratio" ? "text-foreground/90" : ""}`}>
                              {row.label}
                            </span>
                            {row.hint && (
                              <span className="text-[10px] text-muted-foreground/70">{row.hint}</span>
                            )}
                          </div>
                        </td>
                        {(data.months as MonthRow[]).map((m) => {
                          const v = row.getter(m);
                          const isCurrent = m.month === (new Date().getMonth() + 1) && year === currentYear;
                          if (row.type === "ratio") {
                            const sem = getSemaforo(v, threshold);
                            return (
                              <td
                                key={m.month}
                                className={`text-right px-2 py-2 tabular-nums ${SEMAFORO_CELL[sem]} ${isCurrent ? "bg-primary/5" : ""}`}
                              >
                                {formatPercent(v)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={m.month}
                              className={`text-right px-2 py-2 tabular-nums ${v === 0 ? "text-muted-foreground" : "text-foreground"} ${isCurrent ? "bg-primary/5" : ""}`}
                            >
                              {formatCount(v)}
                            </td>
                          );
                        })}
                        {/* Total column */}
                        {(() => {
                          const totalRow = data.total as MonthRow;
                          const v = row.getter(totalRow);
                          if (row.type === "ratio") {
                            const sem = getSemaforo(v, threshold);
                            return (
                              <td className={`text-right px-3 py-2 font-bold tabular-nums bg-primary/5 ${SEMAFORO_CELL[sem]}`}>
                                {formatPercent(v)}
                              </td>
                            );
                          }
                          return (
                            <td className={`text-right px-3 py-2 font-bold tabular-nums bg-primary/5`}>
                              {formatCount(v)}
                            </td>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥ umbral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> ≥ 75% del umbral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> bajo umbral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> sin datos
        </span>
      </div>
    </div>
  );
}
