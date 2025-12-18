/**
 * NSAP Information System - Validation Utility
 * 
 * Centralized validation functions for form inputs and data
 */

class Validation {
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @param {Object} options - Validation options
     * @param {number} options.minLength - Minimum length (default: 8)
     * @param {boolean} options.requireUppercase - Require uppercase (default: true)
     * @param {boolean} options.requireLowercase - Require lowercase (default: true)
     * @param {boolean} options.requireNumber - Require number (default: true)
     * @param {boolean} options.requireSpecial - Require special char (default: false)
     * @returns {Object} Validation result with isValid and errors array
     */
    static validatePassword(password, options = {}) {
        const {
            minLength = 8,
            requireUppercase = true,
            requireLowercase = true,
            requireNumber = true,
            requireSpecial = false
        } = options;

        const errors = [];

        if (!password || typeof password !== 'string') {
            return { isValid: false, errors: ['Password is required'] };
        }

        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }

        if (requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (requireNumber && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize HTML to prevent XSS attacks
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    static escapeHtml(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return str.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Validate required field
     * @param {*} value - Value to validate
     * @param {string} fieldName - Name of the field (for error message)
     * @returns {Object} Validation result
     */
    static isRequired(value, fieldName = 'Field') {
        const isValid = value !== null && value !== undefined && value !== '';
        return {
            isValid,
            error: isValid ? null : `${fieldName} is required`
        };
    }

    /**
     * Validate string length
     * @param {string} str - String to validate
     * @param {number} min - Minimum length
     * @param {number} max - Maximum length
     * @param {string} fieldName - Name of the field
     * @returns {Object} Validation result
     */
    static validateLength(str, min, max, fieldName = 'Field') {
        if (!str || typeof str !== 'string') {
            return {
                isValid: false,
                error: `${fieldName} must be between ${min} and ${max} characters`
            };
        }

        const length = str.trim().length;
        const isValid = length >= min && length <= max;

        return {
            isValid,
            error: isValid ? null : `${fieldName} must be between ${min} and ${max} characters`
        };
    }

    /**
     * Validate number range
     * @param {number} num - Number to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {string} fieldName - Name of the field
     * @returns {Object} Validation result
     */
    static validateNumberRange(num, min, max, fieldName = 'Field') {
        const number = Number(num);
        const isValid = !isNaN(number) && number >= min && number <= max;

        return {
            isValid,
            error: isValid ? null : `${fieldName} must be between ${min} and ${max}`
        };
    }

    /**
     * Validate date
     * @param {string|Date} date - Date to validate
     * @param {boolean} allowFuture - Allow future dates (default: false)
     * @param {boolean} allowPast - Allow past dates (default: true)
     * @returns {Object} Validation result
     */
    static validateDate(date, allowFuture = false, allowPast = true) {
        const dateObj = date instanceof Date ? date : new Date(date);
        const isValid = !isNaN(dateObj.getTime());

        if (!isValid) {
            return {
                isValid: false,
                error: 'Invalid date format'
            };
        }

        const now = new Date();
        const isFuture = dateObj > now;
        const isPast = dateObj < now;

        if (isFuture && !allowFuture) {
            return {
                isValid: false,
                error: 'Date cannot be in the future'
            };
        }

        if (isPast && !allowPast) {
            return {
                isValid: false,
                error: 'Date cannot be in the past'
            };
        }

        return {
            isValid: true,
            error: null
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Validation = Validation;
}

