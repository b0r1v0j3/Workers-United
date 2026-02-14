import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// API to populate contract_data when a match is accepted
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication (admin only)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { matchId, contractTemplate } = body;

        if (!matchId) {
            return NextResponse.json({ error: "Match ID required" }, { status: 400 });
        }

        // Get match with all related data
        const { data: match, error: matchError } = await supabase
            .from("matches")
            .select(`
        *,
        candidates(
          *,
          profiles(*),
          documents(*)
        ),
        employers(
          *,
          profiles(*)
        )
      `)
            .eq("id", matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json({ error: "Match not found" }, { status: 404 });
        }

        // Get job request
        const { data: offer } = await supabase
            .from("offers")
            .select("*, job_requests(*)")
            .eq("candidate_id", match.candidate_id)
            .eq("status", "accepted")
            .single();

        if (!offer) {
            return NextResponse.json({ error: "No accepted offer found for this match" }, { status: 400 });
        }

        const jobRequest = offer.job_requests;
        const candidate = match.candidates;
        const employer = match.employers;

        // Get verified passport data
        const passportDoc = candidate.documents?.find(
            (d: { document_type: string; verification_status: string }) =>
                d.document_type === "passport" && d.verification_status === "verified"
        );

        if (!passportDoc) {
            return NextResponse.json(
                { error: "No verified passport document found" },
                { status: 400 }
            );
        }

        const passportData = passportDoc.ai_extracted_data || {};

        // Compute dates
        const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const durationMonths = jobRequest?.contract_duration_months || 12;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + durationMonths);

        // Create contract data record
        const { data: contractData, error: insertError } = await supabase
            .from("contract_data")
            .insert({
                match_id: matchId,

                // Candidate data (from AI-verified passport)
                candidate_full_name: passportData.full_name || candidate.profiles?.full_name,
                candidate_passport_number: passportData.passport_number,
                candidate_nationality: passportData.nationality,
                candidate_date_of_birth: passportData.date_of_birth,
                candidate_passport_expiry: passportData.expiry_date,
                candidate_address: candidate.country || "",
                candidate_passport_issue_date: passportData.date_of_issue || null,
                candidate_passport_issuer: passportData.issuing_authority || null,
                candidate_place_of_birth: passportData.place_of_birth || null,
                candidate_gender: passportData.gender || null,

                // Employer data
                employer_company_name: employer.company_name,
                employer_pib: employer.pib,
                employer_address: employer.company_address || employer.accommodation_address,
                employer_representative_name: employer.profiles?.full_name,
                employer_mb: null, // MB ne postoji na employers tabeli, admin popunjava ručno
                employer_city: null, // Admin popunjava ručno (grad + poštanski broj)
                employer_founding_date: null, // Admin popunjava ručno
                employer_apr_number: null, // Admin popunjava ručno
                employer_director: employer.profiles?.full_name,

                // Job data
                job_title: jobRequest?.title,
                job_description_sr: jobRequest?.description || null,
                job_description_en: jobRequest?.description_en || null,
                salary_rsd: jobRequest?.salary_rsd,
                accommodation_address: jobRequest?.accommodation_address || employer.accommodation_address,
                contract_duration_months: durationMonths,
                work_schedule: jobRequest?.work_schedule,
                start_date: startDate.toISOString().split("T")[0],
                end_date: endDate.toISOString().split("T")[0],
                signing_date: new Date().toISOString().split("T")[0],
                signing_city: null, // Admin popunjava ručno (grad gde se potpisuje ugovor)

                // Contact
                contact_email: employer.contact_email || "contact@workersunited.eu",
                contact_phone: employer.contact_phone || "",

                // Contract template
                contract_template: contractTemplate || "01",
            })
            .select()
            .single();

        if (insertError) {
            console.error("Failed to create contract data:", insertError);
            return NextResponse.json(
                { error: "Failed to create contract data" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            contractData,
            message: "Contract data populated successfully. Ready for PDF generation.",
        });
    } catch (error) {
        console.error("Contract data API error:", error);
        return NextResponse.json(
            { error: "Failed to process contract data" },
            { status: 500 }
        );
    }
}

// GET: Retrieve contract data for a match
export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
        return NextResponse.json({ error: "Match ID required" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only check
    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: contractData, error } = await supabase
        .from("contract_data")
        .select("*")
        .eq("match_id", matchId)
        .single();

    if (error || !contractData) {
        return NextResponse.json({ error: "Contract data not found" }, { status: 404 });
    }

    return NextResponse.json({ contractData });
}
