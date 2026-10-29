import { Metadata } from "next";
import { ContactsWorkspace } from "@/features/setu/components/contacts-workspace";

export const metadata: Metadata = {
  title: "Contacts | Setu | WinOS",
  description: "BNI members and prospects in your network.",
};

export default function SetuContactsPage() {
  return <ContactsWorkspace />;
}
