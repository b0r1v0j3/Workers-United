import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType === "agency") {
        redirect("/profile/agency");
    }

    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    const dataClient = inspectProfileId ? createAdminClient() : supabase;
    const targetProfileId = inspectProfileId || user.id;

    const { data: profile } = await dataClient
        .from("profiles")
        .select("id, email, full_name, user_type")
        .eq("id", targetProfileId)
        .maybeSingle();

    const { data: workerRecord } = await loadCanonicalWorkerRecord<any>(
        dataClient,
        targetProfileId,
        "*"
    );

    if (inspectProfileId && !profile) {
        redirect("/admin/workers");
    }

    return (
        <ProfileClient
            readOnlyPreview={isAdminPreview}
            initialProfile={profile}
            initialWorkerRecord={workerRecord}
        />
    );
}
