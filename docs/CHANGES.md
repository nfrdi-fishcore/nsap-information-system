# NSAP Information System - Recent Changes

This document tracks recent changes and updates to the system. For detailed changelog, see [CHANGELOG.md](../CHANGELOG.md).

---

## January 2025

### Sample Day Detail - Side-by-Side Data Containers
**Date**: January 2025  
**Type**: Feature Addition

**Description**:  
Added side-by-side containers below the summary card to display both gear unload and vessel unload data in a two-column layout.

**Changes Made**:
1. **Layout Structure**:
   - Updated `.data-containers` to use CSS Grid with two columns (`grid-template-columns: 1fr 1fr`)
   - Responsive: Stacks vertically on screens smaller than 992px
   - Equal width containers for balanced display

2. **Left Container - Gear Unload Data**:
   - Existing functionality maintained
   - Displays: Gear, Boats, Catch (kg)
   - Table structure unchanged

3. **Right Container - Vessel Unload Data**:
   - New container added with vessel unload table
   - Displays: Vessel, Effort (with unit), Catch Total (kg), Catch Sample (kg)
   - Data filtered by gear unload IDs for the current sample day

4. **Data Loading**:
   - `loadVesselUnloadData(unloadDayId)`: New function to load vessel unload data
   - First fetches all gear unload IDs for the sample day
   - Then fetches vessel unloads that reference those gear unload IDs
   - Includes related data: vessel name, fishing effort description
   - RBAC filtering maintained (region-based through gear unload relationship)

5. **Table Display**:
   - Vessel name from `dbo_vessel.vesselname`
   - Effort value with unit from `dbo_fishing_effort.fishing_effort`
   - Catch Total and Catch Sample formatted with 2 decimal places
   - Empty state messages for no data
   - Error handling with user-friendly messages

**Files Modified**:
- `sample-day-detail.html` - Updated layout CSS and added vessel unload table structure
- `src/assets/js/modules/sample-day-detail.js` - Added `loadVesselUnloadData()` function and updated `displayRecord()` to call it

**Status**: ✅ Completed

---

### Sample Day Detail - Edit Modal
**Date**: January 2025  
**Type**: Feature Addition

**Description**:  
Added edit functionality to the sample day detail page using a modal dialog, similar to the sampling day page. Users can now edit sampling day records directly from the detail page without redirecting.

**Changes Made**:
1. **Edit Modal**:
   - Added Bootstrap modal (`editModal`) with form fields
   - Fields: Date, Region, Landing Center, Fishing Ground, Sampling Day (auto-calculated), Remarks
   - Modal title: "Edit Sampling Day"
   - Save and Cancel buttons

2. **Reference Data Loading**:
   - Added `loadRegions()`, `loadLandingCenters()`, `loadFishingGrounds()` functions
   - RBAC filtering: Encoders and viewers only see their region's data
   - Data loaded on page initialization

3. **Dependent Dropdowns**:
   - `updateEditDependencies()` function filters Landing Center and Fishing Ground based on selected Region
   - Preserves existing values if they're valid within the filtered list
   - Clears dependent dropdowns when no region is selected

4. **Sample Day Calculation**:
   - `calculateSampleDay()` function calculates if a day is a sampling day
   - Logic: Based on date (day of month % 3) and landing center type (Commercial/Municipal)
   - Visual feedback: Green border/text for True, red for False
   - Auto-triggers on date or landing center change

5. **Edit Functionality**:
   - `openEditModal()`: Opens modal and populates with current record data
   - `saveEdit()`: Validates and saves changes to database
   - Full validation: Required fields, date validation
   - RBAC: Viewers cannot edit, encoders and admins can edit
   - Reloads record after successful save to show updated data

6. **Event Listeners**:
   - Edit button opens modal instead of redirecting
   - Region change updates dependent dropdowns
   - Date and Landing Center changes trigger sample day calculation
   - Save button triggers save function

**Files Modified**:
- `sample-day-detail.html` - Added edit modal HTML structure
- `src/assets/js/modules/sample-day-detail.js` - Added reference data loading, modal functions, dependent dropdowns, sample day calculation, and save functionality

**Status**: ✅ Completed

---

### Sample Day Detail - Button Placement & Styling
**Date**: January 2025  
**Type**: UI Enhancement

**Description**:  
Improved the appearance and positioning of action buttons (Back to List, Edit, Delete) within the summary card. Buttons are now positioned below the sampling day indicator with uniform width, proper colors, and enhanced styling.

