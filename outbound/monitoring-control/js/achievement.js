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
let availableShifts = [];
let availableTeams = {};

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
    availableShifts = shifts; // Store available shifts
    console.log(`Shift yang tersedia: ${shifts.join(', ')}`);
    
    // Populate shift dropdown with All Shift option
    shiftSelect.innerHTML = '<option value="">Select shift</option>';
    shiftSelect.innerHTML += '<option value="AllShift">All Shift</option>';
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
    // Reset teams map
    availableTeams = {};
    
    if (shiftSelect.value === "AllShift") {
      // Load teams for all shifts
      for (const shift of availableShifts) {
        const path = buildDatabasePath(selectedDate, shift);
        console.log(`Loading teams untuk shift ${shift} dari path: ${path}`);
        
        const dataRef = ref(db, path);
        const snapshot = await get(dataRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const teams = Object.keys(data);
          availableTeams[shift] = teams;
          console.log(`Teams untuk ${shift}: ${teams.join(', ')}`);
        }
      }
      
      // If no teams found
      if (Object.keys(availableTeams).length === 0) {
        showNotif('error', 'Tidak ada team untuk semua shift.');
        return false;
      }
      
      // Populate team dropdown with All Team option
      teamSelect.innerHTML = '<option value="">select team</option>';
      teamSelect.innerHTML += '<option value="AllTeam">All Team</option>';
      
      // Add individual teams from all shifts
      for (const shift in availableTeams) {
        for (const team of availableTeams[shift]) {
          teamSelect.innerHTML += `<option value="${team}-${shift}">${team}</option>`;
        }
      }
      
      teamSelect.disabled = false;
      showNotif('success', 'Data team untuk semua shift ditemukan.');
      return true;
    } else {
      // Regular loading for specific shift
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
      availableTeams[shiftSelect.value] = teams;
      console.log(`Teams yang tersedia: ${teams.join(', ')}`);
      
      // Populate team dropdown with All Team option
      teamSelect.innerHTML = '<option value="">Select team</option>';
      teamSelect.innerHTML += '<option value="AllTeam">All Team</option>';
      teams.forEach(team => {
        teamSelect.innerHTML += `<option value="${team}">${team}</option>`;
      });
      teamSelect.disabled = false;
      
      showNotif('success', 'Data team ditemukan.');
      return true;
    }
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
    let allJobs = [];
    
    // Case 1: All Shift and All Team
    if (shiftSelect.value === "AllShift" && teamSelect.value === "AllTeam") {
      console.log("Loading all jobs for all shifts and all teams");
      showNotif('info', 'Memuat semua data job...');
      
      for (const shift in availableTeams) {
        for (const team of availableTeams[shift]) {
          const path = buildDatabasePath(selectedDate, shift, team);
          console.log(`Loading dari path: ${path}`);
          
          const dataRef = ref(db, path);
          const snapshot = await get(dataRef);
          
          if (snapshot.exists()) {
            const rawData = snapshot.val();
            let jobsData = [];
            
            // Process the data like before
            if (typeof rawData === 'object' && !Array.isArray(rawData)) {
              Object.keys(rawData).forEach(jobId => {
                const job = rawData[jobId];
                
                // Add job metadata
                if (!job.jobNo && jobId.includes('-')) {
                  job.jobNo = jobId;
                }
                if (!job.shift) job.shift = shift;
                if (!job.team) job.team = team;
                
                jobsData.push(job);
              });
            } else if (Array.isArray(rawData)) {
              jobsData = rawData.filter(job => job !== null).map(job => {
                if (!job.shift) job.shift = shift;
                if (!job.team) job.team = team;
                return job;
              });
            }
            
            allJobs = allJobs.concat(jobsData);
          }
        }
      }
    }
    // Case 2: Specific Shift and All Team
    else if (shiftSelect.value !== "AllShift" && teamSelect.value === "AllTeam") {
      console.log(`Loading all jobs for ${shiftSelect.value} and all teams`);
      
      const teams = availableTeams[shiftSelect.value] || [];
      for (const team of teams) {
        const path = buildDatabasePath(selectedDate, shiftSelect.value, team);
        console.log(`Loading dari path: ${path}`);
        
        const dataRef = ref(db, path);
        const snapshot = await get(dataRef);
        
        if (snapshot.exists()) {
          const rawData = snapshot.val();
          let jobsData = [];
          
          if (typeof rawData === 'object' && !Array.isArray(rawData)) {
            Object.keys(rawData).forEach(jobId => {
              const job = rawData[jobId];
              
              if (!job.jobNo && jobId.includes('-')) {
                job.jobNo = jobId;
              }
              if (!job.shift) job.shift = shiftSelect.value;
              if (!job.team) job.team = team;
              
              jobsData.push(job);
            });
          } else if (Array.isArray(rawData)) {
            jobsData = rawData.filter(job => job !== null).map(job => {
              if (!job.shift) job.shift = shiftSelect.value;
              if (!job.team) job.team = team;
              return job;
            });
          }
          
          allJobs = allJobs.concat(jobsData);
        }
      }
    }
    // Case 3: All Shift and Specific Team (format: "team-shift")
    else if (shiftSelect.value === "AllShift" && teamSelect.value.includes('-')) {
      const [team, shift] = teamSelect.value.split('-');
      
      const path = buildDatabasePath(selectedDate, shift, team);
      console.log(`Loading specific team from all shifts: ${path}`);
      
      const dataRef = ref(db, path);
      const snapshot = await get(dataRef);
      
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        let jobsData = [];
        
        if (typeof rawData === 'object' && !Array.isArray(rawData)) {
          Object.keys(rawData).forEach(jobId => {
            const job = rawData[jobId];
            
            if (!job.jobNo && jobId.includes('-')) {
              job.jobNo = jobId;
            }
            if (!job.shift) job.shift = shift;
            if (!job.team) job.team = team;
            
            jobsData.push(job);
          });
        } else if (Array.isArray(rawData)) {
          jobsData = rawData.filter(job => job !== null).map(job => {
            if (!job.shift) job.shift = shift;
            if (!job.team) job.team = team;
            return job;
          });
        }
        
        allJobs = jobsData;
      }
    }
    // Case 4: Normal - Specific Shift and Specific Team
    else {
      const path = buildDatabasePath(selectedDate, shiftSelect.value, teamSelect.value);
      console.log(`Loading job data dari path: ${path}`);
      
      const dataRef = ref(db, path);
      const snapshot = await get(dataRef);
      
      if (snapshot.exists()) {
        // Proses data job
        const rawData = snapshot.val();
        
        if (typeof rawData === 'object' && !Array.isArray(rawData)) {
          Object.keys(rawData).forEach(jobId => {
            const job = rawData[jobId];
            
            if (!job.jobNo && jobId.includes('-')) {
              job.jobNo = jobId;
            }
            if (!job.shift) job.shift = shiftSelect.value;
            if (!job.team) job.team = teamSelect.value;
            
            allJobs.push(job);
          });
        } else if (Array.isArray(rawData)) {
          allJobs = rawData.filter(job => job !== null).map(job => {
            if (!job.shift) job.shift = shiftSelect.value;
            if (!job.team) job.team = teamSelect.value;
            return job;
          });
        }
      }
    }
    
    console.log(`Ditemukan ${allJobs.length} job`);
    
    if (allJobs.length === 0) {
      showNotif('warning', 'Tidak ada job untuk ditampilkan.');
      resetSummaryToZero();
      clearTable();
      return false;
    }
    
    // Update tabel dengan data job
    updateDataTable(allJobs);
    showNotif('success', `Berhasil memuat ${allJobs.length} job.`);
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
  
  // Build report title based on selections
  let reportTitle = 'Outbound Achievement Report (Business Date Basis)';
  if (selectedDate) {
    reportTitle += ` - Date: ${selectedDate}`;
  }
  if (shiftSelect.value) {
    reportTitle += ` - Shift: ${shiftSelect.value === 'AllShift' ? 'All Shifts' : shiftSelect.value}`;
  }
  if (teamSelect.value && teamSelect.value !== 'AllTeam') {
    reportTitle += ` - Team: ${teamSelect.value}`;
  } else if (teamSelect.value === 'AllTeam') {
    reportTitle += ` - Team: All Teams`;
  }
  
  const title = [['', '', '', reportTitle]];
  
  const tableHeaders = [
    ['Job No', 'Delivery Date', 'Delivery Note', 'Remark', 'Finish At', 'Job Type', 'Shift', 'Team', 'Team Name', 'Created By', 'Business Date', 'Actual Time (WIB)', 'Qty']
  ];
  
  const tableData = dataTable ? dataTable.rows({search: 'applied'}).data().toArray() : [];
  
  // Buat worksheet
  const wsData = [...summary, [], ...title, [], ...tableHeaders, ...tableData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Merge cell untuk judul
  ws['!merges'] = [{s: {r: 7, c: 3}, e: {r: 7, c: 9}}];
  
  // Generate filename based on selections
  let filename = 'Outbound_Achievement_Report';
  if (selectedDate) filename += `_${selectedDate}`;
  if (shiftSelect.value && shiftSelect.value !== 'AllShift') filename += `_${shiftSelect.value}`;
  if (teamSelect.value && teamSelect.value !== 'AllTeam') filename += `_${teamSelect.value}`;
  filename += '.xlsx';
  
  // Buat workbook dan export
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outbound Report");
  XLSX.writeFile(wb, filename);
}

