import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getBoards, getHistory, getWorkspaceUsers, NotesWorkspace } from "@/features/notes";

export default async function NotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [boards, history, users] = await Promise.all([
    getBoards(),
    getHistory(),
    getWorkspaceUsers(),
  ]);

  const isManager = session.user.role === "MANAGER";
  const userId = session.user.id;

  return (
    <NotesWorkspace
      initialBoards={boards}
      historyNotes={history}
      allUsers={users}
      userId={userId}
      isManager={isManager}
      pageOwnerId={userId}
    />
  );
}
