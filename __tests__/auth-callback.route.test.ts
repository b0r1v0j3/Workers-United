import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const createClient = vi.fn();
const resolvePostAuthRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient,
}));

vi.mock("@/lib/auth-redirect", () => ({
    resolvePostAuthRedirect,
}));

describe("GET /auth/callback", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        createClient.mockResolvedValue({
            auth: {
                exchangeCodeForSession,
                getUser,
            },
        });
        exchangeCodeForSession.mockResolvedValue({ error: null });
        getUser.mockResolvedValue({
            data: {
                user: {
                    id: "user-1",
                    email: "worker@example.com",
                    user_metadata: { full_name: "Worker One", user_type: "worker" },
                },
            },
        });
        resolvePostAuthRedirect.mockResolvedValue("http://localhost/profile/worker");
    });

    it("runs the post-auth lifecycle even when next is present", async () => {
        const { GET } = await import("@/app/auth/callback/route");
        const request = new Request("http://localhost/auth/callback?code=abc123&next=/profile/worker/inbox&user_type=worker");

        const response = await GET(request);

        expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
        expect(resolvePostAuthRedirect).toHaveBeenCalledWith({
            origin: "http://localhost",
            user: expect.objectContaining({
                id: "user-1",
            }),
            next: "/profile/worker/inbox",
            userTypeParam: "worker",
            claimWorkerIdParam: null,
        });
        expect(response.status).toBe(307);
    });
});
