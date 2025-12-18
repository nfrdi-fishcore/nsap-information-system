/**
 * Regional Report Module - NSAP Information System
 * 
 * Handles regional report generation, display, and export
 */

let currentUser = null;
let reportData = null;
let regionalComparisonChart = null;
let regionalDistributionChart = null;
let regions = [];

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

    // Hide multi-region selection for non-admins
    if (!ADMIN_ROLES.includes(currentUser.role)) {
        const regionFilterGroup = document.getElementById('regionFilterGroup');
        if (regionFilterGroup) {
            regionFilterGroup.style.display = 'none';
        }
    }

    // Initialize
    await loadRegions();
    setupEventListeners();
    setDefaultDates();
    
    // Show instruction modal on page load
    showInstructionModal();
});

// ----------------------------------------------------------------------------
// Reference Data Loading
// ----------------------------------------------------------------------------

async function loadRegions() {
    try {
        let query = window._supabase
            .from(TABLES.REGION)
            .select('region_id, region_name, sort_order')
            .order('sort_order', { ascending: true });

        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        regions = data || [];
        populateRegionDropdown();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsRegional.loadRegions',
            userMessage: 'Failed to load regions'
        });
    }
}

function populateRegionDropdown() {
    const checkboxList = document.getElementById('regionCheckboxList');
    if (!checkboxList) return;

    checkboxList.innerHTML = '';
    regions.forEach(region => {
        const item = document.createElement('div');
        item.className = 'custom-dropdown-item';
        item.innerHTML = `
            <input type="checkbox" class="form-check-input" id="region_${region.region_id}" 
                   value="${region.region_id}" onchange="updateRegionSelection()">
            <label for="region_${region.region_id}" class="form-check-label">
                ${Validation.escapeHtml(region.region_name)}
            </label>
        `;
        checkboxList.appendChild(item);
    });

    // Auto-select user's region for non-admins
    if (!ADMIN_ROLES.includes(currentUser.role) && currentUser.region_id) {
        const checkbox = document.getElementById(`region_${currentUser.region_id}`);
        if (checkbox) {
            checkbox.checked = true;
            updateRegionSelection();
        }
    } else {
        // For admins, select all by default
        selectAllRegions();
    }
}

function updateRegionSelection() {
    const checkboxes = document.querySelectorAll('#regionCheckboxList input[type="checkbox"]');
    const selectedRegions = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => {
            const region = regions.find(r => r.region_id === parseInt(cb.value));
            return region ? region.region_name : '';
        });

    const dropdownText = document.getElementById('regionDropdownText');
    const dropdownToggle = document.getElementById('regionDropdownToggle');
    
    if (dropdownText) {
        if (selectedRegions.length === 0) {
            dropdownText.textContent = 'Select regions...';
            dropdownText.classList.add('text-muted');
        } else if (selectedRegions.length === 1) {
            dropdownText.textContent = selectedRegions[0];
            dropdownText.classList.remove('text-muted');
        } else if (selectedRegions.length === regions.length) {
            dropdownText.textContent = 'All regions selected';
            dropdownText.classList.remove('text-muted');
        } else {
            dropdownText.textContent = `${selectedRegions.length} region${selectedRegions.length > 1 ? 's' : ''} selected`;
            dropdownText.classList.remove('text-muted');
        }
    }
}

