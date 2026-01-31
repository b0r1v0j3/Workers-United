import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (password !== 'Borivoje19.10.1992.') {
            return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
        }

        // Return EMERGENCY CHALLENGE
        return NextResponse.json({
            success: true,
            challenge: {
                hash: 'EMERGENCY_HASH',
                expiry: Date.now() + 5 * 60 * 1000,
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
