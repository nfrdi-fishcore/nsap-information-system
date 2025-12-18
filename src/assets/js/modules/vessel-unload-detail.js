/**
 * Vessel Unload Detail Page
 * Loads vessel unload record by v_unload_id and populates summary/detail cards.
 */

let currentUser = null;
const fullPageLoadingOverlay = () => document.getElementById('fullPageLoadingOverlay');
let fishingEffortMap = {};
let currentVesselUnloadId = null;
let currentUnloadDayId = null;
let allVessels = [];
let speciesMap = {};
let vesselCatchList = [];
let sampleLengthList = [];
let sampleLengthPage = 1;
let sampleLengthPageSize = 10;
let currentVesselUnloadData = null;
let selectedCatchId = null;
let vesselCatchModalMode = 'add';
let vesselCatchEditingId = null;
let vesselCatchIdToDelete = null;
let sampleLengthModalMode = 'add';
let sampleLengthEditingId = null;
let sampleLengthIdToDelete = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.Components) {
        window.Components.insert('sidebar', '#sidebarContainer');
        window.Components.initSidebar();
    }

    const session = await getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = await getUserProfile();
    if (!currentUser) {
        window.toast.error('Failed to load user profile.');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const vUnloadId = params.get('v_unload_id');
    if (!vUnloadId) {
        window.toast.error('No vessel unload ID provided.');
        return;
    }

    await loadFishingEfforts();
    await loadVessels();
    await loadSpecies();
    await loadVesselUnloadDetail(vUnloadId);
    await loadVesselCatchData(vUnloadId);
    wireCatchButtons();
    wireSampleLengthButtons();
    wireSampleLengthPagination();
    wireDeleteButton();
    wireEditButton();
});

async function loadFishingEfforts() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.FISHING_EFFORT)
            .select('uniteffort_id, fishing_effort');
        if (error) throw error;
        fishingEffortMap = {};
        (data || []).forEach(fe => {
            const id = fe.uniteffort_id || fe.Uniteffort_id || fe.uniteffort_Id;
            fishingEffortMap[id] = fe.fishing_effort || '-';
        });
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadFishingEfforts',
            userMessage: 'Failed to load fishing effort data',
            showToast: false
        });
    }
}

async function loadVesselUnloadDetail(vUnloadId) {
    setLoading(true);
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .select('*')
            .eq('v_unload_id', vUnloadId)
            .single();

        if (error) throw error;
        if (!data) {
            window.toast.error('Vessel unload record not found.');
            return;
        }

        let vesselName = '-';
        if (data.boat_id) {
            const { data: vesselData } = await window._supabase
                .from(TABLES.VESSEL)
                .select('vesselname')
                .eq('boat_id', data.boat_id)
                .single();
            vesselName = vesselData && vesselData.vesselname ? vesselData.vesselname : '-';
        }

        let gearDesc = '-';
        let samplingDate = '-';
        let uniteff1 = null;
        let uniteff2 = null;
        let uniteff3 = null;
        let unloadDayId = null;
        if (data.unload_gr_id) {
            const { data: gearUnloadData } = await window._supabase
                .from(TABLES.GEAR_UNLOAD)
                .select(`
                    unload_gr_id,
                    gr_id,
                    unload_day_id,
                    dbo_gear(gear_desc, uniteffort_id, uniteffort_2_id, uniteffort_3_id),
                    dbo_LC_FG_sample_day(unload_day_id, sdate)
                `)
                .eq('unload_gr_id', data.unload_gr_id)
                .single();
            if (gearUnloadData) {
                gearDesc = gearUnloadData.dbo_gear ? gearUnloadData.dbo_gear.gear_desc : gearUnloadData.unload_gr_id;
                uniteff1 = gearUnloadData.dbo_gear ? gearUnloadData.dbo_gear.uniteffort_id : null;
                uniteff2 = gearUnloadData.dbo_gear ? gearUnloadData.dbo_gear.uniteffort_2_id : null;
                uniteff3 = gearUnloadData.dbo_gear ? gearUnloadData.dbo_gear.uniteffort_3_id : null;
                unloadDayId = gearUnloadData.unload_day_id || (gearUnloadData.dbo_LC_FG_sample_day && gearUnloadData.dbo_LC_FG_sample_day.unload_day_id) || null;
                if (gearUnloadData.dbo_LC_FG_sample_day && gearUnloadData.dbo_LC_FG_sample_day.sdate) {
                    samplingDate = formatDate(gearUnloadData.dbo_LC_FG_sample_day.sdate);
                }
            }
        }

        setText('summaryGearUnload', gearDesc || data.unload_gr_id || '-');
        setText('summarySamplingDate', samplingDate);
        setText('summaryVessel', vesselName || data.boat_id || '-');
        setText('summaryCatchSamp', formatNumber(data.catch_samp));
        setText('summaryCatchTotal', formatNumber(data.catch_total));
        setText('summaryEffort1', formatNumber(data.effort));
        setText('summaryEffort2', formatNumber(data.effort_2));
        setText('summaryEffort3', formatNumber(data.effort_3));
        setText('summaryEffortUnit1', effortLabel(uniteff1));
        setText('summaryEffortUnit2', effortLabel(uniteff2));
        setText('summaryEffortUnit3', effortLabel(uniteff3));
        setText('summaryBoxesTotal', formatInt(data.boxes_total));
        setText('summaryBoxesSamp', formatInt(data.boxes_samp));
        setText('summaryCatchTotalTable', formatNumber(data.catch_total));
        setText('summaryCatchSampTable', formatNumber(data.catch_samp));
        
        // Calculate Raising Factor: Total Boat Catch / Total Sub-sample Catch
        let raisingFactor = '-';
        if (data.catch_samp && parseFloat(data.catch_samp) !== 0) {
            const totalCatch = parseFloat(data.catch_total) || 0;
            const sampleCatch = parseFloat(data.catch_samp) || 0;
            raisingFactor = (totalCatch / sampleCatch).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        setText('summaryRaisingFactor', raisingFactor);

        currentVesselUnloadId = data.v_unload_id || vUnloadId;
        currentVesselUnloadData = {
            ...data,
            gearDesc,
            uniteff1,
            uniteff2,
            uniteff3,
            samplingDate
        };
        setText('detailCatchSamp', formatNumber(data.catch_samp));
        setText('detailCatchTotal', formatNumber(data.catch_total));
        setText('detailBoxesSamp', formatInt(data.boxes_samp));
        setText('detailBoxesTotal', formatInt(data.boxes_total));
        setText('detailBoxesPiecesId', formatInt(data.boxes_pieces_id));
        setText('detailEffort1', formatNumber(data.effort));
        setText('detailEffort2', formatNumber(data.effort_2));
        setText('detailEffort3', formatNumber(data.effort_3));
        setText('detailEffortUnit1', effortLabel(uniteff1));
        setText('detailEffortUnit2', effortLabel(uniteff2));
        setText('detailEffortUnit3', effortLabel(uniteff3));
        setText('detailSamplingDate', samplingDate);
        setText('detailGearUnloadId', data.unload_gr_id || '-');
        setText('detailVesselId', data.boat_id || '-');
        setText('detailVUnloadId', data.v_unload_id || '-');
        currentUnloadDayId = unloadDayId;
        wireReturnButton(unloadDayId);

    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadVesselUnloadDetail',
            userMessage: 'Failed to load vessel unload detail'
        });
    } finally {
        setLoading(false);
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value !== null && value !== undefined && value !== '' ? value : '-';
}

