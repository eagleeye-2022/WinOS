import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyAndConsumeOtp } from "@/lib/otp";
import type { UserRole } from "@/types";

const COMPANY_DOMAIN = "eagleeyedigital.io";

const MANAGER_EMAILS = new Set([
  "mohit@eagleeyedigital.io",
  "seo@eagleeyedigital.io",
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
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const otp = (credentials?.otp as string | undefined)?.trim();

        if (!email || !otp) return null;

        // Domain restriction — server-side, not bypassable from the client.
        if (!email.endsWith(`@${COMPANY_DOMAIN}`)) return null;

        try {
          // OTP validation: verify code, check expiry, mark consumed (single-use).
          // This is the final TOCTOU-safe gate — runs after validateOtp in the action.
          const valid = await verifyAndConsumeOtp(email, otp);
          if (!valid) return null;

          // Look up existing user or auto-provision on first login.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let user = await (db as any).user.findUnique({ where: { email } });

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

          const authed: { id: string; email: string; name: string | null; role: UserRole } = {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string | null,
            role: user.role,
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
        // user is only present at sign-in — log so we can trace the CUID being
        // written into the JWT. If the DB is later reset, this ID becomes stale.
        token.id = user.id!;
        token.role = user.role;
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth:jwt] issuing token for user:", { id: user.id, email: user.email });
        }
      }
      return token;
    },
    session({ session, token }) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth:session] session.user.id from token:", token.id);
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          role: token.role,
        },
      };
    },
  },
});
