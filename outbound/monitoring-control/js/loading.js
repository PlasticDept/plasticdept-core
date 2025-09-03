import { db, authPromise } from './config.js';
import { ref, get, update, remove, set } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Global state - Menyimpan data dan konfigurasi global
let allJobsData = [];
const editableColumns = ['loadingSchedule', 'etd', 'eta', 'palletOut', 'truckNo', 'loadingStart', 'loadingFinish'];

// Status yang diperbolehkan untuk ditampilkan
const allowedStatuses = ['Pending Pick', 'Packed', 'Completed', 'Pending'];

// Status yang memerlukan efek visual khusus (blinking)
const blinkingStatuses = ['Delay process', 'Delay trucking'];

// Informasi user untuk log aktivitas
const currentUser = (() => {
    try {
        const usernameElement = document.getElementById('userFullName');
        return usernameElement ? usernameElement.textContent : 'PlasticDept';
    } catch (e) {
        return 'PlasticDept';
    }
})();

// Timestamp untuk log aktivitas
const currentDateTime = new Date().toISOString();

/**
 * UTILITY FUNCTIONS - FUNGSI UTILITAS
 */

/**
 * Menampilkan notifikasi ke pengguna
 * @param {string} message - Pesan yang akan ditampilkan
 * @param {boolean} isError - Apakah notifikasi error atau sukses
 */
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.className = 'notification-bar';
    notification.classList.add(isError ? 'error' : 'success', 'show');
    setTimeout(() => notification.classList.remove('show'), 4000);
}

/**
 * Menampilkan modal konfirmasi dengan fungsi callback
 * @param {Object} options - Konfigurasi modal
 */
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

/**
 * Memformat tanggal menjadi format dd-MMM-yyyy yang sama dengan Firebase
 * @param {string|Date} dateString - String tanggal atau objek Date yang akan diformat
 * @returns {string} Tanggal yang sudah diformat
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Menggunakan format yang persis sama dengan di Firebase
    const day = String(date.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

/**
 * Memformat tanggal dan waktu menjadi format dd/MM/yyyy HH:mm
 * @param {string} dateTimeString - String tanggal dan waktu yang akan diformat
 * @returns {string} Tanggal dan waktu yang sudah diformat
 */
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    if (typeof dateTimeString === 'string' && /^\d{2}:\d{2}$/.test(dateTimeString)) {
        return dateTimeString;
    }
    const date = new Date(dateTimeString);
    if (isNaN(date)) return dateTimeString;
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return `${date.toLocaleDateString('id-ID', dateOptions)} ${date.toLocaleTimeString('id-ID', timeOptions)}`;
}

/**
 * Memformat nilai menjadi format waktu HH:mm
 * @param {*} value - Nilai yang akan diformat (Date, number, atau string)
 * @returns {string} Waktu yang sudah diformat
 */
