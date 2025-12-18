# NSAP Information System - Documentation Guide

This guide explains the documentation structure and how to find information in the NSAP Information System project.

## 📚 Documentation Structure

### Root Level Documentation

These are the main documentation files kept in the project root for easy access:

1. **README.md**
   - Main project documentation
   - Setup instructions
   - Quick start guide
   - Project overview

2. **DEVELOPMENT_PLAN.md**
   - Complete development roadmap
   - Phase-by-phase planning
   - Task breakdown and status
   - Timeline and milestones

3. **CHANGELOG.md**
   - Detailed changelog of all changes
   - Follows Keep a Changelog format
   - Version history
   - Feature additions and modifications

4. **STRUCTURE.md**
   - Comprehensive folder structure documentation
   - Directory descriptions
   - File organization guidelines
   - Path conventions

5. **CHECKLIST.md**
   - Development progress checklist
   - Task completion tracking
   - Quick reference for development status

### Documentation Directory (`docs/`)

#### `docs/guides/`
Setup guides and technical documentation:
- Database table creation guides (`*_TABLE_GUIDE.md`)
- Database update procedures
- Storage setup guides
- Column name fixes and migrations

**Files**:
- `DATABASE_UPDATE_GUIDE.md`
- `FISHING_EFFORT_TABLE_GUIDE.md`
- `GEAR_TABLE_GUIDE.md`
- `GEAR_UNLOAD_TABLE_GUIDE.md`
- `SAMPLE_LENGTHS_TABLE_GUIDE.md`
- `SPECIES_TABLE_GUIDE.md`
- `STORAGE_UPDATE_GUIDE.md`
- `VESSEL_CATCH_TABLE_GUIDE.md`
- `VESSEL_TABLE_GUIDE.md`
- `VESSEL_UNLOAD_TABLE_GUIDE.md`
- And more...

#### `docs/reviews/`
Module review documents and feature assessments:
- Implementation reviews
- Feature completeness assessments
- Module status documentation

**Files**:
- `FISHING_GROUNDS_REVIEW.md`
- `LANDING_CENTERS_REVIEW.md`
- `SAMPLE_DAYS_REVIEW.md`
- `SETTINGS_REVIEW.md`
- `USER_MANAGEMENT_REVIEW.md`

#### `docs/security/`
Security documentation and policies:
- Security policies
- RLS (Row Level Security) documentation
- Logout implementation guides
- Security troubleshooting

**Files**:
- `SECURITY.md` - Comprehensive security documentation
- `RLS_POLICIES.md` - Row Level Security policies
- `LOGOUT_SECURITY.md` - Logout security implementation
- `LOGOUT_TROUBLESHOOTING.md` - Logout troubleshooting guide
- `LOGOUT_MODAL_GUIDE.md` - Logout modal implementation

#### `docs/CHANGES.md`
Recent changes and updates tracking:
- Quick reference for recent changes
- Feature additions
- Bug fixes
- Refactoring notes

#### `docs/archive/`
Historical documentation:
- Archived files that have been consolidated
- Historical reference only
- No longer actively maintained

## 🔍 Finding Information

### Setup and Installation
- **Getting Started**: See `README.md` → "Getting Started" section
- **Configuration**: See `README.md` → "Installation" section
- **Database Setup**: See `docs/guides/` → `*_TABLE_GUIDE.md` files

### Development
- **Development Roadmap**: See `DEVELOPMENT_PLAN.md`
- **Progress Tracking**: See `CHECKLIST.md`
- **Recent Changes**: See `docs/CHANGES.md` or `CHANGELOG.md`

### Code Structure
- **Folder Structure**: See `STRUCTURE.md`
- **File Organization**: See `STRUCTURE.md` → "Directory Descriptions"
- **Path Conventions**: See `STRUCTURE.md` → "File Path Conventions"

### Security
- **Security Overview**: See `docs/security/SECURITY.md`
- **RLS Policies**: See `docs/security/RLS_POLICIES.md`
- **Logout Implementation**: See `docs/security/LOGOUT_SECURITY.md`

### Module Information
- **Module Reviews**: See `docs/reviews/` → `*_REVIEW.md` files
- **Table Setup**: See `docs/guides/` → `*_TABLE_GUIDE.md` files

## 📝 Documenting Changes

When making changes to the system:

1. **Update CHANGELOG.md**
   - Add entry under appropriate version/date
   - Include description of changes
   - List files modified

2. **Update docs/CHANGES.md**
   - Add entry with date and type
   - Include detailed description
   - List files modified

3. **Update Relevant Documentation**
   - If adding features: Update `DEVELOPMENT_PLAN.md`
   - If changing structure: Update `STRUCTURE.md`
   - If security-related: Update `docs/security/SECURITY.md`

## 🗂️ Documentation Maintenance

### Keeping Documentation Clean

1. **Consolidate Redundant Files**
   - Merge similar documentation
   - Archive historical files
   - Keep only active documentation in root

2. **Organize by Category**
   - Guides in `docs/guides/`
   - Reviews in `docs/reviews/`
   - Security in `docs/security/`
   - Archive in `docs/archive/`

3. **Update Cross-References**
   - Keep links between documents current
   - Update references when files move
   - Maintain README.md as entry point

## 📋 Quick Reference

| What You Need | Where to Find It |
|--------------|------------------|
| Setup Instructions | `README.md` |
| Development Roadmap | `DEVELOPMENT_PLAN.md` |
| Recent Changes | `docs/CHANGES.md` or `CHANGELOG.md` |
| Folder Structure | `STRUCTURE.md` |
| Database Setup | `docs/guides/*_TABLE_GUIDE.md` |
| Security Info | `docs/security/SECURITY.md` |
| Module Reviews | `docs/reviews/*_REVIEW.md` |
| Progress Tracking | `CHECKLIST.md` |

---

**Last Updated**: January 2025  
**Maintained By**: NSAP Development Team

