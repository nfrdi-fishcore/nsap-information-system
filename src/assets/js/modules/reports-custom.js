/**
 * Custom Report Builder Module - NSAP Information System
 * 
 * Handles custom report building with flexible field selection, filters, grouping, and sorting
 */

let currentUser = null;
let reportData = null;
let selectedFields = [];
let filters = [];
let regions = [];

// Available fields for custom reports
const AVAILABLE_FIELDS = [
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'region', label: 'Region', type: 'text' },
    { id: 'landingCenter', label: 'Landing Center', type: 'text' },
    { id: 'fishingGround', label: 'Fishing Ground', type: 'text' },
    { id: 'vessel', label: 'Vessel', type: 'text' },
    { id: 'gear', label: 'Gear Type', type: 'text' },
    { id: 'species', label: 'Species', type: 'text' },
    { id: 'catchVolume', label: 'Catch Volume (kg)', type: 'number' },
    { id: 'effort', label: 'Effort', type: 'text' },
    { id: 'samplingDay', label: 'Sampling Day', type: 'boolean' },
    { id: 'vesselsCount', label: 'Number of Vessels', type: 'number' }
];

// Filter operators
const FILTER_OPERATORS = {
    text: [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'startsWith', label: 'Starts With' },
        { value: 'endsWith', label: 'Ends With' }
    ],
    number: [
        { value: 'equals', label: 'Equals' },
        { value: 'greaterThan', label: 'Greater Than' },
        { value: 'lessThan', label: 'Less Than' },
        { value: 'between', label: 'Between' }
    ],
    date: [
        { value: 'equals', label: 'Equals' },
        { value: 'greaterThan', label: 'After' },
        { value: 'lessThan', label: 'Before' },
        { value: 'between', label: 'Between' }
    ],
    boolean: [
        { value: 'equals', label: 'Equals' }
    ]
};

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
    await loadRegions();
    initializeFieldSelection();
    setupEventListeners();
    setDefaultDates();
    loadSavedTemplates();
    
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
            .select('region_id, region_name')
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
            context: 'ReportsCustom.loadRegions',
            userMessage: 'Failed to load regions'
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

// ----------------------------------------------------------------------------
// Field Selection
// ----------------------------------------------------------------------------

function initializeFieldSelection() {
    const fieldList = document.getElementById('fieldList');
    if (!fieldList) return;

    fieldList.innerHTML = AVAILABLE_FIELDS.map(field => `
        <div class="field-item" data-field-id="${field.id}">
            <input type="checkbox" class="form-check-input me-2" id="field_${field.id}" 
                   value="${field.id}" onchange="toggleField('${field.id}')">
            <label class="form-check-label" for="field_${field.id}" style="cursor: pointer;">
                ${Validation.escapeHtml(field.label)}
            </label>
        </div>
    `).join('');

    // Populate grouping and sorting dropdowns
    const groupByField = document.getElementById('groupByField');
    const sortByField = document.getElementById('sortByField');

    if (groupByField) {
        groupByField.innerHTML = '<option value="">No Grouping</option>' +
            AVAILABLE_FIELDS.map(f => `<option value="${f.id}">${Validation.escapeHtml(f.label)}</option>`).join('');
    }

    if (sortByField) {
        sortByField.innerHTML = '<option value="">No Sorting</option>' +
            AVAILABLE_FIELDS.map(f => `<option value="${f.id}">${Validation.escapeHtml(f.label)}</option>`).join('');
    }
}

function toggleField(fieldId) {
    const checkbox = document.getElementById(`field_${fieldId}`);
    const fieldItem = checkbox.closest('.field-item');

    if (checkbox.checked) {
        if (!selectedFields.includes(fieldId)) {
            selectedFields.push(fieldId);
        }
        fieldItem.classList.add('selected');
    } else {
        selectedFields = selectedFields.filter(id => id !== fieldId);
        fieldItem.classList.remove('selected');
    }
}

