# NSAP Information System - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Reports Module - Complete Implementation**: Implemented comprehensive Reports Module with all four report types
  - **Monthly Report** (`reports-monthly.html`, `src/assets/js/modules/reports-monthly.js`):
    - Date range selection with required validation
    - Optional filters: Region, Landing Center, Fishing Ground
    - Summary cards: Total Catch, Sampling Days, Vessels, Species
    - Charts: Monthly catch trends (line chart), Top 10 species (bar chart)
    - Data tables: Monthly breakdown, Top species, Top landing centers, Top fishing grounds
    - Export functionality: CSV, Excel, PDF
    - Instruction modal with 4-step guide
    - Date: January 2025
  - **Regional Report** (`reports-regional.html`, `src/assets/js/modules/reports-regional.js`):
    - Date range selection
    - Multi-region selection with custom checkbox dropdown (admins can select multiple)
    - Summary cards: Total Catch, Sampling Days, Vessels, Regions
    - Charts: Regional comparison (bar chart), Regional distribution (doughnut chart)
    - Data tables: Regional rankings, Detailed breakdown per region
    - Export functionality: CSV, Excel, PDF
    - Instruction modal with 4-step guide
    - Date: January 2025
  - **Species Report** (`reports-species.html`, `src/assets/js/modules/reports-species.js`):
    - Date range selection
    - Optional filters: Region, Gear Type
    - Multi-species selection with custom checkbox dropdown
    - Summary cards: Total Catch, Species Count, Vessels
    - Charts: Species catch volume (bar chart), Species trends over time (line chart)
    - Data tables: Species data, Regional distribution, Gear distribution
    - Export functionality: CSV, Excel, PDF
    - Instruction modal with 4-step guide
    - Date: January 2025
  - **Custom Report Builder** (`reports-custom.html`, `src/assets/js/modules/reports-custom.js`):
    - Date range and region selection
    - Field selection interface (11 available fields: Date, Region, Landing Center, Fishing Ground, Vessel, Gear, Species, Catch Volume, Effort, Sampling Day, Vessels Count)
    - Dynamic filter builder with type-aware operators (equals, contains, greater than, less than, etc.)
    - Grouping and sorting options
    - Template system: Save, load, and delete templates (localStorage persistence)
    - Preview table with record count
    - Export functionality: CSV, Excel, PDF
    - Tooltips for save/delete template buttons
    - Instruction modal with 5-step guide
    - Date: January 2025
  - **Reports Service Layer** (`src/assets/js/services/reportsService.js`):
    - `getMonthlyReportData()`: Fetches and aggregates monthly report data
    - `getRegionalReportData()`: Fetches comparative regional data
    - `getSpeciesReportData()`: Fetches species-focused analysis data
    - `getCustomReportData()`: Flexible query builder with filtering, grouping, and sorting
    - `validateReportParams()`: Parameter validation
    - RBAC filtering integrated throughout
    - Optimized queries with early filtering
    - Date: January 2025
  - **Report Export Utility** (`src/assets/js/utils/reportExport.js`):
    - `exportToCSV()`: CSV export functionality
    - `exportToExcel()`: Excel export using SheetJS
    - `exportToPDF()`: PDF export using jsPDF
    - Comprehensive error handling and user feedback
    - Date: January 2025
  - **Reports Module Documentation** (`docs/guides/REPORTS_MODULE_DEVELOPMENT_PLAN.md`):
    - Complete development plan for Reports Module
    - Report types, technical architecture, implementation phases
    - Features, security, and dependencies documentation
    - Date: January 2025
- **Reports Module UI Enhancements**:
  - Custom dropdown with checkboxes for multi-select (regions, species)
  - Improved Report Parameters container styling (consistent across all pages)
  - Uniform layout: Date fields in first row, filters in second row, Generate button in third row
  - Enhanced visual hierarchy with icons, borders, and hover effects
  - Instruction modals on all report pages (show on every page load)
  - Tooltips for icon-only buttons in Custom Report Builder
  - Date: January 2025
- **Pagination for Reference Tables**: Implemented comprehensive pagination system for all Reference Tables pages
  - Added pagination controls (rows per page selector, page navigation) to all 6 Reference Tables pages
  - Rows per page options: 10, 25, 50, 100 (default: 25)
  - "Showing X to Y of Z entries" information display
  - Previous/Next navigation with page number buttons
  - Ellipsis for large page counts
  - Smooth scroll to top of table on page change
  - Pagination state management (currentPage, rowsPerPage, totalPages)
  - Filter integration (resets to page 1 when filters change)
  - Export functionality uses filtered data (same as displayed)
  - Files modified: `landing-centers.html`, `fishing-grounds.html`, `fishing-effort.html`, `species.html`, `gear.html`, `vessel.html`
  - Files modified: `src/assets/js/modules/landing-centers.js`, `src/assets/js/modules/fishing-grounds.js`, `src/assets/js/modules/fishing-effort.js`, `src/assets/js/modules/species.js`, `src/assets/js/modules/gear.js`, `src/assets/js/modules/vessel.js`
  - Date: January 2025
