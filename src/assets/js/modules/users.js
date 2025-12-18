/**
 * User Management Logic
 * 
 * Phase 1: Applied error handler, constants, and validation
 */

let allUsers = [];
let currentUserRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check permissions
    const session = await getSession();
    if (session) {
        const { data: user } = await window._supabase
            .from(TABLES.USER)
            .select('role')
            .eq('user_id', session.user.id)
            .single();

        currentUserRole = user?.role;
        // Basic role check - redirect viewers (they shouldn't access user management)
        if (currentUserRole === ROLES.VIEWER) {
            window.location.href = 'dashboard.html';
            return;
        }
        // Note: Only admin and superadmin can access user management
    }

    // specific initializations
    await Promise.all([
        fetchRegions(),
        fetchUsers()
    ]);

    // Event Listeners
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('roleFilter').addEventListener('change', filterUsers);
    document.getElementById('statusFilter').addEventListener('change', filterUsers);
    document.getElementById('regionFilter').addEventListener('change', filterUsers);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

    // Form Submits
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    document.getElementById('editUserForm').addEventListener('submit', handleEditUser);

    // Delete Confirmation
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteUser);
});

/**
 * Fetch Regions
 */
async function fetchRegions() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.REGION)
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        const selects = document.querySelectorAll('select[name="region_id"]');
        selects.forEach(select => {
            select.innerHTML = '<option value="" selected disabled>Select Region</option>';
            data.forEach(region => {
                const option = document.createElement('option');
                option.value = region.region_id;
                option.textContent = Validation.escapeHtml(region.region_name);
                select.appendChild(option);
            });
        });

        // Populate region filter dropdown
        const regionFilter = document.getElementById('regionFilter');
        if (regionFilter) {
            regionFilter.innerHTML = '<option value="">All Regions</option>';
            data.forEach(region => {
                const option = document.createElement('option');
                option.value = region.region_id;
                option.textContent = Validation.escapeHtml(region.region_name);
                regionFilter.appendChild(option);
            });
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.fetchRegions',
            userMessage: 'Failed to load regions',
            showToast: false
        });
    }
}

/**
 * Fetch all users from Supabase
 */
async function fetchUsers() {
    showLoading(true);
    try {
        const { data, error } = await window._supabase
            .from(TABLES.USER)
            .select('*, dbo_region(region_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = data || [];
        renderUsers(allUsers);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.fetchUsers',
            userMessage: 'Failed to load users'
        });
    } finally {
        showLoading(false);
    }
}

/**
 * Render users table
 */
function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');

    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.parentElement.classList.add('d-none');
        emptyState.classList.remove('d-none');
        return;
    }

    tbody.parentElement.classList.remove('d-none');
    emptyState.classList.add('d-none');

    users.forEach(user => {
        const status = user.status || 'active'; // Default to active if null (until DB update)
        const role = user.role || ROLES.VIEWER;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <div class="user-avatar-sm">
                        ${getInitials(user.full_name || user.email)}
                    </div>
                    <div>
                        <div class="fw-medium">${Validation.escapeHtml(user.full_name || 'N/A')}</div>
                        <div class="small text-muted">${Validation.escapeHtml(user.email)}</div>
                    </div>
                </div>
            </td>
            <td><span class="role-badge">${role}</span></td>
            <td>
                <span class="status-badge status-${status.toLowerCase()}">
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
            </td>
            <td class="text-muted small">
                ${new Date(user.created_at).toLocaleDateString()}
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-edit me-1" onclick="openEditModal('${user.user_id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>

                ${status === 'inactive'
                ? `<button class="btn btn-sm btn-add" onclick="confirmActivateUser('${user.user_id}')" title="Activate">
                           <i class="bi bi-check-circle"></i>
                       </button>`
                : `<button class="btn btn-sm btn-delete" onclick="confirmDeleteUser('${user.user_id}')" title="Deactivate">
                           <i class="bi bi-trash"></i>
                       </button>`
            }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Filter users based on search and selects
 */
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const regionFilter = document.getElementById('regionFilter').value;

    const filtered = allUsers.filter(user => {
        const matchesSearch = (user.full_name?.toLowerCase().includes(searchTerm) ||
            user.email?.toLowerCase().includes(searchTerm));
        const matchesRole = !roleFilter || (user.role === roleFilter);
        const matchesStatus = !statusFilter || ((user.status || 'active') === statusFilter);
        const matchesRegion = !regionFilter || (user.region_id === parseInt(regionFilter));

        return matchesSearch && matchesRole && matchesStatus && matchesRegion;
    });

    renderUsers(filtered);
}

/**
 * Export users to CSV
 */
function exportToCSV() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const regionFilter = document.getElementById('regionFilter').value;

    // Apply same filters as table
    let dataToExport = allUsers;
    
    if (searchTerm || roleFilter || statusFilter || regionFilter) {
        dataToExport = allUsers.filter(user => {
            const matchesSearch = (user.full_name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm));
            const matchesRole = !roleFilter || (user.role === roleFilter);
            const matchesStatus = !statusFilter || ((user.status || 'active') === statusFilter);
            const matchesRegion = !regionFilter || (user.region_id === parseInt(regionFilter));
            return matchesSearch && matchesRole && matchesStatus && matchesRegion;
        });
    }

    // Create CSV content
    const headers = ['Full Name', 'Email', 'Role', 'Status', 'Region', 'Office', 'Designation', 'Joined Date'];
    const rows = dataToExport.map(user => [
        Validation.escapeHtml(user.full_name || 'N/A'),
        Validation.escapeHtml(user.email || ''),
        user.role || 'viewer',
        user.status || 'active',
        user.dbo_region ? Validation.escapeHtml(user.dbo_region.region_name) : 'N/A',
        Validation.escapeHtml(user.office || ''),
        Validation.escapeHtml(user.designation || ''),
        new Date(user.created_at).toLocaleDateString()
    ]);

    // Convert to CSV format
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Users exported successfully!', 'Export Complete');
}

