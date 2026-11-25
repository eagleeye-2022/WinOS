import { Metadata } from "next";
import { WhatsappBotView } from "@/features/setu/components/bni/whatsapp-bot-view";

export const metadata: Metadata = {
  title: "WhatsApp Bot | Setu | WinOS",
  description: "Field capture: visiting cards and 121 notes from WhatsApp.",
};

export default function SetuWhatsappBotPage() {
  return <WhatsappBotView />;
}