function selectAllFields() {
    AVAILABLE_FIELDS.forEach(field => {
        const checkbox = document.getElementById(`field_${field.id}`);
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            toggleField(field.id);
        }
    });
}

function deselectAllFields() {
    AVAILABLE_FIELDS.forEach(field => {
        const checkbox = document.getElementById(`field_${field.id}`);
        if (checkbox && checkbox.checked) {
            checkbox.checked = false;
            toggleField(field.id);
        }
    });
}

// ----------------------------------------------------------------------------
// Filter Builder
// ----------------------------------------------------------------------------

function addFilter() {
    const filterBuilder = document.getElementById('filterBuilder');
    if (!filterBuilder) return;

    // Remove "no filters" message if present
    const noFiltersMsg = filterBuilder.querySelector('.text-muted');
    if (noFiltersMsg) {
        noFiltersMsg.remove();
    }

    const filterId = `filter_${Date.now()}`;
    const filterItem = document.createElement('div');
    filterItem.className = 'filter-item';
    filterItem.id = filterId;

    filterItem.innerHTML = `
        <select class="form-select form-select-sm" style="flex: 1;" onchange="updateFilterField('${filterId}', this.value)">
            <option value="">Select Field...</option>
            ${AVAILABLE_FIELDS.map(f => `<option value="${f.id}">${Validation.escapeHtml(f.label)}</option>`).join('')}
        </select>
        <select class="form-select form-select-sm" style="flex: 1;" id="${filterId}_operator" disabled>
            <option value="">Select Operator...</option>
        </select>
        <input type="text" class="form-control form-control-sm" style="flex: 1;" 
               id="${filterId}_value" placeholder="Value..." disabled>
        <button class="btn btn-sm btn-outline-danger" onclick="removeFilter('${filterId}')">
            <i class="bi bi-x"></i>
        </button>
    `;

    filterBuilder.appendChild(filterItem);
    filters.push({ id: filterId, field: '', operator: '', value: '' });
}

function updateFilterField(filterId, fieldId) {
    const filter = filters.find(f => f.id === filterId);
    if (!filter) return;

    filter.field = fieldId;
    const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
    
    const operatorSelect = document.getElementById(`${filterId}_operator`);
    const valueInput = document.getElementById(`${filterId}_value`);

    if (!operatorSelect || !valueInput) return;

    if (field) {
        operatorSelect.innerHTML = '<option value="">Select Operator...</option>' +
            FILTER_OPERATORS[field.type].map(op => 
                `<option value="${op.value}">${Validation.escapeHtml(op.label)}</option>`
            ).join('');
        operatorSelect.disabled = false;
        operatorSelect.onchange = () => {
            filter.operator = operatorSelect.value;
            valueInput.disabled = !filter.operator;
            if (filter.operator) {
                filter.value = '';
            }
        };
    } else {
        operatorSelect.innerHTML = '<option value="">Select Operator...</option>';
        operatorSelect.disabled = true;
        valueInput.disabled = true;
    }

    valueInput.oninput = () => {
        filter.value = valueInput.value;
    };
}

function removeFilter(filterId) {
    const filterItem = document.getElementById(filterId);
    if (filterItem) {
        filterItem.remove();
    }
    filters = filters.filter(f => f.id !== filterId);

    // Show "no filters" message if no filters remain
    const filterBuilder = document.getElementById('filterBuilder');
    if (filterBuilder && filters.length === 0) {
        filterBuilder.innerHTML = '<div class="text-muted small mb-2">No filters added. Click "Add Filter" to add filters.</div>';
    }
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
    const groupBy = document.getElementById('groupByField').value;
    const sortBy = document.getElementById('sortByField').value;
    const sortOrder = document.getElementById('sortOrder').value;

    // Validate parameters
    const params = {
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate: toDate ? new Date(toDate) : null
    };

    const validation = ReportsService.validateReportParams(params);
    if (!validation.isValid) {
        window.toast.error(validation.error, 'Validation Error');
        return;
    }

    if (selectedFields.length === 0) {
        window.toast.error('Please select at least one field', 'Validation Error');
        return;
    }

    // Show loading
    document.getElementById('loadingOverlay').classList.remove('d-none');
    document.getElementById('reportContent').classList.add('d-none');

    try {
        // Fetch custom report data
        reportData = await ReportsService.getCustomReportData(
            currentUser,
            params.fromDate,
            params.toDate,
            selectedFields,
            filters.filter(f => f.field && f.operator && f.value),
            regionId ? parseInt(regionId) : null,
            groupBy || null,
            sortBy || null,
            sortOrder || 'asc'
        );

        // Render report
        renderReport(reportData);

        // Show report content
        document.getElementById('reportContent').classList.remove('d-none');
        window.toast.success('Report generated successfully!', 'Report Ready');

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'ReportsCustom.generateReport',
            userMessage: 'Failed to generate report'
        });
    } finally {
        document.getElementById('loadingOverlay').classList.add('d-none');
    }
}