/**
 * Handle Add User
 * NOTE: This currently only adds to dbo_user. 
 * Real authentication creation requires Supabase Admin API or specific flow.
 */
async function handleAddUser(e) {
    e.preventDefault();
    
    // Prevent viewers from adding users
    if (currentUserRole === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to add users.', 'Access Denied');
        return;
    }

    const form = e.target;
    const formData = new FormData(form);
    const btn = document.querySelector(`button[type="submit"][form="${form.id}"]`);

    const userData = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        role: formData.get('role'),
        region_id: formData.get('region_id'),
        office: formData.get('office'),
        designation: formData.get('designation'),
        status: 'active',
        // password is not stored in dbo_user
    };

    // NOTE: In a real app, you would also call supabase.auth.signUp() here
    // However, calling signUp on client side might sign *you* out depending on config.
    // For now, we will simulate the DB entry creation.

    btn.disabled = true;
    try {
        // 1. Validate input
        const emailValidation = Validation.isValidEmail(userData.email);
        if (!emailValidation) {
            throw new Error('Invalid email address');
        }

        const nameValidation = Validation.isRequired(userData.full_name, 'Full Name');
        if (!nameValidation.isValid) {
            throw new Error(nameValidation.error);
        }

        // 2. Check if email exists in our profile table
        const { data: existing } = await window._supabase
            .from(TABLES.USER)
            .select('email')
            .eq('email', userData.email)
            .maybeSingle(); // Use maybeSingle to avoid 406 errors

        if (existing) throw new Error('User with this email already exists.');

        // 3. Create the Authentication User
        // We use a temporary client to avoid logging out the current admin
        if (typeof window.CONFIG === 'undefined') {
            throw new Error('Configuration not loaded. Please ensure config.js is loaded.');
        }
        const tempClient = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false, // Don't overwrite local storage
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email: userData.email,
            password: formData.get('password') // Use the password from the form
        });

        if (authError) throw new Error('Auth creation failed: ' + authError.message);

        // If sign up required email verification, authData.user might be null or session null
        if (!authData.user) throw new Error('Failed to create authentication user.');

        const newUserId = authData.user.id;

        // 4. Upsert into dbo_user using the REAL user_id
        // We use upsert to handle cases where a trigger might have already created a blank row
        const { error } = await window._supabase
            .from(TABLES.USER)
            .upsert([{
                ...userData,
                user_id: newUserId,
                created_at: new Date().toISOString()
            }], { onConflict: 'user_id' });

        if (error) throw error;

        let successMessage = 'User added successfully';
        if (!authData.session) {
            successMessage += '. Verification email sent (if enabled).';
        }

        if (window.toast) window.toast.success(successMessage);

        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
        modal.hide();
        form.reset();
        fetchUsers();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.handleAddUser',
            userMessage: 'Failed to add user'
        });
    } finally {
        btn.disabled = false;
    }
}

