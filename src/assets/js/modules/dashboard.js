/**
 * Dashboard Logic - NSAP Information System
 * Handles Chart.js initialization and data population
 * 
 * Phase 2: Connected to real data via DashboardService
 * Phase 3: Role-specific dashboards with DashboardRoleService
 */

let catchTrendChart = null;
let speciesChart = null;
let currentUser = null;
let userRole = null;

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

    // Set user role
    userRole = currentUser.role;

    // Initialize role-specific dashboard
    await initDashboard();
});

async function initDashboard() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        if (window.ErrorHandler) {
            ErrorHandler.handle(new Error('Chart.js not loaded'), {
                context: 'Dashboard.initDashboard',
                userMessage: 'Chart library not available. Some features may not work.',
                showToast: false
            });
        }
        return;
    }

    // Check if DashboardService is available
    if (typeof DashboardService === 'undefined') {
        if (window.ErrorHandler) {
            ErrorHandler.handle(new Error('DashboardService not loaded'), {
                context: 'Dashboard.initDashboard',
                userMessage: 'Dashboard service not available. Please refresh the page.',
                showToast: true
            });
        }
        return;
    }

    try {
        // Show loading state
        showLoadingState();

        // Update dashboard header with role-specific welcome message
        updateDashboardHeader();

        // Load role-specific stat cards
        await loadRoleSpecificStats();

        // Load charts (common across all roles)
        await Promise.all([
            loadCatchTrendChart(),
            loadSpeciesChart(),
            loadRecentActivity()
        ]);

        // Load role-specific data tables and quick actions
        await loadRoleSpecificComponents();

        // Hide loading state
        hideLoadingState();
    } catch (error) {
        hideLoadingState();
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.initDashboard',
                userMessage: 'Failed to initialize dashboard. Please refresh the page.'
            });
        }
    }
}

/**
 * Update dashboard header with role-specific welcome message
 */
function updateDashboardHeader() {
    const welcomeText = document.querySelector('.page-title p');
    if (welcomeText) {
        const roleMessages = {
            [ROLES.SUPERADMIN]: 'System-wide overview and management dashboard',
            [ROLES.ADMIN]: 'Regional management and data verification dashboard',
            [ROLES.ENCODER]: 'Your personal data entry and productivity dashboard',
            [ROLES.VIEWER]: 'Regional data insights and analytics dashboard'
        };
        welcomeText.textContent = roleMessages[userRole] || 'Welcome back! Here\'s your data summary for today.';
    }
}

/**
 * Load role-specific dashboard statistics and update stat cards
 */