function renderReport(data) {
    const tableHead = document.getElementById('previewTableHead');
    const tableBody = document.getElementById('previewTableBody');
    const recordCount = document.getElementById('recordCount');

    if (!tableHead || !tableBody || !recordCount) return;

    if (!data || !data.rows || data.rows.length === 0) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted py-5">No data available</td></tr>';
        recordCount.textContent = '0 records';
        return;
    }

    // Render headers
    tableHead.innerHTML = `<tr>${data.columns.map(col => 
        `<th>${Validation.escapeHtml(col)}</th>`
    ).join('')}</tr>`;

    // Render rows
    tableBody.innerHTML = data.rows.map(row => 
        `<tr>${data.columns.map(col => 
            `<td>${formatCellValue(row[col])}</td>`
        ).join('')}</tr>`
    ).join('');

    recordCount.textContent = `${data.rows.length} record${data.rows.length !== 1 ? 's' : ''}`;
}

function formatCellValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    return Validation.escapeHtml(String(value));
}

// ----------------------------------------------------------------------------
// Template Management
// ----------------------------------------------------------------------------

function saveTemplate() {
    const templateName = document.getElementById('templateName').value.trim();
    if (!templateName) {
        window.toast.error('Please enter a template name', 'Validation Error');
        return;
    }

    const template = {
        name: templateName,
        selectedFields: selectedFields,
        filters: filters.filter(f => f.field && f.operator && f.value),
        groupBy: document.getElementById('groupByField').value,
        sortBy: document.getElementById('sortByField').value,
        sortOrder: document.getElementById('sortOrder').value,
        regionId: document.getElementById('filterRegion').value,
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        createdAt: new Date().toISOString()
    };

    const templates = getSavedTemplates();
    templates[templateName] = template;
    localStorage.setItem('customReportTemplates', JSON.stringify(templates));

    populateTemplateDropdown();
    document.getElementById('templateName').value = '';
    window.toast.success('Template saved successfully!', 'Template Saved');
}

