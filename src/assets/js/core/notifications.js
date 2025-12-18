// Toast Notification System
class ToastNotification {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createContainer());
        } else {
            this.createContainer();
        }
    }

    createContainer() {
        if (this.container) return; // Already created

        // Create container if it doesn't exist
        const existingContainer = document.querySelector('.nsap-toast-container');
        if (!existingContainer) {
            this.container = document.createElement('div');
            this.container.className = 'nsap-toast-container';
            document.body.appendChild(this.container);
            console.log('[Toast] Container created');
        } else {
            this.container = existingContainer;
            console.log('[Toast] Existing container found');
        }
    }

    show(options) {
        if (!this.container) {
            this.createContainer();
            if (!this.container) {
                console.error('[Toast] Failed to create container');
                return null;
            }
        }

        const {
            type = 'info',
            title = '',
            message = '',
            duration = 5000,
            closable = true
        } = options;

        console.log(`[Toast] Showing ${type} toast: ${message}`);

        // Icon mapping
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        // Default titles
        const defaultTitles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `nsap-toast ${type}`;

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="bi ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title || defaultTitles[type]}</div>
                <p class="toast-message">${message}</p>
            </div>
            ${closable ? '<button class="toast-close"><i class="bi bi-x"></i></button>' : ''}
            <div class="toast-progress"></div>
        `;

        // Add to container
        this.container.appendChild(toast);

        // Close button functionality
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => {
                this.remove(toast);
            });
        }

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        return toast;
    }

    remove(toast) {
        toast.style.animation = 'fadeOut 0.4s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }

    success(message, title = '') {
        return this.show({
            type: 'success',
            title,
            message
        });
    }

    error(message, title = '') {
        return this.show({
            type: 'error',
            title,
            message
        });
    }

    warning(message, title = '') {
        return this.show({
            type: 'warning',
            title,
            message
        });
    }

    info(message, title = '') {
        return this.show({
            type: 'info',
            title,
            message
        });
    }
}

// Create global instance
const toast = new ToastNotification();

// Make it available globally
window.toast = toast;
console.log('[Toast] System initialized');
