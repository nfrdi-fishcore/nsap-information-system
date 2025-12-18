# Analytics Performance Optimizations

## Overview

This document describes the performance optimizations implemented for the Analytics Module, including caching, lazy loading, and query optimization strategies.

## Implemented Optimizations

### 1. Caching System

**File:** `src/assets/js/utils/analyticsCache.js`

A comprehensive caching utility that stores analytics query results in memory to reduce database round trips.

#### Features:
- **Time-to-Live (TTL)**: Default 5 minutes, configurable per cache entry
- **LRU Eviction**: Automatically removes oldest entries when cache reaches max size (100 entries)
- **Automatic Cleanup**: Expired entries are cleaned every minute
- **Deep Copying**: Prevents cache mutation by storing deep copies of data
- **Pattern-Based Clearing**: Clear cache entries matching specific patterns

#### Usage:
```javascript
// Cache is automatically used by AnalyticsService methods
// Manual cache operations:
window.AnalyticsCache.clear(); // Clear all cache
window.AnalyticsCache.clearPattern('getCatchTrends'); // Clear specific pattern
window.AnalyticsCache.getStats(); // Get cache statistics
```

#### Cache TTL by Method:
- **getCatchTrends**: 5 minutes (default)
- **getSpeciesDistribution**: 3 minutes (shorter due to more frequent changes)
- **getRegionalComparison**: 5 minutes
- **getGearAnalysis**: 5 minutes
- **getComparisonStats**: 5 minutes

### 2. Query Optimization

**File:** `src/assets/js/services/analyticsService.js`

All service methods have been optimized to:
- **Apply filters early**: Start queries from the most selective table (sample days) with date/region filters applied first
- **Reduce data transfer**: Filter at database level before fetching related records
- **Minimize round trips**: Use `.in()` filters instead of multiple individual queries

#### Before (Inefficient):
```javascript
// 1. Get all vessel unloads (potentially thousands)
const vesselUnloads = await getVesselUnloads();

// 2. Get gear unloads for those vessel unloads
const gearUnloads = await getGearUnloads(vesselUnloadIds);

// 3. Get sample days for those gear unloads
const sampleDays = await getSampleDays(sampleDayIds);

// 4. Filter sample days by date/region (too late!)
```

#### After (Optimized):
```javascript
// 1. Get sample days with date/region filters applied FIRST (most selective)
const sampleDays = await getSampleDays()
    .gte('sdate', fromDate)
    .eq('region_id', regionId);

// 2. Get gear unloads only for filtered sample days
const gearUnloads = await getGearUnloads()
    .in('unload_day_id', sampleDayIds);

// 3. Get vessel unloads only for filtered gear unloads
const vesselUnloads = await getVesselUnloads()
    .in('unload_gr_id', gearUnloadIds);
```

#### Performance Impact:
- **Reduced data transfer**: Only fetch records that match filters
- **Faster queries**: Database can use indexes more effectively
- **Lower memory usage**: Process smaller datasets

### 3. Lazy Loading

**File:** `src/assets/js/modules/analytics.js`

Charts are loaded on-demand using the Intersection Observer API, loading only when they become visible in the viewport.

#### Implementation:
- **Comparison Stats**: Always loaded immediately (small, fast, always visible)
- **Trend Chart**: Always loaded immediately (primary chart, always visible)
- **Other Charts**: Loaded when scrolled into view (100px before visible)

#### Benefits:
- **Faster initial load**: Only load visible charts
- **Reduced initial bandwidth**: Don't fetch data for off-screen charts
- **Better user experience**: Page appears faster, charts load as needed

#### Fallback:
If Intersection Observer is not supported, all charts load immediately (graceful degradation).

### 4. Cache Integration

All service methods now:
1. Check cache before querying database
2. Store results in cache after successful queries
3. Clear cache when filters change

#### Cache Key Generation:
Cache keys are generated from method name and all parameters, ensuring:
- Different filters = different cache entries
- Same filters = cache hit (no database query)
- Automatic invalidation when filters change

## Performance Metrics

### Expected Improvements:

1. **Initial Load Time**: 
   - Before: ~3-5 seconds (all charts load)
   - After: ~1-2 seconds (only visible charts load)
   - **Improvement: 50-60% faster**

2. **Subsequent Loads** (same filters):
   - Before: ~3-5 seconds (always queries database)
   - After: <100ms (served from cache)
   - **Improvement: 95%+ faster**

3. **Database Load**:
   - Before: 5 queries per page load (all charts)
   - After: 0-2 queries (cache hits + lazy loading)
   - **Improvement: 60-100% reduction**

