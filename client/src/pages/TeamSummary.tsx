import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useStatusColors } from "@/hooks/useStatusColors";

const MESES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function mesShort(mes: string | null) {
  const idx = MESES.indexOf(mes ?? "");
  return idx >= 0 ? MESES_SHORT[idx] : mes ?? "";
}

export default function TeamSummary() {
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const { data: setterSummary, isLoading: sLoading } = trpc.teamSummary.setters.useQuery();
  const { data: closerSummary, isLoading: cLoading } = trpc.teamSummary.closers.useQuery();

  const setterChartData = (setterSummary || []).map(s => ({
    mes: mesShort(s.mes),
    Intentos: Number(s.totalIntentos),
    Intros: Number(s.totalIntros),
    Aseguradas: Number(s.totalAseguradas),
    Confirmadas: Number(s.totalConfirmadas),
    Asistidas: Number(s.totalAsistidas),
    Cierres: Number(s.totalCierres),
  }));

  const setterRevenueData = (setterSummary || []).map(s => ({
    mes: mesShort(s.mes),
    Revenue: Number(s.totalRevenue),
    Cash: Number(s.totalCash),
  }));

  const closerChartData = (closerSummary || []).map(c => ({
    mes: mesShort(c.mes),
    Schedule: Number(c.totalSchedule),
    Live: Number(c.totalLive),
    Offers: Number(c.totalOffers),
    Deposits: Number(c.totalDeposits),
    Closes: Number(c.totalCloses),
  }));

  const closerRevenueData = (closerSummary || []).map(c => ({
    mes: mesShort(c.mes),
    "PIFF Rev": Number(c.totalPiffRevenue),
    "PIFF Cash": Number(c.totalPiffCash),
    "Setup Rev": Number(c.totalSetupRevenue),
    "Setup Cash": Number(c.totalSetupCash),
  }));

  const closerRatesData = (closerSummary || []).map(c => ({
    mes: mesShort(c.mes),
    "Show%": Number(c.totalSchedule) > 0 ? Number(((Number(c.totalLive) / Number(c.totalSchedule)) * 100).toFixed(1)) : 0,
    "Offer%": Number(c.totalLive) > 0 ? Number(((Number(c.totalOffers) / Number(c.totalLive)) * 100).toFixed(1)) : 0,
    "Close%": Number(c.totalOffers) > 0 ? Number(((Number(c.totalCloses) / Number(c.totalOffers)) * 100).toFixed(1)) : 0,
  }));

  const setterRatesData = (setterSummary || []).map(s => ({
    mes: mesShort(s.mes),
    "Tasa Resp.": Number(s.totalIntentos) > 0 ? Number(((Number(s.totalIntros) / Number(s.totalIntentos)) * 100).toFixed(1)) : 0,
    "Tasa Asist.": Number(s.totalCalendario) > 0 ? Number(((Number(s.totalAsistidas) / Number(s.totalCalendario)) * 100).toFixed(1)) : 0,
  }));

  const ChartComponent = chartType === "line" ? LineChart : BarChart;
  const DataComponent = chartType === "line" ? Line : Bar;
  const ct = useChartTheme();
  const sc = useStatusColors();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Team Summary
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen mensual del equipo con tendencias por departamento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setChartType("line")} className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${chartType === "line" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            Líneas
          </button>
          <button onClick={() => setChartType("bar")} className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${chartType === "bar" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            Barras
          </button>
        </div>
      </div>

      <Tabs defaultValue="setters" className="w-full">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="setters">Setters</TabsTrigger>
          <TabsTrigger value="closers">Closers</TabsTrigger>
        </TabsList>

        <TabsContent value="setters" className="space-y-4 mt-4">
          {sLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando datos...</div>
          ) : setterChartData.length === 0 ? (
            <Card className="bg-card/50"><CardContent className="p-12 text-center text-muted-foreground">Sin datos de setters registrados</CardContent></Card>
          ) : (
            <>
              {/* Activity Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Tendencia de Actividad — Setters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <ChartComponent data={setterChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      {chartType === "line" ? (
                        <>
                          <Line type="monotone" dataKey="Intentos" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Intros" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Asistidas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Cierres" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="Intentos" fill="#a855f7" />
                          <Bar dataKey="Intros" fill="#3b82f6" />
                          <Bar dataKey="Asistidas" fill="#22c55e" />
                          <Bar dataKey="Cierres" fill="#f59e0b" />
                        </>
                      )}
                    </ChartComponent>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Rates Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tendencia de Tasas — Setters (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={setterRatesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      <Line type="monotone" dataKey="Tasa Resp." stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Tasa Asist." stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue y Cash — Setters ($)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={setterRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      <Bar dataKey="Revenue" fill="#f59e0b" />
                      <Bar dataKey="Cash" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Table */}
              <Card className="bg-card/50 border-border/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tabla Mensual — Setters</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intentos</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intros</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Aseguradas</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Confirmadas</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Asistidas</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Cierres</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Resp.</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Asist.</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(setterSummary || []).map(s => {
                        const tr = Number(s.totalIntentos) > 0 ? ((Number(s.totalIntros) / Number(s.totalIntentos)) * 100).toFixed(1) : "-";
                        const ta = Number(s.totalCalendario) > 0 ? ((Number(s.totalAsistidas) / Number(s.totalCalendario)) * 100).toFixed(1) : "-";
                        return (
                          <tr key={s.mes} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="p-3 font-medium">{s.mes}</td>
                            <td className="p-3 text-center">{Number(s.totalIntentos)}</td>
                            <td className="p-3 text-center">{Number(s.totalIntros)}</td>
                            <td className="p-3 text-center">{Number(s.totalAseguradas)}</td>
                            <td className="p-3 text-center">{Number(s.totalConfirmadas)}</td>
                            <td className="p-3 text-center">{Number(s.totalAsistidas)}</td>
                            <td className="p-3 text-center text-amber-400 font-medium">{Number(s.totalCierres)}</td>
                            <td className="p-3 text-center" style={{ color: tr !== "-" && Number(tr) >= 30 ? sc.good : sc.bad }}>{tr !== "-" ? `${tr}%` : "-"}</td>
                            <td className="p-3 text-center" style={{ color: ta !== "-" && Number(ta) >= 80 ? sc.good : sc.warning }}>{ta !== "-" ? `${ta}%` : "-"}</td>
                            <td className="p-3 text-right text-amber-400">${Number(s.totalRevenue).toLocaleString()}</td>
                            <td className="p-3 text-right text-green-400">${Number(s.totalCash).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      {(!setterSummary || setterSummary.length === 0) && (
                        <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Sin datos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="closers" className="space-y-4 mt-4">
          {cLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando datos...</div>
          ) : closerChartData.length === 0 ? (
            <Card className="bg-card/50"><CardContent className="p-12 text-center text-muted-foreground">Sin datos de closers registrados</CardContent></Card>
          ) : (
            <>
              {/* Activity Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Tendencia de Actividad — Closers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <ChartComponent data={closerChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      {chartType === "line" ? (
                        <>
                          <Line type="monotone" dataKey="Schedule" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Live" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Offers" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Closes" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="Schedule" fill="#a855f7" />
                          <Bar dataKey="Live" fill="#3b82f6" />
                          <Bar dataKey="Offers" fill="#f59e0b" />
                          <Bar dataKey="Closes" fill="#22c55e" />
                        </>
                      )}
                    </ChartComponent>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Rates Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tendencia de Tasas — Closers (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={closerRatesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      <Line type="monotone" dataKey="Show%" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Offer%" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Close%" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue y Cash por Producto — Closers ($)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={closerRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
                      <XAxis dataKey="mes" tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <YAxis tick={{ fill: ct.tickFill, fontSize: 12 }} />
                      <Tooltip contentStyle={ct.tooltip.contentStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Legend wrapperStyle={{ color: ct.legendColor }} />
                      <Bar dataKey="PIFF Rev" fill="#a855f7" />
                      <Bar dataKey="PIFF Cash" fill="#7c3aed" />
                      <Bar dataKey="Setup Rev" fill="#f59e0b" />
                      <Bar dataKey="Setup Cash" fill="#d97706" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Table */}
              <Card className="bg-card/50 border-border/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tabla Mensual — Closers</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Schedule</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Live</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Offers</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Deposits</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Closes</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Show%</th>
                        <th className="text-center p-3 font-medium text-muted-foreground text-xs">Close%</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(closerSummary || []).map(c => {
                        const sr = Number(c.totalSchedule) > 0 ? ((Number(c.totalLive) / Number(c.totalSchedule)) * 100).toFixed(1) : "-";
                        const cr = Number(c.totalOffers) > 0 ? ((Number(c.totalCloses) / Number(c.totalOffers)) * 100).toFixed(1) : "-";
                        const totalRev = Number(c.totalPiffRevenue) + Number(c.totalSetupRevenue);
                        const totalCash = Number(c.totalPiffCash) + Number(c.totalSetupCash);
                        return (
                          <tr key={c.mes} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="p-3 font-medium">{c.mes}</td>
                            <td className="p-3 text-center">{Number(c.totalSchedule)}</td>
                            <td className="p-3 text-center">{Number(c.totalLive)}</td>
                            <td className="p-3 text-center">{Number(c.totalOffers)}</td>
                            <td className="p-3 text-center">{Number(c.totalDeposits)}</td>
                            <td className="p-3 text-center text-green-400 font-medium">{Number(c.totalCloses)}</td>
                            <td className="p-3 text-center" style={{ color: sr !== "-" && Number(sr) >= 80 ? sc.good : sc.warning }}>{sr !== "-" ? `${sr}%` : "-"}</td>
                            <td className="p-3 text-center" style={{ color: cr !== "-" && Number(cr) >= 30 ? sc.good : sc.warning }}>{cr !== "-" ? `${cr}%` : "-"}</td>
                            <td className="p-3 text-right text-amber-400">${totalRev.toLocaleString()}</td>
                            <td className="p-3 text-right text-green-400">${totalCash.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      {(!closerSummary || closerSummary.length === 0) && (
                        <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Sin datos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
