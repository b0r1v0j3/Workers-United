import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-24 hidden sm:block" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6">
                {/* Company Header */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <div className="flex items-center gap-4 mb-4">
                        <Skeleton className="h-16 w-16 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                </div>

                {/* Form Fields */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                    <Skeleton className="h-6 w-40 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
