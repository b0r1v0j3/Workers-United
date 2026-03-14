export function getCountryDisplayLabel(country: string | null | undefined) {
    if (!country) {
        return "";
    }

    return country === "Bosnia and Herzegovina" ? "Bosnia & Herzegovina" : country;
}
