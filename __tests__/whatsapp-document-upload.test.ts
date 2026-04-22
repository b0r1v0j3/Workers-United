import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildWhatsAppDocumentUploadReply,
    inferWhatsAppWorkerDocumentType,
    saveWhatsAppWorkerDocumentFromMedia,
} from "@/lib/whatsapp-document-upload";

const { syncWorkerReviewStatus } = vi.hoisted(() => ({
    syncWorkerReviewStatus: vi.fn(),
}));

vi.mock("@/lib/worker-review", () => ({
    syncWorkerReviewStatus,
}));

function createInsertOnlyAdminMock() {
    const insert = vi.fn(async (payload: Record<string, unknown>) => {
        void payload;
        return { error: null };
    });
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eq = vi.fn(() => query);
    const query = {
        select: vi.fn(() => query),
        eq,
        maybeSingle,
        insert,
    };
    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({ error: null }));
    const admin = {
        from: vi.fn(() => query),
        storage: {
            from: vi.fn(() => ({
                upload,
                remove,
            })),
        },
    };

    return { admin, query, insert, maybeSingle, upload, remove };
}

describe("whatsapp-document-upload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("infers worker document types from captions, filenames, and image analysis", () => {
        expect(inferWhatsAppWorkerDocumentType({
            messageType: "document",
            fileName: "passport-scan.pdf",
        })).toBe("passport");

        expect(inferWhatsAppWorkerDocumentType({
            messageType: "image",
            caption: "biometric photo",
        })).toBe("biometric_photo");

        expect(inferWhatsAppWorkerDocumentType({
            messageType: "image",
            imageAnalysis: {
                isDocument: true,
                documentType: "diploma",
            },
        })).toBe("diploma");
    });

    it("saves a known WhatsApp document into worker_documents", async () => {
        const { admin, insert, upload } = createInsertOnlyAdminMock();
        const mediaBuffer = Buffer.from("%PDF-1.4");

        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: admin as never,
            mediaId: "media_123",
            workerProfileId: "profile_1",
            workerRecordId: "worker_1",
            normalizedPhone: "+381600000000",
            messageType: "document",
            caption: "passport",
            fileName: "passport.pdf",
            declaredMimeType: "application/pdf",
            downloadMedia: vi.fn(async () => ({
                buffer: mediaBuffer,
                mimeType: "application/pdf",
            })),
            now: () => new Date("2026-01-02T03:04:05.000Z"),
        });

        expect(result).toEqual(expect.objectContaining({
            handled: true,
            status: "saved",
            docType: "passport",
            storagePath: "profile_1/passport/1767323045000_whatsapp_passport.pdf",
            mimeType: "application/pdf",
            sizeBytes: mediaBuffer.length,
        }));
        expect(upload).toHaveBeenCalledWith(
            "profile_1/passport/1767323045000_whatsapp_passport.pdf",
            mediaBuffer,
            { contentType: "application/pdf" }
        );
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: "profile_1",
            document_type: "passport",
            storage_path: "profile_1/passport/1767323045000_whatsapp_passport.pdf",
            status: "manual_review",
            verified_at: null,
            reject_reason: null,
            extracted_data: null,
        }));
        expect(insert.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            ocr_json: expect.objectContaining({
                source: "whatsapp",
                uploaded_via: "whatsapp",
                media_id: "media_123",
                original_file_name: "passport.pdf",
            }),
        }));
        expect(syncWorkerReviewStatus).toHaveBeenCalledWith(expect.objectContaining({
            profileId: "profile_1",
            workerId: "worker_1",
            documentOwnerId: "profile_1",
        }));
    });

    it("asks for a document type when a PDF cannot be classified safely", async () => {
        const downloadMedia = vi.fn();

        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: createInsertOnlyAdminMock().admin as never,
            mediaId: "media_unknown",
            workerProfileId: "profile_1",
            normalizedPhone: "+381600000000",
            messageType: "document",
            fileName: "scan.pdf",
            downloadMedia,
        });

        expect(result).toEqual({ handled: true, status: "needs_document_type" });
        expect(downloadMedia).not.toHaveBeenCalled();
    });

    it("ignores regular non-document photos so the normal image reply can continue", async () => {
        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: createInsertOnlyAdminMock().admin as never,
            mediaId: "media_photo",
            workerProfileId: "profile_1",
            normalizedPhone: "+381600000000",
            messageType: "image",
            imageAnalysis: {
                isDocument: false,
                documentType: null,
                description: "A photo of a worksite.",
            },
        });

        expect(result).toEqual({ handled: false, status: "not_worker_document_candidate" });
    });

    it("rejects biometric photos sent as PDF", async () => {
        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: createInsertOnlyAdminMock().admin as never,
            mediaId: "media_pdf",
            workerProfileId: "profile_1",
            normalizedPhone: "+381600000000",
            messageType: "document",
            caption: "biometric photo",
            fileName: "photo.pdf",
            downloadMedia: vi.fn(async () => ({
                buffer: Buffer.from("%PDF-1.4"),
                mimeType: "application/pdf",
            })),
        });

        expect(result).toEqual(expect.objectContaining({
            handled: true,
            status: "unsupported_file_type",
            docType: "biometric_photo",
        }));
        expect(buildWhatsAppDocumentUploadReply(result as never, "English")).toContain("must be an image");
    });

    it("rejects unsupported image MIME types such as SVG", async () => {
        const { admin, upload } = createInsertOnlyAdminMock();

        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: admin as never,
            mediaId: "media_svg",
            workerProfileId: "profile_1",
            normalizedPhone: "+381600000000",
            messageType: "document",
            caption: "passport",
            fileName: "passport.svg",
            downloadMedia: vi.fn(async () => ({
                buffer: Buffer.from("<svg></svg>"),
                mimeType: "image/svg+xml",
            })),
        });

        expect(result).toEqual(expect.objectContaining({
            handled: true,
            status: "unsupported_file_type",
            docType: "passport",
            mimeType: "image/svg+xml",
        }));
        expect(upload).not.toHaveBeenCalled();
    });

    it("uses the validated MIME extension for stored image filenames", async () => {
        const { admin, upload } = createInsertOnlyAdminMock();
        const mediaBuffer = Buffer.from("png");

        const result = await saveWhatsAppWorkerDocumentFromMedia({
            admin: admin as never,
            mediaId: "media_png",
            workerProfileId: "profile_1",
            normalizedPhone: "+381600000000",
            messageType: "image",
            caption: "passport",
            fileName: "passport.svg",
            declaredMimeType: "image/png",
            imageAnalysis: {
                isDocument: true,
                documentType: "passport",
            },
            downloadMedia: vi.fn(async () => ({
                buffer: mediaBuffer,
                mimeType: "image/png",
            })),
            now: () => new Date("2026-01-02T03:04:05.000Z"),
        });

        expect(result).toEqual(expect.objectContaining({
            handled: true,
            status: "saved",
            storagePath: "profile_1/passport/1767323045000_whatsapp_passport.png",
        }));
        expect(upload).toHaveBeenCalledWith(
            "profile_1/passport/1767323045000_whatsapp_passport.png",
            mediaBuffer,
            { contentType: "image/png" }
        );
    });
});
