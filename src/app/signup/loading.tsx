import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-8 w-full max-w-lg">
                <div className="text-center mb-6">
                    <Skeleton className="h-10 w-48 mx-auto mb-2" />
                    <Skeleton className="h-4 w-64 mx-auto" />
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                    <Skeleton className="h-11 w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}