async function loadRoleSpecificStats() {
    try {
        // Check if DashboardRoleService is available
        if (typeof DashboardRoleService === 'undefined') {
            // Fallback to default stats
            await loadDashboardStats();
            return;
        }

        let stats = {};
        let statConfig = [];

        // Get role-specific stats
        switch (userRole) {
            case ROLES.SUPERADMIN:
                stats = await DashboardRoleService.getSuperadminStats(currentUser);
                statConfig = [
                    { id: 'stat-total-landings', value: stats.totalSystemLandings, label: 'Total System Landings', icon: 'bi-water', color: 'primary' },
                    { id: 'stat-verified-records', value: stats.totalActiveUsers, label: 'Total Active Users', icon: 'bi-people', color: 'success' },
                    { id: 'stat-pending-review', value: stats.systemDataQuality?.percentage || 0, label: 'System Data Quality', icon: 'bi-shield-check', color: 'warning', suffix: '%' },
                    { id: 'stat-active-encoders', value: stats.totalRegionsActive, label: 'Active Regions', icon: 'bi-globe', color: 'info' }
                ];
                break;

            case ROLES.ADMIN:
                stats = await DashboardRoleService.getAdminStats(currentUser);
                statConfig = [
                    { id: 'stat-total-landings', value: stats.regionalLandings, label: 'Regional Landings', icon: 'bi-water', color: 'primary' },
                    { id: 'stat-verified-records', value: stats.pendingReviews, label: 'Pending Reviews', icon: 'bi-clipboard-check', color: 'warning' },
                    { id: 'stat-pending-review', value: stats.activeEncoders, label: 'Active Encoders', icon: 'bi-people', color: 'success' },
                    { id: 'stat-active-encoders', value: stats.dataQualityScore?.percentage || 0, label: 'Data Quality Score', icon: 'bi-graph-up', color: 'info', suffix: '%' }
                ];
                break;

            case ROLES.ENCODER:
                stats = await DashboardRoleService.getEncoderStats(currentUser);
                statConfig = [
                    { id: 'stat-total-landings', value: stats.myRecordsCreated, label: 'My Records Created', icon: 'bi-plus-circle', color: 'primary' },
                    { id: 'stat-verified-records', value: stats.pendingEntries?.total || 0, label: 'Pending Entries', icon: 'bi-clock-history', color: 'warning' },
                    { id: 'stat-pending-review', value: stats.recordsVerified?.count || 0, label: 'Records Verified', icon: 'bi-check-circle', color: 'success' },
                    { id: 'stat-active-encoders', value: stats.thisMonthActivity, label: 'This Month\'s Activity', icon: 'bi-calendar', color: 'info' }
                ];
                break;

            case ROLES.VIEWER:
                stats = await DashboardRoleService.getViewerStats(currentUser);
                statConfig = [
                    { id: 'stat-total-landings', value: stats.regionalLandings, label: 'Regional Landings', icon: 'bi-water', color: 'primary' },
                    { id: 'stat-verified-records', value: stats.totalSpecies, label: 'Total Species', icon: 'bi-fish', color: 'success' },
                    { id: 'stat-pending-review', value: stats.activeVessels, label: 'Active Vessels', icon: 'bi-ship', color: 'warning' },
                    { id: 'stat-active-encoders', value: stats.samplingDays, label: 'Sampling Days', icon: 'bi-calendar', color: 'info' }
                ];
                break;

            default:
                // Fallback to default stats
                await loadDashboardStats();
                return;
        }

        // Update stat cards with role-specific data
        updateRoleSpecificStatCards(statConfig);

    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadRoleSpecificStats',
                userMessage: 'Failed to load dashboard statistics',
                showToast: false
            });
        }
        // Fallback to default stats on error
        try {
            await loadDashboardStats();
        } catch (fallbackError) {
            showStatCardError();
        }
    }
}

/**
 * Update stat cards with role-specific configuration
 */
function updateRoleSpecificStatCards(statConfig) {
    statConfig.forEach((config, index) => {
        const statCard = document.querySelectorAll('.stat-card')[index];
        if (!statCard) return;

        // Update value
        const valueElement = statCard.querySelector('.stat-value');
        if (valueElement) {
            const suffix = config.suffix || '';
            valueElement.textContent = formatNumber(config.value) + suffix;
        }

        // Update label
        const labelElement = statCard.querySelector('.stat-label');
        if (labelElement) {
            labelElement.textContent = config.label;
        }

        // Update icon
        const iconElement = statCard.querySelector('.stat-icon-wrapper i');
        if (iconElement) {
            iconElement.className = `bi ${config.icon}`;
        }

        // Update card color class
        statCard.className = `stat-card ${config.color}`;
    });
}

/**
 * Load dashboard statistics and update stat cards (fallback/default)
 */
async function loadDashboardStats() {
    try {
        const stats = await DashboardService.getAllStats(currentUser);

        // Update stat cards
        updateStatCard('stat-total-landings', stats.totalLandings);
        updateStatCard('stat-verified-records', stats.verifiedRecords);
        updateStatCard('stat-pending-review', stats.pendingReviews);
        updateStatCard('stat-active-encoders', stats.activeEncoders);
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadDashboardStats',
                userMessage: 'Failed to load dashboard statistics',
                showToast: false
            });
        }
        // Show error state in stat cards
        showStatCardError();
    }
}

