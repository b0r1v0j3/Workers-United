import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q")?.trim() || "";

        if (q.length < 2) {
            return NextResponse.json({ success: true, results: [] });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const adminClient = createAdminClient();

        // Perform parallel searches. We use ilike for case-insensitive partial match
        const [
            { data: profiles },
            { data: candidates },
            { data: employers }
        ] = await Promise.all([
            adminClient.from("profiles")
                .select("id, full_name, email, user_type")
                .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
                .limit(10),
            adminClient.from("candidates")
                .select("id, profile_id, status, passport_number, preferred_job")
                .ilike("passport_number", `%${q}%`)
                .limit(10),
            adminClient.from("employers")
                .select("id, profile_id, company_name, status, tax_id")
                .or(`company_name.ilike.%${q}%,tax_id.ilike.%${q}%`)
                .limit(10)
        ]);

        const results: Array<{ id: string; type: string; title: string; subtitle: string; link: string }> = [];

        // Map employers
        if (employers) {
            employers.forEach((e) => {
                results.push({
                    id: e.profile_id,
                    type: "Employer",
                    title: e.company_name,
                    subtitle: e.tax_id || e.status,
                    link: `/admin/employers` // Basic link, no specific employer param yet
                });
            });
        }

        // Map candidates found via passport_number
        const candidateProfileIds = new Set(candidates?.map((c) => c.profile_id) || []);

        // Add candidates found via name/email
        const allCandidateIds = new Set([...candidateProfileIds]);
        profiles?.forEach((p) => {
            if (p.user_type !== "admin" && p.user_type !== "employer") {
                allCandidateIds.add(p.id);
            }
        });

        if (allCandidateIds.size > 0) {
            // Get candidate data for these profiles
            const idsList = Array.from(allCandidateIds);
            const { data: matchedCandidates } = await adminClient
                .from("candidates")
                .select("id, profile_id, status, preferred_job")
                .in("profile_id", idsList.length > 0 ? idsList : ["__none__"])
                .limit(20);

            // Get profile data for these candidates if not already fetched
            // To simplify, we'll refetch profiles for the specific candidate IDs
            const { data: matchedProfiles } = await adminClient
                .from("profiles")
                .select("id, full_name, email")
                .in("id", idsList.length > 0 ? idsList : ["__none__"]);

            matchedCandidates?.forEach((c) => {
                const p = matchedProfiles?.find((prof) => prof.id === c.profile_id);
                results.push({
                    id: c.profile_id,
                    type: "Worker",
                    title: p?.full_name || p?.email || "Unknown",
                    subtitle: `${c.preferred_job || "No job"} • ${c.status}`,
                    link: `/admin/workers/${c.profile_id}`
                });
            });
        }

        // Add matching employers from profiles search if company name didn't match
        profiles?.forEach((p) => {
            if (p.user_type === "employer") {
                // Ignore if we already added it via employers search
                if (!employers?.find(e => e.profile_id === p.id)) {
                    results.push({
                        id: p.id,
                        type: "Employer",
                        title: p.full_name || p.email,
                        subtitle: "Employer Account",
                        link: `/admin/employers`
                    });
                }
            }
        });

        // Remove duplicates and limit
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values()).slice(0, 10);

        return NextResponse.json({ success: true, results: uniqueResults });
    } catch (e: any) {
        console.error("Global search error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
