import { db, authPromise } from './config.js';
import { ref, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Global state
let allJobsData = [];
const editableColumns = ['palletOut', 'truckNo', 'loadingStart', 'loadingFinish'];

/**
 * UTILITY FUNCTIONS
 */

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.className = 'notification-bar';
    notification.classList.add(isError ? 'error' : 'success', 'show');
    setTimeout(() => notification.classList.remove('show'), 4000);
}

function showConfirmModal({ title, message, okText = 'OK', onConfirm }) {
    const modal = document.getElementById("confirmModal");
    const okBtn = document.getElementById("okConfirmBtn");

    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalMessage").innerHTML = message;
    okBtn.textContent = okText;

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    const closeModal = () => modal.style.display = "none";
    newOkBtn.onclick = () => {
        closeModal();
        if (typeof onConfirm === "function") onConfirm();
    };
    document.getElementById("cancelConfirmBtn").onclick = closeModal;
    modal.style.display = "flex";
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GB', options).replace(/ /g, '-');
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    // Check if it's already just a time string
    if (typeof dateTimeString === 'string' && /^\d{2}:\d{2}$/.test(dateTimeString)) {
        return dateTimeString;
    }
    const date = new Date(dateTimeString);
    if (isNaN(date)) return dateTimeString; // Return original if invalid
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return `${date.toLocaleDateString('id-ID', dateOptions)} ${date.toLocaleTimeString('id-ID', timeOptions)}`;
}

