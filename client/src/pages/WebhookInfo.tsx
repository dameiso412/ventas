import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Webhook, CheckCircle, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const EXAMPLE_LEAD = `{
  "Nombre": "Dr. María García",
  "Correo": "maria@clinicaejemplo.com",
  "Telefono": "+52 55 1234 5678",
  "Fecha_Agenda": "2026-02-22T10:00:00",
  "Link_CRM": "https://clientes.sacamedi.com/v2/location/5h.../contacts/abc123",
  "Facturacion": "15000"
}`;

const EXAMPLE_SCORE = `{
  "correo": "maria@clinicaejemplo.com",
  "telefono": "+52 55 1234 5678",
  "instagram": "clinicaejemplo",
  "pais": "México",
  "rubro": "Odontología",
  "origen": "ADS",
  "tipo": "DEMO",
  "p1_frustracion": "Estoy cansado de no ver resultados con mi marketing actual",
  "p2_marketing_previo": "Invertí $5,000 USD y perdí dinero sin resultados",
  "p3_urgencia": "YA (mi negocio depende de esto)",
  "p4_tiempo_operando": "Más de 5 años",
  "p5_tratamientos": "Implantes dentales, carillas de porcelana",
  "p6_impedimento": "Nada, tengo autoridad y recursos"
}`;

