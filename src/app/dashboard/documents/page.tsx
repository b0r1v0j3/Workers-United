import { redirect } from "next/navigation";

// Documents are now shown directly on dashboard
export default function DocumentsPage() {
    redirect("/dashboard");
}
