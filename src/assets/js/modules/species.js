/**
 * Species Management Logic
 * Handles CRUD operations for dbo_species
 * 
 * Phase 2: Complete implementation with error handler, constants, and validation
 */

let allSpecies = [];
let filteredSpecies = [];
let currentUser = null;
let speciesIdToDelete = null;

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
    await loadSpecies();
    setupEventListeners();
});

// ----------------------------------------------------------------------------
// Data Loading
// ----------------------------------------------------------------------------

async function loadSpecies() {
    const tableBody = document.getElementById('speciesTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';

    try {
        const { data, error } = await window._supabase
            .from(TABLES.SPECIES)
            .select('*')
            .order('species_id', { ascending: true });

        if (error) throw error;

        allSpecies = data || [];
        filteredSpecies = data || [];
        currentPage = 1;
        renderTable();

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error loading data. Please refresh.</td></tr>';
        ErrorHandler.handle(error, {
            context: 'Species.loadSpecies',
            userMessage: 'Failed to load species data'
        });
    }
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

function renderTable() {
    const tableBody = document.getElementById('speciesTableBody');
    const totalRows = filteredSpecies.length;
    totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalRows === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">No species records found.</td></tr>';
        renderPagination();
        updateRowsInfo(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredSpecies.slice(startIndex, endIndex);

    const isViewer = currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(species => {
        let actions = `
            <button class="btn btn-sm btn-edit" 
                    onclick="openEditModal('${species.species_id}')"
                    title="Edit">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" 
                    onclick="confirmDelete('${species.species_id}')"
                    title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="fw-medium">${Validation.escapeHtml(species.sp_name || '')}</td>
                <td>${Validation.escapeHtml(species.sp_family || '-')}</td>
                <td>${Validation.escapeHtml(species.sp_sci || '-')}</td>
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

    const species = allSpecies.find(item => item.species_id == id);
    if (!species) return;

    document.getElementById('speciesId').value = species.species_id;
    document.getElementById('spName').value = species.sp_name || '';
    document.getElementById('spFamily').value = species.sp_family || '';
    document.getElementById('spSci').value = species.sp_sci || '';

    document.getElementById('modalTitle').textContent = 'Edit Species';
    const modal = new bootstrap.Modal(document.getElementById('addModal'));
    modal.show();
}

async function saveSpecies() {
    // Prevent viewers from saving
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to save data.', 'Access Denied');
        return;
    }

    const id = document.getElementById('speciesId').value;
    const spName = document.getElementById('spName').value.trim();
    const spFamily = document.getElementById('spFamily').value.trim();
    const spSci = document.getElementById('spSci').value.trim();
    const saveBtn = document.getElementById('saveBtn');

    // Validation
    const nameValidation = Validation.isRequired(spName, 'Species Name');
    if (!nameValidation.isValid) {
        window.toast.error(nameValidation.error);
        return;
    }

    // Additional validation
    const nameLengthValidation = Validation.validateLength(spName, 1, 255, 'Species Name');
    if (!nameLengthValidation.isValid) {
        window.toast.error(nameLengthValidation.error);
        return;
    }

    if (spFamily) {
        const familyLengthValidation = Validation.validateLength(spFamily, 1, 255, 'Species Family');
        if (!familyLengthValidation.isValid) {
            window.toast.error(familyLengthValidation.error);
            return;
        }
    }

    if (spSci) {
        const sciLengthValidation = Validation.validateLength(spSci, 1, 255, 'Scientific Name');
        if (!sciLengthValidation.isValid) {
            window.toast.error(sciLengthValidation.error);
            return;
        }
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        sp_name: spName,
        sp_family: spFamily || null,
        sp_sci: spSci || null
    };

    try {
        let result;

        if (id) {
            // Update
            result = await window._supabase
                .from(TABLES.SPECIES)
                .update(payload)
                .eq('species_id', id);
        } else {
            // Insert
            result = await window._supabase
                .from(TABLES.SPECIES)
                .insert([payload]);
        }

        if (result.error) throw result.error;

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('addModal'));
        modal.hide();
        document.getElementById('speciesForm').reset();
        document.getElementById('speciesId').value = '';
        window.toast.success('Species saved successfully!');

        await loadSpecies();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Species.saveSpecies',
            userMessage: 'Failed to save species'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Species';
    }
}

function confirmDelete(id) {
    // Prevent viewers from deleting
    if (currentUser.role === ROLES.VIEWER) {
        window.toast.error('Viewers do not have permission to delete data.', 'Access Denied');
        return;
    }

    speciesIdToDelete = id;
    const species = allSpecies.find(item => item.species_id == id);
    
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function deleteSpecies() {
    if (!speciesIdToDelete) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
        const { error } = await window._supabase
            .from(TABLES.SPECIES)
            .delete()
            .eq('species_id', speciesIdToDelete);

        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        window.toast.success('Species deleted successfully.');
        speciesIdToDelete = null;

        await loadSpecies();

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'Species.deleteSpecies',
            userMessage: 'Failed to delete species'
        });
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// ----------------------------------------------------------------------------
// Filtering & Export
// ----------------------------------------------------------------------------

function filterSpecies() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredSpecies = allSpecies.filter(species => {
        const matchesSearch = !searchTerm ||
            (species.species_id && String(species.species_id).toLowerCase().includes(searchTerm)) ||
            (species.sp_name && species.sp_name.toLowerCase().includes(searchTerm)) ||
            (species.sp_family && species.sp_family.toLowerCase().includes(searchTerm)) ||
            (species.sp_sci && species.sp_sci.toLowerCase().includes(searchTerm));

        return matchesSearch;
    });

    currentPage = 1;
    renderTable();
}

function exportToCSV() {
    // Use filtered data (same as what's displayed in table)
    const dataToExport = filteredSpecies;

    // Create CSV content
    const headers = ['Species Name', 'Family', 'Scientific Name'];
    const rows = dataToExport.map(species => [
        Validation.escapeHtml(species.sp_name || ''),
        Validation.escapeHtml(species.sp_family || ''),
        Validation.escapeHtml(species.sp_sci || '')
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
    link.setAttribute('download', `species_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.toast.success('Species exported successfully!', 'Export Complete');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

function setupEventListeners() {
    // Save Button
    document.getElementById('saveBtn').addEventListener('click', saveSpecies);

    // Delete Confirmation Button
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteSpecies);

    // Search Input
    document.getElementById('searchInput').addEventListener('input', filterSpecies);

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
        document.getElementById('speciesForm').reset();
        document.getElementById('speciesId').value = '';
        document.getElementById('modalTitle').textContent = 'Add Species';
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

