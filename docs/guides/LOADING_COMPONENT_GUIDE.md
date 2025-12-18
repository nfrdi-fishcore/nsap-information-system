# Unified Loading Component Guide

## Overview

The NSAP Information System now uses a unified loading component that provides consistent loading states across all pages. The loading component ensures that:

- Only the main content area is blurred during loading (sidebar remains visible)
- Consistent visual appearance across all pages
- Easy-to-use JavaScript API for managing loading states
- Support for different loading scenarios (full page, inline, table, card, button)

## Files

- **CSS**: `src/assets/css/components/loading.css`
- **JavaScript**: `src/assets/js/utils/loading.js`

## Usage

### 1. Include Required Files

Add to your HTML file:

```html
<!-- In <head> -->
<link rel="stylesheet" href="src/assets/css/components/loading.css">

<!-- Before your module script -->
<script src="src/assets/js/utils/loading.js"></script>
```

### 2. Full Page Loading (Main Content Only)

Use this for initial page loads or major data fetching operations:

```javascript
// Show loading
LoadingManager.showFullPage('Loading data...');

// Hide loading
LoadingManager.hideFullPage();
```

**Example:**
```javascript
async function loadData() {
    LoadingManager.showFullPage('Loading analytics data...');
    try {
        const data = await fetchData();
        // Process data...
    } finally {
        LoadingManager.hideFullPage();
    }
}
```

### 3. Inline Loading (Containers)

Use this for loading states within specific containers:

```javascript
const container = document.getElementById('myContainer');
LoadingManager.showInline(container, 'Loading content...');
```

### 4. Table Loading

Use this for table loading states:

```javascript
const tableBody = document.getElementById('tableBody');
LoadingManager.showTable(tableBody, 5, 'Loading records...'); // 5 = number of columns
```

### 5. Card Loading

Use this for card/panel loading states:

```javascript
const card = document.getElementById('myCard');
LoadingManager.showCard(card, 'Loading card data...');

// Hide when done
LoadingManager.hideCard(card);
```

### 6. Button Loading

Use this to show loading state on buttons:

```javascript
const button = document.getElementById('submitBtn');
LoadingManager.showButton(button);

// Hide when done
LoadingManager.hideButton(button);
```

### 7. Small Spinner

Create a small inline spinner element:

```javascript
const spinner = LoadingManager.createSpinner();
container.appendChild(spinner);
```

## Migration Guide

### Before (Old Pattern):
```javascript
// Old way - inconsistent across pages
const overlay = document.getElementById('loadingOverlay');
overlay.classList.remove('hidden');
// ... later
overlay.classList.add('hidden');
```

### After (New Pattern):
```javascript
// New way - unified and consistent
LoadingManager.showFullPage('Loading...');
// ... later
LoadingManager.hideFullPage();
```

## Features

1. **Sidebar Preservation**: The loading overlay only covers the main content area, keeping the sidebar visible and functional
2. **Blur Effect**: Main content is blurred during loading for better visual feedback
3. **Consistent Styling**: All loading states use the same spinner, colors, and animations
4. **Responsive**: Automatically adjusts for mobile devices
5. **Accessible**: Proper ARIA attributes and semantic HTML

## Examples

### Example 1: Page Initialization
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    LoadingManager.showFullPage('Initializing page...');
    try {
        await loadUserData();
        await loadTableData();
    } finally {
        LoadingManager.hideFullPage();
    }
});
```

### Example 2: Table Data Loading
```javascript
async function loadTable() {
    const tbody = document.getElementById('dataTableBody');
    LoadingManager.showTable(tbody, 4, 'Loading records...');
    
    try {
        const data = await fetchData();
        renderTable(tbody, data);
    } catch (error) {
        ErrorHandler.handle(error);
    }
}
```

### Example 3: Form Submission
```javascript
async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    
    LoadingManager.showButton(submitBtn);
    try {
        await submitForm();
        window.toast.success('Form submitted successfully');
    } catch (error) {
        ErrorHandler.handle(error);
    } finally {
        LoadingManager.hideButton(submitBtn);
    }
}
```

## Best Practices

1. **Always use try/finally**: Ensure loading state is hidden even if errors occur
2. **Provide meaningful messages**: Use descriptive loading messages
3. **Use appropriate method**: Choose the right loading method for your use case
4. **Don't overuse**: Only show loading for operations that take noticeable time (>200ms)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS filters and animations are used (IE11 not supported)

