import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";

// ─── UGOVOR O RADU (Employment Contract) ──────────────────────────────────────
// Each Član / Article is a side-by-side row so SR and EN stay aligned
// Text from lawyer-written DOCX template

const s = StyleSheet.create({
    page: {
        fontFamily: "NotoSans",
        fontSize: 9.5,
        paddingHorizontal: 28,
        paddingTop: 28,
        paddingBottom: 28,
        color: colors.black,
        lineHeight: 1.35,
    },
    title: {
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 8,
    },
    // Each article pair is a row
    articleRow: {
        flexDirection: "row" as const,
        gap: 8,
        marginBottom: 4,
    },
    colLeft: {
        flex: 1,
        paddingRight: 4,
        borderRightWidth: 0.5,
        borderRightColor: colors.border,
    },
    colRight: {
        flex: 1,
        paddingLeft: 4,
    },
    articleHeader: {
        fontSize: 10,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 3,
    },
    p: {
        fontSize: 9.5,
        marginBottom: 3,
        textAlign: "justify",
    },
    n: {
        fontSize: 9.5,
        marginBottom: 2,
        textAlign: "justify",
        paddingLeft: 4,
    },
    bold: {
        fontWeight: 700,
    },
    signatureArea: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        marginTop: 14,
        borderTopWidth: 0.5,
        borderTopColor: colors.border,
        paddingTop: 8,
    },
    sigCol: {
        width: "45%",
        alignItems: "center" as const,
    },
    sigLine: {
        width: "100%",
        borderBottomWidth: 0.5,
        borderBottomColor: colors.black,
        marginTop: 24,
        marginBottom: 3,
    },
    sigLabel: {
        fontSize: 8,
        textAlign: "center" as const,
        color: colors.gray,
    },
});

interface UgovorProps {
    data: Record<string, string>;
}

