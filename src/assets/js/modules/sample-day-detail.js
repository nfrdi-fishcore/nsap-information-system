/**
 * Sample Day Detail Page Logic
 * Handles viewing and editing a single sampling day record
 */

let currentRecord = null;
let currentUser = null;
let regions = [];
let landingCenters = [];
let fishingGrounds = [];
let selectedGearUnloadId = null; // Track selected gear unload row
let allGearUnloadData = []; // Store all gear unload data
let allGears = []; // Store all gears for dropdown
let allFishingEfforts = []; // Store fishing effort reference data
let gearUnloadIdToDelete = null; // Track gear unload ID to delete
let allVessels = []; // Store vessels for vessel unload modal

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

    // Get record ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        window.toast.error('No record ID provided.');
        window.location.href = 'data-entry.html';
        return;
    }

    // Show initial full page loading state
    const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
    if (fullPageLoadingOverlay) {
        fullPageLoadingOverlay.style.display = 'flex';
    }

    // Load reference data first, then the record
    await Promise.all([
        loadRegions(),
        loadLandingCenters(),
        loadFishingGrounds(),
        loadGears(),
        loadFishingEfforts()
    ]);

    // Load the record (loading state will be managed inside loadRecord)
    await loadRecord(recordId);
    setupEventListeners();
});

// ----------------------------------------------------------------------------
// Reference Data Loading
// ----------------------------------------------------------------------------

async function loadRegions() {
    try {
        let query = window._supabase.from(TABLES.REGION).select('*').order('sort_order');
        // RBAC: Filter regions - Only encoder and viewer are limited to their region
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        regions = data;
        populateDropdown('editRegion', regions, 'region_id', 'region_name');
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadRegions',
            userMessage: 'Failed to load regions',
            showToast: false
        });
    }
}

async function loadLandingCenters() {
    try {
        let query = window._supabase.from(TABLES.LANDING_CENTER).select('*').order('landing_center');
        // RBAC: Filter landing centers - Only encoder and viewer are limited to their region
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        landingCenters = data;
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadLandingCenters',
            userMessage: 'Failed to load landing centers',
            showToast: false
        });
    }
}

async function loadFishingGrounds() {
    try {
        let query = window._supabase.from(TABLES.FISHING_GROUND).select('*').order('ground_desc');
        // RBAC: Filter fishing grounds - Only encoder and viewer are limited to their region
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        fishingGrounds = data;
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadFishingGrounds',
            userMessage: 'Failed to load fishing grounds',
            showToast: false
        });
    }
}

async function loadGears() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.GEAR)
            .select('*')
            .order('gear_desc', { ascending: true });

        if (error) throw error;

        allGears = data || [];
        populateGearUnloadDropdown();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadGears',
            userMessage: 'Failed to load gear data',
            showToast: false
        });
    }
}

async function loadFishingEfforts() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .select('*')
            .order('fishing_effort', { ascending: true });
        if (error) throw error;
        allFishingEfforts = data || [];
        populateFishingEffortOptions();
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadFishingEfforts',
            userMessage: 'Failed to load fishing effort data',
            showToast: false
        });
    }
}

async function loadVesselsForModal() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL)
            .select('boat_id, vesselname, gr_id')
            .order('vesselname', { ascending: true });
        if (error) throw error;
        allVessels = data || [];
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadVesselsForModal',
            userMessage: 'Failed to load vessels',
            showToast: false
        });
    }
}

function populateGearUnloadDropdown() {
    const select = document.getElementById('gearUnloadGrId');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Select Gear...</option>';
    allGears.forEach(gear => {
        const gearId = gear.gr_id || gear.Gr_id || gear.gr_Id;
        const option = document.createElement('option');
        option.value = gearId;
        option.textContent = Validation.escapeHtml(gear.gear_desc || '');
        select.appendChild(option);
    });
}

function populateVesselOptions(gearId = null) {
    const select = document.getElementById('boatId');
    if (!select) return;
    
    // Get the currently selected vessel value to preserve it if it still matches the filter
    const currentValue = select.value;
    
    select.innerHTML = '<option value="" disabled selected>Select Vessel...</option>';
    
    // Filter vessels by gear if gearId is provided
    const filteredVessels = gearId 
        ? allVessels.filter(vessel => {
            const vesselGearId = vessel.gr_id || vessel.Gr_id || vessel.gr_Id;
            return String(vesselGearId) === String(gearId);
        })
        : allVessels;
    
    filteredVessels.forEach(vessel => {
        const opt = document.createElement('option');
        const vesselId = vessel.boat_id || vessel.Boat_id || vessel.boat_Id;
        opt.value = vesselId;
        opt.textContent = Validation.escapeHtml(vessel.vesselname || '-');
        select.appendChild(opt);
    });
    
    // Restore the selected value if it still exists in the filtered list
    if (currentValue && filteredVessels.some(v => {
        const vId = v.boat_id || v.Boat_id || v.boat_Id;
        return String(vId) === String(currentValue);
    })) {
        select.value = currentValue;
    } else {
        // Clear selection if the previously selected vessel doesn't match the filter
        select.value = '';
    }
}

function populateFishingEffortOptions() {
    const feSelect1 = document.getElementById('uniteffortId');
    const feSelect2 = document.getElementById('uniteffort2Id');
    const feSelect3 = document.getElementById('uniteffort3Id');
    const selects = [feSelect1, feSelect2, feSelect3];

    selects.forEach(select => {
        if (!select) return;
        const placeholder = select.querySelector('option[value=""]');
        select.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.disabled = true;
        defaultOpt.selected = true;
        defaultOpt.textContent = 'Select Fishing Effort...';
        select.appendChild(defaultOpt);

        allFishingEfforts.forEach(fe => {
            const opt = document.createElement('option');
            opt.value = fe.uniteffort_id || fe.Uniteffort_id || fe.uniteffort_Id;
            opt.textContent = Validation.escapeHtml(fe.fishing_effort || '-');
            select.appendChild(opt);
        });
    });
}

function populateVesselModalGearOptions() {
    const select = document.getElementById('unloadGrId');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Select Gear Unload...</option>';
    allGearUnloadData.forEach(gu => {
        const opt = document.createElement('option');
        const guId = gu.unload_gr_id || gu.Unload_gr_id || gu.unload_Gr_id;
        const gearDesc = gu.dbo_gear ? Validation.escapeHtml(gu.dbo_gear.gear_desc) : 'Gear';
        opt.value = guId;
        opt.textContent = gearDesc;
        select.appendChild(opt);
    });
}

