import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const severityConfig = {
  critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Crítico" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Advertencia" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Positivo" },
};

export default function Alertas() {
  const { data: alerts, isLoading, refetch } = trpc.alerts.list.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  const criticalCount = (alerts || []).filter(a => a.severity === "critical").length;
  const warningCount = (alerts || []).filter(a => a.severity === "warning").length;
  const infoCount = (alerts || []).filter(a => a.severity === "info").length;
  const successCount = (alerts || []).filter(a => a.severity === "success").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Alertas Inteligentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitoreo automático de actividad y rendimiento del equipo</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>

      {/* Summary Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Críticas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-amber-400">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Advertencias</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
              <p className="text-xs text-muted-foreground">Informativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{successCount}</p>
              <p className="text-xs text-muted-foreground">Positivas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Analizando actividad del equipo...</div>
      ) : !alerts || alerts.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Sin alertas activas. Todo el equipo está operando normalmente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Critical first, then warning, info, success */}
          {["critical", "warning", "info", "success"].map(severity => {
            const filtered = alerts.filter(a => a.severity === severity);
            if (filtered.length === 0) return null;
            const config = severityConfig[severity as keyof typeof severityConfig];
            const Icon = config.icon;
            return (
              <div key={severity} className="space-y-2">
                <h3 className={`text-xs font-medium uppercase tracking-wider ${config.color} mt-4 mb-2`}>
                  {config.label} ({filtered.length})
                </h3>
                {filtered.map((alert, i) => (
                  <Card key={`${severity}-${i}`} className={`${config.bg} ${config.border} border`}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Icon className={`h-5 w-5 ${config.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{alert.title}</h4>
                          {alert.rep && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">{alert.rep}</span>
                          )}
                          {alert.department && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{alert.department}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