export default function UgovorORadu({ data }: UgovorProps) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.title}>PREDLOG UGOVORA O RADU / EMPLOYMENT CONTRACT PROPOSAL</Text>

                {/* ─── Intro / Parties ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.p}>
                            Na osnovu čl. 30. i 33. Zakona o radu (&quot;Sl. Glasnik RS&quot;, br. 24/2005, 61/2005, 54/2009, 32/2013, 75/2014, 13/2017-OUS, 113/2017 i 95/2018-Autentično tumačenje), ugovarači:
                        </Text>
                        <Text style={s.p}>
                            <Text style={s.bold}>POSLODAVAC:</Text> {data.EMPLOYER_NAME}, sa sedištem u opštini: {data.EMPLOYER_CITY}, ul. {data.EMPLOYER_ADDRESS}, matični broj: {data.EMPLOYER_MB}, PIB: {data.EMPLOYER_PIB}, koga zastupa direktor {data.EMPLOYER_DIRECTOR}.
                        </Text>
                        <Text style={s.p}>
                            <Text style={s.bold}>ZAPOSLENI:</Text> {data.WORKER_FULL_NAME}, državljanin {data.NATIONALITY_SR_GENITIVE}, rođen {data.DATE_OF_BIRTH} godine, broj pasoša {data.PASSPORT_NUMBER}, izdat od strane {data.PASSPORT_ISSUER}
                        </Text>
                        <Text style={s.p}>
                            Zaključuju u {data.SIGNING_CITY}, dana {data.SIGNING_DATE_SR} godine sledeći
                        </Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.p}>
                            Pursuant to article 30 and article 33 of the Employment Act (&quot;Off. Herald of RS&quot;, Nos. 24/2005, 61/2005, 54/2009, 32/2013, 75/2014, 13/2017-Decision of the CC, 113/2017 and 95/2018-authentic interpretation), contracting parties:
                        </Text>
                        <Text style={s.p}>
                            <Text style={s.bold}>EMPLOYER:</Text> {data.EMPLOYER_NAME}, seated in {data.EMPLOYER_CITY} municipality, {data.EMPLOYER_ADDRESS} street, registration No: {data.EMPLOYER_MB}, Tax identification No: {data.EMPLOYER_PIB}, represented by director {data.EMPLOYER_DIRECTOR}.
                        </Text>
                        <Text style={s.p}>
                            <Text style={s.bold}>EMPLOYEE:</Text> {data.WORKER_FULL_NAME}, citizen of {data.NATIONALITY_EN}, born {data.DATE_OF_BIRTH}, passport no: {data.PASSPORT_NUMBER}, issued by {data.PASSPORT_ISSUER}
                        </Text>
                        <Text style={s.p}>
                            Concluded in {data.SIGNING_CITY}, on {data.SIGNING_DATE_SR} following
                        </Text>
                    </View>
                </View>

                {/* ─── Član 1 / Article 1 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 1 — Uslovi potrebni za radno mesto</Text>
                        <Text style={s.n}>1.1. Poslodavac zasniva radni odnos sa zaposlenim na radnom mestu: <Text style={s.bold}>{data.JOB_TITLE_SR}</Text>.</Text>
                        <Text style={s.n}>1.2. Zaposleni je lice bez stručne spreme.</Text>
                        <Text style={s.n}>1.3. U skladu sa opštim aktom Poslodavca za navedeno radno mesto se ne zahteva posebna stručna sprema. Dodatni uslov: poželjno poznavanje engleskog jezika — početni nivo.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 1 — Conditions needed for the job position</Text>
                        <Text style={s.n}>1.1. The employer establishes the employment relationship with the employee for the position: <Text style={s.bold}>{data.JOB_TITLE_EN}</Text>.</Text>
                        <Text style={s.n}>1.2. The employee has no professional qualifications.</Text>
                        <Text style={s.n}>1.3. Pursuant to general act of the Employer, no particular professional qualifications are required for the above mentioned position. Additional requirement: Desirable english language competency - beginner level.</Text>
                    </View>
                </View>

                {/* ─── Član 2 / Article 2 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 2 — Naziv i opis poslova</Text>
                        <Text style={s.n}>2.1. Zaposleni će obavljati poslove na radnom mestu – <Text style={s.bold}>{data.JOB_TITLE_SR}</Text>.</Text>
                        <Text style={s.n}>2.2. Opis poslova:</Text>
                        {data.JOB_DESC_SR_1 ? <Text style={s.n}>  - {data.JOB_DESC_SR_1}</Text> : null}
                        {data.JOB_DESC_SR_2 ? <Text style={s.n}>  - {data.JOB_DESC_SR_2}</Text> : null}
                        {data.JOB_DESC_SR_3 ? <Text style={s.n}>  - {data.JOB_DESC_SR_3}</Text> : null}
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 2 — Name and Description of Jobs</Text>
                        <Text style={s.n}>2.1. The employee shall work on a job position of <Text style={s.bold}>{data.JOB_TITLE_EN}</Text>.</Text>
                        <Text style={s.n}>2.2. Job Description for:</Text>
                        {data.JOB_DESC_EN_1 ? <Text style={s.n}>  - {data.JOB_DESC_EN_1}</Text> : null}
                        {data.JOB_DESC_EN_2 ? <Text style={s.n}>  - {data.JOB_DESC_EN_2}</Text> : null}
                        {data.JOB_DESC_EN_3 ? <Text style={s.n}>  - {data.JOB_DESC_EN_3}</Text> : null}
                    </View>
                </View>

                {/* ─── Član 3 / Article 3 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 3 — Mesto rada</Text>
                        <Text style={s.n}>3.1. Zaposleni će obavljati poslove na teritoriji {data.EMPLOYER_CITY}, a po potrebi poslodavca na teritoriji cele Srbije.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 3 — Place of work</Text>
                        <Text style={s.n}>3.1. The employee will perform tasks in the territory of the City of {data.EMPLOYER_CITY}, and if necessary by the employer, in the territory of the whole of Serbia.</Text>
                    </View>
                </View>

                {/* ─── Član 4 / Article 4 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 4 — Vreme trajanja ugovora i datum stupanja na rad</Text>
                        <Text style={s.n}>4.1. Zaposleni zasniva radni odnos na određeno vreme, počev od {data.CONTRACT_START_DATE} godine do {data.CONTRACT_END_DATE} godine.</Text>
                        <Text style={s.n}>4.2. Zaposleni zasniva radni odnos na određeno vreme zbog ograničenog trajanja radne dozvole za zapošljavanje.</Text>
                        <Text style={s.n}>4.3. Zaposleni je dužan da stupi na rad danom dobijanja radne dozvole od strane nadležnog organa Republike Srbije.</Text>
                        <Text style={s.n}>4.4. Poslodavac se obavezuje da, najkasnije pre stupanja zaposlenog na rad, podnese sve propisane prijave na obavezno socijalno osiguranje i da blagovremeno uplaćuje doprinose u skladu sa zakonom.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 4 — Term of the Contract and Date of Commencement of work</Text>
                        <Text style={s.n}>4.1. The employee establishes the employment relationship for a definite period of time starting on the {data.CONTRACT_START_DATE} up to the {data.CONTRACT_END_DATE}.</Text>
                        <Text style={s.n}>4.2. The employee establishes the employment relationship for a definite period of time due to time-limited work permit for employment.</Text>
                        <Text style={s.n}>4.3. The employee is hereby bound to commence his work duties on the day of the starting date of his work permit issued by competent authority of the Republic of Serbia.</Text>
                        <Text style={s.n}>4.4. The employer is obliged to, at the latest prior to the moment of the employee&apos;s commencement of work, file a required application for mandatory social insurance and pay contributions in conformity with law.</Text>
                    </View>
                </View>

                {/* ─── Član 5 / Article 5 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 5 — Radno vreme</Text>
                        <Text style={s.n}>5.1. Zaposleni zasniva radni odnos sa punim radnim vremenom, u trajanju od 8 časova dnevno i 40 časova nedeljno.</Text>
                        <Text style={s.n}>5.2. O promeni radnog vremena poslodavac će zaposlenog obavestiti najmanje pet dana pre promene.</Text>
                        <Text style={s.n}>5.3. Zaposleni prihvata da u toku rada bude raspoređen u slučaju potrebe procesa rada i organizacije rada, na svako radno mesto koje odgovara njegovoj stručnoj spremi.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 5 — Working Hours</Text>
                        <Text style={s.n}>5.1. The employee establishes the employment relationship with full-time working hours that is 8 hours per day and 40 hours per week.</Text>
                        <Text style={s.n}>5.2. The employer is obliged to inform the employee about the changes to the working hours schedule at least five days in advance.</Text>
                        <Text style={s.n}>5.3. The employee gives his consent to be assigned to other working duties or position which are in accordance with his qualification if work processes and work organization so require.</Text>
                    </View>
                </View>

                {/* ─── Član 6 / Article 6 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 6 — Naknada za rad - Zarada</Text>
                        <Text style={s.n}>6.1. Zaposlenom se utvrđuje zarada za poslove koje obavlja, koja ne može biti manja od minimalne zarade i to zarada zaposlenog utvrđena je u skladu sa zakonom u iznosu od RSD <Text style={s.bold}>{data.SALARY_RSD}</Text> neto mesečno, uvećano za pripadajuće poreze i doprinose.</Text>
                        <Text style={s.n}>6.2. Zaposleni ima pravo na isplatu toplog obroka i pravo na isplatu regresa u skladu sa odlukom direktora.</Text>
                        <Text style={s.n}>6.3. Po osnovu radnog učinka, zarada može da se uveća odnosno umanji po oceni poslodavca. Zarada se isplaćuje u celosti do petog u tekućem mesecu za prethodni mesec.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 6 — Compensation for work - Salary</Text>
                        <Text style={s.n}>6.1. The employee is entitled to a salary determined for performing his work duties, which can&apos;t be less than minimum wage, as follows: The employee&apos;s salary is determined in accordance with law in the amount of RSD <Text style={s.bold}>{data.SALARY_RSD}</Text> netto per month, increased by the amount of taxes and contributions thereon.</Text>
                        <Text style={s.n}>6.2. The employee is entitled to a refund of expenses for food during work and for subsidy for the use of annual leave in accordance with director&apos;s decisions.</Text>
                        <Text style={s.n}>6.3. Based on work performance, salary can be raised or reduced by the employer&apos;s evaluation. Salary is to be paid in full amount by the fifth of the current month for the previous month.</Text>
                    </View>
                </View>

                {/* ─── Član 7 / Article 7 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 7 — Odmori i odsustva</Text>
                        <Text style={s.n}>7.1. Zaposleni ima pravo na godišnji odmor za svaku kalendarsku godinu u trajanju od najmanje 20 radnih dana.</Text>
                        <Text style={s.n}>7.2. Zaposleni ima pravo na dvanaestinu godišnjeg odmora za svakih mesec dana rada u kalendarskoj godini u kojoj je prvi put zasnovao radni odnos ili u kojoj mu prestaje radni odnos.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 7 — Vacations and Leaves</Text>
                        <Text style={s.n}>7.1. The employee is entitled to annual leave in the duration of no less than 20 work days for every calendar year.</Text>
                        <Text style={s.n}>7.2. The employee is entitled to a twelfth of the annual leave for every working month in a calendar year in which he establishes the employment relationship for the first time or in which the employment relationship is terminated.</Text>
                    </View>
                </View>

                {/* ─── Član 8 / Article 8 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 8 — Naknada štete</Text>
                        <Text style={s.n}>8.1. Poslodavac je dužan da organizuje rad kojim se obezbeđuje bezbednost, te zaštita života i zdravlja zaposlenog u skladu sa zakonom i drugim propisima. Zaposleni je dužan da se pridržava propisanih mera bezbednosti i zaštite života i zdravlja na radu.</Text>
                        <Text style={s.n}>8.2. Zaposleni izjavljuje da nema zdravstvenih ograničenja koja mogu uticati na nesmetano obavljanje poslova predviđenih ovim ugovorom.</Text>
                        <Text style={s.n}>8.3. Poslodavac je dužan da zaposlenom nadoknadi štetu koju ovaj pretrpi u slučaju povrede na radu ili u vezi sa radom.</Text>
                        <Text style={s.n}>8.4. Zaposleni je odgovoran za štetu koju je, na radu ili u vezi sa radom, namerno ili iz krajnje nepažnje prouzrokovao poslodavcu.</Text>
                        <Text style={s.n}>8.5. Postojanje štete, njenu visinu i odgovornost zaposlenog utvrđuje poslodavac na predlog neposrednog rukovodioca koji je dužan da sasluša zaposlenog.</Text>
                        <Text style={s.n}>8.6. Poslodavac može, u opravdanim slučajevima delimično (ili potpuno) osloboditi zaposlenog od naknade štete koju je prouzrokovao, osim ako je štetu prouzrokovao namerno. Predlog za oslobađanje od naknade štete može podneti zaposleni.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 8 — Tort liability</Text>
                        <Text style={s.n}>8.1. The employer is obliged to organize work in such way that it secures safety and protection of life and health in conformity with the law and other regulations. Employee is obliged to respect regulations on safety and protection of life and health at work.</Text>
                        <Text style={s.n}>8.2. The employee hereby states that they have no health disabilities which may affect their capability to perform their agreed work duties without difficulties.</Text>
                        <Text style={s.n}>8.3. The employer is obliged to pay to the employee a compensation of damage sustained due to an injury sustained at work or related to work.</Text>
                        <Text style={s.n}>8.4. The Employee is liable for the damage he causes to the employer, at work or in relation to work, with intent or by gross negligence.</Text>
                        <Text style={s.n}>8.5. Damage existence, its&apos; amount and the employee&apos;s liability is determined by the employer upon receiving the proposal of immediate supervisor, who is obliged to hear out the employee.</Text>
                        <Text style={s.n}>8.6. The employer can, due to justifiable reasons, partially (or fully) relieve the employee of compensation for damage caused, unless the damage was caused intentionally. The employee can file a proposal for excused from liability for the damage caused.</Text>
                    </View>
                </View>

                {/* ─── Član 9 / Article 9 ─── */}
                <View style={s.articleRow} break>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 9 — Otkaz ugovora</Text>
                        <Text style={s.n}>9.1. Svaka od ugovornih strana može otkazati ovaj ugovor, pod uslovima, u slučajevima i procedure utvrđenim zakonom, opštim aktom i ugovorom o radu.</Text>
                        <Text style={s.n}>9.2. Otkazom ugovora o radu u saglasnosti sa zakonom, prestaje radni odnos zaposlenog.</Text>
                        <Text style={s.n}>9.3. Poslodavac može zaposlenom da otkaže ugovor o radu ako za to postoji opravdani razlog koji se odnosi na radnu sposobnost zaposlenog i njegovo ponašanje.</Text>
                        <Text style={s.n}>9.4. Poslodavac može da otkaže ugovor o radu zaposlenom koji svojom krivicom učini povredu radne obaveze.</Text>
                        <Text style={s.n}>9.5. Poslodavac može da otkaže ugovor o radu zaposlenom koji ne poštuje radnu disciplinu.</Text>
                        <Text style={s.n}>9.6. Zaposlenom može da prestane radni odnos ako zato postoji opravdan razlog koji se odnosi na potrebe poslodavca i to: ako usled tehnoloških, ekonomskih ili organizacionih promena prestane potreba za obavljanjem određenog posla ili dođe do smanjenja obima posla; ako odbije zaključenje aneksa ugovora u smislu člana 171. stav 1. tač. 1-5) ovog Zakona o radu.</Text>
                        <Text style={s.n}>9.7. Ugovor o radu je moguće raskinuti i sporazumom ugovornih strana, u kom slučaju sporazumom regulišu međusobna prava i obaveze, u skladu sa zakonom, opštim aktom i ugovorom o radu.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 9 — Termination of Employment Contract</Text>
                        <Text style={s.n}>9.1. Each of the contracting parties can cancel this contract, under conditions, in cases and following procedures as determined by law, by law and employment contract.</Text>
                        <Text style={s.n}>9.2. By cancellation of employment contract in accordance with the law, the employment relationship is terminated.</Text>
                        <Text style={s.n}>9.3. The employer may cancel the employment contract for just cause which relates to employee&apos;s work ability and his conduct.</Text>
                        <Text style={s.n}>9.4. The employer may cancel the employment contract of the employee who on his own fault commits a breach of a work duty.</Text>
                        <Text style={s.n}>9.5. The employer may cancel the employment contract of an employee who does not respect the work discipline.</Text>
                        <Text style={s.n}>9.6. The employee&apos;s employment relationship may be terminated if there is a valid reason relating to the employer&apos;s needs, as follows: 1) If as a result of technological, economic or organizational changes, the need to perform a specific job ceases, or there is a decrease in workload; 2) If they refuse to conclude the annex of the contract in terms of Article 171, paragraph 1, items 1-5) of Employment Act.</Text>
                        <Text style={s.n}>9.7. Employment contract is cancellable by an agreement between contracting parties, in which case mutual rights and obligations are regulated by the agreement in accordance with the law, the by law and employment contract.</Text>
                    </View>
                </View>

                {/* ─── Član 10 / Article 10 ─── */}
                <View style={s.articleRow}>
                    <View style={s.colLeft}>
                        <Text style={s.articleHeader}>Član 10 — Završne odredbe</Text>
                        <Text style={s.n}>10.1. Zaposleni i poslodavac prihvataju da se na sva prava, obaveze i odgovornosti koja nisu utvrđena ovim ugovorom, primenjuju odgovarajuće odredbe zakona i opšteg akta.</Text>
                        <Text style={s.n}>10.2. U slučaju spora po ovom ugovoru koji se ne može rešiti dogovorom ugovornih strana, odgovorna je nadležnost Osnovnog suda u Beogradu.</Text>
                        <Text style={s.n}>10.3. Ugovorne strane saglasno konstatuju da su pročitale i razumele odredbe ovog ugovora i da prihvataju iste, to potvrđuju svojim potpisima na ovom ugovoru.</Text>
                        <Text style={s.n}>10.4. U slučaju jezičkih nedoumica, važeća je verzija ugovora na srpskom jeziku.</Text>
                        <Text style={s.n}>10.5. Ovaj ugovor je sačinjen u 4 primerka, od kojih zaposleni zadržava 1 primerak, a poslodavac 3 primerka.</Text>
                    </View>
                    <View style={s.colRight}>
                        <Text style={s.articleHeader}>Article 10 — Final provisions</Text>
                        <Text style={s.n}>10.1. The employee and the employer accept that the relevant provisions of the law and by law apply to the rights, obligations and responsibilities which were not specified by the employment contract.</Text>
                        <Text style={s.n}>10.2. Any dispute between the parties in connection with this contract, unless it can be resolved internally, shall be resolved by Basic Court in Belgrade.</Text>
                        <Text style={s.n}>10.3. Contracting parties hereby declare that they have read, understood and agreed to the terms and conditions set in this contract which they confirm by their signature.</Text>
                        <Text style={s.n}>10.4. In the event of any linguistic doubts, the Serbian version of this contract shall prevail.</Text>
                        <Text style={s.n}>10.5. This contract is made in four identical copies of which the employee keeps one and the employer keeps three.</Text>
                    </View>
                </View>

                {/* Signatures */}
                <View style={s.signatureArea}>
                    <View style={s.sigCol}>
                        <Text style={s.sigLabel}>Za poslodavca / for Employer</Text>
                        <Text style={{ fontSize: 9, fontWeight: 700, textAlign: "center", marginTop: 3 }}>{data.EMPLOYER_DIRECTOR}</Text>
                        <View style={s.sigLine} />
                        <Text style={s.sigLabel}>(potpis / signature)</Text>
                    </View>
                    <View style={s.sigCol}>
                        <Text style={s.sigLabel}>Zaposleni / Employee</Text>
                        <Text style={{ fontSize: 9, fontWeight: 700, textAlign: "center", marginTop: 3 }}>{data.WORKER_FULL_NAME}</Text>
                        <View style={s.sigLine} />
                        <Text style={s.sigLabel}>(potpis / signature)</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
