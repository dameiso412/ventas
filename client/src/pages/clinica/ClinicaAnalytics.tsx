import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, DollarSign, TrendingUp, Users, Target,
  ArrowDownRight, ArrowUpRight, Loader2, AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

function MetricCard({ title, value, subtitle, icon: Icon, trend, color }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | null;
  color: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-xs text-muted-foreground">{title}</span>
          </div>
          {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-400" />}
          {trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-400" />}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

export default function ClinicaAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");

  const orgQuery = trpc.clinica.organization.getDefault.useQuery();
  const orgId = orgQuery.data?.id || "";

  const kpisQuery = trpc.clinica.analytics.kpis.useQuery({ orgId }, { enabled: !!orgId });
  const revenueQuery = trpc.clinica.analytics.revenue.useQuery({ orgId }, { enabled: !!orgId });
  const funnelQuery = trpc.clinica.analytics.funnel.useQuery({ orgId }, { enabled: !!orgId });
  const ownersQuery = trpc.clinica.analytics.ownerPerformance.useQuery({ orgId }, { enabled: !!orgId });
  const lossQuery = trpc.clinica.analytics.lossReasons.useQuery({ orgId }, { enabled: !!orgId });

  const kpis = kpisQuery.data;
  const revenue = revenueQuery.data;
  const funnel = funnelQuery.data;
  const owners = ownersQuery.data || [];
  const losses = lossQuery.data || [];

  // Aggregate loss reasons by category
  const lossByCategory = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const l of losses) {
      const existing = map.get(l.category) || { count: 0, value: 0 };
      existing.count++;
      existing.value += Number(l.estimatedValue) || 0;
      map.set(l.category, existing);
    }
    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [losses]);

  const isLoading = kpisQuery.isLoading || revenueQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-pink-400" />
          Analytics Clinica
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Metricas de revenue, attendance, conversion y upsell
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="losses">Razones de Perdida</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard title="Pacientes" value={String(kpis?.totalPatients ?? 0)} icon={Users} color="text-pink-400" />
            <MetricCard title="Revenue Total" value={`$${(kpis?.totalRevenue ?? 0).toLocaleString()}`} icon={DollarSign} color="text-green-400" />
            <MetricCard title="Attendance" value={`${kpis?.attendanceRate ?? 0}%`} icon={TrendingUp} color="text-emerald-400" />
            <MetricCard title="Conversion" value={`${kpis?.conversionRate ?? 0}%`} icon={Target} color="text-amber-400" />
            <MetricCard title="Upsell Revenue" value={`$${(kpis?.upsellRevenue ?? 0).toLocaleString()}`} icon={DollarSign} color="text-purple-400" />
            <MetricCard title="Avg Deal" value={`$${(kpis?.avgDealValue ?? 0).toLocaleString()}`} icon={DollarSign} color="text-sky-400" />
          </div>

          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Revenue Realizado</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-400">${(revenue?.realizedRevenue ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Pacientes completados con compra</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Revenue Contratado</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-400">${(revenue?.contractedRevenue ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Asistieron y compraron</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pipeline Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-400">${(revenue?.totalPipeline ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Monto total de todos los pacientes</p>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-pink-400" />
                Funnel de Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FunnelBar label="Total Pacientes" value={funnel?.total ?? 0} total={funnel?.total ?? 1} color="bg-pink-500" />
              <FunnelBar label="Asistieron" value={funnel?.attended ?? 0} total={funnel?.total ?? 1} color="bg-emerald-500" />
              <FunnelBar label="Compraron" value={funnel?.purchased ?? 0} total={funnel?.total ?? 1} color="bg-blue-500" />
              <FunnelBar label="Upsell Aceptado" value={funnel?.upselled ?? 0} total={funnel?.total ?? 1} color="bg-purple-500" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-pink-400" />
                Performance por Responsable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {owners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos de performance.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Responsable</th>
                        <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Pacientes</th>
                        <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Asistieron</th>
                        <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Compraron</th>
                        <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Att. Rate</th>
                        <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Conv. Rate</th>
                        <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owners.map(o => (
                        <tr key={o.ownerId} className="border-b border-border/30 hover:bg-muted/5">
                          <td className="py-2 px-3 font-medium">{o.ownerId}</td>
                          <td className="py-2 px-3 text-center">{o.totalPatients}</td>
                          <td className="py-2 px-3 text-center">{o.attended}</td>
                          <td className="py-2 px-3 text-center">{o.purchased}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${o.attendanceRate >= 70 ? "text-emerald-400" : o.attendanceRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                              {o.attendanceRate}%
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${o.conversionRate >= 60 ? "text-emerald-400" : o.conversionRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                              {o.conversionRate}%
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-green-400">${o.totalRevenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="losses" className="space-y-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Razones de Perdida por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos de perdida registrados.</p>
              ) : (
                <div className="space-y-4">
                  {lossByCategory.map(l => (
                    <div key={l.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/5 border border-border/30">
                      <div>
                        <p className="font-medium text-sm capitalize">{l.category.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{l.count} caso{l.count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-400 text-sm">${l.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">valor perdido</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual loss reasons */}
          {losses.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Detalle de Perdidas Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {losses.slice(0, 20).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-2 rounded bg-muted/5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{l.lossType}</Badge>
                        <span className="capitalize">{l.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {l.notes && <span className="text-muted-foreground truncate max-w-40">{l.notes}</span>}
                        <span className="text-red-400 font-medium">${Number(l.estimatedValue || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
