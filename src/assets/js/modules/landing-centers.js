/**
 * Landing Center Management Logic
 * Handles CRUD operations for dbo_landing_center
 * 
 * Phase 1: Applied error handler, constants, and validation
 */

let allLandingCenters = [];
let filteredLandingCenters = [];
let allRegions = [];
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

    // Load User Profile for RBAC
    currentUser = await getUserProfile();
    if (!currentUser) {
        window.toast.error('Failed to load user permissions.');
        return;
    }

    // Apply UI Restrictions (Hide Add Button for Viewers)
    if (currentUser.role === ROLES.VIEWER) {
        const addBtn = document.querySelector('button[data-bs-target="#addModal"]');
        if (addBtn) addBtn.style.display = 'none';
    }

    // Initialize
    await loadRegions();
    await loadLandingCenters();
    setupEventListeners();
});

// ----------------------------------------------------------------------------
// Data Loading
// ----------------------------------------------------------------------------

async function loadRegions() {
    try {
        let query = window._supabase.from(TABLES.REGION).select('*').order('sort_order', { ascending: true });

        // RBAC: Filter regions - Only encoder and viewer are limited to their region
        // Superadmin and Admin can access all regions
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        allRegions = data;
        populateRegionDropdown(data);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'LandingCenters.loadRegions',
            userMessage: 'Failed to load regions'
        });
    }
}

async function loadLandingCenters() {
    const tableBody = document.getElementById('lcTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        let query = window._supabase
            .from(TABLES.LANDING_CENTER)
            .select(`
                land_ctr_id,
                landing_center,
                lc_type,
                region_id,
                dbo_region (
                   region_name 
                )
            `)
            .order('created_at', { ascending: false });

        // RBAC: Filter data - Only encoder and viewer are limited to their region
        // Superadmin and Admin can access all data
        if (!ADMIN_ROLES.includes(currentUser.role)) {
            query = query.eq('region_id', currentUser.region_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        allLandingCenters = data;
        filteredLandingCenters = data;
        currentPage = 1;
        renderTable();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'LandingCenters.loadLandingCenters',
            userMessage: 'Failed to load landing centers'
        });
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function populateRegionDropdown(regions) {
    const select = document.getElementById('lcRegion');
    select.innerHTML = '<option value="" disabled selected>Select Region...</option>';

    regions.forEach(reg => {
        const option = document.createElement('option');
        option.value = reg.region_id;
        option.textContent = reg.region_name;
        select.appendChild(option);
    });

    // Auto-select if only 1 option (Role Restricted)
    if (regions.length === 1) {
        select.value = regions[0].region_id;
    }

    // Populate filter dropdown
    const filterSelect = document.getElementById('filterRegion');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Regions</option>';
        regions.forEach(reg => {
            const option = document.createElement('option');
            option.value = reg.region_id;
            option.textContent = reg.region_name;
            filterSelect.appendChild(option);
        });
    }
}

function renderTable() {
    const tableBody = document.getElementById('lcTableBody');
    const totalRows = filteredLandingCenters.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">No landing centers found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredLandingCenters.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(lc => {
        const regionName = lc.dbo_region ? Validation.escapeHtml(lc.dbo_region.region_name) : '<span class="text-muted">Unknown</span>';

        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${lc.land_ctr_id}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="deleteLandingCenter('${lc.land_ctr_id}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(lc.landing_center)}</td>
                <td><span class="badge bg-light text-dark border">${regionName}</span></td>
                <td>${Validation.escapeHtml(lc.lc_type || '-')}</td>
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
// Actions
// ----------------------------------------------------------------------------

function openEditModal(id) {
    // Prevent viewers from editing
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to edit data.', 'Access Denied');
        return;
    }

    const lc = allLandingCenters.find(item => item.land_ctr_id === id);
    if (!lc) return;

    document.getElementById('lcId').value = lc.land_ctr_id;
    document.getElementById('lcName').value = lc.landing_center;
    document.getElementById('lcRegion').value = lc.region_id;
    document.getElementById('lcType').value = lc.lc_type || 'Traditional';

    document.getElementById('modalTitle').textContent = 'Edit Landing Center';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveLandingCenter() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('lcId').value;
    const name = document.getElementById('lcName').value.trim();
    const regionId = document.getElementById('lcRegion').value;
    const type = document.getElementById('lcType').value;
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const nameValidation = Validation.isRequired(name, 'Landing Center Name');
    const regionValidation = Validation.isRequired(regionId, 'Region');

    if (!nameValidation.isValid || !regionValidation.isValid) {
        window.toast.error(nameValidation.error || regionValidation.error || 'Please fill in all required fields.');
        return;
    }

    // Additional validation
    const lengthValidation = Validation.validateLength(name, 1, 255, 'Landing Center Name');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        landing_center: name,
        region_id: parseInt(regionId),
        lc_type: type
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.LANDING_CENTER)
                .update(payload)
                .eq('land_ctr_id', id);
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.LANDING_CENTER)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('lcForm').reset();
        document.getElementById('lcId').value = '';
        window.toast.success('Landing center saved successfully!');

        await loadLandingCenters();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'LandingCenters.saveLandingCenter',
            userMessage: 'Failed to save landing center'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Landing Center';
    }
}

