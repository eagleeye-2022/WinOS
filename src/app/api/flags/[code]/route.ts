import { readFile } from "node:fs/promises";
import path from "node:path";

// Country flag SVGs served from the repo's own files (scripts/data/locations/flags/XX.svg), one
// per request, so the browser only downloads the flags a page shows. Nothing is stored in the
// database: the flag is looked up from the ISO code already saved on the project.
// next.config.ts adds the flags folder to this route's server trace so it ships when deployed.

const FLAGS_DIR = path.join(process.cwd(), "scripts", "data", "locations", "flags");
const cache = new Map<string, string>();

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const iso = (code || "").replace(/\.svg$/i, "").toUpperCase();

  // Strict 2-letter check: also guarantees the path can't escape the flags folder.
  if (!/^[A-Z]{2}$/.test(iso)) return notFound();

  let svg = cache.get(iso);
  if (!svg) {
    try {
      svg = await readFile(path.join(FLAGS_DIR, `${iso}.svg`), "utf8");
      cache.set(iso, svg);
    } catch {
      return notFound();
    }
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Flags never change for a given data export — cache for a year.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Defence in depth: the SVG can't run scripts or load anything even if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Flag not found", { status: 404, headers: { "Content-Type": "text/plain" } });
}
