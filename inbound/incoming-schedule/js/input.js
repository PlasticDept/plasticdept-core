import { authPromise } from './config.js';
import { ref, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let db;
let table;
let firebaseRecords = {};
const csvInput = document.getElementById("csvFile");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");
const dataType = document.getElementById("dataType");
let selectedFile = null;

// Tunggu sampai login anonymous berhasil
authPromise.then(({ db: database }) => {
  db = database;
  console.log("📦 Firebase ready, lanjut load data");

  initTable();         // inisialisasi DataTable
  loadFirebaseData();  // mulai ambil data dari database
}).catch(err => {
  console.error("❌ Gagal login anonymous:", err);
});

// Fungsi untuk inisialisasi DataTable
function initTable() {
  table = $("#containerTable").DataTable({
    destroy: true,
    ordering: true,
    searching: true,
    paging: true,
    info: true,
    scrollX: true,
    columns: [
      { title: "No" },
      { title: "Container No" },
      { title: "Feet" },
      { title: "Container Type" },
      { title: "Invoice No" },
      { title: "Package" },
      { title: "Incoming Date" },
      { title: "Status" },
      { title: "Time In" },
      { title: "Unloading Time" },
      { title: "Finish" },
    ]
  });
}


function showStatus(message, type = "info") {
  uploadStatus.textContent = message;
  uploadStatus.className = `status ${type}`;
}

function getStatusProgress(timeIn, unloadingTime, finish) {
  timeIn = (timeIn || "").trim();
  unloadingTime = (unloadingTime || "").trim();
  finish = (finish || "").trim();
  if ([timeIn, unloadingTime, finish].every(val => val === "0")) return "Reschedule";
  if ([timeIn, unloadingTime, finish].every(val => val === "")) return "Waiting";
  if ([timeIn, unloadingTime, finish].every(val => val === "-")) return "Reschedule";
  if (timeIn && (!unloadingTime || unloadingTime === "-")) return "Outstanding";
  if (timeIn && unloadingTime && (!finish || finish === "-")) return "Processing";
  if (timeIn && unloadingTime && finish) return "Finish";
  return "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const shortYear = year.toString().slice(-2);
  return `${day}-${monthNames[month]}-${shortYear}`;
}

function getContainerType(row) {
  const pkg = (row["PACKAGE"] || row["Package"] || "").toUpperCase();
  if (pkg.includes("BAG")) return "NON PALLETIZE";
  if (pkg) return "PALLETIZE";
  return "";
}

function renderRowArray(row, index, id) {
  const feet = row["FEET"] || row["Feet"] || "";
  const containerNo = row["NO CONTAINER"] || row["No Container"] || row["Container No"] || "";
  const invoiceNo = row["INVOICE NO"] || row["Invoice No"] || "";
  const packageVal = row["PACKAGE"] || row["Package"] || "";
  const incomingPlan = row["INCOMING PLAN"] || row["Incoming Plan"] || row["Incoming Date"] || "";
  const timeIn = (row["TIME IN"] && row["TIME IN"].trim() === "-") ? "" : (row["TIME IN"] || "");
  const unloadingTime = (row["UNLOADING TIME"] && row["UNLOADING TIME"].trim() === "-") ? "" : (row["UNLOADING TIME"] || "");
  const finish = (row["FINISH"] && row["FINISH"].trim() === "-") ? "" : (row["FINISH"] || "");

  const containerType = getContainerType(row);
  const status = getStatusProgress(timeIn, unloadingTime, finish);

  return [
    "", // No (autonumber)
    containerNo,
    feet,
    containerType,
    invoiceNo,
    packageVal,
    formatDate(incomingPlan),
    `<span class="label label-${status.toLowerCase()}">${status}</span>`,
    `<span contenteditable class="editable time-in">${timeIn}</span>`,
    `<span contenteditable class="editable unloading-time">${unloadingTime}</span>`,
    `<span contenteditable class="editable finish">${finish}</span>`
  ];
}

function loadFirebaseData() {
  const dbRef = ref(db, "incoming_schedule");
  onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {};
    table.clear().draw();

    let index = 0;
    firebaseRecords = {};
    for (const id in data) {
      const row = data[id];
      firebaseRecords[id] = row;
      const arr = renderRowArray(row, index++, id);
      arr._firebaseid = id;
      table.row.add(arr);
    }
    table.draw();

    table.rows().every(function (rowIdx) {
      this.data()[0] = rowIdx + 1;
      this.invalidate();
    });
  }, error => {
    console.error("❌ Gagal ambil data realtime dari Firebase:", error);
  });
}

