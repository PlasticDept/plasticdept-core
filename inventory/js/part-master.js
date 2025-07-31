// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB5nOQhvHkN5W0BoFczs_PtnWEyVCf7euY",
  authDomain: "inventory-5e3ba.firebaseapp.com",
  projectId: "inventory-5e3ba",
  storageBucket: "inventory-5e3ba.firebasestorage.app",
  messagingSenderId: "391061542583",
  appId: "1:391061542583:web:15139020c7334a8eff9f32"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const collectionName = "part_master";

// --- SPINNER LOGIC (ADAPTED FROM sortir.js) ---
function showExportLoading(isShow = true) {
  let overlay = document.getElementById("exportLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "exportLoadingOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(255,255,255,0.85)";
    overlay.style.zIndex = 9999;
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner-large" style="border: 6px solid #e2e8f0; border-top: 6px solid #2676c2; border-radius: 50%; width: 64px; height: 64px; animation: spin 1s linear infinite;"></div>
        <div style="margin-top: 20px; font-size: 1.2rem; color: #222c3c;">Memuat data part master...</div>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
      </style>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = isShow ? "flex" : "none";
}

// DOM elements
const tableBody = document.querySelector("#part-table tbody");
const loadingEl = document.getElementById("loading");
const nodataEl = document.getElementById("nodata");
const fileUpload = document.getElementById("file-upload");
const searchBox = document.getElementById("search-box");
const searchBtn = document.getElementById("search-btn");

// Load all data from Firestore and render
let allParts = [];
let filteredParts = [];

async function loadParts() {
  showExportLoading(true); // Show loading spinner overlay
  loadingEl.style.display = "none";
  nodataEl.style.display = "none";
  tableBody.innerHTML = "";
  allParts = [];
  try {
    const snapshot = await db.collection(collectionName).orderBy("Supplier Part No").get();
    snapshot.forEach(doc => {
      allParts.push(doc.data());
    });
    filteredParts = [...allParts];
    renderTable(filteredParts);
  } catch (e) {
    nodataEl.textContent = "Error loading data.";
    nodataEl.style.display = "block";
  }
  showExportLoading(false); // Hide spinner overlay
}

function renderTable(data) {
  tableBody.innerHTML = "";
  if (data.length === 0) {
    nodataEl.style.display = "block";
    return;
  }
  nodataEl.style.display = "none";
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row["Supplier Part No"] || ""}</td>
      <td>${row["Local Part No"] || ""}</td>
      <td>${row["Material Code"] || ""}</td>
      <td>${row["Description"] || ""}</td>
      <td>${row["UOM"] || ""}</td>
      <td>${row["Pack Code"] || ""}</td>
      <td>${row["SPQ"] || ""}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// CSV/Excel file upload & import
fileUpload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showExportLoading(true); // Show loading spinner overlay during upload
  loadingEl.style.display = "none";
  nodataEl.style.display = "none";
  // Parse CSV or Excel
  if (file.name.endsWith(".csv")) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function(results) {
        await uploadToFirestore(results.data);
        await loadParts();
      }
    });
  } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');
      const workbook = XLSX.read(evt.target.result, {type: 'binary'});
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      await uploadToFirestore(data);
      await loadParts();
    };
    reader.readAsBinaryString(file);
  }
  showExportLoading(false); // Hide spinner overlay after upload
});

// Fungsi untuk mengamankan doc id agar tidak mengandung karakter tidak valid seperti "/"
function safeDocId(str) {
  // Replace all '/' with '_', Firestore tidak boleh ada karakter '/'
  return str.replace(/\//g, '_');
  // Jika ingin lebih aman untuk semua karakter, bisa gunakan:
  // return encodeURIComponent(str);
}

function normalizeRowKeys(row) {
  const out = {};
  Object.keys(row).forEach(k => {
    out[k.trim().replace(/\s/g,'').toUpperCase()] = row[k];
  });
  return out;
}

async function uploadToFirestore(data) {
  const batch = db.batch();
  data.forEach(row => {
    const normRow = normalizeRowKeys(row);
    if (!normRow["SUPPLIERPARTNO"]) return;
    const docId = safeDocId(normRow["SUPPLIERPARTNO"]);
    console.log(Object.keys(row), row);
    batch.set(db.collection(collectionName).doc(docId), {
      "Supplier Part No": normRow["SUPPLIERPARTNO"] || "",
      "Local Part No": normRow["LOCALPARTNO"] || "",
      "Material Code": normRow["MATERIALCODE"] || "",
      "Description": normRow["DESCRIPTION"] || "",
      "UOM": normRow["UOM"] || "",
      "Pack Code": normRow["PACKCODE"] || "",
      "SPQ": normRow["SPQ"] || ""
    });
  });
  await batch.commit();
}

// Search/filter function
function filterParts(query) {
  query = query.trim().toLowerCase();
  if (!query) {
    filteredParts = [...allParts];
  } else {
    filteredParts = allParts.filter(part =>
      Object.keys(part).some(key =>
        (part[key] || "").toString().toLowerCase().includes(query)
      )
    );
  }
  renderTable(filteredParts);
}

searchBtn.addEventListener("click", () => {
  filterParts(searchBox.value);
});
searchBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    filterParts(searchBox.value);
  }
});
// Optional: real-time filter as typing
searchBox.addEventListener("input", () => {
  // Uncomment next line for instant search while typing:
  // filterParts(searchBox.value);
});

window.addEventListener("DOMContentLoaded", loadParts);