function formatTimeOnly(value) {
    if (value instanceof Date) {
        return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (typeof value === 'number') {
        const totalSeconds = value * 24 * 60 * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (typeof value === 'string' && value.includes(':')) {
        return value.substring(0, 5);
    }
    return value;
}

/**
 * Menstandarkan waktu ke format yang sama untuk perbandingan
 * @param {string} timeStr - String waktu dalam berbagai format
 * @returns {Date} Objek Date untuk perbandingan atau null jika invalid
 */
function standardizeTimeForComparison(timeStr) {
    if (!timeStr) return null;
    
    // Menangani format ISO
    if (typeof timeStr === 'string' && timeStr.includes('T')) {
        const date = new Date(timeStr);
        if (!isNaN(date)) return date;
    }
    
    // Menangani format waktu HH:MM atau "HH:MM" (dalam quotes)
    let timeValue = timeStr;
    if (typeof timeStr === 'string') {
        // Hapus tanda kutip jika ada
        timeValue = timeStr.replace(/^"|"$/g, '');
        
        if (/^\d{2}:\d{2}$/.test(timeValue)) {
            const today = new Date();
            const [hours, minutes] = timeValue.split(':').map(Number);
            today.setHours(hours, minutes, 0, 0);
            return today;
        }
    }
    
    // Menangani format lainnya
    const date = new Date(timeValue);
    return isNaN(date) ? null : date;
}

/**
 * Normalisasi nomor Delivery Note (menghilangkan leading zeros)
 * @param {string} dn - Nomor Delivery Note
 * @returns {string} Nomor Delivery Note yang sudah dinormalisasi
 */
function normalizeDeliveryNote(dn) {
    if (!dn) return '';
    return String(dn).trim().replace(/^0+/, '');
}

/**
 * Menentukan delivery status berdasarkan data job
 * @param {Object} job - Data job
 * @returns {string} Status delivery yang ditentukan
 */
function determineDeliveryStatus(job) {
    const now = new Date(); // Waktu saat ini
    const loadingScheduleTime = standardizeTimeForComparison(job.loadingSchedule);
    
    // Tidak bisa menentukan status jika tidak ada loadingSchedule
    if (!loadingScheduleTime) {
        return '';
    }
    
    // Mendapatkan waktu loadingFinish (diisi manual oleh user)
    const hasLoadingFinish = job.loadingFinish && job.loadingFinish.trim && job.loadingFinish.trim() !== '';
    
    // Kasus 4: Status "Packed" atau "Completed" dengan finishAt dan loadingFinish
    if ((job.status === 'Packed' || job.status === 'Completed') && 
        job.finishAt && 
        hasLoadingFinish) {
        return 'Delivered';
    }
    
    // Kasus 1: Status "Pending Pick" dan Loading Schedule melewati waktu saat ini
    if (job.status === 'Pending Pick' && loadingScheduleTime < now) {
        return 'Delay process';
    }
    
    // Kasus 2 & 3: Status "Packed" dengan kondisi waktu berbeda
    if (job.status === 'Packed') {
        if (loadingScheduleTime < now) {
            // Kasus 3: Loading Schedule melewati waktu saat ini
            return 'Delay trucking';
        } else {
            // Kasus 2: Loading Schedule tidak melewati waktu saat ini
            return 'Material Ready';
        }
    }
    
    // Default: tidak ada status khusus
    return '';
}

/**
 * Mengurutkan data pekerjaan berdasarkan tanggal delivery dan loading schedule
 * @param {Array} data - Array data pekerjaan yang akan diurutkan
 * @returns {Array} Data yang sudah diurutkan
 */
function sortJobsData(data) {
    return [...data].sort((a, b) => {
        // Parsing deliveryDate dari format "dd-MMM-yyyy"
        const dateA = parseDeliveryDate(a.deliveryDate);
        const dateB = parseDeliveryDate(b.deliveryDate);
        
        // Jika tanggal delivery sama, bandingkan waktu loading schedule
        if (dateA.getTime() === dateB.getTime()) {
            const scheduleA = standardizeTimeForComparison(a.loadingSchedule) || new Date(8640000000000000); // Nilai maksimum jika kosong
            const scheduleB = standardizeTimeForComparison(b.loadingSchedule) || new Date(8640000000000000);
            return scheduleA - scheduleB;
        }
        
        // Jika tanggal berbeda, urutkan berdasarkan tanggal
        return dateA - dateB;
    });
}

/**
 * Mengkonversi string tanggal dengan format "dd-MMM-yyyy" menjadi objek Date
 * @param {string} dateString - String tanggal dalam format "dd-MMM-yyyy"
 * @returns {Date} Objek Date hasil konversi atau tanggal default jika invalid
 */
function parseDeliveryDate(dateString) {
    if (!dateString) return new Date(0); // Default ke tanggal paling awal jika kosong
    
    try {
        // Format tanggal: "dd-MMM-yyyy" (misalnya "01-Jan-2025")
        const parts = dateString.split('-');
        if (parts.length !== 3) return new Date(0);
        
        const day = parseInt(parts[0], 10);
        const monthMap = {
            "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
            "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
        };
        const month = monthMap[parts[1]];
        const year = parseInt(parts[2], 10);
        
        if (isNaN(day) || month === undefined || isNaN(year)) return new Date(0);
        
        return new Date(year, month, day);
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return new Date(0);
    }
}

/**
 * Membuat badge HTML untuk status dengan warna yang sesuai
 * @param {string} status - Status yang akan ditampilkan
 * @param {boolean} isDeliveryStatus - Apakah status ini untuk kolom Delivery Status
 * @returns {string} HTML untuk badge status
 */
function getStatusBadge(status, isDeliveryStatus = false) {
    if (!status) return '';
    
    let color, backgroundColor;
    
    // Warna untuk delivery status
    if (isDeliveryStatus) {
        switch (status) {
            case 'Delay process':
            case 'Delay trucking':
                backgroundColor = '#ffebee'; // Latar belakang merah muda
                color = '#d32f2f'; // Teks merah
                break;
            case 'Material Ready':
                backgroundColor = '#e8f5e9'; // Latar belakang hijau muda
                color = '#2e7d32'; // Teks hijau
                break;
            case 'Delivered':
                backgroundColor = '#e3f2fd'; // Latar belakang biru muda
                color = '#1565c0'; // Teks biru
                break;
            default:
                backgroundColor = '#f5f5f5'; // Abu-abu muda
                color = '#616161'; // Abu-abu
        }
    } 
    // Warna untuk job status
    else {
        switch (status) {
            case 'Pending Pick':
                backgroundColor = '#ffebee'; // Latar belakang merah muda
                color = '#d32f2f'; // Teks merah
                break;
            case 'Packed':
                backgroundColor = '#e8f5e9'; // Latar belakang hijau muda
                color = '#2e7d32'; // Teks hijau
                break;
            case 'Completed':
                backgroundColor = '#f5f5f5'; // Latar belakang abu-abu muda
                color = '#616161'; // Teks abu-abu
                break;
            default:
                backgroundColor = '#e9ecef'; // Abu-abu muda
                color = '#495057'; // Abu-abu
        }
    }
    
    return `<span class="status-badge" style="background-color: ${backgroundColor}; color: ${color}; padding: 3px 8px; border-radius: 4px; font-weight: 500;">${status}</span>`;
}

/**
 * FIREBASE AND DATA HANDLING - PENANGANAN DATA DAN FIREBASE
 */

/**
 * Memuat data pekerjaan dari Firebase dan menampilkannya
 * Difilter hanya berdasarkan status yang diizinkan, tanpa filter tanggal
 */
async function loadJobsFromFirebase() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    try {
        await authPromise;
        
        const snapshot = await get(ref(db, "PhxOutboundJobs"));
        
        if (snapshot.exists()) {
            const rawData = Object.entries(snapshot.val()).map(([key, value]) => ({
                 jobNo: key,
                 ...value
             }));
             
            // Filter data hanya berdasarkan status yang diizinkan
            let filteredData = rawData.filter(item => allowedStatuses.includes(item.status));
            
            // Urutkan data berdasarkan tanggal dan loading schedule
            allJobsData = sortJobsData(filteredData);
            
            if (allJobsData.length === 0) {
                document.getElementById('deliveryTableEditable').innerHTML = '<tr><td colspan="16" style="text-align:center;">Tidak ada data dengan status yang sesuai.</td></tr>';
                showNotification("Tidak ada data dengan status yang sesuai.", true);
            } else {
                displayJobsData();
                showNotification(`Berhasil memuat ${allJobsData.length} data.`, false);
            }
        } else {
            document.getElementById('deliveryTableEditable').innerHTML = '<tr><td colspan="16" style="text-align:center;">Tidak ada data ditemukan.</td></tr>';
            showNotification("Tidak ada data di database.", true);
        }
    } catch (error) {
        document.getElementById('deliveryTableEditable').innerHTML = `<tr><td colspan="16" style="text-align:center;">Error: ${error.message}</td></tr>`;
        showNotification(`Gagal memuat data dari database: ${error.message}`, true);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Menampilkan data pekerjaan ke dalam tabel
 */
function displayJobsData() {
    const tableBody = document.getElementById('deliveryTableEditable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (allJobsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="16" style="text-align:center;">Tidak ada data ditemukan.</td></tr>';
        return;
    }
    
    // Tambahkan CSS untuk efek blinking jika belum ada
    addBlinkingEffect();

    allJobsData.forEach((item, index) => {
        // Menentukan delivery status untuk item ini
        const deliveryStatus = determineDeliveryStatus(item);
        
        // Menentukan apakah row perlu efek blinking
        const needsBlinking = blinkingStatuses.includes(deliveryStatus);
        
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.jobNo);
        
        // Tambahkan class 'blinking' jika perlu efek blinking
        if (needsBlinking) {
            row.classList.add('blinking');
        }
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.deliveryDate || ''}</td>
            <td>${item.deliveryNote || ''}</td>
            <td>${item.owner || ''}</td>
            <td>${item.remark || ''}</td>
            <td>${item.qty || ''}</td>
            <td data-field="jobStatus">${getStatusBadge(item.status)}</td>
            <td data-field="loadingSchedule">${item.loadingSchedule || ''}</td>
            <td data-field="etd">${item.etd || ''}</td>
            <td data-field="eta">${item.eta || ''}</td>
            <td data-field="palletOut">${item.palletOut || ''}</td>
            <td data-field="truckNo">${item.truckNo || ''}</td>
            <td data-field="loadingStart">${formatDateTime(item.loadingStart) || ''}</td>
            <td data-field="loadingFinish">${formatDateTime(item.loadingFinish) || ''}</td>
            <td data-field="deliveryStatus">${getStatusBadge(deliveryStatus, true)}</td>
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
    
    // Update pagination info
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `Menampilkan 1-${allJobsData.length} dari ${allJobsData.length} data`;
    }
}

/**
 * Menambahkan CSS untuk efek blinking jika belum ada
 */
function addBlinkingEffect() {
    // Cek jika style untuk blinking sudah ada
    if (!document.getElementById('blinkingStyle')) {
        const style = document.createElement('style');
        style.id = 'blinkingStyle';
        style.textContent = `
            @keyframes blink {
                0% { background-color: rgba(255, 0, 0, 0); }
                50% { background-color: rgba(255, 0, 0, 0.2); }
                100% { background-color: rgba(255, 0, 0, 0); }
            }
            
            .blinking {
                animation: blink 2s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Menyimpan semua data ke node DeliveryList di Firebase dengan struktur hirarkis
 * berdasarkan tahun, bulan, dan tanggal saat ini
 * Fungsi ini dipanggil saat tombol "Save Data" ditekan
 */
async function saveAllDataToDeliveryList() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    
    try {
        await authPromise;
        
        if (allJobsData.length === 0) {
            showNotification("Tidak ada data untuk disimpan.", true);
            loadingOverlay.style.display = 'none';
            return;
        }
        
        // Mendapatkan tanggal saat ini untuk membuat struktur path
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');  // Bulan dimulai dari 0
        const day = String(now.getDate()).padStart(2, '0');
        
        // Data yang akan disimpan di DeliveryList
        const deliveryListData = {};
        
        allJobsData.forEach(item => {
            // Menambahkan delivery status ke data yang akan disimpan
            const deliveryStatus = determineDeliveryStatus(item);
            
            deliveryListData[item.jobNo] = {
                ...item,
                deliveryStatus,
                savedBy: currentUser,
                savedAt: currentDateTime
            };
        });
        
        // Simpan ke node DeliveryList dengan struktur tahun/bulan/hari
        await set(ref(db, `DeliveryList/${year}/${month}/${day}/data`), deliveryListData);
        
        showNotification(`Data berhasil disimpan ke DeliveryList/${year}/${month}/${day}/data.`, false);
    } catch (error) {
        showNotification(`Gagal menyimpan data: ${error.message}`, true);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Menangani upload file Excel dan memperbarui data di Firebase
 * @param {File} file - File Excel yang diupload
 */
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
                        updates[`/PhxOutboundJobs/${jobNo}/loadingSchedule`] = formatTimeOnly(row['Loading Schedule']);
                        updates[`/PhxOutboundJobs/${jobNo}/etd`] = formatTimeOnly(row['ETD']);
                        updates[`/PhxOutboundJobs/${jobNo}/eta`] = formatTimeOnly(row['ETA']);
                        
                        // Tambahkan informasi update
                        updates[`/PhxOutboundJobs/${jobNo}/lastModifiedBy`] = currentUser;
                        updates[`/PhxOutboundJobs/${jobNo}/lastModifiedAt`] = currentDateTime;
                        
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
                    showNotification(`${notFound.length} Delivery Note tidak ditemukan: ${notFound.slice(0, 3).join(', ')}...`, true);
                }

            } catch (err) {
                showNotification(`Gagal memproses file: ${err.message}`, true);
            } finally {
                loadingOverlay.style.display = 'none';
                document.getElementById('uploadModal').style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);

    } catch (error) {
        showNotification("Gagal terhubung ke database.", true);
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Menangani pengiriman form penambahan data baru
 * @param {Event} event - Event submit form
 */
async function handleAddDataSubmit(event) {
    event.preventDefault();
    const form = document.getElementById('deliveryForm');
    const formData = new FormData(form);

    const deliveryDate = formData.get('deliveryDate');
    if (!deliveryDate) {
        showNotification("Delivery Date wajib diisi.", true);
        return;
    }

    const newJobNo = `MANUAL-${Date.now()}`;
    const newJobData = {
        jobNo: newJobNo,
        deliveryDate: formatDate(new Date(deliveryDate)),
        deliveryNote: formData.get('deliveryNote') || '',
        owner: formData.get('owner') || '',
        remark: formData.get('remark') || '',
        qty: formData.get('qty') || '',
        loadingSchedule: formData.get('loadingSchedule') || '',
        etd: formData.get('etd') || '',
        eta: formData.get('eta') || '',
        palletOut: formData.get('palletOut') || '',
        truckNo: formData.get('truckNo') || '',
        loadingStart: formData.get('loadingStart') || '',
        loadingFinish: formData.get('loadingFinish') || '',
        status: 'Pending', // Default status for manual entry
        createdBy: currentUser, // Menggunakan user yang login
        createdAt: currentDateTime // Menambahkan timestamp
    };

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';

    try {
        await set(ref(db, `PhxOutboundJobs/${newJobNo}`), newJobData);
        showNotification(`Data baru dengan Job No ${newJobNo} berhasil disimpan.`);
        document.getElementById('addModal').style.display = 'none';
        form.reset();
        loadJobsFromFirebase();
    } catch (error) {
        showNotification("Gagal menyimpan data baru ke database.", true);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * EVENT LISTENERS & ACTION HANDLERS - PENANGAN AKSI & EVENT LISTENER
 */

/**
 * Menangani klik pada tabel untuk aksi edit, save, dan delete
 * @param {Event} event - Event klik
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

/**
 * Mengubah mode edit untuk baris tabel
 * @param {HTMLElement} row - Elemen baris tabel
 * @param {boolean} isEditing - Apakah dalam mode editing
 */
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

/**
 * Menyimpan data yang telah diedit ke Firebase
 * @param {string} jobNo - Nomor pekerjaan yang diedit
 * @param {HTMLElement} row - Elemen baris tabel yang diedit
 */
async function saveRowData(jobNo, row) {
    const updates = {};

    editableColumns.forEach(field => {
        const cell = row.querySelector(`td[data-field="${field}"]`);
        if (cell) {
            if (field === 'jobStatus' && cell.querySelector('.status-badge')) {
                updates['status'] = cell.querySelector('.status-badge').textContent.trim();
            } else {
                updates[field] = cell.textContent.trim();
            }
        }
    });
    
    // Menambahkan informasi siapa yang melakukan update dan kapan
    updates['lastModifiedBy'] = currentUser;
    updates['lastModifiedAt'] = currentDateTime;

    try {
        await update(ref(db, `PhxOutboundJobs/${jobNo}`), updates);
        showNotification(`Job ${jobNo} berhasil diupdate.`);
        toggleEditMode(row, false);
        
        // Update juga tampilan Delivery Status
        const jobData = allJobsData.find(item => item.jobNo === jobNo);
        if (jobData) {
            // Update data di memori
            Object.assign(jobData, updates);
            
            // Update Delivery Status di row
            const deliveryStatus = determineDeliveryStatus(jobData);
            const deliveryStatusCell = row.querySelector('td[data-field="deliveryStatus"]');
            if (deliveryStatusCell) {
                deliveryStatusCell.innerHTML = getStatusBadge(deliveryStatus, true);
            }
            
            // Update efek blinking jika diperlukan
            const needsBlinking = blinkingStatuses.includes(deliveryStatus);
            row.classList.toggle('blinking', needsBlinking);
        }
    } catch (error) {
        showNotification(`Gagal update Job ${jobNo}.`, true);
    }
}

/**
 * Menghapus data pekerjaan dari Firebase
 * @param {string} jobNo - Nomor pekerjaan yang akan dihapus
 */
function deleteRowData(jobNo) {
    showConfirmModal({
        title: 'Konfirmasi Hapus',
        message: `Apakah Anda yakin ingin menghapus Job No: <strong>${jobNo}</strong>?`,
        okText: 'Hapus',
        onConfirm: async () => {
            try {
                await remove(ref(db, `PhxOutboundJobs/${jobNo}`));
                showNotification(`Job ${jobNo} berhasil dihapus.`);
                loadJobsFromFirebase();
            } catch (error) {
                showNotification(`Gagal menghapus Job ${jobNo}.`, true);
            }
        }
    });
}

/**
 * Mengatur event listener untuk tabel
 */
function setupTableEventListeners() {
    const tableBody = document.getElementById('deliveryTableEditable');
    tableBody.removeEventListener('click', handleTableClick);
    tableBody.addEventListener('click', handleTableClick);
}

/**
 * Mengatur modal untuk penambahan dan upload data
 */
function setupModals() {
    // Add Modal
    const addModal = document.getElementById('addModal');
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const closeAddModal = document.getElementById('closeAddModal');
    const cancelAddBtn = document.getElementById('cancelAddBtn');
    const submitAddBtn = document.getElementById('submitAddBtn');
    
    openAddModalBtn.addEventListener('click', () => {
        addModal.style.display = 'flex';
        document.getElementById('deliveryForm').reset();
        
        // Set default tanggal ke hari ini
        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];
        document.getElementById('deliveryDate').value = todayISO;
    });

    const closeAddModalHandler = () => addModal.style.display = 'none';
    closeAddModal.addEventListener('click', closeAddModalHandler);
    cancelAddBtn.addEventListener('click', closeAddModalHandler);
    submitAddBtn.addEventListener('click', handleAddDataSubmit);

    // Upload Modal
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

    const closeUploadModalHandler = () => uploadModal.style.display = 'none';
    closeUploadModal.addEventListener('click', closeUploadModalHandler);
    cancelUploadBtn.addEventListener('click', closeUploadModalHandler);

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
    
    // Setup Save Data Button
    const saveDataBtn = document.getElementById('saveDataBtn');
    if (saveDataBtn) {
        saveDataBtn.addEventListener('click', saveAllDataToDeliveryList);
    }
}

/**
 * Mengatur tombol ekspor data
 */
function setupExportButton() {
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (allJobsData.length === 0) {
                showNotification('Tidak ada data untuk diekspor', true);
                return;
            }

            try {
                // Buat data untuk ekspor
                const exportData = allJobsData.map(item => {
                    const deliveryStatus = determineDeliveryStatus(item);
                    
                    return {
                        'Date': item.deliveryDate || '',
                        'Delivery Note': item.deliveryNote || '',
                        'Owner': item.owner || '',
                        'Remark': item.remark || '',
                        'Qty': item.qty || '',
                        'Job Status': item.status || '',
                        'Loading Schedule': item.loadingSchedule || '',
                        'ETD': item.etd || '',
                        'ETA': item.eta || '',
                        'Pallet Out': item.palletOut || '',
                        'Truck No': item.truckNo || '',
                        'Loading Start': formatDateTime(item.loadingStart) || '',
                        'Loading Finish': formatDateTime(item.loadingFinish) || '',
                        'Delivery Status': deliveryStatus || ''
                    };
                });

                // Buat workbook dan worksheet
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Delivery Data');

                // Tentukan nama file dengan tanggal
                const now = new Date();
                const fileName = `DeliveryReport_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;

                // Ekspor ke file Excel
                XLSX.writeFile(wb, fileName);
                showNotification(`Data berhasil diekspor ke ${fileName}`, false);
            } catch (error) {
                showNotification('Gagal mengekspor data: ' + error.message, true);
            }
        });
    }
}

/**
 * Inisialisasi saat dokumen dimuat
 */
document.addEventListener('DOMContentLoaded', function() {
    // Cek apakah firebase config diload dengan benar
    if (typeof db === 'undefined') {
        showNotification("Koneksi database tidak tersedia. Harap refresh halaman.", true);
    } else {
        loadJobsFromFirebase();
    }
    
    setupModals();
    setupExportButton();
});