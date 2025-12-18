/**
 * Vessel Management Logic
 * Handles CRUD operations for dbo_vessel
 * 
 * Phase 2: Complete implementation with error handler, constants, and validation
 */

let allVessels = [];
let filteredVessels = [];
let allGears = [];
let allRegions = [];
let currentUser = null;
let vesselIdToDelete = null;

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

    // Load User Profile
    currentUser = await getUserProfile();
    if (!currentUser) {
        ErrorHandler.handle(new Error('Failed to load user profile'), {
            context: 'Vessel.DOMContentLoaded',
            userMessage: 'Failed to load permissions.'
        });
        return;
    }

    // Apply UI Restrictions
    if (currentUser.role === ROLES.VIEWER) {
        const addBtn = document.querySelector('button[data-bs-target="#addModal"]');
        if (addBtn) addBtn.style.display = 'none';
    }

    // Initialize
    try {
        // Wait a bit to ensure DOM is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await loadGears();
        await loadRegions();
        await loadVessels();
        setupEventListeners();
        setupGRTCalculation();
    } catch (error) {
        console.error('Error initializing vessel page:', error);
        ErrorHandler.handle(error, {
            context: 'Vessel.DOMContentLoaded',
            userMessage: 'Failed to initialize vessel page. Please refresh.'
        });
    }
});

// ----------------------------------------------------------------------------
// Data Loading
// ----------------------------------------------------------------------------

async function loadGears() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.GEAR)
            .select('*')
            .order('gear_desc', { ascending: true });

        if (error) throw error;

        allGears = data || [];
        populateGearDropdowns();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Vessel.loadGears',
            userMessage: 'Failed to load gear data'
        });
    }
}

function populateGearDropdowns() {
    const select = document.getElementById('grId');
    const filterSelect = document.getElementById('filterGear');

    if (select) {
        select.innerHTML = '<option value="" disabled selected>Select Gear...</option>';
        allGears.forEach(gear => {
            const gearId = gear.gr_id || gear.Gr_id || gear.gr_Id;
            const option = document.createElement('option');
            option.value = gearId;
            option.textContent = Validation.escapeHtml(gear.gear_desc || '');
            select.appendChild(option);
        });
    }

    if (filterSelect) {
        // Store current value to restore it after repopulating (prevents triggering filter)
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Gears</option>';
        allGears.forEach(gear => {
            const gearId = gear.gr_id || gear.Gr_id || gear.gr_Id;
            const option = document.createElement('option');
            option.value = gearId;
            option.textContent = Validation.escapeHtml(gear.gear_desc || '');
            filterSelect.appendChild(option);
        });
        // Restore the value (if it was empty, it stays empty - no filter applied)
        filterSelect.value = currentValue || '';
    }
}

async function loadRegions() {
    try {
        let query = window._supabase
            .from(TABLES.REGION)
            .select('*')
            .order('region_name', { ascending: true });

        // RBAC: Filter regions - Only encoder and viewer are limited to their region
        // Superadmin and Admin can access all regions
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        allRegions = data || [];
        populateRegionDropdowns();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Vessel.loadRegions',
            userMessage: 'Failed to load region data'
        });
    }
}

function populateRegionDropdowns() {
    const select = document.getElementById('regionId');
    const filterSelect = document.getElementById('filterRegion');

    if (select) {
        select.innerHTML = '<option value="" disabled selected>Select Region...</option>';
        allRegions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.region_id;
            option.textContent = Validation.escapeHtml(region.region_name || '');
            select.appendChild(option);
        });
    }

    if (filterSelect) {
        // Store current value to restore it after repopulating (prevents triggering filter)
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Regions</option>';
        allRegions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.region_id;
            option.textContent = Validation.escapeHtml(region.region_name || '');
            filterSelect.appendChild(option);
        });
        // Restore the value (if it was empty, it stays empty - no filter applied)
        filterSelect.value = currentValue || '';
    }
}

