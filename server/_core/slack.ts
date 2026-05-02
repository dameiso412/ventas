/**
 * Slack Incoming Webhook transport.
 *
 * Uses native fetch — no external library needed. No-op if SLACK_WEBHOOK_URL
 * is not configured (falls back to console.log so dev / unconfigured envs
 * don't break).
 *
 * The high-level helper `sendSlackAlert()` builds rich Block Kit messages
 * with header, items list (each with optional inline action button), fields,
 * top-level action buttons, and a context line. Designed for ops-style
 * notifications: scan-friendly, one-click to act on, severity-color-coded.
 *
 * Buttons are limited to "link buttons" (open URL on click) — Slack's
 * interactive button callbacks would require a Slack App with an
 * interactivity URL endpoint, which is out of scope for incoming-webhook
 * setups. Link buttons cover ~95% of the value (one click takes the user
 * straight to the relevant page in the CRM).
 */
import { ENV } from "./env";

type Severity = "critical" | "warning" | "success" | "info";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#e74c3c",
  warning: "#f39c12",
  success: "#2ecc71",
  info: "#3498db",
};

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "🔥",
  warning: "⚠️",
  success: "✅",
  info: "📣",
};

// Simple in-memory rate-limit queue (1 msg/sec). Keeps us under Slack's
// 1 msg/sec/webhook limit even when the cron monitor fires multiple alerts
// at once.
let sendQueue: Array<() => Promise<void>> = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (sendQueue.length > 0) {
    const job = sendQueue.shift()!;
    try {
      await job();
    } catch (err) {
      console.error("[Slack] Send failed:", err);
    }
    if (sendQueue.length > 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  draining = false;
}

export function isSlackConfigured(): boolean {
  return ENV.slackWebhookUrl.length > 0;
}

/**
 * Build an absolute CRM URL from a relative path. Used by alerts to give
 * setters/closers a one-click jump to the right page. Falls back to the
 * Railway public domain or localhost if APP_URL isn't set.
 */
export function crmLink(path: string): string {
  const base = ENV.appUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * URL helpers for the most common alert destinations. Centralized so a
 * route change in the frontend doesn't require finding every callsite.
 */
export const crmUrls = {
  lead: (leadId: number | string) => crmLink(`/contactos/todos?lead=${leadId}`),
  followUps: () => crmLink("/contactos/follow-ups"),
  confirmaciones: () => crmLink("/contactos/confirmaciones"),
  colaTrabajo: () => crmLink("/contactos/cola"),
  citas: () => crmLink("/contactos/citas"),
  auditoria: () => crmLink("/marketing/auditoria"),
  roundRobin: () => crmLink("/admin/round-robin"),
  webhookLog: () => crmLink("/admin/webhook"),
  alertas: () => crmLink("/admin/alertas"),
};

// ─── Block Kit primitives ────────────────────────────────────

type SlackText = { type: "mrkdwn" | "plain_text"; text: string; emoji?: boolean };

interface ButtonElement {
  type: "button";
  text: SlackText;
  url: string;
  style?: "primary" | "danger";
}

/**
 * One row in a list-style alert. Renders as a section block with the
 * markdown text and (optionally) a "Ver" button on the right that opens
 * the relevant CRM page. Use this for alerts like "12 follow-ups vencidos"
 * where each item should be actionable.
 */
export interface AlertItem {
  /** Markdown line, typically a bullet ("• *Nombre* — detalle"). */
  text: string;
  /** If set, a button is added on the right side of the row. */
  actionUrl?: string;
  /** Button label when actionUrl is set. Defaults to "Ver". */
  actionLabel?: string;
}

/**
 * Top-level action button (one of up to 5 in the actions block at the
 * bottom of the alert). Two variants:
 *   - **Link button** — `url` set, opens the URL in browser. Works without
 *     any Slack App setup.
 *   - **Interactive button** — `actionId` set (no `url`), Slack POSTs to
 *     /api/slack/interactive when clicked. Requires SLACK_BOT_TOKEN +
 *     SLACK_SIGNING_SECRET (see docs/slack-app-setup.md). Without those
 *     env vars set, interactive buttons are silently downgraded to
 *     link buttons (when a fallback `url` is also provided) or omitted.
 */
export interface AlertAction {
  label: string;
  /** Link button — clicking opens this URL. */
  url?: string;
  /** Interactive button — clicking POSTs to /api/slack/interactive with
   *  this action_id. Format: "{accion}:{targetId}" or
   *  "snooze:{alertKey}:{minutes}". */
  actionId?: string;
  /** Optional value sent alongside actionId (defaults to actionId itself). */
  value?: string;
  style?: "primary" | "danger";
  /** Optional emoji prepended to the label (e.g. "🔗"). */
  emoji?: string;
}

export interface AlertField {
  label: string;
  value: string;
}

export interface AlertOpts {
  severity: Severity;
  title: string;
  /** Free-text body (markdown). Rendered above the items list when both exist. */
  body?: string;
  /** 2-column key:value list. Best for "metadata" — origin, owner, timestamp. */
  fields?: AlertField[];
  /** List items, each with optional inline action button. Truncated at 8 visible. */
  items?: AlertItem[];
  /** When items are truncated, this label goes on a "Ver todos" button. */
  itemsTruncatedActionUrl?: string;
  itemsTruncatedActionLabel?: string;
  /** Top-level link buttons (max 5). */
  actions?: AlertAction[];
  /** Override the auto-prepended severity emoji in the header. */
  emoji?: string;
}

const MAX_ITEMS_VISIBLE = 8;
const MAX_ACTIONS = 5;

function header(severity: Severity, title: string, customEmoji?: string): object {
  const emoji = customEmoji ?? SEVERITY_EMOJI[severity];
  // Slack header blocks use plain_text only (no markdown, no emoji shortcodes
  // beyond unicode). We prepend the unicode emoji directly.
  const headerText = `${emoji} ${title}`.slice(0, 150);
  return {
    type: "header",
    text: { type: "plain_text", text: headerText, emoji: true },
  };
}

function divider(): object {
  return { type: "divider" };
}

function bodySection(text: string): object {
  return {
    type: "section",
    text: { type: "mrkdwn", text },
  };
}

function fieldsSection(fields: AlertField[]): object {
  // Slack supports up to 10 fields per section; we cap at 10 to be safe.
  return {
    type: "section",
    fields: fields.slice(0, 10).map((f) => ({
      type: "mrkdwn",
      text: `*${f.label}:*\n${f.value}`,
    })),
  };
}

function itemSection(item: AlertItem): object {
  const block: any = {
    type: "section",
    text: { type: "mrkdwn", text: item.text },
  };
  if (item.actionUrl) {
    block.accessory = {
      type: "button",
      text: { type: "plain_text", text: item.actionLabel ?? "Ver" },
      url: item.actionUrl,
    } as ButtonElement;
  }
  return block;
}

function actionsBlock(actions: AlertAction[]): object {
  const interactiveEnabled = ENV.slackBotToken.length > 0 && ENV.slackSigningSecret.length > 0;

  const elements: ButtonElement[] = [];
  for (const a of actions.slice(0, MAX_ACTIONS)) {
    const labelText = a.emoji ? `${a.emoji} ${a.label}` : a.label;

    // Decide button shape:
    //   1. Has actionId AND interactive enabled → real interactive button.
    //   2. Has actionId but interactive disabled AND has url → link button (fallback).
    //   3. Has actionId, no url, no interactive → skip (would be a no-op).
    //   4. Has only url → link button (current behavior).
    if (a.actionId && interactiveEnabled) {
      const btn: any = {
        type: "button",
        text: { type: "plain_text", text: labelText },
        action_id: a.actionId,
        value: a.value ?? a.actionId,
        ...(a.style ? { style: a.style } : {}),
      };
      // Slack interactive buttons can ALSO have a URL — opens it AND fires
      // the event. We don't use that pattern (would race with our handler).
      elements.push(btn as ButtonElement);
    } else if (a.url) {
      elements.push({
        type: "button",
        text: { type: "plain_text", text: labelText },
        url: a.url,
        ...(a.style ? { style: a.style } : {}),
      });
    } else if (a.actionId) {
      // Interactive button requested but no fallback URL and no Slack App
      // setup — skip silently. Logged once per session for visibility.
      console.warn(`[Slack] Skipping interactive button "${a.label}" — no SLACK_BOT_TOKEN/SIGNING_SECRET configured`);
    }
  }
  return { type: "actions", elements };
}

function contextBlock(): object {
  const now = new Date().toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "short",
  });
  return {
    type: "context",
    elements: [
      { type: "mrkdwn", text: `🤖 SacaMedi CRM • ${now}` },
    ],
  };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Low-level: send Block Kit blocks to Slack. Consumers should prefer
 * `sendSlackAlert()` unless they need full control over the layout.
 */
export async function sendSlackMessage(
  blocks: object[],
  text: string,
  attachmentColor?: string,
): Promise<boolean> {
  if (!isSlackConfigured()) {
    console.log(`[Slack] (not configured) ${text}`);
    return false;
  }

  const payload = attachmentColor
    ? { text, attachments: [{ color: attachmentColor, blocks }] }
    : { text, blocks };

  return new Promise<boolean>((resolve) => {
    sendQueue.push(async () => {
      try {
        const res = await fetch(ENV.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.error(`[Slack] HTTP ${res.status}: ${await res.text()}`);
          resolve(false);
        } else {
          resolve(true);
        }
      } catch (err) {
        console.error("[Slack] Fetch error:", err);
        resolve(false);
      }
    });
    drain();
  });
}

/**
 * Build and send a rich, professional alert.
 *
 * Visual structure (top to bottom):
 *   ┌──────────────────────────────┐
 *   │ [Color bar]                  │
 *   │ HEADER — emoji + title       │
 *   │ ─────────────────────────    │ (divider, only if body or items)
 *   │ Body text (optional)         │
 *   │ • Item 1            [Ver]    │ (only if items)
 *   │ • Item 2            [Ver]    │
 *   │ ...y N más                   │
 *   │ [Field A]    [Field B]       │ (only if fields)
 *   │ [Btn 1] [Btn 2] [Btn 3]      │ (only if actions)
 *   │ 🤖 SacaMedi CRM • 14:30      │
 *   └──────────────────────────────┘
 *
 * Backward-compatible with the original `{ severity, title, body, fields }`
 * call shape — existing callsites work without changes.
 */
export async function sendSlackAlert(opts: AlertOpts): Promise<boolean> {
  const { severity, title, body, fields, items, actions, emoji } = opts;
  const blocks: object[] = [header(severity, title, emoji)];

  // Body section (free-text)
  if (body && body.trim().length > 0) {
    blocks.push(divider());
    blocks.push(bodySection(body));
  }

  // Items list — each row optionally has an inline button. We cap visible
  // items at MAX_ITEMS_VISIBLE so one alert can't blow up the channel; the
  // rest are summarized with a "...y N más" line and an optional "Ver todos"
  // CTA button at the bottom.
  if (items && items.length > 0) {
    if (!body) blocks.push(divider());
    const visible = items.slice(0, MAX_ITEMS_VISIBLE);
    const hidden = items.length - visible.length;
    for (const it of visible) blocks.push(itemSection(it));
    if (hidden > 0) {
      blocks.push(bodySection(`_...y ${hidden} más_`));
    }
  }

  if (fields && fields.length > 0) {
    blocks.push(divider());
    blocks.push(fieldsSection(fields));
  }

  // Action buttons. Auto-append a "Ver todos" button when items were
  // truncated, unless the caller already provided an explicit action that
  // covers it.
  const allActions: AlertAction[] = [...(actions ?? [])];
  if (
    items
    && items.length > MAX_ITEMS_VISIBLE
    && opts.itemsTruncatedActionUrl
    && !allActions.some((a) => a.url === opts.itemsTruncatedActionUrl)
  ) {
    allActions.push({
      label: opts.itemsTruncatedActionLabel ?? "Ver todos",
      url: opts.itemsTruncatedActionUrl,
      emoji: "📋",
    });
  }
  if (allActions.length > 0) {
    blocks.push(divider());
    blocks.push(actionsBlock(allActions));
  }

  blocks.push(contextBlock());

  // Plain-text fallback for notifications (lock screen, etc).
  const fallback = `[${severity.toUpperCase()}] ${title}`;
  return sendSlackMessage(blocks, fallback, SEVERITY_COLOR[severity]);
}
