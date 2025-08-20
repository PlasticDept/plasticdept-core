import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  nowInWIB,
  getBusinessDateForShift,
  breakdownBusinessDate
} from "./shift-business-date.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM elements
const dateInput = document.getElementById('dateInput');
const shiftSelect = document.getElementById('shiftSelect');
const teamSelect = document.getElementById('teamSelect');
const notifBox = document.getElementById('notifBox');
const matrixJobCount = document.getElementById('matrixJobCount');
const matrixQty = document.getElementById('matrixQty');
const matrixQtyRemaining = document.getElementById('matrixQtyRemaining');
const matrixQtyAdditional = document.getElementById('matrixQtyAdditional');
const matrixQtyH1 = document.getElementById('matrixQtyH1');
const matrixQtyOvertime = document.getElementById('matrixQtyOvertime');

// State variables
let selectedDate = null;
let dataTable = null;
let flatpickrInstance = null;

// ==================== FUNGSI UTILITAS ====================
function showNotif(type, message) {
  notifBox.innerHTML = `<div class="notif-${type}">${message}</div>`;
  setTimeout(() => {
    if (notifBox.innerHTML.includes(message)) {
      notifBox.innerHTML = '';
    }
  }, 3500);
}

function resetSummaryCards() {
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  matrixQtyRemaining.textContent = '-';
  matrixQtyAdditional.textContent = '-';
  matrixQtyH1.textContent = '-';
  matrixQtyOvertime.textContent = '-';
}

function resetSummaryToZero() {
  matrixJobCount.textContent = '0';
  matrixQty.textContent = '0';
  matrixQtyRemaining.textContent = '0';
  matrixQtyAdditional.textContent = '0';
  matrixQtyH1.textContent = '0';
  matrixQtyOvertime.textContent = '0';
}

function clearTable() {
  if (dataTable) {
    dataTable.clear().draw();
  }
}

// ==================== FUNGSI DATABASE PATH ====================
function buildDatabasePath(dateStr, shift = null, team = null) {
  // Parse tanggal dari string YYYY-MM-DD
  if (!dateStr) return null;
  
  let [year, month, day] = dateStr.split('-');
  
  // Jika kasus spesial tanggal 19 Agustus 2025
  if (dateStr === '2025-08-19') {
    let path = 'outJobAchievment/year2025/08_25/19';
    if (shift) path += `/${shift}`;
    if (team) path += `/${team}`;
    console.log(`Menggunakan path khusus: ${path}`);
    return path;
  }
  
  // Format path secara normal untuk tanggal lain
  const yearKey = `year${year}`;
  const monthKey = `${month}_${year.substring(2)}`;
  
  let path = `outJobAchievment/${yearKey}/${monthKey}/${day}`;
  if (shift) path += `/${shift}`;
  if (team) path += `/${team}`;
  
  return path;
}

// ==================== FUNGSI LOAD DATA ====================
async function loadShifts() {
  if (!selectedDate) return false;
  
  try {
    const path = buildDatabasePath(selectedDate);
    console.log(`Loading shifts dari path: ${path}`);
    
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (!snapshot.exists()) {
      console.log(`Tidak ada data untuk tanggal ${selectedDate}`);
      showNotif('error', 'Data tidak ditemukan untuk tanggal ini.');
      return false;
    }
    
    const data = snapshot.val();
    const shifts = Object.keys(data);
    console.log(`Shift yang tersedia: ${shifts.join(', ')}`);
    
    // Populate shift dropdown
    shiftSelect.innerHTML = '<option value="">Pilih shift</option>';
    shifts.forEach(shift => {
      shiftSelect.innerHTML += `<option value="${shift}">${shift.replace(/Shift$/, ' Shift')}</option>`;
    });
    shiftSelect.disabled = false;
    
    showNotif('success', 'Data shift ditemukan.');
    return true;
  } catch (error) {
    console.error('Error loading shifts:', error);
    showNotif('error', `Gagal memuat data shift: ${error.message}`);
    return false;
  }
}

