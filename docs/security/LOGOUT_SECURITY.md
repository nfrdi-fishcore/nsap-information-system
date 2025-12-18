# Logout Functionality - Security Guide

## Overview
The NSAP Information System implements secure logout functionality with comprehensive session cleanup and proper authentication token management.

## Logout Features

### ✅ Security Measures
1. **Supabase Sign Out** - Properly terminates server-side session
2. **Local Storage Cleanup** - Removes all authentication tokens
3. **Session Storage Cleanup** - Clears temporary session data
4. **Token Removal** - Deletes Supabase auth tokens
5. **Confirmation Dialog** - Prevents accidental logout
6. **Error Handling** - Graceful failure with user feedback

### ✅ User Experience
- Confirmation dialog before logout
- Visual feedback (button disabled during logout)
- Success notification
- Smooth redirect to login page
- Error notifications if logout fails

## Implementation

### Method 1: Sidebar Logout Button
The sidebar component includes a logout button that handles the entire logout process:

```javascript
// Automatically initialized when sidebar loads
Components.initSidebar();
```

**What it does:**
1. Shows confirmation dialog
2. Disables logout button (prevents double-click)
3. Signs out from Supabase
4. Clears localStorage keys:
   - `userSession`
   - `rememberMe`
   - `sidebarCollapsed`
   - `sb-vidhefbvribdzlrqmtgv-auth-token` (Supabase token)
5. Clears all sessionStorage
6. Shows success notification
7. Redirects to login page

### Method 2: Global Logout Function
A global `logout()` function is available for programmatic logout:

```javascript
// Call from anywhere in your application
try {
    await window.logout();
    // User is now logged out
} catch (error) {
    console.error('Logout failed:', error);
}
```

**Use cases:**
- Session timeout
- Forced logout
- Security events
- Custom logout buttons

## Security Best Practices

### What Gets Cleared

#### localStorage
- `userSession` - User session data
- `rememberMe` - Remember me preference
- `sidebarCollapsed` - UI state (optional, but cleared for security)
- `sb-vidhefbvribdzlrqmtgv-auth-token` - Supabase authentication token

#### sessionStorage
- All session storage is cleared

#### Supabase
- Server-side session terminated via `auth.signOut()`

### What Doesn't Get Cleared
- Browser cookies (if any)
- IndexedDB (if used)
- Service worker cache (if implemented)

**Note:** For maximum security in production, consider also clearing these if your application uses them.

## Error Handling

### Logout Failures
If logout fails:
1. Error is logged to console
2. User sees error notification
3. Logout button is re-enabled
4. User can retry

### Network Issues
If network is unavailable:
1. Supabase signOut may fail
2. Local data is still cleared
3. User is redirected to login
4. Server session will expire naturally

## Testing Logout

### Manual Test
1. Log in to the application
2. Navigate to dashboard
3. Click logout button in sidebar
4. Confirm logout in dialog
5. Verify redirect to login page
6. Try accessing dashboard directly
7. Should be redirected back to login

### Programmatic Test
```javascript
// In browser console
await window.logout();
```

## Session Validation

### On Page Load
Every authenticated page should check session:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const session = await getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    // Continue loading page
});
```

### Automatic Logout Scenarios
- Session expires (Supabase default: 1 hour)
- Invalid token detected
- User deleted from database
- Manual logout

## Integration with Login

### Remember Me Feature
If "Remember Me" was checked during login:
- Cleared on logout
- User must re-enter credentials
- Enhances security

### Post-Logout Redirect
After logout:
1. User redirected to `login.html`
2. Can log in again with credentials
3. Fresh session created
4. All data reloaded

## Troubleshooting

### Logout Button Not Working
**Check:**
1. Is `components.js` loaded?
2. Is sidebar initialized?
3. Check browser console for errors
4. Verify Supabase connection

### Still Logged In After Logout
**Check:**
1. Clear browser cache
2. Check if localStorage was cleared
3. Verify Supabase signOut was called
4. Check for multiple tabs (sessions may persist)

### Error: "Logout failed"
**Possible causes:**
1. Network connection lost
2. Supabase service unavailable
3. Invalid session token
4. Browser blocking localStorage access

**Solution:**
- Retry logout
- Clear browser data manually
- Close all tabs and reopen

## Production Recommendations

### Additional Security
1. **Session Timeout**: Implement automatic logout after inactivity
2. **Token Refresh**: Handle token refresh failures
3. **Concurrent Sessions**: Limit number of active sessions
4. **Audit Logging**: Log all logout events
5. **HTTPS Only**: Ensure all traffic is encrypted

### Example: Auto Logout on Inactivity
```javascript
let inactivityTimer;
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
        if (window.toast) {
            window.toast.warning('Session expired due to inactivity');
        }
        await window.logout();
    }, INACTIVITY_TIMEOUT);
}

// Reset timer on user activity
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
});

// Start timer
resetInactivityTimer();
```

## Summary

The logout functionality is:
- ✅ **Secure** - Clears all authentication data
- ✅ **User-friendly** - Confirmation and notifications
- ✅ **Robust** - Error handling and recovery
- ✅ **Flexible** - Multiple implementation methods
- ✅ **Production-ready** - Follows best practices

Users can safely logout knowing their session is completely terminated and all sensitive data is cleared from the browser.
