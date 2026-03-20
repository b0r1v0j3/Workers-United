const WELCOME_EMAIL_ACTIVE_STATUSES = ["pending", "sent"] as const;

export async function hasQueuedOrSentWelcomeEmail(
    supabase: any,
    userId: string
) {
    const { data, error } = await supabase
        .from("email_queue")
        .select("id")
        .eq("user_id", userId)
        .eq("email_type", "welcome")
        .in("status", WELCOME_EMAIL_ACTIVE_STATUSES)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return Boolean(data);
}