function loadTemplate() {
    const templateName = document.getElementById('loadTemplateSelect').value;
    if (!templateName) return;

    const templates = getSavedTemplates();
    const template = templates[templateName];

    if (!template) {
        window.toast.error('Template not found', 'Error');
        return;
    }

    // Load template settings
    selectedFields = template.selectedFields || [];
    filters = template.filters || [];
    document.getElementById('groupByField').value = template.groupBy || '';
    document.getElementById('sortByField').value = template.sortBy || '';
    document.getElementById('sortOrder').value = template.sortOrder || 'asc';
    document.getElementById('filterRegion').value = template.regionId || '';
    document.getElementById('fromDate').value = template.fromDate || '';
    document.getElementById('toDate').value = template.toDate || '';

    // Update field checkboxes
    AVAILABLE_FIELDS.forEach(field => {
        const checkbox = document.getElementById(`field_${field.id}`);
        const fieldItem = checkbox?.closest('.field-item');
        if (checkbox) {
            checkbox.checked = selectedFields.includes(field.id);
            if (fieldItem) {
                if (selectedFields.includes(field.id)) {
                    fieldItem.classList.add('selected');
                } else {
                    fieldItem.classList.remove('selected');
                }
            }
        }
    });

    // Rebuild filters
    const filterBuilder = document.getElementById('filterBuilder');
    filterBuilder.innerHTML = '';
    if (filters.length === 0) {
        filterBuilder.innerHTML = '<div class="text-muted small mb-2">No filters added. Click "Add Filter" to add filters.</div>';
    } else {
        filters.forEach(filter => {
            addFilter();
            const filterItem = document.getElementById(filter.id);
            if (filterItem) {
                const fieldSelect = filterItem.querySelector('select');
                const operatorSelect = document.getElementById(`${filter.id}_operator`);
                const valueInput = document.getElementById(`${filter.id}_value`);

                if (fieldSelect) {
                    fieldSelect.value = filter.field;
                    updateFilterField(filter.id, filter.field);
                    setTimeout(() => {
                        if (operatorSelect) {
                            operatorSelect.value = filter.operator;
                            operatorSelect.dispatchEvent(new Event('change'));
                        }
                        if (valueInput) {
                            valueInput.value = filter.value;
                        }
                    }, 100);
                }
            }
        });
    }

    window.toast.success('Template loaded successfully!', 'Template Loaded');
}

function deleteTemplate() {
    const templateName = document.getElementById('loadTemplateSelect').value;
    if (!templateName) {
        window.toast.error('Please select a template to delete', 'Validation Error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
        return;
    }

    const templates = getSavedTemplates();
    delete templates[templateName];
    localStorage.setItem('customReportTemplates', JSON.stringify(templates));

    populateTemplateDropdown();
    window.toast.success('Template deleted successfully!', 'Template Deleted');
}

function getSavedTemplates() {
    try {
        const stored = localStorage.getItem('customReportTemplates');
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        return {};
    }
}

function loadSavedTemplates() {
    populateTemplateDropdown();
}

function populateTemplateDropdown() {
    const select = document.getElementById('loadTemplateSelect');
    if (!select) return;

    const templates = getSavedTemplates();
    const templateNames = Object.keys(templates).sort();

    select.innerHTML = '<option value="">Load Template...</option>' +
        templateNames.map(name => 
            `<option value="${Validation.escapeHtml(name)}">${Validation.escapeHtml(name)}</option>`
        ).join('');
}

// ----------------------------------------------------------------------------
// Export Functions
// ----------------------------------------------------------------------------

function exportToCSV() {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    ReportExport.exportToCSV(reportData.rows, reportData.columns, 'custom_report');
}

function exportToExcel() {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    ReportExport.exportToExcel(reportData.rows, reportData.columns, 'custom_report', 'Custom Report');
}

function exportToPDF() {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
        window.toast.error('Please generate a report first', 'Export Error');
        return;
    }

    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const title = `Custom Report (${fromDate} to ${toDate})`;
    
    // Create a simplified report data object for PDF
    const pdfData = {
        summary: {
            totalRecords: reportData.rows.length
        },
        columns: reportData.columns,
        rows: reportData.rows.slice(0, 50) // Limit to first 50 rows for PDF
    };
    
    ReportExport.exportToPDF(pdfData, title, 'custom_report');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

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

    // Field Selection
    document.getElementById('selectAllFieldsBtn').addEventListener('click', selectAllFields);
    document.getElementById('deselectAllFieldsBtn').addEventListener('click', deselectAllFields);

    // Filter Builder
    document.getElementById('addFilterBtn').addEventListener('click', addFilter);

    // Templates
    document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
    document.getElementById('loadTemplateSelect').addEventListener('change', loadTemplate);
    document.getElementById('deleteTemplateBtn').addEventListener('click', deleteTemplate);

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Export Buttons
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPDFBtn').addEventListener('click', exportToPDF);
}

// Make functions available globally for inline event handlers
window.toggleField = toggleField;
window.updateFilterField = updateFilterField;
window.removeFilter = removeFilter;

