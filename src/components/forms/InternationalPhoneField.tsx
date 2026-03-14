"use client";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type PhoneCountry = {
    dialCode?: string;
};

interface InternationalPhoneFieldProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    inputClassName: string;
    buttonClassName?: string;
    containerClassName?: string;
    defaultCountry?: string;
}

export default function InternationalPhoneField({
    value,
    onChange,
    disabled = false,
    inputClassName,
    buttonClassName = "",
    containerClassName = "!w-full !max-w-full phone-field",
    defaultCountry = "rs",
}: InternationalPhoneFieldProps) {
    return (
        <PhoneInput
            country={defaultCountry}
            value={value}
            onChange={(phone: string, country: PhoneCountry) => {
                if (!phone || (country.dialCode && phone === country.dialCode)) {
                    onChange("");
                    return;
                }

                onChange(`+${phone}`);
            }}
            containerClass={`${containerClassName} ${disabled ? "phone-field--disabled" : ""}`}
            inputClass={`${inputClassName} phone-field__input !w-full`}
            buttonClass={`${buttonClassName} phone-field__button`}
            dropdownClass="phone-field__dropdown"
            searchClass="phone-field__search"
            disabled={disabled}
            enableSearch
            disableSearchIcon
            autocompleteSearch
            searchPlaceholder="Search country..."
            searchNotFound="No country found"
            specialLabel=""
            inputProps={{
                autoComplete: "tel",
                inputMode: "tel",
                "aria-label": "Phone number",
            }}
        />
    );
}
