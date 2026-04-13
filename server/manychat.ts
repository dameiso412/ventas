/**
 * ManyChat API Client
 * Docs: https://api.manychat.com/swagger
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.manychat.com/fb";

function getHeaders() {
  return {
    "Authorization": `Bearer ${ENV.manychatApiToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

export interface ManyChatSubscriber {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  ig_username?: string;
  profile_pic?: string;
  subscribed?: string; // ISO date
  custom_fields?: Array<{ id: number; name: string; value: any }>;
  tags?: Array<{ id: number; name: string }>;
}

/**
 * Get subscriber info from ManyChat
 */
export async function getSubscriberInfo(subscriberId: string): Promise<ManyChatSubscriber | null> {
  if (!ENV.manychatApiToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/subscriber/getInfo?subscriber_id=${subscriberId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      console.error(`[ManyChat] getSubscriberInfo failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    return json.data ?? null;
  } catch (err: any) {
    console.error(`[ManyChat] getSubscriberInfo error: ${err.message}`);
    return null;
  }
}

/**
 * Set a custom field on a subscriber (e.g., store CRM lead ID)
 */
export async function setCustomField(subscriberId: string, fieldId: number, value: string): Promise<boolean> {
  if (!ENV.manychatApiToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/subscriber/setCustomField`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        subscriber_id: subscriberId,
        field_id: fieldId,
        field_value: value,
      }),
    });
    if (!res.ok) {
      console.error(`[ManyChat] setCustomField failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[ManyChat] setCustomField error: ${err.message}`);
    return false;
  }
}

/**
 * Trigger a flow for a subscriber (e.g., send agenda link)
 */
export async function sendFlow(subscriberId: string, flowNs: string): Promise<boolean> {
  if (!ENV.manychatApiToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/sending/sendFlow`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        subscriber_id: subscriberId,
        flow_ns: flowNs,
      }),
    });
    if (!res.ok) {
      console.error(`[ManyChat] sendFlow failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[ManyChat] sendFlow error: ${err.message}`);
    return false;
  }
}