function populateDropdown(elementId, items, valueKey, textKey, includeAllOption = false, preserveValue = false) {
    const select = document.getElementById(elementId);
    if (!select) return;

    const currentValue = preserveValue ? select.value : '';
    select.innerHTML = '';

    if (includeAllOption) {
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = `All ${elementId.replace('edit', '').replace(/([A-Z])/g, ' $1').trim()}`;
        select.appendChild(allOption);
    }

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });

    if (preserveValue && currentValue) {
        select.value = currentValue;
    }
}

// ----------------------------------------------------------------------------
// Record Loading
// ----------------------------------------------------------------------------

async function loadRecord(id) {
    // Show full page loading state (if overlay exists)
    const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
    if (fullPageLoadingOverlay) {
        fullPageLoadingOverlay.style.display = 'flex';
    }

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
            .eq('unload_day_id', id)
            .single();

        // RBAC: Filter by region if not admin
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data) {
            window.toast.error('Record not found.');
            setTimeout(() => {
                window.location.href = 'data-entry.html';
            }, 1500);
            return;
        }

        currentRecord = data;
        await displayRecord(data);
        // Loading overlay will be hidden in displayRecord after all elements are loaded

    } catch (error) {
        // Hide full page loading state on error
        const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
        if (fullPageLoadingOverlay) {
            fullPageLoadingOverlay.style.display = 'none';
        }

        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadRecord',
            userMessage: 'Failed to load record'
        });
        setTimeout(() => {
            window.location.href = 'data-entry.html';
        }, 2000);
    }
}

// ----------------------------------------------------------------------------
// Display
// ----------------------------------------------------------------------------

async function displayRecord(record) {
    // Update summary card
    updateSummaryCard(record);

    // Load gear unload data (this will trigger vessel unload load with first row selected)
    await loadGearUnloadData(record.unload_day_id);
    
    // Load vessel unload data for the first gear unload (default selection)
    // This will be called after gear unload data is loaded and first row is selected

    // Hide buttons based on permissions (buttons are visible by default)
    // Encoders can edit but not delete, viewers cannot edit or delete
    const canEdit = ADMIN_ROLES.includes(currentUser.role) || currentUser.role === ROLES.ENCODER;
    const canDelete = ADMIN_ROLES.includes(currentUser.role);
    
    // Hide edit button if user cannot edit
    if (!canEdit) {
        document.getElementById('editBtn').style.display = 'none';
        // Hide gear unload edit/add buttons
        const addGearBtn = document.getElementById('addGearUnloadBtn');
        const editGearBtn = document.getElementById('editGearUnloadBtn');
        if (addGearBtn) addGearBtn.style.display = 'none';
        if (editGearBtn) editGearBtn.style.display = 'none';
    }
    
    // Hide delete buttons if user cannot delete
    if (!canDelete) {
        const deleteGearBtn = document.getElementById('deleteGearUnloadBtn');
        if (deleteGearBtn) deleteGearBtn.style.display = 'none';
        document.getElementById('deleteBtn').style.display = 'none';
    }
    
    // All elements are now loaded, hide full page loading overlay
    const fullPageLoadingOverlay = document.getElementById('fullPageLoadingOverlay');
    if (fullPageLoadingOverlay) {
        fullPageLoadingOverlay.style.display = 'none';
    }
}

function updateSummaryCard(record) {
    const summaryCard = document.getElementById('summaryCard');
    if (!summaryCard) return;

    // Get region name
    const regionName = record.dbo_region ? Validation.escapeHtml(record.dbo_region.region_name) : '-';
    document.getElementById('summaryRegion').textContent = regionName;

    // Get landing center name
    const lcName = record.dbo_landing_center ? Validation.escapeHtml(record.dbo_landing_center.landing_center) : '-';
    document.getElementById('summaryLandingCenter').textContent = lcName;

    // Get fishing ground name
    const fgName = record.dbo_fishing_ground ? Validation.escapeHtml(record.dbo_fishing_ground.ground_desc) : '-';
    document.getElementById('summaryFishingGround').textContent = fgName;

    // Format date
    let dateDisplay = '-';
    if (record.sdate) {
        const date = new Date(record.sdate);
        dateDisplay = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    document.getElementById('summaryDate').textContent = dateDisplay;

    // Update sampling day indicator
    const isSampleDay = record.sampleday === true || record.sampleday === 'True' || record.sampleday === 'true';
    const iconElement = document.getElementById('summarySamplingDayIcon');
    const textElement = document.getElementById('summarySamplingDayText');
    
    if (isSampleDay) {
        iconElement.innerHTML = '<i class="bi bi-check-circle-fill" style="font-size: 1.5rem; color: #10b981;"></i>';
        textElement.textContent = 'This day was a sampling day';
    } else {
        iconElement.innerHTML = '<i class="bi bi-x-circle-fill" style="font-size: 1.5rem; color: #ef4444;"></i>';
        textElement.textContent = 'This day was not a sampling day';
    }

    // Ensure summary card is visible (it's now visible by default in HTML)
    summaryCard.style.display = 'block';
}

async function loadGearUnloadData(unloadDayId) {
    const tableBody = document.getElementById('gearUnloadTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        // Load gear unloads for this sample day
        let query = window._supabase
            .from(TABLES.GEAR_UNLOAD)
            .select(`
                unload_gr_id,
                gr_id,
                boats,
                catch,
                dbo_gear(gear_desc)
            `)
            .eq('unload_day_id', unloadDayId)
            .order('unload_gr_id', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5 text-muted">
                        <div>No gear unload records found for this sampling day.</div>
                        <button type="button" class="btn gear-unload-add-btn btn-sm mt-3" onclick="openAddGearUnloadModal()">
                            <i class="bi bi-plus-lg me-2"></i>Add Gear
                        </button>
                    </td>
                </tr>
            `;
            const footer = document.getElementById('gearUnloadTableFooter');
            if (footer) footer.style.display = 'none';
            
            // Clear gear unload data and reset selection
            allGearUnloadData = [];
            selectedGearUnloadId = null;
            
            // Still load vessel unload data to show appropriate message (no gear unload means no vessel unload)
            if (currentRecord && currentRecord.unload_day_id) {
                await loadVesselUnloadData(currentRecord.unload_day_id, null);
            }
            return;
        }

        // Calculate totals (even for single row)
        let totalBoats = 0;
        let totalCatch = 0;

        data.forEach(unload => {
            totalBoats += unload.boats ? parseInt(unload.boats) : 0;
            totalCatch += unload.catch ? parseFloat(unload.catch) : 0;
        });

        // Store gear unload data for selection
        allGearUnloadData = data;

        // Render table with clickable rows and action buttons
        tableBody.innerHTML = data.map((unload, index) => {
            const gearDesc = unload.dbo_gear ? Validation.escapeHtml(unload.dbo_gear.gear_desc) : '-';
            const boats = unload.boats ? parseInt(unload.boats).toLocaleString() : '0';
            const catchKg = unload.catch ? parseFloat(unload.catch).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            const unloadGrId = unload.unload_gr_id || unload.Unload_gr_id || unload.unload_Gr_id;
            const isSelected = index === 0 ? 'selected-row' : ''; // Select first row by default

            return `
                <tr class="gear-unload-row ${isSelected}" data-unload-gr-id="${unloadGrId}" style="cursor: pointer;">
                    <td>${gearDesc}</td>
                    <td class="text-center">${boats}</td>
                    <td class="text-center">${catchKg}</td>
                    <td class="text-end gear-action-cell">
                        <button type="button" class="btn btn-sm btn-edit me-1" title="Edit Gear Unload" onclick="handleGearRowEdit('${unloadGrId}'); event.stopPropagation();">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-delete" title="Delete Gear Unload" onclick="handleGearRowDelete('${unloadGrId}'); event.stopPropagation();">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Set first row as selected by default
        if (data.length > 0) {
            const firstUnloadGrId = data[0].unload_gr_id || data[0].Unload_gr_id || data[0].unload_Gr_id;
            selectedGearUnloadId = firstUnloadGrId;
            
            // Add click event listeners to rows
            const rows = tableBody.querySelectorAll('.gear-unload-row');
            rows.forEach(row => {
                row.addEventListener('click', function() {
                    // Remove selected class from all rows
                    rows.forEach(r => r.classList.remove('selected-row'));
                    // Add selected class to clicked row
                    this.classList.add('selected-row');
                    // Update selected gear unload ID
                    selectedGearUnloadId = this.getAttribute('data-unload-gr-id');
                    // Reload vessel unload data for selected gear unload
                    if (currentRecord && currentRecord.unload_day_id) {
                        loadVesselUnloadData(currentRecord.unload_day_id, selectedGearUnloadId);
                    }
                });
            });
        }

        // Update totals in footer (always show when data exists, even if only 1 row)
        const footer = document.getElementById('gearUnloadTableFooter');
        if (footer && data.length > 0) {
            document.getElementById('gearUnloadTotalBoats').textContent = totalBoats.toLocaleString();
            document.getElementById('gearUnloadTotalCatch').textContent = totalCatch.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            footer.style.display = '';
        }

        // After rendering, load vessel unload data for the first (selected) gear unload
        if (data.length > 0 && currentRecord && currentRecord.unload_day_id) {
            const firstUnloadGrId = data[0].unload_gr_id || data[0].Unload_gr_id || data[0].unload_Gr_id;
            await loadVesselUnloadData(currentRecord.unload_day_id, firstUnloadGrId);
        }

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">Error loading gear unload data. Please refresh.</td></tr>';
        const footer = document.getElementById('gearUnloadTableFooter');
        if (footer) footer.style.display = 'none';
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadGearUnloadData',
            userMessage: 'Failed to load gear unload data',
            showToast: false
        });
    }
}

