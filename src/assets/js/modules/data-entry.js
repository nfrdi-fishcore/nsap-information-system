/**
 * NSAP Data Entry Management Logic
 * Handles viewing and managing sampling day records with filtering and pagination
 */

let allSampleDays = [];
let filteredSampleDays = [];
let regions = [];
let landingCenters = [];
let fishingGrounds = [];
let currentUser = null;

// Pagination state
let currentPage = 1;
let rowsPerPage = 25;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const session = await getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = await getUserProfile();
    if (!currentUser) {
        window.toast.error('Failed to load permissions.');
        return;
    }

    // Initialize - Load references first, then main data
    await Promise.all([
        loadRegions(),
        loadLandingCenters(),
        loadFishingGrounds()
    ]);

    // Hide region filter for encoders (they can only see their own region)
    if (currentUser.role === ROLES.ENCODER) {
        const regionFilterGroup = document.getElementById('regionFilterGroup');
        if (regionFilterGroup) {
            regionFilterGroup.style.display = 'none';
        }
    }

    // Hide "New Record" button for viewers (read-only access)
    if (currentUser.role === ROLES.VIEWER) {
        const newRecordBtn = document.getElementById('newRecordBtn');
        if (newRecordBtn) {
            newRecordBtn.style.display = 'none';
        }
    }

    await loadSampleDays();
    setupEventListeners();
    applyFilters();
});

// ----------------------------------------------------------------------------
// Reference Data Loading
// ----------------------------------------------------------------------------

async function loadRegions() {
    try {
        let query = window._supabase.from(TABLES.REGION).select('*').order('sort_order');
        // RBAC: Filter regions - Encoders and viewers can only see their region
        if (currentUser.role === ROLES.ENCODER || currentUser.role === ROLES.VIEWER) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        regions = data;
        populateDropdown('filterRegion', regions, 'region_id', 'region_name', true, true, 'All Regions');
        populateDropdown('modalRegion', regions, 'region_id', 'region_name', false);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'DataEntry.loadRegions',
            userMessage: 'Failed to load regions',
            showToast: false
        });
    }
}

async function loadLandingCenters() {
    try {
        let query = window._supabase.from(TABLES.LANDING_CENTER).select('*').order('landing_center');
        // RBAC: Filter landing centers - Encoders and viewers can only see their region
        if (currentUser.role === ROLES.ENCODER || currentUser.role === ROLES.VIEWER) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        landingCenters = data;
        populateDropdown('filterLandingCenter', landingCenters, 'land_ctr_id', 'landing_center', true, true, 'All Landing Centers');
        // Don't populate modal dropdown initially - it will be populated when region is selected
        populateDropdown('modalLandingCenter', [], 'land_ctr_id', 'landing_center', false);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'DataEntry.loadLandingCenters',
            userMessage: 'Failed to load landing centers',
            showToast: false
        });
    }
}

async function loadFishingGrounds() {
    try {
        let query = window._supabase.from(TABLES.FISHING_GROUND).select('*').order('ground_desc');
        // RBAC: Filter fishing grounds - Encoders and viewers can only see their region
        if (currentUser.role === ROLES.ENCODER || currentUser.role === ROLES.VIEWER) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        fishingGrounds = data;
        populateDropdown('filterFishingGround', fishingGrounds, 'ground_id', 'ground_desc', true, true, 'All Fishing Grounds');
        // Don't populate modal dropdown initially - it will be populated when region is selected
        populateDropdown('modalFishingGround', [], 'ground_id', 'ground_desc', false);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'DataEntry.loadFishingGrounds',
            userMessage: 'Failed to load fishing grounds',
            showToast: false
        });
    }
}

// ----------------------------------------------------------------------------
// Main Data Loading
// ----------------------------------------------------------------------------

async function loadSampleDays() {
    const tableBody = document.getElementById('dataEntryTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        let query = window._supabase
            .from(TABLES.SAMPLE_DAY)
            .select(`
                unload_day_id,
                sdate,
                sampleday,
                remarks,
                region_id,
                land_ctr_id,
                ground_id,
                dbo_region(region_name),
                dbo_landing_center(landing_center),
                dbo_fishing_ground(ground_desc)
            `)
            .order('sdate', { ascending: false });

        // RBAC: Filter sample days - Encoders and viewers can only see their region's data
        if (currentUser.role === ROLES.ENCODER || currentUser.role === ROLES.VIEWER) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        allSampleDays = data || [];
        applyFilters();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'DataEntry.loadSampleDays',
            userMessage: 'Failed to load sample days'
        });
    }
}

