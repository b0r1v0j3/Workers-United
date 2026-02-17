import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Navbar Skeleton */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-24 hidden sm:block" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6">
                {/* CTA Skeleton */}
                <Skeleton className="h-40 w-full mb-4 rounded-xl" />

                {/* Profile Completion Skeleton */}
                <Skeleton className="h-24 w-full mb-4 rounded-xl" />

                {/* Tabs Skeleton */}
                <div className="bg-white rounded-lg shadow-sm border border-[#dddfe2] mb-4 p-2 flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>

                {/* Profile Info Skeleton */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
