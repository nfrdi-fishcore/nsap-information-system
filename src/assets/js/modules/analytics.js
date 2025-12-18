/**
 * Analytics Logic - NSAP Information System
 * Handles Chart.js initialization, data population, and user interactions
 */

let trendChart = null;
let speciesChart = null;
let regionalChart = null;
let gearChart = null;
let currentUser = null;
let currentFilters = {
    fromDate: null,
    toDate: null,
    regionId: null,
    gearId: null,
    effortUnitId: null,
    vesselId: null
};
let trendAggregation = 'daily'; // 'monthly' or 'daily'

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const session = await getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Load user profile
    currentUser = await getUserProfile();
    if (!currentUser) {
        if (window.toast) {
            window.toast.error('Failed to load user profile. Please refresh the page.');
        }
        return;
    }

    // Initialize analytics
    await initAnalytics();
});

/**
 * Initialize analytics dashboard
 */
async function initAnalytics() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        if (window.ErrorHandler) {
            ErrorHandler.handle(new Error('Chart.js not loaded'), {
                context: 'Analytics.initAnalytics',
                userMessage: 'Chart library not available. Some features may not work.',
                showToast: false
            });
        }
        return;
    }

    // Check if AnalyticsService is available
    if (typeof AnalyticsService === 'undefined') {
        if (window.ErrorHandler) {
            ErrorHandler.handle(new Error('AnalyticsService not loaded'), {
                context: 'Analytics.initAnalytics',
                userMessage: 'Analytics service not available. Please refresh the page.',
                showToast: true
            });
        }
        return;
    }

    try {
        // Load saved preset or use empty (all data)
        const savedPreset = localStorage.getItem('analytics_date_preset') || '';
        
        // Set the saved preset as selected in dropdown
        const presetSelect = document.getElementById('datePresetSelect');
        if (presetSelect) {
            presetSelect.value = savedPreset;
        }

        // Only set date range if a preset is selected
        if (savedPreset && savedPreset !== '' && savedPreset !== 'custom') {
            const dateRange = getDateRangeForPreset(savedPreset);
            document.getElementById('dateRangeFrom').value = dateRange.fromDate.toISOString().split('T')[0];
            document.getElementById('dateRangeTo').value = dateRange.toDate.toISOString().split('T')[0];
            currentFilters.fromDate = dateRange.fromDate;
            currentFilters.toDate = dateRange.toDate;
        } else {
            // No date range - show all data
            document.getElementById('dateRangeFrom').value = '';
            document.getElementById('dateRangeTo').value = '';
            currentFilters.fromDate = null;
            currentFilters.toDate = null;
        }

        // Load regions for filter
        await loadRegions();

        // Wire up event listeners
        wireEventListeners();
        
        // Wire up trend view toggle
        wireTrendViewToggle();
        
        // Wire up date preset toggle
        wireDatePresets();

        // Load gear and effort unit options for efficiency metrics
        await loadEfficiencyFilterOptions();

        // Wire up efficiency filter dropdowns
        wireEfficiencyFilters();

        // Load initial data
        await loadAnalyticsData();
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.initAnalytics',
                userMessage: 'Failed to initialize analytics. Please refresh the page.'
            });
        }
    }
}

/**
 * Get date range for a preset
 * @param {string} preset - Preset name
 * @returns {Object} Object with fromDate and toDate
 */
function getDateRangeForPreset(preset) {
    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999); // End of day
    const fromDate = new Date();
    
    switch (preset) {
        case 'last7days':
            fromDate.setDate(fromDate.getDate() - 7);
            break;
        case 'last30days':
            fromDate.setDate(fromDate.getDate() - 30);
            break;
        case 'last3months':
            fromDate.setMonth(fromDate.getMonth() - 3);
            break;
        case 'last6months':
            fromDate.setMonth(fromDate.getMonth() - 6);
            break;
        case 'thismonth':
            fromDate.setDate(1);
            fromDate.setHours(0, 0, 0, 0);
            break;
        case 'lastmonth':
            fromDate.setMonth(fromDate.getMonth() - 1);
            fromDate.setDate(1);
            fromDate.setHours(0, 0, 0, 0);
            const lastMonthEnd = new Date(fromDate);
            lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
            lastMonthEnd.setDate(0);
            lastMonthEnd.setHours(23, 59, 59, 999);
            return { fromDate, toDate: lastMonthEnd };
        case 'thisyear':
            fromDate.setMonth(0, 1);
            fromDate.setHours(0, 0, 0, 0);
            break;
        case 'lastyear':
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            fromDate.setMonth(0, 1);
            fromDate.setHours(0, 0, 0, 0);
            const lastYearEnd = new Date(fromDate);
            lastYearEnd.setFullYear(lastYearEnd.getFullYear() + 1);
            lastYearEnd.setDate(0);
            lastYearEnd.setHours(23, 59, 59, 999);
            return { fromDate, toDate: lastYearEnd };
        case 'custom':
        default:
            // Default to last 6 months if custom or unknown
            fromDate.setMonth(fromDate.getMonth() - 6);
            break;
    }
    
    fromDate.setHours(0, 0, 0, 0);
    return { fromDate, toDate };
}

/**
 * Wire up date preset dropdown
 */
