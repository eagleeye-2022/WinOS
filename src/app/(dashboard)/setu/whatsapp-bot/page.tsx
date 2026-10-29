import { Metadata } from "next";
import { WhatsAppBotView } from "@/features/setu/components/whatsapp-bot-view";

export const metadata: Metadata = {
  title: "WhatsApp Bot | Setu | WinOS",
  description: "Field capture of visiting cards and 121 meeting notes via WhatsApp.",
};

export default function SetuWhatsAppBotPage() {
  return <WhatsAppBotView />;
}
