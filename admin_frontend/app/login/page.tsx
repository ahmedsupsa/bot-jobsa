import { redirect } from "next/navigation";

export default function OldLoginRedirect() {
  redirect("/admin/login");
}