function wireDatePresets() {
    const presetSelect = document.getElementById('datePresetSelect');
    
    if (!presetSelect) return;
    
    presetSelect.addEventListener('change', async (e) => {
        const preset = e.target.value;
        
        if (preset === 'custom') {
            // Don't auto-apply for custom - let user set dates manually
            localStorage.setItem('analytics_date_preset', 'custom');
            return;
        }
        
        if (preset === '' || !preset) {
            // All Data - clear date filters
            document.getElementById('dateRangeFrom').value = '';
            document.getElementById('dateRangeTo').value = '';
            currentFilters.fromDate = null;
            currentFilters.toDate = null;
            localStorage.setItem('analytics_date_preset', '');
            await applyFilters();
            return;
        }
        
        // Get date range for preset
        const dateRange = getDateRangeForPreset(preset);
        
        // Update date inputs
        document.getElementById('dateRangeFrom').value = dateRange.fromDate.toISOString().split('T')[0];
        document.getElementById('dateRangeTo').value = dateRange.toDate.toISOString().split('T')[0];
        
        // Update current filters
        currentFilters.fromDate = dateRange.fromDate;
        currentFilters.toDate = dateRange.toDate;
        
        // Save preset to localStorage
        localStorage.setItem('analytics_date_preset', preset);
        
        // Auto-apply filters
        await applyFilters();
    });
    
    // Listen for manual date changes to switch to custom
    const fromDateInput = document.getElementById('dateRangeFrom');
    const toDateInput = document.getElementById('dateRangeTo');
    
    [fromDateInput, toDateInput].forEach(input => {
        input.addEventListener('change', () => {
            // Check if current dates match any preset
            const currentFrom = new Date(fromDateInput.value);
            const currentTo = new Date(toDateInput.value);
            
            if (!currentFrom || !currentTo || isNaN(currentFrom.getTime()) || isNaN(currentTo.getTime())) {
                return;
            }
            
            // Try to match with presets
            let matchedPreset = 'custom';
            const presets = ['last7days', 'last30days', 'last3months', 'last6months', 'thismonth', 'lastmonth', 'thisyear', 'lastyear'];
            
            for (const preset of presets) {
                const presetRange = getDateRangeForPreset(preset);
                // Compare dates (ignore time)
                const presetFrom = new Date(presetRange.fromDate);
                presetFrom.setHours(0, 0, 0, 0);
                const presetTo = new Date(presetRange.toDate);
                presetTo.setHours(23, 59, 59, 999);
                
                currentFrom.setHours(0, 0, 0, 0);
                currentTo.setHours(23, 59, 59, 999);
                
                if (presetFrom.getTime() === currentFrom.getTime() && 
                    presetTo.getTime() === currentTo.getTime()) {
                    matchedPreset = preset;
                    break;
                }
            }
            
            // Update preset dropdown selection
            if (presetSelect) {
                presetSelect.value = matchedPreset;
            }
            
            localStorage.setItem('analytics_date_preset', matchedPreset);
        });
    });
}

/**
 * Wire up event listeners
 */
function wireEventListeners() {
    // Apply filters button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', async () => {
            await applyFilters();
        });
    }

    // Export buttons
    const exportTrendsBtn = document.getElementById('exportTrendsBtn');
    if (exportTrendsBtn) {
        exportTrendsBtn.addEventListener('click', () => exportTrendsData());
    }

    const exportSpeciesBtn = document.getElementById('exportSpeciesBtn');
    if (exportSpeciesBtn) {
        exportSpeciesBtn.addEventListener('click', () => exportSpeciesData());
    }

    const exportRegionalBtn = document.getElementById('exportRegionalBtn');
    if (exportRegionalBtn) {
        exportRegionalBtn.addEventListener('click', () => exportRegionalData());
    }

    const exportGearBtn = document.getElementById('exportGearBtn');
    if (exportGearBtn) {
        exportGearBtn.addEventListener('click', () => exportGearData());
    }
}

/**
 * Wire up trend view toggle (monthly/daily)
 */
function wireTrendViewToggle() {
    const monthlyRadio = document.getElementById('trendViewMonthly');
    const dailyRadio = document.getElementById('trendViewDaily');
    
    if (monthlyRadio) {
        monthlyRadio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                trendAggregation = 'monthly';
                await loadTrendChart();
            }
        });
    }
    
    if (dailyRadio) {
        dailyRadio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                trendAggregation = 'daily';
                await loadTrendChart();
            }
        });
    }
}

/**
 * Load regions for filter dropdown
 */
async function loadRegions() {
    try {
        const regions = await AnalyticsService.getRegions(currentUser);
        const regionSelect = document.getElementById('regionFilter');
        if (!regionSelect) return;

        // Clear existing options except "All Regions"
        regionSelect.innerHTML = '<option value="">All Regions</option>';

        // Add regions
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.region_id;
            option.textContent = Validation.escapeHtml(region.region_name);
            regionSelect.appendChild(option);
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadRegions',
                userMessage: 'Failed to load regions',
                showToast: false
            });
        }
    }
}

/**
 * Apply filters and reload data
 */
