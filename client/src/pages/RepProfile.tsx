import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { UserCircle, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useStatusColors } from "@/hooks/useStatusColors";

export default function RepProfile() {
  const [, params] = useRoute("/rep-profile/:type/:name");
  const [, navigate] = useLocation();
  const [type, setType] = useState<"setter" | "closer">(params?.type as any || "setter");
  const [selectedRep, setSelectedRep] = useState<string>(params?.name ? decodeURIComponent(params.name) : "");

  // Get list of reps from leaderboards
  const { data: setterLB } = trpc.setterActivities.leaderboard.useQuery({});
  const { data: closerLB } = trpc.closerActivities.leaderboard.useQuery({});

  const repList = type === "setter"
    ? (setterLB || []).map((s: any) => s.setter)
    : (closerLB || []).map((c: any) => c.closer);

  const sc = useStatusColors();
  const effectiveRep = selectedRep || (repList.length > 0 ? repList[0] : "");

  const { data: setterProfile, isLoading: sLoading } = trpc.repProfile.setter.useQuery(
    { setter: effectiveRep },
    { enabled: type === "setter" && !!effectiveRep }
  );
  const { data: closerProfile, isLoading: cLoading } = trpc.repProfile.closer.useQuery(
    { closer: effectiveRep },
    { enabled: type === "closer" && !!effectiveRep }
  );

  const isLoading = type === "setter" ? sLoading : cLoading;

  function TrendIcon({ current, previous }: { current: number; previous: number }) {
    if (current > previous) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
    if (current < previous) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {params?.type && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/leaderboards")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <UserCircle className="h-6 w-6 text-primary" /> Perfil de Rep
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Resumen histórico y métricas individuales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v: any) => { setType(v); setSelectedRep(""); }}>
            <SelectTrigger className="w-[120px] bg-card/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="setter">Setter</SelectItem>
              <SelectItem value="closer">Closer</SelectItem>
            </SelectContent>
          </Select>
          {repList.length > 0 && (
            <Select value={effectiveRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-[180px] bg-card/50"><SelectValue placeholder="Seleccionar rep" /></SelectTrigger>
              <SelectContent>
                {repList.map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!effectiveRep ? (
        <Card className="bg-card/50"><CardContent className="p-12 text-center text-muted-foreground">Selecciona un representante para ver su perfil</CardContent></Card>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando perfil...</div>
      ) : type === "setter" && !setterProfile ? (
        <Card className="bg-card/50"><CardContent className="p-12 text-center text-muted-foreground">Sin datos para {effectiveRep}</CardContent></Card>
      ) : type === "closer" && !closerProfile ? (
        <Card className="bg-card/50"><CardContent className="p-12 text-center text-muted-foreground">Sin datos para {effectiveRep}</CardContent></Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {type === "setter" && setterProfile?.summary && (
              <>
                <StatCard label="Total Intentos" value={Number(setterProfile.summary.totalIntentos)} />
                <StatCard label="Total Intros" value={Number(setterProfile.summary.totalIntros)} />
                <StatCard label="Total Asistidas" value={Number(setterProfile.summary.totalAsistidas)} />
                <StatCard label="Total Cierres" value={Number(setterProfile.summary.totalCierres)} color="text-amber-400" />
                <StatCard label="Tasa Respuesta" value={`${setterProfile.summary.tasaResp}%`} color={Number(setterProfile.summary.tasaResp) >= 30 ? "text-green-400" : "text-red-400"} />
                <StatCard label="Tasa Asistencia" value={`${setterProfile.summary.tasaAsist}%`} color={Number(setterProfile.summary.tasaAsist) >= 80 ? "text-green-400" : "text-amber-400"} />
                <StatCard label="Revenue Total" value={`$${Number(setterProfile.summary.totalRevenue).toLocaleString()}`} color="text-amber-400" />
                <StatCard label="Cash Total" value={`$${Number(setterProfile.summary.totalCash).toLocaleString()}`} color="text-green-400" />
              </>
            )}
            {type === "closer" && closerProfile?.summary && (
              <>
                <StatCard label="Total Schedule" value={Number(closerProfile.summary.totalSchedule)} />
                <StatCard label="Total Live" value={Number(closerProfile.summary.totalLive)} />
                <StatCard label="Total Offers" value={Number(closerProfile.summary.totalOffers)} />
                <StatCard label="Total Closes" value={Number(closerProfile.summary.totalCloses)} color="text-green-400" />
                <StatCard label="Show Rate" value={`${closerProfile.summary.showRate}%`} color={Number(closerProfile.summary.showRate) >= 80 ? "text-green-400" : "text-amber-400"} />
                <StatCard label="Close Rate" value={`${closerProfile.summary.closeRate}%`} color={Number(closerProfile.summary.closeRate) >= 30 ? "text-green-400" : "text-amber-400"} />
                <StatCard label="Revenue Total" value={`$${Number(closerProfile.summary.totalRevenue).toLocaleString()}`} color="text-amber-400" />
                <StatCard label="Cash Total" value={`$${Number(closerProfile.summary.totalCash).toLocaleString()}`} color="text-green-400" />
              </>
            )}
          </div>

          {/* Monthly Breakdown */}
          <Card className="bg-card/50 border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Desglose Mensual — {effectiveRep}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {type === "setter" ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Días</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intentos</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intros</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Asistidas</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Cierres</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Resp.</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Asist.</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(setterProfile?.monthly || []).map((m: any, i: number) => {
                      const prev = setterProfile?.monthly?.[i + 1];
                      const tr = Number(m.totalIntentos) > 0 ? ((Number(m.totalIntros) / Number(m.totalIntentos)) * 100).toFixed(1) : "-";
                      const ta = Number(m.totalCalendario) > 0 ? ((Number(m.totalAsistidas) / Number(m.totalCalendario)) * 100).toFixed(1) : "-";
                      return (
                        <tr key={m.mes} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 font-medium">{m.mes}</td>
                          <td className="p-3 text-center">{Number(m.dias)}</td>
                          <td className="p-3 text-center">
                            <span className="flex items-center justify-center gap-1">
                              {Number(m.totalIntentos)}
                              {prev && <TrendIcon current={Number(m.totalIntentos)} previous={Number(prev.totalIntentos)} />}
                            </span>
                          </td>
                          <td className="p-3 text-center">{Number(m.totalIntros)}</td>
                          <td className="p-3 text-center">{Number(m.totalAsistidas)}</td>
                          <td className="p-3 text-center text-amber-400 font-medium">{Number(m.totalCierres)}</td>
                          <td className="p-3 text-center" style={{ color: tr !== "-" && Number(tr) >= 30 ? sc.good : sc.bad }}>{tr !== "-" ? `${tr}%` : "-"}</td>
                          <td className="p-3 text-center" style={{ color: ta !== "-" && Number(ta) >= 80 ? sc.good : sc.warning }}>{ta !== "-" ? `${ta}%` : "-"}</td>
                          <td className="p-3 text-right text-amber-400">${Number(m.totalRevenue).toLocaleString()}</td>
                          <td className="p-3 text-right text-green-400">${Number(m.totalCash).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {(!setterProfile?.monthly || setterProfile.monthly.length === 0) && (
                      <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Sin datos mensuales</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Días</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Schedule</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Live</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Offers</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Closes</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Show%</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Close%</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(closerProfile?.monthly || []).map((m: any, i: number) => {
                      const prev = closerProfile?.monthly?.[i + 1];
                      const sr = Number(m.totalSchedule) > 0 ? ((Number(m.totalLive) / Number(m.totalSchedule)) * 100).toFixed(1) : "-";
                      const cr = Number(m.totalOffers) > 0 ? ((Number(m.totalCloses) / Number(m.totalOffers)) * 100).toFixed(1) : "-";
                      const totalRev = Number(m.totalPiffRevenue || 0) + Number(m.totalSetupRevenue || 0);
                      const totalCash = Number(m.totalPiffCash || 0) + Number(m.totalSetupCash || 0);
                      return (
                        <tr key={m.mes} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 font-medium">{m.mes}</td>
                          <td className="p-3 text-center">{Number(m.dias)}</td>
                          <td className="p-3 text-center">
                            <span className="flex items-center justify-center gap-1">
                              {Number(m.totalSchedule)}
                              {prev && <TrendIcon current={Number(m.totalSchedule)} previous={Number(prev.totalSchedule)} />}
                            </span>
                          </td>
                          <td className="p-3 text-center">{Number(m.totalLive)}</td>
                          <td className="p-3 text-center">{Number(m.totalOffers)}</td>
                          <td className="p-3 text-center text-green-400 font-medium">{Number(m.totalCloses)}</td>
                          <td className="p-3 text-center" style={{ color: sr !== "-" && Number(sr) >= 80 ? sc.good : sc.warning }}>{sr !== "-" ? `${sr}%` : "-"}</td>
                          <td className="p-3 text-center" style={{ color: cr !== "-" && Number(cr) >= 30 ? sc.good : sc.warning }}>{cr !== "-" ? `${cr}%` : "-"}</td>
                          <td className="p-3 text-right text-amber-400">${totalRev.toLocaleString()}</td>
                          <td className="p-3 text-right text-green-400">${totalCash.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {(!closerProfile?.monthly || closerProfile.monthly.length === 0) && (
                      <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Sin datos mensuales</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Weekly Breakdown */}
          <Card className="bg-card/50 border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Desglose Semanal — {effectiveRep}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {type === "setter" ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Sem</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Días</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intentos</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intros</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Asistidas</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Cierres</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(setterProfile?.weekly || []).map((w: any) => (
                      <tr key={`${w.mes}-${w.semana}`} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="p-3 font-medium">{w.mes}</td>
                        <td className="p-3 text-center">{w.semana}</td>
                        <td className="p-3 text-center">{Number(w.dias)}</td>
                        <td className="p-3 text-center">{Number(w.totalIntentos)}</td>
                        <td className="p-3 text-center">{Number(w.totalIntros)}</td>
                        <td className="p-3 text-center">{Number(w.totalAsistidas)}</td>
                        <td className="p-3 text-center text-amber-400 font-medium">{Number(w.totalCierres)}</td>
                        <td className="p-3 text-right text-amber-400">${Number(w.totalRevenue).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!setterProfile?.weekly || setterProfile.weekly.length === 0) && (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sin datos semanales</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mes</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Sem</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Días</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Schedule</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Live</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Offers</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Closes</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(closerProfile?.weekly || []).map((w: any) => {
                      const totalRev = Number(w.totalPiffRevenue || 0) + Number(w.totalSetupRevenue || 0);
                      const totalCash = Number(w.totalPiffCash || 0) + Number(w.totalSetupCash || 0);
                      return (
                        <tr key={`${w.mes}-${w.semana}`} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 font-medium">{w.mes}</td>
                          <td className="p-3 text-center">{w.semana}</td>
                          <td className="p-3 text-center">{Number(w.dias)}</td>
                          <td className="p-3 text-center">{Number(w.totalSchedule)}</td>
                          <td className="p-3 text-center">{Number(w.totalLive)}</td>
                          <td className="p-3 text-center">{Number(w.totalOffers)}</td>
                          <td className="p-3 text-center text-green-400 font-medium">{Number(w.totalCloses)}</td>
                          <td className="p-3 text-right text-amber-400">${totalRev.toLocaleString()}</td>
                          <td className="p-3 text-right text-green-400">${totalCash.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {(!closerProfile?.weekly || closerProfile.weekly.length === 0) && (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Sin datos semanales</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-bold mt-1 ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
