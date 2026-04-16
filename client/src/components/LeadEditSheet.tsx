import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeadEditHeader, type AutosaveStatus } from "@/components/LeadEditHeader";
import { PipelineTab } from "@/components/LeadEditTabs/PipelineTab";
import { LlamadasTab } from "@/components/LeadEditTabs/LlamadasTab";
import { FinancieroTab } from "@/components/LeadEditTabs/FinancieroTab";
import { DatosTab } from "@/components/LeadEditTabs/DatosTab";
import {
  buildInitialLeadForm,
  sanitizeLeadPatch,
  type LeadForm,
} from "@/components/LeadEditTabs/leadEditState";
import { Target, DollarSign, Phone, User } from "lucide-react";
import { toast } from "sonner";

interface LeadEditSheetProps {
  lead: any | null;
  onOpenChange: (open: boolean) => void;
  onNoShow?: (lead: any) => void;
}

const DEBOUNCE_MS = 800;

/**
 * Side-sheet editor for a lead. Replaces the centered Dialog previously in
 * Citas.tsx. Manages form state + debounced autosave + save status. Tabs
 * divide the (previously monolithic) form into Pipeline, Llamadas,
 * Financiero, Datos to keep vertical height under control.
 */
export function LeadEditSheet({ lead, onOpenChange, onNoShow }: LeadEditSheetProps) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"pipeline" | "llamadas" | "financiero" | "datos">("pipeline");
  const [form, setForm] = useState<LeadForm>(() => (lead ? buildInitialLeadForm(lead) : ({} as LeadForm)));

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Pending patch buffer — fields that changed but not yet persisted
  const pendingRef = useRef<Partial<LeadForm>>({});
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.dashboard.kpis.invalidate();
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
      inFlightRef.current = false;
      // Flush any patches queued during the in-flight request
      if (Object.keys(pendingRef.current).length > 0) {
        flushNow();
      }
    },
    onError: (err) => {
      console.error("[LeadEditSheet] save failed", err);
      toast.error(`No se pudo guardar: ${err.message}`);
      setSaveStatus("error");
      inFlightRef.current = false;
    },
  });

  // Re-initialize when lead changes (open another lead or reopen)
  useEffect(() => {
    if (!lead) return;
    setForm(buildInitialLeadForm(lead));
    setActiveTab("pipeline");
    setSaveStatus("idle");
    setLastSavedAt(null);
    pendingRef.current = {};
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  // Fade "Guardado" → "idle" after a few seconds
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 3500);
    return () => window.clearTimeout(t);
  }, [saveStatus, lastSavedAt]);

  const flushNow = useCallback(() => {
    if (!lead) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const patch = pendingRef.current;
    if (!patch || Object.keys(patch).length === 0) return;
    if (inFlightRef.current) return; // will re-trigger from onSuccess
    pendingRef.current = {};
    const payload = sanitizeLeadPatch(patch);
    inFlightRef.current = true;
    setSaveStatus("saving");
    updateMutation.mutate({ id: lead.id, data: payload });
  }, [lead, updateMutation]);

  const scheduleSave = useCallback(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      flushNow();
    }, DEBOUNCE_MS);
  }, [flushNow]);

  const setField = useCallback(
    <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      pendingRef.current = { ...pendingRef.current, [field]: value };
      setSaveStatus("saving");
      scheduleSave();
    },
    [scheduleSave]
  );

  // Cmd/Ctrl + S → flush immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flushNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flushNow]);

  // Before closing: force flush
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        flushNow();
      }
      onOpenChange(open);
    },
    [flushNow, onOpenChange]
  );

  const open = !!lead;

  const tabs = useMemo(
    () =>
      [
        { value: "pipeline", label: "Pipeline", icon: Target },
        { value: "llamadas", label: "Llamadas", icon: Phone },
        { value: "financiero", label: "Financiero", icon: DollarSign },
        { value: "datos", label: "Datos", icon: User },
      ] as const,
    []
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-none sm:!w-[900px] lg:!w-[980px] p-0 flex flex-col gap-0"
      >
        {/* Visually-hidden title for a11y — header has its own visible h2 */}
        <SheetTitle className="sr-only">Editar lead</SheetTitle>

        {lead && (
          <>
            <LeadEditHeader
              lead={lead}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              onClose={() => handleOpenChange(false)}
            />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <div className="px-5 pt-3 pb-1 border-b border-border/30">
                <TabsList className="bg-muted/30 border border-border/30 p-1 h-auto flex flex-wrap gap-1">
                  {tabs.map((t) => {
                    const Icon = t.icon;
                    return (
                      <TabsTrigger
                        key={t.value}
                        value={t.value}
                        className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-xs"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-5">
                  <TabsContent value="pipeline" className="mt-0 focus-visible:outline-none">
                    <PipelineTab
                      form={form}
                      setField={setField}
                      onNoShow={() => onNoShow?.(lead)}
                    />
                  </TabsContent>

                  <TabsContent value="llamadas" className="mt-0 focus-visible:outline-none">
                    <LlamadasTab lead={lead} form={form} setField={setField} />
                  </TabsContent>

                  <TabsContent value="financiero" className="mt-0 focus-visible:outline-none">
                    <FinancieroTab form={form} setField={setField} />
                  </TabsContent>

                  <TabsContent value="datos" className="mt-0 focus-visible:outline-none">
                    <DatosTab lead={lead} form={form} setField={setField} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default LeadEditSheet;
