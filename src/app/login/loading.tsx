import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f4f4f2] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto flex min-h-screen w-full max-w-[680px] items-center">
                <div className="w-full rounded-[28px] border border-[#e6e6e1] bg-white px-5 py-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                    <div className="mx-auto w-full max-w-[470px]">
                        <div className="mb-7 text-center">
                            <Skeleton className="mx-auto mb-4 h-8 w-44 rounded-full bg-[#ecece7]" />
                            <Skeleton className="mx-auto mb-2 h-9 w-64 rounded-xl bg-[#e7e7e2]" />
                            <Skeleton className="mx-auto h-4 w-72 rounded-xl bg-[#ecece7]" />
                        </div>

                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                            <div className="relative py-1">
                                <Skeleton className="h-px w-full bg-[#e4e4df]" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-28 rounded-md bg-[#ecece7]" />
                                <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-28 rounded-md bg-[#ecece7]" />
                                <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                            </div>
                            <Skeleton className="h-12 w-full rounded-2xl bg-[#ecece7]" />
                            <Skeleton className="h-16 w-full rounded-2xl bg-[#f2f2ef]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