async function loadVessels() {
    const tableBody = document.getElementById('vesselTableBody');
    if (!tableBody) {
        console.error('vesselTableBody element not found');
        if (window.ErrorHandler) {
            ErrorHandler.handle(new Error('Table body element not found'), {
                context: 'Vessel.loadVessels',
                userMessage: 'Page structure error. Please refresh the page.'
            });
        }
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="10" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        // Check if Supabase is available
        if (!window._supabase) {
            throw new Error('Supabase client not initialized');
        }

        // Check if TABLES constant is available
        if (!TABLES || !TABLES.VESSEL) {
            throw new Error('TABLES constant not available');
        }

        // Check if currentUser is available
        if (!currentUser) {
            throw new Error('Current user not loaded');
        }

        // Load vessels with related data
        console.log('Loading vessels from table:', TABLES.VESSEL);
        console.log('Current user role:', currentUser.role);
        console.log('Current user region_id:', currentUser.region_id);
        
        const { data: vesselsData, error } = await window._supabase
            .from(TABLES.VESSEL)
            .select('*')
            .order('vesselname', { ascending: true });

        if (error) {
            console.error('Supabase error loading vessels:', error);
            throw error;
        }

        console.log('Vessels loaded from database:', vesselsData?.length || 0, 'records');
        console.log('Raw vessels data:', vesselsData);

        // RBAC: Filter vessels - Only encoder and viewer are limited to their region
        // Superadmin and Admin can access all vessels
        let filteredVessels = vesselsData || [];
        const isAdmin = ADMIN_ROLES.includes(currentUser.role);
        console.log('Is admin role?', isAdmin);
        
        if (!isAdmin) {
            const beforeFilter = filteredVessels.length;
            filteredVessels = filteredVessels.filter(v => {
                const matches = String(v.region_id) === String(currentUser.region_id);
                if (!matches) {
                    console.log('Vessel filtered out - vessel region_id:', v.region_id, 'user region_id:', currentUser.region_id);
                }
                return matches;
            });
            console.log('After RBAC filter:', filteredVessels.length, 'records (was', beforeFilter, ')');
        } else {
            console.log('Admin role - showing all vessels without region filter');
        }

        // Fetch gear and region details
        const gearIds = new Set();
        const regionIds = new Set();
        filteredVessels.forEach(vessel => {
            if (vessel.gr_id) gearIds.add(vessel.gr_id);
            if (vessel.region_id) regionIds.add(vessel.region_id);
        });

        // Fetch gears
        let gearsMap = {};
        if (gearIds.size > 0) {
            const { data: gearsData, error: gearsError } = await window._supabase
                .from(TABLES.GEAR)
                .select('*')
                .in('gr_id', Array.from(gearIds));

            if (gearsError) throw gearsError;

            gearsData.forEach(gear => {
                const gearId = gear.gr_id || gear.Gr_id || gear.gr_Id;
                gearsMap[gearId] = gear;
            });
        }

        // Fetch regions
        let regionsMap = {};
        if (regionIds.size > 0) {
            const { data: regionsData, error: regionsError } = await window._supabase
                .from(TABLES.REGION)
                .select('*')
                .in('region_id', Array.from(regionIds));

            if (regionsError) throw regionsError;

            regionsData.forEach(region => {
                regionsMap[region.region_id] = region;
            });
        }

        // Combine vessel data with gear and region descriptions
        const data = filteredVessels.map(vessel => {
            const vesselWithDetails = { ...vessel };
            
            // Add gear description
            if (vessel.gr_id && gearsMap[vessel.gr_id]) {
                vesselWithDetails.dbo_gear = {
                    gear_desc: gearsMap[vessel.gr_id].gear_desc
                };
            }
            
            // Add region name
            if (vessel.region_id && regionsMap[vessel.region_id]) {
                vesselWithDetails.dbo_region = {
                    region_name: regionsMap[vessel.region_id].region_name
                };
            }
            
            return vesselWithDetails;
        });

        allVessels = data;
        // Set filteredVessels to all vessels initially (no filters applied yet)
        // Use spread operator to create a new array reference
        filteredVessels = data ? [...data] : [];
        currentPage = 1;
        
        console.log('✅ Vessels loaded and processed');
        console.log('  - allVessels:', allVessels.length, 'records');
        console.log('  - filteredVessels:', filteredVessels.length, 'records');
        
        if (filteredVessels.length === 0 && vesselsData && vesselsData.length > 0) {
            console.warn('⚠️ All vessels were filtered out by RBAC!');
            console.warn('Original count from database:', vesselsData.length);
            console.warn('User role:', currentUser.role);
            console.warn('User region_id:', currentUser.region_id, '(type:', typeof currentUser.region_id, ')');
            console.warn('Vessel region_ids in database:', vesselsData.map(v => ({ id: v.boat_id, region_id: v.region_id, type: typeof v.region_id })));
        } else if (filteredVessels.length === 0 && (!vesselsData || vesselsData.length === 0)) {
            console.warn('⚠️ No vessels found in database table:', TABLES.VESSEL);
        }
        
        // Render table with all data (no filters applied initially)
        // Do NOT call filterVessels() here - it will filter based on empty filter values
        console.log('Rendering table with', filteredVessels.length, 'vessels');
        
        // Double-check that filteredVessels has data before rendering
        if (filteredVessels.length === 0 && allVessels.length > 0) {
            console.warn('⚠️ filteredVessels is empty but allVessels has data - resetting filteredVessels');
            filteredVessels = [...allVessels];
        }
        
        renderTable();

    } catch (error) {
        console.error('Error in loadVessels:', error);
        if (tableBody) {
            const errorMsg = error.message || 'Unknown error';
            tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-danger py-4">Error loading data. Please refresh the page.<br><small>' + Validation.escapeHtml(errorMsg) + '</small></td></tr>';
        }
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, {
                context: 'Vessel.loadVessels',
                userMessage: 'Failed to load vessel data: ' + (error.message || 'Unknown error')
            });
        }
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function renderTable() {
    const tableBody = document.getElementById('vesselTableBody');
    if (!tableBody) {
        console.error('vesselTableBody element not found in renderTable');
        return;
    }
    
    console.log('renderTable called - filteredVessels.length:', filteredVessels.length);
    console.log('renderTable - allVessels.length:', allVessels.length);
    
    // Safety check: if filteredVessels is empty but allVessels has data, reset filteredVessels
    if (filteredVessels.length === 0 && allVessels.length > 0) {
        console.warn('⚠️ filteredVessels is empty but allVessels has data - resetting filteredVessels to show all data');
        filteredVessels = [...allVessels];
    }
    
    const totalRows = filteredVessels.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        console.log('No vessels to display - showing empty state');
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted">No vessel records found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredVessels.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(vessel => {
        const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
        const vesselId = getVesselId(vessel);

        // Get gear and region descriptions
        const gearDesc = vessel.dbo_gear ? Validation.escapeHtml(vessel.dbo_gear.gear_desc) : '<span class="text-muted">-</span>';
        const regionName = vessel.dbo_region ? Validation.escapeHtml(vessel.dbo_region.region_name) : '<span class="text-muted">-</span>';

        // Format numbers
        const length = vessel.length ? parseFloat(vessel.length).toFixed(2) : '-';
        const width = vessel.width ? parseFloat(vessel.width).toFixed(2) : '-';
        const depth = vessel.depth ? parseFloat(vessel.depth).toFixed(2) : '-';
        const grt = vessel.grt ? parseFloat(vessel.grt).toFixed(2) : '-';
        const hpw = vessel.hpw ? parseFloat(vessel.hpw).toFixed(2) : '-';

        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${vesselId}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="confirmDelete('${vesselId}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(vessel.vesselname || '')}</td>
                <td>${gearDesc}</td>
                <td>${regionName}</td>
                <td>${length}</td>
                <td>${width}</td>
                <td>${depth}</td>
                <td>${grt}</td>
                <td>${hpw}</td>
                <td>${Validation.escapeHtml(vessel.engine_type || '-')}</td>
                <td class="text-end">${actions}</td>
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
        if (total === 0) {
            rowsInfo.textContent = 'of 0 entries';
        } else {
            rowsInfo.textContent = `Showing ${start} to ${end} of ${total} entries`;
        }
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
// GRT Calculation
// ----------------------------------------------------------------------------

function setupGRTCalculation() {
    const lengthInput = document.getElementById('length');
    const widthInput = document.getElementById('width');
    const depthInput = document.getElementById('depth');
    const grtInput = document.getElementById('grt');

    function calculateGRT() {
        const length = parseFloat(lengthInput.value) || 0;
        const width = parseFloat(widthInput.value) || 0;
        const depth = parseFloat(depthInput.value) || 0;

        if (length > 0 && width > 0 && depth > 0) {
            // Formula: (Length × Width × Depth × 0.70) ÷ 2.83
            const grt = (length * width * depth * 0.70) / 2.83;
            grtInput.value = grt.toFixed(2);
        } else {
            grtInput.value = '';
        }
    }

    if (lengthInput) lengthInput.addEventListener('input', calculateGRT);
    if (widthInput) widthInput.addEventListener('input', calculateGRT);
    if (depthInput) depthInput.addEventListener('input', calculateGRT);
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

function openEditModal(id) {
    // Prevent viewers from editing
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to edit data.', 'Access Denied');
        return;
    }

    const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
    const vessel = allVessels.find(item => getVesselId(item) == id);
    if (!vessel) return;

    document.getElementById('vesselId').value = getVesselId(vessel);
    document.getElementById('vesselName').value = vessel.vesselname || '';
    document.getElementById('grId').value = vessel.gr_id || '';
    document.getElementById('regionId').value = vessel.region_id || '';
    document.getElementById('length').value = vessel.length || '';
    document.getElementById('width').value = vessel.width || '';
    document.getElementById('depth').value = vessel.depth || '';
    document.getElementById('grt').value = vessel.grt ? parseFloat(vessel.grt).toFixed(2) : '';
    document.getElementById('hpw').value = vessel.hpw || '';
    document.getElementById('engineType').value = vessel.engine_type || '';

    document.getElementById('modalTitle').textContent = 'Edit Vessel';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveVessel() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('vesselId').value;
    const vesselName = document.getElementById('vesselName').value.trim();
    const grId = document.getElementById('grId').value;
    const regionId = document.getElementById('regionId').value;
    const length = document.getElementById('length').value;
    const width = document.getElementById('width').value;
    const depth = document.getElementById('depth').value;
    const grt = document.getElementById('grt').value;
    const hpw = document.getElementById('hpw').value;
    const engineType = document.getElementById('engineType').value.trim();
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const nameValidation = Validation.isRequired(vesselName, 'Vessel Name');
    if (!nameValidation.isValid) {
        window.toast.error(nameValidation.error);
        return;
    }

    const gearValidation = Validation.isRequired(grId, 'Gear');
    if (!gearValidation.isValid) {
        window.toast.error(gearValidation.error);
        return;
    }

    const regionValidation = Validation.isRequired(regionId, 'Region');
    if (!regionValidation.isValid) {
        window.toast.error(regionValidation.error);
        return;
    }

    const lengthValidation = Validation.isRequired(length, 'Length');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    const widthValidation = Validation.isRequired(width, 'Width');
    if (!widthValidation.isValid) {
        window.toast.error(widthValidation.error);
        return;
    }

    const depthValidation = Validation.isRequired(depth, 'Depth');
    if (!depthValidation.isValid) {
        window.toast.error(depthValidation.error);
        return;
    }

    // Numeric validation
    const lengthNum = parseFloat(length);
    const widthNum = parseFloat(width);
    const depthNum = parseFloat(depth);

    if (isNaN(lengthNum) || lengthNum <= 0) {
        window.toast.error('Length must be a positive number.');
        return;
    }

    if (isNaN(widthNum) || widthNum <= 0) {
        window.toast.error('Width must be a positive number.');
        return;
    }

    if (isNaN(depthNum) || depthNum <= 0) {
        window.toast.error('Depth must be a positive number.');
        return;
    }

    // Length validation
    const nameLengthValidation = Validation.validateLength(vesselName, 1, 255, 'Vessel Name');
    if (!nameLengthValidation.isValid) {
        window.toast.error(nameLengthValidation.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    // Calculate GRT if not already calculated
    let calculatedGRT = grt;
    if (!calculatedGRT || calculatedGRT === '') {
        calculatedGRT = (lengthNum * widthNum * depthNum * 0.70) / 2.83;
    }

    const payload = {
        vesselname: vesselName,
        gr_id: parseInt(grId),
        region_id: parseInt(regionId),
        length: lengthNum,
        width: widthNum,
        depth: depthNum,
        grt: parseFloat(calculatedGRT),
        hpw: hpw ? parseFloat(hpw) : null,
        engine_type: engineType || null
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.VESSEL)
                .update(payload)
                .eq('boat_id', parseInt(id));
        } else {
            // Insert - use .select() to get the inserted data back
            result = await window._supabase
                .from(TABLES.VESSEL)
                .insert([payload])
                .select()
                .single();
        }

        if (result.error) throw result.error;

        // Get the saved vessel data
        let savedVessel;
        if (id) {
            // Update - fetch the updated vessel
            const { data: updatedData, error: fetchError } = await window._supabase
                .from(TABLES.VESSEL)
                .select('*')
                .eq('boat_id', parseInt(id))
                .single();
            
            if (fetchError) throw fetchError;
            savedVessel = updatedData;
        } else {
            // Insert - get the inserted data from result
            savedVessel = result.data;
            if (!savedVessel) {
                throw new Error('Failed to get inserted vessel data');
            }
        }

        // Fetch gear and region details for the saved vessel
        const gearData = allGears.find(g => {
            const gearId = g.gr_id || g.Gr_id || g.gr_Id;
            return String(gearId) === String(savedVessel.gr_id);
        });
        
        const regionData = allRegions.find(r => String(r.region_id) === String(savedVessel.region_id));

        // Add gear and region descriptions to vessel object
        const vesselWithDetails = { ...savedVessel };
        if (gearData) {
            vesselWithDetails.dbo_gear = {
                gear_desc: gearData.gear_desc
            };
        }
        if (regionData) {
            vesselWithDetails.dbo_region = {
                region_name: regionData.region_name
            };
        }

        // Update arrays immediately
        if (id) {
            // Update existing vessel
            const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
            const index = allVessels.findIndex(v => getVesselId(v) == id);
            if (index !== -1) {
                allVessels[index] = vesselWithDetails;
            } else {
                allVessels.push(vesselWithDetails);
            }
        } else {
            // Add new vessel
            allVessels.push(vesselWithDetails);
            // Sort by vesselname
            allVessels.sort((a, b) => {
                const nameA = (a.vesselname || '').toLowerCase();
                const nameB = (b.vesselname || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        // Update filteredVessels - check if vessel matches current filters
        const searchInput = document.getElementById('searchInput');
        const filterRegionSelect = document.getElementById('filterRegion');
        const filterGearSelect = document.getElementById('filterGear');
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterRegion = filterRegionSelect ? filterRegionSelect.value : '';
        const filterGear = filterGearSelect ? filterGearSelect.value : '';

        const matchesSearch = !searchTerm ||
            (vesselWithDetails.vesselname && vesselWithDetails.vesselname.toLowerCase().includes(searchTerm)) ||
            (vesselWithDetails.dbo_gear && vesselWithDetails.dbo_gear.gear_desc && vesselWithDetails.dbo_gear.gear_desc.toLowerCase().includes(searchTerm)) ||
            (vesselWithDetails.dbo_region && vesselWithDetails.dbo_region.region_name && vesselWithDetails.dbo_region.region_name.toLowerCase().includes(searchTerm)) ||
            (vesselWithDetails.engine_type && vesselWithDetails.engine_type.toLowerCase().includes(searchTerm));
        
        const matchesRegion = !filterRegion || String(vesselWithDetails.region_id) === String(filterRegion);
        const matchesGear = !filterGear || String(vesselWithDetails.gr_id) === String(filterGear);
        const matchesFilters = matchesSearch && matchesRegion && matchesGear;

        if (id) {
            // Update existing in filteredVessels
            const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
            const filteredIndex = filteredVessels.findIndex(v => getVesselId(v) == id);
            if (filteredIndex !== -1) {
                if (matchesFilters) {
                    filteredVessels[filteredIndex] = vesselWithDetails;
                } else {
                    // Remove from filtered if it no longer matches filters
                    filteredVessels.splice(filteredIndex, 1);
                }
            } else if (matchesFilters) {
                // Add to filtered if it matches filters
                filteredVessels.push(vesselWithDetails);
                filteredVessels.sort((a, b) => {
                    const nameA = (a.vesselname || '').toLowerCase();
                    const nameB = (b.vesselname || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            }
        } else {
            // Add new to filteredVessels if it matches filters
            if (matchesFilters) {
                filteredVessels.push(vesselWithDetails);
                filteredVessels.sort((a, b) => {
                    const nameA = (a.vesselname || '').toLowerCase();
                    const nameB = (b.vesselname || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            }
        }

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('vesselForm').reset();
        document.getElementById('vesselId').value = '';
        document.getElementById('grt').value = '';
        window.toast.success('Vessel saved successfully!');

        // Find the page where the vessel appears (for new vessels or if filters changed)
        if (matchesFilters) {
            const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
            const vesselIndex = filteredVessels.findIndex(v => getVesselId(v) === getVesselId(vesselWithDetails));
            if (vesselIndex !== -1) {
                const pageForVessel = Math.floor(vesselIndex / rowsPerPage) + 1;
                currentPage = pageForVessel;
            }
        }

        // Immediately update the table
        renderTable();
        
        // Scroll to top of table to show the updated/new vessel
        const contentCard = document.querySelector('.content-card');
        if (contentCard) {
            contentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Optionally reload in background to ensure data consistency (non-blocking)
        // loadVessels().catch(err => console.error('Background reload failed:', err));

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Vessel.saveVessel',
            userMessage: 'Failed to save vessel'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Vessel';
    }
}

function confirmDelete(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    vesselIdToDelete = id;
    const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
    const vessel = allVessels.find(item => getVesselId(item) == id);
    
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function deleteVessel() {
    if (!vesselIdToDelete) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
        const { error } = await window._supabase
            .from(TABLES.VESSEL)
            .delete()
            .eq('boat_id', parseInt(vesselIdToDelete));

        if (error) throw error;

        // Remove from arrays immediately
        const getVesselId = (v) => v.boat_id || v.Boat_id || v.boat_Id;
        const vesselId = parseInt(vesselIdToDelete);
        
        allVessels = allVessels.filter(v => getVesselId(v) !== vesselId);
        filteredVessels = filteredVessels.filter(v => getVesselId(v) !== vesselId);

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        window.toast.success('Vessel deleted successfully.');
        vesselIdToDelete = null;

        // Immediately update the table
        renderTable();
        
        // Optionally reload in background to ensure data consistency (non-blocking)
        // loadVessels().catch(err => console.error('Background reload failed:', err));

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Vessel.deleteVessel',
            userMessage: 'Failed to delete vessel'
        });
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// ----------------------------------------------------------------------------
// Filtering & Export
// ----------------------------------------------------------------------------

function filterVessels() {
    // Don't filter if allVessels is empty (data not loaded yet)
    if (!allVessels || allVessels.length === 0) {
        console.log('filterVessels called but allVessels is empty, skipping filter');
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const filterRegionSelect = document.getElementById('filterRegion');
    const filterGearSelect = document.getElementById('filterGear');

    // Get filter values, defaulting to empty string if elements don't exist
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filterRegion = filterRegionSelect ? filterRegionSelect.value : '';
    const filterGear = filterGearSelect ? filterGearSelect.value : '';

    console.log('Filtering vessels - search:', searchTerm || '(empty)', 'region:', filterRegion || '(all)', 'gear:', filterGear || '(all)');
    console.log('allVessels count before filter:', allVessels.length);

    // Filter vessels based on search and filter criteria
    filteredVessels = allVessels.filter(vessel => {
        // Search filter - matches if search term is empty OR vessel matches search
        const matchesSearch = !searchTerm ||
            (vessel.vesselname && vessel.vesselname.toLowerCase().includes(searchTerm)) ||
            (vessel.dbo_gear && vessel.dbo_gear.gear_desc && vessel.dbo_gear.gear_desc.toLowerCase().includes(searchTerm)) ||
            (vessel.dbo_region && vessel.dbo_region.region_name && vessel.dbo_region.region_name.toLowerCase().includes(searchTerm)) ||
            (vessel.engine_type && vessel.engine_type.toLowerCase().includes(searchTerm));

        // Region filter - matches if no region selected OR vessel matches selected region
        const matchesRegion = !filterRegion || String(vessel.region_id) === String(filterRegion);
        
        // Gear filter - matches if no gear selected OR vessel matches selected gear
        const matchesGear = !filterGear || String(vessel.gr_id) === String(filterGear);

        return matchesSearch && matchesRegion && matchesGear;
    });

    console.log('After filtering:', filteredVessels.length, 'vessels match');
    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredVessels;

    // Create CSV content
    const headers = ['Vessel Name', 'Gear', 'Region', 'Length (m)', 'Width (m)', 'Depth (m)', 'GRT', 'HPW', 'Engine Type'];
    const rows = dataToExport.map(vessel => [
        Validation.escapeHtml(vessel.vesselname || ''),
        vessel.dbo_gear ? Validation.escapeHtml(vessel.dbo_gear.gear_desc) : '-',
        vessel.dbo_region ? Validation.escapeHtml(vessel.dbo_region.region_name) : '-',
        vessel.length ? parseFloat(vessel.length).toFixed(2) : '-',
        vessel.width ? parseFloat(vessel.width).toFixed(2) : '-',
        vessel.depth ? parseFloat(vessel.depth).toFixed(2) : '-',
        vessel.grt ? parseFloat(vessel.grt).toFixed(2) : '-',
        vessel.hpw ? parseFloat(vessel.hpw).toFixed(2) : '-',
        Validation.escapeHtml(vessel.engine_type || '-')
    ]);

    // Convert to CSV format
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vessels_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Vessels exported successfully!', 'Export Complete');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Save Button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveVessel);
    }

    // Delete Confirmation Button
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteVessel);
    }

    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterVessels);
    }

    // Filter dropdowns
    const filterRegion = document.getElementById('filterRegion');
    if (filterRegion) {
        filterRegion.addEventListener('change', filterVessels);
    }

    const filterGear = document.getElementById('filterGear');
    if (filterGear) {
        filterGear.addEventListener('change', filterVessels);
    }

    // Rows per page
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', (e) => {
            rowsPerPage = parseInt(e.target.value);
            currentPage = 1;
            renderTable();
        });
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    // Add Vessel button - reset form when opening
    const addVesselBtn = document.getElementById('addVesselBtn');
    if (addVesselBtn) {
        addVesselBtn.addEventListener('click', () => {
            const vesselForm = document.getElementById('vesselForm');
            const vesselId = document.getElementById('vesselId');
            const grt = document.getElementById('grt');
            const modalTitle = document.getElementById('modalTitle');
            
            if (vesselForm) vesselForm.reset();
            if (vesselId) vesselId.value = '';
            if (grt) grt.value = '';
            if (modalTitle) modalTitle.textContent = 'Add Vessel';
        });
    }

    // Reset modal on close
    const modalEl = document.getElementById('addModal');
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', () => {
            const vesselForm = document.getElementById('vesselForm');
            const vesselId = document.getElementById('vesselId');
            const grt = document.getElementById('grt');
            const modalTitle = document.getElementById('modalTitle');
            
            if (vesselForm) vesselForm.reset();
            if (vesselId) vesselId.value = '';
            if (grt) grt.value = '';
            if (modalTitle) modalTitle.textContent = 'Add Vessel';
        });

        // Prevent viewers from accessing modal
        modalEl.addEventListener('show.bs.modal', () => {
            if (currentUser && currentUser.role === ROLES.VIEWER) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                if (window.toast) {
                    window.toast.error('Viewers do not have permission to add or edit data.', 'Access Denied');
                }
            }
        });
    }
}

