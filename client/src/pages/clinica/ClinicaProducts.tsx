import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Package, Plus, Edit2, Trash2, Loader2, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function ClinicaProducts() {
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const orgQuery = trpc.clinica.organization.getDefault.useQuery();
  const orgId = orgQuery.data?.id || "";

  const productsQuery = trpc.clinica.products.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const createMutation = trpc.clinica.products.create.useMutation({
    onSuccess: () => {
      productsQuery.refetch();
      toast.success("Producto creado");
      resetForm();
      setShowCreate(false);
    },
  });

  const updateMutation = trpc.clinica.products.update.useMutation({
    onSuccess: () => {
      productsQuery.refetch();
      toast.success("Producto actualizado");
      resetForm();
      setEditProduct(null);
    },
  });

  const deleteMutation = trpc.clinica.products.delete.useMutation({
    onSuccess: () => {
      productsQuery.refetch();
      toast.success("Producto eliminado");
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
  };

  const handleCreate = () => {
    if (!name || !orgId) return;
    createMutation.mutate({
      organizationId: orgId,
      name,
      description: description || undefined,
      price: price || undefined,
    });
  };

  const handleEdit = (product: any) => {
    setEditProduct(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(String(product.price || ""));
  };

  const handleUpdate = () => {
    if (!editProduct || !name) return;
    updateMutation.mutate({
      id: editProduct.id,
      data: { name, description, price },
    });
  };

  const products = (productsQuery.data || []).filter(p => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-pink-400" />
            Productos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalogo de tratamientos y productos de la clinica
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-pink-600 hover:bg-pink-700" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Producto
        </Button>
      </div>

      {productsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
        </div>
      ) : products.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">No hay productos creados.</p>
              <p className="text-xs mt-1">Crea un producto para ofrecerlo como upsell a pacientes.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <Card key={product.id} className="bg-card/50 border-border/50 hover:border-pink-500/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-pink-500/10 flex items-center justify-center">
                      <Package className="h-4 w-4 text-pink-400" />
                    </div>
                    <h3 className="font-semibold text-sm">{product.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(product)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate({ id: product.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {product.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-green-400" />
                  <span className="font-semibold text-green-400">${Number(product.price).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showCreate || !!editProduct} onOpenChange={() => { setShowCreate(false); setEditProduct(null); resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-pink-400" />
              {editProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              {editProduct ? "Modifica los datos del producto" : "Agrega un nuevo producto al catalogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tratamiento facial..." />
            </div>
            <div>
              <Label className="text-xs">Descripcion</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripcion del producto..." rows={2} />
            </div>
            <div>
              <Label className="text-xs">Precio</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setEditProduct(null); resetForm(); }}>Cancelar</Button>
              <Button
                onClick={editProduct ? handleUpdate : handleCreate}
                disabled={!name || createMutation.isPending || updateMutation.isPending}
                className="bg-pink-600 hover:bg-pink-700"
              >
                {editProduct ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
