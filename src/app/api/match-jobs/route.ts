import { NextResponse } from 'next/server';
import { sendMatchNotification } from '@/lib/brevo';

export async function POST(request: Request) {
    try {
        const { jobId, employerEmail } = await request.json();

        // 1. Simulate Matching Delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 2. Mock Finding Candidates
        const matchesFound = 3;

        // 3. Trigger Notification (Restricted)
        await sendMatchNotification(employerEmail, matchesFound);

        // 4. Return Success
        return NextResponse.json({
            success: true,
            message: "Matching process started. Admin notified.",
            matches: matchesFound,
        });
    } catch (error) {
        return NextResponse.json({ success: false, message: "Internal Error" }, { status: 500 });
    }
}
