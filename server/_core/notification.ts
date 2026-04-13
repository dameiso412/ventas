import { TRPCError } from "@trpc/server";
import { sendSlackAlert, isSlackConfigured } from "./slack";

export type NotificationPayload = {
  title: string;
  content: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Send a notification to the owner via Slack.
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

  return sendSlackAlert({
    severity: "warning",
    title: payload.title,
    body: payload.content,
  });
}
