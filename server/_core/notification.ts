import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Stub: Owner notification. Currently a no-op.
 * TODO: Integrate with Slack or email for admin notifications.
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

  console.log(`[Notification] Owner notification (stub): ${payload.title}`);
  return false;
}