async function loadTeams() {
  if (!selectedDate || !shiftSelect.value) return false;
  
  try {
    const path = buildDatabasePath(selectedDate, shiftSelect.value);
    console.log(`Loading teams dari path: ${path}`);
    
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (!snapshot.exists()) {
      console.log(`Tidak ada team untuk shift ${shiftSelect.value}`);
      showNotif('error', 'Tidak ada team untuk shift ini.');
      return false;
    }
    
    const data = snapshot.val();
    const teams = Object.keys(data);
    console.log(`Teams yang tersedia: ${teams.join(', ')}`);
    
    // Populate team dropdown
    teamSelect.innerHTML = '<option value="">Pilih team</option>';
    teams.forEach(team => {
      teamSelect.innerHTML += `<option value="${team}">${team}</option>`;
    });
    teamSelect.disabled = false;
    
    showNotif('success', 'Data team ditemukan.');
    return true;
  } catch (error) {
    console.error('Error loading teams:', error);
    showNotif('error', `Gagal memuat data team: ${error.message}`);
    return false;
  }
}

async function loadJobData() {
  if (!selectedDate || !shiftSelect.value || !teamSelect.value) {
    console.log('Data belum lengkap untuk memuat job');
    return false;
  }
  
  try {
    const path = buildDatabasePath(selectedDate, shiftSelect.value, teamSelect.value);
    console.log(`Loading job data dari path: ${path}`);
    
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (!snapshot.exists()) {
      console.log('Tidak ada data job yang ditemukan');
      showNotif('error', 'Tidak ada data job yang ditemukan.');
      resetSummaryToZero();
      clearTable();
      return false;
    }
    
    // Proses data job
    const rawData = snapshot.val();
    let jobs = [];
    
    // Cek apakah data adalah object dengan job-job di dalamnya
    if (typeof rawData === 'object' && !Array.isArray(rawData)) {
      // Iterasi tiap job (key adalah job ID)
      Object.keys(rawData).forEach(jobId => {
        const job = rawData[jobId];
        
        // Tambahkan jobId jika tidak ada
        if (!job.jobNo && jobId.includes('-')) {
          job.jobNo = jobId;
        }
        
        jobs.push(job);
      });
    } else if (Array.isArray(rawData)) {
      // Jika data adalah array, gunakan langsung
      jobs = rawData.filter(job => job !== null);
    }
    
    console.log(`Ditemukan ${jobs.length} job`);
    
    if (jobs.length === 0) {
      showNotif('warning', 'Tidak ada job untuk ditampilkan.');
      resetSummaryToZero();
      clearTable();
      return false;
    }
    
    // Update tabel dengan data job
    updateDataTable(jobs);
    showNotif('success', `Berhasil memuat ${jobs.length} job.`);
    return true;
  } catch (error) {
    console.error('Error loading job data:', error);
    showNotif('error', `Gagal memuat data job: ${error.message}`);
    resetSummaryToZero();
    clearTable();
    return false;
  }
}

