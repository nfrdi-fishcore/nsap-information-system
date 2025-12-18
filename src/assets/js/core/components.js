/**
 * Alternative Component System using Template Elements
 * Works with file:// protocol (no server required)
 */

// Component templates stored as JavaScript strings
const ComponentTemplates = {
    navbar: `
        <nav class="navbar navbar-expand-lg navbar-light fixed-top">
            <div class="container">
                <a class="navbar-brand" href="index.html">
                    <i class="bi bi-water"></i> NSAP Info System
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="#history">History</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#about">About</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#features">Features</a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    `,

    footer: `
        <footer class="text-white text-center">
            <div class="container py-4">
                <p>&copy; 2025 NSAP Information System. All rights reserved.</p>
                <p class="mb-0">Bureau of Fisheries and Aquatic Resources</p>
            </div>
        </footer>
    `,

    sidebar: `
        <button class="mobile-toggle" id="mobileToggleBtn" aria-label="Toggle Sidebar">
            <i class="bi bi-list"></i>
        </button>
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <img src="https://mlkhadblfumf.i.optimole.com/w:162/h:154/q:85/https://nsap.nfrdi.da.gov.ph/dist/img/logo/nsap_orig.svg?v=1.3.1" 
                     alt="NSAP Logo" class="sidebar-logo-img">
                <div class="sidebar-brand-text">
                    <div class="brand-title">NSAP</div>
                    <div class="brand-subtitle">Information System</div>
                </div>
            </div>

            <nav class="sidebar-nav">
                <ul class="nav flex-column">
                    <li class="nav-item">
                        <a href="dashboard.html" class="nav-link">
                            <i class="bi bi-grid-1x2"></i>
                            <span class="nav-text">Dashboard</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="data-entry.html" class="nav-link">
                            <i class="bi bi-clipboard-data"></i>
                            <span class="nav-text">NSAP Data Entry</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-bs-toggle="collapse" data-bs-target="#referenceTablesMenu">
                            <i class="bi bi-table"></i>
                            <span class="nav-text">Reference Tables</span>
                            <i class="bi bi-chevron-down nav-arrow"></i>
                        </a>
                        <ul class="nav-submenu collapse" id="referenceTablesMenu">
                            <li><a href="landing-centers.html" class="submenu-link">Landing Centers</a></li>
                            <li><a href="fishing-grounds.html" class="submenu-link">Fishing Grounds</a></li>
                            <li><a href="fishing-effort.html" class="submenu-link">Fishing Effort</a></li>
                            <li><a href="species.html" class="submenu-link">Species</a></li>
                            <li><a href="gear.html" class="submenu-link">Gear</a></li>
                            <li><a href="vessel.html" class="submenu-link">Vessel</a></li>
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-bs-toggle="collapse" data-bs-target="#reportsMenu">
                            <i class="bi bi-file-earmark-text"></i>
                            <span class="nav-text">Reports</span>
                            <i class="bi bi-chevron-down nav-arrow"></i>
                        </a>
                        <ul class="nav-submenu collapse" id="reportsMenu">
                            <li><a href="reports-monthly.html" class="submenu-link">Monthly Report</a></li>
                            <li><a href="reports-regional.html" class="submenu-link">Regional Report</a></li>
                            <li><a href="reports-species.html" class="submenu-link">Species Report</a></li>
                            <li><a href="reports-custom.html" class="submenu-link">Custom Report</a></li>
                        </ul>
                    </li>
                    <li class="nav-item" data-allowed-roles="superadmin,admin,viewer" style="display: none;">
                        <a href="analytics.html" class="nav-link">
                            <i class="bi bi-graph-up"></i>
                            <span class="nav-text">Analytics</span>
                        </a>
                    </li>
                    <li class="nav-item" id="adminMenu" data-allowed-roles="superadmin,admin" style="display: none;">
                        <a href="#" class="nav-link" data-bs-toggle="collapse" data-bs-target="#adminSubmenu">
                            <i class="bi bi-shield-lock"></i>
                            <span class="nav-text">Administration</span>
                            <i class="bi bi-chevron-down nav-arrow"></i>
                        </a>
                        <ul class="nav-submenu collapse" id="adminSubmenu">
                            <li><a href="users.html" class="submenu-link">User Management</a></li>
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a href="settings.html" class="nav-link">
                            <i class="bi bi-gear"></i>
                            <span class="nav-text">Settings</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="about.html" class="nav-link">
                            <i class="bi bi-info-circle"></i>
                            <span class="nav-text">About</span>
                        </a>
                    </li>
                </ul>
            </nav>

            <div class="sidebar-footer">
                <div class="user-profile">
                    <div class="user-avatar">
                        <i class="bi bi-person-circle" id="defaultAvatarIcon"></i>
                        <img src="" alt="User Avatar" class="user-avatar-img d-none" id="userAvatarImg">
                    </div>
                    <div class="user-info">
                        <div class="user-name" id="userName">Loading...</div>
                        <div class="user-role" id="userRole">User</div>
                    </div>
                </div>
                <a href="#" class="nav-link" id="logoutBtn">
                    <i class="bi bi-box-arrow-right"></i>
                    <span class="nav-text">Logout</span>
                </a>
            </div>
        </div>
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
    `
};

