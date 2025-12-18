/**
 * Reports Service - NSAP Information System
 * 
 * Handles all data fetching for reports module
 * Provides methods for monthly, regional, species, and custom reports
 * 
 * Note: Requires constants.js to be loaded first (ADMIN_ROLES, TABLES)
 * Note: Reuses patterns from AnalyticsService for consistency
 */

class ReportsService {
    /**
     * Apply RBAC filtering to a query
     * @param {Object} query - Supabase query object
     * @param {Object} userProfile - Current user profile
     * @param {number} regionId - Optional region ID filter
     * @returns {Object} Filtered query
     */
    static _applyRBACFilter(query, userProfile, regionId = null) {
        if (regionId) {
            return query.eq('region_id', regionId);
        } else if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
            return query.eq('region_id', userProfile.region_id);
        }
        return query;
    }

    /**
     * Get monthly report data
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {number} regionId - Optional region ID filter
     * @param {string} landingCenterId - Optional landing center ID filter
     * @param {string} fishingGroundId - Optional fishing ground ID filter
     * @returns {Promise<Object>} Monthly report data
     */
    static async getMonthlyReportData(userProfile, fromDate, toDate, regionId = null, landingCenterId = null, fishingGroundId = null) {
        try {
            // Start with sample days (apply filters early)
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select(`
                    unload_day_id,
                    sdate,
                    region_id,
                    land_ctr_id,
                    ground_id,
                    dbo_region (region_name),
                    dbo_landing_center (landing_center),
                    dbo_fishing_ground (ground_desc)
                `);

            // Apply date filtering
            if (fromDate) {
                sampleDayQuery = sampleDayQuery.gte('sdate', fromDate.toISOString().split('T')[0]);
            }
            if (toDate) {
                sampleDayQuery = sampleDayQuery.lte('sdate', toDate.toISOString().split('T')[0]);
            }

            // Apply RBAC and filters
            sampleDayQuery = this._applyRBACFilter(sampleDayQuery, userProfile, regionId);
            
            if (landingCenterId) {
                sampleDayQuery = sampleDayQuery.eq('land_ctr_id', landingCenterId);
            }
            if (fishingGroundId) {
                sampleDayQuery = sampleDayQuery.eq('ground_id', fishingGroundId);
            }

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                return {
                    summary: {
                        totalCatch: 0,
                        totalSamplingDays: 0,
                        totalVessels: 0,
                        totalSpecies: 0,
                        totalLandingCenters: 0,
                        totalFishingGrounds: 0
                    },
                    monthlyData: [],
                    topSpecies: [],
                    topLandingCenters: [],
                    topFishingGrounds: [],
                    gearDistribution: []
                };
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, catch, boats')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            const gearUnloadIds = gearUnloads ? [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))] : [];

            // Get vessel unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            // Get vessel catches for species data
            const vesselUnloadIds = vesselUnloads ? [...new Set(vesselUnloads.map(vu => vu.v_unload_id).filter(Boolean))] : [];
            
            const { data: vesselCatches, error: vcError } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .select(`
                    catch_id,
                    v_unload_id,
                    species_id,
                    catch_kg,
                    dbo_species (sp_name, sp_family, sp_sci)
                `)
                .in('v_unload_id', vesselUnloadIds)
                .not('catch_kg', 'is', null);

            if (vcError) throw vcError;

            // Create maps for quick lookup
            const gearUnloadMap = {};
            gearUnloads?.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu;
            });

            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            // Calculate summary metrics
            const totalCatch = vesselUnloads?.reduce((sum, vu) => sum + (parseFloat(vu.catch_total) || 0), 0) || 0;
            const totalSamplingDays = new Set(sampleDays.map(sd => sd.unload_day_id)).size;
            const uniqueVessels = new Set();
            const uniqueSpecies = new Set();
            const uniqueLandingCenters = new Set();
            const uniqueFishingGrounds = new Set();

            // Aggregate monthly data
            const monthlyDataMap = {};
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];

            sampleDays.forEach(sd => {
                const date = new Date(sd.sdate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyDataMap[monthKey]) {
                    monthlyDataMap[monthKey] = {
                        month: monthNames[date.getMonth()],
                        year: date.getFullYear(),
                        monthKey: monthKey,
                        catch: 0,
                        samplingDays: 0,
                        vessels: 0
                    };
                }

                monthlyDataMap[monthKey].samplingDays++;
                if (sd.land_ctr_id) uniqueLandingCenters.add(sd.land_ctr_id);
                if (sd.ground_id) uniqueFishingGrounds.add(sd.ground_id);
            });

            // Aggregate catch by month
            vesselUnloads?.forEach(vu => {
                const gearUnload = gearUnloadMap[vu.unload_gr_id];
                if (!gearUnload) return;

                const sampleDayId = gearUnload.unload_day_id;
                const sampleDay = sampleDayMap[sampleDayId];
                if (!sampleDay) return;

                const date = new Date(sampleDay.sdate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (monthlyDataMap[monthKey]) {
                    monthlyDataMap[monthKey].catch += parseFloat(vu.catch_total) || 0;
                }
            });

            // Aggregate vessels by month
            gearUnloads?.forEach(gu => {
                const sampleDay = sampleDayMap[gu.unload_day_id];
                if (!sampleDay) return;

                const date = new Date(sampleDay.sdate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (monthlyDataMap[monthKey]) {
                    monthlyDataMap[monthKey].vessels += parseInt(gu.boats) || 0;
                }
            });

            // Get species data
            const speciesMap = {};
            vesselCatches?.forEach(vc => {
                const speciesId = vc.species_id;
                if (!speciesId) return;

                uniqueSpecies.add(speciesId);
                
                if (!speciesMap[speciesId]) {
                    speciesMap[speciesId] = {
                        speciesId: speciesId,
                        speciesName: vc.dbo_species?.sp_name || 'Unknown',
                        family: vc.dbo_species?.sp_family || '-',
                        scientificName: vc.dbo_species?.sp_sci || '-',
                        catch: 0
                    };
                }
                speciesMap[speciesId].catch += parseFloat(vc.catch_kg) || 0;
            });

            // Get landing center data
            const landingCenterMap = {};
            sampleDays.forEach(sd => {
                if (!sd.land_ctr_id) return;
                const lcId = sd.land_ctr_id;
                
                if (!landingCenterMap[lcId]) {
                    landingCenterMap[lcId] = {
                        landingCenterId: lcId,
                        landingCenterName: sd.dbo_landing_center?.landing_center || 'Unknown',
                        activity: 0
                    };
                }
                landingCenterMap[lcId].activity++;
            });

            // Get fishing ground data
            const fishingGroundMap = {};
            sampleDays.forEach(sd => {
                if (!sd.ground_id) return;
                const fgId = sd.ground_id;
                
                if (!fishingGroundMap[fgId]) {
                    fishingGroundMap[fgId] = {
                        fishingGroundId: fgId,
                        fishingGroundName: sd.dbo_fishing_ground?.ground_desc || 'Unknown',
                        catch: 0
                    };
                }
            });

            // Calculate fishing ground catch
            vesselUnloads?.forEach(vu => {
                const gearUnload = gearUnloadMap[vu.unload_gr_id];
                if (!gearUnload) return;

                const sampleDayId = gearUnload.unload_day_id;
                const sampleDay = sampleDayMap[sampleDayId];
                if (!sampleDay || !sampleDay.ground_id) return;

                const fgId = sampleDay.ground_id;
                if (fishingGroundMap[fgId]) {
                    fishingGroundMap[fgId].catch += parseFloat(vu.catch_total) || 0;
                }
            });

            // Get gear distribution
            const { data: gearUnloadDetails, error: gudError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select(`
                    unload_gr_id,
                    gr_id,
                    dbo_gear (gear_desc)
                `)
                .in('unload_gr_id', gearUnloadIds);

            if (gudError) throw gudError;

            const gearMap = {};
            gearUnloadDetails?.forEach(gud => {
                const gearId = gud.gr_id;
                if (!gearId) return;

                if (!gearMap[gearId]) {
                    gearMap[gearId] = {
                        gearId: gearId,
                        gearName: gud.dbo_gear?.gear_desc || 'Unknown',
                        catch: 0
                    };
                }
            });

            // Calculate gear catch
            vesselUnloads?.forEach(vu => {
                const gearUnload = gearUnloadMap[vu.unload_gr_id];
                if (!gearUnload) return;

                const gearUnloadDetail = gearUnloadDetails?.find(gud => gud.unload_gr_id === gearUnload.unload_gr_id);
                if (!gearUnloadDetail || !gearUnloadDetail.gr_id) return;

                const gearId = gearUnloadDetail.gr_id;
                if (gearMap[gearId]) {
                    gearMap[gearId].catch += parseFloat(vu.catch_total) || 0;
                }
            });

            // Sort and get top items
            const topSpecies = Object.values(speciesMap)
                .sort((a, b) => b.catch - a.catch)
                .slice(0, 10);

            const topLandingCenters = Object.values(landingCenterMap)
                .sort((a, b) => b.activity - a.activity)
                .slice(0, 10);

            const topFishingGrounds = Object.values(fishingGroundMap)
                .sort((a, b) => b.catch - a.catch)
                .slice(0, 10);

            const gearDistribution = Object.values(gearMap)
                .sort((a, b) => b.catch - a.catch);

            // Convert monthly data map to array and sort
            const monthlyData = Object.values(monthlyDataMap)
                .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

            return {
                summary: {
                    totalCatch: totalCatch,
                    totalSamplingDays: totalSamplingDays,
                    totalVessels: uniqueVessels.size || gearUnloads?.reduce((sum, gu) => sum + (parseInt(gu.boats) || 0), 0) || 0,
                    totalSpecies: uniqueSpecies.size,
                    totalLandingCenters: uniqueLandingCenters.size,
                    totalFishingGrounds: uniqueFishingGrounds.size
                },
                monthlyData: monthlyData,
                topSpecies: topSpecies,
                topLandingCenters: topLandingCenters,
                topFishingGrounds: topFishingGrounds,
                gearDistribution: gearDistribution
            };

        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'ReportsService.getMonthlyReportData',
                userMessage: 'Failed to fetch monthly report data'
            });
            throw error;
        }
    }

    /**
     * Get regional report data
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {Array} regionIds - Array of region IDs to compare (optional, defaults to all accessible regions)
     * @returns {Promise<Object>} Regional report data
     */
    static async getRegionalReportData(userProfile, fromDate, toDate, regionIds = null) {
        try {
            // Determine which regions to include
            let regionsToCompare = [];
            
            if (regionIds && regionIds.length > 0) {
                // Use specified regions (admins only)
                if (!ADMIN_ROLES.includes(userProfile.role)) {
                    throw new Error('Only admins can compare multiple regions');
                }
                regionsToCompare = regionIds;
            } else {
                // Get all accessible regions
                let regionQuery = window._supabase
                    .from(TABLES.REGION)
                    .select('region_id, region_name, sort_order')
                    .order('sort_order', { ascending: true });

                if (!ADMIN_ROLES.includes(userProfile.role)) {
                    regionQuery = regionQuery.eq('region_id', userProfile.region_id);
                }

                const { data: regionsData, error: regionError } = await regionQuery;
                if (regionError) throw regionError;
                
                regionsToCompare = (regionsData || []).map(r => r.region_id);
            }

            if (regionsToCompare.length === 0) {
                return {
                    regions: [],
                    regionalData: [],
                    summary: {}
                };
            }

            // Get region details
            const { data: regionsData, error: regionsError } = await window._supabase
                .from(TABLES.REGION)
                .select('region_id, region_name')
                .in('region_id', regionsToCompare);

            if (regionsError) throw regionsError;

            const regionMap = {};
            (regionsData || []).forEach(r => {
                regionMap[r.region_id] = r.region_name;
            });

            // Fetch data for each region
            const regionalData = await Promise.all(
                regionsToCompare.map(async (regionId) => {
                    const monthlyData = await this.getMonthlyReportData(
                        userProfile,
                        fromDate,
                        toDate,
                        regionId,
                        null,
                        null
                    );

                    return {
                        regionId: regionId,
                        regionName: regionMap[regionId] || 'Unknown',
                        summary: monthlyData.summary,
                        topSpecies: monthlyData.topSpecies.slice(0, 5), // Top 5 per region
                        topLandingCenters: monthlyData.topLandingCenters.slice(0, 5),
                        topFishingGrounds: monthlyData.topFishingGrounds.slice(0, 5)
                    };
                })
            );

            // Calculate totals for summary
            const totalCatch = regionalData.reduce((sum, r) => sum + (r.summary.totalCatch || 0), 0);
            const totalSamplingDays = regionalData.reduce((sum, r) => sum + (r.summary.totalSamplingDays || 0), 0);
            const totalVessels = regionalData.reduce((sum, r) => sum + (r.summary.totalVessels || 0), 0);
            const totalSpecies = new Set(
                regionalData.flatMap(r => r.topSpecies.map(s => s.speciesId))
            ).size;

            return {
                regions: regionsData || [],
                regionalData: regionalData,
                summary: {
                    totalCatch: totalCatch,
                    totalSamplingDays: totalSamplingDays,
                    totalVessels: totalVessels,
                    totalSpecies: totalSpecies,
                    regionCount: regionalData.length
                }
            };

        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'ReportsService.getRegionalReportData',
                userMessage: 'Failed to fetch regional report data'
            });
            throw error;
        }
    }

    /**
     * Get species report data
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {Array} speciesIds - Array of species IDs (optional, all if not specified)
     * @param {number} regionId - Optional region ID filter
     * @param {number} gearId - Optional gear ID filter
     * @returns {Promise<Object>} Species report data
     */
    static async getSpeciesReportData(userProfile, fromDate, toDate, speciesIds = null, regionId = null, gearId = null) {
        try {
            // Start with sample days
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, sdate, region_id')
                .gte('sdate', fromDate.toISOString().split('T')[0])
                .lte('sdate', toDate.toISOString().split('T')[0]);

            sampleDayQuery = this._applyRBACFilter(sampleDayQuery, userProfile, regionId);

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                return {
                    summary: {
                        totalCatch: 0,
                        totalSpecies: 0,
                        totalVessels: 0
                    },
                    speciesData: [],
                    monthlyTrends: [],
                    regionalDistribution: [],
                    gearDistribution: []
                };
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, gr_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            // Filter by gear if specified
            let gearUnloadIds = gearUnloads ? [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))] : [];
            
            if (gearId) {
                const filteredGearUnloads = gearUnloads.filter(gu => gu.gr_id === gearId);
                gearUnloadIds = [...new Set(filteredGearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))];
            }

            // Get vessel unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, unload_gr_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            const vesselUnloadIds = vesselUnloads ? [...new Set(vesselUnloads.map(vu => vu.v_unload_id).filter(Boolean))] : [];

            // Get vessel catches with species filter
            let vesselCatchQuery = window._supabase
                .from(TABLES.VESSEL_CATCH)
                .select(`
                    catch_id,
                    v_unload_id,
                    species_id,
                    catch_kg,
                    dbo_species (sp_name, sp_family, sp_sci)
                `)
                .in('v_unload_id', vesselUnloadIds)
                .not('catch_kg', 'is', null);

            if (speciesIds && speciesIds.length > 0) {
                vesselCatchQuery = vesselCatchQuery.in('species_id', speciesIds);
            }

            const { data: vesselCatches, error: vcError } = await vesselCatchQuery;
            if (vcError) throw vcError;

            // Create maps for lookup
            const gearUnloadMap = {};
            gearUnloads?.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu;
            });

            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            // Aggregate species data
            const speciesMap = {};
            const monthlySpeciesMap = {};
            const regionalSpeciesMap = {};
            const gearSpeciesMap = {};

            vesselCatches?.forEach(vc => {
                const speciesId = vc.species_id;
                if (!speciesId) return;

                const speciesName = vc.dbo_species?.sp_name || 'Unknown';
                const catchKg = parseFloat(vc.catch_kg) || 0;

                // Overall species data
                if (!speciesMap[speciesId]) {
                    speciesMap[speciesId] = {
                        speciesId: speciesId,
                        speciesName: speciesName,
                        family: vc.dbo_species?.sp_family || '-',
                        scientificName: vc.dbo_species?.sp_sci || '-',
                        catch: 0,
                        vesselCount: new Set()
                    };
                }
                speciesMap[speciesId].catch += catchKg;
                speciesMap[speciesId].vesselCount.add(vc.v_unload_id);

                // Monthly trends
                const vesselUnload = vesselUnloads?.find(vu => vu.v_unload_id === vc.v_unload_id);
                if (vesselUnload) {
                    const gearUnload = gearUnloadMap[vesselUnload.unload_gr_id];
                    if (gearUnload) {
                        const sampleDay = sampleDayMap[gearUnload.unload_day_id];
                        if (sampleDay) {
                            const date = new Date(sampleDay.sdate);
                            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            
                            if (!monthlySpeciesMap[monthKey]) {
                                monthlySpeciesMap[monthKey] = {};
                            }
                            if (!monthlySpeciesMap[monthKey][speciesId]) {
                                monthlySpeciesMap[monthKey][speciesId] = {
                                    speciesId: speciesId,
                                    speciesName: speciesName,
                                    catch: 0
                                };
                            }
                            monthlySpeciesMap[monthKey][speciesId].catch += catchKg;
                        }
                    }
                }

                // Regional distribution
                const vesselUnload2 = vesselUnloads?.find(vu => vu.v_unload_id === vc.v_unload_id);
                if (vesselUnload2) {
                    const gearUnload = gearUnloadMap[vesselUnload2.unload_gr_id];
                    if (gearUnload) {
                        const sampleDay = sampleDayMap[gearUnload.unload_day_id];
                        if (sampleDay && sampleDay.region_id) {
                            if (!regionalSpeciesMap[sampleDay.region_id]) {
                                regionalSpeciesMap[sampleDay.region_id] = {};
                            }
                            if (!regionalSpeciesMap[sampleDay.region_id][speciesId]) {
                                regionalSpeciesMap[sampleDay.region_id][speciesId] = {
                                    speciesId: speciesId,
                                    speciesName: speciesName,
                                    catch: 0
                                };
                            }
                            regionalSpeciesMap[sampleDay.region_id][speciesId].catch += catchKg;
                        }
                    }
                }

                // Gear distribution
                const vesselUnload3 = vesselUnloads?.find(vu => vu.v_unload_id === vc.v_unload_id);
                if (vesselUnload3) {
                    const gearUnload = gearUnloadMap[vesselUnload3.unload_gr_id];
                    if (gearUnload && gearUnload.gr_id) {
                        if (!gearSpeciesMap[gearUnload.gr_id]) {
                            gearSpeciesMap[gearUnload.gr_id] = {};
                        }
                        if (!gearSpeciesMap[gearUnload.gr_id][speciesId]) {
                            gearSpeciesMap[gearUnload.gr_id][speciesId] = {
                                speciesId: speciesId,
                                speciesName: speciesName,
                                catch: 0
                            };
                        }
                        gearSpeciesMap[gearUnload.gr_id][speciesId].catch += catchKg;
                    }
                }
            });

            // Convert maps to arrays
            const speciesData = Object.values(speciesMap).map(s => ({
                ...s,
                vesselCount: s.vesselCount.size
            })).sort((a, b) => b.catch - a.catch);

            // Get monthly trends (aggregate by month)
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const monthlyTrends = Object.keys(monthlySpeciesMap)
                .sort()
                .map(monthKey => {
                    const [year, month] = monthKey.split('-');
                    const speciesDataForMonth = Object.values(monthlySpeciesMap[monthKey]);
                    return {
                        month: monthNames[parseInt(month) - 1],
                        year: parseInt(year),
                        monthKey: monthKey,
                        speciesData: speciesDataForMonth.sort((a, b) => b.catch - a.catch)
                    };
                });

            // Get regional distribution
            const { data: allRegions, error: regionsError } = await window._supabase
                .from(TABLES.REGION)
                .select('region_id, region_name');

            if (regionsError) throw regionsError;

            const regionalDistribution = Object.keys(regionalSpeciesMap).map(regionId => {
                const region = allRegions?.find(r => r.region_id === parseInt(regionId));
                const speciesDataForRegion = Object.values(regionalSpeciesMap[regionId])
                    .sort((a, b) => b.catch - a.catch);
                return {
                    regionId: parseInt(regionId),
                    regionName: region?.region_name || 'Unknown',
                    speciesData: speciesDataForRegion
                };
            });

            // Get gear distribution
            const { data: allGears, error: gearsError } = await window._supabase
                .from(TABLES.GEAR)
                .select('gr_id, gear_desc');

            if (gearsError) throw gearsError;

            const gearDistribution = Object.keys(gearSpeciesMap).map(gearId => {
                const gear = allGears?.find(g => g.gr_id === parseInt(gearId));
                const speciesDataForGear = Object.values(gearSpeciesMap[gearId])
                    .sort((a, b) => b.catch - a.catch);
                return {
                    gearId: parseInt(gearId),
                    gearName: gear?.gear_desc || 'Unknown',
                    speciesData: speciesDataForGear
                };
            });

            return {
                summary: {
                    totalCatch: speciesData.reduce((sum, s) => sum + s.catch, 0),
                    totalSpecies: speciesData.length,
                    totalVessels: new Set(vesselUnloadIds).size
                },
                speciesData: speciesData,
                monthlyTrends: monthlyTrends,
                regionalDistribution: regionalDistribution,
                gearDistribution: gearDistribution
            };

        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'ReportsService.getSpeciesReportData',
                userMessage: 'Failed to fetch species report data'
            });
            throw error;
        }
    }

    /**
     * Get custom report data
     * @param {Object} userProfile - Current user profile
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {Array} selectedFields - Array of field IDs to include
     * @param {Array} filters - Array of filter objects {field, operator, value}
     * @param {number} regionId - Optional region ID filter
     * @param {string} groupBy - Optional field ID to group by
     * @param {string} sortBy - Optional field ID to sort by
     * @param {string} sortOrder - Sort order: 'asc' or 'desc'
     * @returns {Promise<Object>} Custom report data
     */
    static async getCustomReportData(userProfile, fromDate, toDate, selectedFields, filters = [], regionId = null, groupBy = null, sortBy = null, sortOrder = 'asc') {
        try {
            // Start with sample days
            let sampleDayQuery = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select(`
                    unload_day_id,
                    sdate,
                    region_id,
                    land_ctr_id,
                    ground_id,
                    sampleday,
                    dbo_region (region_name),
                    dbo_landing_center (landing_center),
                    dbo_fishing_ground (ground_desc)
                `)
                .gte('sdate', fromDate.toISOString().split('T')[0])
                .lte('sdate', toDate.toISOString().split('T')[0]);

            sampleDayQuery = this._applyRBACFilter(sampleDayQuery, userProfile, regionId);

            const { data: sampleDays, error: sdError } = await sampleDayQuery;
            if (sdError) throw sdError;

            if (!sampleDays || sampleDays.length === 0) {
                return {
                    columns: selectedFields,
                    rows: []
                };
            }

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id, unload_day_id, gr_id, boats, catch, dbo_gear (gear_desc)')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;

            const gearUnloadIds = gearUnloads ? [...new Set(gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean))] : [];

            // Get vessel unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id, catch_total, unload_gr_id, dbo_vessel (vesselname)')
                .in('unload_gr_id', gearUnloadIds)
                .not('catch_total', 'is', null);

            if (vuError) throw vuError;

            const vesselUnloadIds = vesselUnloads ? [...new Set(vesselUnloads.map(vu => vu.v_unload_id).filter(Boolean))] : [];

            // Get vessel catches
            const { data: vesselCatches, error: vcError } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .select('catch_id, v_unload_id, species_id, catch_kg, dbo_species (sp_name)')
                .in('v_unload_id', vesselUnloadIds)
                .not('catch_kg', 'is', null);

            if (vcError) throw vcError;

            // Create maps for lookup
            const sampleDayMap = {};
            sampleDays.forEach(sd => {
                sampleDayMap[sd.unload_day_id] = sd;
            });

            const gearUnloadMap = {};
            gearUnloads?.forEach(gu => {
                gearUnloadMap[gu.unload_gr_id] = gu;
            });

            const vesselUnloadMap = {};
            vesselUnloads?.forEach(vu => {
                vesselUnloadMap[vu.v_unload_id] = vu;
            });

            // Build rows based on selected fields
            const rows = [];
            const fieldLabels = {
                'date': 'Date',
                'region': 'Region',
                'landingCenter': 'Landing Center',
                'fishingGround': 'Fishing Ground',
                'vessel': 'Vessel',
                'gear': 'Gear Type',
                'species': 'Species',
                'catchVolume': 'Catch Volume (kg)',
                'effort': 'Effort',
                'samplingDay': 'Sampling Day',
                'vesselsCount': 'Number of Vessels'
            };

            // Process data and create rows
            vesselCatches?.forEach(vc => {
                const vesselUnload = vesselUnloadMap[vc.v_unload_id];
                if (!vesselUnload) return;

                const gearUnload = gearUnloadMap[vesselUnload.unload_gr_id];
                if (!gearUnload) return;

                const sampleDay = sampleDayMap[gearUnload.unload_day_id];
                if (!sampleDay) return;

                const row = {};

                selectedFields.forEach(fieldId => {
                    switch (fieldId) {
                        case 'date':
                            row[fieldLabels.date] = new Date(sampleDay.sdate).toLocaleDateString();
                            break;
                        case 'region':
                            row[fieldLabels.region] = sampleDay.dbo_region?.region_name || 'Unknown';
                            break;
                        case 'landingCenter':
                            row[fieldLabels.landingCenter] = sampleDay.dbo_landing_center?.landing_center || 'Unknown';
                            break;
                        case 'fishingGround':
                            row[fieldLabels.fishingGround] = sampleDay.dbo_fishing_ground?.ground_desc || 'Unknown';
                            break;
                        case 'vessel':
                            row[fieldLabels.vessel] = vesselUnload.dbo_vessel?.vesselname || 'Unknown';
                            break;
                        case 'gear':
                            row[fieldLabels.gear] = gearUnload.dbo_gear?.gear_desc || 'Unknown';
                            break;
                        case 'species':
                            row[fieldLabels.species] = vc.dbo_species?.sp_name || 'Unknown';
                            break;
                        case 'catchVolume':
                            row[fieldLabels.catchVolume] = parseFloat(vc.catch_kg) || 0;
                            break;
                        case 'effort':
                            row[fieldLabels.effort] = '-'; // Would need to fetch from vessel unload
                            break;
                        case 'samplingDay':
                            row[fieldLabels.samplingDay] = sampleDay.sampleday === true || sampleDay.sampleday === 'True' || sampleDay.sampleday === 'true';
                            break;
                        case 'vesselsCount':
                            row[fieldLabels.vesselsCount] = parseInt(gearUnload.boats) || 0;
                            break;
                    }
                });

                // Apply filters
                let passesFilters = true;
                filters.forEach(filter => {
                    if (!passesFilters) return;

                    const fieldLabel = fieldLabels[filter.field];
                    if (!fieldLabel || row[fieldLabel] === undefined) {
                        passesFilters = false;
                        return;
                    }

                    const cellValue = String(row[fieldLabel]).toLowerCase();
                    const filterValue = String(filter.value).toLowerCase();

                    switch (filter.operator) {
                        case 'equals':
                            if (cellValue !== filterValue) passesFilters = false;
                            break;
                        case 'contains':
                            if (!cellValue.includes(filterValue)) passesFilters = false;
                            break;
                        case 'startsWith':
                            if (!cellValue.startsWith(filterValue)) passesFilters = false;
                            break;
                        case 'endsWith':
                            if (!cellValue.endsWith(filterValue)) passesFilters = false;
                            break;
                        case 'greaterThan':
                            if (parseFloat(row[fieldLabel]) <= parseFloat(filter.value)) passesFilters = false;
                            break;
                        case 'lessThan':
                            if (parseFloat(row[fieldLabel]) >= parseFloat(filter.value)) passesFilters = false;
                            break;
                    }
                });

                if (passesFilters) {
                    rows.push(row);
                }
            });

            // Apply grouping
            if (groupBy && fieldLabels[groupBy]) {
                const grouped = {};
                rows.forEach(row => {
                    const groupKey = String(row[fieldLabels[groupBy]] || 'Unknown');
                    if (!grouped[groupKey]) {
                        grouped[groupKey] = [];
                    }
                    grouped[groupKey].push(row);
                });

                // Aggregate grouped data (sum numeric fields)
                const aggregatedRows = [];
                Object.keys(grouped).forEach(groupKey => {
                    const groupRows = grouped[groupKey];
                    const aggregated = { [fieldLabels[groupBy]]: groupKey };

                    selectedFields.forEach(fieldId => {
                        if (fieldId === groupBy) return;

                        const fieldLabel = fieldLabels[fieldId];
                        if (fieldId === 'catchVolume' || fieldId === 'vesselsCount') {
                            aggregated[fieldLabel] = groupRows.reduce((sum, r) => sum + (parseFloat(r[fieldLabel]) || 0), 0);
                        } else {
                            // For non-numeric fields, use the first value or count unique
                            aggregated[fieldLabel] = groupRows[0]?.[fieldLabel] || '-';
                        }
                    });

                    aggregatedRows.push(aggregated);
                });

                rows.length = 0;
                rows.push(...aggregatedRows);
            }

            // Apply sorting
            if (sortBy && fieldLabels[sortBy]) {
                rows.sort((a, b) => {
                    const aVal = a[fieldLabels[sortBy]];
                    const bVal = b[fieldLabels[sortBy]];

                    if (typeof aVal === 'number' && typeof bVal === 'number') {
                        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
                    }

                    const aStr = String(aVal || '').toLowerCase();
                    const bStr = String(bVal || '').toLowerCase();

                    if (sortOrder === 'asc') {
                        return aStr.localeCompare(bStr);
                    } else {
                        return bStr.localeCompare(aStr);
                    }
                });
            }

            // Get column labels
            const columns = selectedFields.map(fieldId => fieldLabels[fieldId]);

            return {
                columns: columns,
                rows: rows
            };

        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'ReportsService.getCustomReportData',
                userMessage: 'Failed to fetch custom report data'
            });
            throw error;
        }
    }

    /**
     * Validate report parameters
     * @param {Object} params - Report parameters
     * @returns {Object} Validation result {isValid: boolean, error: string}
     */
    static validateReportParams(params) {
        if (!params.fromDate || !params.toDate) {
            return { isValid: false, error: 'Date range is required' };
        }

        if (new Date(params.fromDate) > new Date(params.toDate)) {
            return { isValid: false, error: 'Start date must be before end date' };
        }

        return { isValid: true, error: null };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ReportsService = ReportsService;
}

