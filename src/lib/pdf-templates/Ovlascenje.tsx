import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

// ─── OVLAŠĆENJE (Power of Attorney / Authorization) ──────────────────────────
// Two-column layout: Serbian (left) | English (right)
// Text from lawyer-written DOCX template

const s = StyleSheet.create({
    page: {
        fontFamily: "NotoSans",
        fontSize: 10.5,
        paddingHorizontal: 30,
        paddingTop: 35,
        paddingBottom: 35,
        color: colors.black,
        lineHeight: 1.45,
    },
    title: {
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 16,
        textTransform: "uppercase",
    },
    columns: {
        flexDirection: "row" as const,
        gap: 12,
    },
    colLeft: {
        flex: 1,
        paddingRight: 6,
        borderRightWidth: 0.5,
        borderRightColor: colors.border,
    },
    colRight: {
        flex: 1,
        paddingLeft: 6,
    },
    paragraph: {
        fontSize: 10.5,
        marginBottom: 8,
        textAlign: "justify",
    },
    bold: {
        fontWeight: 700,
    },
    sigLabel: {
        fontSize: 8,
        textAlign: "center" as const,
        color: colors.gray,
    },
    sigName: {
        fontSize: 10.5,
        textAlign: "center" as const,
        fontWeight: 700,
    },
    sigLine: {
        width: "70%",
        borderBottomWidth: 0.5,
        borderBottomColor: colors.black,
        marginTop: 40,
        marginBottom: 3,
        alignSelf: "center" as const,
    },
});

interface OvlascenjeProps {
    data: Record<string, string>;
}

export default function Ovlascenje({ data }: OvlascenjeProps) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.title}>
                    OVLAŠĆENJE ZA PODNOŠENJE ZAHTEVA / AUTHORIZATION TO SUBMIT APPLICATION
                </Text>

                {/* Two-column content */}
                <View style={s.columns}>
                    {/* ─── SERBIAN COLUMN ─── */}
                    <View style={s.colLeft}>
                        <Text style={s.paragraph}>
                            Ja, <Text style={s.bold}>{data.WORKER_FULL_NAME}</Text>, iz {data.NATIONALITY_EN}, sa pašošem broj {data.PASSPORT_NUMBER}, i mestom prebivališta {data.WORKER_ADDRESS}, dajem ovlašćenje i ovlašćujem kompaniju &quot;{data.EMPLOYER_NAME}&quot;, iz Republike Srbije, {data.EMPLOYER_CITY}, {data.EMPLOYER_ADDRESS}, PIB {data.EMPLOYER_PIB}, Matični broj {data.EMPLOYER_MB}, osnovana {data.EMPLOYER_FOUNDING_DATE} godine, rešenjem iz Agencije za Privredne registre {data.EMPLOYER_APR_NUMBER}, da može u moje ime i za moj račun da aplicira za vizu D, radi mog dolaska u Republiku Srbiju i zasnivanja radnog odnosa sa kompanijom &quot;{data.EMPLOYER_NAME}&quot;.
                        </Text>
                    </View>

                    {/* ─── ENGLISH COLUMN ─── */}
                    <View style={s.colRight}>
                        <Text style={s.paragraph}>
                            I, <Text style={s.bold}>{data.WORKER_FULL_NAME}</Text>, from {data.NATIONALITY_EN}, holder of passport No. {data.PASSPORT_NUMBER}, residing at {data.WORKER_ADDRESS}, hereby authorize the company &quot;{data.EMPLOYER_NAME}&quot;, Republic of Serbia, {data.EMPLOYER_CITY}, {data.EMPLOYER_ADDRESS}, Tax ID: {data.EMPLOYER_PIB}, Registration No: {data.EMPLOYER_MB}, founded on {data.EMPLOYER_FOUNDING_DATE}, by decision of the Serbian Business Registers Agency No. {data.EMPLOYER_APR_NUMBER}, to apply on my behalf and for my account for a D visa, for the purpose of my arrival in the Republic of Serbia and establishment of an employment relationship with the company &quot;{data.EMPLOYER_NAME}&quot;.
                        </Text>
                    </View>
                </View>

                {/* Place and date — aligned */}
                <View style={s.columns}>
                    <View style={s.colLeft}>
                        <View style={{ marginTop: 12 }}>
                            <Text style={s.paragraph}>U {data.NATIONALITY_SR_LOCATIVE},</Text>
                            <Text style={s.paragraph}>{data.SIGNING_DATE_SR} godine</Text>
                        </View>
                    </View>

                    <View style={s.colRight}>
                        <View style={{ marginTop: 12 }}>
                            <Text style={s.paragraph}>In {data.NATIONALITY_EN},</Text>
                            <Text style={s.paragraph}>{data.SIGNING_DATE_EN}</Text>
                        </View>
                    </View>
                </View>

                {/* Signature — centered below both columns */}
                <Text style={{ ...s.sigLabel, marginTop: 24 }}>
                    Davalac ovlašćenja / Grantor of Authorization
                </Text>

                <View style={s.sigLine} />
                <Text style={s.sigName}>
                    {data.WORKER_FULL_NAME}
                </Text>
                <Text style={s.sigLabel}>
                    br. pasoša / passport no: {data.PASSPORT_NUMBER}
                </Text>
            </Page>
        </Document>
    );
}