- **Quick Date Range Presets for Analytics**: Added convenient preset buttons for common date ranges
  - Presets: Last 7 Days, Last 30 Days, Last 3 Months, Last 6 Months, This Month, Last Month, This Year, Last Year, Custom Range
  - Auto-applies filters when preset is selected
  - Remembers last used preset in localStorage
  - Automatically detects and highlights matching preset when dates are manually changed
  - Responsive design with mobile-friendly layout
  - Files modified: `analytics.html`, `src/assets/js/modules/analytics.js`
  - Date: January 2025
- **Analytics Performance Optimizations**: Implemented comprehensive performance improvements for the Analytics Module
  - Created `src/assets/js/utils/analyticsCache.js` with in-memory caching system (5-minute default TTL, LRU eviction, automatic cleanup)
  - Optimized all service queries to apply filters early (start from sample days table, filter by date/region first)
  - Implemented lazy loading for charts using Intersection Observer API (loads charts when scrolled into view)
  - Integrated caching into all service methods (getCatchTrends, getSpeciesDistribution, getRegionalComparison, getGearAnalysis, getComparisonStats)
  - Cache automatically clears when filters change
  - Expected improvements: 50-60% faster initial load, 95%+ faster subsequent loads with cache hits, 60-100% reduction in database queries
  - Files created: `src/assets/js/utils/analyticsCache.js`, `docs/guides/ANALYTICS_PERFORMANCE_OPTIMIZATIONS.md`
  - Files modified: `src/assets/js/services/analyticsService.js`, `src/assets/js/modules/analytics.js`, `analytics.html`
  - Date: January 2025
- **Analytics Module Documentation**: Created comprehensive guide for the Analytics Module
  - Complete feature documentation
  - Usage guide and technical implementation details
  - Future improvement suggestions (high/medium/low priority)
  - Troubleshooting guide and best practices
  - Implementation examples for adding new features
  - File created: `docs/guides/ANALYTICS_GUIDE.md`
  - Date: January 2025
- **Unified Loading Component**: Created standardized loading state system for the entire NSAP Information System
  - Created `src/assets/css/components/loading.css` with consistent loading styles (full page, inline, table, card, button)
  - Created `src/assets/js/utils/loading.js` with `LoadingManager` utility class for managing loading states
  - Loading overlay only covers main content area (sidebar remains visible and unblurred)
  - Supports multiple loading scenarios: full page, inline containers, tables, cards, and buttons
  - Provides consistent visual appearance across all pages
  - Files created: `src/assets/css/components/loading.css`, `src/assets/js/utils/loading.js`, `docs/guides/LOADING_COMPONENT_GUIDE.md`
  - Date: January 2025
- **Analytics Module (Task 3.2)**: Implemented comprehensive analytics dashboard with trend analysis, comparative analysis, and interactive charts
  - Created `analytics.html` page with filters (date range, region), comparison statistics, and multiple chart visualizations
  - Created `analyticsService.js` with data fetching methods for catch trends, species distribution, regional comparison, and gear analysis
  - Created `analytics.js` module with Chart.js integration for interactive charts (line, doughnut, bar)
  - Implemented CSV export functionality for all analytics charts
  - Features include: catch volume trends over time, species distribution (top 10), regional comparison, gear type analysis, and period-over-period comparison statistics
  - RBAC filtering applied (superadmin/admin see all data, encoder/viewer see their region)
  - Files created: `analytics.html`, `src/assets/js/services/analyticsService.js`, `src/assets/js/modules/analytics.js`
  - Date: January 2025
- **Testing Workflow**: Introduced Jest + jsdom smoke tests for HTML pages
  - Added `package.json` with Jest setup and jsdom environment
  - New tests in `tests/html-pages.test.js` validate presence/structure of add buttons and vessel unload detail placeholders
  - Applicable pages: `sample-day-detail.html`, `vessel-unload-detail.html`
  - Date: December 2025
- **Vessel Unload Detail - In-Page Vessel Catch CRUD**: Added add/edit modal and delete confirmation for vessel catch records directly within the detail page (parity with `vessel-catch.html`)
  - Species-only selection, read-only vessel unload display, preserved selection refresh, and inline loading states
  - Files modified: `vessel-unload-detail.html`, `src/assets/js/modules/vessel-unload-detail.js`
  - Date: December 2025