// ==================== FUNGSI UPDATE UI ====================
function updateDataTable(jobs) {
  // Hitung summary metrics
  let totalQty = 0;
  let qtyRemaining = 0;
  let qtyAdditional = 0;
  let qtyH1 = 0;
  let qtyOvertime = 0;
  
  jobs.forEach(job => {
    const qty = parseInt(job.qty) || 0;
    totalQty += qty;
    
    // Kategorikan berdasarkan job type
    if (job.jobType) {
      const jobTypeLower = job.jobType.toLowerCase();
      if (jobTypeLower.includes('remaining')) qtyRemaining += qty;
      else if (jobTypeLower.includes('add')) qtyAdditional += qty;
      else if (jobTypeLower.includes('h-1')) qtyH1 += qty;
      else if (jobTypeLower.includes('ot')) qtyOvertime += qty;
    }
  });
  
  // Update summary cards
  matrixJobCount.textContent = jobs.length;
  matrixQty.textContent = totalQty.toLocaleString('en-US');
  matrixQtyRemaining.textContent = qtyRemaining.toLocaleString('en-US');
  matrixQtyAdditional.textContent = qtyAdditional.toLocaleString('en-US');
  matrixQtyH1.textContent = qtyH1.toLocaleString('en-US');
  matrixQtyOvertime.textContent = qtyOvertime.toLocaleString('en-US');
  
  // Siapkan data untuk tabel
  const rowData = jobs.map(job => [
    job.jobNo || '-',
    job.deliveryDate || '-',
    job.deliveryNote || '-',
    job.remark || '-',
    job.finishAt || '-',
    job.jobType || '-',
    job.shift || '-',
    job.team || '-',
    job.teamName || '-',
    job.createdBy || '-',
    job.businessDate || '-',
    job.actualTimestampWIB || job.actualTimestamp || '-',
    (job.qty !== undefined && job.qty !== null) ? Number(job.qty).toLocaleString('en-US') : '-'
  ]);
  
  // Update tabel
  if (dataTable) {
    dataTable.clear();
    dataTable.rows.add(rowData);
    dataTable.draw();
  } else {
    // Inisialisasi tabel jika belum ada
    dataTable = $('#achievementTable').DataTable({
      data: rowData,
      pageLength: 40,
      destroy: true,
      columns: [
        { title: "Job No" },
        { title: "Delivery Date" },
        { title: "Delivery Note" },
        { title: "Remark" },
        { title: "Finish At" },
        { title: "Job Type" },
        { title: "Shift" },
        { title: "Team" },
        { title: "Team Name" },
        { title: "Created By" },
        { title: "Business Date" },
        { title: "Actual Time (WIB)" },
        { title: "Qty" }
      ],
      dom: 'Bfrtip',
      language: {
        emptyTable: "Data tidak tersedia."
      }
    });
  }
}

