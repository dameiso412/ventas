/**
 * Slack Incoming Webhook transport.
 * Uses native fetch — no external library needed.
 * No-op if SLACK_WEBHOOK_URL is not configured.
 */
import { ENV } from "./env";

type Severity = "critical" | "warning" | "success" | "info";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#e74c3c",
  warning: "#f39c12",
  success: "#2ecc71",
  info: "#3498db",
};

// Simple in-memory rate-limit queue (1 msg/sec)
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
 * Low-level: send Block Kit blocks to Slack.
 */
export async function sendSlackMessage(
  blocks: object[],
  text: string
): Promise<boolean> {
  if (!isSlackConfigured()) {
    console.log(`[Slack] (not configured) ${text}`);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    sendQueue.push(async () => {
      try {
        const res = await fetch(ENV.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks, text }),
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
 * High-level helper: send a formatted alert with severity color bar.
 */
export async function sendSlackAlert({
  severity,
  title,
  body,
  fields,
}: {
  severity: Severity;
  title: string;
  body: string;
  fields?: { label: string; value: string }[];
}): Promise<boolean> {
  const now = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
  const color = SEVERITY_COLOR[severity];

  const blocks: object[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${title}*\n${body}` },
    },
  ];

  if (fields && fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.label}:* ${f.value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `SacaMedi KPI Monitor \u2022 ${now}` },
    ],
  });

  // Wrap in attachment for color bar
  const payload = {
    attachments: [{ color, blocks }],
    text: `[${severity.toUpperCase()}] ${title}`,
  };

  if (!isSlackConfigured()) {
    console.log(`[Slack] (not configured) [${severity}] ${title}: ${body}`);
    return false;
  }

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
