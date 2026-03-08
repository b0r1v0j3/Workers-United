import AuthCodeErrorClient from "./AuthCodeErrorClient";

type SearchParamValue = string | string[] | undefined;

function normalizeSearchParam(value: SearchParamValue): string {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function AuthCodeErrorPage({
    searchParams,
}: {
    searchParams: Promise<{
        error?: SearchParamValue;
        error_code?: SearchParamValue;
        error_description?: SearchParamValue;
    }>;
}) {
    const params = await searchParams;

    return (
        <AuthCodeErrorClient
            authError={{
                error: normalizeSearchParam(params?.error),
                errorCode: normalizeSearchParam(params?.error_code),
                errorDescription: normalizeSearchParam(params?.error_description).toLowerCase(),
            }}
        />
    );
}
