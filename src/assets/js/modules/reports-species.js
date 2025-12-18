/**
 * Species Report Module - NSAP Information System
 * 
 * Handles species report generation, display, and export
 */

let currentUser = null;
let reportData = null;
let speciesCatchChart = null;
let speciesTrendsChart = null;
let regions = [];
let gears = [];
let species = [];

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

        // Load gears
        const { data: gearsData, error: gearsError } = await window._supabase
            .from(TABLES.GEAR)
            .select('gr_id, gear_desc')
            .order('gear_desc', { ascending: true });

        if (gearsError) throw gearsError;
        gears = gearsData || [];
        populateGearDropdown();

        // Load species
        const { data: speciesData, error: speciesError } = await window._supabase
            .from(TABLES.SPECIES)
            .select('species_id, sp_name, sp_family, sp_sci')
            .order('sp_name', { ascending: true });

        if (speciesError) throw speciesError;
        species = speciesData || [];
        populateSpeciesDropdown();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsSpecies.loadReferenceData',
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

function populateGearDropdown() {
    const select = document.getElementById('filterGear');
    if (!select) return;

    select.innerHTML = '<option value="">All Gear Types</option>';
    gears.forEach(gear => {
        const option = document.createElement('option');
        option.value = gear.gr_id;
        option.textContent = Validation.escapeHtml(gear.gear_desc);
        select.appendChild(option);
    });
}

function populateSpeciesDropdown() {
    const checkboxList = document.getElementById('speciesCheckboxList');
    if (!checkboxList) return;

    checkboxList.innerHTML = '';
    species.forEach(spec => {
        const item = document.createElement('div');
        item.className = 'custom-dropdown-item';
        const displayName = `${Validation.escapeHtml(spec.sp_name)}${spec.sp_family ? ' (' + Validation.escapeHtml(spec.sp_family) + ')' : ''}`;
        item.innerHTML = `
            <input type="checkbox" class="form-check-input" id="species_${spec.species_id}" 
                   value="${spec.species_id}" onchange="updateSpeciesSelection()">
            <label for="species_${spec.species_id}" class="form-check-label">
                ${displayName}
            </label>
        `;
        checkboxList.appendChild(item);
    });
}

function updateSpeciesSelection() {
    const checkboxes = document.querySelectorAll('#speciesCheckboxList input[type="checkbox"]');
    const selectedSpecies = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => {
            const spec = species.find(s => s.species_id === parseInt(cb.value));
            return spec ? spec.sp_name : '';
        });

    const dropdownText = document.getElementById('speciesDropdownText');
    
    if (dropdownText) {
        if (selectedSpecies.length === 0) {
            dropdownText.textContent = 'Select species...';
            dropdownText.classList.add('text-muted');
        } else if (selectedSpecies.length === 1) {
            dropdownText.textContent = selectedSpecies[0];
            dropdownText.classList.remove('text-muted');
        } else if (selectedSpecies.length === species.length) {
            dropdownText.textContent = 'All species selected';
            dropdownText.classList.remove('text-muted');
        } else {
            dropdownText.textContent = `${selectedSpecies.length} species selected`;
            dropdownText.classList.remove('text-muted');
        }
    }
}