/**
 * Open Edit Modal
 */
window.openEditModal = function (userId) {
    // Prevent viewers from editing users
    if (currentUserRole === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to edit users.', 'Access Denied');
        return;
    }

    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return;

    const form = document.getElementById('editUserForm');
    form.querySelector('[name="user_id"]').value = user.user_id;
    form.querySelector('[name="full_name"]').value = user.full_name;
    form.querySelector('[name="region_id"]').value = user.region_id || '';
    form.querySelector('[name="office"]').value = user.office || '';
    form.querySelector('[name="designation"]').value = user.designation || '';
    form.querySelector('[name="role"]').value = user.role;
    form.querySelector('[name="status"]').value = user.status || 'active';

    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
}

/**
 * Handle Edit User Submit
 */
async function handleEditUser(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const userId = formData.get('user_id');
    const btn = document.querySelector(`button[type="submit"][form="${form.id}"]`);

    const updates = {
        full_name: formData.get('full_name'),
        region_id: formData.get('region_id'),
        office: formData.get('office'),
        designation: formData.get('designation'),
        role: formData.get('role'),
        status: formData.get('status')
    };

    // Validation
    const nameValidation = Validation.isRequired(updates.full_name, 'Full Name');
    if (!nameValidation.isValid) {
        window.toast.error(nameValidation.error);
        return;
    }

    btn.disabled = true;
    try {
        const { error } = await window._supabase
            .from(TABLES.USER)
            .update(updates)
            .eq('user_id', userId);

        if (error) throw error;

        if (window.toast) window.toast.success('User updated successfully');

        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        modal.hide();
        fetchUsers();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.handleEditUser',
            userMessage: 'Failed to update user'
        });
    } finally {
        btn.disabled = false;
    }
}

/**
 * Confirm and Handle Delete (Soft Delete)
 */
/**
 * Delete User Variables
 */
let userIdToDelete = null;

let userIdToActivate = null;

/**
 * Confirm Delete (Open Modal)
 */
window.confirmDeleteUser = function (userId) {
    userIdToDelete = userId;
    const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
    modal.show();
}

/**
 * Confirm Activate (Open Modal)
 */
window.confirmActivateUser = function (userId) {
    userIdToActivate = userId;
    const modal = new bootstrap.Modal(document.getElementById('activateUserModal'));
    modal.show();
}

/**
 * Handle Actual Delete & Activate
 */
document.addEventListener('DOMContentLoaded', () => {
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteUser);

    const activateBtn = document.getElementById('confirmActivateBtn');
    if (activateBtn) activateBtn.addEventListener('click', handleActivateUser);
});


async function handleDeleteUser() {
    // Prevent viewers from deleting users
    if (currentUserRole === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete users.', 'Access Denied');
        return;
    }

    if (!userIdToDelete) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;

    try {
        const { error } = await window._supabase
            .from(TABLES.USER)
            .update({ status: 'inactive' })
            .eq('user_id', userIdToDelete);

        if (error) throw error;

        if (window.toast) window.toast.success('User deactivated');

        // Hide modal
        const modalEl = document.getElementById('deleteUserModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        fetchUsers();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.handleDeleteUser',
            userMessage: 'Failed to deactivate user'
        });
    } finally {
        btn.disabled = false;
        userIdToDelete = null;
    }
}

async function handleActivateUser() {
    if (!userIdToActivate) return;

    const btn = document.getElementById('confirmActivateBtn');
    btn.disabled = true;

    try {
        const { error } = await window._supabase
            .from(TABLES.USER)
            .update({ status: 'active' })
            .eq('user_id', userIdToActivate);

        if (error) throw error;

        if (window.toast) window.toast.success('User activated');

        // Hide modal
        const modalEl = document.getElementById('activateUserModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        fetchUsers();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Users.handleActivateUser',
            userMessage: 'Failed to activate user'
        });
    } finally {
        btn.disabled = false;
        userIdToActivate = null;
    }
}

// Utilities
function showLoading(show) {
    const el = document.getElementById('loadingState');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function getInitials(name) {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// Note: Using Validation.escapeHtml from utils/validation.js instead of local function
