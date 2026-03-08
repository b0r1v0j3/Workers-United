import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f5f5f4] font-montserrat">
            <div className="sticky top-0 z-40 h-[68px] border-b border-[#dddfe2]/50 bg-white/90 shadow-sm" />

            <div className="mx-auto flex w-full max-w-[1920px]">
                <aside className="hidden w-[280px] px-2 py-3 lg:block">
                    <div className="h-[calc(100vh-100px)] rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm backdrop-blur-sm">
                        <Skeleton className="mb-4 h-10 w-full rounded-xl" />
                        <Skeleton className="mb-3 h-12 w-full rounded-xl" />
                        <Skeleton className="mb-8 h-16 w-full rounded-2xl" />
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full rounded-xl" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                        </div>
                    </div>
                </aside>

                <main className="flex-1 px-3 pb-10 pt-6 sm:px-6 lg:ml-[280px] lg:pl-6 lg:pr-8">
                    <div className="mx-auto w-full max-w-[900px] space-y-6">
                        <Skeleton className="h-40 w-full rounded-[28px]" />
                        <Skeleton className="h-48 w-full rounded-[26px]" />
                        <Skeleton className="h-44 w-full rounded-[26px]" />
                        <Skeleton className="h-60 w-full rounded-[26px]" />
                    </div>
                </main>
            </div>
        </div>
    );
}