function selectAllSpecies() {
    const checkboxes = document.querySelectorAll('#speciesCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    updateSpeciesSelection();
}

function deselectAllSpecies() {
    const checkboxes = document.querySelectorAll('#speciesCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    updateSpeciesSelection();
}

function getSelectedSpecies() {
    const checkboxes = document.querySelectorAll('#speciesCheckboxList input[type="checkbox"]:checked');
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
    const regionId = document.getElementById('filterRegion').value;
    const gearId = document.getElementById('filterGear').value;
    const selectedSpecies = getSelectedSpecies();

    // Validate parameters
    const params = {
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate: toDate ? new Date(toDate) : null,
        speciesIds: selectedSpecies.length > 0 ? selectedSpecies : null,
        regionId: regionId ? parseInt(regionId) : null,
        gearId: gearId ? parseInt(gearId) : null
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
        reportData = await ReportsService.getSpeciesReportData(
            currentUser,
            params.fromDate,
            params.toDate,
            params.speciesIds,
            params.regionId,
            params.gearId
        );

        // Render report
        renderReport(reportData);

        // Show report content
        document.getElementById('reportContent').classList.remove('d-none');
        window.toast.success('Report generated successfully!', 'Report Ready');

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsSpecies.generateReport',
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
    document.getElementById('summarySpecies').textContent = 
        (summary.totalSpecies || 0).toLocaleString();
    document.getElementById('summaryVessels').textContent = 
        (summary.totalVessels || 0).toLocaleString();
}

function renderCharts(data) {
    // Species Catch Chart
    renderSpeciesCatchChart(data.speciesData);

    // Species Trends Chart
    renderSpeciesTrendsChart(data.monthlyTrends);
}

function renderSpeciesCatchChart(speciesData) {
    const ctx = document.getElementById('speciesCatchChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (speciesCatchChart) {
        speciesCatchChart.destroy();
    }

    // Show top 10
    const topSpecies = speciesData.slice(0, 10);
    const labels = topSpecies.map(s => s.speciesName);
    const catchData = topSpecies.map(s => s.catch || 0);

    speciesCatchChart = new Chart(ctx, {
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

function renderSpeciesTrendsChart(monthlyTrends) {
    const ctx = document.getElementById('speciesTrendsChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (speciesTrendsChart) {
        speciesTrendsChart.destroy();
    }

    if (!monthlyTrends || monthlyTrends.length === 0) {
        return;
    }

    // Get top 5 species across all months
    const allSpeciesMap = {};
    monthlyTrends.forEach(month => {
        month.speciesData.forEach(s => {
            if (!allSpeciesMap[s.speciesId]) {
                allSpeciesMap[s.speciesId] = {
                    speciesId: s.speciesId,
                    speciesName: s.speciesName,
                    data: []
                };
            }
        });
    });

    // Fill in data for each month
    monthlyTrends.forEach(month => {
        const monthLabel = `${month.month} ${month.year}`;
        Object.keys(allSpeciesMap).forEach(speciesId => {
            const speciesData = month.speciesData.find(s => s.speciesId === speciesId);
            allSpeciesMap[speciesId].data.push({
                month: monthLabel,
                catch: speciesData ? speciesData.catch : 0
            });
        });
    });

    // Get top 5 species by total catch
    const topSpecies = Object.values(allSpeciesMap)
        .map(s => ({
            ...s,
            totalCatch: s.data.reduce((sum, d) => sum + d.catch, 0)
        }))
        .sort((a, b) => b.totalCatch - a.totalCatch)
        .slice(0, 5);

    const labels = monthlyTrends.map(m => `${m.month} ${m.year}`);
    const datasets = topSpecies.map((species, index) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        return {
            label: species.speciesName,
            data: monthlyTrends.map(month => {
                const speciesData = month.speciesData.find(s => s.speciesId === species.speciesId);
                return speciesData ? speciesData.catch : 0;
            }),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '40',
            tension: 0.4,
            fill: false
        };
    });

    speciesTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
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
    // Species Data Table
    renderSpeciesDataTable(data.speciesData);

    // Regional Distribution Table
    renderRegionalDistributionTable(data.regionalDistribution);

    // Gear Distribution Table
    renderGearDistributionTable(data.gearDistribution);
}

function renderSpeciesDataTable(speciesData) {
    const tbody = document.getElementById('speciesDataTableBody');
    if (!tbody) return;

    if (!speciesData || speciesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = speciesData.map((species, index) => `
        <tr>
            <td class="fw-medium">${index + 1}</td>
            <td>${Validation.escapeHtml(species.speciesName)}</td>
            <td>${Validation.escapeHtml(species.family)}</td>
            <td>${Validation.escapeHtml(species.scientificName)}</td>
            <td class="text-end">${(species.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td class="text-end">${(species.vesselCount || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderRegionalDistributionTable(regionalDistribution) {
    const tbody = document.getElementById('regionalDistributionTableBody');
    if (!tbody) return;

    if (!regionalDistribution || regionalDistribution.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    const rows = [];
    regionalDistribution.forEach(region => {
        region.speciesData.forEach(species => {
            rows.push({
                region: region.regionName,
                species: species.speciesName,
                catch: species.catch
            });
        });
    });

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${Validation.escapeHtml(row.region)}</td>
            <td>${Validation.escapeHtml(row.species)}</td>
            <td class="text-end">${(row.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

function renderGearDistributionTable(gearDistribution) {
    const tbody = document.getElementById('gearDistributionTableBody');
    if (!tbody) return;

    if (!gearDistribution || gearDistribution.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    const rows = [];
    gearDistribution.forEach(gear => {
        gear.speciesData.forEach(species => {
            rows.push({
                gear: gear.gearName,
                species: species.speciesName,
                catch: species.catch
            });
        });
    });

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${Validation.escapeHtml(row.gear)}</td>
            <td>${Validation.escapeHtml(row.species)}</td>
            <td class="text-end">${(row.catch || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
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
    const exportData = reportData.speciesData.map(species => ({
        'Species Name': species.speciesName,
        'Family': species.family,
        'Scientific Name': species.scientificName,
        'Catch (kg)': species.catch || 0,
        'Vessels': species.vesselCount || 0
    }));

    const headers = ['Species Name', 'Family', 'Scientific Name', 'Catch (kg)', 'Vessels'];
    ReportExport.exportToCSV(exportData, headers, 'species_report');
}

function exportToExcel() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const exportData = reportData.speciesData.map(species => ({
        'Species Name': species.speciesName,
        'Family': species.family,
        'Scientific Name': species.scientificName,
        'Catch (kg)': species.catch || 0,
        'Vessels': species.vesselCount || 0
    }));

    const headers = ['Species Name', 'Family', 'Scientific Name', 'Catch (kg)', 'Vessels'];
    ReportExport.exportToExcel(exportData, headers, 'species_report', 'Species Report');
}

function exportToPDF() {
    if (!reportData) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const title = `Species Report (${fromDate} to ${toDate})`;
    
    ReportExport.exportToPDF(reportData, title, 'species_report');
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

    // Species Dropdown Toggle
    const dropdownToggle = document.getElementById('speciesDropdownToggle');
    const dropdownMenu = document.getElementById('speciesDropdownMenu');
    
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
    document.getElementById('selectAllSpeciesBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectAllSpecies();
    });

    document.getElementById('deselectAllSpeciesBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        deselectAllSpecies();
    });
}

// Make functions available globally for inline event handlers
window.updateSpeciesSelection = updateSpeciesSelection;