function formatNumber(val) {
    if (val === null || val === undefined || val === '') return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInt(val) {
    if (val === null || val === undefined || val === '') return '-';
    const num = parseInt(val, 10);
    if (isNaN(num)) return '-';
    return num.toLocaleString();
}

function setLoading(isLoading) {
    const overlay = fullPageLoadingOverlay();
    if (!overlay) return;
    overlay.style.display = isLoading ? 'flex' : 'none';
}

function effortLabel(id) {
    if (!id) return '-';
    return fishingEffortMap[id] || '-';
}

function formatDate(val) {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Species lookup
let speciesDetailsMap = {}; // Store full species details
async function loadSpecies() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.SPECIES)
            .select('species_id, sp_name, sp_family, sp_sci');
        if (error) throw error;
        speciesMap = {};
        speciesDetailsMap = {};
        (data || []).forEach(sp => {
            const id = sp.species_id || sp.Species_id || sp.species_Id;
            speciesMap[id] = sp.sp_name || '-';
            speciesDetailsMap[id] = {
                name: sp.sp_name || '-',
                family: sp.sp_family || '-',
                scientific: sp.sp_sci || '-'
            };
        });
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadSpecies',
            userMessage: 'Failed to load species data',
            showToast: false
        });
    }
}

/**
 * Get the sum of catch_kg from all vessel catch records for a given vessel unload
 * @param {number} vUnloadId - The vessel unload ID
 * @returns {Promise<number>} The sum of catch_kg from all vessel catch records
 */
async function getVesselCatchTotalSum(vUnloadId) {
    if (!vUnloadId) return 0;
    
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_CATCH)
            .select('catch_kg')
            .eq('v_unload_id', vUnloadId);
        
        if (error) {
            console.error('Error getting vessel catch total sum:', error);
            return 0;
        }
        
        if (!data || data.length === 0) return 0;
        
        // Sum all catch_kg values
        const total = data.reduce((sum, rec) => {
            const catchKg = rec.catch_kg ? parseFloat(rec.catch_kg) : 0;
            return sum + catchKg;
        }, 0);
        
        return total;
    } catch (error) {
        console.error('Error in getVesselCatchTotalSum:', error);
        return 0;
    }
}

/**
 * Get the sum of samp_kg from all vessel catch records for a given vessel unload
 * @param {number} vUnloadId - The vessel unload ID
 * @returns {Promise<number>} The sum of samp_kg from all vessel catch records
 */
async function getVesselCatchSampSum(vUnloadId) {
    if (!vUnloadId) return 0;
    
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_CATCH)
            .select('samp_kg')
            .eq('v_unload_id', vUnloadId);
        
        if (error) {
            console.error('Error getting vessel catch samp sum:', error);
            return 0;
        }
        
        if (!data || data.length === 0) return 0;
        
        // Sum all samp_kg values
        const total = data.reduce((sum, rec) => {
            const sampKg = rec.samp_kg ? parseFloat(rec.samp_kg) : 0;
            return sum + sampKg;
        }, 0);
        
        return total;
    } catch (error) {
        console.error('Error in getVesselCatchSampSum:', error);
        return 0;
    }
}

/**
 * Update the catch_total and catch_samp fields in the vessel unload edit form
 * @param {number} vUnloadId - The vessel unload ID
 */
async function updateVesselUnloadCatchTotalField(vUnloadId) {
    if (!vUnloadId) return;
    
    const catchTotalField = document.getElementById('vuEditCatchTotal');
    const catchSampField = document.getElementById('vuEditCatchSamp');
    
    if (catchTotalField) {
        const catchTotal = await getVesselCatchTotalSum(vUnloadId);
        catchTotalField.value = catchTotal.toFixed(2);
    }
    
    if (catchSampField) {
        const catchSamp = await getVesselCatchSampSum(vUnloadId);
        catchSampField.value = catchSamp.toFixed(2);
    }
}

/**
 * Get the sum of catch_total from all vessel unload records for a given gear unload
 * @param {number} unloadGrId - The gear unload ID
 * @returns {Promise<number>} The sum of catch_total from all vessel unload records
 */
async function getGearUnloadCatchTotalSum(unloadGrId) {
    if (!unloadGrId) return 0;
    
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .select('catch_total')
            .eq('unload_gr_id', unloadGrId);
        
        if (error) {
            console.error('Error getting gear unload catch total sum:', error);
            return 0;
        }
        
        if (!data || data.length === 0) return 0;
        
        // Sum all catch_total values
        const total = data.reduce((sum, rec) => {
            const catchTotal = rec.catch_total ? parseFloat(rec.catch_total) : 0;
            return sum + catchTotal;
        }, 0);
        
        return total;
    } catch (error) {
        console.error('Error in getGearUnloadCatchTotalSum:', error);
        return 0;
    }
}

/**
 * Update the catch field in the gear unload record based on the sum of all vessel unloads' catch_total
 * @param {number} unloadGrId - The gear unload ID
 */
async function updateGearUnloadCatch(unloadGrId) {
    if (!unloadGrId) return;
    
    try {
        const catchTotal = await getGearUnloadCatchTotalSum(unloadGrId);
        const { error } = await window._supabase
            .from(TABLES.GEAR_UNLOAD)
            .update({ catch: catchTotal })
            .eq('unload_gr_id', unloadGrId);
        
        if (error) {
            console.error('Error updating gear unload catch:', error);
        }
    } catch (error) {
        console.error('Error in updateGearUnloadCatch:', error);
    }
}

