import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CreateJobPage() {
    redirect("/profile/employer?tab=post-job");
}
