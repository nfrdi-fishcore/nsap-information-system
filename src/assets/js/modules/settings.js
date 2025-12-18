/**
 * Settings Page Logic
 * 
 * Phase 1: Applied error handler, constants, and validation
 */

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    // Event Listeners
    document.getElementById('avatarInput').addEventListener('change', handleAvatarSelect);
    document.getElementById('removeAvatarBtn').addEventListener('click', handleRemoveAvatar);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);

    // Modal confirm button
    const confirmBtn = document.getElementById('confirmPasswordChangeBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirmPasswordChange);
});

let currentAvatarFile = null;
let currentAvatarUrl = null;
let pendingPasswordData = null; // Store password data pending confirmation

// Helper to show/hide global loading
function showGlobalLoading(show) {
    const el = document.getElementById('globalLoading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

/**
 * Load Current User Profile
 */
async function loadProfile() {
    showGlobalLoading(true);
    try {
        const session = await getSession();
        if (!session) return;

        const { data: user, error } = await window._supabase
            .from(TABLES.USER)
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (error) throw error;

        // Populate Form
        const form = document.getElementById('profileForm');
        form.querySelector('[name="full_name"]').value = user.full_name || '';
        form.querySelector('[name="email"]').value = user.email || '';

        const roleDisplay = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
        form.querySelector('[name="role_display"]').value = roleDisplay;

        // Handle Avatar
        if (user.user_img) {
            currentAvatarUrl = user.user_img;
            showAvatarPreview(user.user_img);
        } else {
            showAvatarPlaceholder();
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Settings.loadProfile',
            userMessage: 'Failed to load profile'
        });
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Handle Avatar File Selection
 */
function handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        ErrorHandler.showError('Please select an image file.', {
            userMessage: 'Only image files are allowed.'
        });
        e.target.value = '';
        return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
        ErrorHandler.showError('File is too large. Maximum size is 2MB.', {
            userMessage: 'File size must be less than 2MB.'
        });
        e.target.value = '';
        return;
    }

    currentAvatarFile = file;

    // Show local preview
    const reader = new FileReader();
    reader.onload = function (e) {
        showAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

function showAvatarPreview(src) {
    const img = document.getElementById('avatarPreview');
    const placeholder = document.getElementById('avatarPlaceholder');
    const removeBtn = document.getElementById('removeAvatarBtn');

    img.src = src;
    img.classList.remove('d-none');
    placeholder.classList.add('d-none');
    removeBtn.classList.remove('d-none');
}

function showAvatarPlaceholder() {
    const img = document.getElementById('avatarPreview');
    const placeholder = document.getElementById('avatarPlaceholder');
    const removeBtn = document.getElementById('removeAvatarBtn');
    const input = document.getElementById('avatarInput');

    img.src = '';
    img.classList.add('d-none');
    placeholder.classList.remove('d-none');
    removeBtn.classList.add('d-none');

    // Reset inputs
    input.value = '';
    currentAvatarFile = null;
    currentAvatarUrl = null;
}

function handleRemoveAvatar() {
    // Mark avatar for removal
    currentAvatarFile = null;
    currentAvatarUrl = null;
    showAvatarPlaceholder();
}

/**
 * Handle Profile Update
 */
async function handleProfileUpdate(e) {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    const formData = new FormData(e.target);
    const fullName = formData.get('full_name').trim();

    // Validation
    const nameValidation = Validation.isRequired(fullName, 'Full Name');
    if (!nameValidation.isValid) {
        window.toast.error(nameValidation.error);
        return;
    }

    const lengthValidation = Validation.validateLength(fullName, 1, 255, 'Full Name');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    btn.disabled = true;
    showGlobalLoading(true);

    try {
        const session = await getSession();
        let avatarUrl = currentAvatarUrl; // Default to existing URL or null

        // 1. Upload new avatar if selected
        if (currentAvatarFile) {
            const fileExt = currentAvatarFile.name.split('.').pop();
            const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload
            const { error: uploadError } = await window._supabase.storage
                .from('avatars')
                .upload(filePath, currentAvatarFile);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = window._supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            avatarUrl = publicUrl;
        }

        // 2. Update dbo_user
        // If removing avatar, set to null
        const updates = {
            full_name: fullName
        };
        
        // Only update avatar if we have a new one or explicitly removing
        if (currentAvatarFile) {
            updates.user_img = avatarUrl;
        } else if (currentAvatarFile === null && !currentAvatarUrl) {
            // User clicked remove - set to null
            updates.user_img = null;
        }

        const { error: updateError } = await window._supabase
            .from(TABLES.USER)
            .update(updates)
            .eq('user_id', session.user.id);

        if (updateError) throw updateError;

        window.toast.success('Profile updated successfully');

        // Refresh sidebar info if component is loaded
        if (window.Components && window.Components.loadUserInfo) {
            window.Components.loadUserInfo();
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Settings.handleProfileUpdate',
            userMessage: 'Failed to update profile'
        });
    } finally {
        btn.disabled = false;
        showGlobalLoading(false);
    }
}

/**
 * Handle Password Submit (Step 1: Validation & Modal)
 */
function handlePasswordSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const currentPassword = formData.get('current_password');
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');

    // Validation
    const currentPasswordValidation = Validation.isRequired(currentPassword, 'Current Password');
    if (!currentPasswordValidation.isValid) {
        window.toast.error(currentPasswordValidation.error);
        return;
    }

    // Validate password (minimum 6 characters for basic validation)
    const passwordValidation = Validation.validatePassword(newPassword, { 
        minLength: 6, 
        requireUppercase: false, 
        requireLowercase: false, 
        requireNumber: false, 
        requireSpecial: false 
    });
    if (!passwordValidation.isValid) {
        window.toast.error(passwordValidation.errors[0] || 'Password must be at least 6 characters long.');
        return;
    }

    if (newPassword !== confirmPassword) {
        ErrorHandler.showError('New passwords do not match.', {
            userMessage: 'New password and confirmation must match.'
        });
        return;
    }

    if (newPassword === currentPassword) {
        ErrorHandler.showError('New password cannot be the same as the current password.', {
            userMessage: 'Please choose a different password.'
        });
        return;
    }

    // Store data for confirmation step
    pendingPasswordData = {
        currentPassword,
        newPassword
    };

    // Show confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('passwordConfirmModal'));
    modal.show();
}

/**
 * Handle Confirm Password Change (Step 2: Verification & Update)
 */
async function handleConfirmPasswordChange() {
    if (!pendingPasswordData) return;

    const btn = document.getElementById('confirmPasswordChangeBtn');
    btn.disabled = true;
    showGlobalLoading(true);

    try {
        const session = await getSession();
        const email = session.user.email;

        // 1. Verify Current Password by re-authenticating
        const { error: signInError } = await window._supabase.auth.signInWithPassword({
            email: email,
            password: pendingPasswordData.currentPassword
        });

        if (signInError) {
            throw new Error('Incorrect current password.');
        }

        // 2. Update to New Password
        const { error: updateError } = await window._supabase.auth.updateUser({
            password: pendingPasswordData.newPassword
        });

        if (updateError) throw updateError;

        // Success
        const modalEl = document.getElementById('passwordConfirmModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        window.toast.success('Password updated! Please log in again.');

        // Force logout
        await window.logout();

    } catch (error) {
        // Clean error message
        const userMessage = error.message === 'Invalid login credentials' || error.message.includes('password') 
            ? 'Incorrect current password. Please try again.' 
            : 'Failed to update password. Please try again.';

        ErrorHandler.handle(error, {
            context: 'Settings.handleConfirmPasswordChange',
            userMessage: userMessage
        });

        // Close modal on error to let user fix input
        const modalEl = document.getElementById('passwordConfirmModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

    } finally {
        btn.disabled = false;
        showGlobalLoading(false);
        pendingPasswordData = null;
    }
}
