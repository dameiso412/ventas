import { TRPCError } from "@trpc/server";
import { sendSlackAlert, isSlackConfigured, crmUrls, type AlertAction } from "./slack";

export type NotificationPayload = {
  title: string;
  content: string;
  /** Severity level. Defaults to "warning" for backward compat. */
  severity?: "critical" | "warning" | "success" | "info";
  /** Optional action buttons for the alert. When omitted, sensible defaults
   *  are picked based on whether the title hints at a webhook error. */
  actions?: AlertAction[];
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Send a notification to the owner via Slack.
 *
 * Auto-adds an "Abrir Webhooks" action button when the title looks like a
 * webhook error, so the operator can jump straight to the log inspection
 * panel without hunting through the menu. Other callers can pass `actions`
 * explicitly to override.
 *
 * Falls back to console.log if Slack is not configured.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  if (!isNonEmptyString(payload.title) || !isNonEmptyString(payload.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title and content are required.",
    });
  }

  if (!isSlackConfigured()) {
    console.log(`[Notification] ${payload.title}: ${payload.content}`);
    return false;
  }

  // Auto-add a "Webhooks" CTA when the alert is clearly about a webhook
  // problem — the operator's first move is to inspect the raw payload.
  const isWebhookError = /webhook/i.test(payload.title);
  const defaultActions: AlertAction[] = isWebhookError
    ? [{ label: "Abrir Webhook Log", url: crmUrls.webhookLog(), emoji: "📡", style: "primary" }]
    : [];

  return sendSlackAlert({
    severity: payload.severity ?? "warning",
    title: payload.title,
    body: payload.content,
    actions: payload.actions ?? defaultActions,
  });
}