// Vessel Catch table
async function loadVesselCatchData(vUnloadId) {
    const tableBody = document.getElementById('vesselCatchTableBody');
    const footer = document.getElementById('vesselCatchTableFooter');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';
    }
    if (footer) footer.style.display = 'none';

    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_CATCH)
            .select(`
                catch_id,
                species_id,
                samp_kg,
                catch_kg,
                len_id,
                lenunit_id
            `)
            .eq('v_unload_id', vUnloadId)
            .order('catch_id', { ascending: true });

        if (error) throw error;

        vesselCatchList = data || [];
        if (!vesselCatchList || vesselCatchList.length === 0) {
            selectedCatchId = null;
        }
        // Ensure selectedCatchId still exists after data refresh
        if (selectedCatchId) {
            const exists = vesselCatchList.some(vc => String(vc.catch_id || vc.Catch_id || vc.catch_Id) === String(selectedCatchId));
            if (!exists) {
                selectedCatchId = null;
            }
        }

        if (!data || data.length === 0) {
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-5 text-muted">
                            <div>No vessel catch records found for this vessel unload.</div>
                            <div class="mt-3">
                                <button type="button" class="btn vessel-catch-add-btn btn-sm w-100" onclick="handleVesselCatchAdd()">
                                    <i class="bi bi-plus-lg me-2"></i>Add Vessel Catch
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
            showSampleLengthEmpty('No sample length records found.');
            return;
        }

        let totalSamp = 0;
        let totalCatch = 0;

        // Default selection to first record if none selected
        if (!selectedCatchId && vesselCatchList.length > 0) {
            const firstCatchId = vesselCatchList[0].catch_id || vesselCatchList[0].Catch_id || vesselCatchList[0].catch_Id;
            selectedCatchId = firstCatchId ? String(firstCatchId) : null;
        }

        if (tableBody) {
            tableBody.innerHTML = data.map(rec => {
                const speciesName = speciesMap[rec.species_id] || rec.species_id || '-';
                const sampKg = rec.samp_kg != null ? parseFloat(rec.samp_kg).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                const catchKg = rec.catch_kg != null ? parseFloat(rec.catch_kg).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                const lenType = rec.len_id || '-';
                const lenUnit = rec.lenunit_id || '-';
                const catchId = rec.catch_id || rec.Catch_id || rec.catch_Id;
                const isSelected = selectedCatchId && String(selectedCatchId) === String(catchId);

                totalSamp += rec.samp_kg ? parseFloat(rec.samp_kg) : 0;
                totalCatch += rec.catch_kg ? parseFloat(rec.catch_kg) : 0;

                return `
                    <tr class="vessel-catch-row ${isSelected ? 'selected-row' : ''}" data-catch-id="${catchId}" onclick="handleVesselCatchRowSelect('${catchId}')">
                        <td>${Validation.escapeHtml(speciesName)}</td>
                        <td class="text-center">${sampKg}</td>
                        <td class="text-center">${catchKg}</td>
                        <td class="text-center">${Validation.escapeHtml(lenType)}</td>
                        <td class="text-center">${Validation.escapeHtml(lenUnit)}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-edit me-1" title="Edit Vessel Catch" onclick="handleVesselCatchEdit('${catchId}'); event.stopPropagation();">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-delete" title="Delete Vessel Catch" onclick="handleVesselCatchDelete('${catchId}'); event.stopPropagation();">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        if (footer) footer.style.display = '';

        const totalSampEl = document.getElementById('vesselCatchTotalSampKg');
        const totalCatchEl = document.getElementById('vesselCatchTotalCatchKg');
        if (totalSampEl) totalSampEl.textContent = totalSamp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (totalCatchEl) totalCatchEl.textContent = totalCatch.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Refresh sample length table for selected catch
        if (currentVesselUnloadId) {
            await loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
        }
    } catch (error) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading vessel catch data. Please refresh.</td></tr>';
        }
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadVesselCatchData',
            userMessage: 'Failed to load vessel catch data'
        });
    }
}

function wireCatchButtons() {
    const addBtn = document.getElementById('addVesselCatchBtn');
    const addFooterBtn = document.getElementById('addVesselCatchFooterBtn');
    if (addBtn) addBtn.addEventListener('click', handleVesselCatchAdd);
    if (addFooterBtn) addFooterBtn.addEventListener('click', handleVesselCatchAdd);
    const vcSaveBtn = document.getElementById('vcSaveBtn');
    if (vcSaveBtn) vcSaveBtn.addEventListener('click', saveVesselCatch);
    const vcConfirmDeleteBtn = document.getElementById('vcConfirmDeleteBtn');
    if (vcConfirmDeleteBtn) vcConfirmDeleteBtn.addEventListener('click', confirmDeleteVesselCatch);
}

function handleVesselCatchAdd() {
    if (!currentVesselUnloadId) {
        window.toast.error('Vessel unload ID is missing.');
        return;
    }
    vesselCatchModalMode = 'add';
    vesselCatchEditingId = null;
    resetVesselCatchForm();
    openVesselCatchModal('Add Vessel Catch');
}

function handleVesselCatchEdit(catchId) {
    if (!catchId) return;
    vesselCatchModalMode = 'edit';
    vesselCatchEditingId = catchId;
    openVesselCatchModal('Edit Vessel Catch', catchId);
}

function handleVesselCatchRowSelect(catchId) {
    selectedCatchId = catchId ? String(catchId) : null;
    highlightSelectedCatchRow();
    if (currentVesselUnloadId) {
        loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
    }
}

function highlightSelectedCatchRow() {
    const rows = document.querySelectorAll('.vessel-catch-row');
    rows.forEach(row => {
        const rid = row.getAttribute('data-catch-id');
        if (selectedCatchId && String(selectedCatchId) === String(rid)) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    });
}

async function handleVesselCatchDelete(catchId) {
    if (!catchId) return;
    vesselCatchIdToDelete = catchId;
    const modalEl = document.getElementById('vcDeleteModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

// Sample Length table
async function loadSampleLengthData(vUnloadId, catchIdOverride = null) {
    const tableBody = document.getElementById('sampleLengthTableBody');
    const footer = document.getElementById('sampleLengthTableFooter');

    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="2" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading...</td></tr>';
    }
    if (footer) {
        footer.style.display = 'none';
        footer.classList.add('d-none');
    }

    const catchIds = (vesselCatchList || []).map(vc => vc.catch_id || vc.Catch_id || vc.catch_Id).filter(Boolean);
    if (!catchIds.length) {
        showSampleLengthEmpty('No sample length records found.');
        updateSampleLengthSpeciesInfo(); // Hide species info if no catch
        return;
    }

    const targetCatchId = catchIdOverride || selectedCatchId || (catchIds.length > 0 ? catchIds[0] : null);
    if (!targetCatchId) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="2" class="text-center py-5 text-muted">Select a vessel catch to view sample lengths.</td></tr>';
        }
        hideSampleLengthControls();
        updateSampleLengthSpeciesInfo(); // Hide species info if no catch selected
        return;
    }

    try {
        const { data, error } = await window._supabase
            .from(TABLES.SAMPLE_LENGTHS)
            .select('length_id, catch_id, len')
            .eq('catch_id', targetCatchId)
            .order('len', { ascending: false });

        if (error) throw error;

        sampleLengthList = data || [];
        sampleLengthPage = 1; // reset to first page on reload
        renderSampleLengthTable(sampleLengthList);
        if (footer) footer.style.display = '';
    } catch (error) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="2" class="text-center text-danger py-4">Error loading sample length data. Please refresh.</td></tr>';
        }
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadSampleLengthData',
            userMessage: 'Failed to load sample length data'
        });
    }
}

function renderSampleLengthTable(data) {
    const tableBody = document.getElementById('sampleLengthTableBody');
    const footer = document.getElementById('sampleLengthTableFooter');
    if (!tableBody) return;

    const total = data ? data.length : 0;

    // Update species info display
    updateSampleLengthSpeciesInfo();

    if (!data || total === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="2" class="text-center py-5 text-muted">
                    <div>No sample length records found.</div>
                    <div class="mt-3">
                        <button type="button" class="btn vessel-catch-add-btn btn-sm w-100" onclick="handleSampleLengthAdd()">
                            <i class="bi bi-plus-lg me-2"></i>Add Sample Length
                        </button>
                    </div>
                </td>
            </tr>
        `;
        if (footer) {
            footer.style.display = 'none';
            footer.classList.add('d-none');
        }
        hideSampleLengthControls();
        return;
    }

    const pageSize = sampleLengthPageSize || 10;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    sampleLengthPage = Math.min(Math.max(sampleLengthPage, 1), totalPages);
    const startIdx = (sampleLengthPage - 1) * pageSize;
    const pageData = data.slice(startIdx, startIdx + pageSize);

    const isViewer = currentUser && currentUser.role === ROLES.VIEWER;

    tableBody.innerHTML = pageData.map(rec => {
        const lengthVal = rec.len != null ? parseFloat(rec.len).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

        let actions = `
            <button class="btn btn-sm btn-edit me-1" title="Edit Sample Length" onclick="handleSampleLengthEdit('${rec.length_id || rec.Length_id}'); event.stopPropagation();">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-delete" title="Delete Sample Length" onclick="handleSampleLengthDelete('${rec.length_id || rec.Length_id}'); event.stopPropagation();">
                <i class="bi bi-trash"></i>
            </button>
        `;
        if (isViewer) {
            actions = '<span class="text-muted small fst-italic">Read-only</span>';
        }

        return `
            <tr>
                <td class="text-center">${lengthVal}</td>
                <td class="text-end">${actions}</td>
            </tr>
        `;
    }).join('');

    if (footer) {
        footer.style.display = '';
        footer.classList.remove('d-none');
    }

    updateSampleLengthPagination(total);
}

function updateSampleLengthSpeciesInfo() {
    const speciesInfoEl = document.getElementById('sampleLengthSpeciesInfo');
    const speciesNameEl = document.getElementById('sampleLengthSpeciesName');
    const speciesFamilyEl = document.getElementById('sampleLengthSpeciesFamily');
    const speciesScientificEl = document.getElementById('sampleLengthSpeciesScientific');

    if (!speciesInfoEl || !selectedCatchId) {
        if (speciesInfoEl) speciesInfoEl.style.display = 'none';
        return;
    }

    const catchRecord = (vesselCatchList || []).find(vc => String(vc.catch_id || vc.Catch_id || vc.catch_Id) === String(selectedCatchId));
    if (!catchRecord) {
        if (speciesInfoEl) speciesInfoEl.style.display = 'none';
        return;
    }

    const speciesId = catchRecord.species_id;
    const speciesDetails = speciesDetailsMap[speciesId] || { name: '-', family: '-', scientific: '-' };

    if (speciesNameEl) speciesNameEl.textContent = Validation.escapeHtml(speciesDetails.name);
    if (speciesFamilyEl) speciesFamilyEl.textContent = Validation.escapeHtml(speciesDetails.family);
    if (speciesScientificEl) speciesScientificEl.textContent = Validation.escapeHtml(speciesDetails.scientific);

    if (speciesInfoEl) speciesInfoEl.style.display = 'block';
}

function wireSampleLengthButtons() {
    const addBtn = document.getElementById('addSampleLengthFooterBtn');
    if (addBtn) addBtn.addEventListener('click', handleSampleLengthAdd);
    const slSaveBtn = document.getElementById('slSaveBtn');
    if (slSaveBtn) slSaveBtn.addEventListener('click', saveSampleLength);
    const slConfirmDeleteBtn = document.getElementById('slConfirmDeleteBtn');
    if (slConfirmDeleteBtn) slConfirmDeleteBtn.addEventListener('click', confirmDeleteSampleLength);
    const slForm = document.getElementById('slForm');
    if (slForm) {
        slForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSampleLength();
        });
    }
}

