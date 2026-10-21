import { redirect } from "next/navigation";

/** A list has no page of its own — its cards live on the WhyFi School board. */
export default function WhyfiListPage() {
  redirect("/pulse/whyfi-learning");
}
