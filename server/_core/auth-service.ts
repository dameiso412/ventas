import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  authId: string;
  name: string;
};

class AuthService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    authId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      { authId, name: options.name || "" },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      authId: payload.authId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ authId: string; name: string } | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { authId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(authId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return { authId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.authId;
    const signedInAt = new Date();
    let user = await db.getUserByAuthId(sessionUserId);

    if (!user) {
      throw ForbiddenError("User not found. Please log in again.");
    }

    // Re-verify whitelist on every request for immediate role changes
    const isAdmin = user.email === ENV.adminEmail;
    if (!isAdmin && user.email) {
      const allowed = await db.checkEmailAllowed(user.email);
      if (allowed) {
        if (user.role !== allowed.role) {
          console.log(`[Auth] Role sync: ${user.email} ${user.role} → ${allowed.role}`);
          await db.upsertUser({ authId: user.authId, role: allowed.role, lastSignedIn: signedInAt });
          user = { ...user, role: allowed.role };
        } else {
          await db.upsertUser({ authId: user.authId, lastSignedIn: signedInAt });
        }
      } else {
        if (user.role !== "user") {
          console.log(`[Auth] Access revoked: ${user.email} ${user.role} → user`);
          await db.upsertUser({ authId: user.authId, role: "user", lastSignedIn: signedInAt });
          user = { ...user, role: "user" };
        } else {
          await db.upsertUser({ authId: user.authId, lastSignedIn: signedInAt });
        }
      }
    } else if (isAdmin) {
      if (user.role !== "admin") {
        await db.upsertUser({ authId: user.authId, role: "admin", lastSignedIn: signedInAt });
        user = { ...user, role: "admin" };
      } else {
        await db.upsertUser({ authId: user.authId, lastSignedIn: signedInAt });
      }
    } else {
      await db.upsertUser({ authId: user.authId, lastSignedIn: signedInAt });
    }

    return user;
  }
}

export const authService = new AuthService();
