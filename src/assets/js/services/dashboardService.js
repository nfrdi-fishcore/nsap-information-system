/**
 * Dashboard Service - NSAP Information System
 * 
 * Handles all data fetching for dashboard statistics and charts
 * 
 * Note: Requires constants.js to be loaded first (ADMIN_ROLES)
 */

class DashboardService {
    /**
     * Get total landings count
     * Counts sample days as proxy for landings
     * @param {Object} userProfile - Current user profile with role and region_id
     * @returns {Promise<number>} Total landings count
     */
    static async getTotalLandings(userProfile) {
        try {
            let query = window._supabase
                .from('dbo_LC_FG_sample_day')
                .select('unload_day_id', { count: 'exact', head: true });

            // Apply RBAC filtering - Only encoder and viewer are limited to their region
            // Superadmin and Admin can access all data
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { count, error } = await query;

            if (error) throw error;

            return count || 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getTotalLandings',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get verified records count
     * Counts records with verification status (if field exists)
     * Falls back to total count if verification field doesn't exist
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<number>} Verified records count
     */
    static async getVerifiedRecords(userProfile) {
        try {
            // For now, return total landings as verified
            // TODO: Update when verification status field is available
            const total = await this.getTotalLandings(userProfile);
            return total;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getVerifiedRecords',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get pending review count
     * Counts records pending review (if field exists)
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<number>} Pending review count
     */
    static async getPendingReviews(userProfile) {
        try {
            // For now, return 0 as placeholder
            // TODO: Update when review status field is available
            return 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getPendingReviews',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get active encoders count
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<number>} Active encoders count
     */
    static async getActiveEncoders(userProfile) {
        try {
            let query = window._supabase
                .from('dbo_user')
                .select('user_id', { count: 'exact', head: true })
                .eq('role', 'encoder')
                .eq('status', 'active');

            // Apply RBAC filtering - Only encoder and viewer are limited to their region
            // Superadmin and Admin can access all data
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { count, error } = await query;

            if (error) throw error;

            return count || 0;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getActiveEncoders',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get catch trends for chart (last 6 months)
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getCatchTrends(userProfile) {
        try {
            // Get last 6 months of data
            const now = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);

            let query = window._supabase
                .from('dbo_LC_FG_sample_day')
                .select('sdate')
                .gte('sdate', sixMonthsAgo.toISOString().split('T')[0])
                .order('sdate', { ascending: true });

            // Apply RBAC filtering - Only encoder and viewer are limited to their region
            // Superadmin and Admin can access all data
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by month
            const monthlyData = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            if (data && data.length > 0) {
                data.forEach(record => {
                    if (record.sdate) {
                        const date = new Date(record.sdate);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
                    }
                });
            }

            // Get last 6 months
            const labels = [];
            const values = [];

            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = monthNames[date.getMonth()];
                
                labels.push(monthName);
                values.push(monthlyData[monthKey] || 0);
            }

            return { labels, values };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getCatchTrends',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get species distribution for chart
     * Placeholder - will need species/catch table
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Chart data with labels and values
     */
    static async getSpeciesDistribution(userProfile) {
        try {
            // TODO: Update when species/catch table is available
            // For now, return placeholder data
            return {
                labels: ['Tuna', 'Sardines', 'Mackerel', 'Squid', 'Others'],
                values: [40, 25, 20, 10, 5]
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getSpeciesDistribution',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get recent activity
     * Gets recent sample days as activity
     * @param {Object} userProfile - Current user profile
     * @param {number} limit - Number of activities to return (default: 5)
     * @returns {Promise<Array>} Array of activity objects
     */
    static async getRecentActivity(userProfile, limit = 5) {
        try {
            let query = window._supabase
                .from('dbo_LC_FG_sample_day')
                .select(`
                    unload_day_id,
                    sdate,
                    dbo_region(region_name),
                    dbo_landing_center(landing_center),
                    dbo_fishing_ground(ground_desc)
                `)
                .order('sdate', { ascending: false })
                .limit(limit);

            // Apply RBAC filtering - Only encoder and viewer are limited to their region
            // Superadmin and Admin can access all data
            if (userProfile && !ADMIN_ROLES.includes(userProfile.role)) {
                query = query.eq('region_id', userProfile.region_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Format activities
            const activities = (data || []).map(record => {
                const date = record.sdate ? new Date(record.sdate) : new Date();
                const timeAgo = this.getTimeAgo(date);
                const regionName = record.dbo_region?.region_name || 'Unknown';
                const landingCenter = record.dbo_landing_center?.landing_center || 'Unknown';
                
                return {
                    id: record.unload_day_id,
                    user: 'System', // TODO: Get actual user from record
                    action: 'Added sample day',
                    target: `${landingCenter} - ${regionName}`,
                    time: timeAgo,
                    initial: regionName.charAt(0).toUpperCase()
                };
            });

            return activities;
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getRecentActivity',
                    showToast: false
                });
            }
            throw error;
        }
    }

    /**
     * Get time ago string from date
     * @param {Date} date - Date to calculate from
     * @returns {string} Time ago string
     */
    static getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        
        return date.toLocaleDateString();
    }

    /**
     * Get all dashboard statistics at once
     * @param {Object} userProfile - Current user profile
     * @returns {Promise<Object>} Dashboard statistics object
     */
    static async getAllStats(userProfile) {
        try {
            const [totalLandings, verifiedRecords, pendingReviews, activeEncoders] = await Promise.all([
                this.getTotalLandings(userProfile),
                this.getVerifiedRecords(userProfile),
                this.getPendingReviews(userProfile),
                this.getActiveEncoders(userProfile)
            ]);

            return {
                totalLandings,
                verifiedRecords,
                pendingReviews,
                activeEncoders
            };
        } catch (error) {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'DashboardService.getAllStats',
                    userMessage: 'Failed to load dashboard statistics'
                });
            }
            throw error;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DashboardService = DashboardService;
}