function formatTimeOnly(value) {
    if (value instanceof Date) {
        return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (typeof value === 'number') { // Excel time is a fraction of a day
        const totalSeconds = value * 24 * 60 * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (typeof value === 'string' && value.includes(':')) {
        return value.substring(0, 5); // Ensure HH:mm format
    }
    return value; // Return as is if it's already a string or other type
}

// Fungsi untuk normalisasi Delivery Note (menghapus leading zeros)
function normalizeDeliveryNote(dn) {
    if (!dn) return '';
    return String(dn).trim().replace(/^0+/, '');
}

/**
 * FIREBASE AND DATA HANDLING
 */

async function loadJobsFromFirebase() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    try {
        await authPromise;
        const snapshot = await get(ref(db, "PhxOutboundJobs"));
        if (snapshot.exists()) {
            allJobsData = Object.entries(snapshot.val()).map(([key, value]) => ({
                jobNo: key,
                ...value
            }));
            displayJobsData();
            showNotification(`Berhasil memuat ${allJobsData.length} data.`, false);
        } else {
            document.getElementById('deliveryTableEditable').innerHTML = '<tr><td colspan="14" style="text-align:center;">Tidak ada data ditemukan.</td></tr>';
            showNotification("Tidak ada data di database.", true);
        }
    } catch (error) {
        console.error("Error loading data from Firebase:", error);
        showNotification("Gagal memuat data dari database.", true);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function displayJobsData() {
    const tableBody = document.getElementById('deliveryTableEditable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    allJobsData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.jobNo);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.deliveryDate || ''}</td>
            <td>${item.deliveryNote || ''}</td>
            <td>${item.owner || ''}</td>
            <td>${item.remark || ''}</td>
            <td>${item.qty || ''}</td>
            <td>${item.loadingSchedule || ''}</td>
            <td>${item.etd || ''}</td>
            <td>${item.eta || ''}</td>
            <td data-field="palletOut">${item.palletOut || ''}</td>
            <td data-field="truckNo">${item.truckNo || ''}</td>
            <td data-field="loadingStart">${formatDateTime(item.loadingStart) || ''}</td>
            <td data-field="loadingFinish">${formatDateTime(item.loadingFinish) || ''}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn-icon btn-edit" data-tooltip="Edit"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn-icon btn-save" style="display: none;" data-tooltip="Simpan"><i class="fas fa-save"></i></button>
                    <button class="action-btn-icon btn-delete" data-tooltip="Hapus"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    setupTableEventListeners();
}

async function handleExcelUpload(file) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';

    try {
        await authPromise;
        const jobsSnapshot = await get(ref(db, "PhxOutboundJobs"));
        if (!jobsSnapshot.exists()) {
            showNotification("Tidak ada data job di database untuk dicocokkan.", true);
            loadingOverlay.style.display = 'none';
            return;
        }

        const allJobs = jobsSnapshot.val();
        const deliveryNoteMap = new Map();
        for (const jobNo in allJobs) {
            if (allJobs[jobNo].deliveryNote) {
                const normalizedDN = normalizeDeliveryNote(allJobs[jobNo].deliveryNote);
                deliveryNoteMap.set(normalizedDN, jobNo);
            }
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const excelData = XLSX.utils.sheet_to_json(worksheet);

                const updates = {};
                let updatedCount = 0;
                const notFound = [];

                excelData.forEach(row => {
                    const deliveryNoteRaw = row['Delivery Note'];
                    if (!deliveryNoteRaw) return;

                    const normalizedDN = normalizeDeliveryNote(deliveryNoteRaw);
                    const jobNo = deliveryNoteMap.get(normalizedDN);
                    
                    if (jobNo) {
                        const loadingTime = formatTimeOnly(row['Loading Schedule']);
                        const etdTime = formatTimeOnly(row['ETD']);
                        const etaTime = formatTimeOnly(row['ETA']);

                        // PERUBAHAN: Simpan hanya waktu (HH:mm)
                        updates[`/PhxOutboundJobs/${jobNo}/loadingSchedule`] = loadingTime;
                        updates[`/PhxOutboundJobs/${jobNo}/etd`] = etdTime;
                        updates[`/PhxOutboundJobs/${jobNo}/eta`] = etaTime;
                        updatedCount++;
                    } else {
                        notFound.push(deliveryNoteRaw);
                    }
                });

                if (Object.keys(updates).length > 0) {
                    await update(ref(db), updates);
                    showNotification(`${updatedCount} data berhasil diupdate.`, false);
                    loadJobsFromFirebase();
                } else {
                    showNotification("Tidak ada data yang cocok untuk diupdate.", true);
                }

                if (notFound.length > 0) {
                    console.warn("Delivery Notes not found in DB:", notFound);
                    showNotification(`${notFound.length} Delivery Note tidak ditemukan: ${notFound.slice(0, 3).join(', ')}...`, true);
                }

            } catch (err) {
                console.error("Error processing Excel file:", err);
                showNotification(`Gagal memproses file: ${err.message}`, true);
            } finally {
                loadingOverlay.style.display = 'none';
                document.getElementById('uploadModal').style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);

    } catch (error) {
        console.error("Firebase error during upload process:", error);
        showNotification("Gagal terhubung ke database.", true);
        loadingOverlay.style.display = 'none';
    }
}

/**
 * EVENT LISTENERS & ACTION HANDLERS
 */

function handleTableClick(event) {
    const target = event.target;
    const editBtn = target.closest('.btn-edit');
    const saveBtn = target.closest('.btn-save');
    const deleteBtn = target.closest('.btn-delete');

    if (!editBtn && !saveBtn && !deleteBtn) return;

    const row = target.closest('tr');
    const jobNo = row.dataset.id;

    if (editBtn) {
        toggleEditMode(row, true);
    } else if (saveBtn) {
        saveRowData(jobNo, row);
    } else if (deleteBtn) {
        deleteRowData(jobNo);
    }
}

function toggleEditMode(row, isEditing) {
    if (!row) return;
    row.classList.toggle('editing', isEditing);
    
    editableColumns.forEach(field => {
        const cell = row.querySelector(`td[data-field="${field}"]`);
        if (cell) {
            cell.contentEditable = isEditing;
            cell.classList.toggle('editable', isEditing);
        }
    });

    row.querySelector('.btn-edit').style.display = isEditing ? 'none' : 'inline-flex';
    row.querySelector('.btn-save').style.display = isEditing ? 'inline-flex' : 'none';

    if (isEditing) {
        const firstEditableCell = row.querySelector('.editable');
        if (firstEditableCell) firstEditableCell.focus();
    }
}

async function saveRowData(jobNo, row) {
    const updates = {};
    editableColumns.forEach(field => {
        const cell = row.querySelector(`td[data-field="${field}"]`);
        if (cell) {
            updates[field] = cell.textContent.trim();
        }
    });

    try {
        await update(ref(db, `PhxOutboundJobs/${jobNo}`), updates);
        showNotification(`Job ${jobNo} berhasil diupdate.`);
        toggleEditMode(row, false);
    } catch (error) {
        console.error("Gagal update data:", error);
        showNotification(`Gagal update Job ${jobNo}.`, true);
    }
}

function deleteRowData(jobNo) {
    showConfirmModal({
        title: 'Konfirmasi Hapus',
        message: `Apakah Anda yakin ingin menghapus Job No: <strong>${jobNo}</strong>?`,
        okText: 'Hapus',
        onConfirm: async () => {
            try {
                await remove(ref(db, `PhxOutboundJobs/${jobNo}`));
                showNotification(`Job ${jobNo} berhasil dihapus.`);
                loadJobsFromFirebase(); // Reload data to reflect deletion
            } catch (error) {
                console.error("Gagal menghapus data:", error);
                showNotification(`Gagal menghapus Job ${jobNo}.`, true);
            }
        }
    });
}

function setupTableEventListeners() {
    const tableBody = document.getElementById('deliveryTableEditable');
    tableBody.removeEventListener('click', handleTableClick);
    tableBody.addEventListener('click', handleTableClick);
}

function setupModals() {
    const uploadModal = document.getElementById('uploadModal');
    const openUploadModalBtn = document.getElementById('openUploadModalBtn');
    const closeUploadModal = document.getElementById('closeUploadModal');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const uploadExcelBtn = document.getElementById('uploadExcel');
    const excelFileInput = document.getElementById('excelFile');
    const fileNameDisplay = document.getElementById('fileName');

    openUploadModalBtn.addEventListener('click', () => {
        uploadModal.style.display = 'flex';
        excelFileInput.value = '';
        fileNameDisplay.textContent = 'Tidak ada file dipilih';
        uploadExcelBtn.disabled = true;
    });

    const closeModal = () => uploadModal.style.display = 'none';
    closeUploadModal.addEventListener('click', closeModal);
    cancelUploadBtn.addEventListener('click', closeModal);

    excelFileInput.addEventListener('change', () => {
        if (excelFileInput.files.length > 0) {
            fileNameDisplay.textContent = excelFileInput.files[0].name;
            uploadExcelBtn.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Tidak ada file dipilih';
            uploadExcelBtn.disabled = true;
        }
    });

    uploadExcelBtn.addEventListener('click', () => {
        if (excelFileInput.files.length > 0) {
            handleExcelUpload(excelFileInput.files[0]);
        } else {
            showNotification('Silakan pilih file terlebih dahulu.', true);
        }
    });
}

function setupExportButton() {
    // Placeholder for export functionality
}

document.addEventListener('DOMContentLoaded', function() {
    loadJobsFromFirebase();
    setupModals();
    setupExportButton();
});