async function applyFilters() {
    try {
        const fromDateInput = document.getElementById('dateRangeFrom');
        const toDateInput = document.getElementById('dateRangeTo');
        const regionSelect = document.getElementById('regionFilter');

        if (!fromDateInput || !toDateInput || !regionSelect) return;

        const fromDate = fromDateInput.value ? new Date(fromDateInput.value) : null;
        const toDate = toDateInput.value ? new Date(toDateInput.value) : null;
        const regionId = regionSelect.value ? parseInt(regionSelect.value, 10) : null;

        // Validate date range
        if (fromDate && toDate && fromDate > toDate) {
            if (window.toast) {
                window.toast.error('From date must be before To date');
            }
            return;
        }

        currentFilters.fromDate = fromDate;
        currentFilters.toDate = toDate;
        currentFilters.regionId = regionId;

        // Clear cache when filters change
        if (window.AnalyticsService) {
            AnalyticsService.clearCache('getCatchTrends');
            AnalyticsService.clearCache('getSpeciesDistribution');
            AnalyticsService.clearCache('getRegionalComparison');
            AnalyticsService.clearCache('getGearAnalysis');
            AnalyticsService.clearCache('getComparisonStats');
            AnalyticsService.clearCache('getVesselStats');
            AnalyticsService.clearCache('getSampleDayStats');
            AnalyticsService.clearCache('getTopVessels');
            AnalyticsService.clearCache('getTopSpecies');
            AnalyticsService.clearCache('getTopLandingCenters');
            AnalyticsService.clearCache('getTopFishingGrounds');
        }

        // Reset lazy loading state
        lazyLoadState.comparisonStats = false;
        lazyLoadState.trendChart = false;
        lazyLoadState.speciesChart = false;
        lazyLoadState.regionalChart = false;
        lazyLoadState.gearChart = false;

        // Reload data
        await loadAnalyticsData();
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.applyFilters',
                userMessage: 'Failed to apply filters'
            });
        }
    }
}

// Lazy loading state
const lazyLoadState = {
    comparisonStats: false,
    trendChart: false,
    speciesChart: false,
    regionalChart: false,
    gearChart: false
};

/**
 * Check if element is visible in viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element is visible
 */
function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= windowHeight &&
        rect.right <= windowWidth
    );
}

/**
 * Load all analytics data (with lazy loading support)
 */
async function loadAnalyticsData() {
    try {
        showLoadingState();

        // Always load comparison stats first (small, fast, always visible)
        await loadComparisonStats();

        // Load visible charts immediately, others will load on scroll
        const loadPromises = [loadTrendChart()]; // Trend chart is always visible
        
        // Check which other charts are visible
        const speciesChartEl = document.getElementById('speciesChart');
        const regionalChartEl = document.getElementById('regionalChart');
        const gearChartEl = document.getElementById('gearChart');
        const topVesselsTableEl = document.getElementById('topVesselsTableBody');
        const topSpeciesTableEl = document.getElementById('topSpeciesTableBody');
        const topLandingCentersTableEl = document.getElementById('topLandingCentersTableBody');
        const topFishingGroundsTableEl = document.getElementById('topFishingGroundsTableBody');

        if (speciesChartEl && isElementVisible(speciesChartEl.parentElement)) {
            loadPromises.push(loadSpeciesChart());
        }
        if (regionalChartEl && isElementVisible(regionalChartEl.parentElement)) {
            loadPromises.push(loadRegionalChart());
        }
        if (gearChartEl && isElementVisible(gearChartEl.parentElement)) {
            loadPromises.push(loadGearChart());
        }
        // Load top performers tables (always load them, they're lightweight)
        loadPromises.push(loadTopVesselsChart());
        loadPromises.push(loadTopSpeciesChart());
        loadPromises.push(loadTopLandingCentersChart());
        loadPromises.push(loadTopFishingGroundsChart());
        
        // Load efficiency metrics
        loadPromises.push(loadEfficiencyMetrics());

        await Promise.all(loadPromises);

        // Set up intersection observer for lazy loading remaining charts
        setupLazyLoading();

        hideLoadingState();
    } catch (error) {
        hideLoadingState();
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadAnalyticsData',
                userMessage: 'Failed to load analytics data'
            });
        }
    }
}

/**
 * Set up intersection observer for lazy loading charts
 */
function setupLazyLoading() {
    // Use Intersection Observer API for better performance
    if (typeof IntersectionObserver === 'undefined') {
        // Fallback: load all charts if IntersectionObserver not supported
        Promise.all([
            loadSpeciesChart(),
            loadRegionalChart(),
            loadGearChart(),
            loadTopVesselsChart(),
            loadTopSpeciesChart(),
            loadTopLandingCentersChart(),
            loadTopFishingGroundsChart()
        ]).catch(error => {
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, {
                    context: 'Analytics.setupLazyLoading',
                    showToast: false
                });
            }
        });
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '100px', // Start loading 100px before element is visible
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const targetId = entry.target.id;
                
                if (targetId === 'speciesChart' && !lazyLoadState.speciesChart) {
                    lazyLoadState.speciesChart = true;
                    loadSpeciesChart().catch(error => {
                        if (window.ErrorHandler) {
                            ErrorHandler.handle(error, {
                                context: 'Analytics.lazyLoadSpecies',
                                showToast: false
                            });
                        }
                    });
                    observer.unobserve(entry.target);
                } else if (targetId === 'regionalChart' && !lazyLoadState.regionalChart) {
                    lazyLoadState.regionalChart = true;
                    loadRegionalChart().catch(error => {
                        if (window.ErrorHandler) {
                            ErrorHandler.handle(error, {
                                context: 'Analytics.lazyLoadRegional',
                                showToast: false
                            });
                        }
                    });
                    observer.unobserve(entry.target);
                } else if (targetId === 'gearChart' && !lazyLoadState.gearChart) {
                    lazyLoadState.gearChart = true;
                    loadGearChart().catch(error => {
                        if (window.ErrorHandler) {
                            ErrorHandler.handle(error, {
                                context: 'Analytics.lazyLoadGear',
                                showToast: false
                            });
                        }
                    });
                    observer.unobserve(entry.target);
                }
            }
        });
    }, observerOptions);

    // Observe chart containers (top performers are now tables, loaded immediately)
    const speciesChartEl = document.getElementById('speciesChart');
    const regionalChartEl = document.getElementById('regionalChart');
    const gearChartEl = document.getElementById('gearChart');

    if (speciesChartEl && !lazyLoadState.speciesChart) {
        observer.observe(speciesChartEl);
    }
    if (regionalChartEl && !lazyLoadState.regionalChart) {
        observer.observe(regionalChartEl);
    }
    if (gearChartEl && !lazyLoadState.gearChart) {
        observer.observe(gearChartEl);
    }
}

