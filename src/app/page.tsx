import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#f8fbff] font-montserrat overflow-hidden relative">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#f8fbff]/80 backdrop-blur-md px-6 py-4 lg:px-12 flex justify-between items-center transition-all">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-[#1e293b] rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
            <Image src="/logo.png" alt="Logo" width={20} height={20} className="brightness-0 invert" />
          </div>
          <span className="font-bold text-[#1e293b] text-xl tracking-tight">Workers United</span>
        </Link>
        <div className="flex items-center gap-6">
          {user ? (
            <Link
              href="/dashboard"
              className="bg-white text-[#1e293b] border border-[#e2e8f0] px-6 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-white text-[#1e293b] border border-[#e2e8f0] px-6 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="relative pt-32 pb-20">
        <div className="container mx-auto px-6 text-center">
          {/* Tag */}
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-8 animate-fade-in">
            <span className="text-blue-600 text-[10px] uppercase font-bold tracking-[0.2em]">
              Professional Work Migration
            </span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl lg:text-7xl font-bold text-[#1e293b] mb-8 leading-[1.1] tracking-tight">
              International Hiring <br />
              <span className="text-[#2f6fed]">Made Simple & Legal.</span>
            </h1>
            <p className="text-[#64748b] text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
              We connect serious employers with reliable global talent, guiding both sides through a fully transparent work visa process. No hidden fees. No false promises.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-24">
            <Link
              href="/login?role=candidate"
              className="bg-[#2f6fed] text-white px-10 py-4 rounded-full font-bold text-md shadow-xl shadow-blue-200/50 hover:bg-[#1e5bc6] transition-all transform hover:scale-[1.02] active:scale-95"
            >
              Join as Candidate
            </Link>
            <Link
              href="#employers"
              className="bg-white text-[#1e293b] border border-[#e2e8f0] px-10 py-4 rounded-full font-bold text-md shadow-sm hover:bg-gray-50 transition-all transform hover:scale-[1.02]"
            >
              Hire Global Talent
            </Link>
          </div>

          {/* Features / Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-12 text-[#94a3b8] font-bold text-xs uppercase tracking-widest">
            <span className="hover:text-blue-500 transition-colors cursor-default">Compliance-Ready</span>
            <span className="hover:text-blue-500 transition-colors cursor-default">Safe & Legal</span>
            <span className="hover:text-blue-500 transition-colors cursor-default">Verified Profiles</span>
          </div>
        </div>
      </main>

      {/* Decorative Bottom Corner Icon */}
      <div className="fixed bottom-6 left-6 w-10 h-10 bg-[#262626] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg opacity-80 hover:opacity-100 transition-opacity cursor-help">
        N
      </div>
    </div>
  );
}