function updateFirebaseField(recordId, timeInRaw, unloadingTimeRaw, finishRaw) {
  const timeIn = (timeInRaw || "-").trim();
  const unloadingTime = (unloadingTimeRaw || "-").trim();
  const finish = (finishRaw || "-").trim();
  const dbRef = ref(db, `incoming_schedule/${recordId}`);
  update(dbRef, {
    "TIME IN": timeIn,
    "UNLOADING TIME": unloadingTime,
    "FINISH": finish
  });
}

function deleteAllFirebaseRecords() {
  const dbRef = ref(db, "incoming_schedule");
  return remove(dbRef);
}

function uploadToFirebase(records) {
  const updates = {};
  records.forEach((row, index) => {
    const id = (row["NO CONTAINER"] || row["No Container"] || row["Container No"] || `id_${Date.now()}_${index}`).toString().replace(/\./g, "_");
    updates[id] = row;
  });
  const dbRef = ref(db, "incoming_schedule");
  return update(dbRef, updates);
}

function excelDateToString(serial, format="D-MMM-YY") {
  // Convert Excel serial date to JS Date
  if (!serial || isNaN(serial)) return "";
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const day = String(date_info.getDate());
  const monthIdx = date_info.getMonth();
  const year = date_info.getFullYear();

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (format === "D-MMM-YY") {
    return `${day}-${monthNames[monthIdx]}-${String(year).slice(-2)}`;
  }
  // fallback DD/MM/YYYY
  return `${day}/${monthIdx + 1}/${year}`;
}

function normalizeMonthlyDateField(dateVal) {
  // Untuk monthly: bisa string, bisa Excel serial
  if (!dateVal) return "";
  if (typeof dateVal === "number" && !isNaN(dateVal)) {
    return excelDateToString(dateVal, "D-MMM-YY");
  }
  if (typeof dateVal === "string") {
    // jika sudah dalam bentuk D-MMM-YY, kembalikan saja
    return dateVal;
  }
  return "";
}

function parseAndUploadFile(file) {
  const fileName = file.name.toLowerCase();
  showStatus("⏳ Memproses file daily...", "info");

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      await afterFileParsed(rows);
    };
    reader.readAsArrayBuffer(file);
  } else {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        await afterFileParsed(results.data);
      }
    });
  }
}

async function afterFileParsed(rows) {
  try {
    showStatus("📤 Mengupload data baru ke Database...", "info");
    await deleteAllFirebaseRecords();
    await uploadToFirebase(rows);
    showStatus("✅ Upload daily selesai!", "success");
    document.getElementById("csvFile").value = "";
    setTimeout(() => showStatus("", ""), 3000);
  } catch (err) {
    console.error(err);
    showStatus("❌ Gagal upload data daily!", "error");
  }
}

