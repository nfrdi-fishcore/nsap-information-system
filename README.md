# NSAP Information System

National Stock Assessment Program (NSAP) Information System - A modern web-based platform for fisheries stock assessment and management.

## 📚 Documentation

### Essential Documentation
- **[README.md](README.md)** - This file, main project documentation
- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)** - Development roadmap and phase planning
- **[CHANGELOG.md](CHANGELOG.md)** - Detailed changelog of all changes
- **[STRUCTURE.md](STRUCTURE.md)** - Comprehensive folder structure documentation
- **[CHECKLIST.md](CHECKLIST.md)** - Development progress checklist

### Documentation Organization
- **`docs/guides/`** - Setup guides, table creation guides, database procedures
- **`docs/reviews/`** - Module review documents and feature assessments
- **`docs/security/`** - Security policies, RLS documentation, logout implementation
- **`docs/CHANGES.md`** - Recent changes and updates tracking
- **`docs/archive/`** - Historical documentation (archived)

For detailed folder structure, see [STRUCTURE.md](STRUCTURE.md).

## 📁 Project Structure

```
NSAP Information System/
├── index.html                      # Landing/login page
├── dashboard.html                  # Dashboard
├── [module].html                   # Feature modules (fishing-grounds, species, etc.)
├── README.md                       # Project documentation
├── STRUCTURE.md                    # Detailed folder structure documentation
├── config.js                       # Configuration (create from config.js.example)
├── config.js.example               # Configuration template
├── .gitignore                      # Git ignore file
├── src/                            # Source files and assets
│   ├── assets/
│   │   ├── css/
│   │   │   ├── components/        # Component styles (sidebar, notifications, dashboard)
│   │   │   ├── pages/             # Page-specific styles (landing, demo)
│   │   │   └── main.css          # Global styles
│   │   ├── js/
│   │   │   ├── core/              # Core functionality (script, notifications, components)
│   │   │   ├── modules/           # Feature modules (dashboard, fishing-grounds, etc.)
│   │   │   ├── services/          # API services
│   │   │   └── utils/             # Utility functions (constants, errorHandler, validation)
│   │   └── images/                # Images and media
│   └── components/                 # HTML component templates
├── docs/                           # Documentation
│   ├── guides/                     # Setup and usage guides
│   ├── reviews/                    # Module review documents
│   └── security/                   # Security documentation
├── tests/                          # Test files
└── pages/                          # Additional pages
    └── notification-demo.html      # Notification system demo
```

**For detailed structure information, see [STRUCTURE.md](STRUCTURE.md)**

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Supabase account (for backend)
- Local web server (optional, for development)

### Installation

1. **Clone or download the project**
   ```bash
   cd "NSAP Information System"
   ```

