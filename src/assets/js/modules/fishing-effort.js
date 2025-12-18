/**
 * Fishing Effort Management Logic
 * Handles CRUD operations for dbo_fishing_effort
 * 
 * Phase 2: Complete implementation with error handler, constants, and validation
 */

let allFishingEffort = [];
let filteredFishingEffort = [];
let currentUser = null;
let effortIdToDelete = null;

// Pagination state
let currentPage = 1;
let rowsPerPage = 25;
let totalPages = 1;

// Helper function to get the ID value (handles different case variations)
// Note: PostgreSQL converts unquoted identifiers to lowercase, so the actual column is 'uniteffort_id'
function getEffortId(record) {
    return record.uniteffort_id || record.UnitEffort_id || record.UnitEffort_ID || record.UnitEffortId;
}

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
    await loadFishingEffort();
    setupEventListeners();
});

// ----------------------------------------------------------------------------
// Data Loading
// ----------------------------------------------------------------------------

async function loadFishingEffort() {
    const tableBody = document.getElementById('feTableBody');
    tableBody.innerHTML = '<tr><td colspan="2" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        const { data, error } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .select('*')
            .order('uniteffort_id', { ascending: true });

        if (error) throw error;

        allFishingEffort = data || [];
        filteredFishingEffort = data || [];
        currentPage = 1;
        renderTable();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="2" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'FishingEffort.loadFishingEffort',
            userMessage: 'Failed to load fishing effort data'
        });
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function renderTable() {
    const tableBody = document.getElementById('feTableBody');
    const totalRows = filteredFishingEffort.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" class="text-center py-5 text-muted">No fishing effort records found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredFishingEffort.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(fe => {
        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${getEffortId(fe)}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="confirmDelete('${getEffortId(fe)}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(fe.fishing_effort || '')}</td>
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

    const fe = allFishingEffort.find(item => getEffortId(item) == id);
    if (!fe) return;

    document.getElementById('feId').value = getEffortId(fe);
    document.getElementById('feDescription').value = fe.fishing_effort || '';

    document.getElementById('modalTitle').textContent = 'Edit Fishing Effort';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveFishingEffort() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('feId').value;
    const description = document.getElementById('feDescription').value.trim();
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const descriptionValidation = Validation.isRequired(description, 'Fishing Effort');
    if (!descriptionValidation.isValid) {
        window.toast.error(descriptionValidation.error);
        return;
    }

    // Additional validation
    const lengthValidation = Validation.validateLength(description, 1, 255, 'Fishing Effort');
    if (!lengthValidation.isValid) {
        window.toast.error(lengthValidation.error);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        fishing_effort: description
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.FISHING_EFFORT)
                .update(payload)
                .eq('uniteffort_id', id);
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.FISHING_EFFORT)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('feForm').reset();
        document.getElementById('feId').value = '';
        window.toast.success('Fishing effort saved successfully!');

        await loadFishingEffort();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'FishingEffort.saveFishingEffort',
            userMessage: 'Failed to save fishing effort'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Fishing Effort';
    }
}

function confirmDelete(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    effortIdToDelete = id;
    const fe = allFishingEffort.find(item => getEffortId(item) == id);
    
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function deleteFishingEffort() {
    if (!effortIdToDelete) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
        const { error } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .delete()
            .eq('uniteffort_id', effortIdToDelete);

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        window.toast.success('Fishing effort deleted successfully.');
        effortIdToDelete = null;

        await loadFishingEffort();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'FishingEffort.deleteFishingEffort',
            userMessage: 'Failed to delete fishing effort'
        });
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// ----------------------------------------------------------------------------
// Filtering & Export
// ----------------------------------------------------------------------------

function filterFishingEffort() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredFishingEffort = allFishingEffort.filter(fe => {
        const matchesSearch = !searchTerm ||
            (getEffortId(fe) && String(getEffortId(fe)).toLowerCase().includes(searchTerm)) ||
            (fe.fishing_effort && fe.fishing_effort.toLowerCase().includes(searchTerm));

        return matchesSearch;
    });

    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredFishingEffort;

    // Create CSV content
    const headers = ['Fishing Effort'];
    const rows = dataToExport.map(fe => [
        Validation.escapeHtml(fe.fishing_effort || '')
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
    link.setAttribute('download', `fishing_effort_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Fishing effort exported successfully!', 'Export Complete');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Save Button
    document.getElementById('saveBtn').addEventListener('click', saveFishingEffort);

    // Delete Confirmation Button
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteFishingEffort);

    // Search Input
    document.getElementById('searchInput').addEventListener('input', filterFishingEffort);

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
        document.getElementById('feForm').reset();
        document.getElementById('feId').value = '';
        document.getElementById('modalTitle').textContent = 'Add Fishing Effort';
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

