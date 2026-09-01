import nodemailer from "nodemailer";

// ── Zoho SMTP configuration ───────────────────────────────────────────────────
// Production: set these env vars in your deployment environment.
//   SMTP_HOST   = smtp.zoho.in          (or smtp.zoho.com for non-India region)
//   SMTP_PORT   = 587                   (STARTTLS) or 465 (SSL)
//   SMTP_USER   = noreply@eagleeyedigital.io
//   SMTP_PASS   = <Zoho app-specific password>
//   SMTP_FROM   = WinOS <noreply@eagleeyedigital.io>

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = process.env.SMTP_FROM ?? "WinOS <noreply@eagleeyedigital.io>";
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Send an OTP code to the given address.
 *
 * - Production: requires SMTP_HOST / SMTP_USER / SMTP_PASS to be set.
 *   Throws if they are absent so the server action can surface the failure.
 * - Development: if SMTP is not configured, prints the code to the server
 *   console only. The OTP is never included in any HTTP response body.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transport = buildTransport();

  if (!transport) {
    if (IS_PROD) {
      // Fail loudly — a missing SMTP config in production is a deployment error.
      throw new Error(
        "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.",
      );
    }
    // Dev fallback — never logged in production.
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[OTP EMAIL]  To: ${to}`);
    console.log(`             Code: ${otp}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return;
  }

  const subject = "Your WinOS sign-in code";
  const text = [
    `Your WinOS sign-in code is: ${otp}`,
    "",
    "This code expires in 10 minutes and is single-use.",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  await transport.sendMail({ from: FROM, to, subject, text });
}

export type CalendarInviteEmailParams = {
  to: string;
  organizerName: string;
  organizerEmail: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  meetingLink?: string;
  location?: string;
};

/**
 * Send a structured calendar invitation email to an assigned attendee.
 */
export async function sendCalendarInviteEmail(params: CalendarInviteEmailParams): Promise<void> {
  const { to, organizerName, organizerEmail, title, description, start, end, meetingLink, location } = params;
  const transport = buildTransport();

  const formattedStart = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(start);

  const formattedEnd = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(end);

  const subject = `Calendar Invite: ${title} from ${organizerName}`;
  const text = [
    `You have been invited to a meeting on WinOS Calendar!`,
    ``,
    `Title: ${title}`,
    `Organizer: ${organizerName} (${organizerEmail})`,
    `Date & Time: ${formattedStart} - ${formattedEnd} (Asia/Kolkata)`,
    location ? `Location / Room: ${location}` : "",
    meetingLink ? `Meeting Link: ${meetingLink}` : "",
    description ? `Description: ${description}` : "",
    ``,
    `Log into WinOS Calendar to view details and respond (Accept / Decline).`,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #18181c; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 18px;">Calendar Invite: ${title}</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #a1a1aa;">From ${organizerName} (${organizerEmail})</p>
      </div>
      <div style="padding: 24px; color: #18181b; font-size: 14px; line-height: 1.6;">
        <p style="margin-top: 0;">Hi,</p>
        <p><strong>${organizerName}</strong> has invited you to a scheduled meeting on <strong>WinOS Calendar</strong>.</p>
        <div style="background: #f4f4f5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 16px; color: #09090b;">${title}</p>
          <p style="margin: 4px 0; color: #3f3f46;">📅 <strong>Date & Time:</strong> ${formattedStart} – ${formattedEnd} (Asia/Kolkata)</p>
          ${location ? `<p style="margin: 4px 0; color: #3f3f46;">📍 <strong>Location:</strong> ${location}</p>` : ""}
          ${meetingLink ? `<p style="margin: 4px 0; color: #3f3f46;">🔗 <strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #2563eb;">${meetingLink}</a></p>` : ""}
          ${description ? `<p style="margin: 8px 0 0 0; color: #52525b; font-style: italic;">"${description}"</p>` : ""}
        </div>
        <p>Log in to your WinOS Calendar workspace to accept or decline this meeting invitation.</p>
      </div>
      <div style="background: #fafafa; border-top: 1px solid #e4e4e7; padding: 12px 24px; text-align: center; font-size: 12px; color: #71717a;">
        Sent via WinOS Collaborative Calendar
      </div>
    </div>
  `;

  if (!transport) {
    if (IS_PROD) {
      console.error("SMTP not configured for calendar invite email");
      return;
    }
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[CALENDAR INVITE EMAIL] To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return;
  }

  await transport.sendMail({ from: FROM, to, subject, text, html });
}

export type ClientInvitationEmailParams = {
  to: string;
  clientName: string;
  inviterName: string;
  projectNames: string[];
  acceptUrl: string;
  expiresAt: Date;
};

/**
 * Send a secure client invitation email containing an invitation link.
 */
export async function sendClientInvitationEmail(params: ClientInvitationEmailParams): Promise<void> {
  const { to, clientName, inviterName, projectNames, acceptUrl, expiresAt } = params;
  const transport = buildTransport();

  const formattedExpiry = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(expiresAt);

  const subject = `You're invited to collaborate on WinOS Projects`;

  const projectListText = projectNames.map((p) => `• ${p}`).join("\n");
  const text = [
    `Hi ${clientName || "there"},`,
    ``,
    `${inviterName} has invited you to collaborate on the following project(s):`,
    projectListText,
    ``,
    `Accept your invitation here: ${acceptUrl}`,
    ``,
    `This invitation expires on ${formattedExpiry}.`,
  ].join("\n");

  const projectListHtml = projectNames
    .map(
      (p) =>
        `<li style="margin-bottom: 6px; font-weight: 600; color: #18181b;">${p}</li>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #09090b; color: #ffffff; padding: 24px 28px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700; tracking: -0.02em;">WinOS Client Portal</h2>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #a1a1aa;">Project Collaboration Invitation</p>
      </div>
      <div style="padding: 28px; color: #27272a; font-size: 14px; line-height: 1.6;">
        <p style="margin-top: 0; font-size: 15px;">Hello <strong>${clientName || "Client"}</strong>,</p>
        <p><strong>${inviterName}</strong> has invited you to join the client portal and collaborate on the following project(s):</p>
        <div style="background: #f4f4f5; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
          <ul style="margin: 0; padding-left: 18px;">
            ${projectListHtml}
          </ul>
        </div>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Accept Invitation</a>
        </div>
        <p style="font-size: 12px; color: #71717a; margin-bottom: 0;">
          This invitation is secure and expires on <strong>${formattedExpiry}</strong>. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
      <div style="background: #fafafa; border-top: 1px solid #f4f4f5; padding: 14px 28px; text-align: center; font-size: 12px; color: #a1a1aa;">
        Sent via WinOS Projects Client Management System
      </div>
    </div>
  `;

  if (!transport) {
    if (IS_PROD) {
      console.error("SMTP not configured for client invitation email");
      return;
    }
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[CLIENT INVITATION EMAIL] To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`URL: ${acceptUrl}`);
    console.log(text);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return;
  }

  await transport.sendMail({ from: FROM, to, subject, text, html });
}