function wireSampleLengthPagination() {
    const sizeSelect = document.getElementById('sampleLengthPageSize');
    const pagination = document.getElementById('sampleLengthPagination');

    if (sizeSelect) {
        sizeSelect.addEventListener('change', () => {
            const val = parseInt(sizeSelect.value, 10);
            sampleLengthPageSize = isNaN(val) ? 10 : val;
            sampleLengthPage = 1;
            renderSampleLengthTable(sampleLengthList);
        });
    }

    if (pagination) {
        pagination.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-page]');
            if (!btn) return;
            const targetPage = parseInt(btn.getAttribute('data-page'), 10);
            if (isNaN(targetPage)) return;
            sampleLengthPage = targetPage;
            renderSampleLengthTable(sampleLengthList);
        });
    }
}

function updateSampleLengthPagination(total) {
    const controls = document.getElementById('sampleLengthControls');
    const info = document.getElementById('sampleLengthRowsInfo');
    const pagination = document.getElementById('sampleLengthPagination');
    const sizeSelect = document.getElementById('sampleLengthPageSize');

    if (!controls) return;

    if (!total || total === 0) {
        controls.style.display = 'none';
        if (pagination) pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(total / sampleLengthPageSize));
    sampleLengthPage = Math.min(sampleLengthPage, totalPages);
    const startIdx = (sampleLengthPage - 1) * sampleLengthPageSize + 1;
    const endIdx = Math.min(sampleLengthPage * sampleLengthPageSize, total);

    controls.style.display = '';
    if (info) info.textContent = `Showing ${startIdx} to ${endIdx} of ${total} entries`;
    if (sizeSelect && sizeSelect.value !== String(sampleLengthPageSize)) {
        sizeSelect.value = String(sampleLengthPageSize);
    }

    if (pagination) {
        let html = '';
        const prevDisabled = sampleLengthPage <= 1 ? 'disabled' : '';
        const nextDisabled = sampleLengthPage >= totalPages ? 'disabled' : '';

        html += `
            <li class="page-item ${prevDisabled}">
                <button type="button" class="page-link" data-page="${sampleLengthPage - 1}" ${prevDisabled ? 'disabled' : ''}>Previous</button>
            </li>
        `;

        for (let page = 1; page <= totalPages; page += 1) {
            const active = page === sampleLengthPage ? 'active' : '';
            html += `
                <li class="page-item ${active}">
                    <button type="button" class="page-link" data-page="${page}">${page}</button>
                </li>
            `;
        }

        html += `
            <li class="page-item ${nextDisabled}">
                <button type="button" class="page-link" data-page="${sampleLengthPage + 1}" ${nextDisabled ? 'disabled' : ''}>Next</button>
            </li>
        `;

        pagination.innerHTML = html;
    }
}

