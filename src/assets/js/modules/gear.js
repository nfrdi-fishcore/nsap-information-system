/**
 * Gear Management Logic
 * Handles CRUD operations for dbo_gear
 * 
 * Phase 2: Complete implementation with error handler, constants, and validation
 */

let allGears = [];
let filteredGears = [];
let allFishingEfforts = [];
let currentUser = null;
let gearIdToDelete = null;

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
    await loadFishingEfforts();
    await loadGears();
    setupEventListeners();
});

// ----------------------------------------------------------------------------
// Data Loading
// ----------------------------------------------------------------------------

async function loadFishingEfforts() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .select('*')
            .order('fishing_effort', { ascending: true });

        if (error) throw error;

        allFishingEfforts = data || [];
        populateFishingEffortDropdowns();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Gear.loadFishingEfforts',
            userMessage: 'Failed to load fishing effort data'
        });
    }
}

function populateFishingEffortDropdowns() {
    const select1 = document.getElementById('uniteffortId');
    const select2 = document.getElementById('uniteffort2Id');
    const select3 = document.getElementById('uniteffort3Id');

    // Clear and add "None" option to optional dropdowns
    if (select1) {
        select1.innerHTML = '<option value="" disabled selected>Select Fishing Effort...</option>';
    }
    if (select2) {
        select2.innerHTML = '<option value="">None</option>';
    }
    if (select3) {
        select3.innerHTML = '<option value="">None</option>';
    }

    allFishingEfforts.forEach(fe => {
        const effortId = fe.uniteffort_id || fe.UnitEffort_id || fe.UnitEffort_ID;
        const effortDesc = fe.fishing_effort || '';

        // Add to all dropdowns
        [select1, select2, select3].forEach(select => {
            if (select) {
                const option = document.createElement('option');
                option.value = effortId;
                option.textContent = effortDesc;
                select.appendChild(option);
            }
        });
    });
}

