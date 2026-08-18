"use client";

import { useState } from "react";
import { Mail, Network, Calendar, Copy, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TeamMemberRow } from "@/features/users/actions/user-actions";

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager",
  TEAM_MEMBER: "Team Member",
};

function getAvatarUrl(image?: string | null, _id?: string, _name?: string) {
  if (image && image.trim()) return image;
  return "/default-avatar.png";
}

interface UserProfileCardProps {
  member: TeamMemberRow | null;
  onClose: () => void;
}

export function UserProfileCard({ member, onClose }: UserProfileCardProps) {
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  function handleCopy() {
    if (!member) return;
    navigator.clipboard.writeText(member.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const avatarUrl = getAvatarUrl(member.image, member.id, member.name);

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border shadow-sm">
            <AvatarImage src={avatarUrl} alt={member.name} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {member.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            <span className="inline-block rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
              {member.title || ROLE_LABEL[member.role] || member.role}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2.5 text-foreground">
            <Mail size={15} className="text-muted-foreground shrink-0" />
            <span className="truncate">{member.email}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-auto text-muted-foreground hover:text-foreground"
              title="Copy email"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Network size={15} className="text-muted-foreground shrink-0" />
            <span>{member.department || "No department"}</span>
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Calendar size={15} className="text-muted-foreground shrink-0" />
            <span>
              {member.dateOfJoining ? `Member since ${member.dateOfJoining}` : "Joining date not set"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
