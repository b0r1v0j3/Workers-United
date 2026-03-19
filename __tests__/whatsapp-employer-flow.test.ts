import { describe, expect, it, vi } from "vitest";
import {
    generateEmployerWhatsAppReply,
    getEmployerWhatsAppDefaultReply,
    getEmployerWhatsAppErrorReply,
    getEmployerWhatsAppStaticReply,
    isEuropeanPhone,
    resolveEmployerWhatsAppLead,
} from "@/lib/whatsapp-employer-flow";

function createAdminClient(employerRecord: Record<string, unknown> | null) {
    return {
        from(table: string) {
            if (table !== "employers") {
                throw new Error(`Unexpected table: ${table}`);
            }

            return {
                select() {
                    return {
                        or() {
                            return {
                                maybeSingle: async () => ({
                                    data: employerRecord,
                                }),
                            };
                        },
                    };
                },
            };
        },
    };
}

describe("whatsapp-employer-flow", () => {
    it("recognizes european phone prefixes", () => {
        expect(isEuropeanPhone("+38166299444")).toBe(true);
        expect(isEuropeanPhone("+27723605785")).toBe(false);
    });

    it("flags likely employers only for european non-admin non-worker leads", async () => {
        const resolution = await resolveEmployerWhatsAppLead({
            admin: createAdminClient(null) as never,
            normalizedPhone: "+38166111222",
            content: "We need welders for our company in Europe.",
            isAdmin: false,
            hasRegisteredWorker: false,
        });

        expect(resolution.employerRecord).toBeNull();
        expect(resolution.isLikelyEmployer).toBe(true);
        expect(resolution.isEmployer).toBe(true);
    });

    it("keeps registered workers out of likely employer heuristic", async () => {
        const resolution = await resolveEmployerWhatsAppLead({
            admin: createAdminClient(null) as never,
            normalizedPhone: "+38166111222",
            content: "We need welders for our company in Europe.",
            isAdmin: false,
            hasRegisteredWorker: true,
        });

        expect(resolution.isLikelyEmployer).toBe(false);
        expect(resolution.isEmployer).toBe(false);
    });

    it("treats matched employer rows as employers even without heuristic", async () => {
        const resolution = await resolveEmployerWhatsAppLead({
            admin: createAdminClient({
                id: "emp_1",
                company_name: "Steel Concept",
                contact_name: "Milan",
                status: "APPROVED",
            }) as never,
            normalizedPhone: "+38166111222",
            content: "hello",
            isAdmin: false,
            hasRegisteredWorker: false,
        });

        expect(resolution.isEmployer).toBe(true);
        expect(resolution.employerRecord).toEqual({
            id: "emp_1",
            company_name: "Steel Concept",
            contact_name: "Milan",
            status: "APPROVED",
        });
    });

    it("builds employer AI prompts through injected response caller", async () => {
        const callResponseText = vi.fn().mockResolvedValue("Employer reply");

        const reply = await generateEmployerWhatsAppReply({
            callResponseText,
            model: "gpt-5.4-mini",
            message: "We need workers",
            normalizedPhone: "+38166111222",
            employerRecord: {
                id: "emp_1",
                company_name: "Steel Concept",
                contact_name: "Milan",
                status: "APPROVED",
            },
            historyMessages: [
                { direction: "inbound", content: "We need workers" },
            ],
            brainMemory: [
                { category: "copy_rule", content: "Answer directly.", confidence: 0.9 },
            ],
            language: "English",
        });

        expect(reply).toBe("Employer reply");
        expect(callResponseText).toHaveBeenCalledWith(expect.objectContaining({
            model: "gpt-5.4-mini",
            input: expect.stringContaining("Phone: +38166111222"),
            instructions: expect.stringContaining("Warm, professional, direct, and operational."),
        }));
    });

    it("returns deterministic fallback copy for employer flow", () => {
        expect(getEmployerWhatsAppDefaultReply("sr")).toContain("besplatno za poslodavce");
        expect(getEmployerWhatsAppErrorReply("en")).toContain("contact@workersunited.eu");
        expect(getEmployerWhatsAppStaticReply("en")).toContain("Register at workersunited.eu/signup");
    });
});
