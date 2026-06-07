import { redirect } from "next/navigation";

export default function OldUserRedirect({ params }: { params: { userId: string } }) {
  redirect(`/admin/applications/${params.userId}`);
}