function openVesselCatchModal(title, catchId = null) {
    const modalEl = document.getElementById('vcModal');
    if (!modalEl) return;
    const titleEl = document.getElementById('vcModalTitle');
    if (titleEl) titleEl.textContent = title;
    populateSpeciesDropdown();

    if (catchId) {
        populateVesselCatchForm(catchId);
    } else {
        resetVesselCatchForm();
    }

    // Show vessel unload info (read-only)
    const vuDisplay = document.getElementById('vcVUnloadDisplay');
    if (vuDisplay) {
        const vu = currentVesselUnloadData || {};
        const vesselName = vu.vesselname || vu.vessel_name || '';
        const gear = vu.gearDesc || vu.unload_gr_id || '';
        vuDisplay.value = `${vesselName ? vesselName + ' - ' : ''}${gear || ''}`.trim() || (currentVesselUnloadId || '');
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function resetVesselCatchForm() {
    setInputValue('vcCatchId', '');
    setSelectValue('vcSpeciesId', '');
    setInputValue('vcCatchKg', '');
    setInputValue('vcSampKg', '');
    setSelectValue('vcLenId', '');
    setSelectValue('vcLenunitId', '');
    setInputValue('vcTotalKg', '');
    setInputValue('vcTotalwtIfmeasuredKg', '');
    toggleVcSaveLoading(false);
}

function populateSpeciesDropdown() {
    const select = document.getElementById('vcSpeciesId');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="" disabled selected>Select Species</option>';
    if (speciesMap) {
        const entries = Object.entries(speciesMap).sort((a, b) => a[1].localeCompare(b[1]));
        entries.forEach(([id, name]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = Validation.escapeHtml(name || `Species #${id}`);
            select.appendChild(opt);
        });
    }
    if (currentValue) {
        select.value = currentValue;
    }
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value !== null && value !== undefined ? value : '';
}

function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value !== null && value !== undefined ? value : '';
}

async function populateVesselCatchForm(catchId) {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL_CATCH)
            .select('*')
            .eq('catch_id', catchId)
            .single();
        if (error) throw error;
        if (!data) return;

        setInputValue('vcCatchId', data.catch_id);
        setSelectValue('vcSpeciesId', data.species_id || '');
        setInputValue('vcCatchKg', data.catch_kg ?? '');
        setInputValue('vcSampKg', data.samp_kg ?? '');
        setSelectValue('vcLenId', data.len_id || '');
        setSelectValue('vcLenunitId', data.lenunit_id || '');
        setInputValue('vcTotalKg', data.total_kg ?? '');
        setInputValue('vcTotalwtIfmeasuredKg', data.totalwt_ifmeasured_kg ?? data.totalwtIfmeasuredKg ?? '');
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.populateVesselCatchForm',
            userMessage: 'Failed to load vessel catch for editing'
        });
    }
}

function toggleVcSaveLoading(isLoading) {
    const btn = document.getElementById('vcSaveBtn');
    if (!btn) return;
    const label = btn.querySelector('.save-label');
    const spinner = btn.querySelector('.spinner-border');
    btn.disabled = isLoading;
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    if (label) label.textContent = isLoading ? 'Saving...' : 'Save Vessel Catch';
}

async function saveVesselCatch() {
    if (!currentVesselUnloadId) {
        window.toast.error('Vessel unload ID is missing.');
        return;
    }
    const species_id = document.getElementById('vcSpeciesId')?.value || null;
    if (!species_id) {
        window.toast.error('Please select a species.');
        return;
    }
    const payload = {
        v_unload_id: currentVesselUnloadId,
        species_id,
        catch_kg: parseNullableFloat(document.getElementById('vcCatchKg')?.value),
        samp_kg: parseNullableFloat(document.getElementById('vcSampKg')?.value),
        len_id: document.getElementById('vcLenId')?.value || null,
        lenunit_id: document.getElementById('vcLenunitId')?.value || null,
        total_kg: parseNullableFloat(document.getElementById('vcTotalKg')?.value),
        totalwt_ifmeasured_kg: parseNullableFloat(document.getElementById('vcTotalwtIfmeasuredKg')?.value)
    };

    toggleVcSaveLoading(true);
    try {
        if (vesselCatchModalMode === 'edit' && vesselCatchEditingId) {
            const { error } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .update(payload)
                .eq('catch_id', vesselCatchEditingId);
            if (error) throw error;
            window.toast.success('Vessel catch updated.');
            selectedCatchId = vesselCatchEditingId;
        } else {
            const { data, error } = await window._supabase
                .from(TABLES.VESSEL_CATCH)
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            if (data && data.catch_id) {
                selectedCatchId = data.catch_id;
            }
            window.toast.success('Vessel catch added.');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('vcModal'));
        if (modal) modal.hide();
        await loadVesselCatchData(currentVesselUnloadId);
        
        // Update catch_total and catch_samp in vessel unload record
        const catchTotal = await getVesselCatchTotalSum(currentVesselUnloadId);
        const catchSamp = await getVesselCatchSampSum(currentVesselUnloadId);
        const { error: updateError } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .update({ 
                catch_total: catchTotal,
                catch_samp: catchSamp
            })
            .eq('v_unload_id', currentVesselUnloadId);
        
        if (updateError) {
            console.error('Error updating vessel unload catch_total and catch_samp:', updateError);
        } else {
            // Reload vessel unload detail to update summary card
            await loadVesselUnloadDetail(currentVesselUnloadId);
            
            // Update gear unload catch if unload_gr_id is available
            if (currentVesselUnloadData && currentVesselUnloadData.unload_gr_id) {
                await updateGearUnloadCatch(currentVesselUnloadData.unload_gr_id);
            }
        }
        
        // Update catch_total in vessel unload edit form if modal is open
        await updateVesselUnloadCatchTotalField(currentVesselUnloadId);
        
        if (selectedCatchId) {
            await loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
        }
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.saveVesselCatch',
            userMessage: 'Failed to save vessel catch'
        });
    } finally {
        toggleVcSaveLoading(false);
    }
}