- **Vessel Unload Detail - In-Page Sample Length CRUD**: Added add/edit modal and delete confirmation for sample lengths scoped to the selected vessel catch (parity with `sample-lengths.html`)
  - Filtering by selected catch, descending length sort, and empty-state handling
  - Files modified: `vessel-unload-detail.html`, `src/assets/js/modules/vessel-unload-detail.js`
  - Date: December 2025
- **Vessel Unload Detail Page (Placeholder)**: Created `vessel-unload-detail.html` (now removed)
  - Status: Removed as of Dec 2025; navigation should be updated to reflect removal
- **Sample Day Detail - Empty-State Add Buttons**: Added inline “Add Gear”/“New Record” buttons when gear or vessel unload tables are empty
  - Buttons reuse shared white full-width styling classes
  - Ensures users can start adding records directly from empty states
  - Files modified: `src/assets/js/modules/sample-day-detail.js`, `sample-day-detail.html`
  - Date: December 2025

### Changed
- **Reports Module - Report Parameters Layout**: Reorganized layout for all report pages
  - Date fields (From Date, To Date) now in first row (2 columns, 50% each)
  - Other filters in second row (appropriate column widths)
  - Generate Report button in separate third row (full width)
  - Improved visual hierarchy and consistency
  - Files modified: `reports-monthly.html`, `reports-regional.html`, `reports-species.html`, `reports-custom.html`
  - Date: January 2025
- **Reports Module - Report Parameters Container Styling**: Enhanced visual appearance of Report Parameters section
  - Increased padding from 1.5rem to 2rem
  - Added hover effects with subtle shadow and border color change
  - Added funnel icon next to "Report Parameters" title
  - Improved header design with bottom border and larger font size
  - Better form label styling (font-weight 500)
  - Consistent styling across all report pages
  - Files modified: `reports-monthly.html`, `reports-regional.html`, `reports-species.html`, `reports-custom.html`
  - Date: January 2025
