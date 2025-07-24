// sortir.js
// Versi terbaru: support upload Excel baru, simpan ke root node PhxOutboundJobs, assignment job terhubung node baru
// Komentar sudah ditambahkan pada setiap fungsi dan listener

import { db, authPromise } from "./config.js";
import { ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

/* =========================
    UTILITY / HELPER FUNCTIONS
========================= */

/**
 * Menampilkan notifikasi pada halaman.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @param {boolean} isError - Jika error, notifikasi berwarna merah.
 */
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'block';
  notification.classList.toggle('error', isError);
  notification.classList.toggle('success', !isError);

  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show', 'error', 'success');
    notification.style.display = 'none';
    notification.textContent = '';
  }, 4000);
}

/**
 * Setup fungsi pencarian untuk tabel job
 */
function setupSearchFunctionality() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', function() {
    const searchValue = this.value.toLowerCase();
    
    // Jika searchValue kosong, tampilkan semua data
    if (!searchValue.trim()) {
      if (filteredJobs.length > 0) {
        renderTableData(filteredJobs);
      } else {
        renderTableData(allJobsData);
      }
      return;
    }
    
    // Lakukan pencarian pada data yang saat ini ditampilkan (filtered atau all)
    const dataToSearch = filteredJobs.length > 0 ? filteredJobs : allJobsData;
    
    const searchResults = dataToSearch.filter(job => {
      // Cari di semua kolom yang relevan
      return (
        (job.jobNo && job.jobNo.toLowerCase().includes(searchValue)) ||
        (job.deliveryDate && job.deliveryDate.toLowerCase().includes(searchValue)) ||
        (job.deliveryNote && job.deliveryNote.toLowerCase().includes(searchValue)) ||
        (job.remark && job.remark.toLowerCase().includes(searchValue)) ||
        (job.status && job.status.toLowerCase().includes(searchValue)) ||
        (job.team && job.team.toLowerCase().includes(searchValue)) ||
        // Tambahkan pencarian untuk qty jika diperlukan
        (job.qty && job.qty.toString().includes(searchValue))
      );
    });
    
    // Render hasil pencarian
    renderTableData(searchResults);
    
    // Update indikator filter jika pencarian aktif
    updateSearchIndicator(searchValue);
  });
}

/**
 * Update indikator pencarian aktif
 */
function updateSearchIndicator(searchValue) {
  const filterIndicator = document.getElementById("filterIndicator");
  if (!filterIndicator) return;
  
  // Ambil filter yang sudah aktif
  const status = document.getElementById("statusOptions")?.value || "all";
  const date = document.getElementById("dateOptions")?.value || "all";
  const team = document.getElementById("teamOptions")?.value || "all";
  
  const filters = [];
  if (status !== "all") filters.push(`Status: ${status}`);
  if (date !== "all") filters.push(`Date: ${date}`);
  if (team !== "all") filters.push(`Team: ${team === "none" ? "None/blank" : team}`);
  
  // Tambahkan filter pencarian
  if (searchValue) filters.push(`Search: "${searchValue}"`);
  
  if (filters.length > 0) {
    filterIndicator.textContent = "Filtered by: " + filters.join(" | ");
  } else {
    filterIndicator.textContent = "";
  }
}

function formatNumericValue(value) {
  if (!value || value === "" || value === undefined || value === null || isNaN(value)) {
    return "";
  }
  return Number(value).toLocaleString();
}

function showExportLoading(isShow = true) {
  const overlay = document.getElementById("exportLoadingOverlay");
  if (overlay) overlay.style.display = isShow ? "flex" : "none";
}

/**
 * Mengisi data user ke elemen HTML berdasarkan username yang tersimpan saat login
 */
function populateUserProfileData() {
  // Ambil username (yang digunakan sebagai ID user di database) dari localStorage
  const username = localStorage.getItem("username");
  
  if (!username) {
    console.warn("Username tidak ditemukan di localStorage");
    return;
  }
  
  // Referensi ke elemen UI
  const userFullNameElement = document.getElementById('userFullName');
  const userAvatarElement = document.getElementById('userAvatar');
  const userInitialElement = document.getElementById('userInitial');
  const userShiftElement = document.getElementById('userShift');
  
  // Ambil data user langsung dari node users/[username]
  get(ref(db, `users/${username}`))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Isi data di UI
        if (userFullNameElement) userFullNameElement.textContent = userData.Name || username;
        
        // Set initial untuk avatar dan userInitial
        const initial = userData.Name ? userData.Name.charAt(0).toUpperCase() : 'U';
        if (userAvatarElement) userAvatarElement.textContent = initial;
        if (userInitialElement) userInitialElement.textContent = initial;
        
        // Set shift jika ada elemen shift
        if (userShiftElement) userShiftElement.textContent = userData.Shift || '';
        
        console.log("✅ Data profil user berhasil ditampilkan");
      } else {
        console.warn("Data user tidak ditemukan untuk username:", username);
      }
    })
    .catch((error) => {
      console.error("Error saat mengambil data user:", error);
    });
}

async function getTeamNameForCurrentUser() {
  // Ambil nama user yang sedang login dari elemen userFullName atau localStorage
  const userName = document.getElementById("userFullName")?.textContent?.trim() ||
                   localStorage.getItem("pic") || "";
  if (!userName) return "";

  // Cari user berdasar Name di node users
  const usersSnap = await get(ref(db, "users"));
  if (!usersSnap.exists()) return "";

  const users = usersSnap.val();
  for (const userId in users) {
    if (users[userId]?.Name?.trim() === userName) {
      return users[userId]?.Shift || "";
    }
  }
  return "";
}

