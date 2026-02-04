import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export async function GET() {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Test 1: Count candidates
    const { count: candidatesCount, error: countError } = await supabase
        .from("candidates")
        .select("*", { count: "exact", head: true });

    // Test 2: Select all candidates
    const { data: candidates, error: selectError } = await supabase
        .from("candidates")
        .select("*");

    // Test 3: Select with specific columns
    const { data: candidatesSpecific, error: specificError } = await supabase
        .from("candidates")
        .select("id, profile_id, status, created_at");

    // Test 4: Profiles table
    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

    // Test 5: Profiles count
    const { count: profilesCount, error: profilesCountError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

    return NextResponse.json({
        user_email: user.email,
        tests: {
            test1_count: { count: candidatesCount, error: countError?.message },
            test2_select_all: { data: candidates, error: selectError?.message },
            test3_select_specific: { data: candidatesSpecific, error: specificError?.message },
            test4_profiles: {
                count: profiles?.length,
                data: profiles?.map(p => ({ id: p.id, email: p.email, user_type: p.user_type })),
                error: profilesError?.message
            },
            test5_profiles_count: { count: profilesCount, error: profilesCountError?.message },
        }
    }, { status: 200 });
}
