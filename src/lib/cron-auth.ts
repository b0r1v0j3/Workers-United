export function getCronSecret(): string | null {
    const token = process.env.CRON_SECRET?.trim();
    return token ? token : null;
}

export function hasValidCronBearerToken(authHeader: string | null | undefined): boolean {
    const expectedToken = getCronSecret();
    return !!expectedToken && authHeader === `Bearer ${expectedToken}`;
}

export function getCronAuthorizationHeader(): string | null {
    const expectedToken = getCronSecret();
    return expectedToken ? `Bearer ${expectedToken}` : null;
}
