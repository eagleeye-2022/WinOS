import { Metadata } from "next";
import { PipelineBoard } from "@/features/setu/components/pipeline/pipeline-board";

export const metadata: Metadata = {
  title: "Sales Pipeline | Setu | WinOS",
  description: "Prospects from BNI referrals and the WhatsApp bot, across every pipeline stage.",
};

export default function SetuPipelinePage() {
  return <PipelineBoard />;
}
