import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { createClient } from "@supabase/supabase-js";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { authService } from "./auth-service";
import { ENV } from "./env";

const supabaseAdmin = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey,
);

export function registerAuthRoutes(app: Express) {
  /**
   * POST /api/auth/callback
   * Receives a Supabase access token after client-side login,
   * verifies it, upserts the user, and sets a session cookie.
   */
  app.post("/api/auth/callback", async (req: Request, res: Response) => {
    const { access_token } = req.body;

    if (!access_token) {
      res.status(400).json({ error: "access_token is required" });
      return;
    }

    try {
      // Verify the Supabase token
      const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(access_token);

      if (error || !supabaseUser) {
        console.error("[Auth] Supabase token verification failed:", error);
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      const authId = supabaseUser.id;
      const email = supabaseUser.email ?? null;
      const name = supabaseUser.user_metadata?.full_name ?? email ?? "User";

      // Access control: check whitelist
      const isAdmin = email === ENV.adminEmail;
      let assignedRole: "admin" | "setter" | "closer" | "user" = "user";

      if (isAdmin) {
        assignedRole = "admin";
      } else if (email) {
        const allowed = await db.checkEmailAllowed(email);
        if (allowed) {
          assignedRole = allowed.role;
        } else {
          // Not in whitelist — still create user but with no CRM access
          await db.upsertUser({
            authId,
            name,
            email,
            loginMethod: "email",
            role: "user",
            lastSignedIn: new Date(),
          });
          const sessionToken = await authService.createSessionToken(authId, {
            name,
            expiresInMs: ONE_YEAR_MS,
          });
          const cookieOptions = getSessionCookieOptions(req);
          res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          res.json({ success: true, redirect: "/acceso-denegado" });
          return;
        }
      } else {
        res.status(400).json({ error: "No email associated with account" });
        return;
      }

      await db.upsertUser({
        authId,
        name,
        email,
        loginMethod: "email",
        role: assignedRole,
        lastSignedIn: new Date(),
      });

      const sessionToken = await authService.createSessionToken(authId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, redirect: "/" });
    } catch (error) {
      console.error("[Auth] Callback failed:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * POST /api/auth/magic-link
   * Validates the email against the allowed_emails whitelist BEFORE asking Supabase
   * to send a magic link. This prevents Supabase Auth from piling up ghost accounts
   * for unauthorized emails and avoids leaking which emails are whitelisted.
   */
  app.post("/api/auth/magic-link", async (req: Request, res: Response) => {
    const { email: rawEmail } = req.body;

    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(400).json({ error: "email requerido" });
      return;
    }

    const email = rawEmail.toLowerCase().trim();
    const genericMessage = "Si tu correo está autorizado, revisa tu bandeja en unos segundos.";

    try {
      const isAdmin = email === ENV.adminEmail;
      const allowed = isAdmin ? true : !!(await db.checkEmailAllowed(email));

      if (!allowed) {
        // Generic response — don't reveal whether the email is in the whitelist
        console.log(`[Auth] Magic link requested for non-whitelisted email: ${email}`);
        res.json({ success: true, message: genericMessage });
        return;
      }

      const redirectTo = `${ENV.appUrl}/auth/callback`;
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });

      if (error) {
        console.error("[Auth] signInWithOtp failed:", error);
        res.status(500).json({ error: "No se pudo enviar el link. Intenta de nuevo en un momento." });
        return;
      }

      console.log(`[Auth] Magic link sent to ${email}`);
      res.json({ success: true, message: genericMessage });
    } catch (error) {
      console.error("[Auth] Magic link request failed:", error);
      res.status(500).json({ error: "Error enviando el link. Intenta de nuevo." });
    }
  });
}