/**
 * Load comparison statistics
 */
async function loadComparisonStats() {
    try {
        const container = document.getElementById('comparisonStats');
        if (!container) return;

        // If no date range is set, show overall totals
        if (!currentFilters.fromDate || !currentFilters.toDate) {
            // Get overall totals (all data)
            const [overallTrends, overallVesselData, overallSampleDayData] = await Promise.all([
                AnalyticsService.getCatchTrends(currentUser, null, null, 'monthly', currentFilters.regionId),
                AnalyticsService.getVesselStats(currentUser, null, null, currentFilters.regionId),
                AnalyticsService.getSampleDayStats(currentUser, null, null, currentFilters.regionId)
            ]);

            // Calculate overall totals
            const totalCatch = overallTrends.values.reduce((sum, val) => sum + val, 0);
            const avgCatchPerDay = overallSampleDayData.count > 0 
                ? totalCatch / overallSampleDayData.count 
                : 0;
            const vesselCount = overallVesselData.count;

            container.innerHTML = `
                <div class="stat-comparison-card">
                    <h6><i class="bi bi-box-seam"></i> Total Catch</h6>
                    <div class="stat-value">${formatNumber(Math.round(totalCatch))} KG</div>
                    <div class="stat-change" style="color: #64748b;">
                        <i class="bi bi-info-circle"></i>
                        <span>Overall Total</span>
                    </div>
                </div>
                <div class="stat-comparison-card">
                    <h6><i class="bi bi-speedometer2"></i> Avg Catch/Day</h6>
                    <div class="stat-value">${formatNumber(Math.round(avgCatchPerDay))} KG</div>
                    <div class="stat-change" style="color: #64748b;">
                        <i class="bi bi-info-circle"></i>
                        <span>Overall Average</span>
                    </div>
                </div>
                <div class="stat-comparison-card">
                    <h6><i class="bi bi-ship"></i> Active Vessels</h6>
                    <div class="stat-value">${formatNumber(vesselCount)}</div>
                    <div class="stat-change" style="color: #64748b;">
                        <i class="bi bi-info-circle"></i>
                        <span>Total Vessels</span>
                    </div>
                </div>
            `;
            return;
        }

        // Show period-over-period comparison when date range is set
        const stats = await AnalyticsService.getComparisonStats(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        container.innerHTML = `
            <div class="stat-comparison-card">
                <h6><i class="bi bi-box-seam"></i> Total Catch</h6>
                <div class="stat-value">${formatNumber(Math.round(stats.totalCatch.current))} KG</div>
                <div class="stat-change ${stats.totalCatch.change >= 0 ? 'positive' : 'negative'}">
                    <i class="bi bi-arrow-${stats.totalCatch.change >= 0 ? 'up' : 'down'}-right"></i>
                    <span>${stats.totalCatch.change >= 0 ? '+' : ''}${formatNumber(Math.round(stats.totalCatch.change))} KG (${stats.totalCatch.changePercent}%)</span>
                </div>
            </div>
            <div class="stat-comparison-card">
                <h6><i class="bi bi-speedometer2"></i> Avg Catch/Day</h6>
                <div class="stat-value">${formatNumber(Math.round(stats.avgCatchPerDay.current))} KG</div>
                <div class="stat-change ${stats.avgCatchPerDay.change >= 0 ? 'positive' : 'negative'}">
                    <i class="bi bi-arrow-${stats.avgCatchPerDay.change >= 0 ? 'up' : 'down'}-right"></i>
                    <span>${stats.avgCatchPerDay.change >= 0 ? '+' : ''}${formatNumber(Math.round(stats.avgCatchPerDay.change))} KG (${stats.avgCatchPerDay.changePercent}%)</span>
                </div>
            </div>
            <div class="stat-comparison-card">
                <h6><i class="bi bi-ship"></i> Active Vessels</h6>
                <div class="stat-value">${formatNumber(stats.vesselCount.current)}</div>
                <div class="stat-change ${stats.vesselCount.change >= 0 ? 'positive' : 'negative'}">
                    <i class="bi bi-arrow-${stats.vesselCount.change >= 0 ? 'up' : 'down'}-right"></i>
                    <span>${stats.vesselCount.change >= 0 ? '+' : ''}${stats.vesselCount.change} (${stats.vesselCount.changePercent}%)</span>
                </div>
            </div>
        `;
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadComparisonStats',
                userMessage: 'Failed to load comparison statistics',
                showToast: false
            });
        }
        // Show error message in container
        const container = document.getElementById('comparisonStats');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle fs-4"></i>
                    <p class="mt-2 mb-0">Failed to load comparison statistics.</p>
                </div>
            `;
        }
    }
}

/**
 * Load trend chart
 */
async function loadTrendChart() {
    try {
        const chartData = await AnalyticsService.getCatchTrends(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            trendAggregation,
            currentFilters.regionId
        );

        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Destroy existing chart
        if (trendChart) {
            trendChart.destroy();
        }

        // Create gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Catch Volume (KG)',
                    data: chartData.values,
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Catch: ${formatNumber(context.parsed.y)} KG`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadTrendChart',
                userMessage: 'Failed to load trend chart',
                showToast: false
            });
        }
    }
}