// ----------------------------------------------------------------------------
// Filtering
// ----------------------------------------------------------------------------

function applyFilters() {
    const regionFilter = document.getElementById('filterRegion')?.value || '';
    const landingCenterFilter = document.getElementById('filterLandingCenter')?.value || '';
    const fishingGroundFilter = document.getElementById('filterFishingGround')?.value || '';

    filteredSampleDays = allSampleDays.filter(sd => {
        // For encoders, ensure they only see their region's data (additional safety check)
        if (currentUser.role === ROLES.ENCODER && String(sd.region_id) !== String(currentUser.region_id)) {
            return false;
        }
        if (regionFilter && String(sd.region_id) !== String(regionFilter)) return false;
        if (landingCenterFilter && String(sd.land_ctr_id) !== String(landingCenterFilter)) return false;
        if (fishingGroundFilter && String(sd.ground_id) !== String(fishingGroundFilter)) return false;
        return true;
    });

    // Update landing centers based on selected region
    if (regionFilter) {
        updateLandingCentersFilter(regionFilter);
    } else {
        populateDropdown('filterLandingCenter', landingCenters, 'land_ctr_id', 'landing_center', true, true, 'All Landing Centers');
    }

    // Update fishing grounds based on selected region
    if (regionFilter) {
        updateFishingGroundsFilter(regionFilter);
    } else {
        populateDropdown('filterFishingGround', fishingGrounds, 'ground_id', 'ground_desc', true, true, 'All Fishing Grounds');
    }

    currentPage = 1;
    renderTable();
}

function updateLandingCentersFilter(regionId) {
    const regionIdStr = String(regionId);
    const filtered = landingCenters.filter(lc => String(lc.region_id) === regionIdStr);
    populateDropdown('filterLandingCenter', filtered, 'land_ctr_id', 'landing_center', true, true, 'All Landing Centers');
}

function updateFishingGroundsFilter(regionId) {
    const regionIdStr = String(regionId);
    const filtered = fishingGrounds.filter(fg => String(fg.region_id) === regionIdStr);
    populateDropdown('filterFishingGround', filtered, 'ground_id', 'ground_desc', true, true, 'All Fishing Grounds');
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function populateDropdown(elementId, items, valueKey, textKey, includeAllOption = false, preserveValue = true, allOptionText = null) {
    const select = document.getElementById(elementId);
    if (!select) return;

    const currentValue = preserveValue ? select.value : '';
    select.innerHTML = '';

    if (includeAllOption) {
        const allOption = document.createElement('option');
        allOption.value = '';
        // Use custom text if provided, otherwise generate from textKey
        if (allOptionText) {
            allOption.textContent = allOptionText;
        } else {
            // Generate proper text based on elementId or textKey
            if (elementId.includes('Region')) {
                allOption.textContent = 'All Regions';
            } else if (elementId.includes('LandingCenter') || elementId.includes('Landing')) {
                allOption.textContent = 'All Landing Centers';
            } else if (elementId.includes('FishingGround') || elementId.includes('Fishing')) {
                allOption.textContent = 'All Fishing Grounds';
            } else {
                allOption.textContent = `All ${textKey.replace('_', ' ')}`;
            }
        }
        select.appendChild(allOption);
    } else {
        // For modal dropdowns, always add a default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        if (items.length === 0) {
            // If no items, show a message indicating region must be selected first
            defaultOption.textContent = 'Select a region first';
        } else {
            defaultOption.textContent = 'Select...';
        }
        defaultOption.disabled = true;
        defaultOption.selected = !currentValue;
        select.appendChild(defaultOption);
    }

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = Validation.escapeHtml(item[textKey] || '-');
        select.appendChild(option);
    });

    if (preserveValue) {
        if (currentValue) {
            // Check if the value exists in the new options (compare as strings)
            const currentValueStr = String(currentValue);
            const optionExists = Array.from(select.options).some(opt => String(opt.value) === currentValueStr);
            if (optionExists) {
                select.value = currentValue;
            } else {
                // Value doesn't exist, reset to "All..." option
                select.value = '';
            }
        } else {
            // No value selected, ensure "All..." option is selected
            select.value = '';
        }
    }
}