async function loadGears() {
    const tableBody = document.getElementById('gearTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        // Load gears with fishing effort descriptions
        // Note: Supabase doesn't support multiple joins to the same table directly
        // We'll load gears first, then fetch fishing effort details separately
        const { data: gearsData, error } = await window._supabase
            .from(TABLES.GEAR)
            .select('*')
            .order('gear_desc', { ascending: true });

        if (error) throw error;

        // Fetch fishing effort details for all unique IDs
        const effortIds = new Set();
        gearsData.forEach(gear => {
            if (gear.uniteffort_id) effortIds.add(gear.uniteffort_id);
            if (gear.uniteffort_2_id) effortIds.add(gear.uniteffort_2_id);
            if (gear.uniteffort_3_id) effortIds.add(gear.uniteffort_3_id);
        });

        // Fetch all fishing efforts at once
        let effortsMap = {};
        if (effortIds.size > 0) {
            const { data: effortsData, error: effortsError } = await window._supabase
                .from(TABLES.FISHING_EFFORT)
                .select('*')
                .in('uniteffort_id', Array.from(effortIds));

            if (effortsError) throw effortsError;

            // Create a map for quick lookup
            effortsData.forEach(effort => {
                const effortId = effort.uniteffort_id || effort.UnitEffort_id || effort.UnitEffort_ID;
                effortsMap[effortId] = effort;
            });
        }

        // Combine gear data with fishing effort descriptions
        const data = gearsData.map(gear => {
            const gearWithEfforts = { ...gear };
            
            // Add fishing effort 1
            if (gear.uniteffort_id && effortsMap[gear.uniteffort_id]) {
                gearWithEfforts.dbo_fishing_effort = {
                    fishing_effort: effortsMap[gear.uniteffort_id].fishing_effort
                };
            }
            
            // Add fishing effort 2
            if (gear.uniteffort_2_id && effortsMap[gear.uniteffort_2_id]) {
                gearWithEfforts.dbo_fishing_effort_2 = {
                    fishing_effort: effortsMap[gear.uniteffort_2_id].fishing_effort
                };
            }
            
            // Add fishing effort 3
            if (gear.uniteffort_3_id && effortsMap[gear.uniteffort_3_id]) {
                gearWithEfforts.dbo_fishing_effort_3 = {
                    fishing_effort: effortsMap[gear.uniteffort_3_id].fishing_effort
                };
            }
            
            return gearWithEfforts;
        });

        allGears = data;
        filteredGears = data;
        currentPage = 1;
        renderTable();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'Gear.loadGears',
            userMessage: 'Failed to load gear data'
        });
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function renderTable() {
    const tableBody = document.getElementById('gearTableBody');
    const totalRows = filteredGears.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No gear records found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredGears.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(gear => {
    // Helper to get gear ID (handles case variations)
    const getGearId = (g) => g.gr_id || g.Gr_id || g.gr_Id;
    const gearId = getGearId(gear);

        // Get fishing effort descriptions
        const effort1 = gear.dbo_fishing_effort ? Validation.escapeHtml(gear.dbo_fishing_effort.fishing_effort) : '<span class="text-muted">-</span>';
        const effort2 = gear.dbo_fishing_effort_2 ? Validation.escapeHtml(gear.dbo_fishing_effort_2.fishing_effort) : '<span class="text-muted">-</span>';
        const effort3 = gear.dbo_fishing_effort_3 ? Validation.escapeHtml(gear.dbo_fishing_effort_3.fishing_effort) : '<span class="text-muted">-</span>';

        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${gearId}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="confirmDelete('${gearId}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(gear.gear_desc || '')}</td>
                <td>${effort1}</td>
                <td>${effort2}</td>
                <td>${effort3}</td>
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

    const getGearId = (g) => g.gr_id || g.Gr_id || g.gr_Id;
    const gear = allGears.find(item => getGearId(item) == id);
    if (!gear) return;

    document.getElementById('gearId').value = getGearId(gear);
    document.getElementById('gearDesc').value = gear.gear_desc || '';

    // Set fishing effort dropdowns
    const effort1Id = gear.uniteffort_id || gear.uniteffort_Id || gear.Uniteffort_id;
    const effort2Id = gear.uniteffort_2_id || gear.uniteffort_2_Id || gear.Uniteffort_2_id;
    const effort3Id = gear.uniteffort_3_id || gear.uniteffort_3_Id || gear.Uniteffort_3_id;

    document.getElementById('uniteffortId').value = effort1Id || '';
    document.getElementById('uniteffort2Id').value = effort2Id || '';
    document.getElementById('uniteffort3Id').value = effort3Id || '';

    document.getElementById('modalTitle').textContent = 'Edit Gear';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveGear() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('gearId').value;
    const gearDesc = document.getElementById('gearDesc').value.trim();
    const uniteffortId = document.getElementById('uniteffortId').value;
    const uniteffort2Id = document.getElementById('uniteffort2Id').value;
    const uniteffort3Id = document.getElementById('uniteffort3Id').value;
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const descValidation = Validation.isRequired(gearDesc, 'Gear Description');
    if (!descValidation.isValid) {
        window.toast.error(descValidation.error);
        return;
    }

    const effort1Validation = Validation.isRequired(uniteffortId, 'Fishing Effort 1');
    if (!effort1Validation.isValid) {
        window.toast.error(effort1Validation.error);
        return;
    }

    // Additional validation
    const lengthValidation = Validation.validateLength(gearDesc, 1, 255, 'Gear Description');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        gear_desc: gearDesc,
        uniteffort_id: uniteffortId ? parseInt(uniteffortId) : null
    };

    // Add optional fishing efforts (only if selected)
    if (uniteffort2Id) {
        payload.uniteffort_2_id = parseInt(uniteffort2Id);
    } else {
        payload.uniteffort_2_id = null;
    }

    if (uniteffort3Id) {
        payload.uniteffort_3_id = parseInt(uniteffort3Id);
    } else {
        payload.uniteffort_3_id = null;
    }

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.GEAR)
                .update(payload)
                .eq('gr_id', id);
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.GEAR)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('gearForm').reset();
        document.getElementById('gearId').value = '';
        document.getElementById('uniteffort2Id').value = '';
        document.getElementById('uniteffort3Id').value = '';
        window.toast.success('Gear saved successfully!');

        await loadGears();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Gear.saveGear',
            userMessage: 'Failed to save gear'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Gear';
    }
}