// ================= PATCH: Monthly Upload ===================
function uploadMonthlyToFirebase(records) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const updates = {};

  records.forEach((row, index) => {
    // Lewatkan baris yang semua field-nya kosong
    if (
      (!row["Date"] && !row["Container Number"] && !row["Process Type"] && !row["Feet"]) ||
      Object.values(row).every(val => (val ?? "").toString().trim() === "")
    ) return;

    // Flexible field name
    let dateStr = row["Date"] || row["DATE"] || row["Tanggal"] || row["tanggal"] || "";
    let containerNo = row["Container Number"] || row["CONTAINER NUMBER"] || row["Container No"] || row["No Container"] || row["NO CONTAINER"] || `id_${Date.now()}_${index}`;
    containerNo = String(containerNo).trim().replace(/[.#$/\[\]\s]/g, "_"); // <-- PATCH HERE
    let processType = row["Process Type"] || row["PROCESS TYPE"] || row["Process"] || "";
    let feet = row["Feet"] || row["FEET"] || "";
    let biz = row["Biz"] || row["BIZ"] || ""; // Menambahkan field Biz

    // Handle Excel serial date
    dateStr = normalizeMonthlyDateField(dateStr);

    // Parsing tanggal D-MMM-YY
    let year = "", monthKey = "", day = "";
    if (dateStr && typeof dateStr === "string" && dateStr.includes("-")) {
      const [d, m, y] = dateStr.split("-");
      if (d && m && y) {
        day = parseInt(d, 10).toString();
        const monthIdx = monthNames.findIndex(mon => mon.toLowerCase() === m.trim().toLowerCase());
        if (monthIdx !== -1) {
          const paddedMonth = (monthIdx + 1).toString().padStart(2, "0");
          monthKey = `${paddedMonth}_${monthNames[monthIdx]}`;
        } else {
          monthKey = "unknown";
        }
        year = y.length === 2 ? "20" + y : y;
      } else {
        year = "unknown"; monthKey = "unknown"; day = "unknown";
      }
    } else {
      year = "unknown"; monthKey = "unknown"; day = "unknown";
    }

    const dataObj = {
      "Date": dateStr,
      "Container Number": containerNo,
      "Process Type": processType,
      "Feet": feet,
      "Biz": biz // Menambahkan field Biz ke objek database
    };

    updates[`${year}/${monthKey}/${day}/${containerNo}`] = dataObj;
  });

  const dbRef = ref(db, "incomingSchedule");
  return update(dbRef, updates);
}

function parseAndUploadMonthlyFile(file) {
  const fileName = file.name.toLowerCase();
  showStatus("⏳ Memproses file monthly...", "info");

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      await afterMonthlyFileParsed(rows);
    };
    reader.readAsArrayBuffer(file);
  } else {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        await afterMonthlyFileParsed(results.data);
      }
    });
  }
}

async function afterMonthlyFileParsed(rows) {
  try {
    showStatus("📤 Mengupload data baru ke Database...", "info");
    await uploadMonthlyToFirebase(rows);
    showStatus("✅ Upload monthly selesai!", "success");
    document.getElementById("csvFile").value = "";
    setTimeout(() => showStatus("", ""), 3000);
  } catch (err) {
    console.error(err);
    showStatus("❌ Gagal upload data monthly!", "error");
  }
}
// =============== END PATCH MONTHLY UPLOAD ==================

csvInput.addEventListener("change", function (e) {
  selectedFile = e.target.files[0];
  showStatus("📁 File siap diupload. Klik tombol Upload.", "info");
});

uploadBtn.addEventListener("click", function () {
  if (!selectedFile) {
    showStatus("⚠️ Silakan pilih file CSV atau Excel terlebih dahulu!", "error");
    return;
  }
  if (dataType.value === "daily") {
    parseAndUploadFile(selectedFile);
  } else if (dataType.value === "monthly") {
    parseAndUploadMonthlyFile(selectedFile); // PATCH: aktifkan upload monthly
  }
});

$('#containerTable tbody').on('blur', '.editable', function () {
  const cell = $(this);
  const td = cell.closest('td');
  const rowNode = td.closest('tr');
  const rowIdx = table.row(rowNode).index();
  const data = table.row(rowNode).data();
  const containerNo = data[1];
  let recordId = null;
  for (const id in firebaseRecords) {
    if (
      firebaseRecords[id]["NO CONTAINER"] === containerNo ||
      firebaseRecords[id]["No Container"] === containerNo ||
      firebaseRecords[id]["Container No"] === containerNo
    ) {
      recordId = id;
      break;
    }
  }
  if (!recordId) return;
  const timeIn = $(rowNode).find('.time-in').text();
  const unloading = $(rowNode).find('.unloading-time').text();
  const finish = $(rowNode).find('.finish').text();
  updateFirebaseField(recordId, timeIn, unloading, finish);
});

$('#containerTable tbody').on('keydown', '.editable', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // cegah baris baru
    $(this).blur();     // trigger blur = keluar mode edit & update firebase
  }
});