/**
 * NSAP Information System - Configuration
 * 
 * WARNING: This file contains sensitive credentials.
 * It is excluded from version control via .gitignore
 * 
 * To set up:
 * 1. Copy config.js.example to config.js
 * 2. Replace placeholder values with your actual Supabase credentials
 */

const CONFIG = {
    SUPABASE_URL: 'https://vidhefbvribdzlrqmtgv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZGhlZmJ2cmliZHpscnFtdGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTQ5NTEsImV4cCI6MjA4MDk5MDk1MX0.tBY6ePajzRqCWkTzzsYbuwuOEfP0uCKXL6eiX6XO0Cw'
};

// Make config available globally
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

