import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWhyfiWorkspaceAction } from "@/features/whyfi/actions";
import { WhyfiWorkspace } from "@/features/whyfi/components/whyfi-workspace";

export const metadata: Metadata = {
  title: "Whyfi School | WinOS",
  description: "Learning and training task lists for the team.",
};

export default async function WhyfiLearningPage() {
  const workspace = await getWhyfiWorkspaceAction();
  if (!workspace) redirect("/login");
  return <WhyfiWorkspace initial={workspace} />;
}