function renderTable() {
    const tableBody = document.getElementById('dataEntryTableBody');
    const totalRows = filteredSampleDays.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No sampling days found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredSampleDays.slice(startIndex, endIndex);

    tableBody.innerHTML = pageData.map(sd => {
        const date = sd.sdate ? new Date(sd.sdate).toLocaleDateString() : '-';
        const lcName = sd.dbo_landing_center ? Validation.escapeHtml(sd.dbo_landing_center.landing_center) : '-';
        const fgName = sd.dbo_fishing_ground ? Validation.escapeHtml(sd.dbo_fishing_ground.ground_desc) : '-';
        
        // Sampling day icon (check or cross)
        // Handle both boolean and string values
        const isSampleDay = sd.sampleday === true || sd.sampleday === 'True' || sd.sampleday === 'true';
        const sampleDayIcon = isSampleDay
            ? '<i class="bi bi-check-circle-fill icon-check"></i>' 
            : '<i class="bi bi-x-circle-fill icon-cross"></i>';

        let actions = `
            <div class="table-actions">
                <a href="sample-day-detail.html?id=${sd.unload_day_id}" class="btn btn-sm btn-view" title="View Details">
                    <i class="bi bi-eye"></i> View Details
                </a>
            </div>
        `;

        return `
            <tr>
                <td class="fw-medium">${date}</td>
                <td class="text-center">${sampleDayIcon}</td>
                <td>${lcName}</td>
                <td>${fgName}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');

    renderPagination();
    updateRowsInfo(startIndex + 1, Math.min(endIndex, totalRows), totalRows);
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
        </li>
    `;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1); return false;">1</a></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
            </li>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a></li>`;
    }

    // Next button
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
        </li>
    `;

    pagination.innerHTML = html;
}

function updateRowsInfo(start, end, total) {
    const rowsInfo = document.getElementById('rowsInfo');
    if (rowsInfo) {
        rowsInfo.textContent = `Showing ${start} to ${end} of ${total} entries`;
    }
}

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    // Scroll to top of table
    document.querySelector('.content-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Filter listeners (only attach if elements exist - region filter may be hidden for encoders)
    const regionFilter = document.getElementById('filterRegion');
    if (regionFilter) {
        regionFilter.addEventListener('change', applyFilters);
    }
    document.getElementById('filterLandingCenter').addEventListener('change', applyFilters);
    document.getElementById('filterFishingGround').addEventListener('change', applyFilters);

    // Rows per page
    document.getElementById('rowsPerPage').addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadSampleDays();
        window.toast.success('List refreshed');
    });

    // New Record button
    document.getElementById('newRecordBtn').addEventListener('click', () => {
        openNewRecordModal();
    });

    // Modal form listeners - Region change updates dependent dropdowns
    const modalRegionSelect = document.getElementById('modalRegion');
    if (modalRegionSelect) {
        modalRegionSelect.addEventListener('change', function() {
            updateModalDependencies();
        });
    }
    document.getElementById('modalDate').addEventListener('change', calculateSampleDay);
    document.getElementById('modalLandingCenter').addEventListener('change', calculateSampleDay);

    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveRecord);

    // Delete confirmation
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
}