// ==================== FUNGSI UNTUK DOWNLOAD DATABASE ====================
/**
 * Fungsi untuk mengunduh data dari database Firebase sesuai dengan struktur node
 * @param {string} year - Tahun (contoh: '2025')
 * @param {string} month - Bulan dalam format "MM_YY" (contoh: '08_25')
 * @param {boolean} includeAllData - Jika true, akan mengunduh semua data termasuk sub-node
 */
async function downloadDatabaseData(year = null, month = null, includeAllData = false) {
  try {
    showNotif('info', 'Memulai proses pengunduhan data...');
    
    // Tentukan path yang akan diunduh
    let path = 'outJobAchievment'; // Perhatikan ejaan yang benar (tanpa 'e' sebelum 'm')
    
    if (year) {
      path += `/year${year}`;
      
      if (month) {
        path += `/${month}`;
      }
    }
    
    console.log(`Mengunduh data dari path: ${path}`);
    
    // Reference ke database
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (!snapshot.exists()) {
      showNotif('error', `Tidak ada data yang ditemukan pada path ${path}`);
      return false;
    }
    
    // Ambil data dari snapshot
    const data = snapshot.val();
    console.log("Data berhasil diambil:", data);
    
    // Function untuk meratakan struktur data bersarang
    function flattenData(obj, prefix = '', result = []) {
      // Jika nilai adalah object non-null dan bukan array
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const keys = Object.keys(obj);
        
        // Jika terlihat seperti job record (memiliki properti jobNo, qty, dll.)
        if (keys.some(k => ['jobNo', 'qty', 'deliveryDate', 'finishAt'].includes(k))) {
          const jobData = {
            path: prefix,
            ...obj
          };
          result.push(jobData);
        } else {
          // Jika ini adalah node perantara, lanjutkan traversal
          for (const key of keys) {
            flattenData(obj[key], prefix ? `${prefix}/${key}` : key, result);
          }
        }
      }
      return result;
    }
    
    // Siapkan data untuk export
    let exportData;
    let worksheets = [];
    
    if (includeAllData) {
      // Jika ingin mengunduh data lengkap, ratakan data
      exportData = flattenData(data);
      console.log(`Ditemukan ${exportData.length} job records`);
      
      // Jika ditemukan job records, buat worksheet utama
      if (exportData.length > 0) {
        // Tentukan semua kolom yang mungkin ada
        const allColumns = new Set();
        exportData.forEach(job => {
          Object.keys(job).forEach(key => allColumns.add(key));
        });
        
        // Susun header berdasarkan kolom yang diinginkan
        const priorityColumns = ['path', 'jobNo', 'deliveryDate', 'deliveryNote', 
          'businessDate', 'qty', 'jobType', 'shift', 'team', 'teamName', 'remark',
          'finishAt', 'createdBy', 'status'];
        
        const allColumnsArray = [...allColumns];
        const orderedColumns = [
          ...priorityColumns.filter(col => allColumnsArray.includes(col)),
          ...allColumnsArray.filter(col => !priorityColumns.includes(col))
        ];
        
        // Buat worksheet dari data job
        const jobWorksheet = XLSX.utils.json_to_sheet(
          exportData.map(job => {
            const row = {};
            orderedColumns.forEach(col => {
              row[col] = job[col] !== undefined ? job[col] : '';
            });
            return row;
          })
        );
        
        worksheets.push({
          name: 'Jobs Data',
          sheet: jobWorksheet
        });
      }
      
      // Tambahkan worksheet untuk struktur database
      const structureData = [];
      
      // Fungsi rekursif untuk membangun struktur database
      function buildStructure(obj, path = '', level = 0) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const keys = Object.keys(obj);
          
          // Jika ini adalah node daun (job record)
          if (keys.some(k => ['jobNo', 'qty', 'deliveryDate'].includes(k))) {
            structureData.push({
              level,
              path,
              type: 'job',
              keys: keys.join(', ')
            });
          } else {
            // Node perantara
            structureData.push({
              level,
              path,
              type: 'node',
              children: keys.length
            });
            
            // Lanjutkan traversal
            for (const key of keys) {
              buildStructure(obj[key], path ? `${path}/${key}` : key, level + 1);
            }
          }
        }
      }
      
      buildStructure(data, path);
      
      // Buat worksheet struktur
      const structureWorksheet = XLSX.utils.json_to_sheet(structureData);
      worksheets.push({
        name: 'Database Structure',
        sheet: structureWorksheet
      });
      
    } else {
      // Jika hanya ingin melihat struktur database
      // Tentukan kedalaman maksimum untuk penelusuran
      const maxDepth = month ? 3 : (year ? 2 : 1);
      
      // Fungsi rekursif untuk menelusuri struktur database
      function exploreStructure(obj, currentPath = '', depth = 0) {
        const result = [];
        
        if (depth >= maxDepth) {
          // Jika sudah mencapai kedalaman maksimum, hanya ambil kunci
          result.push({
            path: currentPath,
            keys: Object.keys(obj).length,
            keyNames: Object.keys(obj).join(', ')
          });
          return result;
        }
        
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const key of Object.keys(obj)) {
            const newPath = currentPath ? `${currentPath}/${key}` : key;
            const childData = obj[key];
            
            if (childData && typeof childData === 'object' && !Array.isArray(childData)) {
              // Jika terlihat seperti job record
              if (Object.keys(childData).some(k => ['jobNo', 'qty', 'deliveryDate'].includes(k))) {
                result.push({
                  path: newPath,
                  type: 'job',
                  props: Object.keys(childData).join(', ')
                });
              } else {
                // Node perantara
                result.push({
                  path: newPath,
                  type: 'node',
                  children: Object.keys(childData).length
                });
                
                // Lanjutkan penelusuran rekursif jika belum mencapai kedalaman maksimum
                if (depth < maxDepth - 1) {
                  result.push(...exploreStructure(childData, newPath, depth + 1));
                }
              }
            }
          }
        }
        
        return result;
      }
      
      exportData = exploreStructure(data);
      
      // Buat worksheet struktur
      const structureWorksheet = XLSX.utils.json_to_sheet(exportData);
      worksheets.push({
        name: 'Database Structure',
        sheet: structureWorksheet
      });
    }
    
    // Generate nama file untuk export
    let filename = 'OutJobAchievment';
    if (year) filename += `_year${year}`;
    if (month) filename += `_${month}`;
    filename += '_' + new Date().toISOString().split('T')[0] + '.xlsx';
    
    // Buat workbook dan tambahkan semua worksheet
    const wb = XLSX.utils.book_new();
    worksheets.forEach(ws => {
      XLSX.utils.book_append_sheet(wb, ws.sheet, ws.name);
    });
    
    // Juga tambahkan info worksheet
    const infoData = [
      { key: 'Path', value: path },
      { key: 'Timestamp', value: new Date().toISOString() },
      { key: 'Include All Data', value: includeAllData ? 'Yes' : 'No' },
      { key: 'Data Size', value: JSON.stringify(data).length + ' bytes' }
    ];
    
    const infoWorksheet = XLSX.utils.json_to_sheet(infoData);
    XLSX.utils.book_append_sheet(wb, infoWorksheet, 'Info');
    
    // Unduh file
    XLSX.writeFile(wb, filename);
    
    showNotif('success', `Data berhasil diunduh dengan nama ${filename}`);
    return true;
  } catch (error) {
    console.error('Error downloading database data:', error);
    showNotif('error', `Gagal mengunduh data: ${error.message}`);
    return false;
  }
}