/**
 * Update stat card value
 */
function updateStatCard(statId, value) {
    const statElement = document.querySelector(`[data-stat="${statId}"] .stat-value`);
    if (statElement) {
        statElement.textContent = formatNumber(value);
    }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
}

/**
 * Show error state in stat cards
 */
function showStatCardError() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
        if (el.textContent === '0' || !el.textContent) {
            el.textContent = 'N/A';
            el.style.color = '#ef4444';
        }
    });
}

/**
 * Load catch trend chart with real data (role-specific)
 */
async function loadCatchTrendChart() {
    try {
        let chartData;
        
        // Use role-specific service if available
        if (typeof DashboardRoleService !== 'undefined') {
            chartData = await DashboardRoleService.getRoleCatchTrends(currentUser, 6);
        } else {
            chartData = await DashboardService.getCatchTrends(currentUser);
        }
        const ctx = document.getElementById('catchTrendChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (catchTrendChart) {
            catchTrendChart.destroy();
        }

        // Gradient Fill for Line Chart
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        catchTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Total Catch (Count)',
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
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: { color: '#94a3b8' }
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
                context: 'Dashboard.loadCatchTrendChart',
                userMessage: 'Failed to load catch trends',
                showToast: false
            });
        }
    }
}

/**
 * Load species distribution chart with real data (role-specific)
 */
async function loadSpeciesChart() {
    try {
        let chartData;
        
        // Use role-specific service if available
        if (typeof DashboardRoleService !== 'undefined') {
            chartData = await DashboardRoleService.getRoleSpeciesDistribution(currentUser, 10);
        } else {
            chartData = await DashboardService.getSpeciesDistribution(currentUser);
        }
        const ctx = document.getElementById('speciesChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (speciesChart) {
            speciesChart.destroy();
        }

        speciesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    backgroundColor: [
                        '#3b82f6', // Blue
                        '#10b981', // Emerald
                        '#f59e0b', // Amber
                        '#8b5cf6', // Violet
                        '#cbd5e1'  // Slate
                    ],
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
                            padding: 20,
                            color: '#64748b',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadSpeciesChart',
                userMessage: 'Failed to load species distribution',
                showToast: false
            });
        }
    }
}

/**
 * Load recent activity with real data (role-specific)
 */
async function loadRecentActivity() {
    try {
        let activities;
        
        // Use role-specific service if available
        if (typeof DashboardRoleService !== 'undefined') {
            activities = await DashboardRoleService.getRoleRecentActivity(currentUser, 5);
        } else {
            activities = await DashboardService.getRecentActivity(currentUser, 5);
        }
        const activityList = document.getElementById('recentActivityList');
        if (!activityList) return;

        if (!activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                    <p class="mt-2 mb-0">No recent activity</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = activities.map(act => `
            <div class="activity-item">
                <div class="activity-avatar d-flex align-items-center justify-content-center bg-primary text-white fw-bold">
                    ${act.initial}
                </div>
                <div class="activity-details">
                    <div class="activity-text">
                        <strong>${Validation.escapeHtml(act.user)}</strong> ${Validation.escapeHtml(act.action)}
                    </div>
                    <div class="activity-time">${act.time}</div>
                </div>
                <span class="activity-badge">${Validation.escapeHtml(act.target)}</span>
            </div>
        `).join('');
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadRecentActivity',
                userMessage: 'Failed to load recent activity',
                showToast: false
            });
        }
        
        const activityList = document.getElementById('recentActivityList');
        if (activityList) {
            activityList.innerHTML = `
                <div class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i>
                    <p class="mt-2 mb-0">Failed to load activity</p>
                </div>
            `;
        }
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    // Show loading spinners in stat cards
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
        el.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    });

    // Show loading in charts
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        if (!container.querySelector('.spinner-border')) {
            const spinner = document.createElement('div');
            spinner.className = 'text-center py-5';
            spinner.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';
            container.appendChild(spinner);
        }
    });
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    // Charts will be populated by their respective functions
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const spinner = container.querySelector('.spinner-border');
        if (spinner && spinner.parentElement) {
            spinner.parentElement.remove();
        }
    });
}

