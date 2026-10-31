import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getBoards, getHistory, getShareableProjects, getWorkspaceUsers, NotesWorkspace } from "@/features/notes";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function MemberNotesPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const { userId } = await params;

  // Only managers may open another member's notes workspace.
  const isManager = session.user.role === "MANAGER";
  if (!isManager && userId !== session.user.id) redirect(ROUTES.notes);

  const [boards, history, users, shareableProjects] = await Promise.all([
    getBoards(userId),
    getHistory(userId),
    getWorkspaceUsers(),
    getShareableProjects(),
  ]);

  return (
    <NotesWorkspace
      initialBoards={boards}
      historyNotes={history}
      allUsers={users}
      userId={session.user.id}
      isManager={isManager}
      pageOwnerId={userId}
      shareableProjects={shareableProjects}
    />
  );
}