**Changes Made**:
1. **Button Positioning**:
   - Buttons positioned below sampling day indicator within summary card
   - Separated with a border-top divider for visual clarity
   - Horizontal layout with uniform width (140px-200px range)

2. **Layout Structure**:
   - Summary card uses flexbox column layout
   - Top section: Summary information (Region, Landing Center, Fishing Ground, Date)
   - Middle section: Sampling day indicator
   - Bottom section: Action buttons with divider
   - Responsive: Buttons stack vertically on mobile devices

3. **Button Styling & Colors**:
   - **Back to List**: `btn-outline-light` - White outline on dark background
   - **Edit**: `btn-primary` - Blue (#3b82f6) for primary actions
   - **Delete**: `btn-danger` - Red (#ef4444) for destructive actions
   - Uniform width: `flex: 1` with `min-width: 140px` and `max-width: 200px`
   - Enhanced shadows: `0 2px 4px rgba(0, 0, 0, 0.15)` with hover effect `0 4px 12px rgba(0, 0, 0, 0.25)`
   - Smooth hover effects with `translateY(-2px)` transform
   - Icons and text properly aligned with flexbox

4. **Visual Improvements**:
   - Buttons have consistent spacing (0.75rem gap)
   - Proper icon sizing (1rem) with gap between icon and text
   - Better integration with the dark summary card background
   - Smooth transitions for all interactive elements
   - Active state feedback for better UX

**Files Modified**:
- `sample-day-detail.html` - Updated summary card structure, button placement, colors, and styling

**Status**: ✅ Completed

---

### Sample Day Detail - UI Updates
**Date**: January 2025  
**Type**: UI Enhancement

**Description**:  
Updated the summary card styling to match the sidebar color and removed the bottom form container to simplify the page layout.

**Changes Made**:
1. **Summary Card Styling**:
   - Changed background from gradient (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`) to solid sidebar color
   - New background: `rgba(0, 50, 100, 0.9)` - matches sidebar color scheme
   - Removed gradient effect for cleaner look

2. **Container Removal**:
   - Removed bottom form container (Details Card) completely
   - Removed right placeholder container
   - Gear unload table now displays full width (no side-by-side layout)

3. **Code Cleanup**:
   - Removed unused form-related JavaScript functions:
     - `loadRegions()`, `loadLandingCenters()`, `loadFishingGrounds()`
     - `populateDropdown()`, `updateDependencies()`, `calculateSampleDay()`
     - `enableEditMode()`, `cancelEdit()`, `saveRecord()`
   - Updated `displayRecord()` to only update summary card and load gear unload data
   - Updated `setupEventListeners()` - edit button now redirects to data entry page
   - Simplified `loadRecord()` to remove form element references

**Files Modified**:
- `sample-day-detail.html` - Updated summary card CSS, removed form container and right container
- `src/assets/js/modules/sample-day-detail.js` - Removed form-related functions, simplified display logic

**Status**: ✅ Completed

---

### Sample Day Detail - Summary Card and Data Tables
**Date**: January 2025  
**Type**: Feature Enhancement

**Description**:  
Added a summary card at the top of the detail page and two side-by-side data containers below, with the left container displaying gear unload data.

**Features**:
1. **Summary Card**:
   - Displays region, landing center, fishing ground, and sampling date
   - Shows sampling day indicator with check/cross icon
   - Text: "This day was a sampling day" or "This day was not a sampling day"
   - Gradient background with white text for visual appeal
   - Automatically populated when record is loaded

2. **Data Containers**:
   - Two side-by-side containers (responsive - stacks on mobile)
   - Left container: Gear Unload data table
     - Shows gear description, boats count, and catch (kg)
     - Filtered by `unload_day_id` (current sample day)
     - Displays loading state while fetching data
   - Right container: Placeholder for future content

3. **Gear Unload Table**:
   - Columns: Gear, Boats, Catch (kg)
   - Data fetched from `dbo_gear_unload` table
   - Filtered by `unload_day_id` matching the current sample day
   - Formatted numbers (boats as integers, catch with 2 decimal places)
   - Shows "No records found" message if empty

**Implementation**:
- Added `updateSummaryCard()` function to populate summary data
- Added `loadGearUnloadData()` function to fetch and display gear unload records
- Summary card hidden initially, shown when record is loaded
- Gear unload table shows loading spinner while fetching

**Files Modified**:
- `sample-day-detail.html` - Added summary card and data containers HTML/CSS
- `src/assets/js/modules/sample-day-detail.js` - Added summary and gear unload data loading functions

**Status**: ✅ Completed

---

### Sample Day Detail - Loading State
**Date**: January 2025  
**Type**: UX Enhancement

**Description**:  
Added a loading state to the sample day detail page to provide visual feedback while the record data is being fetched.

**Features**:
1. **Loading Overlay**:
   - Full overlay covering the content card
   - Semi-transparent white background (95% opacity)
   - Centered spinner animation
   - Loading text: "Loading record details..."

2. **Visual Feedback**:
   - Form opacity reduced to 50% during loading
   - Smooth transitions when loading state appears/disappears
   - Loading state shown immediately when page loads
   - Loading state hidden when record is loaded or error occurs

3. **Implementation**:
   - Loading overlay added to HTML with CSS animations
   - Loading state managed in `loadRecord()` function
   - Initial loading state shown in DOMContentLoaded
   - Error handling includes hiding loading state

**Files Modified**:
- `sample-day-detail.html` - Added loading overlay HTML and CSS
- `src/assets/js/modules/sample-day-detail.js` - Added loading state management

**Status**: ✅ Completed

---

### Data Entry - Role-Based Permissions
**Date**: January 2025  
**Type**: Security & Access Control

**Description**:  
Implemented comprehensive role-based access control for data entry operations, ensuring users can only perform actions appropriate to their role.

**Permission Matrix**:
1. **Viewer Role**:
   - ✅ Can view records
   - ❌ Cannot add records
   - ❌ Cannot edit records
   - ❌ Cannot delete records
   - "New Record" button is hidden
   - All edit/delete buttons are hidden

2. **Encoder Role**:
   - ✅ Can view records
   - ✅ Can add new records
   - ✅ Can edit existing records
   - ❌ Cannot delete records
   - "New Record" button is visible
   - Edit button is visible
   - Delete button is hidden

3. **Admin/Superadmin Roles**:
   - ✅ Can view records
   - ✅ Can add new records
   - ✅ Can edit existing records
   - ✅ Can delete records
   - All buttons are visible

**Implementation Details**:
1. **Data Entry Page (`data-entry.js`)**:
   - Hide "New Record" button for viewers
   - Updated `saveRecord()` to allow encoders (but not viewers)
   - Updated `openNewRecordModal()` to check permissions
   - Delete button already restricted to admins

2. **Detail Page (`sample-day-detail.js`)**:
   - Updated `enableEditMode()` to allow encoders (but not viewers)
   - Updated `saveRecord()` to allow encoders (but not viewers)
   - Delete button only visible to admins
   - Edit button visible to admins and encoders

**Files Modified**:
- `src/assets/js/modules/data-entry.js` - Updated permission checks for add/edit operations
- `src/assets/js/modules/sample-day-detail.js` - Updated permission checks for edit/delete operations

**Status**: ✅ Completed

---

### Data Entry Page - UI and RBAC Updates
**Date**: January 2025  
**Type**: UI Enhancement & Security

**Description**:  
Removed the "Filters" heading from the filter container and enforced strict region-based access control for encoders.

**Changes Made**:
1. **UI Update**:
   - Removed "Filters" heading from the filter container
   - Filter section now displays directly without a title

2. **Encoder Access Control**:
   - Encoders can only view data from their assigned region
   - Region filter dropdown is hidden for encoders (since they can only see their region)
   - Added explicit encoder role checks in all data loading functions
   - Added safety check in `applyFilters()` to ensure encoders only see their region's data

3. **RBAC Implementation**:
   - Updated `loadSampleDays()` to explicitly check for encoder/viewer roles
   - Updated `loadRegions()` to restrict encoders to their region
   - Updated `loadLandingCenters()` to restrict encoders to their region
   - Updated `loadFishingGrounds()` to restrict encoders to their region
   - Added region filter visibility control based on user role

**Files Modified**:
- `data-entry.html` - Removed "Filters" heading, added ID to region filter group
- `src/assets/js/modules/data-entry.js` - Updated RBAC checks and filter visibility

**Status**: ✅ Completed

---

### Data Entry Filters - Placeholder Text
**Date**: January 2025  
**Type**: UI Enhancement

**Description**:  
Updated filter dropdown placeholders to clearly show "All Regions", "All Landing Centers", and "All Fishing Grounds" when no specific filter is selected or when showing all data.

**Changes Made**:
1. **Placeholder Text**:
   - Region filter: Shows "All Regions" when empty
   - Landing Center filter: Shows "All Landing Centers" when empty
   - Fishing Ground filter: Shows "All Fishing Grounds" when empty

2. **Functionality**:
   - Placeholders appear when no specific item is selected
   - Placeholders appear when showing all data (no filter applied)
   - Updated `populateDropdown()` function to accept custom "All" option text parameter
   - Ensures "All..." option is properly selected when value is empty

3. **Implementation**:
   - Added `allOptionText` parameter to `populateDropdown()` function
   - Updated all filter dropdown population calls to use specific placeholder text
   - Maintains placeholder text when filters are reset or cleared

**Files Modified**:
- `src/assets/js/modules/data-entry.js` - Updated populateDropdown function and all filter calls

**Status**: ✅ Completed

---

### Sampling Day Icons Display
**Date**: January 2025  
**Type**: UI Enhancement

**Description**:  
Updated the sampling day column to display visual icons instead of text values for better user experience.

**Changes Made**:
1. **Icon Display**:
   - Check icon (green) for True values - uses `bi-check-circle-fill` with green color
   - Cross/X icon (red) for False values - uses `bi-x-circle-fill` with red color
   - Icons are centered in the table cell

2. **Value Handling**:
   - Properly handles boolean values (true/false)
   - Properly handles string values ("True"/"False", "true"/"false")
   - Defaults to cross icon for null/undefined values

3. **Files Updated**:
   - `src/assets/js/modules/data-entry.js` - Updated renderTable function
   - `src/assets/js/modules/sample-days.js` - Updated renderTable function

**Visual Changes**:
- Before: Text display showing "True" or "False"
- After: Visual icons (✓ for True, ✗ for False)

**Status**: ✅ Completed

---

### Data Entry Page - View Button Redirect
**Date**: January 2025  
**Type**: Feature Change

**Description**:  
Changed the View button behavior to redirect to a dedicated detail page instead of showing a modal popup.

**Changes Made**:
1. **New Detail Page**:
   - Created `sample-day-detail.html` - A dedicated page for viewing and editing individual sampling day records
   - Created `src/assets/js/modules/sample-day-detail.js` - JavaScript logic for the detail page
   - Page includes full form layout with all record fields
   - Supports view mode (read-only) and edit mode (for administrators)

2. **View Button Update**:
   - Changed View button from `onclick="viewRecord(id)"` to a link `<a href="sample-day-detail.html?id={id}">`
   - Removed `viewRecord()` function from `data-entry.js`
   - View button now redirects to detail page with record ID in URL query parameter

3. **Detail Page Features**:
   - Displays all record information in a clean form layout
   - Edit button (for administrators) to enable edit mode
   - Delete button (for administrators) with confirmation modal
   - Back button to return to data entry list
   - Auto-calculated sampling day with visual icons
   - Region-dependent dropdowns for Landing Center and Fishing Ground
   - Proper RBAC enforcement

**Files Created**:
- `sample-day-detail.html`
- `src/assets/js/modules/sample-day-detail.js`

**Files Modified**:
- `src/assets/js/modules/data-entry.js` - Removed viewRecord function, updated View button to link

**Status**: ✅ Completed

---

### Data Entry Page - Dropdown Dependency Fix
**Date**: January 2025  
**Type**: Bug Fix

**Description**:  
Fixed Landing Center and Fishing Ground dropdowns to be properly dependent on the selected region in the modal. Both dropdowns now correctly filter based on the selected region.

**Issues Fixed**:
1. Dropdowns not filtering based on selected region
2. Dropdowns showing all items instead of region-filtered items
3. Dropdowns not updating when region changes
4. Initial population showing all items instead of being empty

**Changes Made**:
1. **Initial Population**:
   - Modal dropdowns now start empty (not populated with all items)
   - Show "Select a region first" message when no region is selected
   - Only populate when a region is selected

2. **Region Dependency**:
   - Landing Center dropdown filters by selected region
   - Fishing Ground dropdown filters by selected region
   - Both dropdowns clear when region is cleared
   - Event listener properly triggers `updateModalDependencies()` on region change

3. **Data Type Handling**:
   - All ID comparisons converted to strings to handle number/string mismatches
   - Improved filtering logic with explicit string conversion

4. **User Experience**:
   - Clear messaging when region must be selected first
   - Proper value preservation when viewing/editing records
   - Dropdowns update immediately when region changes

**Files Modified**:
- `src/assets/js/modules/data-entry.js` - Complete dropdown dependency implementation

**Status**: ✅ Completed

---

### Data Entry Page Implementation
**Date**: January 2025  
**Type**: Feature Addition

**Description**:  
Created a comprehensive data entry page for managing and viewing sampling day records with advanced filtering, pagination, and CRUD operations.

**Features Implemented**:
1. **Filtering System**:
   - Region filter dropdown
   - Landing Center filter (updates based on selected region)
   - Fishing Ground filter (updates based on selected region)
   - Real-time filtering of table data

2. **Table Display**:
   - Date column (formatted)
   - Sampling Day column (check/cross icons instead of true/false)
   - Landing Center column
   - Fishing Ground column
   - Action column (View, Delete buttons)

3. **Pagination**:
   - Configurable rows per page (10, 25, 50, 100)
   - Page navigation with Previous/Next buttons
   - Page number display with ellipsis for large page counts
   - Shows "Showing X to Y of Z entries"

4. **Actions**:
   - View button (opens modal with record details)
   - Delete button (only visible to superadmin/admin)
   - Refresh List button
   - New Record button (opens modal to create new record)

5. **RBAC Implementation**:
   - Region-based filtering for encoder/viewer roles
   - Delete action restricted to superadmin/admin
   - Save/Edit restricted to administrators

6. **Sampling Day Calculation**:
   - Auto-calculates sampling day based on date and landing center type
   - Visual feedback with True/False display

**Files Created**:
- `data-entry.html` - Main page structure
- `src/assets/js/modules/data-entry.js` - Complete functionality

**Files Modified**:
- `src/assets/js/core/components.js` - Navigation link already added

**Status**: ✅ Completed

---

### Navigation Enhancement - NSAP Data Entry
**Date**: January 2025  
**Type**: Feature Addition

**Description**:  
Added a new navigation item "NSAP Data Entry" in the sidebar navigation, positioned directly below the Dashboard.

**Changes Made**:
- Added new navigation link in `src/assets/js/core/components.js`
- Navigation item uses icon `bi-clipboard-data`
- Simple link (no submenu) that redirects to `data-entry.html`
- Follows same styling and behavior as other navigation items

**Files Modified**:
- `src/assets/js/core/components.js` - Added NSAP Data Entry navigation item

**Status**: ✅ Completed

---

### Folder Structure Reorganization
**Date**: January 2025  
**Type**: Refactoring

**Description**:  
Complete reorganization of project folder structure for better organization and maintainability.

**Changes Made**:
1. **Source Files**:
   - Moved assets to `src/assets/` with organized subdirectories
   - CSS organized into `components/`, `pages/`, and `main.css`
   - JavaScript organized into `core/`, `modules/`, `services/`, and `utils/`
   - Images moved to `src/assets/images/`
   - Components moved to `src/components/`

2. **Documentation**:
   - Organized into `docs/guides/`, `docs/reviews/`, `docs/security/`
   - Created `docs/archive/` for historical documentation

3. **Test Files**:
   - Moved to `tests/` directory

4. **File Path Updates**:
   - Updated all HTML files to use new `src/assets/` paths
   - Fixed background image paths in CSS files

**Files Modified**:
- All 15 HTML files in root directory
- All CSS files (paths updated)
- `pages/notification-demo.html`

**Files Created**:
- `STRUCTURE.md` - Comprehensive folder structure documentation
- `docs/archive/` - Directory for archived documentation

**Status**: ✅ Completed

---

### Background Image Path Fixes
**Date**: January 2025  
**Type**: Bug Fix

**Description**:  
Fixed background image paths in CSS files after folder reorganization.

**Changes Made**:
- Updated `src/assets/css/components/sidebar.css` - Changed path from `../images/` to `../../images/`
- Updated `src/assets/css/pages/landing.css` - Changed path from `../images/` to `../../images/`
- Verified `src/assets/css/main.css` - Path already correct

**Files Modified**:
- `src/assets/css/components/sidebar.css`
- `src/assets/css/pages/landing.css`

**Status**: ✅ Completed

---

## Documentation Organization

### Files Consolidated
- `PHASE1_COMPLETE.md` and `PHASE1_FINAL.md` → Merged and archived
- `REORGANIZATION_SUMMARY.md` → Archived (information merged into STRUCTURE.md)

### Root Folder Cleanup
**Kept in Root**:
- `README.md` - Main project documentation
- `DEVELOPMENT_PLAN.md` - Development roadmap
- `CHANGELOG.md` - Detailed changelog
- `STRUCTURE.md` - Folder structure documentation
- `CHECKLIST.md` - Development checklist

**Moved to Archive**:
- `PHASE1_COMPLETE.md`
- `PHASE1_FINAL.md`
- `REORGANIZATION_SUMMARY.md`

---

**Last Updated**: January 2025

