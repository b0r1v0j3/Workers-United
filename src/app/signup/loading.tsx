import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,#dbeafe_0%,transparent_55%),radial-gradient(900px_500px_at_85%_8%,#d1fae5_0%,transparent_50%),#f8fafc] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 lg:flex-row lg:gap-6">
                <div className="hidden rounded-[28px] border border-blue-200/20 bg-[linear-gradient(145deg,#0f172a_0%,#1e3a5f_55%,#1d4ed8_100%)] p-8 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.65)] lg:block lg:w-[46%]">
                    <Skeleton className="mb-10 h-14 w-56 rounded-2xl bg-white/20" />
                    <Skeleton className="mb-4 h-10 w-3/4 rounded-xl bg-white/25" />
                    <Skeleton className="mb-10 h-5 w-full rounded-xl bg-white/20" />
                    <div className="space-y-3">
                        <Skeleton className="h-14 w-full rounded-2xl bg-white/20" />
                        <Skeleton className="h-14 w-full rounded-2xl bg-white/20" />
                        <Skeleton className="h-14 w-full rounded-2xl bg-white/20" />
                    </div>
                </div>

                <div className="w-full rounded-[28px] border border-[#d9e2ef] bg-white/95 px-5 py-5 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] sm:px-7 sm:py-7 lg:w-[54%] lg:px-10 lg:py-9">
                    <div className="mx-auto w-full max-w-[470px]">
                        <div className="mb-7 text-center">
                            <Skeleton className="mx-auto mb-4 h-8 w-44 rounded-full" />
                            <Skeleton className="mx-auto mb-2 h-9 w-64 rounded-xl" />
                            <Skeleton className="mx-auto h-4 w-72 rounded-xl" />
                        </div>

                        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#dbe5f3] bg-[#f8fafc] p-1.5">
                            <Skeleton className="h-10 w-full rounded-xl" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                        </div>

                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full rounded-2xl" />
                            <div className="relative py-1">
                                <Skeleton className="h-px w-full" />
                            </div>
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-3 w-28 rounded-md" />
                                    <Skeleton className="h-12 w-full rounded-2xl" />
                                </div>
                            ))}
                            <Skeleton className="h-12 w-full rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
