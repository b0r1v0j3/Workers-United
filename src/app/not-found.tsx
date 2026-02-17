import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-blue-50 text-[#1877f2] rounded-full flex items-center justify-center mx-auto mb-4">
                    <SearchX size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
                <p className="text-gray-500 mb-8">
                    The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                </p>

                <Link
                    href="/"
                    className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <Home size={18} />
                    Go to Homepage
                </Link>
            </div>
        </div>
    );
}
