"use client";

import Link from "next/link";
import { AlertTriangle, Building2 } from "lucide-react";

export default function AgencySetupRequired() {
    return (
        <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fff9ec_0%,#fff4db_100%)] p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                        <AlertTriangle size={14} />
                        Setup Required
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">Agency workspace is not active yet</h1>
                    <p className="mt-3 text-sm leading-relaxed text-[#57534e]">
                        This agency account exists, but the database setup for agency ownership has not been activated on this environment yet.
                        Worker and employer areas remain available, while agency tools stay paused until setup finishes.
                    </p>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18181b] text-white shadow-[0_18px_35px_-30px_rgba(15,23,42,0.4)]">
                    <Building2 size={24} />
                </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-[#57534e]">
                If you need the worker side in the meantime, go to{" "}
                <Link href="/profile" className="font-semibold text-[#18181b] underline-offset-2 hover:underline">
                    your profile home
                </Link>
                .
            </div>
        </div>
    );
}
