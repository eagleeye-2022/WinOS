import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getSharedWithMeNotes } from "@/features/notes/queries";
import { SharedNotesView } from "@/features/notes/components/shared-notes-view";

export default async function SharedWithMeNotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const sharedNotes = await getSharedWithMeNotes();

  return (
    <SharedNotesView
      title="Shared With Me"
      description="All note cards & lists that team members have shared with you across your workspace boards."
      notes={sharedNotes}
      type="with-me"
    />
  );
}
