import { Metadata } from "next";
import { PipelineBoard } from "@/features/setu/components/bni/pipeline-board";

export const metadata: Metadata = {
  title: "Sales Pipeline | Setu | WinOS",
  description: "BNI prospects board: twelve stages from prospect to won.",
};

export default function SetuPipelinePage() {
  return <PipelineBoard />;
}
