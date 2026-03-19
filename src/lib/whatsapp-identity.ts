import { loadCanonicalWorkerRecord, pickCanonicalWorkerRecord } from "@/lib/workers";

interface ResolveWhatsAppWorkerIdentityParams {
    admin: any;
    rawPhone: string;
    normalizedPhone: string;
    workerSelect: string;
    profileSelect?: string;
}

export async function resolveWhatsAppWorkerIdentity<
    TWorker extends { id: string; profile_id?: string | null },
    TProfile extends Record<string, unknown> = Record<string, unknown>
>({
    admin,
    rawPhone,
    normalizedPhone,
    workerSelect,
    profileSelect = "full_name, email, user_type, created_at",
}: ResolveWhatsAppWorkerIdentityParams): Promise<{
    workerRecord: TWorker | null;
    profile: TProfile | null;
}> {
    const { data: matchedWorkers } = await admin
        .from("worker_onboarding")
        .select(workerSelect)
        .or(`phone.eq.${normalizedPhone},phone.eq.${rawPhone}`)
        .order("updated_at", { ascending: false })
        .limit(25);

    let workerRecord = pickCanonicalWorkerRecord<TWorker>(
        (matchedWorkers || []) as TWorker[]
    );

    if (!workerRecord) {
        const phoneDigits = rawPhone.replace(/\D/g, "");
        const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const matchedUser = authData?.users?.find((user: any) => {
            const metadataPhone = String(user.user_metadata?.phone || "").replace(/\D/g, "");
            const userPhone = String(user.phone || "").replace(/\D/g, "");
            return (metadataPhone && metadataPhone === phoneDigits)
                || (userPhone && userPhone === phoneDigits);
        });

        if (matchedUser) {
            const { data: linkedWorkerRecord } = await loadCanonicalWorkerRecord<TWorker>(
                admin,
                matchedUser.id,
                workerSelect
            );

            if (linkedWorkerRecord) {
                workerRecord = linkedWorkerRecord;
                await admin
                    .from("worker_onboarding")
                    .update({ phone: normalizedPhone })
                    .eq("id", linkedWorkerRecord.id);
            }
        }
    }

    const { data: profile } = workerRecord?.profile_id
        ? await admin
            .from("profiles")
            .select(profileSelect)
            .eq("id", workerRecord.profile_id)
            .single()
        : { data: null };

    return {
        workerRecord: workerRecord || null,
        profile: (profile || null) as TProfile | null,
    };
}
