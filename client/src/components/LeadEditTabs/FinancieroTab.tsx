import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { LeadForm } from "./leadEditState";

interface FinancieroTabProps {
  form: LeadForm;
  setField: <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</Label>;
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background/50 pl-6"
        placeholder={placeholder ?? "0.00"}
      />
    </div>
  );
}

export function FinancieroTab({ form, setField }: FinancieroTabProps) {
  return (
    <div className="space-y-5">
      {/* Tipo de producto */}
      <div className="space-y-1.5">
        <FieldLabel>Tipo de producto</FieldLabel>
        <SegmentedControl
          value={form.productoTipo || "NONE"}
          onChange={(v) => setField("productoTipo", v === "NONE" ? "" : v)}
          fullWidth
          options={[
            { value: "NONE", label: "Sin especificar", activeClass: "text-muted-foreground" },
            { value: "PIF", label: "PIF (pago completo)", activeClass: "text-green-400" },
            { value: "SETUP_MONTHLY", label: "Setup + Monthly", activeClass: "text-purple-400" },
          ]}
        />
      </div>

      {form.productoTipo === "PIF" && (
        <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 space-y-3">
          <p className="text-xs text-green-400 font-medium">Pago completo por adelantado (2+ meses)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cash Collected (USD)</FieldLabel>
              <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Contracted Revenue (USD)</FieldLabel>
              <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Depósito (USD)</FieldLabel>
              <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Facturado (USD)</FieldLabel>
              <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
            </div>
          </div>
        </div>
      )}

      {form.productoTipo === "SETUP_MONTHLY" && (
        <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-3">
          <p className="text-xs text-purple-400 font-medium">Implementación + recurrencia mensual</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Setup Fee (USD)</FieldLabel>
              <MoneyInput value={form.setupFee} onChange={(v) => setField("setupFee", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Recurrencia Mensual (USD)</FieldLabel>
              <MoneyInput value={form.recurrenciaMensual} onChange={(v) => setField("recurrenciaMensual", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cash Collected (USD)</FieldLabel>
              <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Contracted Revenue (USD)</FieldLabel>
              <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Depósito (USD)</FieldLabel>
              <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Fecha próximo cobro</FieldLabel>
              <Input
                type="date"
                value={form.fechaProximoCobro}
                onChange={(e) => setField("fechaProximoCobro", e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <FieldLabel>Facturado (USD)</FieldLabel>
              <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
            </div>
          </div>
        </div>
      )}

      {!form.productoTipo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Facturado (USD)</FieldLabel>
            <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Cash Collected (USD)</FieldLabel>
            <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Depósito (USD)</FieldLabel>
            <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Contracted Revenue (USD)</FieldLabel>
            <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
          </div>
        </div>
      )}
    </div>
  );
}
