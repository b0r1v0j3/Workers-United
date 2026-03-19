import AppShell from "@/components/AppShell";
import EmailPreviewWorkspace from "@/components/admin/EmailPreviewWorkspace";
import { createClient } from "@/lib/supabase/server";

export default async function InternalEmailPreviewPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-5">
                <section className="rounded-[28px] border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">Internal tools</div>
                    <div className="mt-2 font-semibold">Email preview sandbox</div>
                    <p className="mt-2 leading-6 text-blue-900/80">
                        Ovde možeš da pregledaš sve sistemske mejlove i live payload preview linkove bez mešanja u business admin radnu površinu.
                    </p>
                </section>
                <EmailPreviewWorkspace />
            </div>
        </AppShell>
    );
}
