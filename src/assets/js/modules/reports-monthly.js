/**
 * Monthly Report Module - NSAP Information System
 * 
 * Handles monthly report generation, display, and export
 */

let currentUser = null;
let reportData = null;
let monthlyTrendsChart = null;
let topSpeciesChart = null;
let regions = [];
let landingCenters = [];
let fishingGrounds = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const session = await getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Load User Profile
    currentUser = await getUserProfile();
    if (!currentUser) {
        window.toast.error('Failed to load user permissions.');
        return;
    }

    // Hide region filter for encoders (they can only see their own region)
    if (currentUser.role === ROLES.ENCODER || currentUser.role === ROLES.VIEWER) {
        const regionFilterGroup = document.getElementById('regionFilterGroup');
        if (regionFilterGroup) {
            regionFilterGroup.style.display = 'none';
        }
    }

    // Initialize
    await loadReferenceData();
    setupEventListeners();
    setDefaultDates();
    
    // Show instruction modal on page load
    showInstructionModal();
});

// ----------------------------------------------------------------------------
// Reference Data Loading
// ----------------------------------------------------------------------------

async function loadReferenceData() {
    try {
        // Load regions
        let regionQuery = window._supabase
            .from(TABLES.REGION)
            .select('*')
            .order('sort_order', { ascending: true });

        if (!ADMIN_ROLES.includes(currentUser.role)) {
            regionQuery = regionQuery.eq('region_id', currentUser.region_id);
        }

        const { data: regionsData, error: regionError } = await regionQuery;
        if (regionError) throw regionError;

        regions = regionsData || [];
        populateRegionDropdown();

        // Load landing centers
        await loadLandingCenters();

        // Load fishing grounds
        await loadFishingGrounds();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsMonthly.loadReferenceData',
            userMessage: 'Failed to load reference data'
        });
    }
}

function populateRegionDropdown() {
    const select = document.getElementById('filterRegion');
    if (!select) return;

    select.innerHTML = '<option value="">All Regions</option>';
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region.region_id;
        option.textContent = region.region_name;
        select.appendChild(option);
    });
}

async function loadLandingCenters() {
    try {
        let query = window._supabase
            .from(TABLES.LANDING_CENTER)
            .select('land_ctr_id, landing_center')
            .order('landing_center', { ascending: true });

        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        landingCenters = data || [];
        populateLandingCenterDropdown();
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsMonthly.loadLandingCenters',
            userMessage: 'Failed to load landing centers'
        });
    }
}

function populateLandingCenterDropdown() {
    const select = document.getElementById('filterLandingCenter');
    if (!select) return;

    select.innerHTML = '<option value="">All Landing Centers</option>';
    landingCenters.forEach(lc => {
        const option = document.createElement('option');
        option.value = lc.land_ctr_id;
        option.textContent = Validation.escapeHtml(lc.landing_center);
        select.appendChild(option);
    });
}

async function loadFishingGrounds() {
    try {
        let query = window._supabase
            .from(TABLES.FISHING_GROUND)
            .select('ground_id, ground_desc')
            .order('ground_desc', { ascending: true });

        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        fishingGrounds = data || [];
        populateFishingGroundDropdown();
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsMonthly.loadFishingGrounds',
            userMessage: 'Failed to load fishing grounds'
        });
    }
}

function populateFishingGroundDropdown() {
    const select = document.getElementById('filterFishingGround');
    if (!select) return;

    select.innerHTML = '<option value="">All Fishing Grounds</option>';
    fishingGrounds.forEach(fg => {
        const option = document.createElement('option');
        option.value = fg.ground_id;
        option.textContent = Validation.escapeHtml(fg.ground_desc);
        select.appendChild(option);
    });
}

// ----------------------------------------------------------------------------
// Date Handling
// ----------------------------------------------------------------------------

function setDefaultDates() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    document.getElementById('fromDate').value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById('toDate').value = lastDayOfMonth.toISOString().split('T')[0];
}

// ----------------------------------------------------------------------------
// Report Generation
// ----------------------------------------------------------------------------

async function generateReport() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const regionId = document.getElementById('filterRegion').value;
    const landingCenterId = document.getElementById('filterLandingCenter').value;
    const fishingGroundId = document.getElementById('filterFishingGround').value;

    // Validate parameters
    const params = {
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate: toDate ? new Date(toDate) : null,
        regionId: regionId ? parseInt(regionId) : null,
        landingCenterId: landingCenterId || null,
        fishingGroundId: fishingGroundId || null
    };

    const validation = ReportsService.validateReportParams(params);
    if (!validation.isValid) {
        window.toast.error(validation.error, 'Validation Error');
        return;
    }

    // Show loading
    document.getElementById('loadingOverlay').classList.remove('d-none');
    document.getElementById('reportContent').classList.add('d-none');

    try {
        // Fetch report data
        reportData = await ReportsService.getMonthlyReportData(
            currentUser,
            params.fromDate,
            params.toDate,
            params.regionId,
            params.landingCenterId,
            params.fishingGroundId
        );

        // Render report
        renderReport(reportData);

        // Show report content
        document.getElementById('reportContent').classList.remove('d-none');
        window.toast.success('Report generated successfully!', 'Report Ready');

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsMonthly.generateReport',
            userMessage: 'Failed to generate report'
        });
    } finally {
        document.getElementById('loadingOverlay').classList.add('d-none');
    }
}

function renderReport(data) {
    // Render summary cards
    renderSummary(data.summary);

    // Render charts
    renderCharts(data);

    // Render tables
    renderTables(data);
}

