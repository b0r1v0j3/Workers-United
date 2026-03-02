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

            <div className="max-w-6xl mx-auto px-4 py-6">
                <Skeleton className="h-8 w-64 mb-6" />
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden">
                    <div className="p-4 border-b border-[#dddfe2] flex gap-3">
                        <Skeleton className="h-9 w-48 rounded-lg" />
                        <Skeleton className="h-9 w-24 rounded-lg" />
                    </div>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1 space-y-1">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-8 w-20 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
