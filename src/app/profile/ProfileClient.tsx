"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import {
    User,
    Briefcase,
    FileText,
    CheckCircle2,
    AlertCircle,
    Building2,
    MapPin,
    Phone,
    Globe,
    Camera,
    Pencil,
    MoreHorizontal,
    Plus,
    X,
    ChevronRight,
    Search,
    Clock,
    Shield
} from "lucide-react";

interface ProfileClientProps {
    userType: "candidate" | "employer";
    user: any;
    candidate?: any;
    employer?: any;
    documents?: any[];
    offers?: any[];
}

const INDUSTRIES = [
    "Construction", "Manufacturing", "Agriculture", "Hospitality",
    "Healthcare", "Transportation", "Retail", "IT & Technology",
    "Food Processing", "Warehousing & Logistics", "Other"
];

const COMPANY_SIZES = [
    "1-10 employees", "11-50 employees", "51-200 employees",
    "201-500 employees", "500+ employees"
];

type TabType = "timeline" | "about" | "jobs" | "documents" | "photos";

export default function ProfileClient({
    userType, user, candidate, employer, documents = [], offers = []
}: ProfileClientProps) {
    const router = useRouter();
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<TabType>("timeline");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Employer form state
    const [employerForm, setEmployerForm] = useState({
        company_name: employer?.company_name || "",
        pib: employer?.pib || "",
        industry: employer?.industry || "",
        company_size: employer?.company_size || "",
        contact_phone: employer?.contact_phone || "",
        website: employer?.website || "",
        company_address: employer?.company_address || "",
        accommodation_address: employer?.accommodation_address || "",
        work_location: employer?.work_location || "",
        workers_needed: employer?.workers_needed || 1,
        salary_range: employer?.salary_range || "",
        job_description: employer?.job_description || "",
        description: employer?.description || "",
    });

    const handleEmployerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setEmployerForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const saveEmployer = async () => {
        setSaving(true);
        setError("");
        try {
            if (employerForm.pib && !/^\d{8}$/.test(employerForm.pib)) {
                throw new Error("PIB must be exactly 8 digits");
            }

            const data = {
                company_name: employerForm.company_name || null,
                pib: employerForm.pib || null,
                industry: employerForm.industry || null,
                company_size: employerForm.company_size || null,
                contact_phone: employerForm.contact_phone || null,
                website: employerForm.website || null,
                company_address: employerForm.company_address || null,
                accommodation_address: employerForm.accommodation_address || null,
                work_location: employerForm.work_location || null,
                workers_needed: parseInt(String(employerForm.workers_needed)) || 1,
                salary_range: employerForm.salary_range || null,
                job_description: employerForm.job_description || null,
                description: employerForm.description || null,
            };

            if (employer?.id) {
                await supabase.from("employers").update(data).eq("id", employer.id);
            } else {
                await supabase.from("employers").insert({ ...data, profile_id: user.id, status: "pending" });
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            setIsEditing(false); // Exit edit mode on save
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "slate" };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald" };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red" };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber" };
        return { status: "uploaded", label: "Uploaded", color: "blue" };
    };

    const displayName = userType === 'employer'
        ? (employer?.company_name || "New Company")
        : (candidate?.profiles?.full_name || user.email?.split('@')[0] || "User");

    const displaySubtitle = userType === 'employer'
        ? (employer?.industry || "Industry not set")
        : (candidate?.nationality || "Candidate");

    const coverImage = userType === 'employer'
        ? "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop" // Corporate/Building
        : "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop"; // Coding/Work;

    return (
        <AppShell user={user} variant="dashboard">
            <div className="bg-white shadow rounded-xl overflow-hidden mb-5">
                <div className="p-6 pb-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
                            <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
                                {displaySubtitle}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            {userType === 'employer' ? (
                                <button
                                    onClick={() => {
                                        setIsEditing(!isEditing);
                                        setActiveTab('about');
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <Pencil size={18} /> Edit Company
                                </button>
                            ) : (
                                <>
                                    <Link href="/onboarding" className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2">
                                        <Pencil size={18} /> Edit Profile
                                    </Link>
                                    <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2">
                                        <FileText size={18} /> CV
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Profile Tabs */}
                    <div className="flex gap-1 border-t border-slate-100 pt-2">
                        <TabButton label="Timeline" onClick={() => setActiveTab('timeline')} active={activeTab === 'timeline'} />
                        <TabButton label="About" onClick={() => setActiveTab('about')} active={activeTab === 'about'} />
                        {userType === 'employer' ? (
                            <TabButton label="Jobs" onClick={() => setActiveTab('jobs')} active={activeTab === 'jobs'} />
                        ) : (
                            <TabButton label="Applications" onClick={() => setActiveTab('jobs')} active={activeTab === 'jobs'} />
                        )}
                        <TabButton label="Photos" onClick={() => setActiveTab('photos')} active={activeTab === 'photos'} />
                        {userType === 'candidate' && (
                            <TabButton label="Documents" onClick={() => setActiveTab('documents')} active={activeTab === 'documents'} />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left Column - Intro/Details */}
                <div className="lg:col-span-1 space-y-5">
                    {/* Intro Card */}
                    <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Intro</h2>
                        <div className="space-y-4">
                            {userType === 'employer' ? (
                                <>
                                    {employer?.description && <p className="text-sm text-slate-600 text-center mb-4">{employer.description}</p>}
                                    <IntroItem icon={<Briefcase size={20} />} text={employer?.industry || "Industry not added"} />
                                    <IntroItem icon={<Building2 size={20} />} text={employer?.company_size || "Size not added"} />
                                    <IntroItem icon={<MapPin size={20} />} text={employer?.company_address || "Address not added"} />
                                    <IntroItem icon={<Globe size={20} />} text={<a href={employer?.website} target="_blank" className="text-blue-600 hover:underline">{employer?.website || "Website not added"}</a>} />
                                </>
                            ) : (
                                <>
                                    <IntroItem icon={<User size={20} />} text={candidate?.profiles?.full_name || "Name not set"} />
                                    <IntroItem icon={<Briefcase size={20} />} text="Looking for work" />
                                    <IntroItem icon={<Globe size={20} />} text={candidate?.nationality || "Nationality not set"} />
                                    <IntroItem icon={<Clock size={20} />} text={`Joined ${new Date(user.created_at).toLocaleDateString()}`} />
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => { setActiveTab('about'); setIsEditing(true); }}
                            className="w-full mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg transition-colors"
                        >
                            Edit Details
                        </button>
                    </div>

                    {/* Photos/Docs Preview Card */}
                    <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900">Photos</h2>
                            <button onClick={() => setActiveTab('photos')} className="text-blue-600 text-sm hover:underline">See All</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg overflow-hidden">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                <div key={i} className="aspect-square bg-slate-100 hover:opacity-90 cursor-pointer">
                                    <img
                                        src={`https://source.unsplash.com/random/200x200?sig=${i}`}
                                        alt={`Photo ${i}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Feed/Content */}
                <div className="lg:col-span-2 space-y-5">
                    {activeTab === 'timeline' && (
                        <div className="space-y-5">
                            {/* Create Post Input */}
                            <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
                                <div className="flex gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        <img src={user?.user_metadata?.avatar_url || "/avatar-placeholder.png"} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 cursor-pointer hover:bg-slate-200 transition-colors text-slate-500">
                                        What's on your mind?
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 px-2">
                                    <div className="flex gap-2">
                                        <ActionButton icon={<Camera size={20} className="text-red-500" />} label="Live Video" />
                                        <ActionButton icon={<FileText size={20} className="text-green-500" />} label="Photo/Video" />
                                        <ActionButton icon={<Briefcase size={20} className="text-blue-500" />} label="Job Event" />
                                    </div>
                                </div>
                            </div>

                            {/* Feed Items */}
                            {userType === 'employer' ? (
                                <FeedItem
                                    user={user}
                                    time="2 hours ago"
                                    text={`We are hiring! Looking for ${employer?.workers_needed || 5} skilled workers for our ${employer?.work_location || "Belgrade"} location.`}
                                    image="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop"
                                />
                            ) : (
                                <FeedItem
                                    user={user}
                                    time="Just now"
                                    text="Just updated my profile and uploaded new certificates! Ready for new opportunities."
                                />
                            )}

                            <FeedItem
                                name="Workers United"
                                avatar="/logo.png"
                                time="1 day ago"
                                text="Welcome to the new Workers United platform! Connect with employers and find your dream job."
                                image="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2084&auto=format&fit=crop"
                            />
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-900">About</h2>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="text-blue-600 font-semibold hover:bg-blue-50 px-3 py-1 rounded-lg">
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="p-6">
                                {userType === 'employer' ? (
                                    isEditing ? (
                                        <div className="space-y-6">
                                            {/* Employer Edit Form */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Input label="Company Name *" name="company_name" value={employerForm.company_name} onChange={handleEmployerChange} />
                                                <Input label="PIB (Tax ID) *" name="pib" value={employerForm.pib} onChange={handleEmployerChange} maxLength={8} />
                                                <Select label="Industry" name="industry" value={employerForm.industry} onChange={handleEmployerChange} options={INDUSTRIES} />
                                                <Select label="Company Size" name="company_size" value={employerForm.company_size} onChange={handleEmployerChange} options={COMPANY_SIZES} />
                                                <Input label="Website" name="website" value={employerForm.website} onChange={handleEmployerChange} icon={<Globe size={16} />} />
                                                <Input label="Contact Phone" name="contact_phone" value={employerForm.contact_phone} onChange={handleEmployerChange} icon={<Phone size={16} />} />
                                            </div>
                                            <TextArea label="Description" name="description" value={employerForm.description} onChange={handleEmployerChange} />
                                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg">Cancel</button>
                                                <button onClick={saveEmployer} disabled={saving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                                    {saving ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                            {success && <p className="text-emerald-600 font-medium text-center">Saved successfully!</p>}
                                            {error && <p className="text-red-600 font-medium text-center">{error}</p>}
                                        </div>
                                    ) : (
                                        <div className="space-y-4 text-slate-700">
                                            <DetailRow label="Company Name" value={employer?.company_name} />
                                            <DetailRow label="Industry" value={employer?.industry} />
                                            <DetailRow label="Size" value={employer?.company_size} />
                                            <DetailRow label="Location" value={employer?.work_location} />
                                            <DetailRow label="Description" value={employer?.description} fullWidth />
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-10 text-slate-500">
                                        <p>Candidate details editing coming soon.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'jobs' && (
                        <div className="space-y-4">
                            {userType === 'employer' ? (
                                <div className="bg-white p-8 rounded-xl shadow border border-slate-200 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                        <Briefcase size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Jobs</h3>
                                    <p className="text-slate-500 mb-6">Create a job posting to start finding candidates.</p>
                                    <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">
                                        Post a Job
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {offers && offers.length > 0 ? offers.map((offer: any) => (
                                        <div key={offer.id} className="bg-white p-4 rounded-xl shadow border border-slate-200">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-900">{offer.employers?.company_name}</h3>
                                                    <p className="text-slate-600">{offer.position || "Position"}</p>
                                                </div>
                                                <Badge status={offer.status} />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="bg-white p-8 rounded-xl shadow border border-slate-200 text-center">
                                            <p className="text-slate-500">No active applications yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'documents' && userType === 'candidate' && (
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">My Documents</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DocumentCard label="Passport" status={getDocStatus("passport")} />
                                <DocumentCard label="Photo" status={getDocStatus("photo")} />
                                <DocumentCard label="Diploma" status={getDocStatus("diploma")} />
                                <DocumentCard label="Certificate" status={getDocStatus("certificate")} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'photos' && (
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Photos</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {/* Placeholders */}
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="aspect-square bg-slate-100 rounded-lg"></div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-3 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${active ? 'text-blue-600' : 'text-slate-600 hover:bg-slate-100 rounded-lg'}`}
        >
            {label}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full" />
            )}
        </button>
    );
}

function IntroItem({ icon, text }: { icon: React.ReactNode, text: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 text-slate-700">
            <div className="text-slate-400">
                {icon}
            </div>
            <span className="text-[15px] font-medium leading-tight">{text}</span>
        </div>
    );
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 font-medium text-sm">
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

function FeedItem({ user, name, avatar, time, text, image }: any) {
    const displayName = name || (user?.user_metadata?.full_name || "User");
    const displayAvatar = avatar || (user?.user_metadata?.avatar_url || "/avatar-placeholder.png");

    return (
        <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 text-[15px]">{displayName}</h4>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        {time} · <Globe size={10} />
                    </span>
                </div>
                <button className="ml-auto text-slate-400 hover:bg-slate-100 p-2 rounded-full">
                    <MoreHorizontal size={20} />
                </button>
            </div>
            <p className="text-slate-800 text-[15px] leading-relaxed mb-3">
                {text}
            </p>
            {image && (
                <div className="rounded-lg overflow-hidden border border-slate-100 mb-3">
                    <img src={image} alt="Post content" className="w-full h-auto object-cover" />
                </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                <ActionButton icon={<span className="text-xl">👍</span>} label="Like" />
                <ActionButton icon={<span className="text-xl">💬</span>} label="Comment" />
                <ActionButton icon={<span className="text-xl">↗️</span>} label="Share" />
            </div>
        </div>
    );
}

function DetailRow({ label, value, fullWidth }: any) {
    if (!value) return null;
    return (
        <div className={`${fullWidth ? 'w-full' : 'w-full'} py-2`}>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-slate-900 font-medium text-base">{value}</span>
        </div>
    );
}

function Input({ label, name, value, onChange, placeholder, type = "text", maxLength, helper, icon }: any) {
    return (
        <div className="space-y-1.5 group">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className={`w-full ${icon ? 'pl-10 mr-4' : 'px-4'} py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 placeholder:text-slate-400`}
                />
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                        {icon}
                    </div>
                )}
            </div>
            {helper && <p className="text-xs text-slate-500">{helper}</p>}
        </div>
    );
}

function TextArea({ label, name, value, onChange, placeholder, rows = 3, helper }: any) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none"
            />
            {helper && <p className="text-xs text-slate-500">{helper}</p>}
        </div>
    );
}

function Select({ label, name, value, onChange, options }: any) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative">
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 appearance-none cursor-pointer"
                >
                    <option value="">Select...</option>
                    {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight size={16} className="rotate-90" />
                </div>
            </div>
        </div>
    );
}

function DocumentCard({ label, status }: { label: string, status: any }) {
    const bgColors: any = {
        emerald: "bg-emerald-100 text-emerald-700",
        red: "bg-red-100 text-red-700",
        amber: "bg-amber-100 text-amber-700",
        blue: "bg-blue-100 text-blue-700",
        slate: "bg-slate-100 text-slate-600"
    };

    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'} border border-slate-200`}>
                    <FileText size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{label}</h4>
                    <p className="text-xs text-slate-500">Document</p>
                </div>
            </div>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${bgColors[status.color]}`}>
                {status.label}
            </span>
        </div>
    );
}

function Badge({ status }: { status: string }) {
    const styles: any = {
        accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
        rejected: "bg-red-100 text-red-700 border-red-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        waiting: "bg-slate-100 text-slate-600 border-slate-200"
    };

    const defaultStyle = styles[status] || styles.pending;

    return (
        <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${defaultStyle}`}>
            {status}
        </span>
    );
}
