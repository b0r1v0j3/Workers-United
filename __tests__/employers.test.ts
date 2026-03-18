import { describe, expect, it } from "vitest";
import {
    pickCanonicalEmployerRecord,
    shouldHideEmployerFromBusinessViews,
} from "@/lib/employers";

describe("employer integrity helpers", () => {
    it("picks the richer employer record as canonical when duplicates exist", () => {
        const canonical = pickCanonicalEmployerRecord([
            {
                id: "older",
                profile_id: "profile-1",
                company_name: "Test Company",
                status: "PENDING",
                created_at: "2026-02-15T06:11:22.655Z",
                updated_at: "2026-02-15T06:11:22.655Z",
            },
            {
                id: "richer",
                profile_id: "profile-1",
                company_name: "Real Company",
                contact_phone: "+381641234567",
                contact_email: "owner@company.com",
                country: "Serbia",
                industry: "Manufacturing",
                status: "VERIFIED",
                created_at: "2026-02-26T22:10:29.351Z",
                updated_at: "2026-03-18T18:00:00.000Z",
            },
        ]);

        expect(canonical?.id).toBe("richer");
    });

    it("hides admin-owned employer rows from business views", () => {
        expect(
            shouldHideEmployerFromBusinessViews({
                employer: {
                    profile_id: "profile-1",
                    contact_email: null,
                },
                profile: {
                    id: "profile-1",
                    email: "owner@gmail.com",
                    full_name: "Owner",
                    user_type: "admin",
                },
            })
        ).toBe(true);
    });

    it("hides internal test employers by contact email", () => {
        expect(
            shouldHideEmployerFromBusinessViews({
                employer: {
                    profile_id: "profile-1",
                    contact_email: "sandbox+test-employer@workersunited.internal",
                },
                profile: {
                    id: "profile-1",
                    email: "sandbox@gmail.com",
                    full_name: "Sandbox",
                    user_type: "employer",
                },
            })
        ).toBe(true);
    });

    it("keeps real employer profiles visible", () => {
        expect(
            shouldHideEmployerFromBusinessViews({
                employer: {
                    profile_id: "profile-1",
                    contact_email: "owner@company.com",
                },
                profile: {
                    id: "profile-1",
                    email: "owner@company.com",
                    full_name: "Owner",
                    user_type: "employer",
                },
            })
        ).toBe(false);
    });
});
