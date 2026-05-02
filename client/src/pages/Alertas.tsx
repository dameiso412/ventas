import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw, BellOff, History } from "lucide-react";
import { toast } from "sonner";

function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
}

function formatRelativeFuture(target: string | Date): string {
  const date = typeof target === "string" ? new Date(target) : target;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "expirado";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `en ${mins} min`;
  const hours = Math.round(mins / 60);
  return `en ${hours}h`;
}

const severityConfig = {
  critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Crítico" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Advertencia" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Positivo" },
};

export default function Alertas() {
  const utils = trpc.useUtils();
  const { data: alerts, isLoading, refetch } = trpc.alerts.list.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });
  const { data: snoozes = [] } = trpc.roundRobin.listActiveSnoozes.useQuery(undefined, {
    refetchInterval: 30 * 1000,
  });
  const { data: recentActions = [] } = trpc.roundRobin.recentSlackActions.useQuery(
    { limit: 25 },
    { refetchInterval: 60 * 1000 }
  );

  const expireMutation = trpc.roundRobin.expireSnooze.useMutation({
    onSuccess: () => {
      toast.success("Snooze reactivado");
      utils.roundRobin.listActiveSnoozes.invalidate();
    },
    onError: (e) => toast.error(e.message),
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

      {/* SNOOZES ACTIVOS — alerts silenciados desde Slack */}
      {snoozes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BellOff className="h-4 w-4 text-amber-400" />
              Alertas silenciadas
              <span className="text-xs text-muted-foreground font-normal">— se silenciaron desde Slack y se reactivan automáticamente al expirar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Alerta</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Silenciada por</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vence</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {snoozes.map((s) => (
                    <tr key={s.id} className="border-b border-border/30">
                      <td className="py-2 px-3"><code className="text-xs bg-muted/40 px-1.5 py-0.5 rounded">{s.alertKey}</code></td>
                      <td className="py-2 px-3 text-muted-foreground">{s.snoozedByName || s.snoozedByEmail || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {formatRelativeFuture(s.expiresAt)}
                        <span className="text-[10px] text-muted-foreground/70 ml-2">({formatDateTime(s.expiresAt)})</span>
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => expireMutation.mutate({ id: s.id })}
                          disabled={expireMutation.isPending}
                        >
                          Reactivar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AUDIT LOG — últimas acciones desde Slack */}
      {recentActions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Acciones recientes desde Slack
              <span className="text-xs text-muted-foreground font-normal">— últimas {recentActions.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cuándo</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Quién</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Acción</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Target</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActions.map((a) => (
                    <tr key={a.id} className="border-b border-border/30">
                      <td className="py-2 px-3 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</td>
                      <td className="py-2 px-3">{a.crmUserName || a.slackUserName || "—"}</td>
                      <td className="py-2 px-3"><code className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">{a.actionId}</code></td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {a.targetType ? `${a.targetType}${a.targetId ? ` #${a.targetId}` : ""}` : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={
                          a.result === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          a.result === "unauthorized" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          "bg-red-500/10 text-red-400 border-red-500/30"
                        }>
                          {a.result}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
