import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getBoards, getHistory, getSharedWithMeNotes, getSharedByMeNotes, getWorkspaceUsers, NotesWorkspace } from "@/features/notes";

export default async function NotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [boards, history, sharedNotes, sharedByMeNotes, users] = await Promise.all([
    getBoards(),
    getHistory(),
    getSharedWithMeNotes(),
    getSharedByMeNotes(),
    getWorkspaceUsers(),
  ]);

  const isManager = session.user.role === "MANAGER";
  const userId = session.user.id;

  return (
    <NotesWorkspace
      initialBoards={boards}
      historyNotes={history}
      initialSharedNotes={sharedNotes}
      initialSharedByMeNotes={sharedByMeNotes}
      allUsers={users}
      userId={userId}
      isManager={isManager}
      pageOwnerId={userId}
    />
  );
}
