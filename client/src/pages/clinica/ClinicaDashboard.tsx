import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Stethoscope, Users, DollarSign, TrendingUp, Plus, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import PatientCard from "@/components/clinica/PatientCard";
import AssignOwnerModal from "@/components/clinica/AssignOwnerModal";
import UpsellDecisionModal from "@/components/clinica/UpsellDecisionModal";
import LossReasonModal from "@/components/clinica/LossReasonModal";
import EditPatientModal from "@/components/clinica/EditPatientModal";
import type { ClinicPatient } from "../../../../drizzle/schema";

export default function ClinicaDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("pending");

  // Modal states
  const [assignModal, setAssignModal] = useState<ClinicPatient | null>(null);
  const [upsellModal, setUpsellModal] = useState<ClinicPatient | null>(null);
  const [lossModal, setLossModal] = useState<{ patient: ClinicPatient; type: "no_show" | "no_sale" | "cancelled" } | null>(null);
  const [editModal, setEditModal] = useState<ClinicPatient | null>(null);

  // Get default org
  const orgQuery = trpc.clinica.organization.getDefault.useQuery();
  const orgId = orgQuery.data?.id || "";

  // Patients query
  const patientsQuery = trpc.clinica.patients.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  // KPIs
  const kpisQuery = trpc.clinica.analytics.kpis.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  // Members (for assign modal)
  const membersQuery = trpc.clinica.members.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  // Products (for upsell modal)
  const productsQuery = trpc.clinica.products.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  // Mutations
  const updateMutation = trpc.clinica.patients.update.useMutation({
    onSuccess: () => {
      patientsQuery.refetch();
      kpisQuery.refetch();
      toast.success("Paciente actualizado");
    },
  });

  const lossReasonMutation = trpc.clinica.lossReasons.create.useMutation({
    onSuccess: () => {
      patientsQuery.refetch();
      toast.success("Razon de perdida registrada");
    },
  });

  const patients = patientsQuery.data || [];
  const kpis = kpisQuery.data;

  const pendingPatients = patients.filter(p => p.status === "pending");
  const incompletePatients = patients.filter(p => p.status === "incomplete");
  const completedPatients = patients.filter(p => p.status === "completed");

  const handleAssignOwner = (ownerId: string) => {
    if (!assignModal) return;
    updateMutation.mutate({
      id: assignModal.id,
      data: { ownerId, status: "incomplete" },
    });
    setAssignModal(null);
  };

  const handleMarkAttendance = (patient: ClinicPatient, attended: boolean) => {
    updateMutation.mutate({
      id: patient.id,
      data: { attended },
    });
    if (!attended) {
      setLossModal({ patient, type: "no_show" });
    }
  };

  const handleUpsellDecision = (decision: string, data: { productId?: string; price?: string; notes?: string }) => {
    if (!upsellModal) return;
    updateMutation.mutate({
      id: upsellModal.id,
      data: {
        upsellDecision: decision,
        upsellProductId: data.productId || null,
        upsellPrice: data.price || null,
        upsellNotes: data.notes || null,
        purchased: decision === "completed",
      },
    });
    setUpsellModal(null);
  };

  const handleComplete = (patient: ClinicPatient) => {
    updateMutation.mutate({
      id: patient.id,
      data: { status: "completed" },
    });
  };

  const handleEditSave = (data: Record<string, any>) => {
    if (!editModal) return;
    updateMutation.mutate({
      id: editModal.id,
      data,
    });
    setEditModal(null);
  };

  const handleLossReasonSubmit = (data: { category: string; subcategory: string; lossType: string; notes?: string; estimatedValue?: string }) => {
    if (!lossModal || !orgId) return;
    lossReasonMutation.mutate({
      patientId: lossModal.patient.id,
      organizationId: orgId,
      ...data,
    });
    setLossModal(null);
  };

  const handleViewLead = (leadId: number) => {
    // Switch to pipeline mode and navigate to citas with the lead
    setLocation(`/citas`);
  };

  if (!orgId && !orgQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-pink-400" />
            Pacientes
          </h1>
        </div>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Stethoscope className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">No hay organizacion clinica configurada.</p>
              <p className="text-xs mt-1">Configura una organizacion en Configuracion para comenzar.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-pink-400" />
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion post-venta de pacientes en clinica
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-pink-400" />
              <span className="text-xs text-muted-foreground">Total Pacientes</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.totalPatients ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-2xl font-bold">${(kpis?.totalRevenue ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Attendance Rate</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.attendanceRate ?? 0}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.conversionRate ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Nuevos
            {pendingPatients.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{pendingPatients.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incomplete" className="gap-1.5">
            En Proceso
            {incompletePatients.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{incompletePatients.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            Completados
            {completedPatients.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{completedPatients.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {patientsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
          </div>
        ) : (
          <>
            <TabsContent value="pending">
              {pendingPatients.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Stethoscope className="h-12 w-12 mb-4 opacity-30" />
                      <p className="text-sm">No hay pacientes pendientes.</p>
                      <p className="text-xs mt-1">Los pacientes se crean automaticamente al cerrar ventas en el pipeline.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {pendingPatients.map(p => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      onAssignOwner={setAssignModal}
                      onMarkAttendance={handleMarkAttendance}
                      onUpsellDecision={setUpsellModal}
                      onComplete={handleComplete}
                      onEdit={setEditModal}
                      onViewLead={handleViewLead}
                      onNoSale={patient => setLossModal({ patient, type: "no_sale" })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="incomplete">
              {incompletePatients.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p className="text-sm">No hay pacientes en proceso.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {incompletePatients.map(p => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      onAssignOwner={setAssignModal}
                      onMarkAttendance={handleMarkAttendance}
                      onUpsellDecision={setUpsellModal}
                      onComplete={handleComplete}
                      onEdit={setEditModal}
                      onViewLead={handleViewLead}
                      onNoSale={patient => setLossModal({ patient, type: "no_sale" })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {completedPatients.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p className="text-sm">No hay pacientes completados.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {completedPatients.map(p => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      onAssignOwner={setAssignModal}
                      onMarkAttendance={handleMarkAttendance}
                      onUpsellDecision={setUpsellModal}
                      onComplete={handleComplete}
                      onEdit={setEditModal}
                      onViewLead={handleViewLead}
                      onNoSale={patient => setLossModal({ patient, type: "no_sale" })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Modals */}
      <AssignOwnerModal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        onAssign={handleAssignOwner}
        members={membersQuery.data || []}
        patientName={assignModal?.patientName || ""}
      />

      <UpsellDecisionModal
        open={!!upsellModal}
        onClose={() => setUpsellModal(null)}
        onDecision={handleUpsellDecision}
        products={(productsQuery.data || []).map(p => ({ id: p.id, name: p.name, price: String(p.price) }))}
        patientName={upsellModal?.patientName || ""}
      />

      {lossModal && (
        <LossReasonModal
          open={!!lossModal}
          onClose={() => setLossModal(null)}
          onSubmit={handleLossReasonSubmit}
          patientName={lossModal.patient.patientName}
          lossType={lossModal.type}
        />
      )}

      <EditPatientModal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        onSave={handleEditSave}
        patient={editModal}
      />
    </div>
  );
}
