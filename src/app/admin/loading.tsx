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
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-4">
                            <Skeleton className="h-3 w-16 mb-2" />
                            <Skeleton className="h-8 w-20" />
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden">
                    <div className="p-4 border-b border-[#dddfe2] flex gap-3">
                        <Skeleton className="h-9 w-48 rounded-lg" />
                        <Skeleton className="h-9 w-24 rounded-lg" />
                    </div>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24 ml-auto" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