function updateModalDependencies(preserveLCValue = null, preserveFGValue = null) {
    const regionSelect = document.getElementById('modalRegion');
    if (!regionSelect) return;
    
    const regionId = regionSelect.value;
    
    // Get current values if not provided
    const currentLCValue = preserveLCValue !== null ? preserveLCValue : (document.getElementById('modalLandingCenter')?.value || '');
    const currentFGValue = preserveFGValue !== null ? preserveFGValue : (document.getElementById('modalFishingGround')?.value || '');
    
    if (regionId && regionId !== '') {
        // Convert to string for comparison to handle number/string mismatches
        const regionIdStr = String(regionId);
        
        // Filter landing centers by region
        const filteredLC = landingCenters.filter(lc => {
            const lcRegionId = String(lc.region_id);
            return lcRegionId === regionIdStr;
        });
        
        // Filter fishing grounds by region
        const filteredFG = fishingGrounds.filter(fg => {
            const fgRegionId = String(fg.region_id);
            return fgRegionId === regionIdStr;
        });
        
        // Populate landing center dropdown with filtered items
        populateDropdown('modalLandingCenter', filteredLC, 'land_ctr_id', 'landing_center', false, false);
        
        // Set landing center value if it exists in filtered list
        if (currentLCValue) {
            const lcValueStr = String(currentLCValue);
            const lcExists = filteredLC.some(lc => String(lc.land_ctr_id) === lcValueStr);
            if (lcExists) {
                const lcSelect = document.getElementById('modalLandingCenter');
                if (lcSelect) lcSelect.value = currentLCValue;
            }
        }
        
        // Populate fishing ground dropdown with filtered items
        populateDropdown('modalFishingGround', filteredFG, 'ground_id', 'ground_desc', false, false);
        
        // Set fishing ground value if it exists in filtered list
        if (currentFGValue) {
            const fgValueStr = String(currentFGValue);
            const fgExists = filteredFG.some(fg => String(fg.ground_id) === fgValueStr);
            if (fgExists) {
                const fgSelect = document.getElementById('modalFishingGround');
                if (fgSelect) fgSelect.value = currentFGValue;
            }
        }
    } else {
        // No region selected - clear the dependent dropdowns
        populateDropdown('modalLandingCenter', [], 'land_ctr_id', 'landing_center', false, false);
        populateDropdown('modalFishingGround', [], 'ground_id', 'ground_desc', false, false);
        
        const lcSelect = document.getElementById('modalLandingCenter');
        const fgSelect = document.getElementById('modalFishingGround');
        if (lcSelect) lcSelect.value = '';
        if (fgSelect) fgSelect.value = '';
    }
    
    // Recalculate sample day when dependencies change
    calculateSampleDay();
}

function calculateSampleDay() {
    const sdateVal = document.getElementById('modalDate').value;
    const lcId = document.getElementById('modalLandingCenter').value;
    const indicator = document.getElementById('modalSampleDayIndicator');
    const icon = document.getElementById('modalSampleDayIcon');
    const text = document.getElementById('modalSampleDayText');

    if (!sdateVal || !lcId) {
        if (indicator) indicator.style.display = 'none';
        return;
    }

    // Convert to string for comparison to handle number/string mismatches
    const lcIdStr = String(lcId);
    const selectedLC = landingCenters.find(lc => String(lc.land_ctr_id) === lcIdStr);
    if (!selectedLC) {
        if (indicator) indicator.style.display = 'none';
        return;
    }

    const type = selectedLC.lc_type || '';
    const day = new Date(sdateVal).getDate();

    let isSampleDay = false;
    const remainder = day % 3;

    if (remainder === 0) {
        isSampleDay = false;
    } else if (type === 'Commercial' && remainder === 1) {
        isSampleDay = true;
    } else if (type === 'Municipal' && remainder === 2) {
        isSampleDay = true;
    } else {
        isSampleDay = false;
    }

    // Update indicator
    if (indicator && icon && text) {
        indicator.style.display = 'block';
        if (isSampleDay) {
            icon.className = 'bi bi-check-circle-fill me-2 text-success';
            icon.style.fontSize = '1.25rem';
            text.textContent = 'This day is a sampling day';
            text.className = 'fw-medium text-success';
            indicator.style.borderLeftColor = '#10b981';
            indicator.style.backgroundColor = '#f0fdf4';
        } else {
            icon.className = 'bi bi-x-circle-fill me-2 text-danger';
            icon.style.fontSize = '1.25rem';
            text.textContent = 'This day is not a sampling day';
            text.className = 'fw-medium text-danger';
            indicator.style.borderLeftColor = '#ef4444';
            indicator.style.backgroundColor = '#fef2f2';
        }
    }
}

