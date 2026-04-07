import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

// IZJAVA POSLODAVCA (Employer's Declaration about Job Position)
// Required for work permit applications for foreign workers

const s = StyleSheet.create({
    page: {
        fontFamily: "NotoSans",
        fontSize: 11,
        paddingHorizontal: 56,
        paddingTop: 50,
        paddingBottom: 50,
        color: colors.black,
        lineHeight: 1.7,
    },
    title: {
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 24,
    },
    paragraph: {
        fontSize: 11,
        marginBottom: 10,
        textAlign: "justify",
    },
    bold: {
        fontWeight: 700,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 700,
        marginTop: 12,
        marginBottom: 10,
    },
    label: {
        fontSize: 11,
        marginBottom: 4,
    },
    bulletItem: {
        fontSize: 11,
        marginBottom: 4,
        paddingLeft: 16,
    },
    sigArea: {
        marginTop: 20,
    },
    sigLine: {
        width: 200,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.black,
        marginTop: 4,
        marginBottom: 3,
    },
    sigName: {
        fontSize: 11,
        fontWeight: 700,
    },
    sigImage: {
        width: 150,
        height: 43,
        marginTop: 4,
    },
});

interface IzjavaPoslodavcaProps {
    data: Record<string, string>;
    signatureDataUrl?: string;
}

export default function IzjavaPoslodavca({ data, signatureDataUrl }: IzjavaPoslodavcaProps) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.title}>IZJAVA POSLODAVCA</Text>

                <Text style={s.paragraph}>
                    Na osnovu važećih propisa i u svrhu podnošenja zahteva za izdavanje radne dozvole za stranog državljanina,
                </Text>

                <Text style={s.paragraph}>
                    <Text style={s.bold}>{data.EMPLOYER_FULL_NAME}</Text>, sa sedištem u {data.EMPLOYER_CITY}, ul. {data.EMPLOYER_ADDRESS}, matični broj {data.EMPLOYER_MB}, izdaje sledeću:
                </Text>

                <Text style={s.sectionTitle}>IZJAVA O RADNOM MESTU</Text>

                <Text style={s.label}>Naziv radnog mesta:</Text>
                <Text style={{ ...s.label, fontWeight: 700, marginBottom: 10 }}>{data.JOB_TITLE_SR}</Text>

                <Text style={s.label}>Opis poslova:</Text>
                {data.JOB_DESC_SR_1 ? <Text style={s.bulletItem}>- {data.JOB_DESC_SR_1}</Text> : null}
                {data.JOB_DESC_SR_2 ? <Text style={s.bulletItem}>- {data.JOB_DESC_SR_2}</Text> : null}
                {data.JOB_DESC_SR_3 ? <Text style={{ ...s.bulletItem, marginBottom: 10 }}>- {data.JOB_DESC_SR_3}</Text> : null}

                <Text style={s.label}>Vrsta i stepen stručne spreme:</Text>
                <Text style={{ ...s.label, marginBottom: 10 }}>I stepen stručne spreme — osnovno obrazovanje</Text>

                <Text style={s.label}>Posebni uslovi:</Text>
                <Text style={s.bulletItem}>- Nije potrebno prethodno radno iskustvo</Text>
                <Text style={s.bulletItem}>- Spremnost za timski rad i poštovanje radnih procedura</Text>
                <Text style={{ ...s.bulletItem, marginBottom: 14 }}>- Fizička sposobnost za obavljanje manuelnih poslova</Text>

                <Text style={s.paragraph}>
                    Ova izjava se izdaje u svrhu regulisanja radnog odnosa i podnošenja zahteva za izdavanje radne dozvole.
                </Text>

                <Text style={{ ...s.label, marginBottom: 16 }}>
                    U {data.EMPLOYER_CITY}, dana {data.SIGNING_DATE_SR} godine
                </Text>

                <View style={s.sigArea}>
                    <Text style={s.label}>Za poslodavca:</Text>
                    {signatureDataUrl ? (
                        <Image style={s.sigImage} src={signatureDataUrl} />
                    ) : null}
                    <View style={s.sigLine} />
                    <Text style={s.sigName}>{data.EMPLOYER_DIRECTOR}</Text>
                </View>
            </Page>
        </Document>
    );
}
