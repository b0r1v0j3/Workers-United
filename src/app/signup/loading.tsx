import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f4f4f2] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 lg:flex-row lg:gap-6">
                <div className="hidden rounded-[28px] border border-[#e6e6e1] bg-[#f7f7f4] p-8 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)] lg:block lg:w-[46%]">
                    <Skeleton className="mb-10 h-14 w-56 rounded-2xl bg-[#e7e7e2]" />
                    <Skeleton className="mb-4 h-10 w-3/4 rounded-xl bg-[#ecece7]" />
                    <Skeleton className="mb-10 h-5 w-full rounded-xl bg-[#e7e7e2]" />
                    <div className="space-y-3">
                        <Skeleton className="h-14 w-full rounded-2xl bg-[#ecece7]" />
                        <Skeleton className="h-14 w-full rounded-2xl bg-[#ecece7]" />
                        <Skeleton className="h-14 w-full rounded-2xl bg-[#ecece7]" />
                    </div>
                </div>

                <div className="w-full rounded-[28px] border border-[#e6e6e1] bg-white px-5 py-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7 lg:w-[54%] lg:px-10 lg:py-9">
                    <div className="mx-auto w-full max-w-[470px]">
                        <div className="mb-7 text-center">
                            <Skeleton className="mx-auto mb-4 h-8 w-44 rounded-full bg-[#ecece7]" />
                            <Skeleton className="mx-auto mb-2 h-9 w-64 rounded-xl bg-[#e7e7e2]" />
                            <Skeleton className="mx-auto h-4 w-72 rounded-xl bg-[#ecece7]" />
                        </div>

                        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] p-1.5">
                            <Skeleton className="h-10 w-full rounded-xl bg-[#ecece7]" />
                            <Skeleton className="h-10 w-full rounded-xl bg-[#ecece7]" />
                        </div>

                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                            <div className="relative py-1">
                                <Skeleton className="h-px w-full bg-[#e4e4df]" />
                            </div>
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-3 w-28 rounded-md bg-[#ecece7]" />
                                    <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                                </div>
                            ))}
                            <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