- **Reference Tables - Export Button Styling**: Standardized export button appearance across all Reference Tables pages
  - Changed button text from "Export to CSV" to "Export"
  - Added shadow effect matching Add button style (box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1))
  - Updated hover state to darker green (#047857) with enhanced shadow
  - Removed tooltip (text now visible on button)
  - Applied consistent styling to all 6 Reference Tables pages
  - Files modified: `landing-centers.html`, `fishing-grounds.html`, `fishing-effort.html`, `species.html`, `gear.html`, `vessel.html`
  - Date: January 2025
- **Data Entry Page - Button Styling and Positioning**: Updated button colors and layout
  - Refresh List button: Changed to green (#10b981) with darker green hover (#047857)
  - New Record button: Changed to blue (#3b82f6) with darker blue hover (#2563eb)
  - Both buttons now include shadow effects and hover animations
  - Buttons repositioned to right side of container
  - Button order: New Record (left) → Refresh List (right)
  - New Record button width standardized to 180px (matching Add buttons in Reference Tables)
  - Files modified: `data-entry.html`
  - Date: January 2025
- **Sample Day Detail - Vessel Unload Actions**: Updated "New Record" behavior
  - Footer button now spans full table width; empty-state button mirrors gear empty-state placement
  - “New Record” now opens an in-page vessel unload form modal (same fields/flow as vessel-unload page) instead of navigating away
  - Gear unload in the modal is auto-selected from the currently selected gear (or first gear), and fishing effort fields now auto-fill/clear in sync with gear selection
  - Fixed modal preselection order so the selected gear unload persists after form reset
  - Gear unload select in the modal is now read-only (disabled) since it auto-fills
  - Vessel unload table now has an Action column with a yellow view-only button linking to vessel unload detail
  - Fixed sidebar visibility on vessel unload detail page by loading shared components scripts
  - Files modified: `src/assets/js/modules/sample-day-detail.js`, `sample-day-detail.html`
  - Date: December 2025
- **Vessel Unload Detail - Sample Length Table**: Added inline Sample Length table to the detail page
  - Mirrors Vessel Catch styling with white full-width footer add button plus edit/delete actions
  - Loads sample lengths for the current vessel unload (filtered by its vessel catches) and refreshes after catch changes/deletions
  - Replaces the prior Effort & Meta card in the right column
  - Files modified: `vessel-unload-detail.html`, `src/assets/js/modules/vessel-unload-detail.js`
  - Date: December 2025
- **Vessel Unload Detail Page Rebuilt**: New summary-first layout mirroring Sample Day Detail
  - Summary card shows vessel unload fields (IDs, vessel, gear unload, catch, effort)
  - Two detail cards for catch/boxes and effort/meta (currently param-driven placeholders)
  - Fixed initialization order by loading `config.js` before core scripts to restore live data loading
  - Files modified: `vessel-unload-detail.html`
  - Date: December 2025
- **Sample Day Detail - Side-by-Side Data Containers**: Added vessel unload table display
  - Two side-by-side containers below summary card
  - Left container: Gear Unload Data (existing)
  - Right container: Vessel Unload Data (new)
  - Vessel unload data filtered by gear unload IDs for the current sample day
  - Displays: Vessel name, Effort (with unit), Catch Total, Catch Sample
  - Responsive layout (stacks vertically on mobile)
  - Files modified: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025
- **Sample Day Detail - Edit Modal**: Added edit functionality with modal dialog
  - Edit modal similar to sampling day page for consistency
  - Dependent dropdowns (Landing Center and Fishing Ground filter by Region)
  - Auto-calculation of sampling day based on date and landing center type
  - Full validation and error handling
  - Reloads record data after successful save
  - Files modified: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025

### Changed
- **Sample Day Detail - Button Placement & Styling**: Improved button appearance and positioning
  - Buttons positioned below sampling day indicator within summary card
  - Uniform button width (140px-200px) for consistent appearance
  - Proper color coding: Back to List (outline-light), Edit (primary blue), Delete (danger red)
  - Enhanced button styling with shadows, hover effects, and proper icons
  - Buttons separated with border-top divider for visual separation
  - Responsive layout (buttons stack vertically on mobile devices)
  - Files modified: `sample-day-detail.html`
  - Date: January 2025
- **Sample Day Detail - UI Updates**: Updated summary card styling and removed bottom container
  - Changed summary card color to match sidebar (rgba(0, 50, 100, 0.9)) with no gradient
  - Removed bottom form container
  - Removed right placeholder container
  - Gear unload table now displays full width
  - Removed unused form-related JavaScript functions
  - Files modified: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025
- **Sample Day Detail - Summary Spacing**: Tightened spacing below the summary header and above Region for a denser summary layout
  - Files modified: `sample-day-detail.html`
  - Date: December 2025

### Added
- **Sample Day Detail - Summary Card and Data Tables**: Added summary container and gear unload data table
  - Summary card at top showing region, landing center, fishing ground, sampling date
  - Sampling day indicator with check/cross icon and descriptive text
  - Two side-by-side containers below summary
  - Left container displays gear unload data table (filtered by sample day)
  - Right container placeholder for future content
  - Responsive design for mobile devices
  - Files modified: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025
- **Sample Day Detail - Loading State**: Added loading indicator when viewing sampling day details
  - Loading overlay with spinner animation
  - Loading text: "Loading record details..."
  - Form opacity reduced during loading for better visual feedback
  - Loading state automatically shown/hidden during data fetch
  - Files modified: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025

### Changed
- **Data Entry - Role-Based Permissions**: Implemented role-based access control for data entry operations
  - Viewers: Read-only access (cannot add, edit, or delete)
  - Encoders: Can add and edit records (cannot delete)
  - Admins/Superadmins: Full access (add, edit, delete)
  - "New Record" button hidden for viewers
  - Delete buttons only visible to admins
  - Edit functionality restricted based on role
  - Files modified: `src/assets/js/modules/data-entry.js`, `src/assets/js/modules/sample-day-detail.js`
  - Date: January 2025
- **Data Entry Page - UI and RBAC Updates**: Removed "Filters" heading and enforced region restriction for encoders
  - Removed "Filters" heading from filter container
  - Encoders can only view data from their assigned region
  - Region filter is hidden for encoders (since they can only see their region)
  - Added explicit encoder role checks in data loading and filtering
  - Files modified: `data-entry.html`, `src/assets/js/modules/data-entry.js`
  - Date: January 2025
- **Data Entry Filters - Placeholder Text**: Updated filter dropdown placeholders to show "All Regions", "All Landing Centers", and "All Fishing Grounds"
  - Placeholders appear when no specific item is selected
  - Placeholders appear when showing all data (no filter applied)
  - Updated populateDropdown function to accept custom "All" option text
  - Files modified: `src/assets/js/modules/data-entry.js`
  - Date: January 2025

### Fixed
- **Sampling Day Icons**: Updated sampling day display to show check icons for True and cross/X icons for False
  - Check icon (green) for True values
  - Cross/X icon (red) for False values
  - Handles both boolean and string values correctly
  - Updated in data-entry.js and sample-days.js
  - Files modified: `src/assets/js/modules/data-entry.js`, `src/assets/js/modules/sample-days.js`
  - Date: January 2025

### Changed
- **Data Entry Page - View Button**: Changed View button to redirect to a dedicated detail page instead of showing a modal
  - Created new `sample-day-detail.html` page for viewing/editing individual records
  - View button now redirects to `sample-day-detail.html?id={recordId}`
  - Detail page includes full form with edit mode functionality
  - Removed `viewRecord()` function from data-entry.js
  - Files created: `sample-day-detail.html`, `src/assets/js/modules/sample-day-detail.js`
  - Files modified: `src/assets/js/modules/data-entry.js`
  - Date: January 2025

### Fixed
- **Data Entry Page - Region-Dependent Dropdowns**: Fixed Landing Center and Fishing Ground dropdowns to properly filter based on selected region
  - Dropdowns now start empty and only populate when a region is selected
  - Both dropdowns correctly filter by selected region
  - Dropdowns update immediately when region changes
  - Proper "Select a region first" messaging when no region selected
  - Fixed data type handling in filtering logic
  - File modified: `src/assets/js/modules/data-entry.js`
  - Date: January 2025
- **Data Entry Page - Dropdown Fixes**: Fixed Landing Center and Fishing Ground dropdowns in modal
  - Fixed dropdowns not populating correctly when viewing/editing records
  - Fixed data type mismatches (string vs number) in comparisons
  - Improved value preservation when updating dependencies based on region
  - Added proper default "Select..." option for modal dropdowns
  - File modified: `src/assets/js/modules/data-entry.js`
  - Date: January 2025

### Added
- **Data Entry Page**: Created comprehensive data entry page (`data-entry.html`) for managing sampling day records
  - Filter functionality: Region, Landing Center, and Fishing Ground filters
  - Table display with columns: Date, Sampling Day (icons), Landing Center, Fishing Ground, Action
  - Pagination with configurable rows per page (10, 25, 50, 100)
  - View and Delete actions (Delete restricted to superadmin/admin)
  - Refresh List and New Record buttons
  - Sampling day calculation logic
  - RBAC filtering based on user role
  - File created: `data-entry.html`, `src/assets/js/modules/data-entry.js`
  - Date: January 2025
- **Navigation Enhancement**: Added "NSAP Data Entry" navigation item below Dashboard in sidebar
  - Simple navigation link (no submenu) that redirects to `data-entry.html`
  - Icon: `bi-clipboard-data`
  - Location: Directly below Dashboard in sidebar navigation
  - File modified: `src/assets/js/core/components.js`
  - Date: January 2025

### Changed
- **Folder Structure Reorganization**: Complete reorganization of project structure
  - Moved all assets to `src/assets/` with organized subdirectories
  - Organized documentation into `docs/guides/`, `docs/reviews/`, `docs/security/`
  - Moved test files to `tests/` directory
  - Updated all file paths in HTML files to reflect new structure
  - Created `STRUCTURE.md` for comprehensive folder documentation
  - Date: January 2025

### Added
- **Sample Lengths Module (Phase 2)**: Added `dbo_sample_lengths` table with comprehensive sample length management
  - Database table: `dbo_sample_lengths` with columns `length_id` (primary key), `catch_id` (foreign key to `dbo_vessel_catch`), `len` (length measurement)
  - Created `sample-lengths.html` with full CRUD interface
  - Created `assets/js/sample-lengths.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, vessel catch dropdown (showing species name from `dbo_species` based on `species_id` in `dbo_vessel_catch`), search, CSV export, viewer restrictions (read-only), validation, error handling, region-based RBAC filtering through vessel catch -> vessel unload -> gear unload -> sample day relationship
  - Created `docs/SAMPLE_LENGTHS_TABLE_GUIDE.md` with complete setup instructions
  - Updated security documentation with RLS policies
  - Added to sidebar menu and constants
- **Vessel Catch Module (Phase 2)**: Added `dbo_vessel_catch` table with comprehensive vessel catch management
  - Database table: `dbo_vessel_catch` with columns `catch_id` (primary key), `v_unload_id` (foreign key to `dbo_vessel_unload`), `species_id` (foreign key to `dbo_species`), `catch_kg`, `samp_kg`, `len_id` (length type), `lenunit_id` (mm or cm), `total_kg`, `totalwt_ifmeasured_kg`
  - Created `vessel-catch.html` with full CRUD interface
  - Created `assets/js/vessel-catch.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, vessel unload dropdown (showing combined gear unload ID and vessel name), species dropdown (showing species name), search, CSV export, viewer restrictions (read-only), validation, error handling, region-based RBAC filtering through vessel unload -> gear unload -> sample day relationship
  - Created `docs/VESSEL_CATCH_TABLE_GUIDE.md` with complete setup instructions
  - Updated security documentation with RLS policies
  - Added to sidebar menu and constants
- **Species Module (Phase 2)**: Added `dbo_species` table with comprehensive species management
  - Database table: `dbo_species` with columns `species_id` (primary key), `sp_name` (species name), `sp_family` (species family), `sp_sci` (species scientific name)
  - Created `species.html` with full CRUD interface
  - Created `assets/js/species.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, search (by name, family, scientific name), CSV export, viewer restrictions (read-only), validation, error handling
  - Reference/master data table (no region-based filtering - all users can view, only admins can modify)
  - Created `docs/SPECIES_TABLE_GUIDE.md` with complete setup instructions
  - Updated security documentation with RLS policies
  - Added to sidebar menu and constants
- **Vessel Unload Module (Phase 2)**: Added `dbo_vessel_unload` table with comprehensive vessel unload management
  - Created `vessel-unload.html` page with full CRUD interface
  - Implemented `assets/js/vessel-unload.js` with all features
  - Added support for multiple fishing effort units (primary required, secondary and tertiary optional)
  - Implemented region-based filtering through gear unload -> sample day relationship
  - Added search, filtering (region, vessel, date range), and CSV export
  - Enforced viewer restrictions (read-only access)
  - Added form-text labels and removed red asterisks for consistency
  - Created `docs/VESSEL_UNLOAD_TABLE_GUIDE.md` with complete setup instructions
  - Updated security documentation with RLS policies
  - Added to sidebar menu and constants

### Added
- **Gear Unload Module**: Added new Phase 2 module for managing gear unload records
  - Database table: `dbo_gear_unload` with columns `unload_gr_id` (primary key), `unload_day_id` (foreign key to `dbo_LC_FG_sample_day`), `gr_id` (foreign key to `dbo_gear`), `boats` (number of vessels), `catch` (catch landed in kg)
  - Created `gear-unload.html` with full CRUD interface
  - Created `assets/js/gear-unload.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, sample day dropdown (showing dates), gear dropdown (showing descriptions), search, date range and gear filters, CSV export, viewer restrictions, validation, error handling, region-based RBAC filtering through sample day relationship
  - Tasks 2.11.1 and 2.11.2 added to development plan
  - Constants updated to include `GEAR_UNLOAD` table
  - Database setup guide created (`docs/GEAR_UNLOAD_TABLE_GUIDE.md`)
- **Vessel Module**: Added new Phase 2 module for managing vessel data
  - Database table: `dbo_vessel` with columns `boat_id` (primary key), `vesselname`, `gr_id` (foreign key to `dbo_gear`), `region_id` (foreign key to `dbo_region`), `length`, `width`, `depth`, `grt` (auto-calculated), `hpw`, `engine_type`
  - Created `vessel.html` with full CRUD interface
  - Created `assets/js/vessel.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, gear and region dropdowns (showing descriptions/names), GRT auto-calculation ((Length × Width × Depth × 0.70) ÷ 2.83), search, CSV export, viewer restrictions, validation, error handling, region-based RBAC filtering
  - Tasks 2.10.1 and 2.10.2 added to development plan
  - Constants updated to include `VESSEL` table
  - Database setup guide created (`docs/VESSEL_TABLE_GUIDE.md`)
- **Gear Module**: Added new Phase 2 module for managing gear data
  - Database table: `dbo_gear` with columns `gr_id` (primary key), `gear_desc`, `uniteffort_id` (required), `uniteffort_2_id` (optional), `uniteffort_3_id` (optional)
  - Created `gear.html` with full CRUD interface
  - Created `assets/js/gear.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, fishing effort dropdowns (showing descriptions), search, CSV export, viewer restrictions, validation, error handling
  - Tasks 2.9.1 and 2.9.2 added to development plan
  - Constants updated to include `GEAR` table
  - Database setup guide created (`docs/GEAR_TABLE_GUIDE.md`)
- **Fishing Effort Module**: Complete implementation of fishing effort management
  - Database table: `dbo_fishing_effort` with columns `UnitEffort_ID` (primary key) and `fishing_effort`
  - Created `fishing-effort.html` with full CRUD interface
  - Created `assets/js/fishing-effort.js` with complete functionality
  - Added sidebar menu item in Data Entry submenu
  - Features: CRUD operations, search, CSV export, viewer restrictions, validation, error handling
  - Tasks 2.8.1 and 2.8.2 completed
  - Constants updated to include `FISHING_EFFORT` table
  - **Database Setup Guide**: Created `docs/FISHING_EFFORT_TABLE_GUIDE.md` with SQL scripts for table creation and RLS policies
- **Security Documentation**: Comprehensive security documentation (`docs/SECURITY.md`)
  - Complete RLS policies documentation
  - User roles and permissions guide
  - Security verification checklist
  - Security maintenance procedures
- **Phase 2 Verification**: Complete verification and testing of all Phase 2 modules

### Changed
- **Phase 2 Status**: Updated to 100% complete (22/22 tasks) - All modules implemented
- **Constants**: Added `FISHING_EFFORT: 'dbo_fishing_effort'` to TABLES constant
- **Security Review**: Task 1.1.3 (Server-Side Security Review) completed as part of Phase 2.7.1
- **Development Plan**: Added Section 2.8 for Fishing Effort Module

---

## [1.1.0] - 2025-01-XX

### Changed
- **Development Plan**: Added Fishing Grounds Module (Section 2.4) before User Management
  - Fishing Grounds module now scheduled for implementation before User Management
  - User Management renumbered from 2.4 to 2.5
  - Settings renumbered from 2.5 to 2.6
  - Updated progress tracking: Phase 2 now 12/30 tasks (40%)

### Planned
- Phase 2: Complete landing centers module
- Phase 2: Complete sample days module
- Phase 2: Complete user management module
- Phase 2: Settings page implementation
- Phase 1: Review and document RLS policies

### Fixed
- **RBAC Region Filtering**: Fixed region filtering logic so superadmin and admin can access all data without region restrictions
  - Updated fishing-grounds.js
  - Updated landing-centers.js
  - Updated sample-days.js
  - Updated dashboardService.js
  - Only encoder and viewer roles are now limited to their assigned region

### Added
- **Settings Enhancements**: Integrated utilities and enhanced validation
  - Integrated ErrorHandler utility
  - Integrated Validation utility
  - Used TABLES constant
  - Enhanced password validation
  - Enhanced avatar file validation
- **User Management Enhancements**: Added filters and export functionality
  - Region filter dropdown
  - Combined filtering (search + role + status + region)
  - CSV export functionality
- **Fishing Grounds Enhancements**: Added filters and export functionality
  - Region filter dropdown
  - Combined filtering (search + region)
  - CSV export functionality
- **Landing Centers Enhancements**: Added filters and export functionality
  - Region filter dropdown
  - Type filter dropdown
  - Combined filtering (search + region + type)
  - CSV export functionality
- **Sample Days Enhancements**: Added filters and export functionality
  - Date range filtering (From Date / To Date)
  - Region filter dropdown
  - Landing Center filter dropdown (updates based on region)
  - Combined filtering (search + date range + region + landing center)
  - CSV export functionality
- **Viewer Role Restrictions**: Enforced viewer restrictions across all modules
  - Viewers cannot add/edit/delete in landing centers, fishing grounds, sample days
  - All CRUD operations protected with viewer checks
  - Viewers are redirected from user management page
  - Modal access blocked for viewers
  - All CRUD operations protected with viewer checks

---

## [1.3.1] - 2025-01-15

### Fixed
- **Syntax Errors**: Removed ES6 export statements from utility files
  - Fixed `errorHandler.js` - removed `export default`
  - Fixed `validation.js` - removed `export default`
  - Fixed `constants.js` - removed all `export const` statements
  - Fixed `dashboardService.js` - removed `export default`
  - Files now work as regular scripts (not ES modules)
- **RBAC Region Filtering**: Fixed region filtering so superadmin and admin can access all data
  - Superadmin and Admin: No region filtering (can access all regions/data)
  - Encoder and Viewer: Region filtering applied (limited to assigned region)
  - Updated all modules: fishing-grounds, landing-centers, sample-days, dashboard
- **Login Validation**: Improved validation check with fallback if utility not loaded

---

## [1.3.0] - 2025-01-15

### Added - Phase 1 Completion
- **Complete Error Handling**: Applied ErrorHandler utility to all modules
  - `fishing-grounds.js` - All operations use centralized error handling
  - `landing-centers.js` - All operations use centralized error handling
  - `sample-days.js` - All operations use centralized error handling
  - `users.js` - All operations use centralized error handling
- **Complete Validation**: Applied Validation utility to all forms
  - Login form validation (email format, required fields)
  - Fishing grounds form validation
  - Landing centers form validation
  - Sample days form validation (including date validation)
  - User management form validation
- **Complete Constants**: Replaced all magic strings with constants
  - Role checks use `ROLES` constants
  - Table names use `TABLES` constants
  - Role arrays use `ADMIN_ROLES`, `DATA_ENTRY_ROLES`, `VIEWER_ROLES`
  - All modules updated to use constants

### Changed
- **All Modules**: Replaced `console.log` and `console.error` with ErrorHandler
- **All Modules**: Replaced local `escapeHtml` functions with `Validation.escapeHtml`
- **All Modules**: Replaced magic strings with constants from `constants.js`
- **All HTML Files**: Added utility script loading (constants, errorHandler, validation)
- **Error Messages**: Standardized and user-friendly across all modules

### Fixed
- **XSS Prevention**: All user input now properly sanitized using Validation utility
- **Error Handling**: Consistent error handling pattern across all modules
- **Code Quality**: Removed all debug code and magic strings

---

## [1.2.0] - 2025-01-15

### Added - Phase 2: Dashboard Integration
- **Dashboard Service**: Created `assets/js/services/dashboardService.js`
  - Total landings count with RBAC filtering
  - Verified records count
  - Pending reviews count
  - Active encoders count
  - Catch trends (last 6 months) for chart
  - Species distribution for chart
  - Recent activity feed
- **Dashboard Data Integration**: Connected dashboard to real Supabase data
  - Stat cards now show real data
  - Catch trend chart uses real monthly data
  - Recent activity shows actual sample days
  - Loading states for all components
  - Error states with user-friendly messages

### Changed
- **Dashboard**: Refactored `assets/js/dashboard.js` to use DashboardService
- **Error Handling**: Applied error handler utility to dashboard.js (Phase 1 task)
- **Validation**: Applied validation utility for XSS prevention in activity display
- **Dashboard HTML**: Updated stat cards with data attributes for dynamic updates

### Fixed
- Dashboard now shows real data instead of mock data
- Proper error handling throughout dashboard initialization
- Loading states prevent empty UI during data fetch

---

## [1.1.0] - 2025-01-15

### Added - Phase 1 Infrastructure
- **Security**: Secure credential management system
  - Created `config.js` and `config.js.example` for secure configuration
  - Created `.gitignore` to exclude sensitive files
  - Refactored all code to use centralized configuration
- **Error Handling**: Centralized error handling utility
  - Created `assets/js/utils/errorHandler.js`
  - User-friendly error messages
  - Supabase error translation
  - Toast notification integration
- **Validation**: Input validation utility
  - Created `assets/js/utils/validation.js`
  - Email validation
  - Password strength validation
  - HTML sanitization (XSS prevention)
  - Field validation utilities
- **Constants**: Centralized constants file
  - Created `assets/js/utils/constants.js`
  - Role constants (SUPERADMIN, ADMIN, ENCODER, VIEWER)
  - Table name constants
  - Storage key constants
  - Role arrays for permission checks

### Changed
- **Security**: Moved Supabase credentials from `script.js` to `config.js`
- **Code Quality**: Removed all `console.log` statements from production code
- **Documentation**: Updated README with new project structure and configuration instructions
- **HTML Files**: Updated all HTML files to load `config.js` before `script.js`
  - `index.html`
  - `dashboard.html`
  - `fishing-grounds.html`
  - `landing-centers.html`
  - `sample-days.html`
  - `users.html`
  - `settings.html`

### Fixed
- **Security**: Fixed exposed Supabase credentials in version control
- **Error Handling**: Standardized error handling approach

### Documentation
- Created `DEVELOPMENT_PLAN.md` - Comprehensive development roadmap
- Created `CHECKLIST.md` - Quick reference task checklist
- Created `PHASE1_COMPLETE.md` - Phase 1 completion summary
- Updated `README.md` with new structure and security best practices

---

## [1.0.0] - 2025-01-01

### Added - Initial Release
- User authentication (login/logout)
- Role-based access control (RBAC)
- Fishing grounds management (CRUD)
- Dashboard UI (with mock data)
- Toast notification system
- Responsive sidebar navigation
- Component system (template-based)
- Landing page and login page

### Documentation
- Initial README.md
- Component system documentation
- Logout security documentation
- Database update guides
- RLS policies documentation

---

## Version History

- **1.3.0** (2025-01-XX): Reports Module Complete - All four report types implemented (Monthly, Regional, Species, Custom)
- **1.2.0** (2025-01-15): Phase 1 infrastructure complete
- **1.0.0** (2025-01-01): Initial release

---

## How to Update This Changelog

When making changes:
1. Add entries under `[Unreleased]` for planned work
2. When completing a phase or milestone, create a new version entry
3. Use categories: Added, Changed, Deprecated, Removed, Fixed, Security
4. Include file paths and brief descriptions
5. Update version number and date

---

**Last Updated:** January 2025