function parseNullableFloat(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

async function confirmDeleteVesselCatch() {
    if (!vesselCatchIdToDelete) return;
    const btn = document.getElementById('vcConfirmDeleteBtn');
    if (btn) btn.disabled = true;
    try {
        const { error } = await window._supabase
            .from(TABLES.VESSEL_CATCH)
            .delete()
            .eq('catch_id', vesselCatchIdToDelete);
        if (error) throw error;
        window.toast.success('Vessel catch deleted.');
        const modal = bootstrap.Modal.getInstance(document.getElementById('vcDeleteModal'));
        if (modal) modal.hide();
        vesselCatchIdToDelete = null;
        if (currentVesselUnloadId) {
            await loadVesselCatchData(currentVesselUnloadId);
            
            // Update catch_total and catch_samp in vessel unload record
            const catchTotal = await getVesselCatchTotalSum(currentVesselUnloadId);
            const catchSamp = await getVesselCatchSampSum(currentVesselUnloadId);
            const { error: updateError } = await window._supabase
                .from(TABLES.VESSEL_UNLOAD)
                .update({ 
                    catch_total: catchTotal,
                    catch_samp: catchSamp
                })
                .eq('v_unload_id', currentVesselUnloadId);
            
            if (updateError) {
                console.error('Error updating vessel unload catch_total and catch_samp:', updateError);
            } else {
                // Reload vessel unload detail to update summary card
                await loadVesselUnloadDetail(currentVesselUnloadId);
                
                // Update gear unload catch if unload_gr_id is available
                if (currentVesselUnloadData && currentVesselUnloadData.unload_gr_id) {
                    await updateGearUnloadCatch(currentVesselUnloadData.unload_gr_id);
                }
            }
            
            // Update catch_total and catch_samp in vessel unload edit form if modal is open
            await updateVesselUnloadCatchTotalField(currentVesselUnloadId);
            
            if (selectedCatchId) {
                await loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
            }
        }
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.confirmDeleteVesselCatch',
            userMessage: 'Failed to delete vessel catch'
        });
    } finally {
        if (btn) btn.disabled = false;
    }
}

function hideSampleLengthControls() {
    const controls = document.getElementById('sampleLengthControls');
    if (controls) controls.style.display = 'none';
}

