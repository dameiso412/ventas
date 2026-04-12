import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NoPermiso() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
        <ShieldAlert className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Sin permisos</h2>
      <p className="text-muted-foreground max-w-sm">
        Tu rol no tiene acceso a esta sección. Contacta al administrador si necesitas permisos adicionales.
      </p>
      <Button variant="outline" onClick={() => setLocation("/")}>
        Volver al Dashboard
      </Button>
    </div>
  );
}
