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
    buttonClassName: string;
    containerClassName?: string;
    defaultCountry?: string;
}

export default function InternationalPhoneField({
    value,
    onChange,
    disabled = false,
    inputClassName,
    buttonClassName,
    containerClassName = "!w-full !max-w-full",
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
            containerClass={containerClassName}
            inputClass={`${inputClassName} !pl-12 !w-full`}
            buttonClass={buttonClassName}
            disabled={disabled}
            enableSearch
            searchPlaceholder="Search country..."
        />
    );
}
