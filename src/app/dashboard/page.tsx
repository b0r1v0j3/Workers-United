import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentWizard from "@/components/DocumentWizard";
import { createCheckoutSession } from "@/app/actions/stripe";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch profile and readiness
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const { data: readiness } = await supabase
        .from("candidate_readiness")
        .select("*")
        .eq("user_id", user.id)
        .single();

    // Fetch document statuses
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", user.id);

    const docStatus = (type: string) => {
        const doc = documents?.find(d => d.document_type === type);
        return doc?.status || "missing";
    };

    const isReady = readiness?.is_ready || false;
    const verifiedCount = readiness?.verified_docs_count || 0;

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-white px-5 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Workers United" width={28} height={28} />
                    <span className="font-bold text-[#183b56] text-lg">Workers United</span>
                </div>
                <form action="/auth/signout" method="post">
                    <button type="submit" className="text-[#64748b] text-sm font-semibold hover:text-[#183b56]">
                        Logout
                    </button>
                </form>
            </nav>

            <div className="max-w-[600px] mx-auto px-5 py-8">
                {/* Greeting */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#1e293b]">
                        Hello, {profile?.full_name?.split(' ')[0] || "Candidate"}
                    </h1>
                    <p className="text-[#64748b] text-sm font-medium">Here is the live status of your application.</p>
                </div>

                {/* Verification Status Card */}
                <div className="bg-white rounded-[16px] p-6 shadow-sm mb-6">
                    <div className="flex flex-col gap-6">
                        {/* Application Received Step */}
                        <div className="flex gap-4 relative">
                            <div className="absolute left-[14px] top-[30px] w-[2px] h-[calc(100%+8px)] bg-[#e2e8f0]"></div>
                            <div className="w-[30px] h-[30px] rounded-full bg-[#10b981] text-white flex items-center justify-center flex-shrink-0 z-10 text-sm">✓</div>
                            <div className="pt-1">
                                <div className="font-bold text-[15px]">Application Received</div>
                                <div className="text-[13px] text-[#64748b]">We have received your basic information.</div>
                            </div>
                        </div>

                        {/* Document Review Step */}
                        <div className="flex gap-4 relative">
                            <div className="absolute left-[14px] top-[30px] w-[2px] h-[calc(100%+8px)] bg-[#e2e8f0]"></div>
                            <div className={`w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 text-sm ${isReady ? 'bg-[#10b981] border-[#10b981] text-white' : 'bg-white border-[#cbd5e1] text-[#64748b]'
                                }`}>
                                {isReady ? '✓' : '2'}
                            </div>
                            <div className="pt-1">
                                <div className="font-bold text-[15px]">Documents Review</div>
                                <div className="text-[13px] text-[#64748b]">
                                    {isReady
                                        ? "All mandatory documents verified!"
                                        : `${verifiedCount} of 3 mandatory documents verified.`}
                                </div>
                                {!isReady && documents && documents.length > 0 && (
                                    <div className="mt-2 flex gap-2 flex-wrap">
                                        {['passport', 'biometric_photo', 'diploma'].map(type => (
                                            <span key={type} className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${docStatus(type) === 'verified' ? 'bg-green-100 text-green-700' :
                                                docStatus(type) === 'verifying' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {type === 'biometric_photo' ? 'photo' : type}: {docStatus(type)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Enrollment Step */}
                        <div className="flex gap-4 relative">
                            <div className="w-[30px] h-[30px] rounded-full border-2 border-[#cbd5e1] bg-white text-[#64748b] flex items-center justify-center flex-shrink-0 z-10 text-sm">3</div>
                            <div className="pt-1 text-[#64748b]">
                                <div className="font-bold text-[15px] text-[#1e293b]">Profile Activation</div>
                                <div className="text-[13px]">Enroll in the "Find a Job" service to begin matching.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Document Wizard Area */}
                {!isReady && (
                    <div className="mb-10">
                        <div className="bg-white rounded-[16px] overflow-hidden shadow-sm border-2 border-[#dde3ec]">
                            <div className="bg-[#183b56] p-4 text-white text-center font-bold text-sm">
                                ACTION REQUIRED
                            </div>
                            <DocumentWizard
                                candidateId={user.id}
                                email={user.email || ""}
                            />
                        </div>
                    </div>
                )}

                {/* Job Activation Card - ONLY IF READY */}
                {isReady && (
                    <div className="mb-10">
                        <div className="bg-white rounded-[16px] p-8 shadow-sm border-2 border-[#10b981] relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-[#10b981] text-white px-4 py-1 text-[11px] font-bold uppercase tracking-widest rounded-bl-lg">
                                Ready for Activation
                            </div>

                            <h2 className="text-xl font-bold text-[#183b56] mb-2">Find a Job Activation</h2>
                            <p className="text-gray-600 text-[14px] leading-relaxed mb-6">
                                Your documents are verified. Activate your profile now to start matching with employers.
                                <br />
                                <span className="font-semibold text-[#183b56]">90-day money-back guarantee if no job is found.</span>
                            </p>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-[#183b56]">
                                    <span className="text-2xl font-bold">$9</span>
                                    <span className="text-sm text-gray-500 font-medium"> / one-time</span>
                                </div>

                                {process.env.PAYMENTS_ENABLED === "true" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_ENTRY_FEE_PRICE_ID && (
                                    <form action={createCheckoutSession}>
                                        <button className="bg-[#2f6fed] text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-[#1e5bc6] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-blue-200">
                                            Activate Profile
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center mt-12 pb-10">
                    <p className="text-[12px] text-[#94a3b8] font-medium">Worker ID: {user.email}</p>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
    return (
        <div className="bg-white border border-[#dde3ec] rounded-[12px] p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 mb-1 font-medium">{title}</p>
                    <p className="text-2xl font-bold text-[#183b56]">{value}</p>
                </div>
                <div className="w-12 h-12 bg-[#f4f6fb] rounded-lg flex items-center justify-center text-2xl">
                    {icon}
                </div>
            </div>
        </div>
    );
}

function ActionCard({ title, description, buttonText, href }: { title: string; description: string; buttonText: string; href: string }) {
    return (
        <div className="bg-white border border-[#dde3ec] rounded-[12px] p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#183b56] mb-2">{title}</h3>
            <p className="text-gray-600 text-sm mb-6">{description}</p>
            <Link
                href={href}
                className="bg-[#2f6fed] text-white px-6 py-3 rounded-full font-bold text-sm inline-block hover:bg-[#1e5bc6] transition-colors"
            >
                {buttonText}
            </Link>
        </div>
    );
}
