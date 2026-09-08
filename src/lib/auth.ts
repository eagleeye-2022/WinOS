import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyAndConsumeOtp } from "@/lib/otp";
import type { UserRole } from "@/types";

const COMPANY_DOMAIN = "eagleeyedigital.io";

const MANAGER_EMAILS = new Set([
  "mohit@eagleeyedigital.io",
  "seo@eagleeyedigital.io",
  "business@eagleeyedigital.io",
  "wp@eagleeyedigital.io",
]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Required when deployed behind a reverse proxy (AWS Amplify, Vercel, Cloudflare, etc.).
  // Without this, Auth.js rejects requests whose X-Forwarded-Host differs from AUTH_URL.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "One-time code", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const otp = (credentials?.otp as string | undefined)?.trim();
        const password = (credentials?.password as string | undefined);

        if (!email) return null;

        try {
          // Look up existing user or auto-provision on first login.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let user = await (db as any).user.findUnique({ where: { email } });

          if (user && !user.isActive) {
            return null;
          }

          // ── Scenario 1: Password Login (primarily for CLIENT users) ─────────────
          if (password && user?.password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return null;
            return {
              id: user.id as string,
              email: user.email as string,
              name: user.name as string | null,
              role: user.role as UserRole,
              profileRole: user.profileRole as string | null,
            };
          }

          // ── Scenario 2: OTP Login (primarily for internal employees) ───────────
          if (!otp) return null;

          // Domain restriction — allow CLIENT role users or @eagleeyedigital.io emails.
          if (
            !email.endsWith(`@${COMPANY_DOMAIN}`) &&
            user?.profileRole !== "CLIENT" &&
            user?.role !== "CLIENT"
          ) {
            return null;
          }

          // OTP validation: verify code, check expiry, mark consumed (single-use).
          const valid = await verifyAndConsumeOtp(email, otp);
          if (!valid) return null;

          if (!user) {
            const role = MANAGER_EMAILS.has(email) ? "MANAGER" : "TEAM_MEMBER";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            user = await (db as any).user.create({
              data: {
                email,
                role,
                name: null,
                emailVerified: new Date(),
              },
            });
          }

          const authed = {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string | null,
            role: user.role as UserRole,
            profileRole: user.profileRole as string | null,
          };
          return authed;
        } catch {
          // Prisma/DB failure inside authorize — return null so NextAuth surfaces
          // a clean CredentialsSignin error rather than a raw 500.
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.profileRole = (user as any).profileRole;
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth:jwt] issuing token for user:", { id: user.id, email: user.email });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dbUser = await (db as any).user.findUnique({
            where: { id: token.id as string },
            select: { isActive: true, role: true, profileRole: true },
          });

          if (!dbUser || !dbUser.isActive) {
            return {
              ...session,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              user: undefined as any,
            };
          }

          return {
            ...session,
            user: {
              ...session.user,
              id: token.id as string,
              role: dbUser.role ?? token.role,
              profileRole: dbUser.profileRole ?? (token.profileRole as string | undefined),
            },
          };
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[auth:session] DB error checking session active state:", err);
          }
        }
      }
      return session;
    },
  },
});