function updateUserProfile() {
  const username = localStorage.getItem("username");
  if (!username) return;

  const userFullNameElement = document.getElementById('userFullName');
  const userAvatarElement = document.getElementById('userAvatar');
  const userShiftElement = document.getElementById('userShift');

  try {
    const userRef = ref(db, `users/${username}`);
    get(userRef).then(snapshot => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userFullNameElement) userFullNameElement.textContent = userData.Name || username;
        if (userAvatarElement) {
          if (userData.AvatarUrl) {
            userAvatarElement.innerHTML = `<img src="${userData.AvatarUrl}" alt="Avatar" style="width:32px;height:32px;border-radius:50%;">`;
          } else {
            userAvatarElement.textContent = (userData.Name || username).charAt(0).toUpperCase();
          }
        }
        if (userShiftElement) userShiftElement.textContent = userData.Shift || "-";
        
        // Update warna shift
        updateUserShiftColor();
      } else {
        if (userFullNameElement) userFullNameElement.textContent = username;
        if (userAvatarElement) userAvatarElement.textContent = username.charAt(0).toUpperCase();
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

function updateUserShiftColor() {
  const userShiftSpan = document.getElementById('userShift');
  if (!userShiftSpan) return;
  
  const value = userShiftSpan.textContent.trim();
  userShiftSpan.style.background = '';
  userShiftSpan.style.color = '';
  userShiftSpan.style.borderRadius = '6px';
  userShiftSpan.style.padding = '2px 8px';
  userShiftSpan.style.fontWeight = 'bold';
  userShiftSpan.style.display = 'inline-block';
  
  if (value === 'Non Shift') {
    userShiftSpan.style.background = '#ffe066';
    userShiftSpan.style.color = '#333';
  } else if (value.toLowerCase().includes('blue')) {
    userShiftSpan.style.background = '#2196f3';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('green')) {
    userShiftSpan.style.background = '#43a047';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('night')) {
    userShiftSpan.style.background = '#222e50';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('day')) {
    userShiftSpan.style.background = '#f7b32b';
    userShiftSpan.style.color = '#222';
  }
}

// ==================== FUNGSI EXPORT DATA ====================
function exportToExcel() {
  // Data untuk export
  const summary = [
    ['Total Job', ':', matrixJobCount.textContent],
    ['Total Qty', ':', matrixQty.textContent],
    ['Qty Remaining', ':', matrixQtyRemaining.textContent],
    ['Qty Additional', ':', matrixQtyAdditional.textContent],
    ['Qty H-1', ':', matrixQtyH1.textContent],
    ['Qty Overtime', ':', matrixQtyOvertime.textContent]
  ];
  
  const title = [['', '', '', 'Outbound Achievement Report (Business Date Basis)']];
  
  const tableHeaders = [
    ['Job No', 'Delivery Date', 'Delivery Note', 'Remark', 'Finish At', 'Job Type', 'Shift', 'Team', 'Team Name', 'Created By', 'Business Date', 'Actual Time (WIB)', 'Qty']
  ];
  
  const tableData = dataTable ? dataTable.rows({search: 'applied'}).data().toArray() : [];
  
  // Buat worksheet
  const wsData = [...summary, [], ...title, [], ...tableHeaders, ...tableData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Merge cell untuk judul
  ws['!merges'] = [{s: {r: 7, c: 3}, e: {r: 7, c: 9}}];
  
  // Buat workbook dan export
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outbound Report");
  XLSX.writeFile(wb, `Outbound_Achievement_Report.xlsx`);
}

// ==================== INISIALISASI & EVENT HANDLERS ====================
function initializeDatePicker() {
  flatpickrInstance = flatpickr("#dateInput", {
    dateFormat: "Y-m-d",
    allowInput: true,
    onChange: async (selectedDates, dateStr) => {
      console.log(`Tanggal dipilih: ${dateStr}`);
      selectedDate = dateStr;
      
      // Reset UI
      shiftSelect.innerHTML = '<option value="">Pilih shift</option>';
      shiftSelect.disabled = true;
      teamSelect.innerHTML = '<option value="">Team</option>';
      teamSelect.disabled = true;
      resetSummaryCards();
      clearTable();
      
      // Load data shift
      await loadShifts();
    }
  });
}

function initializeEventListeners() {
  // Event untuk perubahan shift
  shiftSelect.addEventListener('change', async () => {
    teamSelect.innerHTML = '<option value="">Team</option>';
    teamSelect.disabled = true;
    resetSummaryCards();
    clearTable();
    
    // Special case untuk NightShift
    if (shiftSelect.value === 'NightShift') {
      console.log('NightShift dipilih');
    }
    
    await loadTeams();
  });
  
  // Event untuk perubahan team
  teamSelect.addEventListener('change', async () => {
    resetSummaryCards();
    clearTable();
    await loadJobData();
  });
  
  // Event untuk tombol refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    // Reset UI
    if (flatpickrInstance) flatpickrInstance.clear();
    selectedDate = null;
    dateInput.value = '';
    shiftSelect.innerHTML = '<option value="">Pilih shift</option>';
    shiftSelect.disabled = true;
    teamSelect.innerHTML = '<option value="">Team</option>';
    teamSelect.disabled = true;
    resetSummaryCards();
    clearTable();
    notifBox.innerHTML = '';
  });
  
  // Event untuk tombol export
  document.getElementById('customExportBtn').addEventListener('click', exportToExcel);
}

function autoSetBusinessDateIfNightWindow() {
  // Jika sekarang adalah dini hari (00:00-05:59), set tanggal ke business date NightShift
  const wibNow = nowInWIB();
  const hour = wibNow.getHours();
  
  if (hour < 6) {
    const businessDate = getBusinessDateForShift('NightShift', new Date());
    console.log(`Auto-setting business date ke ${businessDate} (NightShift window)`);
    
    if (flatpickrInstance) {
      flatpickrInstance.setDate(businessDate, true);
    } else {
      dateInput.value = businessDate;
      selectedDate = businessDate;
      loadShifts();
    }
  }
}

// ==================== DEBUGGING TOOLS ====================
// Fungsi untuk membantu debug struktur database
window.inspectDatabasePath = async function(path) {
  console.group(`Inspeksi path: ${path}`);
  try {
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      console.log('✓ Data ditemukan');
      const data = snapshot.val();
      
      console.log('Data:', data);
      if (typeof data === 'object') {
        console.log('Keys:', Object.keys(data));
      }
      
      return data;
    } else {
      console.log('✗ Tidak ada data di path ini');
      return null;
    }
  } catch (error) {
    console.error('Error inspecting path:', error);
    return null;
  } finally {
    console.groupEnd();
  }
};