function confirmDelete(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    gearIdToDelete = id;
    // Helper to get gear ID (handles case variations)
    const getGearId = (g) => g.gr_id || g.Gr_id || g.gr_Id;
    const gear = allGears.find(item => getGearId(item) == id);
    
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function deleteGear() {
    if (!gearIdToDelete) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
        const { error } = await window._supabase
            .from(TABLES.GEAR)
            .delete()
            .eq('gr_id', parseInt(gearIdToDelete));

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        window.toast.success('Gear deleted successfully.');
        gearIdToDelete = null;

        await loadGears();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Gear.deleteGear',
            userMessage: 'Failed to delete gear'
        });
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// ----------------------------------------------------------------------------
// Filtering & Export
// ----------------------------------------------------------------------------

function filterGears() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredGears = allGears.filter(gear => {
        const matchesSearch = !searchTerm ||
            (gear.gear_desc && gear.gear_desc.toLowerCase().includes(searchTerm)) ||
            (gear.dbo_fishing_effort && gear.dbo_fishing_effort.fishing_effort && gear.dbo_fishing_effort.fishing_effort.toLowerCase().includes(searchTerm)) ||
            (gear.dbo_fishing_effort_2 && gear.dbo_fishing_effort_2.fishing_effort && gear.dbo_fishing_effort_2.fishing_effort.toLowerCase().includes(searchTerm)) ||
            (gear.dbo_fishing_effort_3 && gear.dbo_fishing_effort_3.fishing_effort && gear.dbo_fishing_effort_3.fishing_effort.toLowerCase().includes(searchTerm));

        return matchesSearch;
    });

    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredGears;

    // Create CSV content
    const headers = ['Gear Description', 'Fishing Effort 1', 'Fishing Effort 2', 'Fishing Effort 3'];
    const rows = dataToExport.map(gear => [
        Validation.escapeHtml(gear.gear_desc || ''),
        gear.dbo_fishing_effort ? Validation.escapeHtml(gear.dbo_fishing_effort.fishing_effort) : '-',
        gear.dbo_fishing_effort_2 ? Validation.escapeHtml(gear.dbo_fishing_effort_2.fishing_effort) : '-',
        gear.dbo_fishing_effort_3 ? Validation.escapeHtml(gear.dbo_fishing_effort_3.fishing_effort) : '-'
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
    link.setAttribute('download', `gears_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Gears exported successfully!', 'Export Complete');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Save Button
    document.getElementById('saveBtn').addEventListener('click', saveGear);

    // Delete Confirmation Button
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteGear);

    // Search Input
    document.getElementById('searchInput').addEventListener('input', filterGears);

    // Rows per page
    document.getElementById('rowsPerPage').addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

    // Add Gear button - reset form when opening
    document.getElementById('addGearBtn').addEventListener('click', () => {
        document.getElementById('gearForm').reset();
        document.getElementById('gearId').value = '';
        document.getElementById('uniteffort2Id').value = '';
        document.getElementById('uniteffort3Id').value = '';
        document.getElementById('modalTitle').textContent = 'Add Gear';
    });

    // Reset modal on close
    const modalEl = document.getElementById('addModal');
    modalEl.addEventListener('hidden.bs.modal', () => {
        document.getElementById('gearForm').reset();
        document.getElementById('gearId').value = '';
        document.getElementById('uniteffort2Id').value = '';
        document.getElementById('uniteffort3Id').value = '';
        document.getElementById('modalTitle').textContent = 'Add Gear';
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

