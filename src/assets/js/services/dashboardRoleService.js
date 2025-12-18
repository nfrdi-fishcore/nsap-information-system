/**
 * Dashboard Role Service - NSAP Information System
 * 
 * Handles role-specific data fetching for dashboard statistics and charts
 * Extends DashboardService with role-specific methods
 * 
 * Note: Requires constants.js, dashboardService.js, and analyticsService.js to be loaded first
 */

class DashboardRoleService {
    /**
     * Get Superadmin-specific statistics
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Superadmin statistics
     */
    static async getSuperadminStats(userProfile) {
        try {
            const [
                totalSystemLandings,
                totalActiveUsers,
                systemDataQuality,
                totalRegionsActive
            ] = await Promise.all([
                this.getTotalSystemLandings(userProfile),
                this.getTotalActiveUsers(userProfile),
                this.getSystemDataQuality(userProfile),
                this.getTotalRegionsActive(userProfile)
            ]);

            return {
                totalSystemLandings,
                totalActiveUsers,
                systemDataQuality,
                totalRegionsActive
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getSuperadminStats',
                    userMessage: 'Failed to load superadmin statistics'
                });
            }
            throw error;
        }
    }

    /**
     * Get total system landings (all regions)
     */
    static async getTotalSystemLandings(userProfile) {
        try {
            const { count, error } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id', { count: 'exact', head: true });

            if (error) throw error;
            return count || 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTotalSystemLandings',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get total active users (last 30 days)
     */
    static async getTotalActiveUsers(userProfile) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count, error } = await window._supabase
                .from(TABLES.USER)
                .select('user_id', { count: 'exact', head: true })
                .eq('status', 'active')
                .gte('last_login', thirtyDaysAgo.toISOString());

            if (error) throw error;
            return count || 0;
        } catch (error) {
            // If last_login field doesn't exist, fall back to all active users
            try {
                const { count, error } = await window._supabase
                    .from(TABLES.USER)
                    .select('user_id', { count: 'exact', head: true })
                    .eq('status', 'active');

                if (error) throw error;
                return count || 0;
            } catch (fallbackError) {
                if (window.ErrorHandler) {
                    ErrorHandler.handle(fallbackError, {
                        context: 'DashboardRoleService.getTotalActiveUsers',
                        showToast: false
                    });
                }
                throw fallbackError;
            }
        }
    }

    /**
     * Get system data quality (percentage of verified records)
     */
    static async getSystemDataQuality(userProfile) {
        try {
            // For now, return 100% as placeholder
            // TODO: Update when verification status field is available
            const total = await this.getTotalSystemLandings(userProfile);
            return {
                percentage: total > 0 ? 100 : 0,
                verified: total,
                pending: 0
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getSystemDataQuality',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get total regions with activity (last 30 days)
     */
    static async getTotalRegionsActive(userProfile) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data, error } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('region_id')
                .gte('sdate', thirtyDaysAgo.toISOString().split('T')[0]);

            if (error) throw error;

            const uniqueRegions = new Set((data || []).map(r => r.region_id).filter(Boolean));
            return uniqueRegions.size;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTotalRegionsActive',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get Admin-specific statistics
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Admin statistics
     */
    static async getAdminStats(userProfile) {
        try {
            const [
                regionalLandings,
                pendingReviews,
                activeEncoders,
                dataQualityScore
            ] = await Promise.all([
                DashboardService.getTotalLandings(userProfile),
                DashboardService.getPendingReviews(userProfile),
                DashboardService.getActiveEncoders(userProfile),
                this.getDataQualityScore(userProfile)
            ]);

            return {
                regionalLandings,
                pendingReviews,
                activeEncoders,
                dataQualityScore
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getAdminStats',
                    userMessage: 'Failed to load admin statistics'
                });
            }
            throw error;
        }
    }

    /**
     * Get data quality score for admin
     */
    static async getDataQualityScore(userProfile) {
        try {
            const total = await DashboardService.getTotalLandings(userProfile);
            const verified = await DashboardService.getVerifiedRecords(userProfile);
            const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;

            return {
                percentage,
                verified,
                total,
                pending: total - verified
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getDataQualityScore',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get Encoder-specific statistics
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Encoder statistics
     */
    static async getEncoderStats(userProfile) {
        try {
            const [
                myRecordsCreated,
                pendingEntries,
                recordsVerified,
                thisMonthActivity
            ] = await Promise.all([
                this.getMyRecordsCreated(userProfile),
                this.getPendingEntries(userProfile),
                this.getRecordsVerified(userProfile),
                this.getThisMonthActivity(userProfile)
            ]);

            return {
                myRecordsCreated,
                pendingEntries,
                recordsVerified,
                thisMonthActivity
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getEncoderStats',
                    userMessage: 'Failed to load encoder statistics'
                });
            }
            throw error;
        }
    }

    /**
     * Get records created by current encoder
     */
    static async getMyRecordsCreated(userProfile) {
        try {
            // Count sample days created by this user
            // Note: This assumes there's a created_by or user_id field in sample_day table
            // For now, we'll count all records in their region as a proxy
            const { count, error } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id', { count: 'exact', head: true })
                .eq('region_id', userProfile.region_id);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getMyRecordsCreated',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get pending entries (drafts/in-progress)
     */
    static async getPendingEntries(userProfile) {
        try {
            // TODO: Implement when draft/in-progress status is available
            // For now, return 0 as placeholder
            return {
                total: 0,
                byType: {
                    sampleDay: 0,
                    gearUnload: 0,
                    vesselUnload: 0
                }
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getPendingEntries',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get records verified by encoder
     */
    static async getRecordsVerified(userProfile) {
        try {
            const total = await this.getMyRecordsCreated(userProfile);
            // For now, return total as verified (placeholder)
            // TODO: Update when verification status is available
            return {
                count: total,
                rate: 100
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getRecordsVerified',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get this month's activity
     */
    static async getThisMonthActivity(userProfile) {
        try {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const { count, error } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id', { count: 'exact', head: true })
                .eq('region_id', userProfile.region_id)
                .gte('sdate', firstDayOfMonth.toISOString().split('T')[0]);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getThisMonthActivity',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get Viewer-specific statistics
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Viewer statistics
     */
    static async getViewerStats(userProfile) {
        try {
            const [
                regionalLandings,
                totalSpecies,
                activeVessels,
                samplingDays
            ] = await Promise.all([
                DashboardService.getTotalLandings(userProfile),
                this.getTotalSpecies(userProfile),
                this.getActiveVessels(userProfile),
                DashboardService.getTotalLandings(userProfile) // Sampling days = landings
            ]);

            return {
                regionalLandings,
                totalSpecies,
                activeVessels,
                samplingDays
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getViewerStats',
                    userMessage: 'Failed to load viewer statistics'
                });
            }
            throw error;
        }
    }

    /**
     * Get total unique species in region
     */
    static async getTotalSpecies(userProfile) {
        try {
            // Get unique species from vessel catch in user's region
            const { data: sampleDays, error: sdError } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id')
                .eq('region_id', userProfile.region_id);

            if (sdError) throw sdError;
            if (!sampleDays || sampleDays.length === 0) return 0;

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;
            if (!gearUnloads || gearUnloads.length === 0) return 0;

            const gearUnloadIds = gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean);

            // Get vessel unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('v_unload_id')
                .in('unload_gr_id', gearUnloadIds);

            if (vuError) throw vuError;
            if (!vesselUnloads || vesselUnloads.length === 0) return 0;

            const vesselUnloadIds = vesselUnloads.map(vu => vu.v_unload_id);

            // Get unique species from vessel catch
            const { data: vesselCatch, error: vcError } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .select('species_id')
                .in('v_unload_id', vesselUnloadIds)
                .not('species_id', 'is', null);

            if (vcError) throw vcError;

            const uniqueSpecies = new Set((vesselCatch || []).map(vc => vc.species_id).filter(Boolean));
            return uniqueSpecies.size;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTotalSpecies',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get active vessels in region
     */
    static async getActiveVessels(userProfile) {
        try {
            // Get unique vessels from vessel unloads in user's region
            const { data: sampleDays, error: sdError } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id')
                .eq('region_id', userProfile.region_id);

            if (sdError) throw sdError;
            if (!sampleDays || sampleDays.length === 0) return 0;

            const sampleDayIds = sampleDays.map(sd => sd.unload_day_id);

            // Get gear unloads
            const { data: gearUnloads, error: guError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id')
                .in('unload_day_id', sampleDayIds);

            if (guError) throw guError;
            if (!gearUnloads || gearUnloads.length === 0) return 0;

            const gearUnloadIds = gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean);

            // Get unique vessels from vessel unloads
            const { data: vesselUnloads, error: vuError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .select('vessel_id')
                .in('unload_gr_id', gearUnloadIds)
                .not('vessel_id', 'is', null);

            if (vuError) throw vuError;

            const uniqueVessels = new Set((vesselUnloads || []).map(vu => vu.vessel_id).filter(Boolean));
            return uniqueVessels.size;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getActiveVessels',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get role-specific catch trends
     * Uses AnalyticsService for actual data fetching
     */
    static async getRoleCatchTrends(userProfile, period = 6) {
        try {
            const now = new Date();
            const fromDate = new Date();
            fromDate.setMonth(now.getMonth() - period);

            if (typeof AnalyticsService !== 'undefined') {
                return await AnalyticsService.getCatchTrends(userProfile, fromDate, now, 'monthly');
            } else {
                // Fallback to DashboardService
                return await DashboardService.getCatchTrends(userProfile);
            }
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getRoleCatchTrends',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get role-specific species distribution
     * Uses AnalyticsService for actual data fetching
     */
    static async getRoleSpeciesDistribution(userProfile, limit = 10) {
        try {
            if (typeof AnalyticsService !== 'undefined') {
                const distribution = await AnalyticsService.getSpeciesDistribution(userProfile, null, null, limit);
                return {
                    labels: distribution.labels || [],
                    values: distribution.values || []
                };
            } else {
                // Fallback to DashboardService
                return await DashboardService.getSpeciesDistribution(userProfile);
            }
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getRoleSpeciesDistribution',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get role-specific recent activity
     */
    static async getRoleRecentActivity(userProfile, limit = 5) {
        try {
            return await DashboardService.getRecentActivity(userProfile, limit);
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getRoleRecentActivity',
                    showToast: false
                });
            }
            throw error;
        }
    }

    // ============================================
    // DATA TABLES METHODS
    // ============================================

    /**
     * Get top performing regions (Superadmin)
     */
    static async getTopPerformingRegions(userProfile, limit = 10) {
        try {
            // Get all regions with their activity
            const { data: regions, error: regError } = await window._supabase
                .from(TABLES.REGION)
                .select('region_id, region_name');

            if (regError) throw regError;

            // Get sample days per region
            const { data: sampleDays, error: sdError } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select('unload_day_id, region_id, sdate');

            if (sdError) throw sdError;

            // Aggregate by region
            const regionStats = {};
            regions.forEach(reg => {
                regionStats[reg.region_id] = {
                    regionId: reg.region_id,
                    regionName: reg.region_name,
                    totalCatch: 0,
                    samplingDays: 0,
                    vessels: 0,
                    species: 0
                };
            });

            // Count sampling days per region
            sampleDays.forEach(sd => {
                if (regionStats[sd.region_id]) {
                    regionStats[sd.region_id].samplingDays++;
                }
            });

            // Get catch volumes per region (simplified - using sample day count as proxy)
            const regionList = Object.values(regionStats)
                .map(reg => ({
                    ...reg,
                    totalCatch: reg.samplingDays // Simplified metric
                }))
                .sort((a, b) => b.totalCatch - a.totalCatch)
                .slice(0, limit);

            return regionList;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTopPerformingRegions',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top encoders (Admin)
     */
    static async getTopEncoders(userProfile, limit = 10) {
        try {
            let query = window._supabase
                .from(TABLES.USER)
                .select('user_id, full_name, email, region_id, dbo_region(region_name)')
                .eq('role', 'encoder')
                .eq('status', 'active')
                .limit(limit);

            // Apply RBAC filtering
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { data: encoders, error } = await query;
            if (error) throw error;

            // For now, return encoders with placeholder stats
            // TODO: Add actual performance metrics when available
            return (encoders || []).map(enc => ({
                encoderId: enc.user_id,
                encoderName: enc.full_name || enc.email,
                regionName: enc.dbo_region?.region_name || 'Unknown',
                recordsCreated: 0, // Placeholder
                recordsVerified: 0, // Placeholder
                qualityScore: 0, // Placeholder
                lastActive: 'N/A' // Placeholder
            }));
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTopEncoders',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get my recent entries (Encoder)
     */
    static async getMyRecentEntries(userProfile, limit = 20) {
        try {
            const { data: sampleDays, error } = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select(`
                    unload_day_id,
                    sdate,
                    region_id,
                    land_ctr_id,
                    ground_id,
                    dbo_landing_center(landing_center),
                    dbo_fishing_ground(ground_desc)
                `)
                .eq('region_id', userProfile.region_id)
                .order('sdate', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (sampleDays || []).map(sd => ({
                id: sd.unload_day_id,
                date: sd.sdate,
                recordType: 'Sample Day',
                landingCenter: sd.dbo_landing_center?.landing_center || 'Unknown',
                fishingGround: sd.dbo_fishing_ground?.ground_desc || 'Unknown',
                catchVolume: 0, // Placeholder - would need to calculate from vessel catch
                status: 'Verified' // Placeholder
            }));
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getMyRecentEntries',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top species (Viewer)
     */
    static async getTopSpecies(userProfile, limit = 15) {
        try {
            if (typeof AnalyticsService !== 'undefined') {
                const distribution = await AnalyticsService.getSpeciesDistribution(userProfile, null, null, limit);
                return (distribution.labels || []).map((label, index) => ({
                    speciesName: label,
                    catchVolume: distribution.values[index] || 0,
                    percentage: distribution.values[index] || 0 // Simplified
                }));
            }
            return [];
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTopSpecies',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get top landing centers (Viewer/Admin)
     */
    static async getTopLandingCenters(userProfile, limit = 10) {
        try {
            // Get sample days with landing centers
            let query = window._supabase
                .from(TABLES.SAMPLE_DAY)
                .select(`
                    unload_day_id,
                    land_ctr_id,
                    sdate,
                    dbo_landing_center(landing_center)
                `);

            // Apply RBAC filtering
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { data: sampleDays, error } = await query;
            if (error) throw error;

            // Aggregate by landing center
            const lcStats = {};
            sampleDays.forEach(sd => {
                const lcId = sd.land_ctr_id;
                const lcName = sd.dbo_landing_center?.landing_center || 'Unknown';
                
                if (!lcStats[lcId]) {
                    lcStats[lcId] = {
                        landingCenterId: lcId,
                        landingCenterName: lcName,
                        activityCount: 0,
                        totalCatch: 0,
                        lastActivity: null
                    };
                }
                
                lcStats[lcId].activityCount++;
                if (!lcStats[lcId].lastActivity || new Date(sd.sdate) > new Date(lcStats[lcId].lastActivity)) {
                    lcStats[lcId].lastActivity = sd.sdate;
                }
            });

            return Object.values(lcStats)
                .sort((a, b) => b.activityCount - a.activityCount)
                .slice(0, limit);
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardRoleService.getTopLandingCenters',
                    showToast: false
                });
            }
            throw error;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DashboardRoleService = DashboardRoleService;
}

