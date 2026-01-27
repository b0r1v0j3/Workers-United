// International Tel Input Initialization
document.addEventListener('DOMContentLoaded', function () {
    const phoneInput = document.querySelector("#phone");
    const countryInput = document.querySelector("#country");

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
            nationalMode: true, // Changed to true to show local format in placeholder
            utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js",
            formatOnDisplay: true,
            autoPlaceholder: "aggressive",
            customPlaceholder: function (selectedCountryPlaceholder, selectedCountryData) {
                // Return placeholder without country code (e.g. "60 123 4567" instead of "+381 60 123 4567")
                return selectedCountryPlaceholder;
            }
        });

        // Clear default placeholder
        phoneInput.placeholder = "";

        // Auto-populate country field when phone country is selected
        if (countryInput) {
            // Listen for country change in phone input
            phoneInput.addEventListener('countrychange', function () {
                const selectedCountryData = iti.getSelectedCountryData();
                if (selectedCountryData && selectedCountryData.name) {
                    // Only auto-fill if country field is empty (don't override user's choice)
                    if (!countryInput.value || countryInput.value.trim() === '') {
                        countryInput.value = selectedCountryData.name;
                    }
                }
            });

            // Initial population when page loads
            setTimeout(() => {
                const selectedCountryData = iti.getSelectedCountryData();
                if (selectedCountryData && selectedCountryData.name && !countryInput.value) {
                    countryInput.value = selectedCountryData.name;
                }
            }, 500); // Small delay to let IP detection finish
        }

        // Validation on blur
        phoneInput.addEventListener('blur', function () {
            if (phoneInput.value.trim()) {
                if (iti.isValidNumber()) {
                    phoneInput.style.borderColor = '#10b981'; // Green when valid
                } else {
                    phoneInput.style.borderColor = '#ef4444'; // Red when invalid
                }
            }
        });

        // Get full international number on form submit
        const form = phoneInput.closest('form');
        if (form) {
            form.addEventListener('submit', function (e) {
                if (phoneInput.value.trim()) {
                    if (!iti.isValidNumber()) {
                        e.preventDefault();
                        alert('Please enter a valid phone number');
                        phoneInput.focus();
                        phoneInput.style.borderColor = '#ef4444';
                        return false;
                    }

                    // Set the full international number format (e.g. +381601234567)
                    const fullNumber = iti.getNumber();
                    phoneInput.value = fullNumber;
                    console.log('Phone number validated:', fullNumber);
                }
            });
        }
    }
});
