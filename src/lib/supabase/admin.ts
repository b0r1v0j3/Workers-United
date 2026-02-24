import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client with Service Role key
 * This bypasses ALL Row Level Security policies
 * ONLY use for admin-only operations!
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin operations require service role key to bypass RLS.");
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Fetches ALL auth users with pagination.
 * Supabase listUsers() defaults to 50 per page — this loops through all pages.
 * Use this instead of adminClient.auth.admin.listUsers() everywhere.
 */
export async function getAllAuthUsers(adminClient?: ReturnType<typeof createAdminClient>) {
    const client = adminClient || createAdminClient();
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // max allowed by Supabase

    while (true) {
        const { data, error } = await client.auth.admin.listUsers({
            page,
            perPage,
        });
        if (error) {
            console.error("[getAllAuthUsers] Error fetching page", page, error);
            break;
        }
        const users = data?.users || [];
        allUsers.push(...users);
        if (users.length < perPage) break; // last page
        page++;
    }

    return allUsers;
}
