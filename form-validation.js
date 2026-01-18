/**
 * Workers United - Contact Form Validation
 * Client-side validation with real-time feedback
 */

(function () {
  'use strict';

  // Wait for DOM to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormValidation);
  } else {
    initFormValidation();
  }

  function initFormValidation() {
    const form = document.querySelector('form[name="contact"]');
    if (!form) return; // Not on contact page

    const fields = {
      name: form.querySelector('#name'),
      email: form.querySelector('#email'),
      country: form.querySelector('#country'),
      role: form.querySelectorAll('input[name="role"]'),
      message: form.querySelector('#message')
    };

    // Validation rules
    const validators = {
      name: {
        validate: (value) => value.trim().length >= 2,
        message: 'Please enter your full name (at least 2 characters)'
      },
      email: {
        validate: (value) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value.trim());
        },
        message: 'Please enter a valid email address'
      },
      role: {
        validate: () => {
          return Array.from(fields.role).some(radio => radio.checked);
        },
        message: 'Please select your role'
      },
      message: {
        validate: (value) => value.trim().length >= 10,
        message: 'Please provide more details (at least 10 characters)'
      }
    };

    // Create error message elements
    function createErrorElement(fieldName) {
      const errorId = `${fieldName}-error`;
      let errorEl = document.getElementById(errorId);
      
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = errorId;
        errorEl.className = 'field-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.setAttribute('aria-live', 'polite');
      }
      
      return errorEl;
    }

    // Show error
    function showError(fieldName, message) {
      const field = fields[fieldName];
      const errorEl = createErrorElement(fieldName);
      errorEl.textContent = message;

      if (fieldName === 'role') {
        // Insert error after radio buttons container
        const radioRow = form.querySelector('.radio-row');
        if (radioRow && !document.getElementById(`${fieldName}-error`)) {
          radioRow.parentElement.appendChild(errorEl);
        }
      } else {
        // Insert error after input field
        const fieldContainer = field.closest('.field');
        if (fieldContainer && !document.getElementById(`${fieldName}-error`)) {
          fieldContainer.appendChild(errorEl);
        }
      }

      // Add error styling to field
      if (fieldName !== 'role') {
        field.classList.add('field-invalid');
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', `${fieldName}-error`);
      }
    }

    // Clear error
    function clearError(fieldName) {
      const field = fields[fieldName];
      const errorEl = document.getElementById(`${fieldName}-error`);
      
      if (errorEl) {
        errorEl.remove();
      }

      if (fieldName !== 'role' && field) {
        field.classList.remove('field-invalid');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    }

    // Validate single field
    function validateField(fieldName) {
      const validator = validators[fieldName];
      if (!validator) return true;

      let isValid = false;

      if (fieldName === 'role') {
        isValid = validator.validate();
      } else {
        const field = fields[fieldName];
        isValid = validator.validate(field.value);
      }

      if (!isValid) {
        showError(fieldName, validator.message);
        return false;
      } else {
        clearError(fieldName);
        return true;
      }
    }

    // Validate all fields
    function validateAllFields() {
      let isValid = true;

      // Clear all errors first
      Object.keys(validators).forEach(fieldName => clearError(fieldName));

      // Validate each field
      Object.keys(validators).forEach(fieldName => {
        if (!validateField(fieldName)) {
          isValid = false;
        }
      });

      return isValid;
    }

    // Real-time validation on blur
    if (fields.name) {
      fields.name.addEventListener('blur', () => validateField('name'));
    }

    if (fields.email) {
      fields.email.addEventListener('blur', () => validateField('email'));
    }

    if (fields.message) {
      fields.message.addEventListener('blur', () => validateField('message'));
    }

    // Validate role when any radio is selected
    if (fields.role) {
      fields.role.forEach(radio => {
        radio.addEventListener('change', () => validateField('role'));
      });
    }

    // Clear error on input (real-time feedback)
    if (fields.name) {
      fields.name.addEventListener('input', () => {
        if (fields.name.value.trim().length >= 2) {
          clearError('name');
        }
      });
    }

    if (fields.email) {
      fields.email.addEventListener('input', () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(fields.email.value.trim())) {
          clearError('email');
        }
      });
    }

    if (fields.message) {
      fields.message.addEventListener('input', () => {
        if (fields.message.value.trim().length >= 10) {
          clearError('message');
        }
      });
    }

    // Form submission
    form.addEventListener('submit', function (e) {
      // Validate all fields
      const isValid = validateAllFields();

      if (!isValid) {
        e.preventDefault();
        
        // Focus first invalid field
        const firstError = form.querySelector('.field-invalid');
        if (firstError) {
          firstError.focus();
          // Smooth scroll to error
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Show error notification
        showNotification('Please fix the errors above before submitting', 'error');
        return false;
      }

      // If valid, show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        submitBtn.style.opacity = '0.6';
      }

      // Netlify will handle the actual submission
      // If there's an error, Netlify will show it
      // We'll add a success message handler via URL parameter
    });

    // Check for success parameter in URL (Netlify redirects to ?success=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      showSuccessMessage();
      // Remove parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Show notification (toast)
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.form-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `form-notification form-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // Show success message
  function showSuccessMessage() {
    const form = document.querySelector('form[name="contact"]');
    if (!form) return;

    // Create success overlay
    const successOverlay = document.createElement('div');
    successOverlay.className = 'form-success-overlay';
    successOverlay.innerHTML = `
      <div class="form-success-card">
        <div class="success-icon">✓</div>
        <h3>Message sent successfully!</h3>
        <p>Thank you for contacting Workers United. We will reply to you personally, usually within one business day.</p>
        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Close</button>
      </div>
    `;

    form.parentElement.style.position = 'relative';
    form.parentElement.appendChild(successOverlay);

    // Animate in
    setTimeout(() => successOverlay.classList.add('show'), 10);

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