4. **Memory Usage**:
   - Cache size: Max 100 entries (~5-10MB typical)
   - Auto-cleanup prevents memory leaks
   - **Impact: Minimal, well-managed**

## Configuration

### Cache Settings

Default settings in `analyticsCache.js`:
```javascript
defaultTTL: 5 * 60 * 1000,  // 5 minutes
maxCacheSize: 100,           // Maximum entries
```

To customize:
```javascript
// Change default TTL
window.AnalyticsCache.defaultTTL = 10 * 60 * 1000; // 10 minutes

// Change max cache size
window.AnalyticsCache.maxCacheSize = 200;
```

### Lazy Loading Settings

Lazy loading uses Intersection Observer with:
- **rootMargin**: `'100px'` (start loading 100px before visible)
- **threshold**: `0.1` (10% of element must be visible)

To customize in `analytics.js`:
```javascript
const observerOptions = {
    root: null,
    rootMargin: '100px',  // Adjust preload distance
    threshold: 0.1        // Adjust visibility threshold
};
```

## Cache Management

### Manual Cache Operations

```javascript
// Clear all cache
window.AnalyticsCache.clear();

// Clear specific method cache
window.AnalyticsCache.clearPattern('getCatchTrends');

// Get cache statistics
const stats = window.AnalyticsCache.getStats();
console.log(stats);
// {
//   total: 45,
//   valid: 42,
//   expired: 3,
//   maxSize: 100
// }
```

### Automatic Cache Invalidation

Cache is automatically cleared when:
- Filters change (date range, region)
- User applies new filters
- Page is refreshed

## Monitoring

### Cache Statistics

Monitor cache performance:
```javascript
// In browser console
window.AnalyticsCache.getStats();
```

### Performance Timing

Monitor query performance:
```javascript
// Add timing to service methods
const start = performance.now();
const data = await AnalyticsService.getCatchTrends(...);
const end = performance.now();
console.log(`Query took ${end - start}ms`);
```

## Best Practices

1. **Cache TTL Selection**:
   - Use shorter TTL (3 min) for frequently changing data (species)
   - Use longer TTL (5 min) for stable data (trends, regions)

2. **Query Optimization**:
   - Always apply most selective filters first
   - Use `.in()` for batch filtering instead of multiple queries
   - Filter at database level, not client-side

3. **Lazy Loading**:
   - Load critical charts immediately (trends, stats)
   - Defer non-critical charts (species, regional, gear)
   - Use appropriate `rootMargin` for smooth UX

4. **Cache Management**:
   - Clear cache when data changes (filters, user actions)
   - Monitor cache size and hit rates
   - Adjust TTL based on data update frequency

## Troubleshooting

### Cache Not Working

1. **Check if cache is loaded**:
   ```javascript
   console.log(typeof window.AnalyticsCache); // Should be 'object'
   ```

2. **Check cache statistics**:
   ```javascript
   console.log(window.AnalyticsCache.getStats());
   ```

3. **Verify cache key generation**:
   ```javascript
   const key = window.AnalyticsCache.generateKey('getCatchTrends', [user, fromDate, toDate, 'monthly', regionId]);
   console.log(key);
   ```

### Lazy Loading Not Working

1. **Check Intersection Observer support**:
   ```javascript
   console.log(typeof IntersectionObserver); // Should be 'function'
   ```

2. **Check element visibility**:
   ```javascript
   const el = document.getElementById('speciesChart');
   console.log(isElementVisible(el));
   ```

3. **Check lazy load state**:
   ```javascript
   console.log(lazyLoadState); // Check if chart is marked as loaded
   ```

### Performance Issues

1. **Check cache hit rate**:
   - Monitor cache statistics over time
   - Low hit rate = cache not effective (check TTL, filter changes)

2. **Check query performance**:
   - Use browser DevTools Network tab
   - Look for slow queries (>1 second)
   - Check if queries are using indexes

3. **Check memory usage**:
   - Monitor cache size
   - Clear cache if memory usage is high
   - Adjust `maxCacheSize` if needed

## Future Enhancements

1. **IndexedDB Caching**: Persist cache across page refreshes
2. **Service Worker**: Cache API responses for offline support
3. **Query Batching**: Batch multiple queries into single request
4. **Progressive Loading**: Load chart data in chunks
5. **WebSocket Updates**: Real-time cache invalidation when data changes

## Related Documentation

- [Analytics Guide](./ANALYTICS_GUIDE.md)
- [Loading Component Guide](./LOADING_COMPONENT_GUIDE.md)

---

*Last Updated: January 2025*

