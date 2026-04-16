import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Mail, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "No se pudo enviar el link. Intenta de nuevo.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">SacaMedi CRM</CardTitle>
          <CardDescription>
            {sent
              ? "Te enviamos un link para entrar"
              : "Inicia sesión con tu correo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Si tu correo está autorizado, te enviamos un link a{" "}
                <strong className="text-foreground">{email}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Revisa tu bandeja (y el spam). Puede tardar un minuto en llegar.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Usar otro correo
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading || !email}>
                <Mail className="mr-2 h-4 w-4" />
                {loading ? "Enviando..." : "Enviar link de acceso"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Te enviaremos un link a tu correo para entrar sin contraseña.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
