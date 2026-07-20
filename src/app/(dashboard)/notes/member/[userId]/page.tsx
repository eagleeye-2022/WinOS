import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getBoards, getHistory, getWorkspaceUsers, NotesWorkspace } from "@/features/notes";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function MemberNotesPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const { userId } = await params;

  const [boards, history, users] = await Promise.all([
    getBoards(userId),
    getHistory(userId),
    getWorkspaceUsers(),
  ]);

  const isManager = session.user.role === "MANAGER";

  return (
    <NotesWorkspace
      initialBoards={boards}
      historyNotes={history}
      allUsers={users}
      userId={session.user.id}
      isManager={isManager}
      pageOwnerId={userId}
    />
  );
}
