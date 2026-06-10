// Polls a TCP port until the Prisma dev server is accepting connections.
// Usage: node scripts/wait-db.mjs <port>   (defaults to 5432)
import { createConnection } from "net";

const PORT = parseInt(process.argv[2] ?? "5432", 10);
const HOST = "localhost";
const TIMEOUT_MS = 10_000;
const POLL_MS = 300;

const deadline = Date.now() + TIMEOUT_MS;

function probe() {
  const socket = createConnection(PORT, HOST);
  socket.on("connect", () => {
    socket.destroy();
    console.log(`[wait-db] port ${PORT} ready`);
    process.exit(0);
  });
  socket.on("error", () => {
    socket.destroy();
    if (Date.now() >= deadline) {
      console.error(`[wait-db] timed out waiting for port ${PORT}`);
      process.exit(1);
    }
    setTimeout(probe, POLL_MS);
  });
}

probe();
