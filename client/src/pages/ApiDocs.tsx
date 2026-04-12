import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Shield, Code, BookOpen, ChevronDown, ChevronRight } from "lucide-react";

type EndpointEntry = {
  method: string;
  path: string;
  description: string;
  params: string;
  example: string;
};

type EndpointCategory = {
  title: string;
  icon: string;
  endpoints: EndpointEntry[];
};

export default function ApiDocs() {
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const { data: apiKeys, refetch } = trpc.apiKeys.list.useQuery();
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data: any) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      refetch();
      toast.success("API Key creada exitosamente");
    },
    onError: (err: any) => toast.error(err.message),
  });
  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { refetch(); toast.success("API Key revocada"); },
  });
  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("API Key eliminada"); },
  });

  const baseUrl = window.location.origin;

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const endpointCategories: EndpointCategory[] = [
    {
      title: "Core",
      icon: "🏠",
      endpoints: [
        {
          method: "GET", path: "/api/v1/health",
          description: "Verificar conectividad, estado de la API y lista completa de endpoints organizados por categoría",
          params: "Ninguno",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/health`,
        },
        {
          method: "GET", path: "/api/v1/dashboard",
          description: "KPIs completos del Dashboard: costos de adquisición, tasas de conversión, financieros y pipeline",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/dashboard?mes=Marzo&semana=1"`,
        },
        {
          method: "GET", path: "/api/v1/summary",
          description: "Resumen ejecutivo completo en una sola llamada: overview, KPIs, leaderboards, leads, follow-ups, proyecciones, equipo, alertas y filtros disponibles. Ideal para agentes de IA.",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/summary?mes=Marzo"`,
        },
      ],
    },
    {
      title: "Leads (Registro de Citas)",
      icon: "📋",
      endpoints: [
        {
          method: "GET", path: "/api/v1/leads",
          description: "Listado completo de leads/agendas con todos los campos del pipeline",
          params: "mes, semana, origen, setter, closer, outcome, scoreLabel (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/leads?mes=Marzo&setter=Josefa"`,
        },
        {
          method: "GET", path: "/api/v1/leads/:id",
          description: "Detalle completo de un lead específico por ID, incluyendo scoring si está disponible",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/leads/180001`,
        },
        {
          method: "GET", path: "/api/v1/leads/needs-attention",
          description: "Leads que necesitan atención: sin confirmar, sin contacto, o con intentos insuficientes (>48h)",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/leads/needs-attention?mes=Marzo"`,
        },
        {
          method: "GET", path: "/api/v1/leads/:id/contact-attempts",
          description: "Historial de intentos de contacto de un lead específico (llamadas, WhatsApp, etc.)",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/leads/180001/contact-attempts`,
        },
        {
          method: "GET", path: "/api/v1/leads/:id/comments",
          description: "Comentarios internos del equipo sobre un lead específico",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/leads/180001/comments`,
        },
      ],
    },
    {
      title: "Trackers (Setter & Closer)",
      icon: "📊",
      endpoints: [
        {
          method: "GET", path: "/api/v1/setter-tracker",
          description: "Actividades diarias de setters con KPIs agregados: Answer Rate, Triage Rate, DQ%, intentos, intros, confirmadas",
          params: "mes, semana, setter (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/setter-tracker?mes=Marzo&semana=1"`,
        },
        {
          method: "GET", path: "/api/v1/closer-tracker",
          description: "Actividades diarias de closers con KPIs agregados: Show Rate, Offer Rate, Close Rate, Revenue, Cash",
          params: "mes, semana, closer (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/closer-tracker?mes=Marzo"`,
        },
      ],
    },
    {
      title: "Leaderboards",
      icon: "🏆",
      endpoints: [
        {
          method: "GET", path: "/api/v1/leaderboards",
          description: "Rankings de rendimiento de setters y closers por métricas clave",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/leaderboards?mes=Marzo"`,
        },
        {
          method: "GET", path: "/api/v1/leaderboards/weighted",
          description: "Leaderboards con pesos configurables por métrica. Setter weights: sw_intentos, sw_intros, sw_asistidas, sw_cierres, sw_revenue. Closer weights: cw_closes, cw_revenue, cw_cash, cw_closeRate, cw_showRate.",
          params: "mes, semana, sw_* (setter weights), cw_* (closer weights) — todos opcionales",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/leaderboards/weighted?mes=Marzo&sw_intros=2&cw_closes=3"`,
        },
      ],
    },
    {
      title: "Diagnóstico & Alertas",
      icon: "🔍",
      endpoints: [
        {
          method: "GET", path: "/api/v1/diagnostics",
          description: "Diagnóstico de constraints con evaluación de salud de cada métrica (verde/amarillo/rojo) y recomendaciones",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/diagnostics?mes=Marzo"`,
        },
        {
          method: "GET", path: "/api/v1/alerts",
          description: "Alertas inteligentes activas: leads sin contactar, no-shows recientes, follow-ups vencidos, etc.",
          params: "Ninguno",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/alerts`,
        },
      ],
    },
    {
      title: "Marketing & Scoring",
      icon: "📈",
      endpoints: [
        {
          method: "GET", path: "/api/v1/marketing",
          description: "Métricas de marketing: Ad Spend MTD, visitas landing, leads raw, CTR único, histórico mensual",
          params: "mes, semana (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/marketing?mes=Marzo"`,
        },
        {
          method: "GET", path: "/api/v1/scoring",
          description: "Scoring de todos los leads con puntaje y nivel de calificación",
          params: "scoreLabel (opcional: A, B, C, D)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/scoring?scoreLabel=A"`,
        },
        {
          method: "GET", path: "/api/v1/scoring/:leadId",
          description: "Scoring detallado de un lead específico con desglose por criterio (P1-P6)",
          params: "leadId (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/scoring/180001`,
        },
      ],
    },
    {
      title: "Follow-Ups",
      icon: "🔄",
      endpoints: [
        {
          method: "GET", path: "/api/v1/follow-ups",
          description: "Lista de follow-ups con estadísticas globales. Incluye estado, prioridad, tipo, closer asignado y próxima acción",
          params: "estado, closer, prioridad, tipo, limit, offset (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/follow-ups?estado=pendiente&closer=Damaso"`,
        },
        {
          method: "GET", path: "/api/v1/follow-ups/:id",
          description: "Detalle de un follow-up específico con su historial completo de acciones (logs)",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/follow-ups/1`,
        },
        {
          method: "GET", path: "/api/v1/follow-ups/stats",
          description: "Estadísticas globales de follow-ups: pendientes, en progreso, completados, convertidos, vencidos",
          params: "Ninguno",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/follow-ups/stats`,
        },
        {
          method: "GET", path: "/api/v1/follow-ups/:id/logs",
          description: "Historial de acciones de un follow-up: llamadas, WhatsApp, notas, cambios de estado",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/follow-ups/1/logs`,
        },
      ],
    },
    {
      title: "Proyecciones",
      icon: "📐",
      endpoints: [
        {
          method: "GET", path: "/api/v1/projections/closer",
          description: "Proyecciones de closers: metas de cierres, revenue, cash con comparación vs actuals",
          params: "mes, anio, closer (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/projections/closer?mes=Marzo&anio=2026"`,
        },
        {
          method: "GET", path: "/api/v1/projections/closer/:id",
          description: "Proyección individual de closer con datos reales (actuals) comparados contra las metas",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/projections/closer/1`,
        },
        {
          method: "GET", path: "/api/v1/projections/setter",
          description: "Proyecciones de setters: metas de intentos, intros, confirmadas con comparación vs actuals",
          params: "mes, anio, setter (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/projections/setter?mes=Marzo&anio=2026"`,
        },
        {
          method: "GET", path: "/api/v1/projections/setter/:id",
          description: "Proyección individual de setter con datos reales (actuals) comparados contra las metas",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/projections/setter/1`,
        },
      ],
    },
    {
      title: "Auditorías de Llamadas",
      icon: "🎙️",
      endpoints: [
        {
          method: "GET", path: "/api/v1/call-audits",
          description: "Lista de auditorías de llamadas con estadísticas globales y filtros",
          params: "closer, manualReview, limit, offset (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/call-audits?closer=Damaso&limit=10"`,
        },
        {
          method: "GET", path: "/api/v1/call-audits/:id",
          description: "Auditoría individual con transcripción, puntaje por criterio y recomendaciones",
          params: "id (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/call-audits/1`,
        },
        {
          method: "GET", path: "/api/v1/call-audits/stats",
          description: "Estadísticas agregadas de auditorías: promedio de puntaje, distribución, áreas de mejora",
          params: "Ninguno",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/call-audits/stats`,
        },
        {
          method: "GET", path: "/api/v1/call-audits/by-lead/:leadId",
          description: "Todas las auditorías de llamadas asociadas a un lead específico",
          params: "leadId (en URL)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/call-audits/by-lead/180001`,
        },
      ],
    },
    {
      title: "Equipo",
      icon: "👥",
      endpoints: [
        {
          method: "GET", path: "/api/v1/team",
          description: "Lista de miembros del equipo con rol, estado activo/inactivo, correo y teléfono",
          params: "rol (SETTER/CLOSER/SETTER_CLOSER), activo (true/false) — opcionales",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/team?rol=SETTER&activo=true"`,
        },
        {
          method: "GET", path: "/api/v1/team-summary/setter",
          description: "Resumen mensual de rendimiento por setter: intentos, intros, confirmadas, tasas, tendencia",
          params: "anio (opcional, default: año actual)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/team-summary/setter?anio=2026"`,
        },
        {
          method: "GET", path: "/api/v1/team-summary/closer",
          description: "Resumen mensual de rendimiento por closer: cierres, revenue, cash, tasas, tendencia",
          params: "anio (opcional, default: año actual)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/team-summary/closer?anio=2026"`,
        },
        {
          method: "GET", path: "/api/v1/rep-profile/setter/:name",
          description: "Perfil completo de un setter: métricas históricas, tendencia, fortalezas y áreas de mejora",
          params: "name (en URL, URL-encoded si tiene espacios)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/rep-profile/setter/Josefa`,
        },
        {
          method: "GET", path: "/api/v1/rep-profile/closer/:name",
          description: "Perfil completo de un closer: métricas históricas, tendencia, fortalezas y áreas de mejora",
          params: "name (en URL, URL-encoded si tiene espacios)",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/rep-profile/closer/Damaso`,
        },
      ],
    },
    {
      title: "Operaciones (Cola de Trabajo & Confirmaciones)",
      icon: "⚡",
      endpoints: [
        {
          method: "GET", path: "/api/v1/work-queue",
          description: "Cola de trabajo del setter: leads pendientes de contacto, ordenados por prioridad y antigüedad",
          params: "setter (opcional — filtra por setter específico)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/work-queue?setter=Josefa"`,
        },
        {
          method: "GET", path: "/api/v1/confirmations",
          description: "Cola de confirmaciones pendientes: demos próximas que necesitan confirmación del prospecto",
          params: "setter (opcional — filtra por setter específico)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/confirmations?setter=Josefa"`,
        },
      ],
    },
    {
      title: "Atribución",
      icon: "🎯",
      endpoints: [
        {
          method: "GET", path: "/api/v1/attribution",
          description: "Atribución de leads por UTM: qué campaña/anuncio generó cada lead",
          params: "dateFrom, dateTo, campaignId (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/attribution?dateFrom=2026-03-01&dateTo=2026-03-31"`,
        },
        {
          method: "GET", path: "/api/v1/attribution/by-campaign",
          description: "Conteo de leads agrupados por campaña UTM con rango de fechas",
          params: "dateFrom, dateTo (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/attribution/by-campaign?dateFrom=2026-03-01&dateTo=2026-03-31"`,
        },
      ],
    },
    {
      title: "Meta Ads",
      icon: "📱",
      endpoints: [
        {
          method: "GET", path: "/api/v1/ads/campaigns",
          description: "Campañas de Meta Ads sincronizadas: nombre, estado, objetivo",
          params: "Ninguno",
          example: `curl -H "X-API-Key: TU_KEY" ${baseUrl}/api/v1/ads/campaigns`,
        },
        {
          method: "GET", path: "/api/v1/ads/adsets",
          description: "Adsets (conjuntos de anuncios) con segmentación y estado",
          params: "campaignId (opcional — filtra por campaña)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/adsets?campaignId=120215..."`,
        },
        {
          method: "GET", path: "/api/v1/ads/ads",
          description: "Anuncios individuales con URL tags y estado",
          params: "campaignId, adsetId (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/ads?campaignId=120215..."`,
        },
        {
          method: "GET", path: "/api/v1/ads/metrics",
          description: "Métricas diarias de ads: impresiones, clics, gasto, CTR, CPC, CPM",
          params: "dateFrom, dateTo, campaignId, adsetId (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/metrics?dateFrom=2026-03-01&dateTo=2026-03-06"`,
        },
        {
          method: "GET", path: "/api/v1/ads/metrics/by-campaign",
          description: "Métricas agregadas por campaña en un rango de fechas",
          params: "dateFrom, dateTo (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/metrics/by-campaign?dateFrom=2026-03-01&dateTo=2026-03-31"`,
        },
        {
          method: "GET", path: "/api/v1/ads/metrics/by-adset",
          description: "Métricas agregadas por adset dentro de una campaña",
          params: "campaignId (requerido), dateFrom, dateTo (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/metrics/by-adset?campaignId=120215...&dateFrom=2026-03-01"`,
        },
        {
          method: "GET", path: "/api/v1/ads/metrics/by-ad",
          description: "Métricas agregadas por anuncio individual dentro de un adset",
          params: "adsetId (requerido), dateFrom, dateTo (opcionales)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/metrics/by-ad?adsetId=120215...&dateFrom=2026-03-01"`,
        },
        {
          method: "GET", path: "/api/v1/ads/spend-trend",
          description: "Tendencia de gasto publicitario diario en un rango de fechas",
          params: "dateFrom, dateTo (requeridos, formato YYYY-MM-DD)",
          example: `curl -H "X-API-Key: TU_KEY" "${baseUrl}/api/v1/ads/spend-trend?dateFrom=2026-03-01&dateTo=2026-03-31"`,
        },
      ],
    },
  ];

  const totalEndpoints = endpointCategories.reduce((sum, cat) => sum + cat.endpoints.length, 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API REST</h1>
        <p className="text-muted-foreground mt-1">
          {totalEndpoints} endpoints para conectar agentes de IA o sistemas externos con acceso completo a todos los datos del CRM
        </p>
      </div>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Crea y administra API Keys para autenticar solicitudes a la API REST
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new key */}
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la API Key (ej: Agente IA Producción)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newKeyName && createMutation.mutate({ name: newKeyName })}
            />
            <Button
              onClick={() => createMutation.mutate({ name: newKeyName })}
              disabled={!newKeyName || createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Crear
            </Button>
          </div>

          {/* Newly created key warning */}
          {createdKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm font-medium text-emerald-400 mb-2">
                API Key creada. Copia este valor ahora — no se mostrará de nuevo.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={createdKey}
                  className="flex-1 bg-black/30 rounded px-3 py-2 text-sm font-mono text-emerald-300 border border-emerald-500/20 focus:outline-none focus:border-emerald-400 select-all"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 text-xs"
                onClick={() => setCreatedKey(null)}
              >
                Entendido, ya lo copié
              </Button>
            </div>
          )}

          {/* Existing keys list */}
          <div className="space-y-2">
            {apiKeys?.map((key: any) => (
              <div
                key={key.id}
                className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{key.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="font-mono">
                        {showKeys[key.id] ? key.keyPreview : `${key.keyPreview}${"•".repeat(32)}`}
                      </code>
                      <button
                        onClick={() => setShowKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                        className="hover:text-foreground"
                      >
                        {showKeys[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Creada: {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` · Último uso: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={key.isActive ? "default" : "secondary"}>
                    {key.isActive ? "Activa" : "Revocada"}
                  </Badge>
                  {key.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                      onClick={() => revokeMutation.mutate({ id: key.id })}
                    >
                      Revocar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => deleteMutation.mutate({ id: key.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {apiKeys?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay API Keys creadas. Crea una para empezar a usar la API.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Authentication Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Autenticación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Todas las solicitudes requieren una API Key válida. Envíala en el header <code className="bg-muted px-1 rounded">X-API-Key</code>.
          </p>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Header (recomendado):</p>
            <code className="text-sm font-mono text-emerald-400">
              curl -H "X-API-Key: sk_tu_api_key" {baseUrl}/api/v1/health
            </code>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Filtros comunes (query params):</p>
            <code className="text-sm font-mono text-blue-400">
              ?mes=Marzo&semana=1&closer=Damaso&setter=Josefa
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints Reference - Organized by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Endpoints Disponibles
          </CardTitle>
          <CardDescription>
            {totalEndpoints} endpoints organizados en {endpointCategories.length} categorías
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {endpointCategories.map((category) => {
            const isExpanded = expandedCategories[category.title] ?? false;
            return (
              <div key={category.title} className="border border-border/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.title)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{category.icon}</span>
                    <span className="font-medium text-sm">{category.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {category.endpoints.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t border-border/50 p-3 space-y-3">
                    {category.endpoints.map((ep, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 font-mono text-xs">
                            {ep.method}
                          </Badge>
                          <code className="font-mono text-sm font-medium">{ep.path}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">{ep.description}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Parámetros:</span> {ep.params}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-black/30 rounded px-2 py-1.5 text-muted-foreground overflow-x-auto">
                            {ep.example}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0"
                            onClick={() => copyToClipboard(ep.example)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Integration Guide for AI Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Integración con Agentes de IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para conectar un agente de IA con acceso completo a los datos del CRM, usa el endpoint <code className="bg-muted px-1 rounded">/api/v1/summary</code> que devuelve un resumen ejecutivo con todos los KPIs, leaderboards, leads, follow-ups, proyecciones, equipo y alertas en una sola llamada.
          </p>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Ejemplo Python:</p>
            <pre className="text-sm font-mono text-emerald-400 whitespace-pre-wrap">{`import requests

API_KEY = "sk_tu_api_key"
BASE_URL = "${baseUrl}/api/v1"
headers = {"X-API-Key": API_KEY}

# Resumen ejecutivo completo (todo en 1 llamada)
summary = requests.get(
    f"{BASE_URL}/summary?mes=Marzo",
    headers=headers
).json()

# Dashboard KPIs con filtro semanal
dashboard = requests.get(
    f"{BASE_URL}/dashboard?mes=Marzo&semana=1",
    headers=headers
).json()

# Follow-ups pendientes
follow_ups = requests.get(
    f"{BASE_URL}/follow-ups?estado=pendiente",
    headers=headers
).json()

# Proyecciones de closers
projections = requests.get(
    f"{BASE_URL}/projections/closer?mes=Marzo&anio=2026",
    headers=headers
).json()

# Auditorías de llamadas
audits = requests.get(
    f"{BASE_URL}/call-audits?closer=Damaso&limit=5",
    headers=headers
).json()

# Perfil completo de un rep
profile = requests.get(
    f"{BASE_URL}/rep-profile/closer/Damaso",
    headers=headers
).json()

# Atribución de anuncios
attribution = requests.get(
    f"{BASE_URL}/attribution/by-campaign",
    headers=headers
).json()`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