async function deleteLandingCenter(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    if (!confirm('Are you sure you want to delete this landing center? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await window._supabase
            .from(TABLES.LANDING_CENTER)
            .delete()
            .eq('land_ctr_id', id);

        if (error) throw error;

        window.toast.success('Landing center deleted successfully.');
        await loadLandingCenters();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'LandingCenters.deleteLandingCenter',
            userMessage: 'Failed to delete landing center'
        });
    }
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function filterLandingCenters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const regionFilter = document.getElementById('filterRegion').value;
    const typeFilter = document.getElementById('filterType').value;

    filteredLandingCenters = allLandingCenters.filter(lc => {
        // Search filter
        const matchesSearch = !searchTerm ||
            lc.landing_center.toLowerCase().includes(searchTerm) ||
            (lc.dbo_region && lc.dbo_region.region_name.toLowerCase().includes(searchTerm));

        // Region filter
        const matchesRegion = !regionFilter || lc.region_id === parseInt(regionFilter);

        // Type filter
        const matchesType = !typeFilter || lc.lc_type === typeFilter;

        return matchesSearch && matchesRegion && matchesType;
    });

    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredLandingCenters;

    // Create CSV content
    const headers = ['Landing Center Name', 'Region', 'Type'];
    const rows = dataToExport.map(lc => [
        Validation.escapeHtml(lc.landing_center),
        lc.dbo_region ? Validation.escapeHtml(lc.dbo_region.region_name) : 'Unknown',
        Validation.escapeHtml(lc.lc_type || '-')
    ]);

    // Convert to CSV format
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `landing_centers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Landing centers exported successfully!', 'Export Complete');
}

function setupEventListeners() {
    // Save Button
    document.getElementById('saveBtn').addEventListener('click', saveLandingCenter);

    // Search Input
    document.getElementById('searchInput').addEventListener('input', filterLandingCenters);

    // Filter dropdowns
    document.getElementById('filterRegion').addEventListener('change', filterLandingCenters);
    document.getElementById('filterType').addEventListener('change', filterLandingCenters);

    // Rows per page
    document.getElementById('rowsPerPage').addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

    // Reset modal on close
    const modalEl = document.getElementById('addModal');
    modalEl.addEventListener('hidden.bs.modal', () => {
        document.getElementById('lcForm').reset();
        document.getElementById('lcId').value = '';
        document.getElementById('modalTitle').textContent = 'Add Landing Center';
    });

    // Prevent viewers from accessing modal
    modalEl.addEventListener('show.bs.modal', () => {
        if (currentUser.role === ROLES.VIEWER) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            window.toast.error('Viewers do not have permission to add or edit data.', 'Access Denied');
        }
    });
}

// Note: Using Validation.escapeHtml from utils/validation.js instead of local function