function savePlanTargetToFirebase(team, target) {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  if (!team || isNaN(target) || target <= 0) {
    showNotification("Data target plan tidak valid.", true);
    return;
  }
  const dbPath = `PlanTarget/${shiftType}/${team}`;
  set(ref(db, dbPath), target)
    .then(() => {
      showNotification(`Target plan untuk ${team} (${shiftType}) berhasil disimpan: ${target} kg.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan target plan ke database.", true);
      console.error(err);
    });
}

// Fungsi mengatur target plan dari input
function handleSetPlanTarget() {
  const team = planTeamSelector.value;
  const target = parseInt(planTargetInput.value);

  if (isNaN(target) || target <= 0) {
    showNotification("Masukkan nilai target yang valid.", true);
    return;
  }

  savePlanTargetToFirebase(team, target);
  planTargetInput.value = "";
}

/**
 * Fungsi helper untuk membersihkan value agar selalu string.
 */
function sanitizeValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return "";
  if (typeof value === "function") return "";
  if (String(value).toLowerCase() === "undefined" || 
      String(value).toLowerCase() === "nan") return "";
  return value;
}

/**
 * Format tanggal menjadi dd-MMM-yyyy.
 */
function formatToCustomDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format tanggal dari input berbagai tipe ke custom format.
 */
function formatDate(input) {
  if (!input) return "";
  if (typeof input === "number") {
    const date = new Date(Math.round((input - 25569) * 86400 * 1000));
    return formatToCustomDate(date);
  }
  const parsed = new Date(input);
  if (!isNaN(parsed)) {
    return formatToCustomDate(parsed);
  }
  return input;
}

/**
 * Badge color untuk status tertentu.
 */
function badgeForStatus(status) {
  const statusLower = (status || "").toLowerCase();
  
  switch (statusLower) {
    case "pending allocation":
      return "badge-pending-allocation";
    case "partial allocation":
      return "badge-partial-allocation";
    case "pending pick":
      return "badge-pending-pick";
    case "partial picked":
      return "badge-partial-picked";
    case "pending pack":
      return "badge-pending-pack";
    case "partial packed":
      return "badge-partial-packed";
    case "packed":
    case "loading":
      return "badge-success";
    case "completed":
      return "badge-completed";
    default:
      return "badge-info";
  }
}

/**
 * Membuat satu baris (row) untuk table job (kembali ke pendekatan HTML).
 */
function createTableRow(job) {
  const row = document.createElement("tr");
  const badgeClass = badgeForStatus(job.status);
  
  // Sanitasi nilai sebelum menampilkan
  const remark = sanitizeValue(job.remark);
  const team = sanitizeValue(job.team);
  
  // Khusus untuk qty, tangani kasus numerik
  let qtyDisplay = "";
  if (job.qty && !isNaN(job.qty)) {
    qtyDisplay = Number(job.qty).toLocaleString();
  }
  
  row.innerHTML = `
    <td><input type="checkbox" data-jobno="${job.jobNo}"></td>
    <td>${sanitizeValue(job.jobNo)}</td>
    <td>${sanitizeValue(job.deliveryDate)}</td>
    <td>${sanitizeValue(job.deliveryNote)}</td>
    <td>${remark}</td>
    <td><span class="badge ${badgeClass}">${sanitizeValue(job.status)}</span></td>
    <td>${qtyDisplay}</td>
    <td>${team}</td>
    <td class="table-actions">
      <button class="assign" data-jobno="${job.jobNo}">Assign</button>
      <button class="unassign" data-jobno="${job.jobNo}">Unassign</button>
    </td>
  `;
  
  return row;
}

/**
 * Helper untuk mendapatkan class badge berdasarkan status
 */
function getBadgeClass(status) {
  switch (status) {
    case "Pending": return "badge-warning";
    case "Packed": return "badge-success";
    case "Completed": return "badge-completed";
    default: return "badge-info";
  }
}

/**
 * Fungsi untuk menangani event checkbox select all
 */
function handleSelectAllChange() {
  const selectAllCheckbox = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('#jobTable tbody input[type="checkbox"]');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

/**
 * Fungsi untuk sorting tabel berdasarkan kolom
 */
function sortTable(columnIndex, columnKey) {
  // Determine sort direction
  if (currentSortColumn === columnIndex) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortDirection = 'asc';
  }
  
  currentSortColumn = columnIndex;
  
  // Get data to sort (use filtered data if exists, otherwise all data)
  const dataToSort = filteredJobs.length > 0 ? filteredJobs : allJobsData;
  
  // Sort the data
  const sortedData = [...dataToSort].sort((a, b) => {
    let aValue = a[columnKey];
    let bValue = b[columnKey];
    
    // Handle different data types
    if (columnKey === 'qty') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else if (columnKey === 'deliveryDate') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else {
      // String comparison
      aValue = String(aValue || '').toLowerCase();
      bValue = String(bValue || '').toLowerCase();
    }
    
    if (aValue < bValue) return currentSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Update filtered data or all data based on what was sorted
  if (filteredJobs.length > 0) {
    filteredJobs = sortedData;
  } else {
    allJobsData = sortedData;
  }
  
  // Re-render table
  renderTableData(sortedData);
  
  // Update header visual indicators
  updateSortHeaders(columnIndex);
}

/**
 * Update visual indicators for sorted headers
 */
function updateSortHeaders(activeColumnIndex) {
  const headers = document.querySelectorAll('#jobTable thead th');
  
  headers.forEach((th, index) => {
    th.classList.remove('sort-asc', 'sort-desc');
    
    if (index === activeColumnIndex) {
      th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/**
 * Render table data to tbody
 */
function renderTableData(data) {
  const tbody = document.querySelector('#jobTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  data.forEach(job => {
    const row = createTableRow(job);
    tbody.appendChild(row);
  });
  
  // Re-attach event listeners
  attachTableEventListeners();
  updateSelectAllCheckbox();
}

/**
 * Initialize table headers with sorting capability
 */
function initializeTableHeaders() {
  const headers = document.querySelectorAll('#jobTable thead th');
  const columnMappings = [
    { key: null, sortable: false }, // Checkbox column
    { key: 'jobNo', sortable: true },
    { key: 'deliveryDate', sortable: true },
    { key: 'deliveryNote', sortable: true },
    { key: 'remark', sortable: true },
    { key: 'status', sortable: true },
    { key: 'qty', sortable: true },
    { key: 'team', sortable: true },
    { key: null, sortable: false } // Action column
  ];
  
  headers.forEach((th, index) => {
    const mapping = columnMappings[index];
    
    if (mapping && mapping.sortable) {
      th.classList.add('sortable');
      th.addEventListener('click', () => {
        sortTable(index, mapping.key);
      });
    }
  });
}

/**
 * Attach event listeners untuk tombol dalam tabel
 */
function attachTableEventListeners() {
  // Remove old listeners and add new ones
  document.removeEventListener('click', handleTableClick);
  document.addEventListener('click', handleTableClick);
  
  // Handle checkbox changes
  document.removeEventListener('change', handleCheckboxChange);
  document.addEventListener('change', handleCheckboxChange);
}

function handleTableClick(e) {
  // Handle assign button clicks
  if (e.target.classList.contains('assign')) {
    e.preventDefault();
    const jobNo = e.target.getAttribute('data-jobno');
    
    // Cek apakah ada checkbox yang tercentang di tabel
    const checked = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (checked.length > 0) {
      showNotification("Terdapat checkbox yang tercentang.", true);
      return;
    }
    
    // Cek apakah job sudah di-assign
    const jobData = allJobsData.find(job => job.jobNo === jobNo);
    if (jobData && jobData.team && jobData.team.trim() !== "") {
      showNotification("⚠️ Job ini sudah di-assign ke team: " + jobData.team, true);
      return;
    }
    
    selectedSingleJob = jobNo;
    showModal();
  }
  
  // Handle unassign button clicks
  if (e.target.classList.contains('unassign')) {
    e.preventDefault();
    const jobNo = e.target.getAttribute('data-jobno');
    
    const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
    get(jobRef).then(snapshot => {
      if (!snapshot.exists()) {
        return showNotification("❌ Job tidak ditemukan di database.", true);
      }
      const jobData = snapshot.val();
      if (!jobData.team) {
        return showNotification("⚠️ Job ini belum di-assign ke team manapun.", true);
      }
      showConfirmModal({
        title: "Konfirmasi Unassign",
        message: "Apakah Anda yakin ingin membatalkan assignment job ini?",
        okText: "Unassign",
        okClass: "logout",
        onConfirm: () => {
          update(jobRef, {team: "", jobType: "", shift: "", teamName: ""})
            .then(() => {
              showNotification("✅ Job berhasil di-unassign.");
              refreshDataWithoutReset();
            })
            .catch(err => {
              showNotification("❌ Gagal menghapus assignment job.", true);
            });
        }
      });
    });
  }
}

function handleCheckboxChange(e) {
  if (e.target.type === 'checkbox') {
    if (e.target.id === 'selectAll') {
      // Handle select all
      const isChecked = e.target.checked;
      document.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => {
        cb.checked = isChecked;
      });
    } else {
      // Handle individual checkbox
      updateSelectAllCheckbox();
    }
  }
}

/**
 * Update status select all checkbox
 */
function updateSelectAllCheckbox() {
  const totalCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]').length;
  const checkedCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked').length;
  
  const selectAllCheckbox = document.getElementById('selectAll');
  if (selectAllCheckbox) {
    if (checkedCheckboxes === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (checkedCheckboxes === totalCheckboxes) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
    }
  }
}

/**
 * Modal konfirmasi (reusable)
 */
function showConfirmModal({ title = "Konfirmasi", message = "Apakah Anda yakin?", okText = "OK", cancelText = "Batal", okClass = "", onConfirm, onCancel }) {
  const modal = document.getElementById("confirmModal");
  const titleElem = document.getElementById("confirmModalTitle");
  const msgElem = document.getElementById("confirmModalMessage");
  const okBtn = document.getElementById("okConfirmBtn");
  const cancelBtn = document.getElementById("cancelConfirmBtn");

  titleElem.textContent = title;
  msgElem.innerHTML = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  okBtn.className = "modal-btn";
  if (okClass) okBtn.classList.add(okClass);

  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onConfirm === "function") onConfirm();
  };
  newCancelBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onCancel === "function") onCancel();
  };

  modal.style.display = "block";
  window.addEventListener("click", function handler(e) {
    if (e.target === modal) {
      modal.style.display = "none";
      window.removeEventListener("click", handler);
    }
  });
}

/**
 * Menyiapkan opsi filter tanggal pada dropdown.
 */
function populateDateOptions(dates) {
  dateOptions.innerHTML = '<option value="all">-- Show All --</option>';
  [...dates].sort().forEach(date => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateOptions.appendChild(option);
  });
}

/**
 * Menyiapkan opsi filter team pada dropdown.
 */
function populateTeamOptions(teams) {
  teamOptions.innerHTML = '<option value="all">-- Show All --</option>';
  const uniqueTeams = new Set(teams);
  uniqueTeams.forEach(team => {
    const value = team.trim() === "" ? "none" : team;
    const label = team.trim() === "" ? "None/blank" : team;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    teamOptions.appendChild(option);
  });
}

/**
 * Mengambil data job yang dipilih (checked).
 */
function getSelectedJobs() {
  const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.getAttribute('data-jobno'));
}

/**
 * Menampilkan modal assign.
 */
function showModal() { modal.style.display = "block"; }
/**
 * Menyembunyikan modal assign.
 */
function hideModal() { modal.style.display = "none"; }

/**
 * Menghapus semua job di node PhxOutboundJobs.
 */
function clearAllJobs() {
  showConfirmModal({
    title: "Konfirmasi Hapus Semua",
    message: "Apakah Anda yakin ingin <b>MENGHAPUS SEMUA</b> job dan plan target dari database?",
    okText: "Hapus",
    okClass: "logout",
    onConfirm: () => {
      const outboundRef = ref(db, "PhxOutboundJobs");
      const manPowerRef = ref(db, "ManPower");
      const manPowerOvertimeRef = ref(db, "ManPowerOvertime");
      const planTargetRef = ref(db, "PlanTarget");
      const dataStock = ref(db, "stock-material");

      // Jalankan penghapusan paralel
      Promise.all([
        remove(outboundRef),
        remove(manPowerRef),
        remove(manPowerOvertimeRef),
        remove(planTargetRef),
        remove(dataStock)
      ])
        .then(() => {
          showNotification("✅ Semua job, plan target, man power, dan overtime berhasil dihapus.");
          loadJobsFromFirebase(); // Pastikan fungsi ini tidak tergantung PlanTarget
        })
        .catch((err) => {
          console.error(err);
          showNotification("❌ Gagal menghapus data!", true);
        });
    }
  });
}

/* =========================
   HANDLE EXCEL FILE UPLOAD
========================= */

/**
 * Fungsi parsing file Excel sesuai struktur baru.
 * Header di row ke-4, data mulai row ke-5.
 * Field mapping: JobNo, ETD, DeliveryNoteNo, RefNo., Status, BCNo
 */
function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Hanya Phoenix mode
      const headerIndex = 2;
      const headers = sheetData[headerIndex];
      if (!headers) {
        showNotification("Header tidak ditemukan pada baris ke-3. Pastikan format file Phoenix benar.", true);
        if (fileInput) fileInput.value = "";
        return;
      }
      
      const colIndex = {
        JobNo: headers.findIndex(h => h.trim().toLowerCase() === "job no."),
        ETD: headers.findIndex(h => h.trim().toLowerCase() === "etd"),
        DeliveryNoteNo: headers.findIndex(h => h.trim().toLowerCase() === "delivery note no."),
        RefNo: headers.findIndex(h => h.trim().toLowerCase() === "ref no."),
        Status: headers.findIndex(h => h.trim().toLowerCase() === "status"),
        BCNo: headers.findIndex(h => h.trim().toLowerCase() === "bc no."),
      };
      
      const requiredKeys = Object.keys(colIndex);
      const missingHeaders = requiredKeys.filter(key => colIndex[key] === -1);
      if (missingHeaders.length > 0) {
        showNotification("Header file tidak sesuai format Phoenix.", true);
        if (fileInput) fileInput.value = "";
        return;
      }
      
      const rows = sheetData.slice(headerIndex + 1);
      const json = rows
        .map(row => ({
          JobNo: row[colIndex.JobNo] ?? "",
          ETD: row[colIndex.ETD] ?? "",
          DeliveryNoteNo: row[colIndex.DeliveryNoteNo] ?? "",
          RefNo: row[colIndex.RefNo] ?? "",
          Status: row[colIndex.Status] ?? "",
          BCNo: row[colIndex.BCNo] ?? ""
        }))
        .filter(job => job.JobNo && job.JobNo.trim() !== "");

      syncJobsToFirebase(json);

    } catch (err) {
      console.error("ERROR parsing Excel:", err);
      showNotification("Terjadi kesalahan saat membaca file Excel.", true);
    }
    if (fileInput) fileInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}
/**
 * Simpan data hasil parsing ke PhxOutboundJobs di Firebase.
 * Jika ada job di database yang tidak ada di data baru, status-nya diubah menjadi "Completed".
 */
function syncJobsToFirebase(jobs) {
  // 1. Ambil semua jobNo dari data baru
  const newJobNos = jobs.map(job => sanitizeValue(job.JobNo)).filter(jn => jn && !/[.#$\[\]]/.test(jn));

  // 2. Ambil semua job di database
  get(ref(db, "PhxOutboundJobs")).then(snapshot => {
    const existingJobs = snapshot.exists() ? snapshot.val() : {};
    const existingJobNos = Object.keys(existingJobs);

    // 3. Cari jobNo yang tidak ada di data baru
    const missingJobNos = existingJobNos.filter(jobNo => !newJobNos.includes(jobNo));

    // 4. Update status job yang tidak ada di data baru menjadi "Completed"
    const updateMissing = missingJobNos.map(jobNo =>
      update(ref(db, "PhxOutboundJobs/" + jobNo), { status: "Completed" })
    );

    // 5. Upload/update data baru
    let uploadCount = 0;
    let errorCount = 0;
    const uploadJobs = jobs.map(job => {
      const jobNo = sanitizeValue(job.JobNo);
      if (!jobNo || /[.#$\[\]]/.test(jobNo)) return Promise.resolve();
      const formattedDate = formatDate(job.ETD);
      const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
      return get(jobRef).then(existingSnap => {
        const existing = existingSnap.exists() ? existingSnap.val() : {};
        const jobData = {
          jobNo,
          deliveryDate: sanitizeValue(formattedDate),
          deliveryNote: sanitizeValue(job.DeliveryNoteNo),
          remark: sanitizeValue(job.RefNo),
          status: sanitizeValue(job.Status),
          qty: sanitizeValue(job.BCNo),
          team: existing.team || "",
          jobType: existing.jobType || "",
          shift: existing.shift || "",
          teamName: existing.teamName || "" 
        };
        return set(jobRef, jobData);
      })
      .then(() => { uploadCount++; })
      .catch(() => { errorCount++; });
    });

    // 6. Setelah semua selesai, tampilkan notifikasi & refresh
    Promise.all([...updateMissing, ...uploadJobs]).then(() => {
      showNotification("Upload selesai. Berhasil: " + uploadCount + ", Gagal: " + errorCount);
      loadJobsFromFirebase();
    });
  });
}

/**
 * Load jobs dari node baru PhxOutboundJobs ke tabel assignment.
 */
function loadJobsFromFirebase() {
  console.log('Loading jobs from Firebase...');
  allJobsData = [];
  
  get(ref(db, "PhxOutboundJobs"))
    .then(snapshot => {
      console.log('Firebase data received');
      if (snapshot.exists()) {
        const data = snapshot.val();
        const uniqueDates = new Set();
        const uniqueTeams = new Set();
        
        // Process data
        Object.values(data).forEach(job => {
          allJobsData.push(job);
          uniqueDates.add(job.deliveryDate);
          uniqueTeams.add(job.team || "");
        });
        
        console.log(`Added ${allJobsData.length} jobs to data array`);
        
        // Render table data
        renderTableData(allJobsData);
        
        // Initialize table headers for sorting
        initializeTableHeaders();
        
        populateDateOptions(uniqueDates);
        populateTeamOptions(uniqueTeams);
      } else {
        console.log('No data in Firebase');
        // Clear table
        const tbody = document.querySelector('#jobTable tbody');
        if (tbody) {
          tbody.innerHTML = '';
        }
      }
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      showNotification("Gagal mengambil data dari Firebase.", true);
    });
}

/**
 * Refresh data tanpa reset filter (setelah assign/unassign).
 */
function refreshDataWithoutReset() {
  get(ref(db, "PhxOutboundJobs")).then(snapshot => {
    const data = snapshot.val();
    allJobsData = [];
    
    // Clear tbody
    const tbody = document.querySelector('#jobTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }
    
    if (data) {
      const uniqueDates = new Set();
      const uniqueTeams = new Set();
      
      Object.values(data).forEach(job => {
        allJobsData.push(job);
        uniqueDates.add(job.deliveryDate);
        uniqueTeams.add(job.team || "");
      });
      
      // Apply current filters (plain HTML version)
      applyMultiFilter();
      updateFilterIndicator();
    }
  });
}

/**
 * Filter multi (status, tanggal, team) pada tabel assignment.
 */
/**
 * Filter multi (status, tanggal, team) pada tabel assignment.
 */
function applyMultiFilter() {
  const selectedStatus = statusOptions.value;
  const selectedDate = dateOptions.value;
  const selectedTeam = teamOptions.value;
  const searchValue = document.getElementById('searchInput')?.value.toLowerCase() || '';
  
  filteredJobs = [];
  
  allJobsData.forEach(job => {
    const matchStatus = selectedStatus === "all" || job.status === selectedStatus;
    const matchDate = selectedDate === "all" || job.deliveryDate === selectedDate;
    const isBlankTeam = !job.team || job.team.toLowerCase() === "none";
    const matchTeam = selectedTeam === "all" || (selectedTeam === "none" && isBlankTeam) || job.team === selectedTeam;
    
    // Pencarian jika ada nilai pencarian
    let matchSearch = true;
    if (searchValue) {
      matchSearch = (
        (job.jobNo && job.jobNo.toLowerCase().includes(searchValue)) ||
        (job.deliveryDate && job.deliveryDate.toLowerCase().includes(searchValue)) ||
        (job.deliveryNote && job.deliveryNote.toLowerCase().includes(searchValue)) ||
        (job.remark && job.remark.toLowerCase().includes(searchValue)) ||
        (job.status && job.status.toLowerCase().includes(searchValue)) ||
        (job.team && job.team.toLowerCase().includes(searchValue)) ||
        (job.qty && job.qty.toString().includes(searchValue))
      );
    }
    
    if (matchStatus && matchDate && matchTeam && matchSearch) {
      filteredJobs.push(job);
    }
  });
  
  // Render filtered data
  renderTableData(filteredJobs);
  
  // Update filter indicator
  updateFilterIndicator();
}
/**
 * Update indikator filter aktif di halaman.
 */
function updateFilterIndicator() {
  const status = statusOptions.value;
  const date = dateOptions.value;
  const team = teamOptions.value;
  const searchValue = document.getElementById('searchInput')?.value || '';
  
  const filters = [];
  if (status !== "all") filters.push(`Status: ${status}`);
  if (date !== "all") filters.push(`Date: ${date}`);
  if (team !== "all") filters.push(`Team: ${team === "none" ? "None/blank" : team}`);
  if (searchValue.trim()) filters.push(`Search: "${searchValue}"`);
  
  const filterIndicator = document.getElementById("filterIndicator");
  if (filters.length > 0) {
    filterIndicator.textContent = "Filtered by: " + filters.join(" | ");
  } else {
    filterIndicator.textContent = "";
  }
}

/**
 * Tutup semua dropdown filter.
 */
function closeAllDropdowns() {
  statusDropdown.style.display = "none";
  dateDropdown.style.display = "none";
  teamDropdown.style.display = "none";
}

/**
 * Fungsi untuk navigasi (jika digunakan).
 */
window.navigateTo = function (page) {
  window.location.href = page;
};

/* =========================
    INISIALISASI & EVENT LISTENER
========================= */

// Ambil semua elemen DOM yang diperlukan
const fileInput = document.getElementById("fileInput"); // Hidden element to prevent errors
const uploadBtn = document.getElementById("uploadBtn"); // Hidden element to prevent errors
const jobTable = document.getElementById("jobTable").getElementsByTagName("tbody")[0];
const bulkAddBtn = document.getElementById("bulkAddBtn");
const modal = document.getElementById("addModal");
const closeModal = document.getElementById("closeModal");
const confirmAdd = document.getElementById("confirmAdd");
const selectAllCheckbox = document.getElementById("selectAll");
const sortStatusBtn = document.getElementById("sortStatusBtn");
const statusDropdown = document.getElementById("statusDropdown");
const statusOptions = document.getElementById("statusOptions");
const sortDateBtn = document.getElementById("sortDateBtn");
const dateDropdown = document.getElementById("dateDropdown");
const dateOptions = document.getElementById("dateOptions");
const sortTeamBtn = document.getElementById("sortTeamBtn");
const teamDropdown = document.getElementById("teamDropdown");
const teamOptions = document.getElementById("teamOptions");
const planTargetInput = document.getElementById("planTargetInput");
const planTeamSelector = document.getElementById("planTeamSelector");
const setPlanTargetBtn = document.getElementById("setPlanTargetBtn");
const manPowerInput = document.getElementById("manPowerInput");
const manPowerTeamSelector = document.getElementById("manPowerTeamSelector");
const setManPowerBtn = document.getElementById("setManPowerBtn");

let selectedSingleJob = null;
// Global variables
let allJobsData = [];
let filteredJobs = [];
let currentSort = { key: null, asc: true };
let currentMode = "phoenix"; // default
let currentSortColumn = null;
let currentSortDirection = 'asc';

// Status options untuk Phoenix
const STATUS_OPTIONS = [
  "Pending Allocation",
  "Partial Allocation", 
  "Pending Pick",
  "Partial Picked",
  "Pending Pack",
  "Partial Packed",
  "Packed",
  "Loading",
  "Completed"
];

/**
 * Populate status filter dropdown options
 */
function populateStatusOptions() {
  if (!statusOptions) return;
  statusOptions.innerHTML = '<option value="all">-- Show All --</option>';
  STATUS_OPTIONS.forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusOptions.appendChild(option);
  });
}

// Listener tombol set plan target (jika masih digunakan)
setPlanTargetBtn?.addEventListener("click", handleSetPlanTarget);

// Listener tombol set man power
setManPowerBtn?.addEventListener("click", handleSetManPower);

// --- Fungsi Set Man Power ---
function saveManPowerToFirebase(team, manPower) {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  if (!team || isNaN(manPower) || manPower <= 0) {
    showNotification("Data man power tidak valid.", true);
    return;
  }
  const dbPath = `ManPower/${shiftType}/${team}`;
  set(ref(db, dbPath), manPower)
    .then(() => {
      showNotification(`Man Power untuk ${team} (${shiftType}) berhasil disimpan: ${manPower} orang.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan man power ke database.", true);
      console.error(err);
    });
}
function handleSetManPower() {
  const team = manPowerTeamSelector.value;
  const manPower = parseFloat(manPowerInput.value);

  if (isNaN(manPower) || manPower <= 0) {
    showNotification("Masukkan jumlah man power yang valid.", true);
    return;
  }
  saveManPowerToFirebase(team, manPower);
  manPowerInput.value = "";
}

// Fungsi simpan MP Overtime ke Firebase
function saveMpOvertimeToFirebase(mpOvertime) {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  if (isNaN(mpOvertime) || mpOvertime < 0) {
    showNotification("Masukkan jumlah man power overtime yang valid.", true);
    return;
  }
  set(ref(db, `ManPowerOvertime/${shiftType}`), mpOvertime)
    .then(() => {
      showNotification(`Man Power Overtime (${shiftType}) berhasil disimpan: ${mpOvertime} orang.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan man power overtime ke database.", true);
      console.error(err);
    });
}
function handleSetMpOvertime() {
  const mpOvertime = parseInt(document.getElementById("mpOvertimeInput").value);
  if (isNaN(mpOvertime) || mpOvertime < 0) {
    showNotification("Masukkan jumlah man power overtime yang valid.", true);
    return;
  }
  saveMpOvertimeToFirebase(mpOvertime);
  document.getElementById("mpOvertimeInput").value = "";
}
document.getElementById("setMpOvertimeBtn")?.addEventListener("click", handleSetMpOvertime);

// Upload functionality - hidden but functional for compatibility
if (uploadBtn) {
  uploadBtn.addEventListener("click", () => {
    const file = fileInput?.files[0];
    if (file) {
      parseExcel(file);
    } else {
      showNotification("Pilih file Excel terlebih dahulu.", true);
    }
  });
}

// Listener tombol bulk assign
bulkAddBtn.addEventListener("click", async () => {
  const selectedJobs = getSelectedJobs();
  if (selectedJobs.length === 0) {
    showNotification("Pilih minimal satu job.", true);
    return;
  }
  let jobsWithTeam = [];
  await Promise.all(
    selectedJobs.map(async (jobNo) => {
      const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
      const snap = await get(jobRef);
      if (snap.exists()) {
        const data = snap.val();
        if (data.team && data.team.trim() !== "") {
          jobsWithTeam.push({ jobNo, team: data.team });
        }
      }
    })
  );
  if (jobsWithTeam.length > 0) {
    showNotification(
      "Terdapat job yang sudah di-assign ke team dan tidak dapat lanjut bulk assign:\n" +
      jobsWithTeam.map(j => `- ${j.jobNo} (Team: ${j.team})`).join("\n"),
      true
    );
    return;
  }
  selectedSingleJob = null;
  window.jobsToBulkAssign = selectedJobs;
  showModal();
});

// Listener tombol assign di modal
confirmAdd.addEventListener("click", async () => {
  const team = document.getElementById("teamSelect").value;
  const jobType = document.getElementById("jobTypeSelect").value;
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  const jobsToUpdate =
    window.jobsToBulkAssign && Array.isArray(window.jobsToBulkAssign) && window.jobsToBulkAssign.length > 0
      ? window.jobsToBulkAssign
      : (selectedSingleJob ? [selectedSingleJob] : getSelectedJobs());
  const loadingIndicator = document.getElementById("loadingIndicator");

  if (jobsToUpdate.length === 0) return showNotification("Tidak ada job yang dipilih.", true);

  loadingIndicator.style.display = "block";
  confirmAdd.disabled = true;

  try {
    // Ambil teamName dari user login (lookup ke node users)
    const teamName = await getTeamNameForCurrentUser();

    await Promise.all(
      jobsToUpdate.map(jobNo =>
        // PATCH: Tambahkan property shift dan teamName pada update
        update(ref(db, "PhxOutboundJobs/" + jobNo), { team, jobType, shift: shiftType, teamName })
      )
    );
    showNotification(`Job berhasil ditambahkan ke team: ${team}`);
    selectedSingleJob = null;
    window.jobsToBulkAssign = null;
    hideModal();
    refreshDataWithoutReset();
  } catch (error) {
    showNotification("Gagal menyimpan data ke Firebase.", true);
  } finally {
    loadingIndicator.style.display = "none";
    confirmAdd.disabled = false;
  }
});

// Setup event listeners untuk checkbox dan tombol action

// Listener tombol close modal
closeModal.addEventListener("click", hideModal);

// Listener klik di luar modal untuk menutup
window.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
// Listener tombol escape key untuk menutup modal
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideModal(); });

// Listener sorting & filter dropdown
sortStatusBtn.addEventListener("click", () => {
  const isCurrentlyOpen = statusDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    statusDropdown.style.display = "block";
  }
});
sortDateBtn.addEventListener("click", () => {
  const isCurrentlyOpen = dateDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    dateDropdown.style.display = "block";
  }
});
sortTeamBtn.addEventListener("click", () => {
  const isCurrentlyOpen = teamDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    teamDropdown.style.display = "block";
  }
});
statusOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  statusDropdown.style.display = "none";
});
dateOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  dateDropdown.style.display = "none";
});
teamOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  teamDropdown.style.display = "none";
});

// Listener tombol clear database
document.getElementById("clearDatabaseBtn").addEventListener("click", clearAllJobs);

async function saveOutJobAchievement() {
  // Ambil semua job dari node PhxOutboundJobs
  const jobsSnap = await get(ref(db, "PhxOutboundJobs"));
  const jobs = jobsSnap.exists() ? Object.values(jobsSnap.val()) : [];

  // Buat struktur tanggal
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearShort = year.toString().slice(-2);
  const nodeYear = `year${year}`;
  const nodeMonth = `${month}_${yearShort}`;
  const nodeDay = String(now.getDate()).padStart(2, '0');

  // Kelompokkan data per shift & teamName
  const result = { NightShift: {}, DayShift: {} };
  for (const job of jobs) {
    if (!job.teamName || !job.jobNo) continue;
    const shiftPath = job.shift === "Night Shift" ? "NightShift" : "DayShift";
    const teamName = job.teamName;
    if (!result[shiftPath][teamName]) result[shiftPath][teamName] = {};
    
    // Gunakan sanitizeValue untuk semua properti untuk mencegah undefined
    result[shiftPath][teamName][job.jobNo] = {
      deliveryDate: sanitizeValue(job.deliveryDate),
      deliveryNote: sanitizeValue(job.deliveryNote),
      jobNo: sanitizeValue(job.jobNo),
      jobType: sanitizeValue(job.jobType),
      qty: sanitizeValue(job.qty),
      remark: sanitizeValue(job.remark),
      shift: sanitizeValue(job.shift),
      status: sanitizeValue(job.status),
      team: sanitizeValue(job.team),
      teamName: sanitizeValue(job.teamName),
      finishAt: sanitizeValue(job.finishAt || "")
    };
  }

  // Simpan ke database
  if (Object.keys(result.NightShift).length > 0) {
    await set(ref(db, `outJobAchievment/${nodeYear}/${nodeMonth}/${nodeDay}/NightShift`), result.NightShift);
  }
  if (Object.keys(result.DayShift).length > 0) {
    await set(ref(db, `outJobAchievment/${nodeYear}/${nodeMonth}/${nodeDay}/DayShift`), result.DayShift);
  }
}

// ========== SAVE TARGET TO DATABASE ==========
document.getElementById("exportExcelBtn").addEventListener("click", async () => {
  showExportLoading(true); // Tampilkan spinner
  await saveOutJobAchievement();
  showNotification("Data achievement berhasil disimpan ke database.");
  showExportLoading(false); // Sembunyikan spinner setelah selesai
});

// ========== Logout Modal ==========
const headerLogoutBtn = document.getElementById("headerLogoutBtn");
const logoutModal = document.getElementById("logoutModal");
const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

// Listener tombol logout
headerLogoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "block";
});
cancelLogoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "none";
});
confirmLogoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../index.html"; // ✅ Dari /outbound/monitoring-control/ balik ke /outbound/index.html
});
window.addEventListener("click", (e) => {
  if (e.target === logoutModal) {
    logoutModal.style.display = "none";
  }
});

// ========== DOWNLOAD OUTBOUND DATA ==========
document.getElementById("downloadDataOutboundBtn").addEventListener("click", async () => {
  showExportLoading(true); // Tampilkan spinner

  try {
    // Ambil data dari PhxOutboundJobs
    const snapshot = await get(ref(db, "PhxOutboundJobs"));
    if (!snapshot.exists()) {
      showNotification("Tidak ada data outbound untuk diunduh.", true);
      showExportLoading(false);
      return;
    }

    // Konversi data ke format array untuk Excel
    const data = snapshot.val();
    const jobsArray = Object.values(data).map(job => {
      // Konversi qty ke number
      const qtyValue = job.qty ? Number(job.qty) : "";
      
      // Format delivery date dengan benar
      let deliveryDate = "";
      try {
        if (job.deliveryDate) {
          // Jika sudah dalam format "DD-MMM-YYYY", ubah ke date object Excel
          const dateParts = job.deliveryDate.split("-");
          if (dateParts.length === 3) {
            const months = {"Jan":0,"Feb":1,"Mar":2,"Apr":3,"May":4,"Jun":5,
                           "Jul":6,"Aug":7,"Sep":8,"Oct":9,"Nov":10,"Dec":11};
            const day = parseInt(dateParts[0]);
            const month = months[dateParts[1]];
            const year = parseInt(dateParts[2]);
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
              // Konversi ke format date Excel (serial number)
              const dateObj = new Date(year, month, day);
              deliveryDate = dateObj;
            } else {
              deliveryDate = job.deliveryDate;
            }
          } else {
            deliveryDate = job.deliveryDate;
          }
        }
      } catch (e) {
        deliveryDate = job.deliveryDate || "";
      }

      return {
        "Job No": job.jobNo || "",
        "Delivery Date": deliveryDate,
        "Delivery Note": job.deliveryNote || "",
        "Remark": job.remark || "",
        "Status": job.status || "",
        "Qty": qtyValue, // Pastikan sebagai number
        "Team": job.team || "",
        "Job Type": job.jobType || "",
        "Shift": job.shift || "",
        "Team Name": job.teamName || ""
      };
    });

    // Buat workbook Excel baru
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobsArray);

    // Set tipe data kolom
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'] = [
      {wch: 15}, // Job No
      {wch: 15, dt: 'd'}, // Delivery Date - set sebagai date
      {wch: 25}, // Delivery Note
      {wch: 30}, // Remark
      {wch: 15}, // Status
      {wch: 10, dt: 'n'}, // Qty - set sebagai numeric
      {wch: 10}, // Team
      {wch: 12}, // Job Type
      {wch: 12}, // Shift
      {wch: 15}  // Team Name
    ];

    // Tambahkan worksheet ke workbook
    XLSX.utils.book_append_sheet(wb, ws, "Outbound Jobs");

    // Generate nama file dengan timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const fileName = `Outbound_Data_${dateStr}_${timeStr}.xlsx`;

    // Download file Excel
    XLSX.writeFile(wb, fileName);
    showNotification(`Data outbound berhasil diunduh sebagai ${fileName}`);
  } catch (error) {
    console.error("Error downloading data:", error);
    showNotification("Terjadi kesalahan saat mengunduh data.", true);
  } finally {
    showExportLoading(false); // Sembunyikan spinner setelah selesai
  }
});

// SHIFT TOGGLE LOGIC
const shiftDayRadio = document.getElementById("shiftDay");
const shiftNightRadio = document.getElementById("shiftNight");

// Load saved shift on page load
const savedShiftType = localStorage.getItem("shiftType") || "Day";
if (savedShiftType === "Night") {
  shiftNightRadio.checked = true;
  shiftDayRadio.checked = false;
} else {
  shiftDayRadio.checked = true;
  shiftNightRadio.checked = false;
}
localStorage.setItem("shiftType", savedShiftType); // ensure always set

shiftDayRadio.addEventListener("change", function() {
  if (this.checked) localStorage.setItem("shiftType", "Day");
});
shiftNightRadio.addEventListener("change", function() {
  if (this.checked) localStorage.setItem("shiftType", "Night");
});

// Tampilkan shift dari localStorage di bagian user profile
const shiftValue = localStorage.getItem("shift");
const userShiftSpan = document.getElementById("userShift");

if (shiftValue && userShiftSpan) {
  userShiftSpan.textContent = shiftValue;
}

// (Opsional) Ganti huruf avatar jadi huruf awal shift
const userInitialSpan = document.getElementById("userInitial");
if (shiftValue && userInitialSpan) {
  userInitialSpan.textContent = shiftValue.charAt(0).toUpperCase();
}

// 🔐 Role-based UI protection
const position = localStorage.getItem("position");

if (position === "Asst. Manager" || position === "Manager") {
  const setTargetBtn = document.getElementById("setPlanTargetBtn");
  const uploadExcelBtn = document.getElementById("uploadBtn");
  const deleteDataBtn = document.getElementById("clearDatabaseBtn");

  if (setTargetBtn) setTargetBtn.style.display = "none";
  if (uploadExcelBtn) uploadExcelBtn.style.display = "none";
  if (deleteDataBtn) deleteDataBtn.style.display = "none";
}

// Inisialisasi pada DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM Content Loaded');
  
  // Setup search functionality
  setupSearchFunctionality();
  
  // Tambahkan panggilan ke fungsi populasi data user
  populateUserProfileData();
  
  // Setup other components first
  populateMpPicSelector();
  renderMpPicListTable();
  
  // Setup basic event listeners for table (fallback)
  attachTableEventListeners();
});

// Kumpulkan mapping nama ke userID (ambil dari key node, bukan isi objek)==================================================================================
/* --- STATE & VARIABEL GLOBAL --- */
let mpPicSortOrder = 'team'; // 'team' atau 'name'
let mpPicSortAsc = true;
let picUserMap = {}; // { name: { userID, name } }

/* --- Populate Dropdown Pilih PIC --- */
async function populateMpPicSelector() {
  const shift = (localStorage.getItem("shift") || "").toLowerCase();
  const mpPicSelector = document.getElementById("mpPicSelector");
  if (!mpPicSelector) return;

  mpPicSelector.innerHTML = '<option value="">-- Pilih PIC --</option>';
  const snapshot = await get(ref(db, "users"));
  if (!snapshot.exists()) return;
  const usersRaw = snapshot.val();

  let filtered = [];
  Object.entries(usersRaw).forEach(([userID, userObj]) => {
    const s = (userObj.Shift || "").toLowerCase();
    if (
      (shift === "green team" && (s === "green team" || s.includes("non shift"))) ||
      (shift === "blue team" && (s === "blue team" || s.includes("non shift"))) ||
      ((shift === "non shift" || shift === "non-shift" || shift === "nonshift") && (
        s === "green team" || s === "blue team" || s.includes("non shift")
      )) ||
      (!["green team", "blue team", "non shift", "nonshift", "non-shift"].includes(shift)) // default: tampilkan semua
    ) {
      filtered.push({ ...userObj, userID });
    }
  });

  // Sort abjad A-Z berdasarkan nama
  filtered.sort((a, b) => {
    const nameA = (a.Name || a.Username || "").toUpperCase();
    const nameB = (b.Name || b.Username || "").toUpperCase();
    return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
  });
  
  picUserMap = {};
  filtered.forEach(u => {
    const name = u.Name || u.Username || "";
    if (name) {
      picUserMap[name] = {
        userID: u.userID,
        name: name
      };
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      mpPicSelector.appendChild(opt);
    }
  });
}

/* --- Handler Tambah MP PIC --- */
document.getElementById("setMpPicBtn")?.addEventListener("click", async function() {
  const mpPicSelector = document.getElementById("mpPicSelector");
  const selectedName = mpPicSelector.value;
  const team = document.getElementById("mpPicTeamSelector")?.value || "";
  if (!selectedName || !picUserMap[selectedName]) {
    showNotification("Pilih PIC yang valid.", true);
    return;
  }
  const { userID, name } = picUserMap[selectedName];
  if (!userID) {
    showNotification("User ID PIC tidak ditemukan.", true);
    return;
  }
  try {
    const snapshot = await get(ref(db, "MPPIC"));
    let countForTeam = 0;
    if (snapshot.exists()) {
      const mpPicData = snapshot.val();
      countForTeam = Object.values(mpPicData).filter(entry => entry.team === team).length;
    }
    if (countForTeam >= 2) {
      showNotification(`Maksimal MP PIC untuk Team ${team} sudah 2 orang!`, true);
      return;
    }
    const waktu_set = new Date().toISOString();
    await set(ref(db, `MPPIC/${userID}`), {
      name,
      userID,
      waktu_set,
      team
    });
    showNotification(`PIC ${name} (${userID}) berhasil diset!`);
    renderMpPicListTable(); // Refresh tabel setelah tambah
  } catch (err) {
    showNotification("Gagal menyimpan PIC ke database.", true);
    console.error(err);
  }
});

/* --- Render Tabel MP PIC Aktif Full JS --- */
/* --- Render Tabel MP PIC Aktif dalam format Card --- */
async function renderMpPicListTable() {
  const container = document.getElementById('mpPicTableContainer');
  if (!container) return;
  container.innerHTML = '';
  container.className = 'mp-pic-cards'; // Ensure the correct class is applied

  // Fetch Data
  let data = [];
  try {
    const snapshot = await get(ref(db, "MPPIC"));
    if (snapshot.exists()) {
      data = Object.values(snapshot.val()).map(entry => ({
        name: entry.name,
        team: entry.team,
        userID: entry.userID
      }));
    }
  } catch (e) {
    data = [];
  }

  // Sort logic
  data.sort((a, b) => {
    let cmp = 0;
    if (mpPicSortOrder === 'team') {
      cmp = (a.team || '').localeCompare(b.team || '');
      if (cmp === 0) cmp = (a.name || '').localeCompare(b.name || '');
    } else {
      cmp = (a.name || '').localeCompare(b.name || '');
    }
    return mpPicSortAsc ? cmp : -cmp;
  });

  // Render as cards
  if (data.length === 0) {
    // Show empty state
    const emptyState = document.createElement('div');
    emptyState.className = 'mp-pic-empty';
    emptyState.textContent = 'Belum ada MP PIC';
    container.appendChild(emptyState);
  } else {
    // Create a card for each PIC
    data.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'mp-pic-card';
      
      // Info section (name, team, userID)
      const infoDiv = document.createElement('div');
      infoDiv.className = 'mp-pic-info';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'mp-pic-name';
      nameDiv.textContent = entry.name;
      infoDiv.appendChild(nameDiv);
      
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'mp-pic-details';
      
      const teamSpan = document.createElement('span');
      teamSpan.className = 'mp-pic-team';
      teamSpan.textContent = entry.team;
      detailsDiv.appendChild(teamSpan);
      
      const userIdSpan = document.createElement('span');
      userIdSpan.className = 'mp-pic-userid';
      userIdSpan.textContent = entry.userID;
      detailsDiv.appendChild(userIdSpan);
      
      infoDiv.appendChild(detailsDiv);
      card.appendChild(infoDiv);
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Hapus';
      deleteBtn.setAttribute('data-userid', entry.userID);
      card.appendChild(deleteBtn);
      
      container.appendChild(card);
    });
  }

  // Attach event listeners to delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const userID = this.getAttribute('data-userid');
      if (!userID) return;
      showConfirmModal({
        title: "Konfirmasi Hapus MP PIC",
        message: `Apakah Anda yakin ingin menghapus MP PIC ini?`,
        okText: "Hapus",
        cancelText: "Batal",
        onConfirm: async () => {
          await remove(ref(db, `MPPIC/${userID}`));
          showNotification("MP PIC berhasil dihapus.");
          renderMpPicListTable();
        }
      });
    });
  });
}

authPromise.then(() => {
  console.log('Auth promise resolved');
  populateStatusOptions();
  
  // Tambahkan panggilan ke fungsi populasi data user
  populateUserProfileData();
  
  // Load data first, then setup table
  loadJobsFromFirebase();
});