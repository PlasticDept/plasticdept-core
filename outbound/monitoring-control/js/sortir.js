// sortir.js
// Versi terbaru: support upload Excel baru, simpan ke root node PhxOutboundJobs, assignment job terhubung node baru
// Komentar sudah ditambahkan pada setiap fungsi dan listener

import { db, authPromise } from "./config.js";
import { ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { nowInWIB, toWIB, getBusinessDateForShift, breakdownBusinessDate, formatDateTimeWIB } from "./shift-business-date.js";

/* =========================
/**
 * Update color of userShift label based on its value.
 * Yellow for Non Shift, Blue for Blue Team, Green for Green Team.
 */
function updateUserShiftColor() {
  const userShiftSpan = document.getElementById('userShift');
  if (userShiftSpan) {
    const value = userShiftSpan.textContent.trim();
    userShiftSpan.style.background = '';
    userShiftSpan.style.color = '';
    userShiftSpan.style.borderRadius = '6px';
    userShiftSpan.style.padding = '2px 8px';
    userShiftSpan.style.fontWeight = 'bold';
    userShiftSpan.style.display = 'inline-block'; // label width auto fit to text
    if (value === 'Non Shift') {
      userShiftSpan.style.background = '#ffe066'; // yellow
      userShiftSpan.style.color = '#7a5c00';
    } else if (value === 'Blue Team') {
      userShiftSpan.style.background = '#339af0'; // blue
      userShiftSpan.style.color = '#fff';
    } else if (value === 'Green Team') {
      userShiftSpan.style.background = '#51cf66'; // green
      userShiftSpan.style.color = '#fff';
    } else {
      userShiftSpan.style.background = '';
      userShiftSpan.style.color = '';
    }
  }
}

/**
 * UTILITY / HELPER FUNCTIONS
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
 * Mengkonversi nilai ManPower menjadi nilai target berdasarkan rumus:
 * 0.5mp = 8820, 1mp = 17640, 2mp = 35280, 3mp = 52920
 * @param {number} manPower - Nilai ManPower
 * @return {number} - Nilai target yang sesuai
 */
function convertManPowerToTarget(manPower) {
  if (manPower <= 0) return 0;
  
  // Konversi berdasarkan rumus
  if (manPower === 0.5) return 8820;
  else return Math.round(manPower * 17640); // 1mp = 17640
}

/**
 * Fungsi untuk menghapus nilai ManPower dan PlanTarget untuk team tertentu
 * @param {string} team - Nama team (Sugity/Reguler)
 */
function clearManPowerAndTarget(team) {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  
  if (!team) {
    showNotification("Team tidak valid.", true);
    return;
  }
  
  // Konfirmasi sebelum menghapus
  showConfirmModal({
    title: "Konfirmasi Hapus MP",
    message: `Apakah Anda yakin ingin menghapus nilai ManPower dan Target untuk ${team} (${shiftType})?`,
    okText: "Hapus",
    okClass: "danger",
    onConfirm: async () => {
      try {
        // Hapus nilai ManPower dan PlanTarget secara bersamaan
        const updates = {};
        updates[`ManPower/${shiftType}/${team}`] = null;
        updates[`PlanTarget/${shiftType}/${team}`] = null;
        
        await update(ref(db), updates);
        showNotification(`ManPower dan Target untuk ${team} (${shiftType}) berhasil dihapus.`);
      } catch (err) {
        showNotification("Gagal menghapus data dari database.", true);
        console.error(err);
      }
    }
  });
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
 * Format tanggal menjadi dd-MMM-yyyy tanpa komponen waktu.
 */
function formatToCustomDate(date) {
  // Memastikan kita hanya menggunakan komponen tanggal, bukan waktu
  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  const day = String(dateOnly.getUTCDate()).padStart(2, "0");
  const month = dateOnly.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = dateOnly.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format tanggal dari input berbagai tipe ke custom format.
 * Memastikan semua tanggal dalam format DD-MMM-YYYY tanpa komponen waktu.
 */
function formatDate(input) {
  if (!input) return "";
  
  // Jika input berupa string dan ada spasi (antara tanggal dan waktu), potong waktu
  if (typeof input === "string" && input.includes(" ")) {
    // Strip any time component if present
    input = input.split(" ")[0];
  }
  
  // Handle Excel number format (days since 1900-01-01)
  if (typeof input === "number") {
    const date = new Date(Math.round((input - 25569) * 86400 * 1000));
    return formatToCustomDate(date);
  }
  
  // Try parsing as date string (handles ISO format, MM/DD/YYYY, DD/MM/YYYY, etc)
  const parsed = new Date(input);
  if (!isNaN(parsed)) {
    return formatToCustomDate(parsed);
  }
  
  // Handle DD-MM-YYYY or MM-DD-YYYY format
  if (typeof input === "string" && input.includes("-")) {
    const parts = input.split("-");
    if (parts.length === 3) {
      // Try both date formats
      const date1 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD-MM-YYYY
      const date2 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`); // MM-DD-YYYY
      
      if (!isNaN(date1)) return formatToCustomDate(date1);
      if (!isNaN(date2)) return formatToCustomDate(date2);
    }
  }
  
  // Return original if parsing fails
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

// Ganti isi fungsi createTableRow dengan versi berikut
function createTableRow(job) {
  const row = document.createElement("tr");
  const badgeClass = badgeForStatus(job.status);

  // Sanitasi nilai sebelum menampilkan
  const remark = sanitizeValue(job.remark);
  const team = sanitizeValue(job.team);
  const owner = sanitizeValue(job.owner);  // Add this line to extract and sanitize the owner

  // Khusus untuk qty, tangani kasus numerik
  let qtyDisplay = "";
  if (job.qty && !isNaN(job.qty)) {
    qtyDisplay = Number(job.qty).toLocaleString();
  }

  row.innerHTML = `
      <td><input type="checkbox" data-jobno="${job.jobNo}"></td>
      <td class="row-no"></td> <!-- ✅ kolom No (diisi kemudian oleh renumberRows) -->
      <td>${sanitizeValue(job.jobNo)}</td>
      <td>${owner}</td>
      <td>${sanitizeValue(job.deliveryDate)}</td>
      <td>${sanitizeValue(job.deliveryNote)}</td>
      <td>${remark}</td>
      <td><span class="badge ${badgeClass}">${sanitizeValue(job.status)}</span></td>
      <td>${qtyDisplay}</td>
      <td>${team}</td>
      <td class="table-actions">
        <button class="action-btn assign-btn" data-jobno="${job.jobNo}" title="Assign Job">
          <i class="fas fa-user-plus"></i>
        </button>
        <button class="action-btn unassign-btn" data-jobno="${job.jobNo}" title="Unassign Job">
          <i class="fas fa-user-minus"></i>
        </button>
        <button class="action-btn edit-btn" data-jobno="${job.jobNo}" title="Edit Job">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    `;
  return row;
}

// Tambahkan fungsi baru untuk memberi nomor urut pada kolom "No"
function renumberRows() {
  const rows = document.querySelectorAll('#jobTable tbody tr');
  let i = 1;
  rows.forEach(tr => {
    const noCell = tr.querySelector('.row-no') || tr.children[1];
    if (noCell) noCell.textContent = i++;
  });
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

// Perbarui renderTableData agar memanggil renumberRows di akhir
function renderTableData(data) {
  const tbody = document.querySelector('#jobTable tbody');
  if (!tbody) return;

  // Sort data by remark (ascending, case-insensitive)
  const sortedData = [...data].sort((a, b) => {
    const aRemark = String(a.remark || '').toLowerCase();
    const bRemark = String(b.remark || '').toLowerCase();
    return aRemark.localeCompare(bRemark, 'id', { sensitivity: 'base' });
  });

  tbody.innerHTML = '';
  sortedData.forEach(job => {
    const row = createTableRow(job);
    tbody.appendChild(row);
  });

  // ✅ Nomori ulang sesuai baris yang tampil (termasuk saat difilter)
  renumberRows();

  attachTableEventListeners();
  updateSelectAllCheckbox();
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
  // Handle assign button clicks - perbaiki selector untuk mendukung icon dan button
  if (e.target.classList.contains('assign-btn') || e.target.closest('.assign-btn')) {
    e.preventDefault();
    const clickedElement = e.target.classList.contains('assign-btn') ? e.target : e.target.closest('.assign-btn');
    const jobNo = clickedElement.getAttribute('data-jobno');
    
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
  if (e.target.classList.contains('unassign-btn') || e.target.closest('.unassign-btn')) {
    e.preventDefault();
    const clickedElement = e.target.classList.contains('unassign-btn') ? e.target : e.target.closest('.unassign-btn');
    const jobNo = clickedElement.getAttribute('data-jobno');
    
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
  
  // Handle edit button clicks - pastikan tidak dihapus
  if (e.target.classList.contains('edit-btn') || e.target.closest('.edit-btn')) {
    e.preventDefault();
    const editBtn = e.target.classList.contains('edit-btn') ? e.target : e.target.closest('.edit-btn');
    const jobNo = editBtn.getAttribute('data-jobno');
    enterEditMode(jobNo);
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
 * Menghapus job dengan status Packed dan Completed di node PhxOutboundJobs,
 * serta menghapus node tambahan: MPPIC, ManPower, ManPowerOvertime, PICOperator, PlanTarget.
 */
function clearAllJobs() {
  showConfirmModal({
    title: "Konfirmasi Hapus Data",
    message: `
      Apakah Anda yakin ingin <b>MENGHAPUS JOB</b> dengan status <b>Packed</b> dan <b>Completed</b> dari database?<br>
      <br>
      <span style="color:#d32f2f;font-weight:bold;">
        <u>PERHATIAN:</u> <br>
        Tindakan ini juga akan menghapus seluruh data di node:<br>
        - MPPIC<br>
        - ManPower<br>
        - ManPowerOvertime<br>
        - PICOperator<br>
        - PlanTarget
      </span>
    `,
    okText: "Hapus Semua",
    okClass: "logout",
    onConfirm: () => {
      // 1. Hapus job di PhxOutboundJobs (status Packed/Completed)
      get(ref(db, "PhxOutboundJobs"))
        .then((snapshot) => {
          if (!snapshot.exists()) {
            showNotification("Tidak ada data job yang dapat dihapus.", true);
            // Tetap hapus node lainnya meski job kosong
            return Promise.resolve({});
          }

          const jobs = snapshot.val();
          const updates = {};
          let deleteCount = 0;

          // Filter job dengan status Packed atau Completed
          Object.entries(jobs).forEach(([jobNo, jobData]) => {
            if (jobData.status === "Packed" || jobData.status === "Completed") {
              updates[jobNo] = null; // Set null untuk menghapus data
              deleteCount++;
            }
          });

          if (deleteCount === 0) {
            showNotification("Tidak ada job dengan status Packed atau Completed yang dapat dihapus.", true);
          }

          // Hapus job yang terfilter menggunakan update
          return update(ref(db, "PhxOutboundJobs"), updates).then(() => deleteCount);
        })
        .then((deleteCount) => {
          if (typeof deleteCount === "number" && deleteCount > 0) {
            showNotification(`✅ Berhasil menghapus ${deleteCount} job dengan status Packed dan Completed.`);
          }
          loadJobsFromFirebase(); // Refresh data setelah penghapusan

          // 2. Hapus node tambahan (MPPIC, ManPower, ManPowerOvertime, PICOperator, PlanTarget)
          return Promise.all([
            remove(ref(db, "MPPIC")),
            remove(ref(db, "ManPower")),
            remove(ref(db, "ManPowerOvertime")),
            remove(ref(db, "PICOperator")),
            remove(ref(db, "PlanTarget")),
          ]);
        })
        .then(() => {
          showNotification("✅ Semua node tambahan (MPPIC, ManPower, ManPowerOvertime, PICOperator, PlanTarget) berhasil dihapus.");
        })
        .catch((error) => {
          console.error("Gagal menghapus data:", error);
          showNotification("❌ Gagal menghapus data job atau node tambahan!", true);
        });
    }
  });
}

// Add this function after the clearAllJobs function

/**
 * Menghapus job dengan status "Completed" yang tidak memiliki field "shift" dari database.
 * Fungsi ini membantu membersihkan database dari job yang sudah selesai namun belum diassign.
 */
function clearCompletedJobsWithoutShift() {
  showConfirmModal({
    title: "Konfirmasi Cargo Out",
    message: `
      Apakah Anda yakin ingin <b>MENGHAPUS JOB</b> dengan status <b>Completed</b> yang <b>TIDAK MEMILIKI</b> field "shift"?<br>
      <br>
      <span style="color:#d32f2f;font-weight:bold;">
        <u>PERHATIAN:</u> <br>
        Tindakan ini akan menghapus seluruh job completed yang belum diassign ke team manapun.
      </span>
    `,
    okText: "Hapus Job",
    okClass: "logout",
    onConfirm: () => {
      // Ambil semua job dari PhxOutboundJobs
      get(ref(db, "PhxOutboundJobs"))
        .then((snapshot) => {
          if (!snapshot.exists()) {
            showNotification("Tidak ada data job yang dapat dihapus.", true);
            return Promise.resolve({});
          }

          const jobs = snapshot.val();
          const updates = {};
          let deleteCount = 0;

          // Filter job dengan status "Completed" dan tidak memiliki shift
          Object.entries(jobs).forEach(([jobNo, jobData]) => {
            if (jobData.status === "Completed" && (!jobData.shift || jobData.shift.trim() === "")) {
              updates[jobNo] = null; // Set null untuk menghapus data
              deleteCount++;
            }
          });

          if (deleteCount === 0) {
            showNotification("Tidak ada job dengan status Completed tanpa shift yang dapat dihapus.", true);
            return Promise.resolve(0);
          }

          // Hapus job yang terfilter menggunakan update batch
          return update(ref(db, "PhxOutboundJobs"), updates).then(() => deleteCount);
        })
        .then((deleteCount) => {
          if (typeof deleteCount === "number" && deleteCount > 0) {
            showNotification(`✅ Berhasil menghapus ${deleteCount} job dengan status Completed tanpa shift.`);
            loadJobsFromFirebase(); // Refresh data setelah penghapusan
          }
        })
        .catch((error) => {
          console.error("Gagal menghapus data:", error);
          showNotification("❌ Gagal menghapus data job!", true);
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
 * Fungsi untuk melakukan update data job dengan preservasi field penting.
 * Memastikan field tertentu tidak ditimpa jika sudah memiliki nilai.
 * @param {string} jobNo - Nomor job yang akan diupdate
 * @param {Object} newData - Data baru yang akan disimpan
 * @returns {Promise<Object>} - Data yang sudah dipreservasi
 */
async function preserveExistingFields(jobNo, newData) {
  try {
    // Field yang harus dipertahankan jika sudah ada nilainya
    const preserveFields = ["finishAt", "jobType", "shift", "team", "teamName"];
    
    // Dapatkan data yang sudah ada di database
    const jobRef = ref(db, `PhxOutboundJobs/${jobNo}`);
    const snapshot = await get(jobRef);
    
    // Jika job sudah ada di database
    if (snapshot.exists()) {
      const existingData = snapshot.val();
      const finalData = {...newData}; // Clone data baru
      
      // Untuk setiap field yang perlu dipertahankan
      for (const field of preserveFields) {
        // Jika field sudah ada nilai di database, pertahankan nilai tersebut
        if (existingData[field] !== undefined && 
            existingData[field] !== null && 
            existingData[field] !== "" && 
            !(typeof existingData[field] === 'string' && existingData[field].trim() === "")) {
          // Prioritaskan nilai yang sudah ada di database
          finalData[field] = existingData[field];
          console.log(`🔒 Mempertahankan field ${field}: '${existingData[field]}'`);
        }
      }
      
      return finalData;
    }
    
    // Jika job belum ada, kembalikan data baru apa adanya
    return newData;
  } catch (error) {
    console.error(`Error saat preservasi field untuk job ${jobNo}:`, error);
    return newData; // Kembalikan data asli jika terjadi error
  }
}

/**
 * Simpan data hasil parsing ke PhxOutboundJobs di Firebase.
 * Jika ada job di database yang tidak ada di data baru, status-nya diubah menjadi "Completed".
 * Digunakan oleh fungsi parseExcel asli (format lama).
 * 
 * PENTING: Implementasi ini berbeda dengan syncUploadedJobsToFirebase.
 * - Fungsi ini menggunakan job.JobNo (huruf besar)
 * - Menggunakan update individual per job
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
    const updateMissing = [];

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
          // Nilai default untuk field yang dipreservasi
          team: "",
          jobType: "",
          shift: "", 
          teamName: "",
          finishAt: ""
        };
        
        // Gunakan fungsi preservasi untuk mempertahankan field penting
        return preserveExistingFields(jobNo, jobData).then(preservedData => {
          return set(jobRef, preservedData);
        });
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
function applyMultiFilter() {
  const selectedStatus = statusOptions.value;
  const selectedDate = dateOptions.value;
  const selectedTeam = teamOptions.value;
  
  filteredJobs = [];
  
  allJobsData.forEach(job => {
    const matchStatus = selectedStatus === "all" || job.status === selectedStatus;
    const matchDate = selectedDate === "all" || job.deliveryDate === selectedDate;
    const isBlankTeam = !job.team || job.team.toLowerCase() === "none";
    const matchTeam = selectedTeam === "all" || (selectedTeam === "none" && isBlankTeam) || job.team === selectedTeam;
    
    if (matchStatus && matchDate && matchTeam) {
      filteredJobs.push(job);
    }
  });
  
  // Render filtered data
  renderTableData(filteredJobs);
}

/**
 * Update indikator filter aktif di halaman.
 */
function updateFilterIndicator() {
  const status = statusOptions.value;
  const date = dateOptions.value;
  const team = teamOptions.value;
  const filters = [];
  if (status !== "all") filters.push(`Status: ${status}`);
  if (date !== "all") filters.push(`Date: ${date}`);
  if (team !== "all") filters.push(`Team: ${team === "none" ? "None/blank" : team}`);
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
const bulkUnassignBtn = document.getElementById("bulkUnassignBtn");
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
let isPhoenixFormat = false; // Track if Phoenix format is being used

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

// Listener tombol clear man power
document.getElementById("clearManPowerBtn")?.addEventListener("click", function() {
  const team = manPowerTeamSelector.value;
  clearManPowerAndTarget(team);
});

// Listener tombol set plan target (jika masih digunakan)
setPlanTargetBtn?.addEventListener("click", handleSetPlanTarget);

// Listener tombol set man power
setManPowerBtn?.addEventListener("click", handleSetManPower);

// --- Fungsi Set Man Power ---
function saveManPowerToFirebase(team, manPower) {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  if (!team || isNaN(manPower) || manPower < 0) {
    showNotification("Data man power tidak valid.", true);
    return Promise.reject(new Error("Data man power tidak valid"));
  }
  
  const dbPath = `ManPower/${shiftType}/${team}`;
  return set(ref(db, dbPath), manPower)
    .then(() => {
      showNotification(`Man Power untuk ${team} (${shiftType}) berhasil disimpan: ${manPower} orang.`);
      
      // Hitung dan kembalikan nilai target
      const targetValue = convertManPowerToTarget(manPower);
      return targetValue;
    });
}

// Modifikasi fungsi ini untuk auto-update target saat ManPower berubah
function handleSetManPower() {
  const team = manPowerTeamSelector.value;
  const manPower = parseFloat(manPowerInput.value);

  if (isNaN(manPower) || manPower < 0) {
    showNotification("Masukkan jumlah man power yang valid.", true);
    return;
  }
  
  // Simpan ManPower ke Firebase
  saveManPowerToFirebase(team, manPower)
    .then(() => {
      // Setelah ManPower disimpan, hitung dan update PlanTarget
      const targetValue = convertManPowerToTarget(manPower);
      return savePlanTargetToFirebase(team, targetValue);
    })
    .then(() => {
      showNotification(`Man Power dan Target untuk ${team} berhasil disimpan.`);
      manPowerInput.value = "";
    })
    .catch(err => {
      showNotification("Gagal menyimpan data ke database.", true);
      console.error(err);
    });
}

// Fungsi untuk mengambil nilai ManPower dari Firebase dan menghitung Target
async function updatePlanTargetFromManPower() {
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  
  try {
    // Ambil data ManPower
    const snapshot = await get(ref(db, `ManPower/${shiftType}`));
    if (!snapshot.exists()) return;
    
    const manPowerData = snapshot.val();
    
    // Update PlanTarget untuk setiap team
    const updates = {};
    
    for (const [team, mpValue] of Object.entries(manPowerData)) {
      const targetValue = convertManPowerToTarget(mpValue);
      updates[`PlanTarget/${shiftType}/${team}`] = targetValue;
    }
    
    // Simpan semua perubahan sekaligus
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
      console.log("✅ Target diperbarui berdasarkan nilai ManPower");
    }
  } catch (error) {
    console.error("Gagal memperbarui Target:", error);
  }
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

// ========== UPLOAD MODAL & FUNCTIONALITY ==========
// Modal dan elemen-elemen terkait upload
const uploadModal = document.getElementById("uploadModal");
const closeUploadModal = document.getElementById("closeUploadModal");
const uploadDataBtn = document.getElementById("uploadDataBtn");
const uploadFileInput = document.getElementById("uploadFileInput");
const submitUploadBtn = document.getElementById("submitUploadBtn");
const selectedFileName = document.getElementById("selectedFileName");
const uploadLoadingIndicator = document.getElementById("uploadLoadingIndicator");
const uploadModePhoenix = document.getElementById("uploadModePhoenix");
const uploadModeZLogix = document.getElementById("uploadModeZLogix");
const modalNotification = document.getElementById("modalNotification");
const modalNotificationText = document.getElementById("modalNotificationText");

// Mode upload saat ini (default: phoenix)
let currentUploadMode = "phoenix";

// Show upload modal when upload button is clicked
uploadDataBtn?.addEventListener("click", () => {
  uploadModal.style.display = "block";
  // Reset form state
  uploadFileInput.value = "";
  selectedFileName.textContent = "Belum ada file yang dipilih";
  submitUploadBtn.disabled = true;
  uploadModePhoenix.checked = true;
  currentUploadMode = "phoenix";
  // Reset notifikasi modal
  hideModalNotification();
  // Bisa juga ditambahkan notifikasi disini untuk memberi tahu user harus memilih file
  // showModalNotification("Silakan pilih file Excel untuk diupload", false);
});

// Close upload modal
closeUploadModal?.addEventListener("click", () => {
  uploadModal.style.display = "none";
  hideModalNotification(); // Reset notifikasi modal saat ditutup
  clearTimeout(window.modalNotificationTimeout); // Pastikan timeout dibersihkan
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === uploadModal) {
    uploadModal.style.display = "none";
    hideModalNotification(); // Reset notifikasi modal saat ditutup
    clearTimeout(window.modalNotificationTimeout); // Pastikan timeout dibersihkan
  }
});

// Handle file selection
uploadFileInput?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFileName.textContent = file.name;
    submitUploadBtn.disabled = false;
    // Hapus notifikasi error jika ada, karena file sudah dipilih
    hideModalNotification();
  } else {
    selectedFileName.textContent = "Belum ada file yang dipilih";
    submitUploadBtn.disabled = true;
    // Tampilkan notifikasi error jika file dihapus/dibatalkan
    showModalNotification("Belum ada file yang dipilih", true);
  }
});

// Handle mode toggle
uploadModePhoenix?.addEventListener("change", () => {
  if (uploadModePhoenix.checked) {
    currentUploadMode = "phoenix";
    isPhoenixFormat = true;
    // Tampilkan informasi format untuk Phoenix
    showModalNotification("Format Phoenix: Header di baris ke-3, data mulai baris ke-4", false);
  }
});

uploadModeZLogix?.addEventListener("change", () => {
  if (uploadModeZLogix.checked) {
    currentUploadMode = "zlogix";
    isPhoenixFormat = false;
    // Tampilkan informasi format untuk Z-Logix
    showModalNotification("Format Z-Logix: Header di baris ke-5, data mulai baris ke-6", false);
  }
});

/**
 * Fungsi untuk menampilkan notifikasi dalam modal upload
 * @param {string} message - Pesan yang akan ditampilkan dalam modal
 * @param {boolean} isError - Jika true, tampilkan sebagai error (merah)
 * @param {number} duration - Durasi tampilan notifikasi dalam milidetik, default 5000ms
 */
function showModalNotification(message, isError = false, duration = 5000) {
  if (!modalNotification || !modalNotificationText) {
    console.warn("Modal notification elements not found");
    return;
  }
  
  console.log(`Showing modal notification: ${message} (isError: ${isError})`);
  modalNotificationText.textContent = message;
  modalNotification.classList.toggle('error', isError);
  modalNotification.classList.toggle('success', !isError);
  modalNotification.style.display = 'block';
  
  // Hapus notifikasi setelah durasi yang ditentukan
  clearTimeout(window.modalNotificationTimeout);
  
  // Jika durasinya 0, notifikasi akan tetap tampil sampai modal ditutup atau notifikasi disembunyikan manual
  if (duration > 0) {
    window.modalNotificationTimeout = setTimeout(() => {
      modalNotification.style.display = 'none';
    }, duration);
  }
}

/**
 * Fungsi untuk menyembunyikan notifikasi modal
 */
function hideModalNotification() {
  if (modalNotification) {
    console.log("Hiding modal notification");
    modalNotification.style.display = 'none';
  } else {
    console.warn("Modal notification element not found");
  }
}

// Handle upload submission
submitUploadBtn?.addEventListener("click", () => {
  const file = uploadFileInput.files[0];
  if (!file) {
    showModalNotification("Pilih file terlebih dahulu (CSV, XLS, XLSX).", true);
    // Fokuskan ke elemen input file untuk mempermudah pemilihan file
    uploadFileInput.click();
    return;
  }
  
  // Validasi tipe file
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const validExtensions = ['csv', 'xls', 'xlsx'];
  if (!validExtensions.includes(fileExtension)) {
    showModalNotification(`Tipe file tidak didukung. Gunakan file ${validExtensions.join(', ')}`, true);
    return;
  }
  
  uploadLoadingIndicator.style.display = "block";
  submitUploadBtn.disabled = true;
  hideModalNotification(); // Sembunyikan notifikasi sebelumnya jika ada
  
  // Reset isPhoenixFormat based on selected mode
  isPhoenixFormat = (currentUploadMode === "phoenix");
  
  // Parse file based on selected mode
  if (currentUploadMode === "phoenix") {
    parsePhoenixExcel(file);
  } else {
    parseZLogixExcel(file);
  }
});

/**
 * Fungsi parsing file Excel/CSV format Phoenix.
 * Header di baris ke-3, data mulai baris ke-4.
 * Field mapping sesuai dengan struktur:
 * Job No. ===========> jobNo
 * ETD ==============> deliveryDate
 * Delivery Note No.==> deliveryNote
 * BC No. ===========> qty
 * Reff. No.==========> remark
 * Status ===========> status
 */
function parsePhoenixExcel(file) {
  console.log("Starting Phoenix format parsing dengan header di baris 3, data mulai baris 4");
  
  parseExcelFile(file, {
    headerRow: 3, // Header di baris ke-3 (index 2)
    dataStartRow: 4, // Data mulai di baris ke-4 (index 3)
    startColumn: 0, // Kolom mulai dari kolom pertama (index 0) - changed from 1
    mapping: {
      // Reversed mapping to fix the issue
      "jobNo": "Job No.",
      "deliveryDate": "ETD",
      "deliveryNote": "Delivery Note No.",
      "qty": "BC No.",
      "remark": "Reff. No.",
      "status": "Status"
    },
    formatters: {
      // Format deliveryDate to DD-MMM-YYYY
      deliveryDate: (value) => {
        if (!value) return "";
        
        try {
          let date;
          if (value instanceof Date) {
            date = value;
          } else if (typeof value === 'number') {
            // Handle Excel date serial number
            date = new Date(Math.round((value - 25569) * 86400 * 1000));
          } else {
            // Mencoba parse format lainnya
            date = new Date(value);
          }
          
          if (isNaN(date.getTime())) {
            console.warn("Invalid date format:", value);
            return value; // Return original if can't parse
          }
          
          // Format tanggal ke DD-MMM-YYYY tanpa waktu
          const day = date.getDate().toString().padStart(2, '0');
          const month = date.toLocaleString('en-US', { month: 'short' });
          const year = date.getFullYear();
          
          return `${day}-${month}-${year}`;
        } catch (err) {
          console.error("Error formatting date:", err);
          return value; // Return original if error
        }
      },
      
      // Format job number
      jobNo: (value) => {
        if (!value) return "";
        return String(value).trim();
      },
      
      // Format quantity/BC No
      qty: (value) => {
        if (value === null || value === undefined || value === "") return "";
        // Convert to number if possible, otherwise keep as string
        const num = Number(value);
        return isNaN(num) ? String(value).trim() : num;
      },
      
      // Format status
      status: (value) => {
        if (!value) return "Pending Allocation";
        const statusValue = String(value).trim();
        
        // If status is valid, use it, otherwise use default
        if (STATUS_OPTIONS.includes(statusValue)) {
          return statusValue;
        }
        return "Pending Allocation";
      },
      
      // Format remark (default jika kosong)
      remark: (value) => {
        if (!value) return "";
        return String(value).trim();
      }
    }
  });
}

/**
 * Fungsi parsing file Excel/CSV format Z-Logix.
 * Header di baris ke-5 (Excel row 5 = index 4)
 * Data mulai baris ke-6 (Excel row 6 = index 5)
 */
function parseZLogixExcel(file) {
  console.log("Starting Z-Logix format parsing dengan header di baris 5, data mulai baris 6");
  
  parseExcelFile(file, {
    headerRow: 5, // Header di baris ke-5 Excel (index 4 JavaScript)
    dataStartRow: 6, // Data mulai di baris ke-6 Excel (index 5 JavaScript)
    startColumn: 0, // Kolom mulai dari kolom pertama (A = index 0)
    mapping: {
      // PENTING: Format Z-Logix berbeda, gunakan nama kolom persis seperti di file
      "jobNo": "Job No", // Balik urutan mapping agar konsisten dengan format Phoenix
      "deliveryDate": "Delivery Date",
      "deliveryNote": "Delivery Note",
      "qty": "Plan Qty",
      "remark": "Remark",
      "status": "Status",
      "owner": "BU"  // This maps the "BU" column to the "owner" field
    },
    formatters: {
      // Format job number
      jobNo: (value) => {
        console.log("Processing jobNo:", value);
        if (!value) return "";
        return String(value).trim();
      },
      
      // Owner field formatter
      owner: (value) => {
        console.log("Processing owner value:", value);
        if (!value) return "";
        return String(value).trim();
      },
      
      // Format deliveryDate to DD-MMM-YYYY - PERBAIKAN: memastikan tanpa waktu
      deliveryDate: (value) => {
        if (!value) return "";
        
        // Jika sudah string format tanggal, hapus komponen waktu
        if (typeof value === 'string') {
          // Jika ada spasi (pemisah antara tanggal dan waktu), ambil bagian tanggal saja
          if (value.includes(' ')) {
            value = value.split(' ')[0];
          }
          
          // Jika sudah dalam format "DD-MMM-YYYY", kembalikan apa adanya
          if (value.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
            return value;
          }
        }
        
        try {
          let date;
          if (value instanceof Date) {
            date = value;
          } else if (typeof value === 'number') {
            // Handle Excel date serial number
            date = new Date(Math.round((value - 25569) * 86400 * 1000));
          } else {
            // Mencoba parse format lainnya
            date = new Date(value);
          }
          
          if (isNaN(date.getTime())) {
            return value; // Return original if can't parse
          }
          
          // Format tanggal ke DD-MMM-YYYY tanpa waktu
          const day = date.getDate().toString().padStart(2, '0');
          const month = date.toLocaleString('en-US', { month: 'short' });
          const year = date.getFullYear();
          
          const formattedDate = `${day}-${month}-${year}`;
          return formattedDate;
        } catch (err) {
          return value; // Return original if error
        }
      },
      
      // Format quantity
      qty: (value) => {
        if (value === null || value === undefined || value === "") return "";
        const num = Number(value);
        return isNaN(num) ? String(value).trim() : num;
      },
      
      // Format status
      status: (value) => {
        if (!value) return "Pending Pick";
        const statusValue = String(value).trim();
        
        if (STATUS_OPTIONS.includes(statusValue)) {
          return statusValue;
        }
        if (statusValue.toLowerCase() === "loaded") {
          return "Packed";
        }
        return "Pending Pick";
      },
      
      // Format remark
      remark: (value) => {
        if (!value) return "";
        return String(value).trim();
      }
    },
    debug: true,
    exactMatchForShortHeaders: true
  });
}

/**
 * Fungsi generik untuk parsing Excel/CSV dengan konfigurasi yang fleksibel
 * @param {File} file - File yang akan di-parse (dapat berupa .csv, .xls, atau .xlsx)
 * @param {Object} config - Konfigurasi parsing
 * @param {number} config.headerRow - Nomor baris untuk header (1-based)
 * @param {number} config.dataStartRow - Nomor baris awal data (1-based)
 * @param {number} config.startColumn - Kolom awal untuk data (0-based), default 0
 * @param {Object} config.mapping - Pemetaan field dari nama header ke properti objek
 * @param {Object} config.formatters - Fungsi formatter untuk memformat nilai field tertentu
 */

function parseExcelFile(file, config) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      // Tentukan tipe file berdasarkan ekstensi
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let data;
      let workbook;
      let jsonData;
      
      // Proses file berdasarkan tipe
      if (fileExtension === 'csv') {
        try {
          // Parse CSV
          const csvText = e.target.result;
          workbook = XLSX.read(csvText, { type: 'binary', raw: true });
        } catch (csvError) {
          console.error("Error parsing CSV with binary method, trying string method:", csvError);
          try {
            // Alternative CSV parsing approach
            const csvText = e.target.result;
            workbook = XLSX.read(csvText, { type: 'string' });
          } catch (csvError2) {
            console.error("Both CSV parsing methods failed:", csvError2);
            throw new Error("Format CSV tidak dapat dibaca. Coba simpan ulang file atau konversi ke Excel.");
          }
        }
      } else {
        // Parse Excel (XLS/XLSX)
        data = new Uint8Array(e.target.result);
        workbook = XLSX.read(data, { type: 'array' });
      }
      
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

      console.log("Total rows in file:", jsonData.length);
      console.log("Struktur data file Excel:", jsonData);
      
      // Validate data structure based on format type
      if (jsonData.length < config.headerRow) {
        // Custom message based on format (Phoenix or Z-Logix)
        const formatType = config.headerRow === 3 ? "Phoenix" : "Z-Logix";
        throw new Error(`Format file tidak valid atau tidak ada data. File hanya memiliki ${jsonData.length} baris, header ${formatType} seharusnya di baris ke-${config.headerRow}`);
      }

      // Get header row
      const headerIndex = config.headerRow - 1;
      const headers = jsonData[headerIndex];
      
      // Define starting column if not specified
      const startColumn = config.startColumn || 0;

      // Enhanced debugging
      if (config.debug) {
        console.log("Complete headers found:", headers);
        
        // Log each header with its column index for debugging
        for (let i = 0; i < headers.length; i++) {
          console.log(`Header at column ${i}: "${headers[i]}"`);
        }
      }
      
      console.log(`Headers found at row ${config.headerRow} (index ${headerIndex}):`, headers);
      console.log(`Data starts at row ${config.dataStartRow} (index ${config.dataStartRow - 1}), column ${startColumn+1} (index ${startColumn})`);
      console.log("Header mapping yang dicari:", config.mapping);
      
      // Debug - Log beberapa baris pertama untuk verifikasi
      console.log("Data pada file Excel:");
      for (let i = 0; i < Math.min(6, jsonData.length); i++) {
        console.log(`Baris ${i+1} (index ${i}):`, jsonData[i]);
      }
      
      // Check if key headers are present (modified to work with reversed mapping)
      let missingHeaders = [];
      const headerMap = {};
      
      // First, create a map of headers to their indices
      for (let j = startColumn; j < headers.length; j++) {
        if (headers[j] === undefined || headers[j] === null) continue;
        
        const headerText = String(headers[j]).trim();
        headerMap[headerText.toLowerCase()] = j;
        
        // Special case for exact matching of short headers (like "BU")
        if (config.exactMatchForShortHeaders && headerText.length <= 2) {
          headerMap[`exact_${headerText}`] = j;
        }
      }
      
      // Then check each source field in mapping
      for (const [targetField, sourceField] of Object.entries(config.mapping)) {
        let found = false;
        const sourceFieldLower = String(sourceField).toLowerCase().trim();
        
        // Special handling for short headers (like "BU") - try exact match first
        if (config.exactMatchForShortHeaders && sourceField.length <= 2) {
          for (let j = 0; j < headers.length; j++) {
            if (headers[j] === sourceField) {
              found = true;
              if (config.debug) {
                console.log(`✓ Direct match for '${sourceField}' found at column ${j}`);
              }
              break;
            }
          }
        }
        
        if (!found) {
          // Try different variations of the header text for matching
          const variations = [
            sourceFieldLower,
            sourceFieldLower.replace(/[.\s]/g, ''),
            sourceFieldLower.replace(/\s+/g, ''),
            sourceFieldLower.split(/\s+/)[0],
            // Add special case for 'BU'
            sourceField === 'BU' ? 'bu' : null
          ].filter(Boolean); // Remove null values
        
          // Check if any of the header variations match
          for (const headerKey of Object.keys(headerMap)) {
            if (variations.includes(headerKey) || 
                headerKey.includes(sourceFieldLower) || 
                sourceFieldLower.includes(headerKey) ||
                // Special exact match for "BU" column
                (sourceField === 'BU' && headerKey === 'bu')) {
              found = true;
              if (config.debug) {
                console.log(`✓ Found '${sourceField}' via variation match in header '${headerKey}'`);
              }
              break;
            }
          }
        }
        
        if (!found) {
          missingHeaders.push(sourceField);
        }
      }
      
      if (missingHeaders.length > 0) {
        console.warn(`Missing headers: ${missingHeaders.join(', ')}`);
        console.log(`Available headers: ${headers.map(h => String(h || '')).join(', ')}`);
      }
      
      // Transform data to our format
      const jobs = [];
      for (let i = config.dataStartRow - 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        // Skip empty rows - check if any cell in the row has content
        if (!row || row.length === 0 || row.every(cell => cell === "" || cell === null || cell === undefined)) {
          console.log(`Skipping empty row at index ${i}`);
          continue;
        }
        
        const job = {};
        console.log(`Parsing row ${i+1}:`, row);
        
        // Map fields according to config
        for (const [targetField, sourceField] of Object.entries(config.mapping)) {
          // Find column index with flexible header match
          let headerIndex = -1; // IMPORTANT: Changed from const to let
          
          // Log search info
          console.log("Looking for header:", sourceField);
          
          // Special direct search for "BU" column and short headers
          if (sourceField === "BU") {
            // Look for exact match of "BU" in headers
            for (let j = 0; j < headers.length; j++) {
              if (headers[j] === "BU") {
                headerIndex = j;
                console.log(`✅ Direct match for 'BU' found at column ${j}`);
                break;
              }
            }
          } 
          
          // If not found yet, use regular header matching logic
          if (headerIndex === -1) {
            const isZLogixFormat = config.headerRow === 5;
            const headerToSearch = isZLogixFormat ? targetField : sourceField;
            const headerToMatch = isZLogixFormat ? sourceField : targetField;

            for (let j = startColumn; j < headers.length; j++) {
              const headerText = String(headers[j] || '').trim();
              const searchText = String(headerToSearch).trim();
              
              // 1. Coba pencocokan langsung (case-insensitive)
              if (headerText.toLowerCase() === searchText.toLowerCase()) {
                headerIndex = j;
                console.log(`✅ EXACT match for '${headerToSearch}' found at column ${j}: '${headers[j]}'`);
                break;
              }
              
              // 2. Coba pencocokan dengan menghapus tanda baca
              if (headerText.toLowerCase().replace(/[.\s]/g, '') === searchText.toLowerCase().replace(/[.\s]/g, '')) {
                headerIndex = j;
                console.log(`✅ Normalized match for '${headerToSearch}' found at column ${j}: '${headers[j]}'`);
                break;
              }
              
              // 3. Pencocokan khusus untuk kasus "Job No" yang mungkin terdeteksi sebagai "No"
              if ((searchText === "Job No" || searchText === "jobNo") && headerText === "Job No") {
                headerIndex = j;
                console.log(`✅ Special match for 'Job No' found at column ${j}`);
                break;
              }
              
              // 4. Pencocokan parsial sebagai upaya terakhir, tapi hanya untuk string yang cukup panjang
              if ((headerText.toLowerCase().includes(searchText.toLowerCase()) || 
                  searchText.toLowerCase().includes(headerText.toLowerCase())) &&
                  headerText.length > 2) {
                headerIndex = j;
                console.log(`✅ Partial match for '${headerToSearch}' found at column ${j}: '${headers[j]}'`);
                break;
              }
            }
          }
          
          if (headerIndex !== -1 && headerIndex < row.length) {
            // Get the raw value
            let value = row[headerIndex];
            console.log(`  Found ${targetField} at column ${headerIndex}: ${value}`);
            
            // Fix untuk Z-Logix
            const isZLogixFormat = config.headerRow === 5;
            
            // Koreksi khusus untuk kolom Job No di format Z-Logix
            if (isZLogixFormat && targetField === 'jobNo') {
              // Cari kolom yang sesuai dengan "Job No"
              for (let k = 0; k < headers.length; k++) {
                if (headers[k] === 'Job No') {
                  if (k < row.length && row[k]) { // Pastikan nilai valid
                    value = row[k];
                    console.log(`  Using Job No from column ${k}: ${value}`);
                  }
                  break;
                }
              }
            }
            
            // Process data through formatters if provided
            if (config.formatters && config.formatters[targetField]) {
              const oldValue = value;
              value = config.formatters[targetField](value);
              console.log(`  Formatted ${targetField}: ${oldValue} -> ${value}`);
            }
            
            // Extra date formatting check for date fields
            if (targetField === 'deliveryDate' && value) {
              const oldValue = value;
              value = formatDate(value);
              console.log(`  Additional date formatting: ${oldValue} -> ${value}`);
            }
            
            job[targetField] = value;
          } else {
            console.warn(`  Column not found for ${targetField} (${sourceField})`);
          }
        }
        
        // Add only if job number exists
        if (job.jobNo) {
          console.log(`Found valid job: ${job.jobNo}`);
          console.log(`  Complete job data:`, {
            jobNo: job.jobNo,
            deliveryDate: job.deliveryDate,
            deliveryNote: job.deliveryNote,
            qty: job.qty,
            remark: job.remark,
            status: job.status,
            owner: job.owner
          });
          
          // Format delivery date if no formatter was specified
          if (job.deliveryDate && !config.formatters?.deliveryDate) {
            const oldValue = job.deliveryDate;
            job.deliveryDate = formatDate(job.deliveryDate);
            console.log(`  Formatted date: ${oldValue} -> ${job.deliveryDate}`);
          }
          
          // Ensure status is valid
          if (!job.status || !STATUS_OPTIONS.includes(job.status)) {
            // Handle 'Loaded' status specially for Z-Logix
            if (job.status && job.status.toLowerCase() === 'loaded') {
              job.status = "Packed"; // Map to valid status
            } else {
              job.status = "Pending Pick"; // Default status for Z-Logix
            }
            console.log(`  Set status to: ${job.status}`);
          }
          
          // Ensure all fields that may be undefined are handled
          if (!job.jobType) job.jobType = "By Manual";
          if (!job.deliveryDate) job.deliveryDate = "";
          if (!job.qty) job.qty = "";
          if (!job.remark) job.remark = "";
          if (!job.deliveryNote) job.deliveryNote = "";
          
          jobs.push(job);
        } else {
          console.log(`  Skipping row ${i+1}: No valid Job No`);
        }
      }
      
      console.log(`Parsing completed. Found ${jobs.length} valid jobs from file`);
      
      if (jobs.length === 0) {
        // No valid jobs found
        const formatType = currentUploadMode === "phoenix" ? "Phoenix" : "Z-Logix";
        let errorMsg = `Tidak ada data job yang valid dalam file. Pastikan header berada di baris ke-${config.headerRow} dan format data sesuai dengan ${formatType}.`;
        
        if (missingHeaders.length > 0) {
          errorMsg += `\n\nHeader kolom yang dibutuhkan tidak ditemukan: ${missingHeaders.join(', ')}`;
          errorMsg += `\n\nHeader yang tersedia: ${headers.join(', ')}`;
        }
        
        showModalNotification(errorMsg, true);
        uploadLoadingIndicator.style.display = "none";
        submitUploadBtn.disabled = false;
      } else {
        // Save to Firebase
        console.log("Menyimpan data ke Firebase:", jobs);
        syncUploadedJobsToFirebase(jobs);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      showModalNotification(`Gagal memproses file: ${error.message}`, true);
      uploadLoadingIndicator.style.display = "none";
      submitUploadBtn.disabled = false;
    }
  };
  
  reader.onerror = function() {
    showModalNotification("Gagal membaca file", true);
    uploadLoadingIndicator.style.display = "none";
    submitUploadBtn.disabled = false;
  };
  
  // Read file as binary or array buffer depending on type
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (fileExtension === 'csv') {
    // For CSV, we'll try binary string first
    console.log("Reading CSV file as binary string");
    reader.readAsBinaryString(file);
  } else {
    // For Excel files, use ArrayBuffer
    console.log("Reading Excel file as array buffer");
    reader.readAsArrayBuffer(file);
  }
}

/**
 * Function to sync data to Firebase with proper error handling and success message
 * Digunakan oleh fungsi upload modal baru (format Phoenix dan Z-Logix).
 * 
 * PENTING: Implementasi ini berbeda dengan syncJobsToFirebase.
 * - Fungsi ini menggunakan job.jobNo (huruf kecil)
 * - Menggunakan update batch untuk semua job sekaligus
 */
async function syncUploadedJobsToFirebase(jobs) {
  // Verifikasi format tanggal sebelum disimpan ke Firebase
  jobs.forEach(job => {
    // Pastikan format tanggal konsisten DD-MMM-YYYY tanpa waktu
    if (job.deliveryDate) {
      // Cek apakah tanggal memiliki komponen waktu
      if (typeof job.deliveryDate === 'string') {
        // Hapus semua komponen waktu jika ada
        if (job.deliveryDate.includes(' ')) {
          const datePart = job.deliveryDate.split(' ')[0];
          console.log(`Stripping time from date: ${job.deliveryDate} -> ${datePart}`);
          job.deliveryDate = datePart;
        }
        
        // Cek dan pastikan format DD-MMM-YYYY
        if (!job.deliveryDate.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
          job.deliveryDate = formatDate(job.deliveryDate);
        }
      } else {
        // Untuk tipe data lainnya (Date object, number)
        job.deliveryDate = formatDate(job.deliveryDate);
      }
      
      console.log(`Final delivery date format: ${job.deliveryDate}`);
    }
  });

  // 1. Ambil semua jobNo dari data baru
  const newJobNos = jobs.map(job => sanitizeValue(job.jobNo)).filter(jn => jn && !/[.#$\[\]]/.test(jn));

  try {
    // 2. Ambil semua job di database
    const snapshot = await get(ref(db, "PhxOutboundJobs"));
    // Existing Firebase sync code
    const dbJobs = snapshot.exists() ? snapshot.val() : {};
    
    // Prepare batch update
    const updates = {};
    
    // Proses semua job yang akan diupdate
    const updatePromises = jobs.map(async job => {
      if (job.jobNo && !/[.#$\[\]]/.test(job.jobNo)) {
        try {
          // Gunakan fungsi preservasi untuk mempertahankan field penting
          const preservedData = await preserveExistingFields(job.jobNo, job);
          updates[job.jobNo] = preservedData;
        } catch (err) {
          console.error(`Error saat preservasi job ${job.jobNo}:`, err);
          updates[job.jobNo] = job; // Fallback to original data
        }
      }
    });

    // Tunggu semua proses preservasi selesai
    await Promise.all(updatePromises);
    
    // Execute batch update
    await update(ref(db, "PhxOutboundJobs"), updates);
    
    // Tampilkan notifikasi sukses hanya di dalam modal, sesuai permintaan
    const successMsg = `Berhasil menyinkronkan ${jobs.length} job dari file ke database`;
    showModalNotification(successMsg, false, 0); // Durasi 0 = tetap tampil sampai modal ditutup
    
    // Jangan tutup modal secara otomatis, biarkan user yang menutup
    uploadLoadingIndicator.style.display = "none";
    submitUploadBtn.disabled = false;
    loadJobsFromFirebase(); // Refresh the table
  } catch (error) {
    console.error("Error syncing to Firebase:", error);
    showModalNotification("Gagal menyimpan data ke database: " + error.message, true);
    uploadLoadingIndicator.style.display = "none";
    submitUploadBtn.disabled = false;
  }
}

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

// Listener tombol bulk unassign
bulkUnassignBtn?.addEventListener("click", async () => {
  const selectedJobs = getSelectedJobs();
  if (!selectedJobs.length) {
    showNotification("Pilih job yang ingin di-unassign.", true);
    return;
  }
  showConfirmModal({
    title: "Konfirmasi Unassign",
    message: `Apakah Anda yakin ingin <b>UNASSIGN</b> ${selectedJobs.length} job terpilih?`,
    okText: "Unassign",
    okClass: "logout",
    onConfirm: async () => {
      try {
        // Ambil data job dari Firebase untuk setiap jobNo
        const jobSnaps = await Promise.all(selectedJobs.map(jobNo => get(ref(db, `PhxOutboundJobs/${jobNo}`))));
        const updates = {};
        jobSnaps.forEach((snap, idx) => {
          if (snap.exists()) {
            const job = snap.val();
            const jobNo = selectedJobs[idx];
            // Hapus field hasil assign
            updates[`PhxOutboundJobs/${jobNo}/team`] = null;
            updates[`PhxOutboundJobs/${jobNo}/jobType`] = null;
            updates[`PhxOutboundJobs/${jobNo}/shift`] = null;
            updates[`PhxOutboundJobs/${jobNo}/teamName`] = null;
            // Jangan ubah status jika status bukan "Pending Allocation"
            if (job.status === "Pending Allocation") {
              updates[`PhxOutboundJobs/${jobNo}/status`] = "Pending Allocation";
            }
            // Jika field lain ingin direset ke default, tambahkan di sini
          }
        });
        await update(ref(db), updates);
        showNotification(`${selectedJobs.length} job berhasil di-unassign.`, false);
        refreshDataWithoutReset();
      } catch (err) {
        showNotification("Gagal unassign job: " + err.message, true);
      }
    }
  });
});

// Listener tombol assign di modal
// Listener tombol assign di modal (VERSI DENGAN BUSINESS DATE & TIMESTAMP)
confirmAdd.addEventListener("click", async () => {
  const team = document.getElementById("teamSelect").value;
  const jobType = document.getElementById("jobTypeSelect").value;
  const shiftType = (localStorage.getItem("shiftType") === "Night") ? "Night Shift" : "Day Shift";
  const jobsToUpdate =
    (window.jobsToBulkAssign && Array.isArray(window.jobsToBulkAssign) && window.jobsToBulkAssign.length > 0)
      ? window.jobsToBulkAssign
      : (selectedSingleJob ? [selectedSingleJob] : getSelectedJobs());

  const loadingIndicator = document.getElementById("loadingIndicator");

  if (jobsToUpdate.length === 0) {
    showNotification("Tidak ada job yang dipilih.", true);
    return;
  }

  loadingIndicator.style.display = "block";
  confirmAdd.disabled = true;

  try {
    const teamName = await getTeamNameForCurrentUser();

    // Waktu dasar
    const nowUTC = new Date();
    const shiftKey = shiftType === "Night Shift" ? "NightShift" : "DayShift";
    const businessDate = getBusinessDateForShift(shiftKey, nowUTC);   // YYYY-MM-DD (WIB logic)
    const assignedAtUTC = nowUTC.toISOString();
    const assignedAtWIB = formatDateTimeWIB(toWIB(nowUTC));

    await Promise.all(
      jobsToUpdate.map(jobNo =>
        update(ref(db, "PhxOutboundJobs/" + jobNo), {
          team,
          jobType,
          shift: shiftType,
          teamName,
          businessDate,   // NEW
          assignedAtUTC,  // NEW
          assignedAtWIB   // NEW
        })
      )
    );

    showNotification(`Job berhasil ditambahkan ke team: ${team}`);
    selectedSingleJob = null;
    window.jobsToBulkAssign = null;
    hideModal();
    refreshDataWithoutReset();
  } catch (error) {
    console.error(error);
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
document.getElementById("cargoOutBtn")?.addEventListener("click", clearCompletedJobsWithoutShift);

async function saveOutJobAchievement() {
  const jobsSnap = await get(ref(db, "PhxOutboundJobs"));
  const jobs = jobsSnap.exists() ? Object.values(jobsSnap.val()) : [];

  if (!jobs.length) {
    showNotification("Tidak ada job untuk disimpan.", true);
    return;
  }

  // Kelompok: { [businessDate]: { NightShift: {teamName: {...}}, DayShift:{...} } }
  const grouped = {};

  for (const job of jobs) {
    if (!job.teamName || !job.jobNo || !job.shift) continue;

    const shiftKey = job.shift === "Night Shift" ? "NightShift" : "DayShift";
    // Jika job punya businessDate simpan pakai itu, jika tidak hitung dari assignedAtUTC atau sekarang.
    let businessDate = job.businessDate;
    if (!businessDate) {
      const baseDate = job.assignedAtUTC ? new Date(job.assignedAtUTC) : new Date();
      businessDate = getBusinessDateForShift(shiftKey, baseDate);
    }

    if (!grouped[businessDate]) {
      grouped[businessDate] = { NightShift: {}, DayShift: {} };
    }

    if (!grouped[businessDate][shiftKey][job.teamName]) {
      grouped[businessDate][shiftKey][job.teamName] = {};
    }

    grouped[businessDate][shiftKey][job.teamName][job.jobNo] = {
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
      finishAt: sanitizeValue(job.finishAt || ""),
      businessDate,                       // simpan juga di node achievement
      assignedAtUTC: sanitizeValue(job.assignedAtUTC || ""),
      assignedAtWIB: sanitizeValue(job.assignedAtWIB || "")
    };
  }

  // Simpan ke Firebase per businessDate
  const writes = [];
  Object.entries(grouped).forEach(([bDate, shiftsObj]) => {
    const { yearKey, monthKey, day } = breakdownBusinessDate(bDate);
    if (Object.keys(shiftsObj.NightShift).length > 0) {
      writes.push(
        set(ref(db, `outJobAchievment/${yearKey}/${monthKey}/${day}/NightShift`), shiftsObj.NightShift)
      );
    }
    if (Object.keys(shiftsObj.DayShift).length > 0) {
      writes.push(
        set(ref(db, `outJobAchievment/${yearKey}/${monthKey}/${day}/DayShift`), shiftsObj.DayShift)
      );
    }
  });

  await Promise.all(writes);
  showNotification("Data achievement (per business date) berhasil disimpan.");
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
        "Owner": job.owner || "",
        "Delivery Date": deliveryDate,
        "Delivery Note": job.deliveryNote || "",
        "Remark": job.remark || "",
        "Status": job.status || "",
        "Qty": qtyValue, // Pastikan sebagai number
        "Team": job.team || "",
        "Job Type": job.jobType || "",
        "Shift": job.shift || "",
        "Team Name": job.teamName || "",
        "Finish At": job.finishAt || "" // <-- TAMBAHKAN finishAt DI SINI
      };
    });

    // Buat workbook Excel baru
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobsArray);

    // Set tipe data kolom
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'] = [
      {wch: 15}, // Job No
      {wch: 15}, // Owner
      {wch: 15, dt: 'd'}, // Delivery Date - set sebagai date
      {wch: 25}, // Delivery Note
      {wch: 30}, // Remark
      {wch: 15}, // Status
      {wch: 10, dt: 'n'}, // Qty - set sebagai numeric
      {wch: 10}, // Team
      {wch: 12}, // Job Type
      {wch: 12}, // Shift
      {wch: 15}, // Team Name
      {wch: 24}  // Finish At
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

// Tambahkan ini di bagian event listener shift toggle
shiftDayRadio.addEventListener("change", function() {
  if (this.checked) {
    localStorage.setItem("shiftType", "Day");
    updatePlanTargetFromManPower(); // Update target saat shift berubah
  }
});

shiftNightRadio.addEventListener("change", function() {
  if (this.checked) {
    localStorage.setItem("shiftType", "Night");
    updatePlanTargetFromManPower(); // Update target saat shift berubah
  }
});

// Tampilkan shift dari localStorage di bagian user profile
const shiftValue = localStorage.getItem("shift");
const userShiftSpan = document.getElementById("userShift");

if (shiftValue && userShiftSpan) {
  userShiftSpan.textContent = shiftValue;
  updateUserShiftColor();
}

// (Opsional) Ganti huruf avatar jadi huruf awal shift
const userInitialSpan = document.getElementById("userInitial");
if (shiftValue && userInitialSpan) {
  userInitialSpan.textContent = shiftValue.charAt(0).toUpperCase();
}

// Observe userShift changes (if changed dynamically)
document.addEventListener('DOMContentLoaded', function() {
  updateUserShiftColor();
  const userShiftSpan = document.getElementById('userShift');
  if (userShiftSpan) {
    const observer = new MutationObserver(updateUserShiftColor);
    observer.observe(userShiftSpan, { childList: true, subtree: true });
  }
});

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

document.addEventListener("DOMContentLoaded", () => {
  // Show loading spinner overlay before anything else
  const loadingScreen = document.createElement('div');
  loadingScreen.className = 'fullscreen-loading';
  loadingScreen.innerHTML = `
    <div class="loading-content">
      <div class="loading-logo">
        <img src="img/reverse-logistic.png" alt="PlasticDept Logo">
      </div>
      <h2>Plastic Job Assignment</h2>
      <div class="loading-spinner-large"></div>
      <p>Memuat data halaman plastic...</p>
    </div>
  `;
  document.body.appendChild(loadingScreen);

  // Lanjutkan inisialisasi
  populateUserProfileData();
  populateMpPicSelector();
  renderMpPicListTable();
  attachTableEventListeners();

  // Remove spinner setelah data table sudah dirender (gunakan MutationObserver untuk tbody)
  const tbody = document.querySelector('#jobTable tbody');
  if (tbody) {
    const observer = new MutationObserver(() => {
      // Tunggu minimal 1 data atau table sudah diisi
      if (tbody.children.length > 0 || tbody.innerHTML.trim() !== '') {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 500);
        observer.disconnect();
      }
    });
    observer.observe(tbody, { childList: true, subtree: false });
    // Fallback: jika data kosong, tetap hilangkan spinner setelah 2 detik
    setTimeout(() => {
      if (document.body.contains(loadingScreen)) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 500);
        observer.disconnect();
      }
    }, 2000);
  } else {
    // Fallback jika tbody tidak ditemukan
    setTimeout(() => {
      if (document.body.contains(loadingScreen)) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 500);
      }
    }, 1500);
  }
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
    
    // Ambil data user lengkap untuk mendapatkan photoURL
    const userSnapshot = await get(ref(db, `users/${userID}`));
    let photoURL = "";
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      // Ambil photoURL dari data user jika ada
      photoURL = userData.photoURL || "";
    }
    
    const waktu_set = new Date().toISOString();
    await set(ref(db, `MPPIC/${userID}`), {
      name,
      userID,
      waktu_set,
      team,
      photoURL // Tambahkan photoURL ke data yang akan disimpan
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

// Fungsi untuk mengaktifkan mode edit
function enterEditMode(jobNo) {
  const job = allJobsData.find(job => job.jobNo === jobNo);
  if (!job) return;

  const rows = document.querySelectorAll('tbody tr');
  let targetRow;
  for (const row of rows) {
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.getAttribute('data-jobno') === jobNo) {
      targetRow = row;
      break;
    }
  }
  if (!targetRow) return;

  const remarkCell = targetRow.children[6]; // Updated index: was 5, now 6 because of the Owner column
  const qtyCell = targetRow.children[8];    // Updated index: was 7, now 8 because of the Owner column

  const originalRemark = job.remark || '';
  const originalQty = job.qty || '';

  remarkCell.classList.add('edit-mode');
  remarkCell.innerHTML = `
    <input type="text" class="edit-input remark-input" value="${originalRemark}">
    <div class="edit-actions">
      <button class="save-btn save-remark" data-jobno="${jobNo}">Simpan</button>
      <button class="cancel-btn cancel-remark" data-jobno="${jobNo}">Batal</button>
    </div>
  `;

  qtyCell.classList.add('edit-mode');
  qtyCell.innerHTML = `
    <input type="text" class="edit-input qty-input" value="${originalQty}">
    <div class="edit-actions">
      <button class="save-btn save-qty" data-jobno="${jobNo}">Simpan</button>
      <button class="cancel-btn cancel-qty" data-jobno="${jobNo}">Batal</button>
    </div>
  `;

  remarkCell.querySelector('.remark-input').focus();

  remarkCell.querySelector('.save-remark').addEventListener('click', () => saveRemarkChanges(jobNo, targetRow));
  remarkCell.querySelector('.cancel-remark').addEventListener('click', () => cancelRemarkEdit(jobNo, targetRow, originalRemark));

  qtyCell.querySelector('.save-qty').addEventListener('click', () => saveQtyChanges(jobNo, targetRow));
  qtyCell.querySelector('.cancel-qty').addEventListener('click', () => cancelQtyEdit(jobNo, targetRow, originalQty));
}

// Fungsi untuk menyimpan perubahan remark saja
function saveRemarkChanges(jobNo, row) {
  const remarkInput = row.querySelector('.remark-input');
  if (!remarkInput) return;

  const newRemark = remarkInput.value;
  const updates = { remark: newRemark };

  update(ref(db, "PhxOutboundJobs/" + jobNo), updates)
    .then(() => {
      showNotification("✅ Data remark berhasil diperbarui");
      const jobIndex = allJobsData.findIndex(job => job.jobNo === jobNo);
      if (jobIndex !== -1) allJobsData[jobIndex].remark = newRemark;

      const remarkCell = row.children[6]; // Updated: was 5, now 6
      remarkCell.classList.remove('edit-mode');
      remarkCell.textContent = newRemark;
    })
    .catch(error => {
      console.error("Error updating remark:", error);
      showNotification("❌ Gagal memperbarui data remark", true);
    });
}

function cancelRemarkEdit(jobNo, row, originalRemark) {
  const remarkCell = row.children[6]; // Updated: was 5, now 6
  remarkCell.classList.remove('edit-mode');
  remarkCell.textContent = originalRemark;
}

function saveQtyChanges(jobNo, row) {
  const qtyInput = row.querySelector('.qty-input');
  if (!qtyInput) return;

  const newQty = qtyInput.value;
  const updates = { qty: newQty };

  update(ref(db, "PhxOutboundJobs/" + jobNo), updates)
    .then(() => {
      showNotification("✅ Data qty berhasil diperbarui");
      const jobIndex = allJobsData.findIndex(job => job.jobNo === jobNo);
      if (jobIndex !== -1) allJobsData[jobIndex].qty = newQty;

      const qtyCell = row.children[8]; // Updated: was 7, now 8
      qtyCell.classList.remove('edit-mode');
      qtyCell.textContent = formatNumericValue(newQty);
    })
    .catch(error => {
      console.error("Error updating qty:", error);
      showNotification("❌ Gagal memperbarui data qty", true);
    });
}

function cancelQtyEdit(jobNo, row, originalQty) {
  const qtyCell = row.children[8]; // Updated: was 7, now 8
  qtyCell.classList.remove('edit-mode');
  qtyCell.textContent = formatNumericValue(originalQty);
}

// Tambahkan ini di dalam authPromise.then() atau DOMContentLoaded
authPromise.then(() => {
  console.log('Auth promise resolved');
  populateStatusOptions();
  populateUserProfileData();
  
  // Update target berdasarkan ManPower saat halaman dimuat
  updatePlanTargetFromManPower();
  
  // Load data first, then setup table
  loadJobsFromFirebase();
});