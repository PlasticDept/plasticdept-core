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
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM refs
const dateInput = document.getElementById('dateInput');
const shiftSelect = document.getElementById('shiftSelect');
const teamSelect = document.getElementById('teamSelect');
const matrixJobCount = document.getElementById('matrixJobCount');
const matrixQty = document.getElementById('matrixQty');
const matrixQtyOvertime = document.getElementById('matrixQtyOvertime');
const matrixQtyAdditional = document.getElementById('matrixQtyAdditional');
const matrixQtyRemaining = document.getElementById('matrixQtyRemaining');
const matrixQtyH1 = document.getElementById('matrixQtyH1');
const notifBox = document.getElementById('notifBox');

let selectedDate = null; // business date (YYYY-MM-DD)
let dataTable = null;
let fp = null;

// ================= Helpers =================
function showNotif({type, message}) {
  notifBox.innerHTML = `<div class="notif-${type}">${message}</div>`;
  setTimeout(() => {
    if (notifBox.innerHTML.includes(message)) notifBox.innerHTML = '';
  }, 3500);
}

// Format path DB based on business date
function getDateDBPath(dateStr) {
  if (!dateStr) return null;
  const { yearKey, monthKey, day } = breakdownBusinessDate(dateStr);
  return `${yearKey}/${monthKey}/${day}`;
}

// ================= User Profile =================
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

async function populateUserProfileData() {
  const username = localStorage.getItem("username");
  if (!username) return;
  const userFullNameElement = document.getElementById('userFullName');
  const userAvatarElement = document.getElementById('userAvatar');
  const userShiftElement = document.getElementById('userShift');

  try {
    const userRef = ref(db, `users/${username}`);
    const snapshot = await get(userRef);
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
    } else {
      if (userFullNameElement) userFullNameElement.textContent = username;
      if (userAvatarElement) userAvatarElement.textContent = username.charAt(0).toUpperCase();
      if (userShiftElement) userShiftElement.textContent = "-";
    }
  } catch {
    if (userFullNameElement) userFullNameElement.textContent = username;
    if (userAvatarElement) userAvatarElement.textContent = username.charAt(0).toUpperCase();
    if (userShiftElement) userShiftElement.textContent = "-";
  }
  updateUserShiftColor();
}

// ================= Populate Shift / Team =================
async function populateShifts() {
  shiftSelect.value = "";
  shiftSelect.disabled = true;
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  if (!selectedDate) return;

  try {
    const path = `outJobAchievment/${getDateDBPath(selectedDate)}`;
    const dayRef = ref(db, path);
    const snap = await get(dayRef);
    if (!snap.exists()) {
      showNotif({type: "error", message: "Data tidak ditemukan untuk tanggal ini."});
      return;
    }
    const shifts = Object.keys(snap.val());
    shiftSelect.innerHTML = `<option value="">Pilih shift</option>`;
    shifts.forEach(shift => {
      shiftSelect.innerHTML += `<option value="${shift}">${shift.replace(/Shift$/, ' Shift')}</option>`;
    });
    shiftSelect.disabled = false;
    showNotif({type:"success", message:"Shift ditemukan."});
  } catch (err) {
    showNotif({type: "error", message: "Gagal mengambil shift: " + err.message});
  }
}