// Tambahkan fungsi untuk UI yang memungkinkan pengguna memilih tahun dan bulan
function showDownloadDataModal() {
  // Buat modal untuk memilih parameter
  const modalHTML = `
    <div id="downloadDataModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;">
      <div style="background:white;padding:20px;border-radius:8px;width:400px;max-width:90%;">
        <h3 style="margin-top:0;">Unduh Data Database</h3>
        
        <div style="margin-bottom:15px;">
          <label for="downloadYear">Pilih Tahun:</label>
          <select id="downloadYear" style="width:100%;padding:8px;border-radius:4px;border:1px solid #ccc;">
            <option value="">-- Pilih Tahun --</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
        
        <div style="margin-bottom:15px;">
          <label for="downloadMonth">Pilih Bulan (opsional):</label>
          <select id="downloadMonth" style="width:100%;padding:8px;border-radius:4px;border:1px solid #ccc;" disabled>
            <option value="">-- Pilih Bulan --</option>
          </select>
        </div>
        
        <div style="margin-bottom:15px;">
          <label>
            <input type="checkbox" id="downloadAllData"> Download semua data
          </label>
        </div>
        
        <div id="downloadDataStatus" style="margin:10px 0;color:#e74c3c;"></div>
        
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button id="cancelDownloadBtn" style="padding:8px 15px;border:none;background:#ccc;border-radius:4px;cursor:pointer;">Batal</button>
          <button id="confirmDownloadBtn" style="padding:8px 15px;border:none;background:#2196f3;color:white;border-radius:4px;cursor:pointer;">Unduh</button>
        </div>
      </div>
    </div>
  `;
  
  // Tambahkan modal ke body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const statusElement = document.getElementById('downloadDataStatus');
  
  // Event listener untuk tahun yang dipilih
  document.getElementById('downloadYear').addEventListener('change', async function() {
    const yearSelect = this;
    const monthSelect = document.getElementById('downloadMonth');
    statusElement.textContent = '';
    
    if (yearSelect.value) {
      monthSelect.disabled = false;
      monthSelect.innerHTML = '<option value="">-- Pilih Bulan --</option>';
      
      try {
        // Ambil daftar bulan yang tersedia untuk tahun tersebut
        const yearPath = `outJobAchievment/year${yearSelect.value}`; // Perhatikan ejaan yang benar
        const yearRef = ref(db, yearPath);
        const yearSnapshot = await get(yearRef);
        
        if (yearSnapshot.exists()) {
          const months = Object.keys(yearSnapshot.val());
          
          if (months.length === 0) {
            statusElement.textContent = 'Tidak ada data bulan untuk tahun ini';
          } else {
            for (const month of months) {
              monthSelect.innerHTML += `<option value="${month}">${month}</option>`;
            }
          }
        } else {
          monthSelect.innerHTML += '<option value="" disabled>Tidak ada data untuk tahun ini</option>';
          statusElement.textContent = `Tidak ada data untuk tahun ${yearSelect.value}`;
        }
      } catch (error) {
        console.error('Error loading months:', error);
        statusElement.textContent = `Error: ${error.message}`;
      }
    } else {
      monthSelect.disabled = true;
      monthSelect.innerHTML = '<option value="">-- Pilih Bulan --</option>';
    }
  });
  
  // Event listener untuk tombol batal
  document.getElementById('cancelDownloadBtn').addEventListener('click', function() {
    document.getElementById('downloadDataModal').remove();
  });
  
  // Event listener untuk tombol konfirmasi
  document.getElementById('confirmDownloadBtn').addEventListener('click', async function() {
    const year = document.getElementById('downloadYear').value;
    const month = document.getElementById('downloadMonth').value;
    const includeAllData = document.getElementById('downloadAllData').checked;
    
    if (!year) {
      statusElement.textContent = 'Silakan pilih tahun terlebih dahulu.';
      return;
    }
    
    // Cek terlebih dahulu apakah data tersedia
    try {
      const checkPath = `outJobAchievment/year${year}${month ? '/' + month : ''}`;
      const checkRef = ref(db, checkPath);
      const checkSnapshot = await get(checkRef);
      
      if (!checkSnapshot.exists()) {
        statusElement.textContent = `Tidak ada data di path ${checkPath}`;
        return;
      }
      
      // Tutup modal jika data tersedia
      document.getElementById('downloadDataModal').remove();
      
      // Jalankan fungsi unduh
      await downloadDatabaseData(year, month, includeAllData);
    } catch (error) {
      statusElement.textContent = `Error: ${error.message}`;
    }
  });
}

// Tambahkan tombol untuk memunculkan modal unduh data
function addDownloadDatabaseButton() {
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'downloadDatabaseBtn';
    downloadBtn.className = 'btn';
    downloadBtn.innerHTML = '📥 Download Data';
    downloadBtn.style.marginLeft = '10px';
    downloadBtn.addEventListener('click', showDownloadDataModal);
    toolbar.appendChild(downloadBtn);
  }
}

// Fungsi untuk memeriksa dan melaporkan status database
async function inspectDatabasePath(path) {
  try {
    const dataRef = ref(db, path);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      console.log(`Tidak ada data di path: ${path}`);
      return null;
    }
  } catch (error) {
    console.error(`Error memeriksa path ${path}:`, error);
    return null;
  }
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
      shiftSelect.innerHTML = '<option value="">Select shift</option>';
      shiftSelect.disabled = true;
      teamSelect.innerHTML = '<option value="">Select team</option>';
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
    shiftSelect.innerHTML = '<option value="">Select shift</option>';
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
    
    // Tambahkan tombol unduh database
    addDownloadDatabaseButton();
    
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