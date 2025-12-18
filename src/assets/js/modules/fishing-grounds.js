/**
 * Fishing Ground Management Logic
 * Handles CRUD operations for dbo_fishing_ground
 * 
 * Phase 1: Applied error handler, constants, and validation
 */

let allFishingGrounds = [];
let filteredFishingGrounds = [];
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

    // Load User Profile
    currentUser = await getUserProfile();
    if (!currentUser) {
        window.toast.error('Failed to load permissions.');
        return;
    }

    // Apply UI Restrictions
    if (currentUser.role === ROLES.VIEWER) {
        const addBtn = document.querySelector('button[data-bs-target="#addModal"]');
        if (addBtn) addBtn.style.display = 'none';
    }

    // Initialize
    await loadRegions();
    await loadFishingGrounds();
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
            context: 'FishingGrounds.loadRegions',
            userMessage: 'Failed to load regions'
        });
    }
}

async function loadFishingGrounds() {
    const tableBody = document.getElementById('fgTableBody');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        let query = window._supabase
            .from(TABLES.FISHING_GROUND)
            .select(`
                ground_id,
                ground_desc,
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

        allFishingGrounds = data;
        filteredFishingGrounds = data;
        currentPage = 1;
        renderTable();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'FishingGrounds.loadFishingGrounds',
            userMessage: 'Failed to load fishing grounds'
        });
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function populateRegionDropdown(regions) {
    const select = document.getElementById('fgRegion');
    select.innerHTML = '<option value="" disabled selected>Select Region...</option>';

    regions.forEach(reg => {
        const option = document.createElement('option');
        option.value = reg.region_id;
        option.textContent = reg.region_name;
        select.appendChild(option);
    });

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
    const tableBody = document.getElementById('fgTableBody');
    const totalRows = filteredFishingGrounds.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">No fishing grounds found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredFishingGrounds.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(fg => {
        const regionName = fg.dbo_region ? Validation.escapeHtml(fg.dbo_region.region_name) : '<span class="text-muted">Unknown</span>';

        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${fg.ground_id}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="deleteFishingGround('${fg.ground_id}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(fg.ground_desc)}</td>
                <td><span class="badge bg-light text-dark border">${regionName}</span></td>
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

    const fg = allFishingGrounds.find(item => item.ground_id === id);
    if (!fg) return;

    document.getElementById('fgId').value = fg.ground_id;
    document.getElementById('fgName').value = fg.ground_desc;
    document.getElementById('fgRegion').value = fg.region_id;

    document.getElementById('modalTitle').textContent = 'Edit Fishing Ground';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveFishingGround() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('fgId').value;
    const name = document.getElementById('fgName').value.trim();
    const regionId = document.getElementById('fgRegion').value;
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const nameValidation = Validation.isRequired(name, 'Fishing Ground Name');
    const regionValidation = Validation.isRequired(regionId, 'Region');

    if (!nameValidation.isValid || !regionValidation.isValid) {
        window.toast.error(nameValidation.error || regionValidation.error || 'Please fill in all required fields.');
        return;
    }

    // Additional validation
    const lengthValidation = Validation.validateLength(name, 1, 255, 'Fishing Ground Name');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        ground_desc: name,
        region_id: parseInt(regionId)
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.FISHING_GROUND)
                .update(payload)
                .eq('ground_id', id);
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.FISHING_GROUND)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('fgForm').reset();
        document.getElementById('fgId').value = '';
        window.toast.success('Fishing ground saved successfully!');

        await loadFishingGrounds();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'FishingGrounds.saveFishingGround',
            userMessage: 'Failed to save fishing ground'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Fishing Ground';
    }
}

async function deleteFishingGround(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    if (!confirm('Are you sure you want to delete this fishing ground? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await window._supabase
            .from(TABLES.FISHING_GROUND)
            .delete()
            .eq('ground_id', id);

        if (error) throw error;

        window.toast.success('Fishing ground deleted successfully.');
        await loadFishingGrounds();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'FishingGrounds.deleteFishingGround',
            userMessage: 'Failed to delete fishing ground'
        });
    }
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function filterFishingGrounds() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const regionFilter = document.getElementById('filterRegion').value;

    filteredFishingGrounds = allFishingGrounds.filter(fg => {
        // Search filter
        const matchesSearch = !searchTerm ||
            fg.ground_desc.toLowerCase().includes(searchTerm) ||
            (fg.dbo_region && fg.dbo_region.region_name.toLowerCase().includes(searchTerm));

        // Region filter
        const matchesRegion = !regionFilter || fg.region_id === parseInt(regionFilter);

        return matchesSearch && matchesRegion;
    });

    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredFishingGrounds;

    // Create CSV content
    const headers = ['Fishing Ground Name', 'Region'];
    const rows = dataToExport.map(fg => [
        Validation.escapeHtml(fg.ground_desc),
        fg.dbo_region ? Validation.escapeHtml(fg.dbo_region.region_name) : 'Unknown'
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
    link.setAttribute('download', `fishing_grounds_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Fishing grounds exported successfully!', 'Export Complete');
}

function setupEventListeners() {
    // Save Button
    document.getElementById('saveBtn').addEventListener('click', saveFishingGround);

    // Search Input
    document.getElementById('searchInput').addEventListener('input', filterFishingGrounds);

    // Region filter
    document.getElementById('filterRegion').addEventListener('change', filterFishingGrounds);

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
        document.getElementById('fgForm').reset();
        document.getElementById('fgId').value = '';
        document.getElementById('modalTitle').textContent = 'Add Fishing Ground';
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
