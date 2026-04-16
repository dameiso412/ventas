/**
 * Dashboard > Citas — Appointments report sub-tab.
 *
 * 12-card KPI grid with counts for every estadoConfirmacion + asistencia state
 * plus daily averages, and a stacked bar timeline showing confirmed/canceled/
 * rescheduled per day.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CalendarDays, CalendarCheck, CalendarX, CalendarClock, UserCheck, UserX,
  AlertTriangle, Sparkles, TrendingUp, Clock, Ban, RefreshCw,
} from "lucide-react";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import { useChartTheme } from "@/hooks/useChartTheme";

function KPI({ title, value, subtitle, icon: Icon, tint }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  tint?: "primary" | "green" | "red" | "amber" | "blue" | "violet";
}) {
  const tintClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-500",
    red: "bg-rose-500/10 text-rose-500",
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-sky-500/10 text-sky-500",
    violet: "bg-violet-500/10 text-violet-500",
  };
  const cls = tintClasses[tint ?? "primary"];
  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardCitas() {
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const chartTheme = useChartTheme();

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data, isLoading } = trpc.dashboard.citasReport.useQuery(filters);

  const t = data?.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Informe de Citas</h1>
          <p className="text-sm text-muted-foreground">Breakdown de citas por estado de confirmación y asistencia.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[140px] bg-card/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[130px] bg-card/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {[1, 2, 3, 4, 5].map(s => <SelectItem key={s} value={String(s)}>Semana {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPI title="Total citas" value={t?.total ?? 0} icon={CalendarDays} tint="primary" />
          <KPI title="Confirmadas" value={t?.confirmadas ?? 0} icon={CalendarCheck} tint="green" />
          <KPI title="Pendiente conf." value={t?.pendienteConfirmacion ?? 0} icon={Clock} tint="amber" />
          <KPI title="No confirmadas" value={t?.noConfirmadas ?? 0} icon={Ban} tint="amber" />
          <KPI title="Canceladas" value={t?.canceladas ?? 0} icon={CalendarX} tint="red" />
          <KPI title="Reagendadas" value={t?.reagendadas ?? 0} icon={RefreshCw} tint="blue" />
          <KPI title="Asistieron" value={t?.asistidas ?? 0} icon={UserCheck} tint="green" />
          <KPI title="No show" value={t?.noShow ?? 0} icon={UserX} tint="red" />
          <KPI title="Pendiente asist." value={t?.pendienteAsistencia ?? 0} icon={Clock} tint="amber" />
          <KPI title="Inválidas" value={t?.invalidas ?? 0} icon={AlertTriangle} tint="red" />
          <KPI title="Nuevas hoy" value={t?.nuevasHoy ?? 0} icon={Sparkles} tint="violet" />
          <KPI
            title="Promedio diario"
            value={(t?.promedioDiarioTotal ?? 0).toFixed(1)}
            subtitle={`${(t?.promedioDiarioConfirmadas ?? 0).toFixed(1)} confirm./día`}
            icon={TrendingUp}
            tint="primary"
          />
        </div>
      )}

      {/* Timeline chart */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Timeline de citas por día</CardTitle>
          <p className="text-xs text-muted-foreground">
            Stacked bar: confirmadas · canceladas · reagendadas. Solo días con citas en el periodo.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data || data.timeline.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              No hay citas con fecha en el periodo seleccionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.timeline} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="date" stroke={chartTheme.tickFill} fontSize={11} />
                <YAxis stroke={chartTheme.tickFill} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltip.contentStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.legendColor }} />
                <Bar dataKey="confirmadas" stackId="a" fill="#10b981" name="Confirmadas" />
                <Bar dataKey="canceladas" stackId="a" fill="#ef4444" name="Canceladas" />
                <Bar dataKey="reagendadas" stackId="a" fill="#3b82f6" name="Reagendadas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
