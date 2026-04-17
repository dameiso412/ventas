/**
 * Stripe client + helpers.
 *
 * Lazy-initialises the SDK on first use so the app boots even when the env
 * vars are missing (which happens in dev / preview / before the user wires
 * the integration). All functions return plain shapes or throw — no Stripe
 * types leak out of this file; callers get a normalized `ParsedStripePayment`.
 *
 * The shape we normalize to is the same for historical imports (via
 * `listHistoricalCharges`) and live webhook events (via `parseChargeEvent` /
 * `parseCheckoutSession`) so `db.upsertStripePayment` doesn't need to know
 * which source sent the data.
 */
import Stripe from "stripe";
import { ENV } from "./_core/env";

let _client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_client) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _client = new Stripe(ENV.stripeSecretKey, {
      // apiVersion left to SDK default to avoid pinning a moving target.
      typescript: true,
      appInfo: {
        name: "sacamedi-crm",
        version: "1.0.0",
      },
    });
  }
  return _client;
}

export function isStripeConfigured(): boolean {
  return !!ENV.stripeSecretKey;
}

// ==================== TYPES ====================

export type ParsedStripeStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "canceled";

/**
 * Normalized shape for a single Stripe payment. Everything the DB needs
 * to upsert a row in `stripe_payments` with no further Stripe API calls.
 */
export interface ParsedStripePayment {
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  stripeCheckoutSessionId: string | null;
  amount: number;                    // in currency-native units (not cents)
  amountRefunded: number;
  currency: string;
  status: ParsedStripeStatus;
  paymentMethodBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  rawMetadata: Record<string, string> | null;
  stripeCreatedAt: Date;
}

// ==================== NORMALIZATION ====================

/** Convert cents (Stripe's integer) to currency-native decimal. */
function centsToAmount(cents: number | null | undefined, currency?: string | null): number {
  const c = cents ?? 0;
  // Zero-decimal currencies Stripe doesn't cent-encode (JPY, KRW, etc.)
  const zeroDecimal = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
  if (currency && zeroDecimal.has(currency.toLowerCase())) return c;
  return c / 100;
}

function deriveChargeStatus(charge: Stripe.Charge): ParsedStripeStatus {
  if (charge.disputed) return "disputed";
  if (charge.refunded) return "refunded";
  if ((charge.amount_refunded ?? 0) > 0) return "partially_refunded";
  if (charge.status === "succeeded") return "succeeded";
  if (charge.status === "failed") return "failed";
  if (charge.status === "pending") return "pending";
  return "succeeded";
}

/**
 * Flatten a Stripe.Charge → our normalized shape. Works for both the initial
 * charge.succeeded event and any subsequent state-change events (refunds,
 * disputes) — we always emit the current end-state snapshot.
 */
export function parseCharge(charge: Stripe.Charge): ParsedStripePayment {
  const paymentMethod = (charge.payment_method_details as any) || {};
  const card = paymentMethod.card || {};
  const billing = charge.billing_details || {};
  // Stripe types treat some fields as optional per-version; cast to any for
  // the fields we read defensively (invoice, customer expansions).
  const chargeAny = charge as any;
  const customerObj = typeof chargeAny.customer === "object" && chargeAny.customer !== null
    && !(chargeAny.customer as any).deleted
    ? (chargeAny.customer as { id?: string; email?: string; name?: string })
    : null;

  return {
    stripeChargeId: charge.id,
    stripePaymentIntentId: typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : chargeAny.payment_intent?.id ?? null,
    stripeCustomerId: typeof chargeAny.customer === "string"
      ? chargeAny.customer
      : customerObj?.id ?? null,
    stripeInvoiceId: typeof chargeAny.invoice === "string"
      ? chargeAny.invoice
      : chargeAny.invoice?.id ?? null,
    stripeCheckoutSessionId: null,
    amount: centsToAmount(charge.amount, charge.currency),
    amountRefunded: centsToAmount(charge.amount_refunded, charge.currency),
    currency: charge.currency,
    status: deriveChargeStatus(charge),
    paymentMethodBrand: card.brand ?? paymentMethod.type ?? null,
    last4: card.last4 ?? null,
    receiptUrl: charge.receipt_url ?? null,
    customerEmail: charge.receipt_email || billing.email || customerObj?.email || null,
    customerName: billing.name || customerObj?.name || null,
    description: charge.description ?? null,
    rawMetadata: (charge.metadata as Record<string, string>) ?? null,
    stripeCreatedAt: new Date(charge.created * 1000),
  };
}