/**
 * Load species distribution chart
 */
async function loadSpeciesChart() {
    try {
        const chartData = await AnalyticsService.getSpeciesDistribution(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const ctx = document.getElementById('speciesChart');
        if (!ctx) return;

        // Destroy existing chart
        if (speciesChart) {
            speciesChart.destroy();
        }

        const colors = [
            '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
            '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
        ];

        speciesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    backgroundColor: colors.slice(0, chartData.labels.length),
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            color: '#64748b',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${formatNumber(context.parsed)} KG (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadSpeciesChart',
                userMessage: 'Failed to load species chart',
                showToast: false
            });
        }
    }
}

/**
 * Load regional comparison chart
 */
async function loadRegionalChart() {
    try {
        const chartData = await AnalyticsService.getRegionalComparison(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const ctx = document.getElementById('regionalChart');
        if (!ctx) return;

        // Destroy existing chart
        if (regionalChart) {
            regionalChart.destroy();
        }

        regionalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Catch Volume (KG)',
                    data: chartData.values,
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Catch: ${formatNumber(context.parsed.y)} KG`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadRegionalChart',
                userMessage: 'Failed to load regional chart',
                showToast: false
            });
        }
    }
}

/**
 * Load gear analysis chart
 */
async function loadGearChart() {
    try {
        const chartData = await AnalyticsService.getGearAnalysis(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const ctx = document.getElementById('gearChart');
        if (!ctx) return;

        // Destroy existing chart
        if (gearChart) {
            gearChart.destroy();
        }

        gearChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Catch Volume (KG)',
                    data: chartData.values,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Catch: ${formatNumber(context.parsed.x)} KG`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadGearChart',
                userMessage: 'Failed to load gear chart',
                showToast: false
            });
        }
    }
}

/**
 * Export trends data to CSV
 */
async function exportTrendsData() {
    try {
        const chartData = await AnalyticsService.getCatchTrends(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            trendAggregation,
            currentFilters.regionId
        );
        
        const periodLabel = trendAggregation === 'daily' ? 'Date' : 'Month';

        const csv = [
            [periodLabel, 'Catch Volume (KG)'],
            ...chartData.labels.map((label, index) => [label, chartData.values[index]])
        ].map(row => row.join(',')).join('\n');
        
        const filename = trendAggregation === 'daily' ? 'catch_trends_daily.csv' : 'catch_trends_monthly.csv';

        downloadCSV(csv, filename);
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportTrendsData',
                userMessage: 'Failed to export trends data'
            });
        }
    }
}

/**
 * Export species data to CSV
 */
async function exportSpeciesData() {
    try {
        const chartData = await AnalyticsService.getSpeciesDistribution(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const csv = [
            ['Species', 'Catch Volume (KG)'],
            ...chartData.labels.map((label, index) => [label, chartData.values[index]])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'species_distribution.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportSpeciesData',
                userMessage: 'Failed to export species data'
            });
        }
    }
}

/**
 * Export regional data to CSV
 */
async function exportRegionalData() {
    try {
        const chartData = await AnalyticsService.getRegionalComparison(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const csv = [
            ['Region', 'Catch Volume (KG)'],
            ...chartData.labels.map((label, index) => [label, chartData.values[index]])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'regional_comparison.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportRegionalData',
                userMessage: 'Failed to export regional data'
            });
        }
    }
}

/**
 * Export gear data to CSV
 */
async function exportGearData() {
    try {
        const chartData = await AnalyticsService.getGearAnalysis(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId
        );

        const csv = [
            ['Gear Type', 'Catch Volume (KG)'],
            ...chartData.labels.map((label, index) => [label, chartData.values[index]])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'gear_analysis.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportGearData',
                userMessage: 'Failed to export gear data'
            });
        }
    }
}

/**
 * Load top vessels table
 */