export default function WebhookInfo() {
  const leadUrl = `${window.location.origin}/api/webhook/lead`;
  const scoreUrl = `${window.location.origin}/api/webhook/score`;
  const healthUrl = `${window.location.origin}/api/webhook/health`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks de Integración</h1>
        <p className="text-sm text-muted-foreground mt-1">Dos endpoints para conectar GoHighLevel directamente — sin Make</p>
      </div>

      {/* Flow Diagram */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-4 w-4" /> Flujo Completo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 text-sm">
            <div className="bg-card/80 rounded-lg px-4 py-3 border border-border/50">
              <p className="font-medium">1. Cliente agenda</p>
              <p className="text-xs text-muted-foreground">GHL envía datos de la cita</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden md:block shrink-0" />
            <div className="bg-card/80 rounded-lg px-4 py-3 border border-primary/40">
              <p className="font-medium text-primary">POST /api/webhook/lead</p>
              <p className="text-xs text-muted-foreground">Se crea el lead (solo agenda)</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden md:block shrink-0" />
            <div className="bg-card/80 rounded-lg px-4 py-3 border border-border/50">
              <p className="font-medium">2. Cliente llena formulario</p>
              <p className="text-xs text-muted-foreground">GHL envía perfil + respuestas</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden md:block shrink-0" />
            <div className="bg-card/80 rounded-lg px-4 py-3 border border-primary/40">
              <p className="font-medium text-primary">POST /api/webhook/score</p>
              <p className="text-xs text-muted-foreground">Se enriquece + IA califica (1-4)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== WEBHOOK 1 ==================== */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Webhook 1 — Agenda Nueva
            </CardTitle>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">Paso 1</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configura este endpoint en GHL para cuando alguien agenda una demo o intro. Solo recibe los datos básicos de la cita.
          </p>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/40">POST</Badge>
            <code className="flex-1 bg-muted/30 rounded px-3 py-2 text-sm font-mono">{leadUrl}</code>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => copyToClipboard(leadUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Lead Fields */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Campo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Tipo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Descripción</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Nombre</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Nombre completo del lead <code className="text-[10px] bg-muted/50 px-1 rounded">{'{{contact.name}}'}</code></td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Telefono</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Teléfono con código de país <code className="text-[10px] bg-muted/50 px-1 rounded">{'{{contact.phone}}'}</code></td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Correo</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Email del lead (clave para vincular con scoring) <code className="text-[10px] bg-muted/50 px-1 rounded">{'{{contact.email}}'}</code></td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Fecha_Agenda</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Fecha y hora de la cita <code className="text-[10px] bg-muted/50 px-1 rounded">{'{{appointment.start_time}}'}</code></td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Link_CRM</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">URL del contacto en GHL</td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">Facturacion</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Facturación del lead (monto en USD)</td></tr>
              </tbody>
            </table>
          </div>

          {/* Example */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Ejemplo de Payload</span>
            <Button variant="outline" size="sm" className="gap-2 h-7" onClick={() => copyToClipboard(EXAMPLE_LEAD)}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <pre className="bg-muted/30 rounded-lg p-4 text-xs font-mono overflow-x-auto text-muted-foreground">{EXAMPLE_LEAD}</pre>

          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            <span className="text-muted-foreground">Respuesta:</span>
            <code className="bg-muted/30 rounded px-2 py-0.5 font-mono">{"{ success: true, leadId: 42, message: \"Lead created successfully\" }"}</code>
          </div>
        </CardContent>
      </Card>

      {/* ==================== WEBHOOK 2 ==================== */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Webhook 2 — Formulario de Scoring
            </CardTitle>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40">Paso 2</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configura este endpoint en GHL para cuando el cliente envía el formulario de calificación.
            Recibe toda la información de perfil (Instagram, país, rubro, etc.) junto con las respuestas P1-P6.
            El sistema busca al lead por correo o teléfono, lo enriquece con los datos de perfil, y ejecuta el scoring con IA.
          </p>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/40">POST</Badge>
            <code className="flex-1 bg-muted/30 rounded px-3 py-2 text-sm font-mono">{scoreUrl}</code>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => copyToClipboard(scoreUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Score Fields */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Campo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Tipo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Descripción</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {/* Matching fields */}
                <tr className="border-b border-border/30 bg-blue-500/5"><td className="p-2 font-mono text-blue-400">correo</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Email para vincular con el lead de la agenda</td></tr>
                <tr className="border-b border-border/30 bg-blue-500/5"><td className="p-2 font-mono text-blue-400">telefono</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Teléfono alternativo para vincular</td></tr>
                {/* Profile fields */}
                <tr className="border-b border-border/30 bg-green-500/5"><td className="p-2 font-mono text-green-400">instagram</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Handle de Instagram de la clínica</td></tr>
                <tr className="border-b border-border/30 bg-green-500/5"><td className="p-2 font-mono text-green-400">pais</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">País del lead</td></tr>
                <tr className="border-b border-border/30 bg-green-500/5"><td className="p-2 font-mono text-green-400">rubro</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Especialidad de la clínica</td></tr>
                <tr className="border-b border-border/30 bg-green-500/5"><td className="p-2 font-mono text-green-400">origen</td><td className="p-2">enum</td><td className="p-2 text-muted-foreground">ADS | REFERIDO | ORGANICO</td></tr>
                <tr className="border-b border-border/30 bg-green-500/5"><td className="p-2 font-mono text-green-400">tipo</td><td className="p-2">enum</td><td className="p-2 text-muted-foreground">DEMO | INTRO</td></tr>
                {/* Scoring fields */}
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p1_frustracion</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P1: Frustración con marketing actual</td></tr>
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p2_marketing_previo</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P2: Experiencia con marketing previo</td></tr>
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p3_urgencia</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P3: Plazo para resultados</td></tr>
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p4_tiempo_operando</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P4: Tiempo operando la clínica</td></tr>
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p5_tratamientos</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P5: Tratamientos de mayor valor</td></tr>
                <tr className="border-b border-border/30 bg-primary/5"><td className="p-2 font-mono text-primary">p6_impedimento</td><td className="p-2">string</td><td className="p-2 text-muted-foreground">Respuesta P6: Impedimento para implementar</td></tr>
                <tr className="border-b border-border/30"><td className="p-2 font-mono">score_override</td><td className="p-2">number</td><td className="p-2 text-muted-foreground">Score manual 1-4 (omite IA si se envía)</td></tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-blue-400 border-blue-500/40 text-[10px]">Azul</Badge>
            <span>= campos de vinculación</span>
            <Badge variant="outline" className="text-green-400 border-green-500/40 text-[10px]">Verde</Badge>
            <span>= datos de perfil</span>
            <Badge variant="outline" className="text-primary border-primary/40 text-[10px]">Púrpura</Badge>
            <span>= preguntas de scoring</span>
          </div>

          {/* Example */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Ejemplo de Payload</span>
            <Button variant="outline" size="sm" className="gap-2 h-7" onClick={() => copyToClipboard(EXAMPLE_SCORE)}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <pre className="bg-muted/30 rounded-lg p-4 text-xs font-mono overflow-x-auto text-muted-foreground">{EXAMPLE_SCORE}</pre>

          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            <span className="text-muted-foreground">Respuesta:</span>
            <code className="bg-muted/30 rounded px-2 py-0.5 font-mono">{"{ success: true, leadId: 42, score: 4, scoreLabel: \"HOT\" }"}</code>
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Notas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-blue-400">!</span>
            </div>
            <p>El <strong className="text-foreground">correo</strong> o <strong className="text-foreground">teléfono</strong> del Webhook 2 debe coincidir con el del Webhook 1 para vincular correctamente el scoring al lead existente.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-green-400">✓</span>
            </div>
            <p>Si el Webhook 2 llega antes que el Webhook 1 (o sin lead previo), el sistema crea el lead automáticamente para no perder datos.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">AI</span>
            </div>
            <p>El scoring con IA se ejecuta automáticamente con las respuestas P1-P6. Si envías <code className="bg-muted/30 rounded px-1">score_override</code>, se usa ese valor y se omite la IA.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-orange-400">+</span>
            </div>
            <p>El Webhook 2 también <strong className="text-foreground">enriquece</strong> el lead con los datos de perfil (Instagram, país, rubro, origen, tipo) que no vienen en la agenda.</p>
          </div>
        </CardContent>
      </Card>

      {/* Health Check */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Health Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">GET</Badge>
            <code className="flex-1 bg-muted/30 rounded px-3 py-2 text-sm font-mono">{healthUrl}</code>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => copyToClipboard(healthUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
