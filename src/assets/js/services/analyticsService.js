/**
 * Analytics Service - NSAP Information System
 * 
 * Handles all data fetching for analytics dashboard
 * Provides methods for trend analysis, comparative analysis, and data aggregation
 * 
 * Note: Requires constants.js to be loaded first (ADMIN_ROLES, TABLES)
 * Note: Uses AnalyticsCache for performance optimization
 */

class AnalyticsService {
    /**
     * Check cache and return cached data if available
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @returns {Object|null} Cached data or null
     */
    static _getCached(method, args) {
        if (typeof window === 'undefined' || !window.AnalyticsCache) {
            return null;
        }
        const key = window.AnalyticsCache.generateKey(method, args);
        return window.AnalyticsCache.get(key);
    }

    /**
     * Store data in cache
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @param {Object} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    static _setCache(method, args, data, ttl = null) {
        if (typeof window === 'undefined' || !window.AnalyticsCache) {
            return;
        }
        const key = window.AnalyticsCache.generateKey(method, args);
        window.AnalyticsCache.set(key, data, ttl);
    }

    /**
     * Clear cache for a specific method pattern
     * @param {string} pattern - Pattern to match
     */
    static clearCache(pattern) {
        if (typeof window !== 'undefined' && window.AnalyticsCache) {
            window.AnalyticsCache.clearPattern(pattern);
        }
    }
    /**
     * Get catch trends over time
     * @param {Object} userProfile - Current user profile with role and region_id
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {string} aggregation - Aggregation type: 'monthly' or 'daily' (default: 'monthly')
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getCatchTrends(userProfile, fromDate = null, toDate = null, aggregation = 'monthly', regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, aggregation, regionId];
            const cached = this._getCached('getCatchTrends', args);
            if (cached) {
                return cached;
            }

            // Optimized query: Start with sample days (apply filters early) and use joins
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early (most selective filter)
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getCatchTrends', args, emptyResult);
                return emptyResult;
            }

            // Get sample day IDs
            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads for these sample days (optimized: filter by sample day IDs)
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getCatchTrends', args, emptyResult);
                return emptyResult;
            }

            // Get gear unload IDs
            const gearUnloadIds = [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];

            // Get vessel unloads for these gear unloads (optimized: filter by gear unload IDs)
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            if (!vesselUnloads || vesselUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getCatchTrends', args, emptyResult);
                return emptyResult;
            }

            // Create maps for quick lookup
            const gearUnloadMap = {};
            gearUnloads.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu.unload_day_id;
            });

            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            // Group by month or day based on aggregation type
            const aggregatedData = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            vesselUnloads.forEach(vu => {
                const gearUnloadId = vu.unload_gr_id;
                const sampleDayId = gearUnloadMap[gearUnloadId];
                const sampleDay = sampleDayMap[sampleDayId];

                if (sampleDay && sampleDay.sdate && vu.catch_total) {
                    const date = new Date(sampleDay.sdate);
                    let key;
                    
                    if (aggregation === 'daily') {
                        // Group by day: YYYY-MM-DD
                        key = sampleDay.sdate; // Use the date string directly
                    } else {
                        // Group by month: YYYY-MM
                        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    }
                    
                    aggregatedData[key] = (aggregatedData[key] || 0) + parseFloat(vu.catch_total);
                }
            });

            // Generate labels and values
            const labels = [];
            const values = [];
            const sortedKeys = Object.keys(aggregatedData).sort();

            sortedKeys.forEach(key => {
                if (aggregation === 'daily') {
                    // Format date as "MMM DD, YYYY"
                    const date = new Date(key);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
                } else {
                    // Format as "MMM YYYY"
                    const [year, month] = key.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    labels.push(`${monthNames[date.getMonth()]} ${year}`);
                }
                values.push(aggregatedData[key]);
            });

            const result = { labels, values, rawData: vesselUnloads };
            // Cache result
            this._setCache('getCatchTrends', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getCatchTrends',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get species distribution
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getSpeciesDistribution(userProfile, fromDate = null, toDate = null, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getSpeciesDistribution', args);
            if (cached) {
                return cached;
            }

            // Optimized query: Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getSpeciesDistribution', args, emptyResult, 3 * 60 * 1000);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);
            const sampleDayMapSpecies = {};
            sampleDays.forEach(sd => {
                sampleDayMapSpecies[sd.unload_day_id] = sd;
            });

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getSpeciesDistribution', args, emptyResult, 3 * 60 * 1000);
                return emptyResult;
            }

            const gearUnloadIds = [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];
            const gearUnloadMapSpecies = {};
            gearUnloads.forEach(gu => {
                gearUnloadMapSpecies[gu.unload_gr_id] = gu.unload_day_id;
            });

            // Get vessel unloads for these gear unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds);

            if (vuError) throw vuError;

            if (!vesselUnloads || vesselUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getSpeciesDistribution', args, emptyResult, 3 * 60 * 1000);
                return emptyResult;
            }

            const vesselUnloadIds = vesselUnloads.map(vu => vu.v_unload_id);
            const vesselUnloadMapForSpecies = {};
            vesselUnloads.forEach(vu => {
                vesselUnloadMapForSpecies[vu.v_unload_id] = vu.unload_gr_id;
            });

            // Get vessel catches for these vessel unloads
            const { data: vesselCatches, error: vcError } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .select('catch_id, catch_kg, species_id, v_unload_id')
                .in('v_unload_id', vesselUnloadIds)
                .not('catch_kg', 'is', null);

            if (vcError) throw vcError;

            // Get species IDs
            const speciesIds = [...new Set(vesselCatches.map(vc => vc.species_id).filter(Boolean))];

            // Get species names
            const { data: species, error: spError } = await window._supabase
                .from(TABLES.SPECIES)
                .select('species_id, sp_name')
                .in('species_id', speciesIds);

            if (spError) throw spError;

            // Create maps
            const vesselUnloadMap = {};
            vesselUnloads.forEach(vu => {
                vesselUnloadMap[vu.v_unload_id] = vu.unload_gr_id;
            });

            const gearUnloadMap = {};
            gearUnloads.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu.unload_day_id;
            });

            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            const speciesMap = {};
            species.forEach(sp => {
                speciesMap[sp.species_id] = sp.sp_name;
            });

            // Aggregate by species
            const speciesData = {};

            vesselCatches.forEach(vc => {
                const vesselUnloadId = vc.v_unload_id;
                const gearUnloadId = vesselUnloadMapForSpecies[vesselUnloadId];
                const sampleDayId = gearUnloadMapSpecies[gearUnloadId];
                const sampleDay = sampleDayMapSpecies[sampleDayId];

                // Only include if sample day matches date filter
                if (sampleDay) {
                    const speciesName = speciesMap[vc.species_id] || 'Unknown';
                    const catchKg = parseFloat(vc.catch_kg) || 0;
                    speciesData[speciesName] = (speciesData[speciesName] || 0) + catchKg;
                }
            });

            // Sort by value and get top 10
            const sortedSpecies = Object.entries(speciesData)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const labels = sortedSpecies.map(([name]) => name);
            const values = sortedSpecies.map(([, value]) => value);

            const result = { labels, values, rawData: vesselCatches };
            // Cache result (shorter TTL for species as it changes more frequently)
            this._setCache('getSpeciesDistribution', [userProfile, fromDate, toDate, regionId], result, 3 * 60 * 1000);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getSpeciesDistribution',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get regional comparison
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getRegionalComparison(userProfile, fromDate = null, toDate = null, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getRegionalComparison', args);
            if (cached) {
                return cached;
            }

            // Optimized query: Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id, dbo_region(region_name)');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getRegionalComparison', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);
            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getRegionalComparison', args, emptyResult);
                return emptyResult;
            }

            const gearUnloadIds = [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];
            const gearUnloadMap = {};
            gearUnloads.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu.unload_day_id;
            });

            // Get vessel unloads for these gear unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            // Aggregate by region
            const regionData = {};

            vesselUnloads.forEach(vu => {
                const gearUnloadId = vu.unload_gr_id;
                const sampleDayId = gearUnloadMap[gearUnloadId];
                const sampleDay = sampleDayMap[sampleDayId];

                if (sampleDay && vu.catch_total) {
                    const region = sampleDay.dbo_region;
                    const regionName = region?.region_name || 'Unknown';
                    regionData[regionName] = (regionData[regionName] || 0) + parseFloat(vu.catch_total);
                }
            });

            const labels = Object.keys(regionData);
            const values = Object.values(regionData);

            const result = { labels, values, rawData: vesselUnloads };
            // Cache result
            this._setCache('getRegionalComparison', [userProfile, fromDate, toDate, regionId], result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getRegionalComparison',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get gear type analysis
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getGearAnalysis(userProfile, fromDate = null, toDate = null, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getGearAnalysis', args);
            if (cached) {
                return cached;
            }

            // Optimized query: Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], rawData: [] };
                this._setCache('getGearAnalysis', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);
            const sampleDayMapGear = {};
            sampleDays.forEach(sd => {
                sampleDayMapGear[sd.unload_day_id] = sd;
            });

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, catch, gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds)
                .not('catch', 'is', null);

            if (guError) throw guError;

            // Get gear IDs
            const gearIds = [...new Set(gearUnloads.map(gu => gu.gr_id).filter(Boolean))];

            // Get gear descriptions
            const { data: gears, error: gearError } = await window._supabase
                .from(TABLES.GEAR)
                .select('gr_id, gear_desc')
                .in('gr_id', gearIds);

            if (gearError) throw gearError;

            const gearMap = {};
            gears.forEach(g => {
                gearMap[g.gr_id] = g.gear_desc;
            });

            // Aggregate by gear type
            const gearData = {};

            gearUnloads.forEach(gu => {
                const sampleDay = sampleDayMapGear[gu.unload_day_id];
                // Only include if sample day matches date filter
                if (sampleDay) {
                    const gearDesc = gearMap[gu.gr_id] || 'Unknown';
                    const catchKg = parseFloat(gu.catch) || 0;
                    gearData[gearDesc] = (gearData[gearDesc] || 0) + catchKg;
                }
            });

            // Sort by value
            const sortedGear = Object.entries(gearData)
                .sort((a, b) => b[1] - a[1]);

            const labels = sortedGear.map(([name]) => name);
            const values = sortedGear.map(([, value]) => value);

            const result = { labels, values, rawData: gearUnloads };
            // Cache result
            this._setCache('getGearAnalysis', [userProfile, fromDate, toDate, regionId], result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getGearAnalysis',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get comparison statistics (current vs previous period)
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Comparison statistics
     */
    static async getComparisonStats(userProfile, fromDate, toDate, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getComparisonStats', args);
            if (cached) {
                return cached;
            }

            // Calculate previous period dates
            const periodDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
            const prevToDate = new Date(fromDate);
            prevToDate.setDate(prevToDate.getDate() - 1);
            const prevFromDate = new Date(prevToDate);
            prevFromDate.setDate(prevFromDate.getDate() - periodDays);

            // Get current period data (will use cache if available)
            const [currentTrends, currentVesselData, currentSampleDayData] = await Promise.all([
                this.getCatchTrends(userProfile, fromDate, toDate, 'monthly', regionId),
                this.getVesselStats(userProfile, fromDate, toDate, regionId),
                this.getSampleDayStats(userProfile, fromDate, toDate, regionId)
            ]);

            // Get previous period data (will use cache if available)
            const [prevTrends, prevVesselData, prevSampleDayData] = await Promise.all([
                this.getCatchTrends(userProfile, prevFromDate, prevToDate, 'monthly', regionId),
                this.getVesselStats(userProfile, prevFromDate, prevToDate, regionId),
                this.getSampleDayStats(userProfile, prevFromDate, prevToDate, regionId)
            ]);

            // Calculate totals
            const currentTotal = currentTrends.values.reduce((sum, val) => sum + val, 0);
            const prevTotal = prevTrends.values.reduce((sum, val) => sum + val, 0);
            const totalChange = currentTotal - prevTotal;
            const totalChangePercent = prevTotal > 0 ? ((totalChange / prevTotal) * 100).toFixed(1) : 0;

            // Calculate average catch per day
            const currentAvgCatchPerDay = currentSampleDayData.count > 0 
                ? currentTotal / currentSampleDayData.count 
                : 0;
            const prevAvgCatchPerDay = prevSampleDayData.count > 0 
                ? prevTotal / prevSampleDayData.count 
                : 0;
            const avgCatchChange = currentAvgCatchPerDay - prevAvgCatchPerDay;
            const avgCatchChangePercent = prevAvgCatchPerDay > 0 
                ? ((avgCatchChange / prevAvgCatchPerDay) * 100).toFixed(1) 
                : 0;

            // Calculate vessel count change
            const vesselChange = currentVesselData.count - prevVesselData.count;
            const vesselChangePercent = prevVesselData.count > 0 
                ? ((vesselChange / prevVesselData.count) * 100).toFixed(1) 
                : 0;

            const result = {
                totalCatch: {
                    current: currentTotal,
                    previous: prevTotal,
                    change: totalChange,
                    changePercent: totalChangePercent
                },
                avgCatchPerDay: {
                    current: currentAvgCatchPerDay,
                    previous: prevAvgCatchPerDay,
                    change: avgCatchChange,
                    changePercent: avgCatchChangePercent
                },
                vesselCount: {
                    current: currentVesselData.count,
                    previous: prevVesselData.count,
                    change: vesselChange,
                    changePercent: vesselChangePercent
                }
            };

            // Cache result
            this._setCache('getComparisonStats', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getComparisonStats',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get vessel statistics (unique vessel count)
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Vessel statistics with count
     */
    static async getVesselStats(userProfile, fromDate = null, toDate = null, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getVesselStats', args);
            if (cached) {
                return cached;
            }

            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { count: 0 };
                this._setCache('getVesselStats', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { count: 0 };
                this._setCache('getVesselStats', args, emptyResult);
                return emptyResult;
            }

            const gearUnloadIds = [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];

            // Get vessel unloads for these gear unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, boat_id')
                .in('unload_gr_id', gearUnloadIds);

            if (vuError) throw vuError;

            if (!vesselUnloads || vesselUnloads.length === 0) {
                const emptyResult = { count: 0 };
                this._setCache('getVesselStats', args, emptyResult);
                return emptyResult;
            }

            // Get unique vessel IDs
            const uniqueVesselIds = [...new Set(vesselUnloads.map(vu => vu.boat_id).filter(Boolean))];

            const result = { count: uniqueVesselIds.length };
            this._setCache('getVesselStats', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getVesselStats',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get sample day statistics (count of sample days/landings)
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @returns {Promise<Object>} Sample day statistics with count
     */
    static async getSampleDayStats(userProfile, fromDate = null, toDate = null, regionId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId];
            const cached = this._getCached('getSampleDayStats', args);
            if (cached) {
                return cached;
            }

            // Query sample days with filters
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id', { count: 'exact', head: false });

            // Apply date filtering
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, count, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            const result = { count: count || (sampleDays ? sampleDays.length : 0) };
            this._setCache('getSampleDayStats', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getSampleDayStats',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top vessels by catch volume
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @param {number} limit - Number of top vessels to return (default: 10)
     * @returns {Promise<Object>} Chart data with labels, values, and percentages
     */
    static async getTopVessels(userProfile, fromDate = null, toDate = null, regionId = null, limit = 10) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId, limit];
            const cached = this._getCached('getTopVessels', args);
            if (cached) {
                return cached;
            }

            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopVessels', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopVessels', args, emptyResult);
                return emptyResult;
            }

            const gearUnloadIds = [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];

            // Get vessel unloads for these gear unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, boat_id, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            if (!vesselUnloads || vesselUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopVessels', args, emptyResult);
                return emptyResult;
            }

            // Aggregate by vessel
            const vesselData = {};
            vesselUnloads.forEach(vu => {
                if (vu.boat_id && vu.catch_total) {
                    vesselData[vu.boat_id] = (vesselData[vu.boat_id] || 0) + parseFloat(vu.catch_total);
                }
            });

            // Get vessel names
            const vesselIds = Object.keys(vesselData).map(id => parseInt(id, 10));
            const { data: vessels, error: vesselError } = await window._supabase
                .from(TABLES.VESSEL)
                .select('boat_id, vesselname')
                .in('boat_id', vesselIds);

            if (vesselError) throw vesselError;

            const vesselMap = {};
            vessels.forEach(v => {
                vesselMap[v.boat_id] = v.vesselname || `Vessel ${v.boat_id}`;
            });

            // Calculate total for percentages
            const totalCatch = Object.values(vesselData).reduce((sum, val) => sum + val, 0);

            // Sort and limit
            const sortedVessels = Object.entries(vesselData)
                .map(([id, catchTotal]) => ({
                    id: parseInt(id, 10),
                    name: vesselMap[parseInt(id, 10)] || `Vessel ${id}`,
                    catch: catchTotal,
                    percentage: totalCatch > 0 ? ((catchTotal / totalCatch) * 100).toFixed(1) : 0
                }))
                .sort((a, b) => b.catch - a.catch)
                .slice(0, limit);

            const labels = sortedVessels.map(v => v.name);
            const values = sortedVessels.map(v => v.catch);
            const percentages = sortedVessels.map(v => parseFloat(v.percentage));

            const result = { labels, values, percentages, rawData: sortedVessels };
            this._setCache('getTopVessels', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getTopVessels',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top species by catch volume
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @param {number} limit - Number of top species to return (default: 10)
     * @returns {Promise<Object>} Chart data with labels, values, and percentages
     */
    static async getTopSpecies(userProfile, fromDate = null, toDate = null, regionId = null, limit = 10) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId, limit];
            const cached = this._getCached('getTopSpecies', args);
            if (cached) {
                return cached;
            }

            // Reuse species distribution logic but sort and limit
            const speciesData = await this.getSpeciesDistribution(userProfile, fromDate, toDate, regionId);

            if (!speciesData.labels || speciesData.labels.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopSpecies', args, emptyResult);
                return emptyResult;
            }

            // Calculate total for percentages
            const totalCatch = speciesData.values.reduce((sum, val) => sum + val, 0);

            // Combine labels and values, sort by value, and limit
            const combined = speciesData.labels.map((label, index) => ({
                name: label,
                catch: speciesData.values[index],
                percentage: totalCatch > 0 ? ((speciesData.values[index] / totalCatch) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.catch - a.catch)
            .slice(0, limit);

            const labels = combined.map(s => s.name);
            const values = combined.map(s => s.catch);
            const percentages = combined.map(s => parseFloat(s.percentage));

            const result = { labels, values, percentages, rawData: combined };
            this._setCache('getTopSpecies', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getTopSpecies',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top landing centers by catch volume
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @param {number} limit - Number of top landing centers to return (default: 10)
     * @returns {Promise<Object>} Chart data with labels, values, and percentages
     */
    static async getTopLandingCenters(userProfile, fromDate = null, toDate = null, regionId = null, limit = 10) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId, limit];
            const cached = this._getCached('getTopLandingCenters', args);
            if (cached) {
                return cached;
            }

            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id, land_ctr_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopLandingCenters', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);
            
            // Create map of sample day to landing center
            const sampleDayToLC = {};
            sampleDays.forEach(sd => {
                if (sd.land_ctr_id) {
                    sampleDayToLC[sd.unload_day_id] = sd.land_ctr_id;
                }
            });

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, catch')
                .in('unload_day_id', sampleDayIds)
                .not('catch', 'is', null);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopLandingCenters', args, emptyResult);
                return emptyResult;
            }

            // Aggregate by landing center (collect unique IDs from actual data)
            const lcData = {};
            const uniqueLCIds = new Set();
            gearUnloads.forEach(gu => {
                const lcId = sampleDayToLC[gu.unload_day_id];
                if (lcId && gu.catch) {
                    // Keep ID as string (UUID) - don't convert to number
                    const idKey = String(lcId);
                    uniqueLCIds.add(idKey);
                    lcData[idKey] = (lcData[idKey] || 0) + parseFloat(gu.catch);
                }
            });

            // Get landing center names for all unique IDs we found
            const landingCenterIdsArray = Array.from(uniqueLCIds);
            if (landingCenterIdsArray.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopLandingCenters', args, emptyResult);
                return emptyResult;
            }

            const { data: landingCenters, error: lcError } = await window._supabase
                .from(TABLES.LANDING_CENTER)
                .select('land_ctr_id, landing_center')
                .in('land_ctr_id', landingCenterIdsArray);

            if (lcError) throw lcError;

            // Create map using string keys (UUIDs)
            const lcMap = {};
            if (landingCenters && landingCenters.length > 0) {
                landingCenters.forEach(lc => {
                    // Use string key for UUID
                    const idKey = String(lc.land_ctr_id);
                    // Prioritize landing_center name, only use ID as fallback if name is missing
                    const lcName = lc.landing_center && lc.landing_center.trim() ? lc.landing_center : `LC ${idKey.substring(0, 8)}...`;
                    lcMap[idKey] = lcName;
                });
            }

            // Calculate total for percentages
            const totalCatch = Object.values(lcData).reduce((sum, val) => sum + val, 0);

            // Sort and limit - use string keys (UUIDs)
            const sortedLCs = Object.entries(lcData)
                .map(([idKey, catchTotal]) => {
                    return {
                        id: idKey,
                        name: lcMap[idKey] || `LC ${idKey.substring(0, 8)}...`,
                        catch: catchTotal,
                        percentage: totalCatch > 0 ? ((catchTotal / totalCatch) * 100).toFixed(1) : 0
                    };
                })
                .sort((a, b) => b.catch - a.catch)
                .slice(0, limit);

            const labels = sortedLCs.map(lc => lc.name);
            const values = sortedLCs.map(lc => lc.catch);
            const percentages = sortedLCs.map(lc => parseFloat(lc.percentage));

            const result = { labels, values, percentages, rawData: sortedLCs };
            this._setCache('getTopLandingCenters', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getTopLandingCenters',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top fishing grounds by catch volume
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @param {number} limit - Number of top fishing grounds to return (default: 10)
     * @returns {Promise<Object>} Chart data with labels, values, and percentages
     */
    static async getTopFishingGrounds(userProfile, fromDate = null, toDate = null, regionId = null, limit = 10) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId, limit];
            const cached = this._getCached('getTopFishingGrounds', args);
            if (cached) {
                return cached;
            }

            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id, ground_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopFishingGrounds', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);
            const fishingGroundIds = [...new Set(sampleDays.map(sd => sd.ground_id).filter(Boolean))];

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, catch')
                .in('unload_day_id', sampleDayIds)
                .not('catch', 'is', null);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopFishingGrounds', args, emptyResult);
                return emptyResult;
            }

            // Create map of sample day to fishing ground
            const sampleDayToFG = {};
            sampleDays.forEach(sd => {
                if (sd.ground_id) {
                    sampleDayToFG[sd.unload_day_id] = sd.ground_id;
                }
            });

            // Aggregate by fishing ground (collect unique IDs from actual data)
            const fgData = {};
            const uniqueFGIds = new Set();
            gearUnloads.forEach(gu => {
                const fgId = sampleDayToFG[gu.unload_day_id];
                if (fgId && gu.catch) {
                    // Keep ID as original type (could be number or string)
                    const idKey = typeof fgId === 'number' ? fgId : String(fgId);
                    uniqueFGIds.add(idKey);
                    fgData[idKey] = (fgData[idKey] || 0) + parseFloat(gu.catch);
                }
            });

            // Get fishing ground names for all unique IDs we found
            const fishingGroundIdsArray = Array.from(uniqueFGIds);
            if (fishingGroundIdsArray.length === 0) {
                const emptyResult = { labels: [], values: [], percentages: [], rawData: [] };
                this._setCache('getTopFishingGrounds', args, emptyResult);
                return emptyResult;
            }

            const { data: fishingGrounds, error: fgError } = await window._supabase
                .from(TABLES.FISHING_GROUND)
                .select('ground_id, ground_desc')
                .in('ground_id', fishingGroundIdsArray);

            if (fgError) throw fgError;

            // Create map using consistent key types
            const fgMap = {};
            if (fishingGrounds && fishingGrounds.length > 0) {
                fishingGrounds.forEach(fg => {
                    // Use consistent key type for lookup
                    const idKey = typeof fg.ground_id === 'number' ? fg.ground_id : String(fg.ground_id);
                    // Prioritize ground_desc description, only use ID as fallback if description is missing
                    const fgDesc = fg.ground_desc && fg.ground_desc.trim() ? fg.ground_desc : `FG ${idKey}`;
                    fgMap[idKey] = fgDesc;
                });
            }

            // Calculate total for percentages
            const totalCatch = Object.values(fgData).reduce((sum, val) => sum + val, 0);

            // Sort and limit - use consistent key types
            const sortedFGs = Object.entries(fgData)
                .map(([idKey, catchTotal]) => {
                    // Ensure key type matches what we used in fgMap
                    const lookupKey = typeof idKey === 'number' ? idKey : (isNaN(Number(idKey)) ? idKey : Number(idKey));
                    return {
                        id: lookupKey,
                        name: fgMap[lookupKey] || fgMap[idKey] || `FG ${idKey}`,
                        catch: catchTotal,
                        percentage: totalCatch > 0 ? ((catchTotal / totalCatch) * 100).toFixed(1) : 0
                    };
                })
                .sort((a, b) => b.catch - a.catch)
                .slice(0, limit);

            const labels = sortedFGs.map(fg => fg.name);
            const values = sortedFGs.map(fg => fg.catch);
            const percentages = sortedFGs.map(fg => parseFloat(fg.percentage));

            const result = { labels, values, percentages, rawData: sortedFGs };
            this._setCache('getTopFishingGrounds', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getTopFishingGrounds',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get all regions for filter dropdown
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Array>} Array of region objects
     */
    static async getRegions(userProfile) {
        try {
            let query = window._supabase
                .from(TABLES.REGION)
                .select('region_id, region_name')
                .order('region_name', { ascending: true });

            // Apply RBAC filtering
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            return data || [];
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getRegions',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get efficiency metrics
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date (optional)
     * @param {Date} toDate - End date (optional)
     * @param {number} regionId - Region ID to filter by (optional)
     * @param {number} gearId - Gear ID to filter by (optional)
     * @param {number} effortUnitId - Effort unit ID to filter by (optional)
     * @param {number} vesselId - Vessel ID to filter by (optional)
     * @returns {Promise<Object>} Efficiency metrics
     */
    static async getEfficiencyMetrics(userProfile, fromDate = null, toDate = null, regionId = null, gearId = null, effortUnitId = null, vesselId = null) {
        try {
            // Check cache first
            const args = [userProfile, fromDate, toDate, regionId, gearId, effortUnitId, vesselId];
            const cached = this._getCached('getEfficiencyMetrics', args);
            if (cached) {
                return cached;
            }

            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id');

            // Apply date filtering early
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC filtering or region filter early
            if (regionId) {
                sampleDayQuery = sampleDayQuery.eq('region_id', regionId);
            } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                sampleDayQuery = sampleDayQuery.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                const emptyResult = {
                    catchPerVessel: 0,
                    catchPerGear: {},
                    catchPerEffort: 0,
                    catchPerSampleDay: 0,
                    totalCatch: 0,
                    uniqueVessels: 0,
                    sampleDayCount: 0,
                    totalEffort: 0
                };
                this._setCache('getEfficiencyMetrics', args, emptyResult);
                return emptyResult;
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads for these sample days
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, catch, gr_id')
                .in('unload_day_id', sampleDayIds)
                .not('catch', 'is', null);

            if (guError) throw guError;

            if (!gearUnloads || gearUnloads.length === 0) {
                const emptyResult = {
                    catchPerVessel: 0,
                    catchPerGear: {},
                    catchPerEffort: 0,
                    catchPerSampleDay: 0,
                    totalCatch: 0,
                    uniqueVessels: 0,
                    sampleDayCount: 0,
                    totalEffort: 0
                };
                this._setCache('getEfficiencyMetrics', args, emptyResult);
                return emptyResult;
            }

            // Filter gear unloads by gearId if specified
            let filteredGearUnloads = gearUnloads;
            if (gearId) {
                filteredGearUnloads = gearUnloads.filter(gu => gu.gr_id === parseInt(gearId, 10));
            }

            const gearUnloadIds = [...new Set(filteredGearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];

            // Get vessel unloads for filtered gear unloads
            let vesselUnloadQuery = window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, boat_id, catch_total, effort, unload_gr_id, uniteffort_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            // Filter by effort unit if specified
            if (effortUnitId) {
                vesselUnloadQuery = vesselUnloadQuery.eq('uniteffort_id', parseInt(effortUnitId, 10));
            }

            // Filter by vessel if specified
            if (vesselId) {
                vesselUnloadQuery = vesselUnloadQuery.eq('boat_id', parseInt(vesselId, 10));
            }

            const { data: vesselUnloads, error: vuError } = await vesselUnloadQuery;

            if (vuError) throw vuError;

            // Use vessel unloads as filtered (already filtered by effortUnitId and vesselId if specified)
            const filteredVesselUnloads = vesselUnloads;

            // Calculate total catch with filtered data
            const totalCatch = filteredGearUnloads.reduce((sum, gu) => sum + (parseFloat(gu.catch) || 0), 0);

            // Get unique vessels from filtered vessel unloads
            const uniqueVesselIds = [...new Set(filteredVesselUnloads.map(vu => vu.boat_id).filter(Boolean))];
            const uniqueVessels = uniqueVesselIds.length;

            // Calculate catch per vessel
            const catchPerVessel = uniqueVessels > 0 ? totalCatch / uniqueVessels : 0;

            // Calculate catch per gear type
            const gearCatchMap = {};
            const gearCountMap = {};
            filteredGearUnloads.forEach(gu => {
                if (gu.gr_id && gu.catch) {
                    const gearId = gu.gr_id;
                    gearCatchMap[gearId] = (gearCatchMap[gearId] || 0) + parseFloat(gu.catch);
                    gearCountMap[gearId] = (gearCountMap[gearId] || 0) + 1;
                }
            });

            // Get gear names
            const gearIds = Object.keys(gearCatchMap).map(id => parseInt(id, 10));
            const catchPerGear = {};
            if (gearIds.length > 0) {
                const { data: gears, error: gearError } = await window._supabase
                    .from(TABLES.GEAR)
                    .select('gr_id, gear_desc')
                    .in('gr_id', gearIds);

                if (!gearError && gears) {
                    const gearMap = {};
                    gears.forEach(g => {
                        gearMap[g.gr_id] = g.gear_desc || `Gear ${g.gr_id}`;
                    });

                    Object.keys(gearCatchMap).forEach(gearId => {
                        const id = parseInt(gearId, 10);
                        const gearName = gearMap[id] || `Gear ${id}`;
                        const totalCatchForGear = gearCatchMap[gearId];
                        const countForGear = gearCountMap[gearId];
                        catchPerGear[gearName] = countForGear > 0 ? totalCatchForGear / countForGear : 0;
                    });
                }
            }

            // Recalculate total catch and effort with filtered data
            const filteredTotalCatch = filteredGearUnloads.reduce((sum, gu) => sum + (parseFloat(gu.catch) || 0), 0);
            const filteredTotalEffort = filteredVesselUnloads.reduce((sum, vu) => sum + (parseFloat(vu.effort) || 0), 0);

            // Calculate catch per effort unit (use filtered data)
            const catchPerEffort = filteredTotalEffort > 0 ? filteredTotalCatch / filteredTotalEffort : 0;

            // Calculate catch per sample day (landing)
            // Count unique sample days from filtered gear unloads
            const uniqueSampleDayIds = [...new Set(filteredGearUnloads.map(gu => gu.unload_day_id).filter(Boolean))];
            const sampleDayCount = uniqueSampleDayIds.length;
            const catchPerSampleDay = sampleDayCount > 0 ? filteredTotalCatch / sampleDayCount : 0;

            const result = {
                catchPerVessel,
                catchPerGear,
                catchPerEffort,
                catchPerSampleDay,
                totalCatch: filteredTotalCatch,
                uniqueVessels,
                sampleDayCount,
                totalEffort: filteredTotalEffort
            };

            // Cache result
            this._setCache('getEfficiencyMetrics', args, result);
            return result;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'AnalyticsService.getEfficiencyMetrics',
                    showToast: false
                });
            }
            throw error;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.AnalyticsService = AnalyticsService;
}