async function loadTopVesselsChart() {
    try {
        const chartData = await AnalyticsService.getTopVessels(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const tableBody = document.getElementById('topVesselsTableBody');
        if (!tableBody) return;

        if (!chartData.rawData || chartData.rawData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        <i class="bi bi-inbox"></i>
                        <div class="mt-2 small">No data available</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = chartData.rawData.map((vessel, index) => `
            <tr>
                <td class="text-muted fw-bold">${index + 1}</td>
                <td class="text-truncate" style="max-width: 120px;" title="${Validation.escapeHtml(vessel.name)}">${Validation.escapeHtml(vessel.name)}</td>
                <td class="text-end fw-medium">${formatNumber(Math.round(vessel.catch))}</td>
                <td class="text-end text-muted small">${vessel.percentage}%</td>
            </tr>
        `).join('');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadTopVesselsChart',
                userMessage: 'Failed to load top vessels data',
                showToast: false
            });
        }
        const tableBody = document.getElementById('topVesselsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <div class="mt-2 small">Failed to load</div>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Load top species table
 */
async function loadTopSpeciesChart() {
    try {
        const chartData = await AnalyticsService.getTopSpecies(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const tableBody = document.getElementById('topSpeciesTableBody');
        if (!tableBody) return;

        if (!chartData.rawData || chartData.rawData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        <i class="bi bi-inbox"></i>
                        <div class="mt-2 small">No data available</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = chartData.rawData.map((species, index) => `
            <tr>
                <td class="text-muted fw-bold">${index + 1}</td>
                <td class="text-truncate" style="max-width: 120px;" title="${Validation.escapeHtml(species.name)}">${Validation.escapeHtml(species.name)}</td>
                <td class="text-end fw-medium">${formatNumber(Math.round(species.catch))}</td>
                <td class="text-end text-muted small">${species.percentage}%</td>
            </tr>
        `).join('');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadTopSpeciesChart',
                userMessage: 'Failed to load top species data',
                showToast: false
            });
        }
        const tableBody = document.getElementById('topSpeciesTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <div class="mt-2 small">Failed to load</div>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Load top landing centers table
 */
async function loadTopLandingCentersChart() {
    try {
        const chartData = await AnalyticsService.getTopLandingCenters(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const tableBody = document.getElementById('topLandingCentersTableBody');
        if (!tableBody) return;

        if (!chartData.rawData || chartData.rawData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        <i class="bi bi-inbox"></i>
                        <div class="mt-2 small">No data available</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = chartData.rawData.map((lc, index) => `
            <tr>
                <td class="text-muted fw-bold">${index + 1}</td>
                <td class="text-truncate" style="max-width: 120px;" title="${Validation.escapeHtml(lc.name)}">${Validation.escapeHtml(lc.name)}</td>
                <td class="text-end fw-medium">${formatNumber(Math.round(lc.catch))}</td>
                <td class="text-end text-muted small">${lc.percentage}%</td>
            </tr>
        `).join('');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadTopLandingCentersChart',
                userMessage: 'Failed to load top landing centers data',
                showToast: false
            });
        }
        const tableBody = document.getElementById('topLandingCentersTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <div class="mt-2 small">Failed to load</div>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Load top fishing grounds table
 */
async function loadTopFishingGroundsChart() {
    try {
        const chartData = await AnalyticsService.getTopFishingGrounds(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const tableBody = document.getElementById('topFishingGroundsTableBody');
        if (!tableBody) return;

        if (!chartData.rawData || chartData.rawData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        <i class="bi bi-inbox"></i>
                        <div class="mt-2 small">No data available</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = chartData.rawData.map((fg, index) => `
            <tr>
                <td class="text-muted fw-bold">${index + 1}</td>
                <td class="text-truncate" style="max-width: 120px;" title="${Validation.escapeHtml(fg.name)}">${Validation.escapeHtml(fg.name)}</td>
                <td class="text-end fw-medium">${formatNumber(Math.round(fg.catch))}</td>
                <td class="text-end text-muted small">${fg.percentage}%</td>
            </tr>
        `).join('');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadTopFishingGroundsChart',
                userMessage: 'Failed to load top fishing grounds data',
                showToast: false
            });
        }
        const tableBody = document.getElementById('topFishingGroundsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <div class="mt-2 small">Failed to load</div>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Export top vessels data to CSV
 */
async function exportTopVesselsData() {
    try {
        const chartData = await AnalyticsService.getTopVessels(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const csv = [
            ['Rank', 'Vessel Name', 'Catch Volume (KG)', 'Percentage of Total'],
            ...chartData.rawData.map((vessel, index) => [
                index + 1,
                vessel.name,
                vessel.catch,
                `${vessel.percentage}%`
            ])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'top_vessels.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportTopVesselsData',
                userMessage: 'Failed to export top vessels data'
            });
        }
    }
}

/**
 * Export top species data to CSV
 */
async function exportTopSpeciesData() {
    try {
        const chartData = await AnalyticsService.getTopSpecies(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const csv = [
            ['Rank', 'Species', 'Catch Volume (KG)', 'Percentage of Total'],
            ...chartData.rawData.map((species, index) => [
                index + 1,
                species.name,
                species.catch,
                `${species.percentage}%`
            ])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'top_species.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportTopSpeciesData',
                userMessage: 'Failed to export top species data'
            });
        }
    }
}

/**
 * Export top landing centers data to CSV
 */
async function exportTopLandingCentersData() {
    try {
        const chartData = await AnalyticsService.getTopLandingCenters(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const csv = [
            ['Rank', 'Landing Center', 'Catch Volume (KG)', 'Percentage of Total'],
            ...chartData.rawData.map((lc, index) => [
                index + 1,
                lc.name,
                lc.catch,
                `${lc.percentage}%`
            ])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'top_landing_centers.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportTopLandingCentersData',
                userMessage: 'Failed to export top landing centers data'
            });
        }
    }
}

/**
 * Export top fishing grounds data to CSV
 */
async function exportTopFishingGroundsData() {
    try {
        const chartData = await AnalyticsService.getTopFishingGrounds(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            10
        );

        const csv = [
            ['Rank', 'Fishing Ground', 'Catch Volume (KG)', 'Percentage of Total'],
            ...chartData.rawData.map((fg, index) => [
                index + 1,
                fg.name,
                fg.catch,
                `${fg.percentage}%`
            ])
        ].map(row => row.join(',')).join('\n');

        downloadCSV(csv, 'top_fishing_grounds.csv');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.exportTopFishingGroundsData',
                userMessage: 'Failed to export top fishing grounds data'
            });
        }
    }
}

/**
 * Download CSV file
 */
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Load gear, effort unit, and vessel options for efficiency filter dropdowns
 */
async function loadEfficiencyFilterOptions() {
    try {
        // Load gears
        const { data: gears, error: gearError } = await window._supabase
            .from(TABLES.GEAR)
            .select('gr_id, gear_desc')
            .order('gear_desc', { ascending: true });

        if (!gearError && gears) {
            const gearSelect = document.getElementById('gearFilterSelect');
            if (gearSelect) {
                gears.forEach(gear => {
                    const option = document.createElement('option');
                    option.value = gear.gr_id;
                    option.textContent = gear.gear_desc || `Gear ${gear.gr_id}`;
                    gearSelect.appendChild(option);
                });
            }
        }

        // Load fishing effort units
        const { data: efforts, error: effortError } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .select('uniteffort_id, fishing_effort')
            .order('fishing_effort', { ascending: true });

        if (!effortError && efforts) {
            const effortSelect = document.getElementById('effortUnitFilterSelect');
            if (effortSelect) {
                efforts.forEach(effort => {
                    const option = document.createElement('option');
                    option.value = effort.uniteffort_id;
                    option.textContent = effort.fishing_effort || `Effort ${effort.uniteffort_id}`;
                    effortSelect.appendChild(option);
                });
            }
        }

        // Load vessels (with RBAC filtering)
        let vesselQuery = window._supabase
            .from(TABLES.VESSEL)
            .select('boat_id, vesselname')
            .order('vesselname', { ascending: true });

        // Apply RBAC filtering
        if (currentUser && !ADMIN_ROLES.includes(currentUser.role)) {
            vesselQuery = vesselQuery.eq('region_id', currentUser.region_id);
        }

        const { data: vessels, error: vesselError } = await vesselQuery;

        if (!vesselError && vessels) {
            const vesselSelect = document.getElementById('vesselFilterSelect');
            if (vesselSelect) {
                vessels.forEach(vessel => {
                    const option = document.createElement('option');
                    option.value = vessel.boat_id;
                    option.textContent = vessel.vesselname || `Vessel ${vessel.boat_id}`;
                    vesselSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadEfficiencyFilterOptions',
                showToast: false
            });
        }
    }
}

/**
 * Wire up efficiency filter dropdowns
 */
function wireEfficiencyFilters() {
    const gearSelect = document.getElementById('gearFilterSelect');
    const effortSelect = document.getElementById('effortUnitFilterSelect');
    const vesselSelect = document.getElementById('vesselFilterSelect');

    if (gearSelect) {
        gearSelect.addEventListener('change', async (e) => {
            currentFilters.gearId = e.target.value || null;
            await loadEfficiencyMetrics();
        });
    }

    if (effortSelect) {
        effortSelect.addEventListener('change', async (e) => {
            currentFilters.effortUnitId = e.target.value || null;
            await loadEfficiencyMetrics();
        });
    }

    if (vesselSelect) {
        vesselSelect.addEventListener('change', async (e) => {
            currentFilters.vesselId = e.target.value || null;
            await loadEfficiencyMetrics();
        });
    }
}

/**
 * Load efficiency metrics
 */
async function loadEfficiencyMetrics() {
    try {
        const metrics = await AnalyticsService.getEfficiencyMetrics(
            currentUser,
            currentFilters.fromDate,
            currentFilters.toDate,
            currentFilters.regionId,
            currentFilters.gearId,
            currentFilters.effortUnitId,
            currentFilters.vesselId
        );

        // Catch per Vessel
        const catchPerVesselEl = document.getElementById('catchPerVesselValue');
        const catchPerVesselTotalEl = document.getElementById('catchPerVesselTotal');
        const catchPerVesselVesselsEl = document.getElementById('catchPerVesselVessels');
        const catchPerVesselInfoEl = document.getElementById('catchPerVesselInfo');
        if (catchPerVesselEl) {
            catchPerVesselEl.textContent = `${formatNumber(Math.round(metrics.catchPerVessel))} KG`;
        }
        if (catchPerVesselTotalEl) {
            catchPerVesselTotalEl.textContent = formatNumber(Math.round(metrics.totalCatch));
        }
        if (catchPerVesselVesselsEl) {
            catchPerVesselVesselsEl.textContent = formatNumber(metrics.uniqueVessels);
        }
        if (catchPerVesselInfoEl) {
            if (currentFilters.vesselId) {
                const vesselSelect = document.getElementById('vesselFilterSelect');
                const selectedVessel = vesselSelect ? vesselSelect.options[vesselSelect.selectedIndex]?.textContent : 'Selected vessel';
                catchPerVesselInfoEl.innerHTML = `Catch for ${selectedVessel}: <span id="catchPerVesselTotal">${formatNumber(Math.round(metrics.totalCatch))}</span> KG`;
            } else {
                catchPerVesselInfoEl.innerHTML = `Total: <span id="catchPerVesselTotal">${formatNumber(Math.round(metrics.totalCatch))}</span> KG / <span id="catchPerVesselVessels">${formatNumber(metrics.uniqueVessels)}</span> vessels`;
            }
        }

        // Average Catch per Gear
        const avgCatchPerGearEl = document.getElementById('avgCatchPerGearValue');
        const avgCatchPerGearInfoEl = document.getElementById('avgCatchPerGearInfo');
        if (currentFilters.gearId) {
            // Show specific gear average (from catchPerGear object)
            const gearValues = Object.values(metrics.catchPerGear);
            const avgCatchPerGear = gearValues.length > 0 
                ? gearValues.reduce((sum, val) => sum + val, 0) / gearValues.length 
                : 0;
            if (avgCatchPerGearEl) {
                avgCatchPerGearEl.textContent = `${formatNumber(Math.round(avgCatchPerGear))} KG`;
            }
            if (avgCatchPerGearInfoEl) {
                const gearSelect = document.getElementById('gearFilterSelect');
                const selectedGear = gearSelect ? gearSelect.options[gearSelect.selectedIndex]?.textContent : 'Selected gear';
                avgCatchPerGearInfoEl.textContent = `Average for ${selectedGear}`;
            }
        } else {
            // Show average across all gear types
            const gearValues = Object.values(metrics.catchPerGear);
            const avgCatchPerGear = gearValues.length > 0 
                ? gearValues.reduce((sum, val) => sum + val, 0) / gearValues.length 
                : 0;
            if (avgCatchPerGearEl) {
                avgCatchPerGearEl.textContent = `${formatNumber(Math.round(avgCatchPerGear))} KG`;
            }
            if (avgCatchPerGearInfoEl) {
                avgCatchPerGearInfoEl.textContent = 'Average across all gear types';
            }
        }

        // Catch per Effort Unit
        const catchPerEffortEl = document.getElementById('catchPerEffortValue');
        const catchPerEffortTotalEl = document.getElementById('catchPerEffortTotal');
        const catchPerEffortEffortEl = document.getElementById('catchPerEffortEffort');
        const catchPerEffortInfoEl = document.getElementById('catchPerEffortInfo');
        if (catchPerEffortEl) {
            catchPerEffortEl.textContent = `${formatNumber(metrics.catchPerEffort.toFixed(2))} KG`;
        }
        if (catchPerEffortTotalEl) {
            catchPerEffortTotalEl.textContent = formatNumber(Math.round(metrics.totalCatch));
        }
        if (catchPerEffortEffortEl) {
            catchPerEffortEffortEl.textContent = formatNumber(Math.round(metrics.totalEffort));
        }
        if (catchPerEffortInfoEl) {
            if (currentFilters.effortUnitId) {
                const effortSelect = document.getElementById('effortUnitFilterSelect');
                const selectedEffort = effortSelect ? effortSelect.options[effortSelect.selectedIndex]?.textContent : 'Selected unit';
                catchPerEffortInfoEl.innerHTML = `CPUE for ${selectedEffort}: <span id="catchPerEffortTotal">${formatNumber(Math.round(metrics.totalCatch))}</span> KG / <span id="catchPerEffortEffort">${formatNumber(Math.round(metrics.totalEffort))}</span> units`;
            } else {
                catchPerEffortInfoEl.innerHTML = `CPUE: <span id="catchPerEffortTotal">${formatNumber(Math.round(metrics.totalCatch))}</span> KG / <span id="catchPerEffortEffort">${formatNumber(Math.round(metrics.totalEffort))}</span> units`;
            }
        }

        // Catch per Sample Day
        const catchPerSampleDayEl = document.getElementById('catchPerSampleDayValue');
        const catchPerSampleDayTotalEl = document.getElementById('catchPerSampleDayTotal');
        const catchPerSampleDayCountEl = document.getElementById('catchPerSampleDayCount');
        const catchPerSampleDayInfoEl = document.getElementById('catchPerSampleDayInfo');
        if (catchPerSampleDayEl) {
            catchPerSampleDayEl.textContent = `${formatNumber(Math.round(metrics.catchPerSampleDay))} KG`;
        }
        if (catchPerSampleDayTotalEl) {
            catchPerSampleDayTotalEl.textContent = formatNumber(Math.round(metrics.totalCatch));
        }
        if (catchPerSampleDayCountEl) {
            catchPerSampleDayCountEl.textContent = formatNumber(metrics.sampleDayCount);
        }
        if (catchPerSampleDayInfoEl) {
            catchPerSampleDayInfoEl.innerHTML = `Total: <span id="catchPerSampleDayTotal">${formatNumber(Math.round(metrics.totalCatch))}</span> KG / <span id="catchPerSampleDayCount">${formatNumber(metrics.sampleDayCount)}</span> landings`;
        }
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Analytics.loadEfficiencyMetrics',
                userMessage: 'Failed to load efficiency metrics',
                showToast: false
            });
        }
        // Set error values
        const elements = [
            'catchPerVesselValue', 'avgCatchPerGearValue', 
            'catchPerEffortValue', 'catchPerSampleDayValue'
        ];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error';
        });
    }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
}

/**
 * Show loading state
 */
function showLoadingState() {
    const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
    if (fullPageLoadingOverlay) {
        fullPageLoadingOverlay.style.display = 'flex';
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
    if (fullPageLoadingOverlay) {
        fullPageLoadingOverlay.style.display = 'none';
    }
}

