# Analytics Module Guide

## Overview

The Analytics Module is a comprehensive data visualization and analysis tool for the NSAP Information System. It provides interactive charts, trend analysis, comparative statistics, and data export capabilities to help users understand fishing catch data patterns, species distribution, regional comparisons, and gear type analysis.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Usage Guide](#usage-guide)
4. [Technical Implementation](#technical-implementation)
5. [Data Flow](#data-flow)
6. [Filtering System](#filtering-system)
7. [Future Improvements](#future-improvements)
8. [Troubleshooting](#troubleshooting)

---

## Features

### Current Features

1. **Catch Volume Trends**
   - Monthly and daily aggregation views
   - Interactive line chart with gradient fill
   - Toggle between monthly and daily views
   - CSV export functionality

2. **Species Distribution**
   - Top 10 species by catch volume
   - Doughnut chart visualization
   - Percentage breakdown in tooltips
   - CSV export functionality

3. **Regional Comparison**
   - Bar chart comparing catch volumes across regions
   - Aggregated by region name
   - CSV export functionality

4. **Gear Type Analysis**
   - Horizontal bar chart showing catch by gear type
   - Sorted by catch volume (descending)
   - CSV export functionality

5. **Comparison Statistics**
   - Period-over-period comparison (current vs previous)
   - Three key metrics:
     - Total Catch (KG) with percentage change
     - Species Count with absolute change
     - Regional Count with absolute change
   - Visual indicators for positive/negative changes

6. **Filtering System**
   - Date range filter (From Date / To Date)
   - Region filter (dropdown with "All Regions" option)
   - RBAC-aware filtering (respects user permissions)

7. **Data Export**
   - CSV export for all chart types
   - Filenames include aggregation type for trends (daily/monthly)

---

## Architecture

### File Structure

```
analytics.html                          # Main page HTML
src/assets/js/
  ├── services/
  │   └── analyticsService.js          # Data fetching service
  └── modules/
      └── analytics.js                 # UI logic and chart rendering
```

### Key Components

#### 1. AnalyticsService (`analyticsService.js`)

A static service class that handles all data fetching operations:

- **getCatchTrends()** - Fetches catch volume trends over time
- **getSpeciesDistribution()** - Fetches species distribution data
- **getRegionalComparison()** - Fetches regional comparison data
- **getGearAnalysis()** - Fetches gear type analysis data
- **getComparisonStats()** - Calculates period-over-period statistics
- **getRegions()** - Fetches available regions for filter dropdown

#### 2. Analytics Module (`analytics.js`)

Handles UI interactions, chart rendering, and data management:

- Chart initialization and updates
- Filter application
- Event handling
- Loading state management
- CSV export functionality

#### 3. Chart.js Integration

Uses Chart.js library for all visualizations:
- Line charts for trends
- Doughnut charts for species distribution
- Bar charts for regional and gear comparisons

---

## Usage Guide

### Accessing Analytics

1. Navigate to the Analytics page from the sidebar
2. The page requires appropriate permissions (superadmin, admin, or viewer roles)
3. Default view shows last 6 months of data

### Using Filters

1. **Date Range Filter**
   - Select "From Date" and "To Date" using the date pickers
   - Click "Apply Filters" to update all charts
   - Date validation ensures "From Date" is before "To Date"

2. **Region Filter**
   - Select a region from the dropdown (or "All Regions" for no filter)
   - Click "Apply Filters" to update all charts
   - Filter respects RBAC: non-admin users only see their region

3. **Trend View Toggle**
   - Use the "Monthly" / "Daily" radio buttons above the trends chart
   - Changes apply immediately without clicking "Apply Filters"

### Exporting Data

1. Click the "Export CSV" button on any chart
2. CSV file downloads automatically with appropriate filename:
   - `catch_trends_daily.csv` or `catch_trends_monthly.csv`
   - `species_distribution.csv`
   - `regional_comparison.csv`
   - `gear_analysis.csv`

### Understanding Charts

1. **Catch Volume Trends**
   - X-axis: Time period (month or day)
   - Y-axis: Catch volume in kilograms
   - Hover over points to see exact values

2. **Species Distribution**
   - Shows top 10 species by catch volume
   - Legend shows species names
   - Tooltip shows catch volume and percentage

3. **Regional Comparison**
   - X-axis: Region names
   - Y-axis: Catch volume in kilograms
   - Bars sorted by volume

4. **Gear Type Analysis**
   - Y-axis: Gear type descriptions
   - X-axis: Catch volume in kilograms
   - Horizontal bars sorted by volume (highest first)

---

## Technical Implementation

### Data Flow

```
User Action (Filter/View Change)
    ↓
analytics.js (applyFilters/loadTrendChart)
    ↓
AnalyticsService (getCatchTrends/getSpeciesDistribution/etc.)
    ↓
Supabase Queries (Multiple table joins)
    ↓
Data Aggregation (Client-side)
    ↓
Chart.js Rendering
    ↓
Visual Display
```

### Database Queries

The analytics module performs complex queries across multiple tables:

1. **Vessel Unload** → **Gear Unload** → **Sample Day**
2. **Vessel Catch** → **Vessel Unload** → **Gear Unload** → **Sample Day**
3. **Gear Unload** → **Sample Day**

All queries include:
- Date filtering (if provided)
- Region filtering (if provided or RBAC)
- Null value filtering (excludes records with null catch values)

### Aggregation Logic

1. **Monthly Aggregation**
   - Groups data by `YYYY-MM` format
   - Labels formatted as "MMM YYYY" (e.g., "Jan 2025")

2. **Daily Aggregation**
   - Groups data by `YYYY-MM-DD` format
   - Labels formatted as "MMM DD, YYYY" (e.g., "Jan 15, 2025")

3. **Species Distribution**
   - Aggregates by species name
   - Sorts by catch volume (descending)
   - Takes top 10

4. **Regional Comparison**
   - Aggregates by region name
   - Uses Supabase foreign key relationship (`dbo_region`)

5. **Gear Analysis**
   - Aggregates by gear description
   - Sorts by catch volume (descending)

### RBAC Integration

The analytics module respects role-based access control:

- **Superadmin/Admin**: Can see all regions (filter dropdown shows all regions)
- **Encoder/Viewer**: Can only see their assigned region (filter dropdown shows only their region, and data is automatically filtered)

Filter logic:
```javascript
if (regionId) {
    // User-selected region filter takes precedence
    sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
} else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
    // RBAC: Non-admin users see only their region
    sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
}
```

---

## Filtering System

### Current Filters

1. **Date Range** (`fromDate`, `toDate`)
   - Applied to `dbo_LC_FG_sample_day.sdate`
   - Uses `gte()` and `lte()` Supabase filters

2. **Region** (`regionId`)
   - Applied to `dbo_LC_FG_sample_day.region_id`
   - Optional: "All Regions" = `null`

### Filter Application

Filters are applied in the following order:
1. Date range filtering (if provided)
2. Region filtering (if provided or RBAC)
3. Client-side aggregation and chart rendering

### Filter State Management

Filters are stored in `currentFilters` object:
```javascript
let currentFilters = {
    fromDate: null,
    toDate: null,
    regionId: null
};
```

---

## Future Improvements

### High Priority

1. **Additional Filters**
   - **Landing Center Filter**: Filter by specific landing centers
   - **Fishing Ground Filter**: Filter by specific fishing grounds
   - **Species Filter**: Filter by specific species
   - **Gear Type Filter**: Filter by specific gear types
   - **Vessel Filter**: Filter by specific vessels

2. **Performance Optimization**
   - **Caching**: Cache frequently accessed data to reduce database queries
   - **Pagination**: For large datasets, implement pagination or data sampling
   - **Lazy Loading**: Load charts on-demand instead of all at once
   - **Query Optimization**: Use database views or materialized views for complex aggregations

3. **Enhanced Visualizations**
   - **Multiple Series**: Add ability to compare multiple regions/species/gears on same chart
   - **Stacked Charts**: Stacked bar charts for multi-dimensional comparisons
   - **Heatmaps**: Time-based heatmaps for catch patterns
   - **Map Integration**: Geographic visualization of regional data

4. **Advanced Analytics**
   - **Forecasting**: Predict future catch volumes using time series analysis
   - **Anomaly Detection**: Identify unusual patterns or outliers
   - **Correlation Analysis**: Show relationships between different variables
   - **Statistical Summary**: Mean, median, standard deviation, etc.

### Medium Priority

5. **User Experience**
   - **Saved Filters**: Allow users to save and load filter presets
   - **Custom Date Ranges**: Quick select buttons (Last 7 days, Last 30 days, Last year, etc.)
   - **Chart Customization**: Allow users to change chart types, colors, etc.
   - **Dashboard Layout**: Allow users to rearrange chart positions
   - **Fullscreen Mode**: View charts in fullscreen for presentations

6. **Export Enhancements**
   - **Multiple Formats**: Export to Excel, PDF, PNG, SVG
   - **Scheduled Exports**: Email reports on a schedule
   - **Custom Reports**: Allow users to create custom report templates
   - **Batch Export**: Export all charts in one operation

7. **Data Quality**
   - **Data Validation**: Highlight missing or incomplete data
   - **Data Completeness Indicators**: Show percentage of data coverage
   - **Data Quality Metrics**: Display data quality scores

8. **Interactivity**
   - **Drill-Down**: Click on chart elements to see detailed data
   - **Cross-Chart Filtering**: Selecting a region in one chart filters others
   - **Tooltip Enhancements**: More detailed information in tooltips
   - **Zoom and Pan**: Allow users to zoom into specific time periods

### Low Priority

9. **Collaboration Features**
   - **Annotations**: Allow users to add notes/annotations to charts
   - **Sharing**: Share specific chart views with other users
   - **Comments**: Comment on specific data points or trends

10. **Mobile Optimization**
    - **Responsive Charts**: Better mobile chart rendering
    - **Touch Gestures**: Swipe, pinch-to-zoom on mobile
    - **Mobile-Specific Views**: Simplified views for mobile devices

11. **Accessibility**
    - **Screen Reader Support**: Better ARIA labels and descriptions
    - **Keyboard Navigation**: Full keyboard support for all interactions
    - **Color Blindness Support**: Color schemes accessible to color-blind users
    - **High Contrast Mode**: High contrast theme option

12. **Advanced Features**
    - **Real-Time Updates**: Live data updates without page refresh
    - **WebSocket Integration**: Push updates when new data arrives
    - **Machine Learning**: ML-powered insights and recommendations
    - **Natural Language Queries**: "Show me catch trends for tuna in Region 1"

---

## Implementation Suggestions

### Adding New Filters

To add a new filter (e.g., Landing Center):

1. **Update Service Method Signatures**
   ```javascript
   static async getCatchTrends(userProfile, fromDate, toDate, aggregation, regionId, landingCenterId = null)
   ```

2. **Update Query Logic**
   ```javascript
   if (landingCenterId) {
       sampleDayQuery = sampleDayQuery.eq('land_ctr_id', landingCenterId);
   }
   ```

3. **Update Client-Side Filter State**
   ```javascript
   let currentFilters = {
       fromDate: null,
       toDate: null,
       regionId: null,
       landingCenterId: null
   };
   ```

4. **Add UI Element**
   ```html
   <div class="col-md-3">
       <div class="filter-group">
           <label for="landingCenterFilter">Landing Center</label>
           <select class="form-control" id="landingCenterFilter">
               <option value="">All Landing Centers</option>
           </select>
       </div>
   </div>
   ```

5. **Update Filter Application**
   ```javascript
   const landingCenterId = landingCenterSelect.value ? parseInt(landingCenterSelect.value, 10) : null;
   currentFilters.landingCenterId = landingCenterId;
   ```

6. **Update All Service Calls**
   ```javascript
   await AnalyticsService.getCatchTrends(
       currentUser,
       currentFilters.fromDate,
       currentFilters.toDate,
       trendAggregation,
       currentFilters.regionId,
       currentFilters.landingCenterId
   );
   ```

### Performance Optimization Example

**Before (Multiple Sequential Queries):**
```javascript
const vesselUnloads = await getVesselUnloads();
const gearUnloads = await getGearUnloads(vesselUnloads);
const sampleDays = await getSampleDays(gearUnloads);
```

**After (Single Optimized Query with Joins):**
```javascript
const { data } = await window._supabase
    .from(TABLES.VESSEL_UNLOAD)
    .select(`
        catch_total,
        unload_gr_id,
        dbo_gear_unload(
            unload_day_id,
            dbo_LC_FG_sample_day(
                sdate,
                region_id,
                dbo_region(region_name)
            )
        )
    `);
```

### Caching Strategy

```javascript
// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCatchTrendsWithCache(...args) {
    const cacheKey = JSON.stringify(args);
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    const data = await AnalyticsService.getCatchTrends(...args);
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}
```

---

## Troubleshooting

### Common Issues

1. **Charts Not Loading**
   - Check browser console for errors
   - Verify Chart.js library is loaded
   - Verify AnalyticsService is loaded
   - Check network tab for failed API requests

2. **No Data Displayed**
   - Verify date range contains data
   - Check RBAC permissions (user may not have access to data)
   - Verify database has records in the specified date range
   - Check filter settings (may be filtering out all data)

3. **Slow Performance**
   - Large date ranges may cause slow queries
   - Consider reducing date range
   - Check database indexes on `sdate` and `region_id` columns
   - Consider implementing caching

4. **Export Not Working**
   - Check browser download settings
   - Verify browser allows file downloads
   - Check console for JavaScript errors

5. **Filter Not Applying**
   - Verify "Apply Filters" button was clicked
   - Check that filter values are valid
   - Verify service methods are receiving filter parameters
   - Check browser console for errors

### Debug Mode

Enable debug logging:
```javascript
// In analytics.js
const DEBUG = true;

if (DEBUG) {
    console.log('Current filters:', currentFilters);
    console.log('Chart data:', chartData);
}
```

---

## Best Practices

1. **Date Range Selection**
   - Use reasonable date ranges (avoid querying entire database)
   - Default to last 6 months for initial load
   - Warn users if date range is very large

2. **Error Handling**
   - Always use try-catch blocks
   - Use ErrorHandler utility for consistent error reporting
   - Show user-friendly error messages

3. **Loading States**
   - Always show loading indicators during data fetching
   - Use consistent loading UI across all operations
   - Hide loading state even if errors occur (use finally block)

4. **Data Validation**
   - Validate date ranges before querying
   - Check for null/undefined values before processing
   - Handle empty result sets gracefully

5. **Performance**
   - Load charts in parallel when possible
   - Destroy old chart instances before creating new ones
   - Avoid unnecessary re-renders

---

## Related Documentation

- [Loading Component Guide](./LOADING_COMPONENT_GUIDE.md)
- [Error Handling Guide](../ERROR_HANDLING.md)
- [RBAC Documentation](../RBAC.md)
- [Database Schema](../DATABASE_SCHEMA.md)

---

## Version History

- **v1.0** (January 2025): Initial implementation
  - Basic charts (trends, species, regional, gear)
  - Date and region filtering
  - CSV export
  - Monthly/daily trend toggle
  - Comparison statistics

---

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check network tab for failed requests
4. Contact system administrator

---

*Last Updated: January 2025*

