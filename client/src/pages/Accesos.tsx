import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Mail,
  Clock,
  Send,
} from "lucide-react";
import { ROLE_LABELS, ROLE_BG_COLORS, type CrmRole } from "@shared/permissions";

function RoleBadge({ role }: { role: string }) {
  const crmRole = role as CrmRole;
  const label = ROLE_LABELS[crmRole] || role;
  const colors = ROLE_BG_COLORS[crmRole] || "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`${colors} text-xs font-medium`}>
      {label}
    </Badge>
  );
}

/* ─── Add Email Form (inline, replaces dialog) ─── */
function AddEmailForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "setter" | "closer">("setter");
  const [nombre, setNombre] = useState("");

  const createMutation = trpc.access.createAllowed.useMutation({
    onSuccess: () => {
      toast.success("Email autorizado agregado");
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!email.trim()) {
      toast.error("El email es requerido");
      return;
    }
    createMutation.mutate({
      email: email.trim().toLowerCase(),
      role,
      nombre: nombre.trim() || undefined,
    });
  };

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Agregar Email Autorizado
        </CardTitle>
        <CardDescription>
          Este email podrá iniciar sesión en el CRM con el rol asignado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre (opcional)</label>
            <Input
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="juan@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol</label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="setter">Setter</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} size="sm">
            {createMutation.isPending ? "Agregando..." : "Agregar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Edit Email Form (inline) ─── */
function EditEmailForm({
  item,
  onClose,
  onSuccess,
}: {
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState(item.email);
  const [role, setRole] = useState<"admin" | "setter" | "closer">(item.role);
  const [nombre, setNombre] = useState(item.nombre || "");

  const updateMutation = trpc.access.updateAllowed.useMutation({
    onSuccess: () => {
      toast.success("Email actualizado");
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    updateMutation.mutate({
      id: item.id,
      email: email.trim().toLowerCase(),
      role,
      nombre: nombre.trim() || undefined,
    });
  };

  return (
    <Card className="border-amber-500/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Pencil className="h-5 w-5 text-amber-400" />
          Editar Email Autorizado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol</label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="setter">Setter</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending} size="sm">
            {updateMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Accesos Page ─── */
export default function Accesos() {
  const utils = trpc.useUtils();
  const { data: allowedEmails, isLoading: loadingEmails } = trpc.access.listAllowed.useQuery();
  const { data: allUsers, isLoading: loadingUsers } = trpc.access.listUsers.useQuery();

  const deleteMutation = trpc.access.deleteAllowed.useMutation({
    onSuccess: () => {
      utils.access.listAllowed.invalidate();
      toast.success("Email eliminado de la lista");
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.access.updateAllowed.useMutation({
    onSuccess: () => {
      utils.access.listAllowed.invalidate();
      toast.success("Estado actualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [sendingLinkId, setSendingLinkId] = useState<number | null>(null);

  const handleSendMagicLink = async (item: any) => {
    if (!item.activo) {
      toast.error("El email está inactivo. Actívalo antes de enviar el link.");
      return;
    }
    setSendingLinkId(item.id);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: item.email }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "No se pudo enviar el link");
        return;
      }
      toast.success(`Link enviado a ${item.email}`);
    } catch (err) {
      toast.error("Error de conexión al enviar el link");
    } finally {
      setSendingLinkId(null);
    }
  };

  const handleInvalidate = useCallback(() => {
    utils.access.listAllowed.invalidate();
  }, [utils]);

  const handleToggleActive = (item: any) => {
    toggleMutation.mutate({
      id: item.id,
      activo: !item.activo,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  // Stats
  const stats = useMemo(() => {
    if (!allowedEmails) return { total: 0, admins: 0, setters: 0, closers: 0 };
    return {
      total: allowedEmails.length,
      admins: allowedEmails.filter(e => e.role === "admin").length,
      setters: allowedEmails.filter(e => e.role === "setter").length,
      closers: allowedEmails.filter(e => e.role === "closer").length,
    };
  }, [allowedEmails]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Accesos</h1>
          <p className="text-muted-foreground">
            Gestiona quién puede acceder al CRM y con qué rol
          </p>
        </div>
        {!showAddForm && !editingItem && (
          <Button
            className="gap-2"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar Email
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Emails autorizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.admins}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.setters}</p>
                <p className="text-xs text-muted-foreground">Setters</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.closers}</p>
                <p className="text-xs text-muted-foreground">Closers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline Add Form */}
      {showAddForm && (
        <AddEmailForm
          onClose={() => setShowAddForm(false)}
          onSuccess={handleInvalidate}
        />
      )}

      {/* Inline Edit Form */}
      {editingItem && (
        <EditEmailForm
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={handleInvalidate}
        />
      )}

      {/* Allowed Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Emails Autorizados
          </CardTitle>
          <CardDescription>
            Solo los emails en esta lista pueden acceder al CRM. El rol determina qué secciones pueden ver.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingEmails ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : !allowedEmails?.length ? (
            <div className="text-center py-8 space-y-2">
              <UserX className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">No hay emails autorizados aún</p>
              <p className="text-xs text-muted-foreground">
                Agrega el primer email para activar el control de accesos
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowedEmails.map((item) => (
                    <TableRow key={item.id} className={!item.activo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{item.nombre || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{item.email}</TableCell>
                      <TableCell><RoleBadge role={item.role} /></TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(item)}
                          className="cursor-pointer"
                        >
                          {item.activo ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                              Inactivo
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary"
                            onClick={() => handleSendMagicLink(item)}
                            disabled={sendingLinkId === item.id || !item.activo}
                            title={
                              item.activo
                                ? "Enviar link de acceso por correo"
                                : "Activa el email antes de enviar el link"
                            }
                          >
                            <Send className={`h-3.5 w-3.5 ${sendingLinkId === item.id ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setShowAddForm(false);
                              setEditingItem(item);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Who Have Logged In */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Usuarios Registrados
          </CardTitle>
          <CardDescription>
            Historial de usuarios que han iniciado sesión en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : !allUsers?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay usuarios registrados aún
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Último acceso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{user.email || "—"}</TableCell>
                      <TableCell><RoleBadge role={user.role} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastSignedIn
                          ? new Date(user.lastSignedIn).toLocaleString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation - using Dialog only for this critical action */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-lg">Confirmar eliminación</CardTitle>
              <CardDescription>
                ¿Estás seguro de que quieres eliminar este email de la lista de accesos?
                El usuario ya no podrá iniciar sesión en el CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
