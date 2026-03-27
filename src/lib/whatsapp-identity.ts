import { loadCanonicalWorkerRecord, pickCanonicalWorkerRecord, type WorkerRecordQueryClient } from "@/lib/workers";
import { getAllAuthUsers, type AuthUsersClient } from "@/lib/supabase/admin";

type WhatsAppIdentityListResult = PromiseLike<{
    data?: unknown[] | null;
}>;

type WhatsAppIdentitySingleResult = PromiseLike<{
    data?: unknown | null;
}>;

interface WhatsAppIdentityAdminClient extends AuthUsersClient {
    from: (table: string) => unknown;
}

interface ResolveWhatsAppWorkerIdentityParams {
    admin: WhatsAppIdentityAdminClient;
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
    const workerTable = admin.from("worker_onboarding") as {
        select: (columns: string) => {
            or?: (filters: string) => {
                order: (column: string, options: { ascending: boolean }) => {
                    limit: (count: number) => WhatsAppIdentityListResult;
                };
            };
        };
        update?: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => PromiseLike<{
                error?: { message?: string | null } | null;
            }>;
        };
    };
    const workerMatchesSelect = workerTable.select(workerSelect);
    const { data: matchedWorkers } = workerMatchesSelect.or
        ? await workerMatchesSelect
            .or(`phone.eq.${normalizedPhone},phone.eq.${rawPhone}`)
            .order("updated_at", { ascending: false })
            .limit(25)
        : { data: null };

    const matchedWorkerRows = Array.isArray(matchedWorkers) ? (matchedWorkers as unknown as TWorker[]) : [];
    const linkedDirectMatches = matchedWorkerRows.filter((worker) => !!worker?.profile_id);
    let workerRecord = pickCanonicalWorkerRecord<TWorker>(
        linkedDirectMatches.length > 0 ? linkedDirectMatches : matchedWorkerRows
    );

    if (!workerRecord || !workerRecord.profile_id) {
        const phoneDigits = rawPhone.replace(/\D/g, "");
        const authUsers = await getAllAuthUsers(admin);
        const matchedUser = authUsers.find((user) => {
            const metadataPhone = String(user.user_metadata?.phone || "").replace(/\D/g, "");
            const userPhone = String(user.phone || "").replace(/\D/g, "");
            return (metadataPhone && metadataPhone === phoneDigits)
                || (userPhone && userPhone === phoneDigits);
        });

        if (matchedUser) {
            const { data: linkedWorkerRecord } = await loadCanonicalWorkerRecord<TWorker>(
                admin as unknown as WorkerRecordQueryClient,
                matchedUser.id,
                workerSelect
            );

            if (linkedWorkerRecord) {
                workerRecord = linkedWorkerRecord;
                if (workerTable.update) {
                    await workerTable
                        .update({ phone: normalizedPhone })
                        .eq("id", linkedWorkerRecord.id);
                }
            }
        }
    }

    const profileSelectQuery = workerRecord?.profile_id
        ? (admin.from("profiles") as {
            select: (columns: string) => {
                eq?: (column: string, value: string) => {
                    single?: () => WhatsAppIdentitySingleResult;
                };
            };
        })
            .select(profileSelect)
            .eq?.("id", workerRecord.profile_id)
        : null;
    const { data: profile } = profileSelectQuery?.single
        ? await profileSelectQuery.single()
        : { data: null };

    return {
        workerRecord: workerRecord || null,
        profile: (profile || null) as TProfile | null,
    };
}
