import { db, authPromise } from './config.js';
import { ref, get, update, remove, set } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Global state - Menyimpan data dan konfigurasi global
let allJobsData = [];
const editableColumns = ['loadingSchedule', 'etd', 'eta', 'palletOut', 'truckNo', 'loadingStart', 'loadingFinish'];

// Status yang diperbolehkan untuk ditampilkan
const allowedStatuses = ['Pending Pick', 'Packed', 'Completed', 'Pending'];

// Mendefinisikan tanggal hari ini dan kemarin dengan format yang sama persis dengan di Firebase
const datesToShow = (() => {
    try {
        // Format tanggal khusus untuk mencocokkan format di Firebase: "dd-MMM-yyyy"
        // PENTING: Firebase menggunakan "Sep" (bukan "Sept") untuk bulan September
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Fungsi untuk memformat tanggal sesuai dengan Firebase (dd-MMM-yyyy)
        const formatDateForFirebase = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            
            // Daftar bulan persis seperti di Firebase (3 huruf: "Jan", "Feb", dst.)
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = months[date.getMonth()];
            
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };
        
        const todayFormatted = formatDateForFirebase(today);
        const yesterdayFormatted = formatDateForFirebase(yesterday);
        
        console.log(`Tanggal hari ini (format Firebase): ${todayFormatted}`);
        console.log(`Tanggal kemarin (format Firebase): ${yesterdayFormatted}`);
        
        return [todayFormatted, yesterdayFormatted];
    } catch (error) {
        console.error("Error saat memformat tanggal:", error);
        // Fallback jika ada error
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}-${months[today.getMonth()]}-${today.getFullYear()}`;
        const yesterdayFormatted = `${String(yesterday.getDate()).padStart(2, '0')}-${months[yesterday.getMonth()]}-${yesterday.getFullYear()}`;
        
        return [todayFormatted, yesterdayFormatted];
    }
})();

// Variabel today untuk kompatibilitas dengan kode yang sudah ada
const today = datesToShow[0];

// Informasi user untuk log aktivitas
const currentUser = (() => {
    try {
        // Mencoba mendapatkan informasi dari elemen HTML
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
 * Normalisasi nomor Delivery Note (menghilangkan leading zeros)
 * @param {string} dn - Nomor Delivery Note
 * @returns {string} Nomor Delivery Note yang sudah dinormalisasi
 */
function normalizeDeliveryNote(dn) {
    if (!dn) return '';
    return String(dn).trim().replace(/^0+/, '');
}

/**
 * Membuat badge HTML untuk status dengan warna yang sesuai
 * Warna diubah sesuai permintaan:
 * Pending Pick = Merah, Packed = Hijau, Completed = Abu-abu
 * @param {string} status - Status yang akan ditampilkan
 * @returns {string} HTML untuk badge status
 */
function getStatusBadge(status) {
    if (!status) return '';
    let color, backgroundColor;
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
    return `<span class="status-badge" style="background-color: ${backgroundColor}; color: ${color}; padding: 3px 8px; border-radius: 4px; font-weight: 500;">${status}</span>`;
}

/**
 * FIREBASE AND DATA HANDLING - PENANGANAN DATA DAN FIREBASE
 */

/**
 * Memuat data pekerjaan dari Firebase dan menampilkannya
 * Difilter berdasarkan tanggal hari ini dan kemarin, dan status yang diizinkan
 */
async function loadJobsFromFirebase() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    try {
        console.log("Memulai proses load data dari Firebase...");
        await authPromise;
        console.log("Autentikasi berhasil, mengambil data...");
        
        const snapshot = await get(ref(db, "PhxOutboundJobs"));
        
        if (snapshot.exists()) {
            console.log("Data ditemukan di Firebase");
            const rawData = Object.entries(snapshot.val()).map(([key, value]) => ({
                 jobNo: key,
                 ...value
             }));
             
            console.log(`Total data dari Firebase: ${rawData.length}`);
            console.log(`Filter tanggal yang akan digunakan: ${datesToShow.join(', ')}`);
            console.log(`Status yang diizinkan: ${allowedStatuses.join(', ')}`);
            
            // Debugging: Tampilkan beberapa data pertama untuk melihat format deliveryDate
            console.log("Sampel data dari Firebase:");
            rawData.slice(0, 3).forEach(item => {
                console.log(`JobNo: ${item.jobNo}, Delivery Date: "${item.deliveryDate}", Status: "${item.status}"`);
            });
            
            // Filter data berdasarkan tanggal (hari ini dan kemarin) dan status yang diizinkan
            allJobsData = rawData.filter(item => {
                const dateMatch = datesToShow.includes(item.deliveryDate);
                const statusMatch = allowedStatuses.includes(item.status);
                
                // Debug setiap item untuk melihat mana yang cocok/tidak
                if (dateMatch && statusMatch) {
                    console.log(`✓ Item cocok - JobNo: ${item.jobNo}, Date: ${item.deliveryDate}, Status: ${item.status}`);
                } else if (!dateMatch) {
                    console.log(`✗ Date tidak cocok - JobNo: ${item.jobNo}, Date: ${item.deliveryDate} (dicari: ${datesToShow.join(', ')})`);
                } else if (!statusMatch) {
                    console.log(`✗ Status tidak cocok - JobNo: ${item.jobNo}, Status: ${item.status}`);
                }
                
                return dateMatch && statusMatch;
            });
            
            console.log(`Data yang akan ditampilkan: ${allJobsData.length}`);
            
            if (allJobsData.length === 0) {
                console.log("Tidak ada data untuk tanggal yang dipilih");
                document.getElementById('deliveryTableEditable').innerHTML = '<tr><td colspan="16" style="text-align:center;">Tidak ada data untuk tanggal hari ini dan kemarin.</td></tr>';
                showNotification("Tidak ada data untuk tanggal hari ini dan kemarin.", true);
            } else {
                displayJobsData();
                showNotification(`Berhasil memuat ${allJobsData.length} data.`, false);
            }
        } else {
            console.log("Tidak ada data di Firebase");
            document.getElementById('deliveryTableEditable').innerHTML = '<tr><td colspan="16" style="text-align:center;">Tidak ada data ditemukan.</td></tr>';
            showNotification("Tidak ada data di database.", true);
        }
    } catch (error) {
        console.error("Error loading data from Firebase:", error);
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
            <td data-field="jobStatus">${getStatusBadge(item.status)}</td>
            <td data-field="loadingSchedule">${item.loadingSchedule || ''}</td>
            <td data-field="etd">${item.etd || ''}</td>
            <td data-field="eta">${item.eta || ''}</td>
            <td data-field="palletOut">${item.palletOut || ''}</td>
            <td data-field="truckNo">${item.truckNo || ''}</td>
            <td data-field="loadingStart">${formatDateTime(item.loadingStart) || ''}</td>
            <td data-field="loadingFinish">${formatDateTime(item.loadingFinish) || ''}</td>
            <td data-field="deliveryStatus"></td>
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
        console.error("Gagal menyimpan data baru:", error);
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
    } catch (error) {
        console.error("Gagal update data:", error);
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
                console.error("Gagal menghapus data:", error);
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
                const exportData = allJobsData.map(item => ({
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
                }));

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
                console.error('Error exporting data:', error);
                showNotification('Gagal mengekspor data: ' + error.message, true);
            }
        });
    }
}

/**
 * Inisialisasi saat dokumen dimuat
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("Halaman dimuat, mempersiapkan aplikasi...");
    console.log(`Tanggal yang akan ditampilkan: ${datesToShow.join(', ')}`);
    
    // Cek apakah firebase config diload dengan benar
    if (typeof db === 'undefined') {
        console.error("Firebase DB tidak ditemukan. Cek path import config.js");
        showNotification("Koneksi database tidak tersedia. Harap refresh halaman.", true);
    } else {
        console.log("Firebase config ditemukan, mencoba load data...");
        loadJobsFromFirebase();
    }
    
    setupModals();
    setupExportButton();
});