// Component Loader (works without server)
const Components = {
    /**
     * Insert component into target element
     */
    insert(componentName, targetSelector) {
        const template = ComponentTemplates[componentName];
        if (!template) {
            console.error(`Component not found: ${componentName}`);
            return false;
        }

        const element = document.querySelector(targetSelector);
        if (element) {
            element.innerHTML = template;
            return true;
        }
        return false;
    },

    /**
     * Initialize Sidebar Logic (Active State, RBAC, Mobile Toggle)
     */
    async initSidebar() {
        // First, collapse all submenus on initial load (sidebar starts collapsed on desktop)
        // On mobile, sidebar is always expanded, so we'll handle that differently
        if (window.innerWidth > 768) {
            this.collapseAllSubmenus();
        }

        // Active State
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.nav-link, .submenu-link');

        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');

                // Expand parent submenu if needed
                const parentSubmenu = link.closest('.nav-submenu');
                if (parentSubmenu) {
                    // On mobile, always expand the parent submenu of the active link
                    // On desktop, the submenu will expand when user hovers over sidebar
                    if (window.innerWidth <= 768) {
                        parentSubmenu.classList.add('show');
                        // Highlight parent Trigger
                        const trigger = document.querySelector(`[data-bs-target="#${parentSubmenu.id}"]`);
                        if (trigger) {
                            trigger.setAttribute('aria-expanded', 'true');
                            trigger.classList.add('active');
                        }
                    }
                    // On desktop, we'll expand it when sidebar is hovered (handled by CSS/JS on hover)
                }
            }
        });

        // Logout Logic
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                // Create logout confirmation modal
                const modalHtml = `<div class="modal fade" id="logoutModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header border-0"><h5 class="modal-title"><i class="bi bi-box-arrow-right text-danger me-2"></i>Confirm Logout</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p class="mb-0">Are you sure you want to logout? You will need to sign in again to access the dashboard.</p></div><div class="modal-footer border-0"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="bi bi-x-circle me-1"></i>Cancel</button><button type="button" class="btn btn-danger" id="confirmLogoutBtn"><i class="bi bi-box-arrow-right me-1"></i>Logout</button></div></div></div></div>`;
                const existingModal = document.getElementById('logoutModal');
                if (existingModal) existingModal.remove();
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                const modalElement = document.getElementById('logoutModal');
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
                document.getElementById('confirmLogoutBtn').addEventListener('click', async () => {
                    const confirmBtn = document.getElementById('confirmLogoutBtn');
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging out...';

                    try {
                        // Disable logout button to prevent double clicks
                        logoutBtn.style.pointerEvents = 'none';
                        logoutBtn.style.opacity = '0.6';

                        // Sign out from Supabase
                        if (window._supabase) {
                            const { error } = await window._supabase.auth.signOut();
                            if (error) {
                                throw new Error(`Supabase logout failed: ${error.message}`);
                            }
                        }

                        // Clear all session-related data from localStorage
                        const keysToRemove = [
                            'userSession',
                            'sidebarCollapsed',
                            'sb-vidhefbvribdzlrqmtgv-auth-token' // Supabase auth token
                        ];

                        keysToRemove.forEach(key => {
                            localStorage.removeItem(key);
                        });

                        // Clear all sessionStorage
                        sessionStorage.clear();

                        // Show success notification
                        if (window.toast) {
                            window.toast.success('Logged out successfully', 'Goodbye!');
                        }

                        // Redirect to index page after a short delay
                        setTimeout(() => {
                            console.log('[Logout] Redirecting to login...');
                            window.location.href = 'index.html';
                        }, 500);

                    } catch (error) {
                        console.error('Logout error:', error);

                        // Re-enable logout button
                        logoutBtn.style.pointerEvents = 'auto';
                        logoutBtn.style.opacity = '1';

                        // Show error notification
                        if (window.toast) {
                            window.toast.error('Logout failed. Please try again.', 'Error');
                        } else {
                            alert('Logout failed: ' + error.message);
                        }
                    }
                });
                modalElement.addEventListener('hidden.bs.modal', () => { modalElement.remove(); });
            });
            console.log('[Sidebar] ✅ Logout event listener attached successfully!');
        } else {
            console.warn('[Sidebar] ⚠️ Logout button not found! Cannot attach event listener.');
        }

        // Load user info
        this.loadUserInfo();

        // Initialize mobile toggle functionality
        this.initMobileToggle();
    },

    /**
     * Initialize mobile toggle button and overlay
     */
    initMobileToggle() {
        const mobileToggleBtn = document.getElementById('mobileToggleBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (!mobileToggleBtn || !sidebar || !sidebarOverlay) {
            // Only log warning on mobile devices
            if (window.innerWidth <= 768) {
                console.warn('[Sidebar] Mobile toggle elements not found');
            }
            return;
        }

        // Toggle sidebar when button is clicked
        mobileToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-active');
            sidebarOverlay.classList.toggle('active');
            
            // Update button icon
            const icon = mobileToggleBtn.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('mobile-active')) {
                    icon.classList.remove('bi-list');
                    icon.classList.add('bi-x-lg');
                } else {
                    icon.classList.remove('bi-x-lg');
                    icon.classList.add('bi-list');
                }
            }
        });

        // Close sidebar when overlay is clicked
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-active');
            sidebarOverlay.classList.remove('active');
            
            // Update button icon
            const icon = mobileToggleBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('bi-x-lg');
                icon.classList.add('bi-list');
            }
        });

        // Close sidebar when clicking on a nav link (mobile only)
        // Only close for actual navigation links, not submenu toggles
        if (window.innerWidth <= 768) {
            const navLinks = document.querySelectorAll('.nav-link[href]:not([href="#"]), .submenu-link[href]:not([href="#"])');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    // Small delay to allow navigation
                    setTimeout(() => {
                        sidebar.classList.remove('mobile-active');
                        sidebarOverlay.classList.remove('active');
                        
                        // Update button icon
                        const icon = mobileToggleBtn.querySelector('i');
                        if (icon) {
                            icon.classList.remove('bi-x-lg');
                            icon.classList.add('bi-list');
                        }
                    }, 100);
                });
            });
        }

        console.log('[Sidebar] ✅ Mobile toggle initialized');
    },

    /**
     * Apply role-based permissions to UI elements
     */
    applyPermissions(userRole) {
        if (!userRole) return;

        // Find all elements with data-allowed-roles attribute
        const restrictedElements = document.querySelectorAll('[data-allowed-roles]');

        restrictedElements.forEach(el => {
            const allowedRoles = el.dataset.allowedRoles.split(',').map(r => r.trim().toLowerCase());

            if (allowedRoles.includes(userRole.toLowerCase())) {
                // Show element
                el.style.display = '';
                el.classList.remove('d-none');
            } else {
                // Hide element
                el.style.display = 'none';
                el.classList.add('d-none');
            }
        });

        console.log(`[Permissions] Applied for role: ${userRole}`);
    },

    /**
     * Load user information
     */
    async loadUserInfo() {
        try {
            // Check if Supabase is initialized
            if (!window._supabase) {
                console.warn('Supabase client not initialized');
                return;
            }

            const session = await getSession();
            if (!session) return;

            const { data: user } = await window._supabase
                .from('dbo_user')
                .select('full_name, role, user_img')
                .eq('user_id', session.user.id)
                .single();

            if (user) {
                const userNameEl = document.getElementById('userName');
                const userRoleEl = document.getElementById('userRole');

                if (userNameEl) userNameEl.textContent = user.full_name || 'User';

                // Format role for display (capitalize first letter)
                const displayRole = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
                if (userRoleEl) userRoleEl.textContent = displayRole;

                // Handle Avatar Display
                const defaultIcon = document.getElementById('defaultAvatarIcon');
                const avatarImg = document.getElementById('userAvatarImg');

                if (user.user_img && avatarImg && defaultIcon) {
                    // Update image source and toggle visibility
                    avatarImg.src = user.user_img;
                    avatarImg.classList.remove('d-none');
                    defaultIcon.classList.add('d-none');
                } else if (avatarImg && defaultIcon) {
                    // Fallback to default icon
                    avatarImg.classList.add('d-none');
                    defaultIcon.classList.remove('d-none');
                }

                // Apply permissions based on role
                this.applyPermissions(user.role);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
        // Desktop Expand/Collapse Logic with Submenu Auto-Collapse
        if (window.innerWidth > 768) {
            const sidebarElement = document.querySelector('.sidebar');
            if (sidebarElement) {
                sidebarElement.addEventListener('mouseenter', () => {
                    document.body.classList.add('sidebar-expanded');
                    // Expand the submenu containing the active link when sidebar expands
                    const activeLink = document.querySelector('.submenu-link.active');
                    if (activeLink) {
                        const parentSubmenu = activeLink.closest('.nav-submenu');
                        if (parentSubmenu && !parentSubmenu.classList.contains('show')) {
                            const bsCollapse = new bootstrap.Collapse(parentSubmenu, { toggle: false });
                            bsCollapse.show();
                            const triggerId = parentSubmenu.id;
                            if (triggerId) {
                                const trigger = document.querySelector(`[data-bs-target="#${triggerId}"]`);
                                if (trigger) {
                                    trigger.setAttribute('aria-expanded', 'true');
                                }
                            }
                        }
                    }
                });
                
                sidebarElement.addEventListener('mouseleave', () => {
                    document.body.classList.remove('sidebar-expanded');
                    // Auto-collapse all submenus when sidebar collapses
                    this.collapseAllSubmenus();
                });
            }
        }
    },

    /**
     * Collapse all Bootstrap collapse submenus
     */
    collapseAllSubmenus() {
        // Find all submenu collapse elements that are currently shown
        const submenus = document.querySelectorAll('.nav-submenu.collapse.show');
        
        submenus.forEach(submenu => {
            // Get the Bootstrap collapse instance
            const bsCollapse = bootstrap.Collapse.getInstance(submenu);
            if (bsCollapse) {
                // Use Bootstrap's collapse method for smooth animation
                bsCollapse.hide();
            } else {
                // If no instance exists, manually collapse
                submenu.classList.remove('show');
            }
            
            // Update the trigger button's aria-expanded attribute
            const triggerId = submenu.id;
            if (triggerId) {
                const trigger = document.querySelector(`[data-bs-target="#${triggerId}"]`);
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }
};

// Make globally available
window.Components = Components;