/**
 * Load role-specific components (data tables and quick actions)
 */
async function loadRoleSpecificComponents() {
    try {
        // Update chart titles based on role
        updateChartTitles();

        // Load role-specific data tables
        await loadRoleDataTables();
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadRoleSpecificComponents',
                userMessage: 'Failed to load dashboard components',
                showToast: false
            });
        }
    }
}

/**
 * Update chart titles based on role
 */
function updateChartTitles() {
    const catchTrendTitle = document.getElementById('catchTrendTitle');
    const speciesChartTitle = document.getElementById('speciesChartTitle');

    const titles = {
        [ROLES.SUPERADMIN]: {
            catchTrend: 'System-Wide Catch Trends (Last 6 Months)',
            species: 'Species Distribution (System-Wide)'
        },
        [ROLES.ADMIN]: {
            catchTrend: 'Regional Catch Trends (Last 6 Months)',
            species: 'Species Distribution'
        },
        [ROLES.ENCODER]: {
            catchTrend: 'My Catch Trends (Last 6 Months)',
            species: 'My Species Distribution'
        },
        [ROLES.VIEWER]: {
            catchTrend: 'Regional Catch Trends (Last 6 Months)',
            species: 'Species Distribution'
        }
    };

    const roleTitles = titles[userRole] || titles[ROLES.VIEWER];
    if (catchTrendTitle) catchTrendTitle.textContent = roleTitles.catchTrend;
    if (speciesChartTitle) speciesChartTitle.textContent = roleTitles.species;
}

/**
 * Load role-specific data tables
 */
async function loadRoleDataTables() {
    const section = document.getElementById('roleDataTablesSection');
    if (!section) return;

    try {
        if (typeof DashboardRoleService === 'undefined') {
            section.style.display = 'none';
            return;
        }

        let tablesHTML = '';

        switch (userRole) {
            case ROLES.SUPERADMIN:
                tablesHTML = await renderSuperadminTables();
                break;
            case ROLES.ADMIN:
                tablesHTML = await renderAdminTables();
                break;
            case ROLES.ENCODER:
                tablesHTML = await renderEncoderTables();
                break;
            case ROLES.VIEWER:
                tablesHTML = await renderViewerTables();
                break;
            default:
                section.style.display = 'none';
                return;
        }

        if (tablesHTML) {
            section.innerHTML = tablesHTML;
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    } catch (error) {
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Dashboard.loadRoleDataTables',
                showToast: false
            });
        }
        section.style.display = 'none';
    }
}

/**
 * Render Superadmin data tables
 */
async function renderSuperadminTables() {
    try {
        const topRegions = await DashboardRoleService.getTopPerformingRegions(currentUser, 10);

        return `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="content-card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h3 class="card-title mb-0">Top Performing Regions</h3>
                            <a href="analytics.html" class="btn btn-sm btn-outline-primary">View Analytics</a>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Region</th>
                                        <th>Total Catch</th>
                                        <th>Sampling Days</th>
                                        <th>Vessels</th>
                                        <th>Species</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topRegions.length > 0 ? topRegions.map(region => `
                                        <tr>
                                            <td class="fw-medium">${Validation.escapeHtml(region.regionName)}</td>
                                            <td>${formatNumber(region.totalCatch)}</td>
                                            <td>${formatNumber(region.samplingDays)}</td>
                                            <td>${formatNumber(region.vessels)}</td>
                                            <td>${formatNumber(region.species)}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="5" class="text-center text-muted py-4">No data available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        return '<div class="alert alert-warning">Failed to load data tables</div>';
    }
}

