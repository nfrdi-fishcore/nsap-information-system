/**
 * Unified Loading Utility - NSAP Information System
 * Provides consistent loading state management across all pages
 */

class LoadingManager {
    /**
     * Show full page loading overlay (blurs main content, not sidebar)
     * @param {string} message - Optional loading message
     * @param {HTMLElement} container - Container element (defaults to main-content)
     */
    static showFullPage(message = 'Loading...', container = null) {
        const mainContent = container || document.querySelector('.main-content');
        if (!mainContent) return;

        // Get or create loading overlay
        let overlay = mainContent.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            mainContent.appendChild(overlay);
        } else {
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = message;
            overlay.classList.remove('hidden');
        }

        // Add loading class to blur content
        mainContent.classList.add('loading');
    }

    /**
     * Hide full page loading overlay
     * @param {HTMLElement} container - Container element (defaults to main-content)
     */
    static hideFullPage(container = null) {
        const mainContent = container || document.querySelector('.main-content');
        if (!mainContent) return;

        const overlay = mainContent.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }

        mainContent.classList.remove('loading');
    }

    /**
     * Show inline loading state in a container
     * @param {HTMLElement} container - Container element
     * @param {string} message - Optional loading message
     */
    static showInline(container, message = 'Loading...') {
        if (!container) return;

        // Remove existing content
        container.innerHTML = `
            <div class="loading-inline">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }

    /**
     * Show table loading state
     * @param {HTMLElement} tableBody - Table body element
     * @param {number} colspan - Number of columns for loading row
     * @param {string} message - Optional loading message
     */
    static showTable(tableBody, colspan = 1, message = 'Loading...') {
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-5">
                    <div class="loading-inline">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${message}</div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Show card loading state
     * @param {HTMLElement} card - Card element
     * @param {string} message - Optional loading message
     */
    static showCard(card, message = 'Loading...') {
        if (!card) return;

        card.classList.add('card-loading');
        
        let overlay = card.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            card.appendChild(overlay);
        } else {
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    /**
     * Hide card loading state
     * @param {HTMLElement} card - Card element
     */
    static hideCard(card) {
        if (!card) return;

        card.classList.remove('card-loading');
        const overlay = card.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show button loading state
     * @param {HTMLElement} button - Button element
     */
    static showButton(button) {
        if (!button) return;
        button.classList.add('loading');
        button.disabled = true;
    }

    /**
     * Hide button loading state
     * @param {HTMLElement} button - Button element
     */
    static hideButton(button) {
        if (!button) return;
        button.classList.remove('loading');
        button.disabled = false;
    }

    /**
     * Create a small inline spinner element
     * @returns {HTMLElement} Spinner element
     */
    static createSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner-sm';
        return spinner;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LoadingManager = LoadingManager;
}

