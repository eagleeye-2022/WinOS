import crypto from "crypto";

// ── Config ─────────────────────────────────────────────────────────────────────

/** Ambiguous characters (0/O, 1/I/l, etc.) are excluded so codes stay readable. */
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const CAPTCHA_LENGTH = 6;
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

const WIDTH = 180;
const HEIGHT = 60;

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-captcha-secret";

// ── Text generation ────────────────────────────────────────────────────────────

function randomChar(): string {
  return CHARSET[crypto.randomInt(0, CHARSET.length)];
}

/** Random multi-character code with mixed letter case and digits — not all one type. */
export function generateCaptchaText(): string {
  let text = "";
  for (let i = 0; i < CAPTCHA_LENGTH; i++) text += randomChar();
  return text;
}

// ── SVG rendering (distorted, no external deps) ───────────────────────────────

function renderCaptchaSvg(text: string): string {
  const charWidth = WIDTH / text.length;

  const glyphs = text
    .split("")
    .map((char, i) => {
      const x = charWidth * i + charWidth / 2 + crypto.randomInt(-4, 5);
      const y = HEIGHT / 2 + crypto.randomInt(-6, 7);
      const rotate = crypto.randomInt(-30, 31);
      const hue = crypto.randomInt(0, 360);
      const size = crypto.randomInt(26, 34);
      return `<text x="${x}" y="${y}" font-size="${size}" font-family="Verdana, sans-serif" font-weight="bold" fill="hsl(${hue}, 65%, 40%)" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    })
    .join("");

  const noiseLines = Array.from({ length: 5 }, () => {
    const x1 = crypto.randomInt(0, WIDTH);
    const y1 = crypto.randomInt(0, HEIGHT);
    const x2 = crypto.randomInt(0, WIDTH);
    const y2 = crypto.randomInt(0, HEIGHT);
    const hue = crypto.randomInt(0, 360);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="hsl(${hue}, 60%, 70%)" stroke-width="1.5" opacity="0.6" />`;
  }).join("");

  const noiseDots = Array.from({ length: 30 }, () => {
    const cx = crypto.randomInt(0, WIDTH);
    const cy = crypto.randomInt(0, HEIGHT);
    const hue = crypto.randomInt(0, 360);
    return `<circle cx="${cx}" cy="${cy}" r="1" fill="hsl(${hue}, 60%, 60%)" opacity="0.5" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="CAPTCHA image">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#f1f5f9" />
    ${noiseLines}
    ${glyphs}
    ${noiseDots}
  </svg>`;
}

// ── Stateless signed token (no DB/session storage needed) ─────────────────────

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Encodes the answer + expiry into a tamper-proof token the client hands back. */
function issueToken(text: string): string {
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  const payload = `${text}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export type Captcha = { svg: string; token: string };

export function createCaptcha(): Captcha {
  const text = generateCaptchaText();
  return { svg: renderCaptchaSvg(text), token: issueToken(text) };
}

/** Verifies a submitted answer against its signed token. Single-use by construction (token isn't reissued on success). */
export function verifyCaptcha(token: string | null | undefined, answer: string | null | undefined): boolean {
  if (!token || !answer) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedSignature = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  const [text, expiresAtRaw] = payload.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!text || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return answer.trim().toLowerCase() === text.toLowerCase();
}