/**
 * Render Admin data tables
 */
async function renderAdminTables() {
    try {
        const topEncoders = await DashboardRoleService.getTopEncoders(currentUser, 10);

        return `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="content-card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h3 class="card-title mb-0">Top Encoders (Performance)</h3>
                            <a href="data-entry.html" class="btn btn-sm btn-outline-primary">View All</a>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Encoder Name</th>
                                        <th>Region</th>
                                        <th>Records Created</th>
                                        <th>Records Verified</th>
                                        <th>Quality Score</th>
                                        <th>Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topEncoders.length > 0 ? topEncoders.map(encoder => `
                                        <tr>
                                            <td class="fw-medium">${Validation.escapeHtml(encoder.encoderName)}</td>
                                            <td>${Validation.escapeHtml(encoder.regionName)}</td>
                                            <td>${formatNumber(encoder.recordsCreated)}</td>
                                            <td>${formatNumber(encoder.recordsVerified)}</td>
                                            <td>${formatNumber(encoder.qualityScore)}%</td>
                                            <td>${Validation.escapeHtml(encoder.lastActive)}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No data available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        return '<div class="alert alert-warning">Failed to load data tables</div>';
    }
}

/**
 * Render Encoder data tables
 */
async function renderEncoderTables() {
    try {
        const recentEntries = await DashboardRoleService.getMyRecentEntries(currentUser, 20);

        return `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="content-card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h3 class="card-title mb-0">My Recent Entries</h3>
                            <a href="data-entry.html" class="btn btn-sm btn-outline-primary">View All</a>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Record Type</th>
                                        <th>Landing Center</th>
                                        <th>Fishing Ground</th>
                                        <th>Catch Volume</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentEntries.length > 0 ? recentEntries.map(entry => `
                                        <tr>
                                            <td>${entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                                            <td>${Validation.escapeHtml(entry.recordType)}</td>
                                            <td>${Validation.escapeHtml(entry.landingCenter)}</td>
                                            <td>${Validation.escapeHtml(entry.fishingGround)}</td>
                                            <td>${formatNumber(entry.catchVolume)}</td>
                                            <td><span class="badge bg-success">${Validation.escapeHtml(entry.status)}</span></td>
                                            <td>
                                                <a href="sample-day-detail.html?id=${entry.id}" class="btn btn-sm btn-outline-primary">
                                                    <i class="bi bi-eye"></i> View
                                                </a>
                                            </td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No entries found</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        return '<div class="alert alert-warning">Failed to load data tables</div>';
    }
}

/**
 * Render Viewer data tables
 */
async function renderViewerTables() {
    try {
        const [topSpecies, topLandingCenters] = await Promise.all([
            DashboardRoleService.getTopSpecies(currentUser, 15),
            DashboardRoleService.getTopLandingCenters(currentUser, 10)
        ]);

        return `
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title mb-0">Top Species</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Species</th>
                                        <th>Catch Volume</th>
                                        <th>Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topSpecies.length > 0 ? topSpecies.map(species => `
                                        <tr>
                                            <td class="fw-medium">${Validation.escapeHtml(species.speciesName)}</td>
                                            <td>${formatNumber(species.catchVolume)}</td>
                                            <td>${formatNumber(species.percentage)}%</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="3" class="text-center text-muted py-4">No data available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title mb-0">Top Landing Centers</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Landing Center</th>
                                        <th>Activity Count</th>
                                        <th>Last Activity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topLandingCenters.length > 0 ? topLandingCenters.map(lc => `
                                        <tr>
                                            <td class="fw-medium">${Validation.escapeHtml(lc.landingCenterName)}</td>
                                            <td>${formatNumber(lc.activityCount)}</td>
                                            <td>${lc.lastActivity ? new Date(lc.lastActivity).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="3" class="text-center text-muted py-4">No data available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        return '<div class="alert alert-warning">Failed to load data tables</div>';
    }
}

