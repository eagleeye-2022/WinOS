import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaReady: boolean;
};

const isDev = process.env.NODE_ENV !== "production";

function maskUrl(url: string) {
  return url.replace(/:([^:@]+)@/, ":***@");
}

function dbLog(...args: unknown[]) {
  if (isDev) console.log("[db]", ...args);
}

function dbError(operation: string, err: unknown) {
  if (!isDev) return;
  const e = err as Record<string, unknown>;
  const code = (e?.code ?? e?.errorCode) as string | undefined;
  console.error("[db] error during", operation, {
    code,
    message: e?.message ?? String(err),
    meta: e?.meta,
  });
  if (code === "ECONNREFUSED" || code === "P1001" || code === "P1017" || String(e?.message).includes("terminated")) {
    console.error("[db] ↳ DB not running or connection dropped → run: npm run db:restart");
  } else if (code === "P2021" || code === "P2022") {
    console.error("[db] ↳ Schema not pushed to DB → run: npx prisma db push");
  }
}

function createClient() {
  const url = process.env.DATABASE_URL ?? "";
  dbLog("connecting to:", maskUrl(url));

  const adapter = new PrismaPg({ connectionString: url });
  const client = new PrismaClient({ adapter, log: ["error"] });

  // Startup connectivity check — runs once per process in dev.
  if (isDev && !globalForPrisma.prismaReady) {
    globalForPrisma.prismaReady = true;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = await (client as any).user.count();
        dbLog("startup OK — user.count =", n);
        // Probe OtpToken specifically — missing if schema was never pushed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).otpToken.count();
        dbLog("startup OK — OtpToken table present");
      } catch (e) {
        dbError("startup check", e);
      }
    })();
  }

  return client;
}

export const db = globalForPrisma.prisma ?? createClient();

if (isDev) globalForPrisma.prisma = db;
