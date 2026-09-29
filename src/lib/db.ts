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

  // The DB is remote (Neon), where opening a connection costs ~1–1.5s of TCP+TLS handshake.
  // pg's default 10s idleTimeout closed pooled connections between clicks, so almost every
  // page paid that handshake again for each query Prisma ran in parallel (measured ~4s vs
  // ~1.3s warm). Keep idle connections around for 5 minutes and TCP keep-alive them.
  const adapter = new PrismaPg({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 5 * 60_000,
    keepAlive: true,
  });
  const client = new PrismaClient({ adapter, log: ["error"] });

  // Startup connectivity check — runs once per process in dev.
  if (isDev && !globalForPrisma.prismaReady) {
    globalForPrisma.prismaReady = true;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = await (client as any).user.count();
        dbLog("startup OK — user.count =", n);
        // Pre-open a few pooled connections so the first page load doesn't pay a remote
        // TLS handshake per parallel query (idleTimeoutMillis above keeps them open).
        await Promise.all(Array.from({ length: 6 }, () => client.$queryRaw`SELECT 1`));
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

export const db =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalForPrisma.prisma && (globalForPrisma.prisma as any).clientInvitation
    ? globalForPrisma.prisma
    : createClient();

if (isDev) globalForPrisma.prisma = db;

