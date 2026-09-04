"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendClientInvitationEmail, getFromEmail } from "@/lib/email";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function getAppBaseUrl(): Promise<string> {
  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch (err) {
    // fallback if called outside request context
  }

  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NODE_ENV === "production") return "https://test.eagleyedigital.io";
  return "http://localhost:3000";
}

export type CreateClientInvitationInput = {
  email: string;
  clientName?: string;
  projectIds: string[];
};

export type ActionResponse<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ── 1. Create Client Invitation ───────────────────────────────────────────────

export async function createClientInvitationAction(
  input: CreateClientInvitationInput
): Promise<
  ActionResponse<{
    invitationId: string;
    rawToken?: string;
    acceptUrl: string;
    emailSent: boolean;
    emailError?: string;
    fromEmail: string;
    toEmail: string;
  }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const email = input.email.trim().toLowerCase();
  const clientName = input.clientName?.trim();
  const projectIds = input.projectIds ?? [];

  if (!email) {
    return { success: false, error: "Client email address is required." };
  }

  if (projectIds.length === 0) {
    return { success: false, error: "Select at least one project for the client." };
  }

  // Check if target email belongs to an existing user
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, profileRole: true, isActive: true },
  });

  if (existingUser && existingUser.profileRole !== "CLIENT") {
    return {
      success: false,
      error: `The email "${email}" belongs to an internal user account (${existingUser.profileRole}). Please use a dedicated client email address.`,
    };
  }

  // Check if an active pending invitation already exists
  const pendingInvitation = await db.clientInvitation.findFirst({
    where: {
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true, expiresAt: true },
  });

  if (pendingInvitation) {
    return {
      success: false,
      error: `An active pending invitation already exists for "${email}". Use the "Resend Invitation" action to resend the email link.`,
    };
  }

  // Generate cryptographically secure token & SHA-256 hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  // Invitation expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Validate project existence and fetch project names (matching by ID or code)
  const validProjects = await db.project.findMany({
    where: {
      OR: [
        { id: { in: projectIds } },
        { code: { in: projectIds } },
      ],
    },
    select: { id: true, name: true },
  });

  if (validProjects.length === 0) {
    return { success: false, error: "No valid projects were selected." };
  }

  const invitation = await db.clientInvitation.create({
    data: {
      email,
      clientName,
      invitedById: session.user.id,
      tokenHash,
      status: "PENDING",
      expiresAt,
      projects: {
        create: validProjects.map((p) => ({
          projectId: p.id,
          projectRole: "Client",
        })),
      },
    },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const baseUrl = await getAppBaseUrl();
  const acceptUrl = `${baseUrl}/invitations/client/accept?token=${rawToken}`;
  const inviterName = session.user.name || session.user.email || "Project Administrator";
  const projectNames = validProjects.map((p) => p.name);

  let emailSent = true;
  let emailError: string | undefined;

  // Send invitation email
  try {
    await sendClientInvitationEmail({
      to: email,
      clientName: clientName || "Client Partner",
      inviterName,
      projectNames,
      acceptUrl,
      expiresAt,
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : "Email delivery error.";
    console.error("[ClientInvitation] Failed to send email:", err);
  }

  revalidatePath("/projects/users");

  return {
    success: true,
    data: {
      invitationId: invitation.id,
      rawToken,
      acceptUrl,
      emailSent,
      emailError,
      fromEmail: getFromEmail(),
      toEmail: email,
    },
  };
}

// ── 2. Validate Client Invitation Token ───────────────────────────────────────

export type ClientInvitationDetails = {
  id: string;
  email: string;
  clientName: string | null;
  inviterName: string;
  projects: { id: string; name: string }[];
  expiresAt: string;
  isExistingUser: boolean;
};

export async function validateClientInvitationAction(
  rawToken: string
): Promise<ActionResponse<ClientInvitationDetails>> {
  if (!rawToken || typeof rawToken !== "string") {
    return { success: false, error: "Invalid invitation link." };
  }

  const tokenHash = hashToken(rawToken);

  const invitation = await db.clientInvitation.findUnique({
    where: { tokenHash },
    include: {
      invitedBy: { select: { name: true, email: true } },
      projects: {
        include: {
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!invitation) {
    return { success: false, error: "This invitation link is invalid or does not exist." };
  }

  if (invitation.status !== "PENDING") {
    return {
      success: false,
      error: `This invitation is no longer active (Status: ${invitation.status}).`,
    };
  }

  if (invitation.revokedAt) {
    return { success: false, error: "This invitation has been revoked by an administrator." };
  }

  if (invitation.expiresAt < new Date()) {
    // Auto-mark expired in DB
    await db.clientInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return { success: false, error: "This invitation link has expired (7-day validity)." };
  }

  // Check if email already belongs to a CLIENT user
  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, profileRole: true },
  });

  return {
    success: true,
    data: {
      id: invitation.id,
      email: invitation.email,
      clientName: invitation.clientName,
      inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
      projects: invitation.projects.map((p) => ({
        id: p.project.id,
        name: p.project.name,
      })),
      expiresAt: invitation.expiresAt.toISOString(),
      isExistingUser: Boolean(existingUser && existingUser.profileRole === "CLIENT"),
    },
  };
}

// ── 3. Accept Client Invitation (Atomic Transaction) ──────────────────────────

export async function acceptClientInvitationAction(
  rawToken: string,
  password?: string,
  clientName?: string
): Promise<ActionResponse<{ email: string }>> {
  if (!rawToken) {
    return { success: false, error: "Missing invitation token." };
  }

  const tokenHash = hashToken(rawToken);

  const invitation = await db.clientInvitation.findUnique({
    where: { tokenHash },
    include: {
      projects: { select: { projectId: true, projectRole: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invitation) {
    return { success: false, error: "Invitation not found or invalid." };
  }

  if (invitation.status !== "PENDING" || invitation.expiresAt < new Date() || invitation.revokedAt) {
    return { success: false, error: "This invitation is no longer valid for acceptance." };
  }

  const email = invitation.email.toLowerCase().trim();

  // Perform atomic transaction
  try {
    await db.$transaction(async (tx) => {
      let clientUser = await tx.user.findUnique({
        where: { email },
      });

      if (!clientUser) {
        if (!password || password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const resolvedName = clientName?.trim() || invitation.clientName || email.split("@")[0];

        clientUser = await tx.user.create({
          data: {
            email,
            name: resolvedName,
            password: hashedPassword,
            profileRole: "CLIENT",
            role: "TEAM_MEMBER",
            isActive: true,
            emailVerified: new Date(),
          },
        });
      } else {
        if (clientUser.profileRole !== "CLIENT") {
          throw new Error("This email belongs to an internal user account and cannot accept a client invitation.");
        }

        const updateData: { isActive: boolean; password?: string; name?: string } = {
          isActive: true,
        };
        if (password && password.length >= 6) {
          updateData.password = await bcrypt.hash(password, 10);
        }
        if (clientName?.trim()) {
          updateData.name = clientName.trim();
        }

        clientUser = await tx.user.update({
          where: { id: clientUser.id },
          data: updateData,
        });
      }

      // Add ProjectMember records for invited projects
      for (const p of invitation.projects) {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: p.projectId,
              userId: clientUser.id,
            },
          },
          update: {
            status: "ACTIVE",
            projectRole: p.projectRole || "Client",
          },
          create: {
            projectId: p.projectId,
            userId: clientUser.id,
            projectRole: p.projectRole || "Client",
            status: "ACTIVE",
          },
        });
      }

      // Mark invitation ACCEPTED
      await tx.clientInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      // Notify inviter
      await tx.notification.create({
        data: {
          type: "CLIENT_INVITATION_ACCEPTED",
          title: "Client Invitation Accepted",
          message: `${clientUser.name || email} accepted your client portal invitation.`,
          userId: invitation.invitedById,
          createdById: clientUser.id,
        },
      });
    });

    revalidatePath("/projects/users");

    return { success: true, data: { email } };
  } catch (err) {
    console.error("[ClientInvitation] Acceptance failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to accept invitation. Please try again.",
    };
  }
}

// ── 4. Resend Client Invitation ───────────────────────────────────────────────

export async function resendClientInvitationAction(
  invitationId: string
): Promise<
  ActionResponse<{
    invitationId: string;
    rawToken?: string;
    acceptUrl: string;
    emailSent: boolean;
    emailError?: string;
    fromEmail: string;
    toEmail: string;
  }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const existing = await db.clientInvitation.findUnique({
    where: { id: invitationId },
    include: {
      projects: { include: { project: { select: { name: true } } } },
    },
  });

  if (!existing) {
    return { success: false, error: "Invitation not found." };
  }

  const newRawToken = crypto.randomBytes(32).toString("hex");
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.clientInvitation.update({
    where: { id: invitationId },
    data: {
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      status: "PENDING",
      revokedAt: null,
    },
  });

  const baseUrl = await getAppBaseUrl();
  const acceptUrl = `${baseUrl}/invitations/client/accept?token=${newRawToken}`;
  const inviterName = session.user.name || session.user.email || "Project Administrator";
  const projectNames = existing.projects.map((p) => p.project.name);

  let emailSent = true;
  let emailError: string | undefined;

  try {
    await sendClientInvitationEmail({
      to: existing.email,
      clientName: existing.clientName || "Client Partner",
      inviterName,
      projectNames,
      acceptUrl,
      expiresAt: newExpiresAt,
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : "Email delivery error.";
    console.error("[ClientInvitation] Failed to resend email:", err);
  }

  revalidatePath("/projects/users");

  return {
    success: true,
    data: {
      invitationId,
      acceptUrl,
      rawToken: newRawToken,
      emailSent,
      emailError,
      fromEmail: getFromEmail(),
      toEmail: existing.email,
    },
  };
}

// ── 5. Revoke Client Invitation ───────────────────────────────────────────────

export async function revokeClientInvitationAction(
  invitationId: string
): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const invitation = await db.clientInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    return { success: false, error: "Invitation not found." };
  }

  await db.clientInvitation.update({
    where: { id: invitationId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  revalidatePath("/projects/users");

  return { success: true };
}

// ── 6. Deactivate Client User ──────────────────────────────────────────────────

export async function deactivateClientUserAction(
  userId: string
): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const clientUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, profileRole: true },
  });

  if (!clientUser || clientUser.profileRole !== "CLIENT") {
    return { success: false, error: "Client account not found." };
  }

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { isActive: false },
    }),
    db.projectMember.updateMany({
      where: { userId },
      data: { status: "INACTIVE" },
    }),
  ]);

  revalidatePath("/projects/users");

  return { success: true };
}

// ── 7. Remove Client From Single Project ──────────────────────────────────────

export async function removeClientFromProjectAction(
  userId: string,
  projectId: string
): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  await db.projectMember.deleteMany({
    where: { userId, projectId },
  });

  revalidatePath("/projects/users");

  return { success: true };
}

// ── 8. Get All Client Invitations ─────────────────────────────────────────────

export type ClientInvitationListItem = {
  id: string;
  email: string;
  clientName: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  projects: string[];
};

export async function getClientInvitationsAction(): Promise<ClientInvitationListItem[]> {
  const invitations = await db.clientInvitation.findMany({
    include: {
      invitedBy: { select: { name: true, email: true } },
      projects: { include: { project: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    clientName: inv.clientName,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    invitedBy: inv.invitedBy.name || inv.invitedBy.email,
    projects: inv.projects.map((p) => p.project.name),
  }));
}
