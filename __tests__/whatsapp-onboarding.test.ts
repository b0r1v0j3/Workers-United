import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

import { handleWhatsAppOnboarding } from "@/app/api/whatsapp/webhook/route";

function createOnboardingAdmin(initialState?: Record<string, unknown> | null) {
    const store = {
        state: initialState ? { ...initialState } : null,
        cleared: 0,
    };

    return {
        store,
        client: {
            from(table: string) {
                expect(table).toBe("whatsapp_onboarding_state");

                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    single: async () => ({
                                        data: store.state,
                                    }),
                                };
                            },
                        };
                    },
                    upsert: async (payload: Record<string, unknown>) => {
                        store.state = payload;
                        return { error: null };
                    },
                    delete() {
                        return {
                            eq: async () => {
                                store.cleared += 1;
                                store.state = null;
                                return { error: null };
                            },
                        };
                    },
                };
            },
        },
    };
}

describe("handleWhatsAppOnboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("expires stale onboarding state and lets normal chat continue", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "passport_number",
            collected_data: { full_name: "Ali Worker" },
            language: "en",
            updated_at: "2026-03-12T08:00:00.000Z",
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "How does payment work?",
            null,
            "en"
        );

        expect(reply).toBeNull();
        expect(store.cleared).toBe(1);
        expect(store.state).toBeNull();
    });

    it("clears onboarding state for registered workers instead of trapping them", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "full_name",
            collected_data: {},
            language: "en",
            updated_at: new Date().toISOString(),
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "hello",
            { profile_id: "profile_1", onboarding_completed: false },
            "en"
        );

        expect(reply).toBeNull();
        expect(store.cleared).toBe(1);
        expect(store.state).toBeNull();
    });

    it("lets users cancel onboarding in their current language", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "birth_city",
            collected_data: { full_name: "Ali Worker" },
            language: "sr",
            updated_at: new Date().toISOString(),
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "prekini",
            null,
            "sr"
        );

        expect(reply).toContain("zaustavio sam popunjavanje profila");
        expect(store.cleared).toBe(1);
        expect(store.state).toBeNull();
    });

    it("switches onboarding language mid-flow instead of consuming the request as field data", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "full_name",
            collected_data: {},
            language: "en",
            updated_at: new Date().toISOString(),
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "Pisi na srpskom",
            null,
            "en"
        );

        expect(reply).toContain("nastaviću na srpskom");
        expect(reply).toContain("puno ime i prezime");
        expect(store.cleared).toBe(0);
        expect((store.state as Record<string, unknown>)?.current_step).toBe("full_name");
        expect((store.state as Record<string, unknown>)?.language).toBe("sr");
        expect((store.state as Record<string, unknown>)?.collected_data).toEqual({});
    });

    it("reprompts on ambiguous yes-no answers instead of coercing them to No", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "has_spouse",
            collected_data: {
                full_name: "Ali Worker",
                passport_expiry_date: "01/01/2030",
            },
            language: "en",
            updated_at: new Date().toISOString(),
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "maybe later",
            null,
            "en"
        );

        expect(reply).toContain("Please reply with Yes or No");
        expect(reply).toContain("spouse or partner");
        expect((store.state as Record<string, unknown>)?.current_step).toBe("has_spouse");
        expect((store.state as Record<string, unknown>)?.collected_data).toEqual({
            full_name: "Ali Worker",
            passport_expiry_date: "01/01/2030",
        });
    });

    it("keeps unregistered completions as a WhatsApp draft instead of creating a ghost worker row", async () => {
        const { client, store } = createOnboardingAdmin({
            phone_number: "+381600000000",
            current_step: "desired_countries",
            collected_data: {
                full_name: "Ali Worker",
                nationality: "Ghanaian",
                preferred_job: "Construction",
            },
            language: "en",
            updated_at: new Date().toISOString(),
        });

        const updateEq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn(() => ({ eq: updateEq }));
        const single = vi.fn().mockResolvedValue({ data: null });
        const eq = vi.fn(() => ({ single }));
        const select = vi.fn(() => ({ eq }));

        createAdminClient.mockReturnValue({
            from(table: string) {
                expect(table).toBe("workers");
                return {
                    select,
                    update,
                };
            },
        });

        const reply = await handleWhatsAppOnboarding(
            client as never,
            "+381600000000",
            "Germany, Serbia",
            null,
            "en"
        );

        expect(reply).toContain("saved your answers in this WhatsApp draft");
        expect(reply).toContain("workersunited.eu/profile/worker");
        expect(store.cleared).toBe(0);
        expect((store.state as Record<string, unknown>)?.current_step).toBe("done");
        expect(update).not.toHaveBeenCalled();
    });
});
