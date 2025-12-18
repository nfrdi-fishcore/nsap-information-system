/**
 * NSAP Information System - Error Handler Utility
 * 
 * Centralized error handling for consistent error management across the application
 */

class ErrorHandler {
    /**
     * Handle errors with user-friendly messages
     * @param {Error} error - The error object
     * @param {Object} options - Additional options
     * @param {string} options.userMessage - User-friendly error message
     * @param {string} options.context - Additional context for logging
     * @param {boolean} options.showToast - Whether to show toast notification (default: true)
     * @param {Function} options.onError - Custom error callback
     */
    static handle(error, options = {}) {
        const {
            userMessage,
            context = '',
            showToast = true,
            onError
        } = options;

        // Log error with context
        const errorContext = context ? `[${context}] ` : '';
        console.error(`${errorContext}Error:`, error);

        // Prepare user-friendly message
        let message = userMessage || this.getUserFriendlyMessage(error);

        // Show toast notification if enabled
        if (showToast && typeof window !== 'undefined' && window.toast) {
            window.toast.error(message, 'Error');
        }

        // Call custom error handler if provided
        if (onError && typeof onError === 'function') {
            onError(error, message);
        }

        // Return error info for further handling
        return {
            error,
            message,
            context
        };
    }

    /**
     * Get user-friendly error message from error object
     * @param {Error} error - The error object
     * @returns {string} User-friendly message
     */
    static getUserFriendlyMessage(error) {
        if (!error) {
            return 'An unexpected error occurred.';
        }

        // Handle Supabase errors
        if (error.message) {
            // Network errors
            if (error.message.includes('fetch') || error.message.includes('network')) {
                return 'Network error. Please check your internet connection and try again.';
            }

            // Authentication errors
            if (error.message.includes('Invalid login') || error.message.includes('auth')) {
                return 'Authentication failed. Please check your credentials.';
            }

            // Permission errors
            if (error.message.includes('permission') || error.message.includes('policy')) {
                return 'You do not have permission to perform this action.';
            }

            // Not found errors
            if (error.message.includes('not found') || error.message.includes('404')) {
                return 'The requested resource was not found.';
            }

            // Validation errors
            if (error.message.includes('validation') || error.message.includes('invalid')) {
                return 'Invalid data provided. Please check your input.';
            }

            // Rate limit errors
            if (error.message.includes('rate limit') || error.message.includes('429')) {
                return 'Too many requests. Please wait a moment and try again.';
            }

            // Return the error message if it's already user-friendly
            return error.message;
        }

        // Default message
        return 'An unexpected error occurred. Please try again.';
    }

    /**
     * Handle async operation with error handling
     * @param {Function} asyncFn - Async function to execute
     * @param {Object} options - Error handling options
     * @returns {Promise} Promise that resolves with result or handles error
     */
    static async wrapAsync(asyncFn, options = {}) {
        try {
            return await asyncFn();
        } catch (error) {
            this.handle(error, options);
            throw error; // Re-throw for caller to handle if needed
        }
    }

    /**
     * Validate error and return standardized format
     * @param {*} error - Error object or value
     * @returns {Error} Standardized Error object
     */
    static normalizeError(error) {
        if (error instanceof Error) {
            return error;
        }

        if (typeof error === 'string') {
            return new Error(error);
        }

        if (error && typeof error === 'object' && error.message) {
            return new Error(error.message);
        }

        return new Error('An unknown error occurred');
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}

