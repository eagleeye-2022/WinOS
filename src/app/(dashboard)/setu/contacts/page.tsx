import { Metadata } from "next";
import { ContactsView } from "@/features/setu/components/bni/contacts-view";

export const metadata: Metadata = {
  title: "Contacts | Setu | WinOS",
  description: "BNI members and prospects.",
};

export default function SetuContactsPage() {
  return <ContactsView />;
}
