import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EmployerJobsPage() {
    redirect("/profile/employer?tab=jobs");
}