function renderSummary(summary) {
    document.getElementById('summaryTotalCatch').textContent = 
        (summary.totalCatch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    document.getElementById('summarySamplingDays').textContent = 
        (summary.totalSamplingDays || 0).toLocaleString();
    document.getElementById('summaryVessels').textContent = 
        (summary.totalVessels || 0).toLocaleString();
    document.getElementById('summarySpecies').textContent = 
        (summary.totalSpecies || 0).toLocaleString();
}

function renderCharts(data) {
    // Monthly Trends Chart
    renderMonthlyTrendsChart(data.monthlyData);

    // Top Species Chart
    renderTopSpeciesChart(data.topSpecies);
}

function renderMonthlyTrendsChart(monthlyData) {
    const ctx = document.getElementById('monthlyTrendsChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (monthlyTrendsChart) {
        monthlyTrendsChart.destroy();
    }

    const labels = monthlyData.map(m => `${m.month} ${m.year}`);
    const catchData = monthlyData.map(m => m.catch || 0);

    monthlyTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Catch Volume (kg)',
                data: catchData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kg';
                        }
                    }
                }
            }
        }
    });
}

function renderTopSpeciesChart(topSpecies) {
    const ctx = document.getElementById('topSpeciesChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (topSpeciesChart) {
        topSpeciesChart.destroy();
    }

    const labels = topSpecies.map(s => s.speciesName);
    const catchData = topSpecies.map(s => s.catch || 0);

    topSpeciesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Catch Volume (kg)',
                data: catchData,
                backgroundColor: '#10b981',
                borderColor: '#047857',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kg';
                        }
                    }
                }
            }
        }
    });
}

function renderTables(data) {
    // Monthly Data Table
    renderMonthlyDataTable(data.monthlyData);

    // Top Species Table
    renderTopSpeciesTable(data.topSpecies);

    // Top Landing Centers Table
    renderTopLandingCentersTable(data.topLandingCenters);

    // Top Fishing Grounds Table
    renderTopFishingGroundsTable(data.topFishingGrounds);
}

function renderMonthlyDataTable(monthlyData) {
    const tbody = document.getElementById('monthlyDataTableBody');
    if (!tbody) return;

    if (!monthlyData || monthlyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = monthlyData.map(month => `
        <tr>
            <td class="fw-medium">${Validation.escapeHtml(month.month)} ${month.year}</td>
            <td class="text-end">${(month.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td class="text-end">${(month.samplingDays || 0).toLocaleString()}</td>
            <td class="text-end">${(month.vessels || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderTopSpeciesTable(topSpecies) {
    const tbody = document.getElementById('topSpeciesTableBody');
    if (!tbody) return;

    if (!topSpecies || topSpecies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = topSpecies.map((species, index) => `
        <tr>
            <td class="fw-medium">${index + 1}</td>
            <td>${Validation.escapeHtml(species.speciesName)}</td>
            <td class="text-end">${(species.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

function renderTopLandingCentersTable(topLandingCenters) {
    const tbody = document.getElementById('topLandingCentersTableBody');
    if (!tbody) return;

    if (!topLandingCenters || topLandingCenters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = topLandingCenters.map((lc, index) => `
        <tr>
            <td class="fw-medium">${index + 1}</td>
            <td>${Validation.escapeHtml(lc.landingCenterName)}</td>
            <td class="text-end">${(lc.activity || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderTopFishingGroundsTable(topFishingGrounds) {
    const tbody = document.getElementById('topFishingGroundsTableBody');
    if (!tbody) return;

    if (!topFishingGrounds || topFishingGrounds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = topFishingGrounds.map((fg, index) => `
        <tr>
            <td class="fw-medium">${index + 1}</td>
            <td>${Validation.escapeHtml(fg.fishingGroundName)}</td>
            <td class="text-end">${(fg.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

// ----------------------------------------------------------------------------
// Export Functions
// ----------------------------------------------------------------------------

function exportToCSV() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    // Prepare data for export
    const exportData = [];
    
    // Add monthly data
    reportData.monthlyData.forEach(month => {
        exportData.push({
            'Month': `${month.month} ${month.year}`,
            'Catch (kg)': month.catch || 0,
            'Sampling Days': month.samplingDays || 0,
            'Vessels': month.vessels || 0
        });
    });

    const headers = ['Month', 'Catch (kg)', 'Sampling Days', 'Vessels'];
    ReportExport.exportToCSV(exportData, headers, 'monthly_report');
}

function exportToExcel() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    // Prepare data for export
    const exportData = [];
    
    // Add monthly data
    reportData.monthlyData.forEach(month => {
        exportData.push({
            'Month': `${month.month} ${month.year}`,
            'Catch (kg)': month.catch || 0,
            'Sampling Days': month.samplingDays || 0,
            'Vessels': month.vessels || 0
        });
    });

    const headers = ['Month', 'Catch (kg)', 'Sampling Days', 'Vessels'];
    ReportExport.exportToExcel(exportData, headers, 'monthly_report', 'Monthly Report');
}

function exportToPDF() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const title = `Monthly Report (${fromDate} to ${toDate})`;
    
    ReportExport.exportToPDF(reportData, title, 'monthly_report');
}

// ----------------------------------------------------------------------------
// Instruction Modal
// ----------------------------------------------------------------------------

function showInstructionModal() {
    // Show modal after a short delay to ensure Bootstrap is loaded
    setTimeout(() => {
        const modalElement = document.getElementById('instructionModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }, 300);
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Generate Report Button
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);

    // Export Buttons
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPDFBtn').addEventListener('click', exportToPDF);

    // Region filter change - update landing centers and fishing grounds
    document.getElementById('filterRegion').addEventListener('change', async () => {
        await loadLandingCenters();
        await loadFishingGrounds();
    });
}