function showSampleLengthEmpty(message) {
    const tableBody = document.getElementById('sampleLengthTableBody');
    const footer = document.getElementById('sampleLengthTableFooter');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="2" class="text-center py-5 text-muted">${message}</td></tr>`;
    }
    if (footer) {
        footer.style.display = 'none';
        footer.classList.add('d-none');
    }
    hideSampleLengthControls();
    updateSampleLengthSpeciesInfo(); // Hide species info when empty
}

function openSampleLengthModal(title, lengthId = null) {
    const modalEl = document.getElementById('slModal');
    if (!modalEl) return;
    const titleEl = document.getElementById('slModalTitle');
    if (titleEl) titleEl.textContent = title;

    const catchSelect = document.getElementById('slCatchSelect');
    if (catchSelect) {
        catchSelect.innerHTML = '';
        const catchRecord = (vesselCatchList || []).find(vc => String(vc.catch_id || vc.Catch_id || vc.catch_Id) === String(selectedCatchId));
        const speciesName = catchRecord ? (speciesMap[catchRecord.species_id] || catchRecord.species_id || '-') : '-';
        const opt = document.createElement('option');
        opt.value = catchRecord ? String(catchRecord.catch_id || catchRecord.Catch_id || catchRecord.catch_Id) : '';
        opt.textContent = speciesName;
        opt.selected = true;
        catchSelect.appendChild(opt);
        catchSelect.disabled = true;
    }

    if (lengthId) {
        populateSampleLengthForm(lengthId);
    } else {
        resetSampleLengthForm();
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function resetSampleLengthForm() {
    setInputValue('slLengthId', '');
    setInputValue('slLengthValue', '');
    toggleSlSaveLoading(false);
}

async function populateSampleLengthForm(lengthId) {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.SAMPLE_LENGTHS)
            .select('*')
            .eq('length_id', lengthId)
            .single();
        if (error) throw error;
        if (!data) return;

        setInputValue('slLengthId', data.length_id);
        setInputValue('slLengthValue', data.len ?? '');
        selectedCatchId = data.catch_id || selectedCatchId;
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.populateSampleLengthForm',
            userMessage: 'Failed to load sample length for editing'
        });
    }
}

async function saveSampleLength() {
    if (!selectedCatchId) {
        window.toast.error('Please select a vessel catch first.');
        return;
    }
    const lenVal = parseNullableFloat(document.getElementById('slLengthValue')?.value);
    if (lenVal === null) {
        window.toast.error('Please enter a length value.');
        return;
    }

    const payload = {
        catch_id: selectedCatchId,
        len: lenVal
    };

    toggleSlSaveLoading(true);
    try {
        if (sampleLengthModalMode === 'edit' && sampleLengthEditingId) {
            const { error } = await window._supabase
                .from(TABLES.SAMPLE_LENGTHS)
                .update(payload)
                .eq('length_id', sampleLengthEditingId);
            if (error) throw error;
            window.toast.success('Sample length updated.');
        } else {
            const { error } = await window._supabase
                .from(TABLES.SAMPLE_LENGTHS)
                .insert(payload);
            if (error) throw error;
            window.toast.success('Sample length added.');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('slModal'));
        if (modal) modal.hide();
        if (currentVesselUnloadId) {
            await loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
        }
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.saveSampleLength',
            userMessage: 'Failed to save sample length'
        });
    } finally {
        toggleSlSaveLoading(false);
    }
}

async function confirmDeleteSampleLength() {
    if (!sampleLengthIdToDelete) return;
    const btn = document.getElementById('slConfirmDeleteBtn');
    if (btn) btn.disabled = true;
    try {
        const { error } = await window._supabase
            .from(TABLES.SAMPLE_LENGTHS)
            .delete()
            .eq('length_id', sampleLengthIdToDelete);
        if (error) throw error;
        window.toast.success('Sample length deleted.');
        const modal = bootstrap.Modal.getInstance(document.getElementById('slDeleteModal'));
        if (modal) modal.hide();
        sampleLengthIdToDelete = null;
        if (currentVesselUnloadId) {
            await loadSampleLengthData(currentVesselUnloadId, selectedCatchId);
        }
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.confirmDeleteSampleLength',
            userMessage: 'Failed to delete sample length'
        });
    } finally {
        if (btn) btn.disabled = false;
    }
}

function toggleSlSaveLoading(isLoading) {
    const btn = document.getElementById('slSaveBtn');
    if (!btn) return;
    const label = btn.querySelector('.sl-save-label');
    const spinner = btn.querySelector('.spinner-border');
    btn.disabled = isLoading;
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    if (label) label.textContent = isLoading ? 'Saving...' : 'Save Sample Length';
}
function handleSampleLengthAdd() {
    if (!selectedCatchId) {
        window.toast.error('Please select a vessel catch first.');
        return;
    }
    sampleLengthModalMode = 'add';
    sampleLengthEditingId = null;
    resetSampleLengthForm();
    openSampleLengthModal('Add Sample Length');
}

function handleSampleLengthEdit(lengthId) {
    if (!lengthId) return;
    sampleLengthModalMode = 'edit';
    sampleLengthEditingId = lengthId;
    openSampleLengthModal('Edit Sample Length', lengthId);
}

async function handleSampleLengthDelete(lengthId) {
    if (!lengthId) return;
    sampleLengthIdToDelete = lengthId;
    const modalEl = document.getElementById('slDeleteModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

// Delete vessel unload
function wireDeleteButton() {
    const deleteBtn = document.getElementById('vuDeleteBtn');
    if (!deleteBtn) return;
    deleteBtn.addEventListener('click', () => {
        const modalEl = document.getElementById('deleteVesselUnloadModal');
        if (!modalEl) return;
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    });

    const confirmBtn = document.getElementById('confirmDeleteVesselUnloadBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!currentVesselUnloadId) {
                window.toast.error('Vessel unload ID is missing.');
                return;
            }
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
            try {
                const { error } = await window._supabase
                    .from(TABLES.VESSEL_UNLOAD)
                    .delete()
                    .eq('v_unload_id', currentVesselUnloadId);
                if (error) throw error;
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteVesselUnloadModal'));
                if (modal) modal.hide();
                window.toast.success('Vessel unload deleted successfully.');
                returnToSamplingDay(currentUnloadDayId);
            } catch (error) {
                ErrorHandler.handle(error, {
                    context: 'VesselUnloadDetail.deleteVesselUnload',
                    userMessage: 'Failed to delete vessel unload'
                });
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Delete';
            }
        });
    }
}

// Edit wiring
function wireEditButton() {
    const editBtn = document.getElementById('vuEditBtn');
    if (editBtn) editBtn.addEventListener('click', openEditModal);

    const saveBtn = document.getElementById('vuEditSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveVesselUnloadEdit);

    const modalEl = document.getElementById('vuEditModal');
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', resetEditModal);
    }
}

async function loadVessels() {
    try {
        const { data, error } = await window._supabase
            .from(TABLES.VESSEL)
            .select('boat_id, vesselname')
            .order('vesselname', { ascending: true });
        if (error) throw error;
        allVessels = data || [];
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.loadVessels',
            userMessage: 'Failed to load vessels',
            showToast: false
        });
    }
}

function populateVesselDropdown(selectId, boatId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Select Vessel...</option>';
    allVessels.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.boat_id || v.Boat_id || v.boat_Id;
        opt.textContent = Validation.escapeHtml(v.vesselname || '-');
        select.appendChild(opt);
    });
    if (boatId) select.value = boatId;
}

async function openEditModal() {
    const modalEl = document.getElementById('vuEditModal');
    if (!modalEl) return;

    const vu = currentVesselUnloadData || {};
    populateVesselDropdown('vuEditBoatId', vu.boat_id || detailText('detailVesselId'));

    const unloadGrSelect = document.getElementById('vuEditUnloadGrId');
    if (unloadGrSelect) {
        unloadGrSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = vu.unload_gr_id || detailText('detailGearUnloadId');
        opt.textContent = vu.gearDesc || detailText('summaryGearUnload') || detailText('detailGearUnloadId');
        opt.selected = true;
        unloadGrSelect.appendChild(opt);
        unloadGrSelect.disabled = true;
    }

    setInputValue('vuEditVUnloadId', currentVesselUnloadId);
    setInputValue('vuEditBoatId', vu.boat_id || detailText('detailVesselId'));

    setEffortUnitSelect('vuEditUniteffortId', 'summaryEffortUnit1', 'vuEditEffort');
    setEffortUnitSelect('vuEditUniteffort2Id', 'summaryEffortUnit2', 'vuEditEffort2');
    setEffortUnitSelect('vuEditUniteffort3Id', 'summaryEffortUnit3', 'vuEditEffort3');

    // Prefer summary values (visible in the header tables); fall back to any detail fields if present.
    setInputValue('vuEditEffort', vu.effort ?? rawNumberText('summaryEffort1') ?? rawNumberText('detailEffort1'));
    setInputValue('vuEditEffort2', vu.effort_2 ?? rawNumberText('summaryEffort2') ?? rawNumberText('detailEffort2'));
    setInputValue('vuEditEffort3', vu.effort_3 ?? rawNumberText('summaryEffort3') ?? rawNumberText('detailEffort3'));
    setInputValue('vuEditBoxesTotal', vu.boxes_total ?? rawNumberText('summaryBoxesTotal'));
    setInputValue('vuEditBoxesSamp', vu.boxes_samp ?? rawNumberText('summaryBoxesSamp'));
    
    // Calculate catch_total and catch_samp from vessel catch records
    const catchTotal = await getVesselCatchTotalSum(currentVesselUnloadId);
    const catchSamp = await getVesselCatchSampSum(currentVesselUnloadId);
    
    setInputValue('vuEditCatchTotal', catchTotal.toFixed(2));
    setInputValue('vuEditCatchSamp', catchSamp.toFixed(2));
    setInputValue('vuEditBoxesPiecesId', vu.boxes_pieces_id ?? rawNumberText('detailBoxesPiecesId'));

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function setEffortUnitSelect(selectId, labelSpanId, effortInputId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const label = detailText(labelSpanId);
    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    defaultOpt.textContent = label && label !== '-' ? label : 'Select Fishing Effort...';
    select.appendChild(defaultOpt);
    select.disabled = true;

    const effortInput = document.getElementById(effortInputId);
    if (effortInput) {
        const hasUnit = label && label !== '-';
        effortInput.disabled = !hasUnit;
        if (!hasUnit) {
            effortInput.value = '';
        }
    }
}

function rawNumberText(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    const val = el.textContent || '';
    const numeric = parseFloat(val.replace(/,/g, ''));
    return isNaN(numeric) ? '' : numeric;
}

function detailText(id) {
    const el = document.getElementById(id);
    return el ? el.textContent || '' : '';
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value !== null && value !== undefined ? value : '';
}

function resetEditModal() {
    const form = document.getElementById('vuEditForm');
    if (form) form.reset();
    ['vuEditUniteffortId', 'vuEditUniteffort2Id', 'vuEditUniteffort3Id'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '<option value="" disabled selected>Select Fishing Effort...</option>';
            sel.disabled = true;
        }
    });
    ['vuEditEffort', 'vuEditEffort2', 'vuEditEffort3'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) {
            inp.disabled = true;
            inp.value = '';
        }
    });
}

async function saveVesselUnloadEdit() {
    if (!currentVesselUnloadId) {
        window.toast.error('Vessel unload ID is missing.');
        return;
    }

    const unloadGrId = document.getElementById('vuEditUnloadGrId').value;
    const boatId = document.getElementById('vuEditBoatId').value;
    const effort = document.getElementById('vuEditEffort').value;
    const uniteffortId = document.getElementById('vuEditUniteffortId').value;
    const boxesTotal = document.getElementById('vuEditBoxesTotal').value;
    // Calculate catch_total and catch_samp from vessel catch records (don't read from form as they're read-only)
    const catchTotal = await getVesselCatchTotalSum(currentVesselUnloadId);
    const catchSamp = await getVesselCatchSampSum(currentVesselUnloadId);
    const boxesSamp = document.getElementById('vuEditBoxesSamp').value;
    const boxesPiecesId = document.getElementById('vuEditBoxesPiecesId').value;
    const effort2 = document.getElementById('vuEditEffort2').value;
    const uniteffort2Id = document.getElementById('vuEditUniteffort2Id').value;
    const effort3 = document.getElementById('vuEditEffort3').value;
    const uniteffort3Id = document.getElementById('vuEditUniteffort3Id').value;
    const saveBtn = document.getElementById('vuEditSaveBtn');

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

    const effortInput = document.getElementById('vuEditEffort');
    if (effortInput && !effortInput.disabled) {
        const effortValidation = Validation.isRequired(effort, 'Effort 1');
        if (!effortValidation.isValid) {
            window.toast.error(effortValidation.error);
            return;
        }
        const effortNum = parseFloat(effort);
        if (isNaN(effortNum) || effortNum < 0) {
            window.toast.error('Effort 1 must be a non-negative number.');
            return;
        }
    }

    if (effort2 && (isNaN(parseFloat(effort2)) || parseFloat(effort2) < 0)) {
        window.toast.error('Effort 2 must be a non-negative number.');
        return;
    }
    if (effort3 && (isNaN(parseFloat(effort3)) || parseFloat(effort3) < 0)) {
        window.toast.error('Effort 3 must be a non-negative number.');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const payload = {
        unload_gr_id: unloadGrId ? parseInt(unloadGrId) : null,
        boat_id: boatId ? parseInt(boatId) : null,
        effort: effortInput && !effortInput.disabled && effort ? parseFloat(effort) : null,
        uniteffort_id: uniteffortId ? parseInt(uniteffortId) : null,
        boxes_total: boxesTotal ? parseInt(boxesTotal) : null,
        catch_total: catchTotal || null,
        boxes_samp: boxesSamp ? parseInt(boxesSamp) : null,
        catch_samp: catchSamp || null,
        boxes_pieces_id: boxesPiecesId ? parseInt(boxesPiecesId) : null,
        effort_2: effort2 ? parseFloat(effort2) : null,
        uniteffort_2_id: uniteffort2Id ? parseInt(uniteffort2Id) : null,
        effort_3: effort3 ? parseFloat(effort3) : null,
        uniteffort_3_id: uniteffort3Id ? parseInt(uniteffort3Id) : null
    };

    try {
        const { error } = await window._supabase
            .from(TABLES.VESSEL_UNLOAD)
            .update(payload)
            .eq('v_unload_id', currentVesselUnloadId);
        if (error) throw error;

        const modal = bootstrap.Modal.getInstance(document.getElementById('vuEditModal'));
        if (modal) modal.hide();
        window.toast.success('Vessel unload updated successfully.');
        if (currentVesselUnloadId) {
            await loadVesselUnloadDetail(currentVesselUnloadId);
            await loadVesselCatchData(currentVesselUnloadId);
            
            // Update catch_total field in case it changed
            await updateVesselUnloadCatchTotalField(currentVesselUnloadId);
        }
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'VesselUnloadDetail.saveVesselUnloadEdit',
            userMessage: 'Failed to save vessel unload'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save';
    }
}

// Navigate back to sampling day detail using unload_day_id if available
function returnToSamplingDay(unloadDayId) {
    if (unloadDayId) {
        window.location.href = `sample-day-detail.html?id=${encodeURIComponent(unloadDayId)}`;
    } else {
        window.location.href = 'sample-day-detail.html';
    }
}

// Hook up return button after data load
function wireReturnButton(unloadDayId) {
    const btn = document.getElementById('vuReturnBtn');
    if (!btn) return;
    btn.onclick = () => returnToSamplingDay(unloadDayId);
}

// Delete vessel unload
function wireDeleteButton() {
    const deleteBtn = document.getElementById('vuDeleteBtn');
    if (!deleteBtn) return;
    deleteBtn.addEventListener('click', () => {
        const modalEl = document.getElementById('deleteVesselUnloadModal');
        if (!modalEl) return;
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    });

    const confirmBtn = document.getElementById('confirmDeleteVesselUnloadBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!currentVesselUnloadId) {
                window.toast.error('Vessel unload ID is missing.');
                return;
            }
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
            try {
                const { error } = await window._supabase
                    .from(TABLES.VESSEL_UNLOAD)
                    .delete()
                    .eq('v_unload_id', currentVesselUnloadId);
                if (error) throw error;
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteVesselUnloadModal'));
                if (modal) modal.hide();
                window.toast.success('Vessel unload deleted successfully.');
                returnToSamplingDay(currentUnloadDayId);
            } catch (error) {
                ErrorHandler.handle(error, {
                    context: 'VesselUnloadDetail.deleteVesselUnload',
                    userMessage: 'Failed to delete vessel unload'
                });
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Delete';
            }
        });
    }
}