async function populateTeams() {
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  if (!selectedDate || !shiftSelect.value) return;
  try {
    const path = `outJobAchievment/${getDateDBPath(selectedDate)}/${shiftSelect.value}`;
    const shiftRef = ref(db, path);
    const snap = await get(shiftRef);
    if (!snap.exists()) {
      showNotif({type: "error", message: "Tidak ada team untuk shift ini."});
      return;
    }
    Object.keys(snap.val()).forEach(t => {
      teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
    teamSelect.disabled = false;
    showNotif({type:"success", message:"Team ditemukan."});
  } catch (err) {
    showNotif({type:"error", message:"Gagal mengambil team: " + err.message});
  }
}

// ================= Data Table Render =================
async function renderTable() {
  const team = teamSelect.value;
  const shift = shiftSelect.value;
  let jobs = [];
  if (selectedDate && shift && team) {
    try {
      const path = `outJobAchievment/${getDateDBPath(selectedDate)}/${shift}/${team}`;
      const teamRef = ref(db, path);
      const snap = await get(teamRef);
      if (!snap.exists()) {
        showNotif({type:"error", message:"Tidak ada job untuk team ini."});
        resetSummaryToZero();
        if (dataTable) dataTable.clear().draw(); else $('#achievementTable').DataTable().clear().draw();
        return;
      }
      jobs = Object.values(snap.val());
      showNotif({type:"success", message:"Data berhasil di-load."});
    } catch (err) {
      showNotif({type:"error", message:"Gagal load data: " + err.message});
    }
  }

  // Summary counters
  let qtyRemaining = 0, qtyAdditional = 0, qtyH1 = 0, qtyOvertime = 0;
  jobs.forEach(job => {
    const q = parseInt(job.qty) || 0;
    if (!job.jobType) return;
    const t = job.jobType.toLowerCase();
    if (t.includes('remaining')) qtyRemaining += q;
    else if (t.includes('add')) qtyAdditional += q;
    else if (t.includes('h-1')) qtyH1 += q;
    else if (t.includes('ot')) qtyOvertime += q;
  });

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
    job.actualTimestampWIB || job.actualTimestamp || '-', // prefer WIB log
    (job.qty !== undefined && job.qty !== null && job.qty !== "") ? Number(job.qty).toLocaleString('en-US') : '-'
  ]);

  if (dataTable) {
    dataTable.clear();
    dataTable.rows.add(rowData);
    dataTable.draw();
  } else {
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
      dom: 'Bft',
      language: {
        emptyTable: "Data tidak tersedia."
      }
    });

    setTimeout(() => {
      const $filter = $('#achievementTable_filter');
      const $buttons = $('.dt-buttons');
      $filter.css({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'flex-end',
        gap: '10px'
      });
      $buttons.appendTo($filter).css({'margin': '0', 'float': 'none'});
    }, 0);
  }

  // Update summary
  matrixJobCount.textContent = jobs.length;
  matrixQty.textContent = jobs.reduce((acc, j) => acc + (parseInt(j.qty) || 0), 0).toLocaleString('en-US');
  matrixQtyRemaining.textContent = qtyRemaining.toLocaleString('en-US');
  matrixQtyAdditional.textContent = qtyAdditional.toLocaleString('en-US');
  matrixQtyH1.textContent = qtyH1.toLocaleString('en-US');
  matrixQtyOvertime.textContent = qtyOvertime.toLocaleString('en-US');
}

function resetSummaryToZero() {
  matrixJobCount.textContent = '0';
  matrixQty.textContent = '0';
  matrixQtyRemaining.textContent = '0';
  matrixQtyAdditional.textContent = '0';
  matrixQtyH1.textContent = '0';
  matrixQtyOvertime.textContent = '0';
}

// ================= Datepicker & Auto Business Date =================
function initDatepicker() {
  fp = flatpickr("#dateInput", {
    dateFormat: "Y-m-d",
    allowInput: false,
    onChange: async (selectedDates, dateStr) => {
      selectedDate = dateStr;
      await populateShifts();
      teamSelect.innerHTML = '<option value="">Team</option>';
      teamSelect.disabled = true;
      resetSummaryCards();
      if (dataTable) dataTable.clear().draw();
    }
  });
}

function resetSummaryCards() {
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  matrixQtyRemaining.textContent = '-';
  matrixQtyAdditional.textContent = '-';
  matrixQtyH1.textContent = '-';
  matrixQtyOvertime.textContent = '-';
}

// Set otomatis business date kalau masih jendela NightShift dini hari
function autoSetBusinessDateIfNightWindow() {
  const wibNow = nowInWIB();
  const hour = wibNow.getHours();
  // Jika dini hari (00–05) kita asumsikan user ingin melihat NightShift business date kemarin.
  if (hour < 6) {
    const bDate = getBusinessDateForShift('NightShift', new Date());
    if (fp) fp.setDate(bDate, true);
    else {
      dateInput.value = bDate;
      selectedDate = bDate;
      populateShifts();
    }
  }
}

// ================= Events =================
document.getElementById('refreshBtn').onclick = function() {
  dateInput.value = '';
  selectedDate = null;
  shiftSelect.innerHTML = `<option value="">Pilih shift</option>`;
  shiftSelect.disabled = true;
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  resetSummaryCards();
  notifBox.innerHTML = '';
  if (dataTable) dataTable.clear().draw();
  if (fp) fp.clear();
};

shiftSelect.addEventListener('change', async () => {
  if (shiftSelect.value === 'NightShift') {
    const expected = getBusinessDateForShift('NightShift');
    if (selectedDate !== expected) {
      selectedDate = expected;
      if (fp) fp.setDate(expected, true);
      else {
        dateInput.value = expected;
        await populateShifts();
      }
    }
  }
  await populateTeams();
  resetSummaryCards();
  if (dataTable) dataTable.clear().draw();
});

teamSelect.addEventListener('change', async () => {
  await renderTable();
});

// ================= Export =================
document.getElementById('customExportBtn').onclick = function() {
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
  const wsData = [
    ...summary,
    [],
    ...title,
    [],
    ...tableHeaders,
    ...tableData
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Merge judul (baris ke-8 index 7)
  ws['!merges'] = [
    {s: {r: 7, c: 3}, e: {r: 7, c: 9}}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outbound Report");
  XLSX.writeFile(wb, `Outbound_Achievement_Report.xlsx`);
};

// ================= INIT =================
(async function init() {
  const auth = getAuth(app);
  await signInAnonymously(auth);
  initDatepicker();
  populateUserProfileData();
  autoSetBusinessDateIfNightWindow();
})();