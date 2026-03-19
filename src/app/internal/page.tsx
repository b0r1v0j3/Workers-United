import Link from "next/link";
import { AlertTriangle, MailX, Mail, Shield, Wrench } from "lucide-react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { buildAdminEmailPreviewHref } from "@/lib/admin-email-preview";

type InternalToolTone = "amber" | "rose" | "blue";

const INTERNAL_TOOLS: Array<{
    href: string;
    title: string;
    description: string;
    icon: typeof AlertTriangle;
    tone: InternalToolTone;
}> = [
    {
        href: "/internal/ops",
        title: "Ops Monitor",
        description: "Daily incident signals, route failures, WhatsApp confusion, docs backlog, payment drift, and auth anomalies.",
        icon: AlertTriangle,
        tone: "amber",
    },
    {
        href: "/internal/email-health",
        title: "Email Health",
        description: "Bounced and invalid addresses, typo domains, and safe-delete cleanup candidates.",
        icon: MailX,
        tone: "rose",
    },
    {
        href: "/internal/email-preview",
        title: "Email Preview",
        description: "Template rendering sandbox for system emails without mixing it into the business admin workspace.",
        icon: Mail,
        tone: "blue",
    },
];

const TONE_STYLES: Record<InternalToolTone, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
};

const INTERNAL_EMAIL_PREVIEWS = [
    {
        href: "/internal/email-preview",
        label: "Open sandbox",
        copy: "Browse every system template from one place.",
    },
    {
        href: buildAdminEmailPreviewHref(
            "document_review_result",
            { name: "Marko Petrovic", approved: true, docType: "Passport" },
            "/internal/email-preview"
        ),
        label: "Approved document sample",
        copy: "See the exact premium approval layout for document review emails.",
    },
    {
        href: buildAdminEmailPreviewHref(
            "document_review_result",
            {
                name: "Marko Petrovic",
                approved: false,
                docType: "Passport",
                feedback: "Please upload a clearer passport photo with the full biodata page visible.",
            },
            "/internal/email-preview"
        ),
        label: "Re-upload request sample",
        copy: "Check the rejection/re-upload email without waiting for a real send.",
    },
];

export default async function InternalToolsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#e6e6e1] bg-[#fafaf9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                        <Shield size={13} />
                        Internal only
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#18181b]">Internal Tools</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#57534e]">
                        Ovo nije business admin. Ovde držimo tehničke monitore, incident hygiene, i template sandbox alate koje ne treba mešati sa operativnim ekranima za firmu.
                    </p>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    {INTERNAL_TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className={`rounded-[24px] border p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-34px_rgba(15,23,42,0.25)] ${TONE_STYLES[tool.tone]}`}
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                    <Icon size={18} />
                                </div>
                                <div className="mt-4 text-lg font-semibold">{tool.title}</div>
                                <p className="mt-2 text-sm leading-6 text-current/75">{tool.description}</p>
                            </Link>
                        );
                    })}
                </section>

                <section className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d4ed8]">
                        <Mail size={13} />
                        Popular email previews
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-[#18181b]">Open common worker emails directly</h2>
                    <p className="mt-2 text-sm leading-6 text-[#57534e]">
                        Use these shortcuts when you just want to inspect the exact visual treatment of the most sensitive worker-facing emails.
                    </p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {INTERNAL_EMAIL_PREVIEWS.map((preview) => (
                            <Link
                                key={preview.href}
                                href={preview.href}
                                className="rounded-[20px] border border-[#e6e6e1] bg-[#fafaf9] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#d6d3d1] hover:bg-white"
                            >
                                <div className="text-sm font-semibold text-[#18181b]">{preview.label}</div>
                                <p className="mt-2 text-sm leading-6 text-[#57534e]">{preview.copy}</p>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="rounded-[24px] border border-dashed border-[#ddd6c8] bg-[#fafaf9] p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#18181b] shadow-sm">
                            <Wrench size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[#18181b]">Pravilo razdvajanja</h2>
                            <p className="mt-1 text-sm leading-6 text-[#57534e]">
                                Business admin ostaje za workers, employers, agencies, docs review, queue, inbox, jobs, payments i analytics. Incident monitoring, debug i template sandbox alati ostaju samo ovde.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}
