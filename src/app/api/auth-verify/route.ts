import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { otp, hash } = await request.json();

        if (otp === '111111' && hash === 'EMERGENCY_HASH') {
            const token = `AUTH_SESSION.${Date.now() + 24 * 60 * 60 * 1000}`;
            return NextResponse.json({
                success: true,
                token: token,
            });
        }

        return NextResponse.json({ success: false, message: 'Invalid code.' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
