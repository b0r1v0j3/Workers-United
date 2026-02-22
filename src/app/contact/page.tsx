import Link from "next/link";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, Building2, Users } from "lucide-react";

export const metadata = {
    title: "Contact Us – Workers United",
    description: "Get in touch with Workers United for questions about international hiring, work visas, or our platform.",
};

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-[#F0F4F8]">
            <UnifiedNavbar variant="public" />

            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#2563EB] pt-28 pb-16">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Get in Touch</h1>
                    <p className="text-blue-200 text-lg max-w-2xl mx-auto">
                        Have questions about hiring international workers, applying for a work visa, or using our platform? We're here to help.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Contact Methods */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-slate-900">Contact Information</h2>
                        <p className="text-slate-600">
                            Whether you're a worker looking for opportunities in Serbia or an employer looking to hire international talent, we'd love to hear from you.
                        </p>

                        <div className="space-y-4">
                            <ContactCard
                                icon={<Mail className="text-blue-600" size={22} />}
                                title="Email Us"
                                detail="info@workersunited.eu"
                                href="mailto:info@workersunited.eu"
                                subtitle="We respond within 24 hours"
                            />
                            <ContactCard
                                icon={<Phone className="text-emerald-600" size={22} />}
                                title="Call Us"
                                detail="+381 21 298 2444"
                                href="tel:+381212982444"
                                subtitle="Mon - Fri, 9:00 - 17:00 CET"
                            />
                            <ContactCard
                                icon={<MessageCircle className="text-green-600" size={22} />}
                                title="WhatsApp"
                                detail="+381 21 298 2444"
                                href="https://wa.me/381212982444"
                                subtitle="Chat with us anytime"
                            />
                            <ContactCard
                                icon={<MapPin className="text-red-500" size={22} />}
                                title="Office"
                                detail="Novi Sad, Serbia"
                                subtitle="By appointment only"
                            />
                        </div>

                        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className="text-blue-600" />
                                <span className="font-bold text-sm text-blue-900">Business Hours</span>
                            </div>
                            <p className="text-sm text-blue-700">
                                Monday – Friday: 09:00 – 17:00 CET<br />
                                Saturday – Sunday: Closed
                            </p>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-slate-900">How Can We Help?</h2>

                        <div className="space-y-4">
                            <QuickLink
                                icon={<Users className="text-blue-600" size={20} />}
                                title="I'm a Worker"
                                description="Looking for job opportunities in Serbia? Create your profile and get verified."
                                href="/signup"
                                cta="Create Worker Account"
                            />
                            <QuickLink
                                icon={<Building2 className="text-indigo-600" size={20} />}
                                title="I'm an Employer"
                                description="Need reliable international workers? Post your job requirements and find matched candidates."
                                href="/signup?type=employer"
                                cta="Register as Employer"
                            />
                            <QuickLink
                                icon={<Send className="text-emerald-600" size={20} />}
                                title="General Inquiry"
                                description="Questions about the visa process, pricing, or how our platform works?"
                                href="mailto:info@workersunited.eu"
                                cta="Send us an Email"
                            />
                        </div>

                        {/* FAQ Teaser */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-3">Frequently Asked</h3>
                            <div className="space-y-3 text-sm text-slate-600">
                                <FAQItem q="How much does it cost for workers?" a="A one-time verification fee of $9 to join the hiring queue." />
                                <FAQItem q="How long does the visa process take?" a="Typically 4-8 weeks from document submission to visa approval." />
                                <FAQItem q="What documents do I need?" a="Passport, biometric photo, CV, and relevant diplomas or certificates." />
                                <FAQItem q="Is Workers United a licensed agency?" a="Yes, we operate in full compliance with Serbian employment and immigration law." />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-100 py-8 px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                    <p>© {new Date().getFullYear()} Workers United. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy-policy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function ContactCard({ icon, title, detail, subtitle, href }: {
    icon: React.ReactNode; title: string; detail: string; subtitle: string; href?: string;
}) {
    const content = (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <div>
                    <p className="font-bold text-slate-900">{title}</p>
                    <p className="text-blue-600 font-medium">{detail}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
                </div>
            </div>
        </div>
    );

    if (href) {
        return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{content}</a>;
    }
    return content;
}

function QuickLink({ icon, title, description, href, cta }: {
    icon: React.ReactNode; title: string; description: string; href: string; cta: string;
}) {
    return (
        <Link href={href} className="block bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 mb-1">{title}</h4>
                    <p className="text-sm text-slate-500 mb-2">{description}</p>
                    <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                        {cta} →
                    </span>
                </div>
            </div>
        </Link>
    );
}

function FAQItem({ q, a }: { q: string; a: string }) {
    return (
        <div>
            <p className="font-medium text-slate-900">{q}</p>
            <p className="text-slate-500">{a}</p>
        </div>
    );
}
