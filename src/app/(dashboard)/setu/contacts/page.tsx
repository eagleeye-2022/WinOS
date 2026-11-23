import { Metadata } from "next";
import { ContactsPage } from "@/features/setu/components/lists/contacts-page";

export const metadata: Metadata = {
  title: "Contacts | Setu | WinOS",
  description: "Decision makers and client attendees.",
};

export default function SetuContactsPage() {
  return <ContactsPage />;
}
