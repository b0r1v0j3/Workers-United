import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

// ─── ПОЗИВНО ПИСМО (Invitation Letter) ──────────────────────────────────────
// Text from lawyer-written DOCX template + official Образац 2 fields
// Uses CYRILLIC script

const s = StyleSheet.create({
    page: {
        fontFamily: "NotoSans",
        fontSize: 11,
        paddingHorizontal: 40,
        paddingTop: 30,
        paddingBottom: 30,
        color: colors.black,
        lineHeight: 1.4,
    },
    title: {
        fontSize: 15,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 16,
    },
    paragraph: {
        fontSize: 11,
        marginBottom: 6,
        textAlign: "justify",
    },
    bold: {
        fontWeight: 700,
    },
    label: {
        fontSize: 8,
        color: colors.gray,
        marginBottom: 2,
    },
    infoRow: {
        flexDirection: "row" as const,
        marginBottom: 3,
    },
    infoLabel: {
        width: "45%",
        fontSize: 10,
    },
    infoValue: {
        flex: 1,
        fontSize: 10,
        fontWeight: 700,
    },
    headerBlock: {
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
    },
    sigArea: {
        marginTop: 24,
        alignItems: "center" as const,
    },
    placeDate: {
        fontSize: 10,
        marginBottom: 8,
        textAlign: "center" as const,
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
        marginTop: 30,
        marginBottom: 3,
        alignSelf: "center" as const,
    },
});

interface PozivnoProps {
    data: Record<string, string>;
}

export default function PozivnoPismo({ data }: PozivnoProps) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* Header */}
                <Text style={s.label}>Позивар је правно лице</Text>

                <Text style={s.title}>ПОЗИВНО ПИСМО</Text>

                {/* Employer info */}
                <View style={s.headerBlock}>
                    <Text style={{ ...s.paragraph, fontWeight: 700 }}>{data.EMPLOYER_FULL_REFERENCE}</Text>
                    <Text style={s.label}>назив и седиште правног лица</Text>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Матични бр. у регистру: {data.EMPLOYER_MB}</Text>
                        <Text style={s.infoValue}>{data.EMPLOYER_DIRECTOR}</Text>
                    </View>
                    <Text style={s.label}>матични бр. у регистру и име и презиме особе овлашћене за заступање</Text>
                </View>

                <Text style={{ ...s.paragraph, fontWeight: 700 }}>Овим позивам:</Text>

                {/* Worker info table */}
                <View style={{ marginBottom: 12, paddingLeft: 8 }}>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ИМЕ / NAME</Text>
                        <Text style={s.infoValue}>{data.WORKER_FIRST_NAME}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ПРЕЗИМЕ / SURNAME</Text>
                        <Text style={s.infoValue}>{data.WORKER_LAST_NAME}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ДАТУМ РОЂЕЊА / DATE OF BIRTH</Text>
                        <Text style={s.infoValue}>{data.DATE_OF_BIRTH}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>МЕСТО РОЂЕЊА / PLACE OF BIRTH</Text>
                        <Text style={s.infoValue}>{data.PLACE_OF_BIRTH}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ДРЖАВЉАНИН / CITIZENSHIP</Text>
                        <Text style={s.infoValue}>{data.NATIONALITY_EN}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>БРОЈ ПАСОША / PASSPORT NO</Text>
                        <Text style={s.infoValue}>{data.PASSPORT_NUMBER}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ИЗДАТ ОД СТРАНЕ / ISSUED BY</Text>
                        <Text style={s.infoValue}>{data.PASSPORT_ISSUER}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ДАТУМ ИЗДАВАЊА / DATE OF ISSUE</Text>
                        <Text style={s.infoValue}>{data.PASSPORT_ISSUE_DATE}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ВАЖИ ДО / DATE OF EXPIRY</Text>
                        <Text style={s.infoValue}>{data.PASSPORT_EXPIRY_DATE}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ПРЕБИВАЛИШТЕ И БОРАВИШТЕ</Text>
                        <Text style={s.infoValue}>{data.WORKER_ADDRESS}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ЗАНИМАЊЕ / PROFESSION</Text>
                        <Text style={s.infoValue}>{data.JOB_TITLE_SR}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ВРСТА ВИЗЕ / VISA TYPE</Text>
                        <Text style={s.infoValue}>D (виза за дужи боравак)</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>РАЗЛОГ ПОЗИВАЊА / REASON</Text>
                        <Text style={s.infoValue}>Запошљавање / Employment</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>БРОЈ ПОСЕТА / NO. OF ATTENDANCE</Text>
                        <Text style={s.infoValue}>1</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>У ПЕРИОДУ ОД / IN PERIOD FROM</Text>
                        <Text style={s.infoValue}>{data.CONTRACT_START_DATE}  ДО / TO  {data.CONTRACT_END_DATE}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>ПРЕТХОДНИ БОРАВЦИ У РС</Text>
                        <Text style={s.infoValue}>{data.PREVIOUS_STAYS || "Нема / None"}</Text>
                    </View>
                </View>

                <Text style={s.paragraph}>
                    Именовани ће боравити на адреси: <Text style={s.bold}>{data.ACCOMMODATION_ADDRESS}</Text>
                </Text>

                <Text style={s.paragraph}>
                    Контакт особа за сва обавештења: {data.EMPLOYER_DIRECTOR}, Директор, {data.CONTACT_PHONE}, {data.CONTACT_EMAIL}
                </Text>

                <Text style={s.paragraph}>
                    Обавезујемо се да ћемо сносити све трошкове боравка именованог у Републици Србији, укључујући и трошкове смештаја и издржавања, као и трошкове боравка и принудног удаљења из Републике Србије, укључујући и трошкове боравка у прихватилишту за странце Министарства унутрашњих послова, уколико се исти не могу наплатити од странца кога позивамо.
                </Text>

                {/* Place, date, signature — centered like IZJAVA/OVLAŠĆENJE */}
                <View style={s.sigArea}>
                    <Text style={s.placeDate}>
                        У {data.SIGNING_CITY} дана {data.SIGNING_DATE_SR} год.
                    </Text>
                    <Text style={s.sigLabel}>(место) (датум)</Text>

                    <Text style={{ ...s.sigLabel, marginTop: 24 }}>
                        Овлашћено лице / Authorized Person
                    </Text>

                    <View style={s.sigLine} />
                    <Text style={s.sigName}>
                        {data.EMPLOYER_DIRECTOR}
                    </Text>
                    <Text style={s.sigLabel}>
                        (печат и потпис позивара / stamp and signature)
                    </Text>
                </View>
            </Page>
        </Document>
    );
}
