/**
 * script.js - Core Supabase Integration
 * 
 * This file initializes the Supabase client using configuration from config.js
 * Make sure config.js is loaded before this script.
 */

// Check if config is available
if (typeof window.CONFIG === 'undefined') {
    throw new Error('Configuration not loaded. Please ensure config.js is loaded before script.js');
}

const { createClient } = supabase;
const _supabase = createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);

// Make Supabase client globally available
window._supabase = _supabase;

// Utility to get current session
async function getSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session;
}

// Login function (used in login.html)
async function login(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Login failed: ' + error.message);
        return;
    }
    // Fetch user profile from dbo_user
    const { data: userProfile, error: profileError } = await _supabase
        .from('dbo_user')
        .select('*')
        .eq('user_id', data.user.id)
        .single();
    if (profileError) {
        alert('Error fetching profile: ' + profileError.message);
        return;
    }
    window.location.href = 'dashboard.html';  // Redirect to dashboard
}

/**
 * Secure logout utility function
 * Can be called from anywhere in the application
 */
async function logout() {
    try {
        // Sign out from Supabase
        if (window._supabase) {
            const { error } = await window._supabase.auth.signOut();
            if (error) {
                throw new Error(`Logout failed: ${error.message}`);
            }
        }

        // Clear all authentication-related data
        // Note: Auth token key is dynamic based on Supabase project ID
        const authKeys = [
            'userSession',
            'sidebarCollapsed'
        ];

        // Clear all Supabase auth tokens (pattern: sb-*-auth-token)
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        });

        authKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();

        // Redirect to login
        window.location.href = 'index.html';

        return true;
    } catch (error) {
        // Re-throw error for caller to handle
        throw error;
    }
}

/**
 * Fetch current user profile (Role & Region)
 * Uses sessionStorage caching to minimize DB calls
 */
async function getUserProfile() {
    const session = await getSession();
    if (!session) return null;

    // Check cache
    const cached = sessionStorage.getItem('userProfile');
    if (cached) return JSON.parse(cached);

    // Fetch from DB
    const { data, error } = await _supabase
        .from('dbo_user')
        .select('user_id, role, region_id, dbo_region(region_name)')
        .eq('user_id', session.user.id)
        .single();

    if (error) {
        // Error will be handled by calling code if needed
        return null;
    }

    // Cache it
    sessionStorage.setItem('userProfile', JSON.stringify(data));
    return data;
}

// Make globally available
window.getUserProfile = getUserProfile;

// Make logout function globally available
window.logout = logout;

// Session checking is now handled individually in each page