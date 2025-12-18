/**
 * NSAP Information System - Constants
 * 
 * Centralized constants to avoid magic strings throughout the codebase
 */

// User Roles
const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    ENCODER: 'encoder',
    VIEWER: 'viewer'
};

// Database Table Names
const TABLES = {
    USER: 'dbo_user',
    REGION: 'dbo_region',
    FISHING_GROUND: 'dbo_fishing_ground',
    LANDING_CENTER: 'dbo_landing_center',
    SAMPLE_DAY: 'dbo_LC_FG_sample_day', // Note: Actual table name
    FISHING_EFFORT: 'dbo_fishing_effort',
    GEAR: 'dbo_gear',
    VESSEL: 'dbo_vessel',
    GEAR_UNLOAD: 'dbo_gear_unload',
    VESSEL_UNLOAD: 'dbo_vessel_unload',
    SPECIES: 'dbo_species',
    VESSEL_CATCH: 'dbo_vessel_catch',
    SAMPLE_LENGTHS: 'dbo_sample_lengths'
};

// Local Storage Keys
const STORAGE_KEYS = {
    USER_SESSION: 'userSession',
    USER_PROFILE: 'userProfile',
    SIDEBAR_COLLAPSED: 'sidebarCollapsed',
    REMEMBER_ME: 'rememberMe',
    SAVED_EMAIL: 'savedEmail'
};

// Supabase Auth Token Key Pattern
// Note: This is dynamic based on project ID, but we include the pattern
const AUTH_TOKEN_KEY_PATTERN = 'sb-*-auth-token';

// Allowed Roles for Admin Functions
const ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];

// Allowed Roles for Data Entry
const DATA_ENTRY_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.ENCODER];

// Allowed Roles for Viewing
const VIEWER_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.ENCODER, ROLES.VIEWER];

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.ROLES = ROLES;
    window.TABLES = TABLES;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.ADMIN_ROLES = ADMIN_ROLES;
    window.DATA_ENTRY_ROLES = DATA_ENTRY_ROLES;
    window.VIEWER_ROLES = VIEWER_ROLES;
}

