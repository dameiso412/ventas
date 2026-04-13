import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Globe, Key, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function ClinicaSettings() {
  const [copied, setCopied] = useState(false);

  const orgQuery = trpc.clinica.organization.getDefault.useQuery();
  const org = orgQuery.data;

  const handleCopyToken = () => {
    if (org?.webhookToken) {
      navigator.clipboard.writeText(org.webhookToken);
      setCopied(true);
      toast.success("Token copiado");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (orgQuery.isLoading) {
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
          <Settings className="h-6 w-6 text-pink-400" />
          Configuracion Clinica
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Webhook, moneda y organizacion
        </p>
      </div>

      {!org ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Settings className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">No hay organizacion clinica configurada.</p>
              <p className="text-xs mt-1">Contacta al administrador para configurar la organizacion.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Info */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-pink-400" />
                Organizacion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <p className="font-medium">{org.name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Moneda</Label>
                <Badge variant="outline" className="ml-2">{org.currency}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ID</Label>
                <p className="text-xs font-mono text-muted-foreground">{org.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Creada</Label>
                <p className="text-xs text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Config */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-pink-400" />
                Webhook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Endpoint</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-3 py-1.5 rounded bg-muted/30 text-xs font-mono break-all">
                    POST /api/webhook/patient
                  </code>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Token</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-3 py-1.5 rounded bg-muted/30 text-xs font-mono truncate">
                    {org.webhookToken}
                  </code>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyToken}>
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Header</Label>
                <code className="block px-3 py-1.5 rounded bg-muted/30 text-xs font-mono mt-1">
                  x-webhook-token: {`{token}`}
                </code>
              </div>
              <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  Envia un POST con el header <code className="text-pink-400">x-webhook-token</code> y un body JSON con los campos:
                  <code className="block mt-1 text-sky-400">patient_name, patient_email, patient_phone, treatment_type, initial_amount, scheduled_date</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
