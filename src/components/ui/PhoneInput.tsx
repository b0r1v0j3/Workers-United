"use client";

import 'react-phone-number-input/style.css'
import PhoneInput from 'react-phone-number-input'
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

export function CustomPhoneInput({ value, onChange, className, placeholder }: PhoneInputProps) {
    return (
        <div className={cn("relative group", className)}>
            <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .PhoneInputCountry {
          display: flex;
          align-items: center;
          padding: 10px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          transition: all 0.2s;
        }
        .PhoneInputCountry:focus-within {
          border-color: var(--color-primary-soft);
          ring: 2px solid var(--color-primary-soft);
        }
        .PhoneInputCountrySelect {
            display: none; /* Hide default select, we use the icon */
        }
        .PhoneInputInput {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 10px 14px;
          font-size: 1rem;
          outline: none;
          transition: all 0.2s;
          color: #1e293b;
        }
        .PhoneInputInput:focus {
           border-color: var(--color-primary-soft);
           box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.1);
        }
        .PhoneInputCountryIcon {
            width: 24px;
            height: 16px;
            border-radius: 2px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
      `}</style>
            <PhoneInput
                international
                defaultCountry="RS"
                value={value}
                onChange={(v) => onChange(v?.toString() || "")}
                placeholder={placeholder || "Enter phone number"}
                numberInputProps={{
                    className: "PhoneInputInput" // Use our custom class
                }}
            />
        </div>
    );
}
