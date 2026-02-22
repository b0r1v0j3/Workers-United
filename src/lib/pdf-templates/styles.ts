import { Font, StyleSheet } from "@react-pdf/renderer";
import path from "path";

// ─── Font Registration ────────────────────────────────────────────────────────
// Register Noto Sans for Serbian Latin character support (Č, Ć, Š, Ž, Đ)

const fontsDir = path.join(process.cwd(), "public", "fonts");

Font.register({
    family: "NotoSans",
    fonts: [
        { src: path.join(fontsDir, "NotoSans-Variable.ttf"), fontWeight: 400 },
        { src: path.join(fontsDir, "NotoSans-Variable.ttf"), fontWeight: 700 },
    ],
});

// Disable hyphenation for Serbian/English text
Font.registerHyphenationCallback((word) => [word]);

// ─── Shared Styles ────────────────────────────────────────────────────────────

export const colors = {
    black: "#000000",
    darkGray: "#333333",
    gray: "#666666",
    lightGray: "#999999",
    border: "#cccccc",
    white: "#ffffff",
};

export const baseStyles = StyleSheet.create({
    page: {
        fontFamily: "NotoSans",
        fontSize: 10,
        paddingTop: 40,
        paddingBottom: 40,
        paddingHorizontal: 40,
        color: colors.black,
        lineHeight: 1.4,
    },
    // Document title
    title: {
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 16,
        textTransform: "uppercase",
    },
    // Section title
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        marginTop: 12,
        marginBottom: 6,
        textTransform: "uppercase",
    },
    // Article/clause title
    articleTitle: {
        fontSize: 10,
        fontWeight: 700,
        marginTop: 10,
        marginBottom: 4,
        textAlign: "center",
    },
    // Normal paragraph text
    paragraph: {
        fontSize: 10,
        marginBottom: 6,
        textAlign: "justify",
    },
    // Bold paragraph
    boldParagraph: {
        fontSize: 10,
        fontWeight: 700,
        marginBottom: 6,
    },
    // Indented paragraph (for sub-items)
    indentedParagraph: {
        fontSize: 10,
        marginBottom: 4,
        paddingLeft: 16,
        textAlign: "justify",
    },
    // Signature block
    signatureBlock: {
        marginTop: 30,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    signatureColumn: {
        width: "45%",
        alignItems: "center",
    },
    signatureLine: {
        width: "100%",
        borderBottomWidth: 1,
        borderBottomColor: colors.black,
        marginTop: 40,
        marginBottom: 4,
    },
    signatureLabel: {
        fontSize: 9,
        textAlign: "center",
        color: colors.gray,
    },
    // Horizontal rule
    hr: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginVertical: 10,
    },
    // Small text
    small: {
        fontSize: 8,
        color: colors.gray,
    },
    // Header info (place, date)
    headerInfo: {
        fontSize: 10,
        marginBottom: 4,
    },
    // Two-column layout (for UGOVOR)
    twoColumnContainer: {
        flexDirection: "row",
        gap: 12,
    },
    columnLeft: {
        flex: 1,
        paddingRight: 6,
        borderRightWidth: 1,
        borderRightColor: colors.border,
    },
    columnRight: {
        flex: 1,
        paddingLeft: 6,
    },
    // Bullet list item
    bulletItem: {
        flexDirection: "row",
        marginBottom: 3,
        paddingLeft: 8,
    },
    bulletDot: {
        width: 10,
        fontSize: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 10,
    },
    // Date and place at top
    placeDate: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    // Number reference (e.g., Broj: ___)
    numberRef: {
        textAlign: "right",
        fontSize: 10,
        marginBottom: 16,
    },
});