// Fungsi untuk membantu debug seluruh hierarki data tanggal tertentu
window.inspectDate = async function(dateStr) {
  if (!dateStr) {
    console.error('Tanggal harus diisi (format: YYYY-MM-DD)');
    return;
  }
  
  console.group(`Inspeksi data untuk tanggal: ${dateStr}`);
  
  try {
    // 1. Cek path dasar
    const basePath = buildDatabasePath(dateStr);
    console.log(`Menggunakan path: ${basePath}`);
    
    const baseData = await inspectDatabasePath(basePath);
    if (!baseData) {
      console.log('Tidak ada data untuk tanggal ini.');
      console.groupEnd();
      return;
    }
    
    // 2. Cek shift yang tersedia
    const shifts = Object.keys(baseData);
    console.log(`Shift yang tersedia (${shifts.length}):`, shifts);
    
    // 3. Untuk setiap shift, cek team yang tersedia
    for (const shift of shifts) {
      console.group(`Inspeksi Shift: ${shift}`);
      
      const shiftPath = `${basePath}/${shift}`;
      const shiftData = await inspectDatabasePath(shiftPath);
      
      if (shiftData) {
        const teams = Object.keys(shiftData);
        console.log(`Team yang tersedia (${teams.length}):`, teams);
        
        // 4. Untuk setiap team, cek jumlah job
        for (const team of teams) {
          console.group(`Inspeksi Team: ${team}`);
          
          const teamPath = `${shiftPath}/${team}`;
          const teamData = await inspectDatabasePath(teamPath);
          
          if (teamData) {
            const jobs = Object.keys(teamData);
            console.log(`Job yang tersedia (${jobs.length}):`, jobs);
            
            if (jobs.length > 0) {
              // Cek contoh job pertama
              const firstJobPath = `${teamPath}/${jobs[0]}`;
              console.log(`Contoh data job (${jobs[0]}):`);
              await inspectDatabasePath(firstJobPath);
            }
          }
          
          console.groupEnd(); // Team
        }
      }
      
      console.groupEnd(); // Shift
    }
  } catch (error) {
    console.error('Error during inspection:', error);
  }
  
  console.groupEnd(); // Tanggal
};

// Fungsi khusus untuk cek data 19 Agustus 2025
window.checkAug19 = async function() {
  const path = 'outJobAchievment/year2025/08_25/19';
  return await inspectDatabasePath(path);
};

// ==================== INISIALISASI APLIKASI ====================
// Fungsi utama yang dijalankan saat aplikasi dimulai
async function initApp() {
  try {
    // Inisialisasi Firebase Auth (anonymous)
    const auth = getAuth(app);
    await signInAnonymously(auth);
    
    // Inisialisasi komponen UI
    initializeDatePicker();
    initializeEventListeners();
    
    // Load data profile user
    updateUserProfile();
    
    // Auto-set tanggal jika dalam window NightShift dini hari
    autoSetBusinessDateIfNightWindow();
    
    console.log('Aplikasi Achievement Report berhasil diinisialisasi');
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotif('error', `Gagal menginisialisasi aplikasi: ${error.message}`);
  }
}

// Jalankan inisialisasi aplikasi
initApp();