function selectAllRegions() {
    const checkboxes = document.querySelectorAll('#regionCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    updateRegionSelection();
}

function deselectAllRegions() {
    const checkboxes = document.querySelectorAll('#regionCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    updateRegionSelection();
}

function getSelectedRegions() {
    const checkboxes = document.querySelectorAll('#regionCheckboxList input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
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
    const selectedRegions = getSelectedRegions();

    // Validate parameters
    const params = {
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate: toDate ? new Date(toDate) : null,
        regionIds: selectedRegions.length > 0 ? selectedRegions : null
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
        reportData = await ReportsService.getRegionalReportData(
            currentUser,
            params.fromDate,
            params.toDate,
            params.regionIds
        );

        // Render report
        renderReport(reportData);

        // Show report content
        document.getElementById('reportContent').classList.remove('d-none');
        window.toast.success('Report generated successfully!', 'Report Ready');

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsRegional.generateReport',
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

    // Render regional details
    renderRegionalDetails(data.regionalData);
}

function renderSummary(summary) {
    document.getElementById('summaryTotalCatch').textContent = 
        (summary.totalCatch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    document.getElementById('summarySamplingDays').textContent = 
        (summary.totalSamplingDays || 0).toLocaleString();
    document.getElementById('summaryVessels').textContent = 
        (summary.totalVessels || 0).toLocaleString();
    document.getElementById('summaryRegions').textContent = 
        (summary.regionCount || 0).toLocaleString();
}

function renderCharts(data) {
    // Regional Comparison Chart
    renderRegionalComparisonChart(data.regionalData);

    // Regional Distribution Chart
    renderRegionalDistributionChart(data.regionalData);
}

function renderRegionalComparisonChart(regionalData) {
    const ctx = document.getElementById('regionalComparisonChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (regionalComparisonChart) {
        regionalComparisonChart.destroy();
    }

    const labels = regionalData.map(r => r.regionName);
    const catchData = regionalData.map(r => r.summary.totalCatch || 0);
    const samplingDaysData = regionalData.map(r => r.summary.totalSamplingDays || 0);

    regionalComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Catch Volume (kg)',
                    data: catchData,
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1
                },
                {
                    label: 'Sampling Days',
                    data: samplingDaysData,
                    backgroundColor: '#10b981',
                    borderColor: '#047857',
                    borderWidth: 1
                }
            ]
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
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderRegionalDistributionChart(regionalData) {
    const ctx = document.getElementById('regionalDistributionChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (regionalDistributionChart) {
        regionalDistributionChart.destroy();
    }

    const labels = regionalData.map(r => r.regionName);
    const catchData = regionalData.map(r => r.summary.totalCatch || 0);

    regionalDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Catch Volume (kg)',
                data: catchData,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString()} kg (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderTables(data) {
    // Regional Rankings Table
    renderRegionalRankingsTable(data.regionalData);
}

function renderRegionalRankingsTable(regionalData) {
    const tbody = document.getElementById('regionalRankingsTableBody');
    if (!tbody) return;

    if (!regionalData || regionalData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    // Sort by catch volume
    const sorted = [...regionalData].sort((a, b) => 
        (b.summary.totalCatch || 0) - (a.summary.totalCatch || 0)
    );

    tbody.innerHTML = sorted.map((region, index) => `
        <tr>
            <td class="fw-medium">${index + 1}</td>
            <td>${Validation.escapeHtml(region.regionName)}</td>
            <td class="text-end">${(region.summary.totalCatch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td class="text-end">${(region.summary.totalSamplingDays || 0).toLocaleString()}</td>
            <td class="text-end">${(region.summary.totalVessels || 0).toLocaleString()}</td>
            <td class="text-end">${(region.summary.totalSpecies || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderRegionalDetails(regionalData) {
    const container = document.getElementById('regionalDetailsContainer');
    if (!container) return;

    if (!regionalData || regionalData.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = regionalData.map(region => `
        <div class="region-comparison-card">
            <h6>${Validation.escapeHtml(region.regionName)}</h6>
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="small text-muted">Total Catch</div>
                    <div class="fw-bold">${(region.summary.totalCatch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg</div>
                </div>
                <div class="col-md-3">
                    <div class="small text-muted">Sampling Days</div>
                    <div class="fw-bold">${(region.summary.totalSamplingDays || 0).toLocaleString()}</div>
                </div>
                <div class="col-md-3">
                    <div class="small text-muted">Vessels</div>
                    <div class="fw-bold">${(region.summary.totalVessels || 0).toLocaleString()}</div>
                </div>
                <div class="col-md-3">
                    <div class="small text-muted">Species</div>
                    <div class="fw-bold">${(region.summary.totalSpecies || 0).toLocaleString()}</div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="small text-muted mb-2">Top Species</div>
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead>
                                <tr>
                                    <th>Species</th>
                                    <th class="text-end">Catch (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${region.topSpecies.map(s => `
                                    <tr>
                                        <td>${Validation.escapeHtml(s.speciesName)}</td>
                                        <td class="text-end">${(s.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="small text-muted mb-2">Top Landing Centers</div>
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead>
                                <tr>
                                    <th>Landing Center</th>
                                    <th class="text-end">Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${region.topLandingCenters.map(lc => `
                                    <tr>
                                        <td>${Validation.escapeHtml(lc.landingCenterName)}</td>
                                        <td class="text-end">${(lc.activity || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="small text-muted mb-2">Top Fishing Grounds</div>
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead>
                                <tr>
                                    <th>Fishing Ground</th>
                                    <th class="text-end">Catch (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${region.topFishingGrounds.map(fg => `
                                    <tr>
                                        <td>${Validation.escapeHtml(fg.fishingGroundName)}</td>
                                        <td class="text-end">${(fg.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
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
    const exportData = reportData.regionalData.map(region => ({
        'Region': region.regionName,
        'Catch (kg)': region.summary.totalCatch || 0,
        'Sampling Days': region.summary.totalSamplingDays || 0,
        'Vessels': region.summary.totalVessels || 0,
        'Species': region.summary.totalSpecies || 0
    }));

    const headers = ['Region', 'Catch (kg)', 'Sampling Days', 'Vessels', 'Species'];
    ReportExport.exportToCSV(exportData, headers, 'regional_report');
}

function exportToExcel() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const exportData = reportData.regionalData.map(region => ({
        'Region': region.regionName,
        'Catch (kg)': region.summary.totalCatch || 0,
        'Sampling Days': region.summary.totalSamplingDays || 0,
        'Vessels': region.summary.totalVessels || 0,
        'Species': region.summary.totalSpecies || 0
    }));

    const headers = ['Region', 'Catch (kg)', 'Sampling Days', 'Vessels', 'Species'];
    ReportExport.exportToExcel(exportData, headers, 'regional_report', 'Regional Report');
}

function exportToPDF() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const title = `Regional Report (${fromDate} to ${toDate})`;
    
    ReportExport.exportToPDF(reportData, title, 'regional_report');
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

    // Region Dropdown Toggle
    const dropdownToggle = document.getElementById('regionDropdownToggle');
    const dropdownMenu = document.getElementById('regionDropdownMenu');
    
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = dropdownMenu.classList.toggle('show');
            dropdownToggle.setAttribute('aria-expanded', isExpanded);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Prevent dropdown from closing when clicking inside
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Select All / Deselect All buttons
    document.getElementById('selectAllRegionsBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectAllRegions();
    });

    document.getElementById('deselectAllRegionsBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        deselectAllRegions();
    });
}

// Make functions available globally for inline event handlers
window.updateRegionSelection = updateRegionSelection;

