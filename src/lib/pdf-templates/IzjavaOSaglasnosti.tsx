import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

// ─── IZJAVA O SAGLASNOSTI (Statement of Consent) ─────────────────────────────
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
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 10,
        textTransform: "uppercase",
    },
    paragraph: {
        fontSize: 10.5,
        marginBottom: 8,
        textAlign: "justify",
    },
    bold: {
        fontWeight: 700,
    },
    placeDate: {
        fontSize: 10.5,
        marginBottom: 5,
    },
    sigLine: {
        width: "70%",
        borderBottomWidth: 0.5,
        borderBottomColor: colors.black,
        marginTop: 40,
        marginBottom: 3,
        alignSelf: "center" as const,
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
});

interface IzjavaProps {
    data: Record<string, string>;
}

export default function IzjavaOSaglasnosti({ data }: IzjavaProps) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.title}>IZJAVA O SAGLASNOSTI / STATEMENT OF CONSENT</Text>

                {/* Row 1: Consent text */}
                <View style={s.columns}>
                    <View style={s.colLeft}>
                        <Text style={s.paragraph}>
                            Saglasan sam da moj poslodavac <Text style={s.bold}>{data.EMPLOYER_NAME}</Text> (matični broj {data.EMPLOYER_MB}), sa sedištem na adresi ul. {data.EMPLOYER_ADDRESS}, aplicira i podnese u moje ime i za moj račun zahtev za izdavanje vize D (viza za duži boravak) po osnovu zapošljavanja.
                        </Text>

                        <Text style={s.paragraph}>
                            Ova izjava data je iz navedenih razloga, a radi postupanja pred državnim organima Republike Srbije i ne može se koristiti u druge svrhe.
                        </Text>
                    </View>

                    <View style={s.colRight}>
                        <Text style={s.paragraph}>
                            I consent to my employer, <Text style={s.bold}>{data.EMPLOYER_NAME}</Text> (Company Registration Number: {data.EMPLOYER_MB}), with its registered office at {data.EMPLOYER_ADDRESS}, {data.EMPLOYER_CITY}, applying for and submitting on my behalf and for my account, a request for the issuance of a D visa (long-stay visa) based on employment.
                        </Text>

                        <Text style={s.paragraph}>
                            This statement is given for the aforementioned reasons, for the purpose of proceedings before the state authorities of the Republic of Serbia, and may not be used for any other purposes.
                        </Text>
                    </View>
                </View>

                {/* Row 2: Place and date — aligned */}
                <View style={s.columns}>
                    <View style={s.colLeft}>
                        <View style={{ marginTop: 12 }}>
                            <Text style={s.placeDate}>U {data.NATIONALITY_SR_LOCATIVE},</Text>
                            <Text style={s.placeDate}>{data.SIGNING_DATE_SR} godine</Text>
                        </View>
                    </View>

                    <View style={s.colRight}>
                        <View style={{ marginTop: 12 }}>
                            <Text style={s.placeDate}>In {data.NATIONALITY_EN},</Text>
                            <Text style={s.placeDate}>{data.SIGNING_DATE_EN}</Text>
                        </View>
                    </View>
                </View>

                {/* Signature — centered below both columns */}
                <Text style={{ ...s.sigLabel, marginTop: 24 }}>
                    Davalac saglasnosti / Granter of Consent
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
