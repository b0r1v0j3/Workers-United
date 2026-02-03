// International Tel Input Initialization - ROBUST VERSION
// Guarantees phone numbers are submitted with + prefix

document.addEventListener('DOMContentLoaded', function () {
    const phoneInput = document.querySelector("#phone");
    const countryInput = document.querySelector("#country");
    const form = phoneInput ? phoneInput.closest('form') : null;

    // Create hidden input for the full international number
    let hiddenPhoneInput = document.querySelector("#phone_full");
    if (!hiddenPhoneInput && form) {
        hiddenPhoneInput = document.createElement('input');
        hiddenPhoneInput.type = 'hidden';
        hiddenPhoneInput.name = 'phone_full';
        hiddenPhoneInput.id = 'phone_full';
        form.appendChild(hiddenPhoneInput);
    }

    if (phoneInput && window.intlTelInput) {
        const iti = window.intlTelInput(phoneInput, {
            initialCountry: "auto",
            geoIpLookup: function (callback) {
                fetch("https://ipapi.co/json")
                    .then(res => res.json())
                    .then(data => callback(data.country_code.toLowerCase()))
                    .catch(() => callback("rs")); // Default Serbia
            },
            preferredCountries: ["rs", "ng", "pk", "in", "uz", "bd", "ph", "eg"],
            separateDialCode: true,
            nationalMode: false, // CHANGED: Force international format
            utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js",
            formatOnDisplay: true,
            autoPlaceholder: "aggressive",
            customPlaceholder: function (selectedCountryPlaceholder, selectedCountryData) {
                // Remove +country_code and leading zero - only show local number
                // e.g., +381 60 1234567 becomes 60 1234567
                let placeholder = selectedCountryPlaceholder;

                // Remove country code (e.g., +381)
                if (selectedCountryData && selectedCountryData.dialCode) {
                    placeholder = placeholder.replace('+' + selectedCountryData.dialCode, '').trim();
                }

                // Also remove any leading zeros and clean up
                placeholder = placeholder.replace(/^0+/, '').trim();

                return placeholder || '60 1234567';
            }
        });

        // Store iti instance globally for debugging
        window.phoneIti = iti;

        // Clear default placeholder
        phoneInput.placeholder = "";

        // STRICT INPUT: Only allow numbers, spaces, and basic formatting
        phoneInput.addEventListener('input', function (e) {
            // Remove anything that's not a number or space
            let cleaned = this.value.replace(/[^\d\s]/g, '');
            if (this.value !== cleaned) {
                this.value = cleaned;
            }

            // Update hidden field with full international number
            updateHiddenPhone();
        });

        // Update hidden field on any change
        function updateHiddenPhone() {
            if (hiddenPhoneInput) {
                const fullNumber = iti.getNumber();
                hiddenPhoneInput.value = fullNumber;
                console.log('📞 Phone updated:', fullNumber);
            }
        }

        // Auto-populate country field when phone country is selected
        if (countryInput) {
            phoneInput.addEventListener('countrychange', function () {
                const selectedCountryData = iti.getSelectedCountryData();
                if (selectedCountryData && selectedCountryData.name) {
                    if (!countryInput.value || countryInput.value.trim() === '') {
                        countryInput.value = selectedCountryData.name;
                    }
                }
                updateHiddenPhone();
            });

            // Initial population when page loads
            setTimeout(() => {
                const selectedCountryData = iti.getSelectedCountryData();
                if (selectedCountryData && selectedCountryData.name && !countryInput.value) {
                    countryInput.value = selectedCountryData.name;
                }
                updateHiddenPhone();
            }, 500);
        }

        // Validation on blur - visual feedback
        phoneInput.addEventListener('blur', function () {
            if (phoneInput.value.trim()) {
                if (iti.isValidNumber()) {
                    phoneInput.style.borderColor = '#10b981'; // Green
                    phoneInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.15)';
                } else {
                    phoneInput.style.borderColor = '#ef4444'; // Red
                    phoneInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                }
            }
            updateHiddenPhone();
        });

        // CRITICAL: Form submit handler - FORCE international format
        if (form) {
            form.addEventListener('submit', function (e) {
                // Get the full international number
                const fullNumber = iti.getNumber();

                // Validate
                if (phoneInput.value.trim()) {
                    if (!iti.isValidNumber()) {
                        e.preventDefault();
                        e.stopPropagation();
                        alert('Please enter a valid phone number with your country code');
                        phoneInput.focus();
                        phoneInput.style.borderColor = '#ef4444';
                        return false;
                    }

                    // FORCE the phone input value to be the full international number
                    // This ensures + prefix is ALWAYS included
                    phoneInput.value = fullNumber;
                    if (hiddenPhoneInput) {
                        hiddenPhoneInput.value = fullNumber;
                    }

                    console.log('✅ Phone submitted:', fullNumber);
                }
            }, true); // Use capture phase to run FIRST
        }
    }
});
