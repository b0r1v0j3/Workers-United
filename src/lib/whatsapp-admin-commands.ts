import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import { sendWhatsAppText } from "@/lib/whatsapp";

type AdminClient = SupabaseClient<Database>;

export async function handleWhatsAppAdminCommand(params: {
    admin: AdminClient;
    normalizedPhone: string;
    content: string;
    profileId?: string | null;
}): Promise<boolean> {
    const trimContent = params.content.trim();
    const lower = trimContent.toLowerCase();
    const profileId = params.profileId || undefined;

    if (lower.startsWith("ispravi:")) {
        const correction = trimContent.substring(8).trim();
        const parts = correction.split("->");
        if (parts.length === 2) {
            const oldFact = parts[0].trim();
            const newFact = parts[1].trim();
            const { data: matches } = await params.admin.from("brain_memory")
                .select("id, content")
                .ilike("content", `%${oldFact}%`)
                .limit(5);

            if (matches && matches.length > 0) {
                await params.admin.from("brain_memory")
                    .update({ content: newFact, confidence: 1.0 })
                    .eq("id", matches[0].id);
                await sendWhatsAppText(
                    params.normalizedPhone,
                    `✅ Ispravljeno!\n\nStaro: ${matches[0].content}\nNovo: ${newFact}\n\nConfidence: 1.0 (admin verified)`,
                    profileId
                );
            } else {
                await saveBrainFactsDedup(params.admin, [
                    { category: "faq", content: newFact, confidence: 1.0 },
                ]);
                await sendWhatsAppText(
                    params.normalizedPhone,
                    `✅ Nisam našao staru činjenicu, dodao novu:\n${newFact}`,
                    profileId
                );
            }
            return true;
        }
    }

    if (lower.startsWith("zapamti:")) {
        const factStr = trimContent.substring(8).trim();
        const pipeParts = factStr.split("|");
        const category = pipeParts.length > 1 ? pipeParts[0].trim() : "faq";
        const fact = pipeParts.length > 1 ? pipeParts.slice(1).join("|").trim() : factStr;
        await saveBrainFactsDedup(params.admin, [
            { category, content: fact, confidence: 1.0 },
        ]);
        await sendWhatsAppText(
            params.normalizedPhone,
            `🧠 Zapamćeno!\n[${category}] ${fact}\nConfidence: 1.0`,
            profileId
        );
        return true;
    }

    if (lower.startsWith("obrisi:") || lower.startsWith("obriši:")) {
        const search = trimContent.substring(trimContent.indexOf(":") + 1).trim();
        const { data: matches } = await params.admin.from("brain_memory")
            .select("id, content, category")
            .ilike("content", `%${search}%`)
            .limit(5);

        if (matches && matches.length > 0) {
            await params.admin.from("brain_memory").delete().eq("id", matches[0].id);
            await sendWhatsAppText(
                params.normalizedPhone,
                `🗑️ Obrisano:\n[${matches[0].category}] ${matches[0].content}`,
                profileId
            );
        } else {
            await sendWhatsAppText(
                params.normalizedPhone,
                `❌ Nisam našao činjenicu sa: "${search}"`,
                profileId
            );
        }
        return true;
    }

    if (lower === "memorija" || lower === "memory") {
        const { data: allMemory } = await params.admin.from("brain_memory")
            .select("category, content, confidence")
            .order("confidence", { ascending: false });
        const list = (allMemory || []).map((entry, index) =>
            `${index + 1}. [${entry.category}] ${entry.content} (${entry.confidence})`
        ).join("\n");
        await sendWhatsAppText(
            params.normalizedPhone,
            `🧠 Brain Memory (${(allMemory || []).length} facts):\n\n${list || "(prazno)"}`,
            profileId
        );
        return true;
    }

    return false;
}
