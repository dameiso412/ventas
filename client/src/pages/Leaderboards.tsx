import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Trophy, Medal, Award, Crown, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useStatusColors } from "@/hooks/useStatusColors";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center"><Crown className="h-4 w-4 text-amber-400" /></div>;
  if (rank === 2) return <div className="h-8 w-8 rounded-full bg-gray-400/20 flex items-center justify-center"><Medal className="h-4 w-4 text-gray-300" /></div>;
  if (rank === 3) return <div className="h-8 w-8 rounded-full bg-orange-700/20 flex items-center justify-center"><Award className="h-4 w-4 text-orange-600" /></div>;
  return <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">{rank}</div>;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full bg-muted/30 rounded-full h-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function Leaderboards() {
  const [, navigate] = useLocation();
  const sc = useStatusColors();
  const [mes, setMes] = useState<string>("all");
  const [semana, setSemana] = useState<string>("all");
  const [showWeights, setShowWeights] = useState(false);
  const [mode, setMode] = useState<"simple" | "weighted">("weighted");

  // Setter weights
  const [sW, setSW] = useState({ intentos: 10, intros: 15, asistidas: 30, cierres: 25, revenue: 20 });
  // Closer weights
  const [cW, setCW] = useState({ closes: 30, revenue: 20, cash: 15, closeRate: 20, showRate: 15 });

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data: setterLB } = trpc.setterActivities.leaderboard.useQuery(filters);
  const { data: closerLB } = trpc.closerActivities.leaderboard.useQuery(filters);
  const { data: wSetterLB } = trpc.weightedLeaderboard.setters.useQuery({ ...filters, weights: sW });
  const { data: wCloserLB } = trpc.weightedLeaderboard.closers.useQuery({ ...filters, weights: cW });

  const setterData = mode === "weighted" ? wSetterLB : setterLB;
  const closerData = mode === "weighted" ? wCloserLB : closerLB;

  const updateSetterWeight = (key: keyof typeof sW, val: number) => {
    const old = sW[key];
    const diff = val - old;
    const others = Object.keys(sW).filter(k => k !== key) as (keyof typeof sW)[];
    const newW = { ...sW, [key]: val };
    // Distribute diff proportionally among others
    const totalOthers = others.reduce((s, k) => s + sW[k], 0);
    if (totalOthers > 0) {
      let remaining = -diff;
      others.forEach((k, i) => {
        if (i === others.length - 1) {
          newW[k] = Math.max(0, sW[k] + remaining);
        } else {
          const share = Math.round((sW[k] / totalOthers) * (-diff));
          newW[k] = Math.max(0, sW[k] + share);
          remaining -= share;
        }
      });
    }
    setSW(newW);
  };

  const updateCloserWeight = (key: keyof typeof cW, val: number) => {
    const old = cW[key];
    const diff = val - old;
    const others = Object.keys(cW).filter(k => k !== key) as (keyof typeof cW)[];
    const newW = { ...cW, [key]: val };
    const totalOthers = others.reduce((s, k) => s + cW[k], 0);
    if (totalOthers > 0) {
      let remaining = -diff;
      others.forEach((k, i) => {
        if (i === others.length - 1) {
          newW[k] = Math.max(0, cW[k] + remaining);
        } else {
          const share = Math.round((cW[k] / totalOthers) * (-diff));
          newW[k] = Math.max(0, cW[k] + share);
          remaining -= share;
        }
      });
    }
    setCW(newW);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboards</h1>
          <p className="text-sm text-muted-foreground mt-1">Ranking de rendimiento del equipo — {mode === "weighted" ? "Ponderado" : "Simple"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode(m => m === "weighted" ? "simple" : "weighted")} className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            {mode === "weighted" ? "Ponderado" : "Simple"}
          </Button>
          {mode === "weighted" && (
            <Button variant="outline" size="sm" onClick={() => setShowWeights(!showWeights)} className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Pesos
              {showWeights ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[120px] bg-card/50"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[110px] bg-card/50"><SelectValue placeholder="Semana" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{[1,2,3,4,5].map(s => <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="setters" className="w-full">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="setters">Setters</TabsTrigger>
          <TabsTrigger value="closers">Closers</TabsTrigger>
        </TabsList>

        <TabsContent value="setters" className="space-y-4 mt-4">
          {/* Setter Weight Config */}
          {showWeights && mode === "weighted" && (
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Configurar Pesos — Setters (deben sumar 100%)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "intentos" as const, label: "Intentos de Llamada" },
                  { key: "intros" as const, label: "Intros Efectivas" },
                  { key: "asistidas" as const, label: "Demos Asistidas" },
                  { key: "cierres" as const, label: "Cierres Atribuidos" },
                  { key: "revenue" as const, label: "Revenue" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm w-40 text-muted-foreground">{label}</span>
                    <Slider value={[sW[key]]} onValueChange={([v]) => updateSetterWeight(key, v)} max={100} step={5} className="flex-1" />
                    <span className="text-sm font-mono w-12 text-right">{sW[key]}%</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">Total: {Object.values(sW).reduce((a, b) => a + b, 0)}%</p>
              </CardContent>
            </Card>
          )}

          {/* Setter Podium */}
          {setterData && setterData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {setterData.slice(0, 3).map((s: any, i: number) => {
                const borderColor = i === 0 ? "border-amber-500/50" : i === 1 ? "border-gray-400/50" : "border-orange-700/50";
                const ws = s.weightedScore;
                return (
                  <Card key={s.setter} className={`bg-card/50 ${borderColor} border-2 cursor-pointer hover:bg-card/80 transition-all`}
                    onClick={() => navigate(`/rep-profile/setter/${encodeURIComponent(s.setter)}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <RankBadge rank={i + 1} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{s.setter}</h3>
                          <p className="text-xs text-muted-foreground">{Number(s.dias)} días</p>
                        </div>
                        {ws !== undefined && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{ws.toFixed(1)}</p>
                            <p className="text-[10px] text-muted-foreground">Score</p>
                          </div>
                        )}
                      </div>
                      {mode === "weighted" && s.scores && (
                        <div className="space-y-1.5 text-xs">
                          {[
                            { label: "Intentos", score: s.scores.intentos, color: "#a855f7" },
                            { label: "Intros", score: s.scores.intros, color: "#3b82f6" },
                            { label: "Asistidas", score: s.scores.asistidas, color: "#22c55e" },
                            { label: "Cierres", score: s.scores.cierres, color: "#f59e0b" },
                            { label: "Revenue", score: s.scores.revenue, color: "#ef4444" },
                          ].map(({ label, score, color }) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="w-16 text-muted-foreground">{label}</span>
                              <ScoreBar score={score} color={color} />
                              <span className="w-10 text-right font-mono">{score.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {mode === "simple" && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Intentos</p><p className="font-bold text-sm">{Number(s.totalIntentos)}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Intros</p><p className="font-bold text-sm">{Number(s.totalIntros)}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Asistidas</p><p className="font-bold text-sm">{Number(s.totalAsistidas)}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Cierres</p><p className="font-bold text-sm text-amber-400">{Number(s.totalCierres)}</p></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full Setter Table */}
          <Card className="bg-card/50 border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Ranking {mode === "weighted" ? "Ponderado" : "Simple"} de Setters
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">#</th>
                    {mode === "weighted" && <th className="text-center p-3 font-medium text-muted-foreground text-xs">Score</th>}
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Setter</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intentos</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intros</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Asistidas</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Cierres</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(setterData || []).map((s: any, i: number) => (
                    <tr key={s.setter} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/rep-profile/setter/${encodeURIComponent(s.setter)}`)}>
                      <td className="p-3"><RankBadge rank={i + 1} /></td>
                      {mode === "weighted" && <td className="p-3 text-center font-bold text-primary">{s.weightedScore?.toFixed(1) ?? "-"}</td>}
                      <td className="p-3 font-medium">{s.setter}</td>
                      <td className="p-3 text-center">{Number(s.totalIntentos)}</td>
                      <td className="p-3 text-center">{Number(s.totalIntros)}</td>
                      <td className="p-3 text-center">{Number(s.totalAsistidas)}</td>
                      <td className="p-3 text-center text-amber-400 font-medium">{Number(s.totalCierres)}</td>
                      <td className="p-3 text-right text-amber-400 font-medium">${Number(s.totalRevenue || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!setterData || setterData.length === 0) && (
                    <tr><td colSpan={mode === "weighted" ? 8 : 7} className="p-8 text-center text-muted-foreground">Sin datos de setters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="closers" className="space-y-4 mt-4">
          {/* Closer Weight Config */}
          {showWeights && mode === "weighted" && (
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Configurar Pesos — Closers (deben sumar 100%)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "closes" as const, label: "Cierres" },
                  { key: "revenue" as const, label: "Revenue" },
                  { key: "cash" as const, label: "Cash Collected" },
                  { key: "closeRate" as const, label: "Close Rate" },
                  { key: "showRate" as const, label: "Show Rate" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm w-40 text-muted-foreground">{label}</span>
                    <Slider value={[cW[key]]} onValueChange={([v]) => updateCloserWeight(key, v)} max={100} step={5} className="flex-1" />
                    <span className="text-sm font-mono w-12 text-right">{cW[key]}%</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">Total: {Object.values(cW).reduce((a, b) => a + b, 0)}%</p>
              </CardContent>
            </Card>
          )}

          {/* Closer Podium */}
          {closerData && closerData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {closerData.slice(0, 3).map((c: any, i: number) => {
                const borderColor = i === 0 ? "border-amber-500/50" : i === 1 ? "border-gray-400/50" : "border-orange-700/50";
                const totalRev = Number(c.totalRevenue ?? (Number(c.totalPiffRevenue || 0) + Number(c.totalSetupRevenue || 0)));
                const totalCash = Number(c.totalCash ?? (Number(c.totalPiffCash || 0) + Number(c.totalSetupCash || 0)));
                const ws = c.weightedScore;
                return (
                  <Card key={c.closer} className={`bg-card/50 ${borderColor} border-2 cursor-pointer hover:bg-card/80 transition-all`}
                    onClick={() => navigate(`/rep-profile/closer/${encodeURIComponent(c.closer)}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <RankBadge rank={i + 1} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{c.closer}</h3>
                          <p className="text-xs text-muted-foreground">{Number(c.dias)} días</p>
                        </div>
                        {ws !== undefined && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{ws.toFixed(1)}</p>
                            <p className="text-[10px] text-muted-foreground">Score</p>
                          </div>
                        )}
                      </div>
                      {mode === "weighted" && c.scores && (
                        <div className="space-y-1.5 text-xs">
                          {[
                            { label: "Closes", score: c.scores.closes, color: "#22c55e" },
                            { label: "Revenue", score: c.scores.revenue, color: "#f59e0b" },
                            { label: "Cash", score: c.scores.cash, color: "#3b82f6" },
                            { label: "Close%", score: c.scores.closeRate, color: "#a855f7" },
                            { label: "Show%", score: c.scores.showRate, color: "#ef4444" },
                          ].map(({ label, score, color }) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="w-16 text-muted-foreground">{label}</span>
                              <ScoreBar score={score} color={color} />
                              <span className="w-10 text-right font-mono">{score.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {mode === "simple" && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Closes</p><p className="font-bold text-sm text-green-400">{Number(c.totalCloses)}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Revenue</p><p className="font-bold text-sm text-amber-400">${totalRev.toLocaleString()}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Cash</p><p className="font-bold text-sm text-green-400">${totalCash.toLocaleString()}</p></div>
                          <div className="bg-muted/20 rounded p-2"><p className="text-muted-foreground">Días</p><p className="font-bold text-sm">{Number(c.dias)}</p></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full Closer Table */}
          <Card className="bg-card/50 border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Ranking {mode === "weighted" ? "Ponderado" : "Simple"} de Closers
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">#</th>
                    {mode === "weighted" && <th className="text-center p-3 font-medium text-muted-foreground text-xs">Score</th>}
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Closer</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Closes</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Show%</th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs">Close%</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {(closerData || []).map((c: any, i: number) => {
                    const sr = c.showRate ?? (Number(c.totalSchedule) > 0 ? ((Number(c.totalLive) / Number(c.totalSchedule)) * 100) : 0);
                    const cr = c.closeRate ?? (Number(c.totalOffers) > 0 ? ((Number(c.totalCloses) / Number(c.totalOffers)) * 100) : 0);
                    const totalRev = Number(c.totalRevenue ?? (Number(c.totalPiffRevenue || 0) + Number(c.totalSetupRevenue || 0)));
                    const totalCash = Number(c.totalCash ?? (Number(c.totalPiffCash || 0) + Number(c.totalSetupCash || 0)));
                    return (
                      <tr key={c.closer} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/rep-profile/closer/${encodeURIComponent(c.closer)}`)}>
                        <td className="p-3"><RankBadge rank={i + 1} /></td>
                        {mode === "weighted" && <td className="p-3 text-center font-bold text-primary">{c.weightedScore?.toFixed(1) ?? "-"}</td>}
                        <td className="p-3 font-medium">{c.closer}</td>
                        <td className="p-3 text-center text-green-400 font-medium">{Number(c.totalCloses)}</td>
                        <td className="p-3 text-center" style={{ color: sr >= 80 ? sc.good : sc.warning }}>{sr > 0 ? `${sr.toFixed(1)}%` : "-"}</td>
                        <td className="p-3 text-center" style={{ color: cr >= 30 ? sc.good : sc.warning }}>{cr > 0 ? `${cr.toFixed(1)}%` : "-"}</td>
                        <td className="p-3 text-right text-amber-400 font-medium">${totalRev.toLocaleString()}</td>
                        <td className="p-3 text-right text-green-400 font-medium">${totalCash.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {(!closerData || closerData.length === 0) && (
                    <tr><td colSpan={mode === "weighted" ? 8 : 7} className="p-8 text-center text-muted-foreground">Sin datos de closers</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
