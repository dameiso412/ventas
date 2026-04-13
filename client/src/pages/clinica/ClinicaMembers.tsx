import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, Shield, User } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ClinicaMembers() {
  const orgQuery = trpc.clinica.organization.getDefault.useQuery();
  const orgId = orgQuery.data?.id || "";

  const membersQuery = trpc.clinica.members.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const members = membersQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-pink-400" />
          Miembros
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Equipo de la clinica
        </p>
      </div>

      {membersQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
        </div>
      ) : members.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">No hay miembros registrados.</p>
              <p className="text-xs mt-1">Los miembros se agregaran al configurar la organizacion.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => (
            <Card key={member.id} className="bg-card/50 border-border/50 hover:border-pink-500/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-pink-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {member.displayName || member.userId}
                    </h3>
                    {member.email && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${
                    member.role === "admin"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  }`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {member.role === "admin" ? "Admin" : "Miembro"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
