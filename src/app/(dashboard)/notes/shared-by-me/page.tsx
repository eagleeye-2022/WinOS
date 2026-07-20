import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getSharedByMeNotes } from "@/features/notes/queries";
import { SharedNotesView } from "@/features/notes/components/shared-notes-view";

export default async function SharedByMeNotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const sharedNotes = await getSharedByMeNotes();

  return (
    <SharedNotesView
      title="Shared By Me"
      description="All note cards & lists that you have shared with other team members in your workspace."
      notes={sharedNotes}
      type="by-me"
    />
  );
}
