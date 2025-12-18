# NSAP Information System - Project Structure

This document describes the folder structure and organization of the NSAP Information System project.

## 📁 Directory Structure

```
NSAP Information System/
├── public/                    # Public-facing HTML pages (entry points)
│   └── (HTML files remain in root for now)
│
├── src/                      # Source files and assets
│   ├── assets/
│   │   ├── css/
│   │   │   ├── components/   # Component-specific styles
│   │   │   │   ├── sidebar.css
│   │   │   │   ├── notifications.css
│   │   │   │   └── dashboard.css
│   │   │   ├── pages/        # Page-specific styles
│   │   │   │   ├── landing.css
│   │   │   │   └── demo.css
│   │   │   └── main.css      # Global styles
│   │   ├── js/
│   │   │   ├── core/         # Core functionality
│   │   │   │   ├── script.js          # Supabase initialization
│   │   │   │   ├── notifications.js   # Toast notification system
│   │   │   │   ├── components.js      # Component loader
│   │   │   │   └── scroll-animations.js
│   │   │   ├── modules/      # Feature modules (CRUD operations)
│   │   │   │   ├── dashboard.js
│   │   │   │   ├── fishing-effort.js
│   │   │   │   ├── fishing-grounds.js
│   │   │   │   ├── gear-unload.js
│   │   │   │   ├── gear.js
│   │   │   │   ├── landing-centers.js
│   │   │   │   ├── sample-days.js
│   │   │   │   ├── sample-lengths.js
│   │   │   │   ├── settings.js
│   │   │   │   ├── species.js
│   │   │   │   ├── users.js
│   │   │   │   ├── vessel-catch.js
│   │   │   │   ├── vessel-unload.js
│   │   │   │   └── vessel.js
│   │   │   ├── services/     # API services
│   │   │   │   └── dashboardService.js
│   │   │   └── utils/        # Utility functions
│   │   │       ├── constants.js      # Application constants
│   │   │       ├── errorHandler.js   # Error handling utility
│   │   │       └── validation.js     # Input validation utility
│   │   └── images/           # Images and media
│   │       └── hero-bg.jpg
│   └── components/           # HTML components (templates)
│       ├── footer.html
│       ├── navbar.html
│       ├── sidebar.html
│       └── README.md
│
├── config/                   # Configuration files
│   ├── config.js.example     # Configuration template
│   └── .gitignore           # (config.js is gitignored)
│
├── docs/                     # Documentation
│   ├── guides/              # Setup and usage guides
│   │   ├── DATABASE_UPDATE_GUIDE.md
│   │   ├── FISHING_EFFORT_TABLE_GUIDE.md
│   │   ├── GEAR_TABLE_GUIDE.md
│   │   ├── GEAR_UNLOAD_TABLE_GUIDE.md
│   │   ├── LANDING_CENTERS_TABLE_GUIDE.md
│   │   ├── SAMPLE_DAYS_TABLE_GUIDE.md
│   │   ├── SAMPLE_LENGTHS_TABLE_GUIDE.md
│   │   ├── SPECIES_TABLE_GUIDE.md
│   │   ├── VESSEL_CATCH_TABLE_GUIDE.md
│   │   ├── VESSEL_TABLE_GUIDE.md
│   │   ├── VESSEL_UNLOAD_TABLE_GUIDE.md
│   │   └── ...
│   ├── reviews/            # Module review documents
│   │   ├── FISHING_GROUNDS_REVIEW.md
│   │   ├── LANDING_CENTERS_REVIEW.md
│   │   ├── SAMPLE_DAYS_REVIEW.md
│   │   ├── SETTINGS_REVIEW.md
│   │   ├── USER_MANAGEMENT_REVIEW.md
│   │   └── ...
│   └── security/           # Security documentation
│       ├── SECURITY.md
│       ├── RLS_POLICIES.md
│       ├── LOGOUT_SECURITY.md
│       ├── LOGOUT_TROUBLESHOOTING.md
│       └── LOGOUT_MODAL_GUIDE.md
│
├── tests/                   # Test files
│   ├── logout-button-test.html
│   ├── logout-debug.html
│   └── logout-test.html
│
├── pages/                   # Additional pages
│   └── notification-demo.html
│
├── Root HTML Files          # Main application pages (entry points)
│   ├── index.html          # Landing/login page
│   ├── dashboard.html      # Dashboard
│   ├── fishing-effort.html
│   ├── fishing-grounds.html
│   ├── gear-unload.html
│   ├── gear.html
│   ├── landing-centers.html
│   ├── sample-days.html
│   ├── sample-lengths.html
│   ├── settings.html
│   ├── species.html
│   ├── users.html
│   ├── vessel-catch.html
│   ├── vessel-unload.html
│   └── vessel.html
│
├── config.js               # Configuration (gitignored, create from config.js.example)
├── README.md               # Project documentation
├── DEVELOPMENT_PLAN.md     # Development roadmap
├── CHANGELOG.md            # Change log
├── CHECKLIST.md            # Progress checklist
└── STRUCTURE.md            # This file
```