function calculateSampleDayValue() {
    const sdateVal = document.getElementById('modalDate').value;
    const lcId = document.getElementById('modalLandingCenter').value;

    if (!sdateVal || !lcId) {
        return false;
    }

    // Convert to string for comparison to handle number/string mismatches
    const lcIdStr = String(lcId);
    const selectedLC = landingCenters.find(lc => String(lc.land_ctr_id) === lcIdStr);
    if (!selectedLC) {
        return false;
    }

    const type = selectedLC.lc_type || '';
    const day = new Date(sdateVal).getDate();

    let isSampleDay = false;
    const remainder = day % 3;

    if (remainder === 0) {
        isSampleDay = false;
    } else if (type === 'Commercial' && remainder === 1) {
        isSampleDay = true;
    } else if (type === 'Municipal' && remainder === 2) {
        isSampleDay = true;
    } else {
        isSampleDay = false;
    }

    return isSampleDay;
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

// View functionality moved to sample-day-detail.html page
// The View button now redirects to sample-day-detail.html?id={recordId}

function openNewRecordModal() {
    // Check permissions - viewers cannot add records
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers cannot add records.', 'Access Denied');
        return;
    }
    
    // Only admins and encoders can add records
    if (!ADMIN_ROLES.includes(currentUser.role) && currentUser.role !== ROLES.ENCODER) {
        window.toast.error('You do not have permission to add records.', 'Access Denied');
        return;
    }
    
    document.getElementById('sampleDayForm').reset();
    document.getElementById('modalUnloadDayId').value = '';
    document.getElementById('modalTitle').textContent = 'New Sampling Day';
    document.getElementById('saveBtn').style.display = 'inline-block';
    
    // Reset region and clear dependent dropdowns (they'll populate when region is selected)
    document.getElementById('modalRegion').value = '';
    populateDropdown('modalLandingCenter', [], 'land_ctr_id', 'landing_center', false, false);
    populateDropdown('modalFishingGround', [], 'ground_id', 'ground_desc', false, false);
    
    // Hide sample day indicator
    const indicator = document.getElementById('modalSampleDayIndicator');
    if (indicator) indicator.style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('viewModal'));
    modal.show();
}

let deleteRecordId = null;

function deleteRecord(id) {
    if (!ADMIN_ROLES.includes(currentUser.role)) {
        window.toast.error('Only administrators can delete records.', 'Access Denied');
        return;
    }

    deleteRecordId = id;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function confirmDelete() {
    if (!deleteRecordId) return;

    try {
        const { error } = await window._supabase
            .from(TABLES.SAMPLE_DAY)
            .delete()
            .eq('unload_day_id', deleteRecordId);

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();

        window.toast.success('Record deleted successfully');
        await loadSampleDays();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'DataEntry.confirmDelete',
            userMessage: 'Failed to delete record'
        });
    } finally {
        deleteRecordId = null;
    }
}

async function saveRecord() {
    // Viewers cannot add or edit records
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers cannot add or edit records.', 'Access Denied');
        return;
    }
    
    // Only admins and encoders can save (encoders can add/edit but not delete)
    if (!ADMIN_ROLES.includes(currentUser.role) && currentUser.role !== ROLES.ENCODER) {
        window.toast.error('You do not have permission to save records.', 'Access Denied');
        return;
    }

    const id = document.getElementById('modalUnloadDayId').value;
    const saveBtn = document.getElementById('saveBtn');

    const payload = {
        sdate: document.getElementById('modalDate').value,
        region_id: document.getElementById('modalRegion').value,
        land_ctr_id: document.getElementById('modalLandingCenter').value,
        ground_id: document.getElementById('modalFishingGround').value,
        sampleday: calculateSampleDayValue(),
        remarks: document.getElementById('modalRemarks').value || null
    };

    // Validation
    const validations = [
        Validation.isRequired(payload.sdate, 'Date'),
        Validation.isRequired(payload.region_id, 'Region'),
        Validation.isRequired(payload.land_ctr_id, 'Landing Center'),
        Validation.isRequired(payload.ground_id, 'Fishing Ground')
    ];

    for (const validation of validations) {
        if (!validation.isValid) {
            window.toast.error(validation.error);
            return;
        }
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
        let result;
        if (id) {
            result = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .update(payload)
                .eq('unload_day_id', id);
        } else {
            result = await window._supabase
                .from(TABLES.SAMPLE_DAY)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('viewModal'));
        modal.hide();

        window.toast.success(id ? 'Record updated successfully' : 'Record created successfully');
        await loadSampleDays();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'DataEntry.saveRecord',
            userMessage: 'Failed to save record'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

// Make functions globally available for onclick handlers
window.deleteRecord = deleteRecord;
window.changePage = changePage;

