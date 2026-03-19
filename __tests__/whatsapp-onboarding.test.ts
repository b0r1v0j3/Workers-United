import { describe, expect, it } from "vitest";
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
});