2. **Configure Supabase**
   - Copy `config.js.example` to `config.js`:
     ```bash
     cp config.js.example config.js
     ```
   - Open `config.js` and update with your Supabase credentials:
     ```javascript
     const CONFIG = {
         SUPABASE_URL: 'https://your-project-id.supabase.co',
         SUPABASE_ANON_KEY: 'your-anon-key-here'
     };
     ```
   - **Important**: Never commit `config.js` to version control (it's in `.gitignore`)
   - To get your credentials: Go to Supabase Dashboard → Settings → API

3. **Set up database tables**
   - Create `dbo_user` table with columns:
     - `user_id` (Primary Key)
     - `region_id` (Foreign Key)
     - `full_name`
     - `email`
     - `password`
     - `office`
     - `user_img`
     - `designation`
     - `role` (superadmin, admin, encoder, viewer)
     - `token`
   
   - Create `dbo_region` table with columns:
     - `region_id` (Primary Key)
     - `region`

4. **Run the application**
   - Open `index.html` in your web browser
   - Or use a local server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Node.js (http-server)
     npx http-server
     ```

## 🎨 Features

- **User Authentication**: Secure login with Supabase
- **Role-Based Access**: Superadmin, Admin, Encoder, Viewer roles
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Clean, professional interface with animations
- **Toast Notifications**: User-friendly notification system
- **Cloud Storage**: Supabase backend for data and files

## 📖 Usage

### Landing Page (`index.html`)
- Displays NSAP history and system information
- Showcases key features
- Provides login access

### Login Page (`login.html`)
- Email/password authentication
- Password visibility toggle
- Remember me functionality
- Loading states and error handling

### Notification System
- Global `toast` object for notifications
- Four types: success, error, warning, info
- Auto-dismiss and manual close options

Example usage:
```javascript
// Simple notification
toast.success('Operation completed!');

// With custom title
toast.error('Failed to save data', 'Error');

// Advanced usage
toast.show({
    type: 'info',
    title: 'Processing',
    message: 'Please wait...',
    duration: 3000
});
```

## 🛠️ Development

### File Organization

- **HTML Files**: Root level for main entry points (dashboard, modules)
- **CSS Files**: `src/assets/css/` - Organized by components, pages, and global styles
- **JavaScript Files**: `src/assets/js/` - Organized into core, modules, services, and utils
- **Images**: `src/assets/images/` - All media files
- **Components**: `src/components/` - Reusable HTML component templates
- **Documentation**: `docs/` - Organized into guides, reviews, and security
- **Tests**: `tests/` - Test and debugging files
- **Additional Pages**: `pages/` - Secondary pages (demos, examples)

### Adding New Pages

1. Create HTML file in root directory (for main pages) or `pages/` (for secondary pages)
2. Create corresponding CSS file in `src/assets/css/pages/` or `src/assets/css/components/`
3. Link CSS: `<link rel="stylesheet" href="src/assets/css/pages/your-page.css">`
4. Link scripts: 
   ```html
   <script src="src/assets/js/core/script.js"></script>
   <script src="src/assets/js/modules/your-module.js"></script>
   ```

### Adding New Modules

1. Create HTML file in root: `your-module.html`
2. Create JavaScript module: `src/assets/js/modules/your-module.js`
3. Create CSS file (if needed): `src/assets/css/components/your-module.css` or `src/assets/css/pages/your-module.css`
4. Follow the existing module pattern for CRUD operations, error handling, and validation

### Styling Guidelines

- Use the existing color scheme (#007aff primary blue)
- Follow Inter font family for consistency
- Maintain 20px border-radius for cards
- Use gradient backgrounds for primary elements

## 🎨 Color Palette

- **Primary Blue**: `#007aff`
- **Secondary Blue**: `#0051d5`
- **Success Green**: `#10b981`
- **Error Red**: `#ef4444`
- **Warning Orange**: `#f59e0b`
- **Info Blue**: `#3b82f6`

## 📝 Technologies Used

- **HTML5**: Structure and content
- **CSS3**: Styling and animations
- **JavaScript (ES6)**: Functionality and interactions
- **Bootstrap 5.3.3**: UI components and grid system
- **Tailwind CSS**: Utility classes (via CDN)
- **Supabase**: Backend database and authentication
- **Bootstrap Icons**: Icon library
- **Google Fonts (Inter)**: Typography

## 🔒 Security

- Supabase handles authentication securely
- Row Level Security (RLS) should be enabled on database tables
- API keys should be kept secure (use environment variables in production)
- Input validation on both client and server side

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🚧 Development Status

### ✅ Completed
- User authentication (login/logout)
- Role-based access control (RBAC)
- Fishing grounds management (CRUD)
- Dashboard UI (data integration in progress)
- Component system
- Toast notification system
- Security improvements (Phase 1)

### 🟡 In Progress
- Dashboard data integration
- Landing centers module
- Sample days module
- User management module

### 📋 Planned
- Reports module (Monthly, Regional, Species, Custom)
- Analytics dashboard
- Maps integration
- Data import/export
- Settings page functionality

See `DEVELOPMENT_PLAN.md` for detailed roadmap and `CHECKLIST.md` for progress tracking.

## 📄 License

© 2025 NSAP Information System. All rights reserved.

## 👥 Contact

For questions or support, please contact the BFAR NSAP team.

---

**Note**: This is an upgraded version of the NSAP Database, transitioning from Microsoft Access to a modern web-based platform.