## 📂 Directory Descriptions

### `/src/assets/`
Contains all static assets (CSS, JavaScript, images) organized by type and purpose.

- **`css/components/`**: Styles for reusable UI components (sidebar, notifications, dashboard)
- **`css/pages/`**: Page-specific styles (landing page, demo pages)
- **`css/main.css`**: Global styles and base styling
- **`js/core/`**: Core application functionality (Supabase setup, notifications, components)
- **`js/modules/`**: Feature-specific modules (one per data management module)
- **`js/services/`**: API service layers for data fetching
- **`js/utils/`**: Reusable utility functions (constants, error handling, validation)
- **`images/`**: Image assets

### `/src/components/`
HTML component templates that are loaded dynamically by the component system.

### `/docs/`
Project documentation organized by category:
- **`guides/`**: Setup guides, table creation guides, database update procedures
- **`reviews/`**: Module review documents and feature assessments
- **`security/`**: Security policies, RLS documentation, logout implementation

### `/tests/`
Test HTML files for debugging and testing specific features.

### `/pages/`
Additional pages that are not main application entry points (demos, examples).

### Root Level
- **HTML Files**: Main application pages (entry points) - kept in root for easy access
- **Configuration**: `config.js` (gitignored) and `config.js.example`
- **Documentation**: Main project documentation files

## 🔗 File Path Conventions

### HTML Files Reference Assets
All HTML files in the root reference assets using the `src/assets/` path:

```html
<!-- CSS -->
<link rel="stylesheet" href="src/assets/css/components/sidebar.css">
<link rel="stylesheet" href="src/assets/css/pages/landing.css">

<!-- JavaScript -->
<script src="src/assets/js/core/script.js"></script>
<script src="src/assets/js/modules/dashboard.js"></script>
<script src="src/assets/js/utils/constants.js"></script>
```

### Component Loading
Components are loaded via the component system in `src/assets/js/core/components.js`, which uses templates embedded in the JavaScript file.

## 📝 Naming Conventions

- **Files**: `kebab-case.js`, `kebab-case.css`, `kebab-case.html`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **CSS Classes**: `kebab-case`

## 🎯 Benefits of This Structure

1. **Clear Separation**: Core, modules, services, and utils are clearly separated
2. **Scalability**: Easy to add new modules without cluttering
3. **Maintainability**: Related files are grouped together
4. **Documentation**: Docs are organized by purpose (guides, reviews, security)
5. **Testability**: Test files are isolated in their own directory
6. **Professional**: Follows industry-standard project organization

## 🔄 Migration Notes

If you're migrating from the old structure:
- All `assets/js/*.js` module files moved to `src/assets/js/modules/`
- All `assets/js/script.js` and core files moved to `src/assets/js/core/`
- All `assets/css/` component styles moved to `src/assets/css/components/`
- All `assets/css/` page styles moved to `src/assets/css/pages/`
- Components moved from `components/` to `src/components/`
- Documentation organized into `docs/guides/`, `docs/reviews/`, `docs/security/`

## 📚 Related Documentation

- **`README.md`** - Main project documentation and setup instructions
- **`DEVELOPMENT_PLAN.md`** - Development roadmap and phase planning
- **`CHANGELOG.md`** - Detailed changelog of all changes
- **`CHECKLIST.md`** - Development progress checklist
- **`docs/CHANGES.md`** - Recent changes and updates tracking
- **`docs/guides/`** - Setup guides, table creation guides, database procedures
- **`docs/reviews/`** - Module review documents and feature assessments
- **`docs/security/`** - Security policies, RLS documentation, logout implementation
- **`docs/archive/`** - Historical documentation (archived)

---

**Last Updated**: January 2025  
**Maintained By**: NSAP Development Team

