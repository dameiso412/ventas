import { describe, it, expect } from "vitest";

describe("Meta Ads Environment", () => {
  it("META_AD_ACCOUNT_ID is set and starts with act_", () => {
    const accountId = process.env.META_AD_ACCOUNT_ID ?? "";
    expect(accountId).toBeTruthy();
    expect(accountId.startsWith("act_")).toBe(true);
  });

  it("FB_ACCESS_TOKEN is set", () => {
    const token = process.env.FB_ACCESS_TOKEN ?? "";
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(10);
  });
});