async function loadVesselUnloadData(unloadDayId, unloadGrId = null) {
    const tableBody = document.getElementById('vesselUnloadTableBody');
    if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        // If unloadGrId is provided, filter by that specific gear unload
        // Otherwise, get all gear unload IDs for this sample day
        let gearUnloadIds = [];
        
        if (unloadGrId) {
            // Filter by specific gear unload
            gearUnloadIds = [unloadGrId];
        } else {
            // Get all gear unload IDs for this sample day
            const { data: gearUnloads, error: gearError } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select('unload_gr_id')
                .eq('unload_day_id', unloadDayId);

            if (gearError) throw gearError;

            if (!gearUnloads || gearUnloads.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-5 text-muted">
                            <div>No vessel unload records found for this sampling day.</div>
                            <div class="mt-3 text-center">
                                <button type="button" class="btn vessel-unload-add-btn btn-sm" onclick="handleAddVesselUnload()">
                                    <i class="bi bi-plus-lg me-2"></i>New Record
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                const footer = document.getElementById('vesselUnloadTableFooter');
                if (footer) footer.style.display = 'none';
                return;
            }

            gearUnloadIds = gearUnloads.map(gu => gu.unload_gr_id).filter(Boolean);
        }

        // Load vessel unloads for the selected gear unload ID(s)
        let query = window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .select('*')
            .in('unload_gr_id', gearUnloadIds)
            .order('v_unload_id', { ascending: true });

        // RBAC: Filter by region if not admin
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            // Additional filtering is handled through the gear unload relationship
            // which is already filtered by unload_day_id (region-based)
        }

        const { data: vesselUnloads, error } = await query;

        if (error) throw error;

        if (!vesselUnloads || vesselUnloads.length === 0) {
            const message = unloadGrId 
                ? 'No vessel unload records found for this particular gear unload of the sampling day.'
                : 'No vessel unload records found for this sampling day.';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5 text-muted">
                        <div>${message}</div>
                        <div class="mt-3 text-center">
                            <button type="button" class="btn vessel-unload-add-btn btn-sm" onclick="handleAddVesselUnload()">
                                <i class="bi bi-plus-lg me-2"></i>New Record
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            const footer = document.getElementById('vesselUnloadTableFooter');
            if (footer) footer.style.display = 'none';
            return;
        }

        // Collect IDs for related data
        const vesselIds = new Set();

        vesselUnloads.forEach(unload => {
            if (unload.boat_id) vesselIds.add(unload.boat_id);
        });

        // Fetch vessels
        let vesselsMap = {};
        if (vesselIds.size > 0) {
            const { data: vesselsData, error: vesselsError } = await window._supabase
                .from(TABLES.VESSEL)
                .select('boat_id, vesselname')
                .in('boat_id', Array.from(vesselIds));

            if (vesselsError) throw vesselsError;

            vesselsData.forEach(vessel => {
                const vesselId = vessel.boat_id || vessel.Boat_id || vessel.boat_Id;
                vesselsMap[vesselId] = vessel;
            });
        }

        // Combine vessel unload data with related descriptions
        const data = vesselUnloads.map(unload => {
            const unloadWithDetails = { ...unload };
            
            // Add vessel name
            const vesselId = unload.boat_id || unload.Boat_id || unload.boat_Id;
            if (vesselId && vesselsMap[vesselId]) {
                unloadWithDetails.dbo_vessel = {
                    vesselname: vesselsMap[vesselId].vesselname
                };
            }
            
            return unloadWithDetails;
        });

        // Calculate totals (even for single row)
        let totalCatch = 0;
        let totalSample = 0;

        data.forEach(unload => {
            totalCatch += unload.catch_total ? parseFloat(unload.catch_total) : 0;
            totalSample += unload.catch_samp ? parseFloat(unload.catch_samp) : 0;
        });

        // Render table
        tableBody.innerHTML = data.map(unload => {
            const vesselName = unload.dbo_vessel ? Validation.escapeHtml(unload.dbo_vessel.vesselname) : '-';
            const catchTotal = unload.catch_total ? parseFloat(unload.catch_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            const catchSamp = unload.catch_samp ? parseFloat(unload.catch_samp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            const unloadId = unload.v_unload_id || unload.V_unload_id || unload.v_Unload_id;
            const unloadGrIdForRow = unload.unload_gr_id || unload.Unload_gr_id || unload.unload_Gr_id;

            return `
                <tr>
                    <td>${vesselName}</td>
                    <td class="text-center">${catchSamp}</td>
                    <td class="text-center">${catchTotal}</td>
                    <td class="text-end">
                        <a class="btn btn-view btn-sm" title="View Details"
                           href="vessel-unload-detail.html?v_unload_id=${encodeURIComponent(unloadId || '')}&unload_gr_id=${encodeURIComponent(unloadGrIdForRow || '')}">
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        // Update totals in footer (always show when data exists, even if only 1 row)
        const footer = document.getElementById('vesselUnloadTableFooter');
        if (footer && data.length > 0) {
            document.getElementById('vesselUnloadTotalCatch').textContent = totalCatch.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('vesselUnloadTotalSample').textContent = totalSample.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            footer.style.display = '';
        }

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">Error loading vessel unload data. Please refresh.</td></tr>';
        const footer = document.getElementById('vesselUnloadTableFooter');
        if (footer) footer.style.display = 'none';
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.loadVesselUnloadData',
            userMessage: 'Failed to load vessel unload data',
            showToast: false
        });
    }
}

function handleAddVesselUnload() {
    // Only allow non-viewers to add vessel unload records
    if (!currentUser || currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to add data.', 'Access Denied');
        return;
    }

    if (!currentRecord || !currentRecord.unload_day_id) {
        window.toast.error('Sampling day record is not loaded yet.');
        return;
    }

    if (!selectedGearUnloadId) {
        window.toast.error('Please add and select a gear unload first.');
        return;
    }

    openVesselUnloadQuickModal();
}

function openVesselUnloadQuickModal() {
    const modalEl = document.getElementById('vesselUnloadModal');
    if (!modalEl) {
        window.toast.error('Vessel unload form modal is not available.');
        return;
    }

    (async () => {
        await loadVesselsForModal();
        populateVesselOptions();
        populateVesselModalGearOptions();
        resetFishingEffortFields();

        // Reset form values before applying preselection so dropdown value sticks
        const form = document.getElementById('vesselUnloadQuickForm');
        if (form) form.reset();
        document.getElementById('vesselUnloadId').value = '';
        document.getElementById('vesselUnloadModalTitle').textContent = 'Add Vessel Unload';

        // Preselect current gear unload
        const gearSelect = document.getElementById('unloadGrId');
        if (gearSelect) {
            const preselectId = selectedGearUnloadId || (allGearUnloadData[0] && (allGearUnloadData[0].unload_gr_id || allGearUnloadData[0].Unload_gr_id || allGearUnloadData[0].unload_Gr_id));
            if (preselectId) {
                gearSelect.value = String(preselectId);
                await handleGearUnloadChange(preselectId);
            } else {
                // If no gear preselected, show all vessels
                populateVesselOptions();
            }
            gearSelect.disabled = true; // keep read-only
        } else {
            // If no gear select found, show all vessels
            populateVesselOptions();
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    })();
}

async function saveVesselUnloadQuick() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('vesselUnloadId').value;
    const unloadGrId = document.getElementById('unloadGrId').value;
    const boatId = document.getElementById('boatId').value;
    const effort = document.getElementById('effort').value;
    const uniteffortId = document.getElementById('uniteffortId').value;
    const boxesTotal = document.getElementById('boxesTotal').value;
    const catchTotal = document.getElementById('catchTotal').value;
    const boxesSamp = document.getElementById('boxesSamp').value;
    const catchSamp = document.getElementById('catchSamp').value;
    const boxesPiecesId = document.getElementById('boxesPiecesId').value;
    const effort2 = document.getElementById('effort2').value;
    const uniteffort2Id = document.getElementById('uniteffort2Id').value;
    const effort3 = document.getElementById('effort3').value;
    const uniteffort3Id = document.getElementById('uniteffort3Id').value;
    const saveBtn = document.getElementById('saveVesselUnloadQuickBtn');

    const gearUnloadValidation = Validation.isRequired(unloadGrId, 'Gear Unload');
    if (!gearUnloadValidation.isValid) {
        window.toast.error(gearUnloadValidation.error);
        return;
    }

    const vesselValidation = Validation.isRequired(boatId, 'Vessel');
    if (!vesselValidation.isValid) {
        window.toast.error(vesselValidation.error);
        return;
    }

    const effortInput = document.getElementById('effort');
    const effort2Input = document.getElementById('effort2');
    const effort3Input = document.getElementById('effort3');

    let effortNum = null;
    if (effortInput && !effortInput.disabled) {
        const effortValidation = Validation.isRequired(effort, 'Effort 1');
        if (!effortValidation.isValid) {
            window.toast.error(effortValidation.error);
            return;
        }
        effortNum = parseFloat(effort);
        if (isNaN(effortNum) || effortNum < 0) {
            window.toast.error('Effort 1 must be a non-negative number.');
            return;
        }
    }

    const uniteffortValidation = Validation.isRequired(uniteffortId, 'Fishing Effort 1');
    if (!uniteffortValidation.isValid) {
        window.toast.error(uniteffortValidation.error);
        return;
    }

    if (effort2Input && !effort2Input.disabled && effort2) {
        const effort2Num = parseFloat(effort2);
        if (isNaN(effort2Num) || effort2Num < 0) {
            window.toast.error('Effort 2 must be a non-negative number.');
            return;
        }
    }

    if (effort3Input && !effort3Input.disabled && effort3) {
        const effort3Num = parseFloat(effort3);
        if (isNaN(effort3Num) || effort3Num < 0) {
            window.toast.error('Effort 3 must be a non-negative number.');
            return;
        }
    }

    const modalEl = document.getElementById('vesselUnloadModal');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        unload_gr_id: unloadGrId ? parseInt(unloadGrId) : null,
        boat_id: boatId ? parseInt(boatId) : null,
        effort: effortInput && !effortInput.disabled && effort ? parseFloat(effort) : null,
        uniteffort_id: uniteffortId ? parseInt(uniteffortId) : null,
        boxes_total: boxesTotal ? parseInt(boxesTotal) : null,
        catch_total: catchTotal ? parseFloat(catchTotal) : null,
        boxes_samp: boxesSamp ? parseInt(boxesSamp) : null,
        catch_samp: catchSamp ? parseFloat(catchSamp) : null,
        boxes_pieces_id: boxesPiecesId ? parseInt(boxesPiecesId) : null,
        effort_2: (effort2Input && !effort2Input.disabled && effort2) ? parseFloat(effort2) : null,
        uniteffort_2_id: uniteffort2Id ? parseInt(uniteffort2Id) : null,
        effort_3: (effort3Input && !effort3Input.disabled && effort3) ? parseFloat(effort3) : null,
        uniteffort_3_id: uniteffort3Id ? parseInt(uniteffort3Id) : null
    };

    try {
        let result;
        if (id) {
            result = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .update(payload)
                .eq('v_unload_id', parseInt(id));
        } else {
            result = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        const modal = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        const form = document.getElementById('vesselUnloadQuickForm');
        if (form) form.reset();
        document.getElementById('vesselUnloadId').value = '';
        document.getElementById('uniteffort2Id').value = '';
        document.getElementById('uniteffort3Id').value = '';
        window.toast.success('Vessel unload saved successfully!');

        // Update boats count for the gear unload
        if (unloadGrId) {
            await updateGearUnloadBoatsCount(unloadGrId);
        }

        if (currentRecord && currentRecord.unload_day_id) {
            await loadGearUnloadData(currentRecord.unload_day_id);
            await loadVesselUnloadData(currentRecord.unload_day_id, selectedGearUnloadId);
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.saveVesselUnloadQuick',
            userMessage: 'Failed to save vessel unload'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function handleGearUnloadChange(unloadGrId) {
    if (!unloadGrId) {
        resetFishingEffortFields();
        // If no gear selected, show all vessels
        populateVesselOptions();
        return;
    }

    try {
        const gearUnload = allGearUnloadData.find(gu => {
            const guId = gu.unload_gr_id || gu.Unload_gr_id || gu.unload_Gr_id;
            return String(guId) === String(unloadGrId);
        });

        if (!gearUnload || !gearUnload.gr_id) {
            resetFishingEffortFields();
            // If no gear unload found, show all vessels
            populateVesselOptions();
            return;
        }

        const gear = allGears.find(g => {
            const gId = g.gr_id || g.Gr_id || g.gr_Id;
            return String(gId) === String(gearUnload.gr_id);
        });

        if (!gear) {
            resetFishingEffortFields();
            // If no gear found, show all vessels
            populateVesselOptions();
            return;
        }
        
        // Filter vessels by the gear ID
        const gearId = gear.gr_id || gear.Gr_id || gear.gr_Id;
        populateVesselOptions(gearId);

        const uniteffortIdSelect = document.getElementById('uniteffortId');
        const uniteffort2IdSelect = document.getElementById('uniteffort2Id');
        const uniteffort3IdSelect = document.getElementById('uniteffort3Id');
        const effortInput = document.getElementById('effort');
        const effort2Input = document.getElementById('effort2');
        const effort3Input = document.getElementById('effort3');

        if (uniteffortIdSelect && gear.uniteffort_id) {
            uniteffortIdSelect.value = String(gear.uniteffort_id);
            uniteffortIdSelect.disabled = true;
            if (effortInput) {
                effortInput.disabled = false;
                effortInput.required = true;
            }
        } else {
            if (effortInput) {
                effortInput.disabled = true;
                effortInput.required = false;
                effortInput.value = '';
            }
        }

        if (uniteffort2IdSelect) {
            if (gear.uniteffort_2_id) {
                uniteffort2IdSelect.value = String(gear.uniteffort_2_id);
                if (effort2Input) {
                    effort2Input.disabled = false;
                }
            } else {
                uniteffort2IdSelect.value = '';
                if (effort2Input) {
                    effort2Input.disabled = true;
                    effort2Input.value = '';
                }
            }
            uniteffort2IdSelect.disabled = true;
        }

        if (uniteffort3IdSelect) {
            if (gear.uniteffort_3_id) {
                uniteffort3IdSelect.value = String(gear.uniteffort_3_id);
                if (effort3Input) {
                    effort3Input.disabled = false;
                }
            } else {
                uniteffort3IdSelect.value = '';
                if (effort3Input) {
                    effort3Input.disabled = true;
                    effort3Input.value = '';
                }
            }
            uniteffort3IdSelect.disabled = true;
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.handleGearUnloadChange',
            userMessage: 'Failed to load gear fishing effort data',
            showToast: false
        });
        resetFishingEffortFields();
    }
}

function resetFishingEffortFields() {
    const uniteffortIdSelect = document.getElementById('uniteffortId');
    const uniteffort2IdSelect = document.getElementById('uniteffort2Id');
    const uniteffort3IdSelect = document.getElementById('uniteffort3Id');
    const effortInput = document.getElementById('effort');
    const effort2Input = document.getElementById('effort2');
    const effort3Input = document.getElementById('effort3');

    if (uniteffortIdSelect) {
        uniteffortIdSelect.value = '';
        uniteffortIdSelect.disabled = true;
        if (uniteffortIdSelect.options.length > 0) {
            uniteffortIdSelect.selectedIndex = 0;
        }
    }
    if (uniteffort2IdSelect) {
        uniteffort2IdSelect.value = '';
        uniteffort2IdSelect.disabled = true;
        if (uniteffort2IdSelect.options.length > 0) {
            uniteffort2IdSelect.selectedIndex = 0;
        }
    }
    if (uniteffort3IdSelect) {
        uniteffort3IdSelect.value = '';
        uniteffort3IdSelect.disabled = true;
        if (uniteffort3IdSelect.options.length > 0) {
            uniteffort3IdSelect.selectedIndex = 0;
        }
    }
    if (effortInput) {
        effortInput.value = '';
        effortInput.disabled = true;
        effortInput.required = false;
    }
    if (effort2Input) {
        effort2Input.value = '';
        effort2Input.disabled = true;
    }
    if (effort3Input) {
        effort3Input.value = '';
        effort3Input.disabled = true;
    }
}

// ----------------------------------------------------------------------------
// Edit Modal Functions
// ----------------------------------------------------------------------------

function openEditModal() {
    // Prevent viewers from editing
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to edit data.', 'Access Denied');
        return;
    }

    if (!currentRecord) return;

    // Populate form fields
    document.getElementById('editId').value = currentRecord.unload_day_id;
    document.getElementById('editDate').value = currentRecord.sdate;
    document.getElementById('editRegion').value = currentRecord.region_id;
    document.getElementById('editRemarks').value = currentRecord.remarks || '';

    // Update dependent dropdowns and set values
    updateEditDependencies(currentRecord.land_ctr_id, currentRecord.ground_id);

    // Calculate sample day
    calculateSampleDay();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
}

function updateEditDependencies(preserveLCValue = null, preserveFGValue = null) {
    const regionSelect = document.getElementById('editRegion');
    if (!regionSelect) return;
    
    const regionId = regionSelect.value;
    
    // Get current values if not provided
    const currentLCValue = preserveLCValue !== null ? preserveLCValue : (document.getElementById('editLandingCenter')?.value || '');
    const currentFGValue = preserveFGValue !== null ? preserveFGValue : (document.getElementById('editFishingGround')?.value || '');
    
    if (regionId && regionId !== '') {
        // Convert to string for comparison
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
        
        // Populate landing center dropdown
        populateDropdown('editLandingCenter', filteredLC, 'land_ctr_id', 'landing_center', false, false);
        
        // Set landing center value if it exists in filtered list
        if (currentLCValue) {
            const lcValueStr = String(currentLCValue);
            const lcExists = filteredLC.some(lc => String(lc.land_ctr_id) === lcValueStr);
            if (lcExists) {
                const lcSelect = document.getElementById('editLandingCenter');
                if (lcSelect) lcSelect.value = currentLCValue;
            }
        }
        
        // Populate fishing ground dropdown
        populateDropdown('editFishingGround', filteredFG, 'ground_id', 'ground_desc', false, false);
        
        // Set fishing ground value if it exists in filtered list
        if (currentFGValue) {
            const fgValueStr = String(currentFGValue);
            const fgExists = filteredFG.some(fg => String(fg.ground_id) === fgValueStr);
            if (fgExists) {
                const fgSelect = document.getElementById('editFishingGround');
                if (fgSelect) fgSelect.value = currentFGValue;
            }
        }
    } else {
        // No region selected - clear the dependent dropdowns
        populateDropdown('editLandingCenter', [], 'land_ctr_id', 'landing_center', false, false);
        populateDropdown('editFishingGround', [], 'ground_id', 'ground_desc', false, false);
        
        const lcSelect = document.getElementById('editLandingCenter');
        const fgSelect = document.getElementById('editFishingGround');
        if (lcSelect) lcSelect.value = '';
        if (fgSelect) fgSelect.value = '';
    }
    
    // Clear sample day calculation when dependencies change
    // Hide sample day indicator initially
    const indicator = document.getElementById('editSampleDayIndicator');
    if (indicator) indicator.style.display = 'none';
    calculateSampleDay();
}

function calculateSampleDay() {
    const sdateVal = document.getElementById('editDate').value;
    const lcId = document.getElementById('editLandingCenter').value;
    const sampleDayInput = document.getElementById('editSampleDay');

    if (!sdateVal || !lcId) {
        if (sampleDayInput) sampleDayInput.value = '';
        return;
    }

    // Find the selected landing center
    const lcIdStr = String(lcId);
    const selectedLC = landingCenters.find(lc => String(lc.land_ctr_id) === lcIdStr);
    if (!selectedLC) {
        if (sampleDayInput) sampleDayInput.value = '';
        return;
    }

    const type = selectedLC.lc_type || ''; // Commercial, Municipal, etc.
    const day = new Date(sdateVal).getDate();

    let isSampleDay = false;
    const remainder = day % 3;

    // Logic:
    // Remainder 1 (1, 4, 7...): Commercial
    // Remainder 2 (2, 5, 8...): Municipal
    // Remainder 0 (3, 6, 9...): Rest Day (False)

    if (remainder === 0) {
        // Rest Day - Always False
        isSampleDay = false;
    } else if (type === 'Commercial' && remainder === 1) {
        isSampleDay = true;
    } else if (type === 'Municipal' && remainder === 2) {
        isSampleDay = true;
    } else {
        // Mismatch (e.g. Commercial on Municipal day)
        isSampleDay = false;
    }

    // Update indicator
    const indicator = document.getElementById('editSampleDayIndicator');
    const icon = document.getElementById('editSampleDayIcon');
    const text = document.getElementById('editSampleDayText');

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
    } else {
        if (indicator) indicator.style.display = 'none';
    }
    
    return isSampleDay;
}

function calculateSampleDayValue() {
    const sdateVal = document.getElementById('editDate').value;
    const lcId = document.getElementById('editLandingCenter').value;

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

async function saveEdit() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    // Check if user can edit (admins and encoders)
    if (!ADMIN_ROLES.includes(currentUser.role) && currentUser.role !== ROLES.ENCODER) {
        window.toast.error('You do not have permission to edit data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('editId').value;
    const saveBtn = document.getElementById('saveEditBtn');

    const payload = {
        sdate: document.getElementById('editDate').value,
        region_id: document.getElementById('editRegion').value,
        land_ctr_id: document.getElementById('editLandingCenter').value,
        ground_id: document.getElementById('editFishingGround').value,
        sampleday: calculateSampleDayValue(),
        remarks: document.getElementById('editRemarks').value || null
    };

    // Validation
    const dateValidation = Validation.isRequired(payload.sdate, 'Date');
    const regionValidation = Validation.isRequired(payload.region_id, 'Region');
    const lcValidation = Validation.isRequired(payload.land_ctr_id, 'Landing Center');
    const fgValidation = Validation.isRequired(payload.ground_id, 'Fishing Ground');
    // Sample day is calculated automatically, no validation needed

    if (!dateValidation.isValid || !regionValidation.isValid || !lcValidation.isValid || 
        !fgValidation.isValid) {
        window.toast.error(dateValidation.error || regionValidation.error || lcValidation.error || 
            fgValidation.error || 'Please fill in all required fields.');
        return;
    }

    // Date validation
    const dateCheck = Validation.validateDate(payload.sdate, true, true);
    if (!dateCheck.isValid) {
        window.toast.error(dateCheck.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
        const { error } = await window._supabase
            .from(TABLES.SAMPLE_DAY)
            .update(payload)
            .eq('unload_day_id', id);

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        modal.hide();
        document.getElementById('editForm').reset();
        document.getElementById('editId').value = '';
        
        window.toast.success('Sampling day updated successfully!');

        // Reload the record to show updated data
        await loadRecord(id);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.saveEdit',
            userMessage: 'Failed to save changes'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Gear Unload Modal Functions
// ----------------------------------------------------------------------------

/**
 * Get the count of vessel unload records for a given gear unload
 * @param {string|number} unloadGrId - The gear unload ID
 * @returns {Promise<number>} The count of vessel unloads
 */
async function getVesselUnloadCountForGearUnload(unloadGrId) {
    if (!unloadGrId) return 0;
    
    try {
        const { count, error } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .select('*', { count: 'exact', head: true })
            .eq('unload_gr_id', parseInt(unloadGrId));
        
        if (error) {
            console.error('Error counting vessel unloads:', error);
            return 0;
        }
        
        return count || 0;
    } catch (error) {
        console.error('Error in getVesselUnloadCountForGearUnload:', error);
        return 0;
    }
}

/**
 * Get the sum of catch_total from vessel unload records for a given gear unload
 * @param {string|number} unloadGrId - The gear unload ID
 * @returns {Promise<number>} The sum of catch_total from vessel unloads
 */
async function getVesselUnloadCatchTotalForGearUnload(unloadGrId) {
    if (!unloadGrId) return 0;
    
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .select('catch_total')
            .eq('unload_gr_id', parseInt(unloadGrId));
        
        if (error) {
            console.error('Error getting vessel unload catch total:', error);
            return 0;
        }
        
        if (!data || data.length === 0) return 0;
        
        // Sum all catch_total values
        const total = data.reduce((sum, unload) => {
            const catchTotal = unload.catch_total ? parseFloat(unload.catch_total) : 0;
            return sum + catchTotal;
        }, 0);
        
        return total;
    } catch (error) {
        console.error('Error in getVesselUnloadCatchTotalForGearUnload:', error);
        return 0;
    }
}

/**
 * Update the boats count and catch total for a gear unload based on vessel unload records
 * @param {string|number} unloadGrId - The gear unload ID
 */
async function updateGearUnloadBoatsCount(unloadGrId) {
    if (!unloadGrId) return;
    
    try {
        const boatsCount = await getVesselUnloadCountForGearUnload(unloadGrId);
        const catchTotal = await getVesselUnloadCatchTotalForGearUnload(unloadGrId);
        
        // Update the gear unload record
        const { error } = await window._supabase
            .from(TABLES.GEAR_UNLOAD)
            .update({ 
                boats: boatsCount,
                catch: catchTotal
            })
            .eq('unload_gr_id', parseInt(unloadGrId));
        
        if (error) {
            console.error('Error updating gear unload boats count and catch:', error);
        }
    } catch (error) {
        console.error('Error in updateGearUnloadBoatsCount:', error);
    }
}

function openAddGearUnloadModal() {
    // Prevent viewers from adding
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to add data.', 'Access Denied');
        return;
    }

    if (!currentRecord || !currentRecord.unload_day_id) {
        window.toast.error('No sample day record loaded.');
        return;
    }

    // Reset form
    document.getElementById('gearUnloadForm').reset();
    document.getElementById('gearUnloadId').value = '';
    
    // Set sample day (read-only) - must be set after reset
    const dayIdField = document.getElementById('gearUnloadDayId');
    if (dayIdField) {
        dayIdField.value = currentRecord.unload_day_id || '';
    }
    const dateDisplay = currentRecord.sdate ? new Date(currentRecord.sdate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : '-';
    document.getElementById('gearUnloadDayIdDisplay').value = dateDisplay;
    
    // Set boats and catch to 0 for new gear unload (will be updated when vessel unloads are added)
    document.getElementById('gearUnloadBoats').value = '0';
    document.getElementById('gearUnloadCatch').value = '0.00';

    document.getElementById('gearUnloadModalTitle').textContent = 'Add Gear Unload';
    const modal = new bootstrap.Modal(document.getElementById('gearUnloadModal'));
    modal.show();
}

async function openEditGearUnloadModal() {
    // Prevent viewers from editing
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to edit data.', 'Access Denied');
        return;
    }

    if (!selectedGearUnloadId) {
        window.toast.error('Please select a gear unload record to edit.');
        return;
    }

    // Find the selected gear unload
    const gearUnload = allGearUnloadData.find(gu => {
        const guId = gu.unload_gr_id || gu.Unload_gr_id || gu.unload_Gr_id;
        return String(guId) === String(selectedGearUnloadId);
    });

    if (!gearUnload) {
        window.toast.error('Gear unload record not found.');
        return;
    }

    // Populate form
    const getUnloadId = (u) => u.unload_gr_id || u.Unload_gr_id || u.unload_Gr_id;
    const unloadGrId = getUnloadId(gearUnload);
    document.getElementById('gearUnloadId').value = unloadGrId;
    
    // Set sample day - use currentRecord if gearUnload doesn't have it
    const dayIdValue = gearUnload.unload_day_id || (currentRecord ? currentRecord.unload_day_id : '');
    const dayIdField = document.getElementById('gearUnloadDayId');
    if (dayIdField) {
        dayIdField.value = dayIdValue;
    }
    const dateDisplay = currentRecord && currentRecord.sdate ? new Date(currentRecord.sdate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : '-';
    document.getElementById('gearUnloadDayIdDisplay').value = dateDisplay;
    document.getElementById('gearUnloadGrId').value = gearUnload.gr_id || '';
    
    // Calculate boats count and catch total from vessel unload records
    const boatsCount = await getVesselUnloadCountForGearUnload(unloadGrId);
    const catchTotal = await getVesselUnloadCatchTotalForGearUnload(unloadGrId);
    
    document.getElementById('gearUnloadBoats').value = boatsCount;
    document.getElementById('gearUnloadCatch').value = catchTotal.toFixed(2);

    document.getElementById('gearUnloadModalTitle').textContent = 'Edit Gear Unload';
    const modal = new bootstrap.Modal(document.getElementById('gearUnloadModal'));
    modal.show();
}

async function saveGearUnload() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('gearUnloadId').value;
    let unloadDayId = document.getElementById('gearUnloadDayId').value;
    
    // Fallback to currentRecord if field is empty (in case form was reset)
    if (!unloadDayId && currentRecord && currentRecord.unload_day_id) {
        unloadDayId = currentRecord.unload_day_id;
    }
    
    const grId = document.getElementById('gearUnloadGrId').value;
    const saveBtn = document.getElementById('saveGearUnloadBtn');

    // Validation
    if (!unloadDayId) {
        window.toast.error('Sample day is required. Please refresh the page and try again.');
        return;
    }

    const gearValidation = Validation.isRequired(grId, 'Gear');
    if (!gearValidation.isValid) {
        window.toast.error(gearValidation.error);
        return;
    }

    // Calculate boats count and catch total from vessel unload records (for existing gear unload)
    let boatsNum = 0;
    let catchNum = 0;
    if (id) {
        boatsNum = await getVesselUnloadCountForGearUnload(id);
        catchNum = await getVesselUnloadCatchTotalForGearUnload(id);
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        unload_day_id: unloadDayId,
        gr_id: parseInt(grId),
        boats: boatsNum,
        catch: catchNum
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .update(payload)
                .eq('unload_gr_id', parseInt(id));
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('gearUnloadModal'));
        modal.hide();
        document.getElementById('gearUnloadForm').reset();
        document.getElementById('gearUnloadId').value = '';
        window.toast.success('Gear unload saved successfully!');

        // Update boats count for the gear unload (if it exists)
        if (id) {
            await updateGearUnloadBoatsCount(id);
        }

        // Reload gear unload data and refresh vessel unload
        if (currentRecord && currentRecord.unload_day_id) {
            await loadGearUnloadData(currentRecord.unload_day_id);
            // Reload vessel unload for selected gear
            if (selectedGearUnloadId) {
                await loadVesselUnloadData(currentRecord.unload_day_id, selectedGearUnloadId);
            }
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.saveGearUnload',
            userMessage: 'Failed to save gear unload'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Gear Unload';
    }
}

function confirmDeleteGearUnload() {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    // Only admins can delete
    if (!ADMIN_ROLES.includes(currentUser.role)) {
        window.toast.error('Only administrators can delete gear unload records.', 'Access Denied');
        return;
    }

    if (!selectedGearUnloadId) {
        window.toast.error('Please select a gear unload record to delete.');
        return;
    }

    gearUnloadIdToDelete = selectedGearUnloadId;
    const modal = new bootstrap.Modal(document.getElementById('deleteGearUnloadModal'));
    modal.show();
}

async function deleteGearUnload() {
    if (!gearUnloadIdToDelete) return;

    const deleteBtn = document.getElementById('confirmDeleteGearUnloadBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
        const { error } = await window._supabase
            .from(TABLES.GEAR_UNLOAD)
            .delete()
            .eq('unload_gr_id', parseInt(gearUnloadIdToDelete));

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteGearUnloadModal'));
        modal.hide();
        gearUnloadIdToDelete = null;
        
        window.toast.success('Gear unload deleted successfully!');

        // Reload gear unload data and reset vessel unload
        if (currentRecord && currentRecord.unload_day_id) {
            await loadGearUnloadData(currentRecord.unload_day_id);
            // Reset vessel unload table
            const vesselTableBody = document.getElementById('vesselUnloadTableBody');
            if (vesselTableBody) {
                vesselTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">Select a gear unload to view vessel unload data.</td></tr>';
            }
            const vesselFooter = document.getElementById('vesselUnloadTableFooter');
            if (vesselFooter) vesselFooter.style.display = 'none';
            selectedGearUnloadId = null;
        }

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.deleteGearUnload',
            userMessage: 'Failed to delete gear unload'
        });
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

function handleGearRowEdit(unloadGrId) {
    // Set selected gear unload ID based on clicked row and open edit modal
    selectedGearUnloadId = unloadGrId;
    openEditGearUnloadModal();
}

function handleGearRowDelete(unloadGrId) {
    // Set selected gear unload ID based on clicked row and open delete confirmation
    selectedGearUnloadId = unloadGrId;
    confirmDeleteGearUnload();
}

function setupEventListeners() {
    // Gear Unload buttons
    const addGearBtn = document.getElementById('addGearUnloadBtn');
    const editGearBtn = document.getElementById('editGearUnloadBtn');
    const deleteGearBtn = document.getElementById('deleteGearUnloadBtn');
    const saveGearBtn = document.getElementById('saveGearUnloadBtn');
    const confirmDeleteGearBtn = document.getElementById('confirmDeleteGearUnloadBtn');
    const saveVesselUnloadQuickBtn = document.getElementById('saveVesselUnloadQuickBtn');
    const vesselUnloadGearSelect = document.getElementById('unloadGrId');

    if (addGearBtn) {
        addGearBtn.addEventListener('click', openAddGearUnloadModal);
    }

    if (editGearBtn) {
        editGearBtn.addEventListener('click', openEditGearUnloadModal);
    }

    if (deleteGearBtn) {
        deleteGearBtn.addEventListener('click', confirmDeleteGearUnload);
    }

    if (saveGearBtn) {
        saveGearBtn.addEventListener('click', saveGearUnload);
    }

    if (confirmDeleteGearBtn) {
        confirmDeleteGearBtn.addEventListener('click', deleteGearUnload);
    }

    if (saveVesselUnloadQuickBtn) {
        saveVesselUnloadQuickBtn.addEventListener('click', saveVesselUnloadQuick);
    }

    if (vesselUnloadGearSelect) {
        vesselUnloadGearSelect.addEventListener('change', async function() {
            await handleGearUnloadChange(this.value);
        });
    }

    // Reset gear unload modal on close
    const gearUnloadModal = document.getElementById('gearUnloadModal');
    if (gearUnloadModal) {
        gearUnloadModal.addEventListener('hidden.bs.modal', () => {
            document.getElementById('gearUnloadForm').reset();
            document.getElementById('gearUnloadId').value = '';
            // Don't clear gearUnloadDayId - it will be set when modal opens
            document.getElementById('gearUnloadModalTitle').textContent = 'Add Gear Unload';
        });
    }
    // Reset vessel unload quick modal on close
    const vesselUnloadModal = document.getElementById('vesselUnloadModal');
    if (vesselUnloadModal) {
        vesselUnloadModal.addEventListener('hidden.bs.modal', () => {
            const form = document.getElementById('vesselUnloadQuickForm');
            if (form) form.reset();
            resetFishingEffortFields();
        });
    }
    // Edit button - open modal
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }

    // Edit modal - region change handler
    const editRegionSelect = document.getElementById('editRegion');
    if (editRegionSelect) {
        editRegionSelect.addEventListener('change', function() {
            updateEditDependencies();
        });
    }

    // Edit modal - date and landing center change handlers for sample day calculation
    const editDateInput = document.getElementById('editDate');
    if (editDateInput) {
        editDateInput.addEventListener('change', calculateSampleDay);
    }

    const editLCSelect = document.getElementById('editLandingCenter');
    if (editLCSelect) {
        editLCSelect.addEventListener('change', calculateSampleDay);
    }

    // Save button
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveEdit);
    }

    // Delete button
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
            modal.show();
        });
    }

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

// Edit and save functions removed since form container was removed
// Edit functionality redirects to data entry page

async function confirmDelete() {
    // Only admins can delete (encoders and viewers cannot delete)
    if (!ADMIN_ROLES.includes(currentUser.role)) {
        window.toast.error('Only administrators can delete records.', 'Access Denied');
        return;
    }

    if (!currentRecord || !currentRecord.unload_day_id) {
        window.toast.error('No record to delete.');
        return;
    }

    const id = currentRecord.unload_day_id;

    try {
        const { error } = await window._supabase
            .from(TABLES.SAMPLE_DAY)
            .delete()
            .eq('unload_day_id', id);

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();

        window.toast.success('Record deleted successfully');
        
        // Redirect back to data entry page
        setTimeout(() => {
            window.location.href = 'data-entry.html';
        }, 1000);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'SampleDayDetail.confirmDelete',
            userMessage: 'Failed to delete record'
        });
    }
}