/**
 * Parse a Checkout Session (from `checkout.session.completed`) into a payment
 * row. Checkout sessions carry the custom `metadata.leadId` we set when
 * generating the payment link from the CRM — making match instant and
 * deterministic without needing to look at email.
 */
export async function parseCheckoutSession(session: Stripe.Checkout.Session): Promise<ParsedStripePayment | null> {
  const client = getStripeClient();
  // Expand the related payment_intent → latest_charge so we have the actual
  // charge details (brand, last4, receipt_url). A session w/o a payment intent
  // (e.g. subscription signup where no immediate charge happens) returns null.
  const piId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  if (!piId) return null;

  const pi = await client.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
  const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge as Stripe.Charge | null;
  if (!charge) return null;

  const base = parseCharge(charge);
  base.stripeCheckoutSessionId = session.id;
  // Prefer session-level customer email (it's what the buyer typed at checkout)
  if (session.customer_details?.email) base.customerEmail = session.customer_details.email;
  if (session.customer_details?.name) base.customerName = session.customer_details.name;
  // Merge session metadata on top of charge metadata — session.metadata wins.
  if (session.metadata && Object.keys(session.metadata).length > 0) {
    base.rawMetadata = { ...(base.rawMetadata ?? {}), ...(session.metadata as Record<string, string>) };
  }
  return base;
}

// ==================== QUERIES ====================

/**
 * List charges created within the last `sinceDays` days. Paginates across
 * Stripe's 100-per-page cap. Used by the one-shot historical sync; keep
 * `sinceDays` small the first time to avoid nuking rate limits.
 */
export async function listHistoricalCharges(sinceDays: number = 180): Promise<ParsedStripePayment[]> {
  const client = getStripeClient();
  const sinceTs = Math.floor((Date.now() - sinceDays * 86400 * 1000) / 1000);
  const results: ParsedStripePayment[] = [];
  let startingAfter: string | undefined = undefined;

  for (let page = 0; page < 100; page++) {  // hard cap: 100 pages = 10k charges
    const resp: Stripe.ApiList<Stripe.Charge> = await client.charges.list({
      limit: 100,
      created: { gte: sinceTs },
      starting_after: startingAfter,
      expand: ["data.customer"],
    });
    for (const charge of resp.data) {
      results.push(parseCharge(charge));
    }
    if (!resp.has_more || resp.data.length === 0) break;
    startingAfter = resp.data[resp.data.length - 1].id;
  }

  return results;
}

/**
 * Verify the webhook signature using the endpoint secret. Throws if invalid.
 * Call with the RAW request body (Buffer or string) — Express's JSON parser
 * will break the signature, so the route uses `express.raw(...)`.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): Stripe.Event {
  const client = getStripeClient();
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured — cannot verify webhook signature");
  }
  return client.webhooks.constructEvent(rawBody, signature, ENV.stripeWebhookSecret);
}

/**
 * Create a Stripe Checkout Session pre-populated with a CRM lead reference in
 * metadata. When the payment completes, the webhook reads `metadata.leadId`
 * and links the payment directly — no guessing, no email matching.
 */
export async function createCheckoutSession(params: {
  leadId: number;
  amount: number;              // in currency-native units
  currency?: string;
  description: string;
  productType?: "PIF" | "SETUP_MONTHLY";
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const client = getStripeClient();
  const currency = (params.currency ?? ENV.stripeCurrency).toLowerCase();
  const zeroDecimal = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
  const unitAmount = zeroDecimal.has(currency)
    ? Math.round(params.amount)
    : Math.round(params.amount * 100);

  const session = await client.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency,
        unit_amount: unitAmount,
        product_data: { name: params.description },
      },
      quantity: 1,
    }],
    metadata: {
      leadId: String(params.leadId),
      crmSource: "sacamedi",
      ...(params.productType ? { productType: params.productType } : {}),
    },
    ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) throw new Error("Stripe did not return a session URL");
  return { url: session.url, sessionId: session.id };
}

/**
 * Lightweight credential check — lets the UI show "Stripe conectado" or
 * a helpful error without needing to run a full sync first.
 */
export async function validateStripeConnection(): Promise<{ ok: boolean; accountId?: string; error?: string }> {
  try {
    const client = getStripeClient();
    // `accounts.retrieve()` without args is the v22-SDK way to read the
    // account behind the current secret key. Cast handles the generic args
    // mismatch between SDK minor versions.
    const account = await (client.accounts as any).retrieve();
    return { ok: true, accountId: account.id };
  } catch (err: any) {
    return { ok: false, error: err.message || "Unknown error" };
  }
}
