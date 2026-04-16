import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { BarChart3, Loader2, XCircle } from "lucide-react";

/**
 * Handles the magic link redirect from Supabase.
 *
 * Supabase sends the user to `/auth/callback#access_token=...&refresh_token=...`.
 * The Supabase client (`detectSessionInUrl: true` is the default) automatically
 * parses the hash and establishes a local session. We then hand the access_token
 * to our server to exchange it for the app's `app_session_id` cookie.
 */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      try {
        // Small delay to give the Supabase client time to parse the hash on load
        await new Promise((r) => setTimeout(r, 100));

        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (!cancelled) setError(sessionError.message);
          return;
        }

        const accessToken = data.session?.access_token;
        if (!accessToken) {
          if (!cancelled) {
            setError("El link de acceso expiró o ya fue usado. Pide uno nuevo.");
          }
          return;
        }

        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          if (!cancelled) {
            setError(result.error || "No se pudo completar el inicio de sesión.");
          }
          return;
        }

        // Clean Supabase local storage so the token doesn't linger; our server
        // cookie is the source of truth from now on.
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // non-fatal
        }

        // Hard redirect so the app re-fetches auth state from the server cookie
        window.location.replace(result.redirect || "/");
      } catch (err) {
        if (!cancelled) {
          setError("Error de conexión completando el inicio de sesión.");
        }
      }
    }

    completeLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {error ? "No pudimos completar el acceso" : "Entrando al CRM..."}
          </CardTitle>
          <CardDescription>
            {error ? "Puedes solicitar un nuevo link." : "Verificando tu link de acceso"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {error ? (
            <>
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-destructive/10">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
              </div>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = "/login";
                }}
              >
                Volver a iniciar sesión
              </Button>
            </>
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
