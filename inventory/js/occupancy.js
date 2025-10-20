// Configuration and Global Variables
const API_URL = 'http://127.0.0.1:8000'; // Base URL to FastAPI backend via ngrok
const GITHUB_REPO = 'PlasticDept/plasticdept-core';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'occupancy.json';
const GITHUB_MASTER_LOC_FILE = 'master_locations.json';
const RAW_GITHUB_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;
const RAW_MASTER_GITHUB_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_MASTER_LOC_FILE}`;

let occupancyData = []; // Store all occupancy data from GitHub
let masterLocations = []; // Store all master locations
let allLocations = []; // Store merged locations (for UI)
let currentPage = 1; // Current page for pagination
let currentArea = "highRackArea"; // Current selected area
let allRackPrefixes = []; // All available rack prefixes (DA, DB, DC, etc.)
let currentRackPrefix = ""; // Current selected rack prefix for high rack areas
let locationCache = {}; // Cache for location data
const BLOCKS_PER_PAGE = 15; // Number of rack columns to display per page
const RACKS_PER_PAGE = 5; // Number of racks to display per page (NEW)

// Customer code colors
const customerColors = {
  'MIXED PARTS': '#8B5CF6', // Purple untuk mixed parts
  'PL AUTO': '#FFD580', // Light Orange
  'PL AUTO 2': '#FFA500', // Orange
  'SC-2': '#90EE90', // Light Green
  'T-TEC': '#87CEEB', // Sky Blue
  'TTI-PP': '#E6E6FA', // Lavender
  'TTI-AIM': '#ce102cff', // Light Pink
  'TTI-MACHINERY': '#FFC0CB' // Pink
};

// Lokasi yang diblokir/tidak digunakan
const blockedLocations = [
    'DF-03-2-1', 'DF-03-2-2', 'DF-03-2-3', 'DF-03-2-4',
    'DF-07-1-1', 'DF-07-1-2', 'DF-07-1-3', 'DF-07-1-4',
    'DF-14-1-1', 'DF-14-1-2', 'DF-14-1-3', 'DF-14-1-4',
    'DU-07-1-1', 'DU-07-1-2', 'DU-07-1-3', 'DU-07-1-4',
    'DU-14-1-1', 'DU-14-1-2', 'DU-14-1-3', 'DU-14-1-4'
];

// Daftar kode lokasi GA stack 1 dengan format NG
const gaStackNgLocations = [
    'GA-NG-01-1-1', 'GA-NG-01-2-1', 'GA-NG-02-1-1', 'GA-NG-02-2-1', 
    'GA-NG-03-1-1', 'GA-NG-03-2-1', 'GA-NG-04-1-1', 'GA-NG-04-2-1',
    'GA-NG-05-1-1', 'GA-NG-05-2-1', 'GA-NG-06-1-1', 'GA-NG-06-2-1',
    'GA-NG-07-1-1', 'GA-NG-07-2-1', 'GA-NG-08-1-1', 'GA-NG-08-2-1',
    'GA-NG-09-1-1', 'GA-NG-09-2-1', 'GA-NG-10-1-1', 'GA-NG-10-2-1',
    'GA-NG-11-1-1', 'GA-NG-11-2-1', 'GA-NG-12-1-1', 'GA-NG-12-2-1',
    'GA-NG-13-1-1', 'GA-NG-13-2-1'
];

// Mapping dari lokasi normal ke lokasi NG
const locationMapping = {};

// Buat mapping dari GA-XX-Y-Z ke GA-NG-XX-Y-Z
gaStackNgLocations.forEach(ngLoc => {
    // Ambil bagian XX-Y-Z dari GA-NG-XX-Y-Z
    const parts = ngLoc.match(/^GA-NG-(\d{2}-\d-\d)$/);
    if (parts) {
        const suffix = parts[1]; // XX-Y-Z
        const normalLoc = `GA-${suffix}`; // GA-XX-Y-Z
        locationMapping[normalLoc] = ngLoc;
    }
});

document.addEventListener('DOMContentLoaded', function() {
    updateCustomerLegend();
    initializeApp();
    setupModalEventHandlers(); // Tambahkan setup event handler untuk modal

    document.getElementById('uploadMasterBtn').addEventListener('click', handleMasterLocationUpload);
    document.getElementById('uploadOccupancyBtn').addEventListener('click', handleFileUpload);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
    document.getElementById('downloadBtn').addEventListener('click', showDownloadOptions);

    const areaButtons = document.querySelectorAll('.rack-selector .btn');
    areaButtons.forEach(button => {
        button.addEventListener('click', function() {
            const area = this.getAttribute('data-area');
            toggleAreaView(area, areaButtons);
        });
    });
});

// Fungsi untuk mengatur event handler modal
function setupModalEventHandlers() {
    const locationModal = document.getElementById('locationModal');
    if (!locationModal) return;
    
    locationModal.addEventListener('hidden.bs.modal', function() {
        console.log('Modal hidden event triggered');
        
        // Hapus semua backdrop modal yang mungkin tersisa
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => {
            document.body.removeChild(backdrop);
        });
        
        // Reset body style dan class
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        
        // Pastikan pointer-events semua cell berfungsi
        document.querySelectorAll('.location-cell').forEach(cell => {
            cell.style.pointerEvents = 'auto';
        });
        
        console.log('Modal cleanup complete');
    });
}

// Initialize Application
async function initializeApp() {
    try {
        // Tambahkan loading spinner fullscreen
        const loadingScreen = document.createElement('div');
        loadingScreen.className = 'fullscreen-loading';
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <div class="loading-logo">
                    <img src="/plasticdept-core/outbound/monitoring-control/img/reverse-logistic.png" alt="PlasticDept Logo">
                </div>
                <h2>Occupancy Dashboard</h2>
                <div class="loading-spinner-large"></div>
                <p>Memuat data halaman occupancy...</p>
            </div>
        `;
        document.body.appendChild(loadingScreen);
        
        // Setel timeout untuk menghapus loading screen jika terlalu lama
        const loadingTimeout = setTimeout(() => {
            if (document.body.contains(loadingScreen)) {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => loadingScreen.remove(), 500);
            }
        }, 15000); // 15 detik timeout
        
        showLoading(true);

        await loadMasterLocations();
        await loadOccupancyData();
        mergeOccupancyWithMaster();

        analyzeLocationStructure();
        generateRackAreaButtons();

        if (allRackPrefixes.length > 0) {
            displayMultipleRacks(1);
        }

        // Panggil fungsi untuk update statistik
        updateStatistics();
        updateCustomerStatistics();

        showLoading(false);
        
        // Hapus loading screen
        clearTimeout(loadingTimeout);
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 500);
    } catch (error) {
        // Error handling yang sudah ada
        console.error("Error initializing app:", error);
        alert("Failed to initialize application. Please try again.");
        showLoading(false);
        
        const loadingScreen = document.querySelector('.fullscreen-loading');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }
}

// Show/hide loading indicator
function showLoading(show) {
    document.body.style.cursor = show ? 'wait' : 'default';
    
    // Tampilkan loading spinner kecil saat refresh data (bukan fullscreen)
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        if (show) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        } else {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    }
}

function updateCustomerLegend() {
    const legendContainer = document.querySelector('.legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    const availableSpan = document.createElement('span');
    availableSpan.className = 'legend-item';
    availableSpan.innerHTML = `<span class="legend-color available"></span> Available`;
    legendContainer.appendChild(availableSpan);
    
    // Tambahkan indikator Mixed Parts
    const mixedPartsSpan = document.createElement('span');
    mixedPartsSpan.className = 'legend-item ms-3';
    mixedPartsSpan.innerHTML = `<span class="legend-color mixed-parts" style="background-color: ${customerColors['MIXED PARTS']}"></span> Mixed Parts`;
    legendContainer.appendChild(mixedPartsSpan);

    // Tambahkan customer codes lainnya
    Object.keys(customerColors).forEach(customer => {
        if (customer !== 'MIXED PARTS') {  // Skip Mixed Parts karena sudah ditambahkan
            const span = document.createElement('span');
            span.className = 'legend-item ms-3';
            span.innerHTML = `<span class="legend-color customer-${customer.replace(/\s+/g, '-').toLowerCase()}" style="background-color: ${customerColors[customer]}"></span> ${customer}`;
            legendContainer.appendChild(span);
        }
    });

    let styleEl = document.getElementById('customer-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'customer-styles';
        document.head.appendChild(styleEl);
    }

    let cssRules = '';
    Object.keys(customerColors).forEach(customer => {
        const cssClass = `.customer-${customer.replace(/\s+/g, '-').toLowerCase()}`;
        cssRules += `${cssClass} { background-color: ${customerColors[customer]}; border-color: ${adjustBorderColor(customerColors[customer])}; }\n`;
    });
    
    // Tambahkan style untuk mixed-parts
    cssRules += `.mixed-parts { background-color: ${customerColors['MIXED PARTS']}; border-color: ${adjustBorderColor(customerColors['MIXED PARTS'])}; }\n`;
    
    // Style tambahan untuk indikator angka di dalam cell
    cssRules += `.mix-indicator { 
        position: absolute; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%); 
        font-size: 10px; 
        font-weight: bold; 
        color: white;
        text-shadow: 0px 0px 2px rgba(0,0,0,0.7);
    }\n`;
    
    cssRules += `.location-cell.mixed-parts { position: relative; }\n`;

    styleEl.textContent = cssRules;
}
// Adjust border color to be slightly darker than background
function adjustBorderColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    const darkenFactor = 0.9;
    const newR = Math.floor(r * darkenFactor);
    const newG = Math.floor(g * darkenFactor);
    const newB = Math.floor(b * darkenFactor);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Load Master Locations from GitHub
async function loadMasterLocations() {
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${RAW_MASTER_GITHUB_URL}?t=${timestamp}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn("Master locations file not found. It may need to be created first.");
                masterLocations = [];
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        masterLocations = data;
        return data;
    } catch (error) {
        console.error("Error loading master locations:", error);
        masterLocations = [];
        return [];
    }
}

// Load Occupancy Data from GitHub
async function loadOccupancyData() {
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${RAW_GITHUB_URL}?t=${timestamp}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn("Occupancy data file not found. It may need to be created first.");
                occupancyData = [];
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        try {
            const cleanedText = text.replace(/:\s*NaN\s*,/g, ': null,')
                                    .replace(/:\s*NaN\s*\}/g, ': null}');
            const data = JSON.parse(cleanedText);
            occupancyData = data;
            return data;
        } catch (jsonError) {
            console.error("Invalid JSON format:", jsonError);
            console.error("JSON content:", text.substring(0, 200) + "...");
            throw new Error("Failed to parse response JSON: " + jsonError.message);
        }
    } catch (error) {
        console.error("Error loading occupancy data:", error);
        occupancyData = [];
        return [];
    }
}

// Fungsi untuk mendapatkan data lokasi berdasarkan kode lokasi
function getLocationData(locationCode) {
    // Cek apakah lokasi merupakan kode GA stack 1 yang perlu dimapping
    if (locationCode.startsWith('GA-') && locationMapping[locationCode]) {
        // Jika ya, gunakan kode lokasi dengan format NG
        const ngLocationCode = locationMapping[locationCode];
        
        // Cari di occupancyData
        for (const occ of occupancyData) {
            const code = occ.Location || occ.locationCode || occ.location || occ["Location Code"];
            if (code === ngLocationCode) {
                return occ;
            }
        }
    }
    
    // Jika bukan lokasi yang dimapping atau tidak ditemukan di format NG,
    // cari dengan cara normal
    for (const occ of occupancyData) {
        const code = occ.Location || occ.locationCode || occ.location || occ["Location Code"];
        if (code === locationCode) {
            return occ;
        }
    }
    
    return null;
}

function mergeOccupancyWithMaster() {
    // Buat struktur data baru untuk menyimpan multiple item per lokasi
    const multiItemLocations = {};
    
    // Kelompokkan semua item berdasarkan lokasi
    occupancyData.forEach(occ => {
        const code = occ.Location || occ.locationCode || occ.location || occ["Location Code"];
        if (!code) return;
        
        // Inisialisasi array jika belum ada
        if (!multiItemLocations[code]) {
            multiItemLocations[code] = [];
        }
        
        // Tambahkan item ke array
        multiItemLocations[code].push({
            isOccupied: true,
            partNo: occ["Part No"] || occ.partNo || "",
            productDescription: occ["Product Description"] || occ["Description"] || "",
            invoiceNo: occ["Invoice No."] || occ["Invoice No"] || occ.invoiceNo || "",
            lotNo: occ["Lot No."] || occ.lotNo || "",
            receiveDate: occ["Received Date"] || occ["Receive Date"] || "",
            status: occ["Status"] || occ.status || "",
            quantity: occ["QTY"] || occ["Quantity"] || occ.quantity || 0,
            customerCode: occ["Customer Code"] || occ.customerCode || "",
            uidCount: occ["UID"] || occ["UID Count"] || occ.uidCount || 0
        });
    });
    
    // Cek juga untuk lokasi dengan format NG (untuk GA stack)
    Object.entries(locationMapping).forEach(([normalLoc, ngLoc]) => {
        if (multiItemLocations[ngLoc] && !multiItemLocations[normalLoc]) {
            multiItemLocations[normalLoc] = multiItemLocations[ngLoc];
        }
    });
    
    allLocations = masterLocations.map(loc => {
        const code = loc.locationCode;
        const items = multiItemLocations[code] || [];
        
        // Jika tidak ada item, kembalikan lokasi kosong
        if (items.length === 0) {
            return {
                ...loc,
                isOccupied: false,
                items: []
            };
        }
        
        // Jika ada item, kembalikan lokasi dengan array items
        return {
            ...loc,
            isOccupied: true,
            items: items,
            // Simpan item pertama sebagai default untuk kompatibilitas
            partNo: items[0].partNo,
            productDescription: items[0].productDescription,
            invoiceNo: items[0].invoiceNo,
            lotNo: items[0].lotNo,
            receiveDate: items[0].receiveDate,
            status: items[0].status,
            quantity: items[0].quantity,
            customerCode: items[0].customerCode,
            uidCount: items[0].uidCount
        };
    });
    
    // Update location cache
    locationCache = {};
    allLocations.forEach(loc => {
        locationCache[loc.locationCode] = loc;
    });
    
    inspectLoadedData();
}

// Analyze Location Structure to Identify Rack Types
function analyzeLocationStructure() {
    const highRackPrefixes = new Set();
    const floorPrefixes = new Set();

    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        if (/^[A-Z]{2}-\d{2}-\d-\d$/.test(locationCode)) {
            const prefix = locationCode.substring(0, 2);
            highRackPrefixes.add(prefix);
        }
        // Format standar A-01-01, B-01-01, dll
        else if (/^[A-Z]-\d{2}-\d{2}$/.test(locationCode)) {
            const prefix = locationCode.substring(0, 1);
            floorPrefixes.add(prefix);
        }
        // Format khusus untuk area Y (Y06-01, Y07-01, dll)
        else if (/^Y\d{2}-\d{2}$/.test(locationCode)) {
            floorPrefixes.add('Y');
        }
    });

    allRackPrefixes = Array.from(highRackPrefixes).sort();
    const allFloorPrefixes = Array.from(floorPrefixes).sort();

    window.rackPrefixes = {
        highRack: allRackPrefixes,
        floor: allFloorPrefixes
    };
}

// Generate Rack Area Buttons
function generateRackAreaButtons() {
    const rackAreaButtonsContainer = document.getElementById('rackAreaButtons');
    rackAreaButtonsContainer.innerHTML = '';

    window.rackPrefixes.highRack.forEach(prefix => {
        const button = document.createElement('button');
        button.className = 'rack-area-btn';
        button.textContent = prefix;
        button.addEventListener('click', () => {
            document.querySelectorAll('.rack-area-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // Tampilkan halaman yang berisi rack yang dipilih (DIUBAH)
            const rackIndex = allRackPrefixes.indexOf(prefix);
            const pageNum = Math.floor(rackIndex / RACKS_PER_PAGE) + 1;
            displayMultipleRacks(pageNum);
        });
        rackAreaButtonsContainer.appendChild(button);
    });

    window.rackPrefixes.floor.forEach(prefix => {
        const button = document.createElement('button');
        button.className = 'rack-area-btn';
        button.textContent = prefix;
        button.addEventListener('click', () => {
            document.querySelectorAll('.rack-area-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            displayFloorArea(prefix);
        });
        rackAreaButtonsContainer.appendChild(button);
    });

    if (rackAreaButtonsContainer.children.length > 0) {
        rackAreaButtonsContainer.children[0].classList.add('active');
    }
}

// Handle File Upload to Backend API (Occupancy)
function handleFileUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select an occupancy file first.');
        return;
    }

    const uploadBtn = document.getElementById('uploadOccupancyBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
        fileInput.value = '';
        alert(`Occupancy data successfully uploaded to GitHub! Processed ${data.rows_processed} records.`);
        initializeApp();
    })
    .catch(error => {
        alert(`Error uploading occupancy data: ${error.message}`);
    })
    .finally(() => {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    });
}

function showDownloadOptions() {
    // Buat modal untuk pilihan download
    const modalHTML = `
    <div class="modal fade" id="downloadModal" tabindex="-1" aria-labelledby="downloadModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="downloadModalLabel">Download Occupancy Data</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="list-group">
                        <button type="button" class="list-group-item list-group-item-action" id="downloadFullData">
                            <i class="bi bi-file-earmark-spreadsheet me-2"></i>
                            <strong>Full Occupancy Data</strong>
                            <p class="mb-0 text-muted small">Download semua data lokasi dan status penggunaannya</p>
                        </button>
                        <button type="button" class="list-group-item list-group-item-action" id="downloadMixedPartsData">
                            <i class="bi bi-layers me-2"></i>
                            <strong>Mixed Parts Data</strong>
                            <p class="mb-0 text-muted small">Download hanya lokasi dengan multiple part number</p>
                        </button>
                        <button type="button" class="list-group-item list-group-item-action" id="downloadMasterData">
                            <i class="bi bi-grid-1x2 me-2"></i>
                            <strong>Master Location Data</strong>
                            <p class="mb-0 text-muted small">Download hanya data lokasi</p>
                        </button>
                        <button type="button" class="list-group-item list-group-item-action" id="downloadCustomerData">
                            <i class="bi bi-pie-chart me-2"></i>
                            <strong>Customer Statistics</strong>
                            <p class="mb-0 text-muted small">Download data statistik customer</p>
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                </div>
            </div>
        </div>
    </div>`;

    // Tambahkan modal ke dokumen
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Tampilkan modal
    const downloadModal = new bootstrap.Modal(document.getElementById('downloadModal'));
    downloadModal.show();
    
    // Tambahkan event listener untuk setiap opsi download
    document.getElementById('downloadFullData').addEventListener('click', () => {
        downloadOccupancyData();
        downloadModal.hide();
    });
    
    document.getElementById('downloadMixedPartsData').addEventListener('click', () => {
        downloadMixedPartsData();
        downloadModal.hide();
    });
    
    document.getElementById('downloadMasterData').addEventListener('click', () => {
        downloadMasterLocations();
        downloadModal.hide();
    });
    
    document.getElementById('downloadCustomerData').addEventListener('click', () => {
        downloadCustomerStats();
        downloadModal.hide();
    });
    
    // Hapus modal ketika disembunyikan
    document.getElementById('downloadModal').addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modalContainer);
    });
}

// Fungsi untuk download data occupancy lengkap dalam format Excel
function downloadOccupancyData() {
    // Periksa apakah data tersedia
    if (!allLocations || allLocations.length === 0) {
        alert('Tidak ada data occupancy yang tersedia untuk didownload.');
        return;
    }
    
    try {
        // Tampilkan loading indicator
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Downloading...';
        
        // Persiapkan data untuk Excel
        const excelData = [];
        
        // Tambahkan header row
        const headers = ["Location Code", "Status", "Part No", "Product Description", "Invoice No", 
                        "Lot No", "Receive Date", "Quantity", "Customer Code", "UID Count"];
        excelData.push(headers);
        
        // Tambahkan data rows
        allLocations.forEach(loc => {
            const status = loc.isOccupied ? (loc.status || "Occupied") : "Available";
            
            const row = [
                loc.locationCode,
                status,
                loc.partNo || "",
                loc.productDescription || "",
                loc.invoiceNo || "",
                loc.lotNo || "",
                loc.receiveDate || "",
                loc.quantity || 0,
                loc.customerCode || "",
                loc.uidCount || 0
            ];
            
            excelData.push(row);
        });
        
        // Buat workbook baru
        const wb = XLSX.utils.book_new();
        
        // Buat worksheet dari data
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Tambahkan worksheet ke workbook
        XLSX.utils.book_append_sheet(wb, ws, "Occupancy Data");
        
        // Unduh file Excel
        XLSX.writeFile(wb, `occupancy_data_${getCurrentDate()}.xlsx`);
        
        // Kembalikan tombol ke state normal
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download';
    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Terjadi kesalahan saat mengunduh data. Silakan coba lagi.");
        
        // Kembalikan tombol ke state normal jika terjadi error
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download';
    }
}

// Fungsi untuk download data mixed parts dalam format CSV yang diinginkan (sesuai contoh header kuning)
function downloadMixedPartsData() {
    // Periksa apakah data tersedia
    if (!allLocations || allLocations.length === 0) {
        alert('Tidak ada data occupancy yang tersedia untuk didownload.');
        return;
    }
    
    try {
        // Tampilkan loading indicator
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Downloading...';
        
        // Identifikasi lokasi dengan multiple parts
        const mixedPartsLocations = allLocations.filter(loc => 
            loc.isOccupied && loc.items && loc.items.length > 1
        );
        
        // Jika tidak ada lokasi dengan mixed parts
        if (mixedPartsLocations.length === 0) {
            alert('Tidak ditemukan lokasi dengan multiple parts.');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download';
            return;
        }
        
        // Persiapkan data untuk Excel dengan format yang diinginkan (tiap item dalam satu baris terpisah)
        const excelData = [];
        
        // Tambahkan header row sesuai contoh CSV dengan header kuning
        const headers = [
            "Location",
            "Part No", 
            "Product Description",
            "Received Date",
            "Invoice No.",
            "Lot No.",
            "Status",
            "Customer Code",
            "QTY",
            "UID"
        ];
        excelData.push(headers);
        
        // Tambahkan semua item dari setiap lokasi mixed parts
        mixedPartsLocations.forEach(loc => {
            // Untuk setiap lokasi, tambahkan semua item sebagai baris terpisah
            loc.items.forEach(item => {
                const row = [
                    loc.locationCode,
                    item.partNo || "",
                    item.productDescription || "",
                    item.receiveDate ? formatExcelDate(item.receiveDate) : "",
                    item.invoiceNo || "",
                    item.lotNo || "",
                    item.status || "Putaway", // Default ke "Putaway" jika tidak ada status
                    item.customerCode || "",
                    item.quantity || 0,
                    item.uidCount || 0
                ];
                excelData.push(row);
            });
        });
        
        // Buat workbook baru
        const wb = XLSX.utils.book_new();
        
        // Buat worksheet dari data detail items
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Styling untuk header (warna kuning)
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[address]) continue;
            
            ws[address].s = {
                fill: {
                    fgColor: { rgb: "FFFF00" } // Yellow background
                },
                font: {
                    bold: true
                }
            };
        }
        
        // Setel lebar kolom agar sesuai dengan konten
        const colWidths = [
            { wch: 15 },  // Location
            { wch: 15 },  // Part No
            { wch: 25 },  // Product Description
            { wch: 15 },  // Received Date
            { wch: 15 },  // Invoice No
            { wch: 15 },  // Lot No
            { wch: 12 },  // Status
            { wch: 15 },  // Customer Code
            { wch: 8 },   // QTY
            { wch: 8 }    // UID
        ];
        
        ws['!cols'] = colWidths;
        
        // Tambahkan worksheet ke workbook
        XLSX.utils.book_append_sheet(wb, ws, "Mixed Parts");
        
        // Unduh file Excel
        XLSX.writeFile(wb, `mixed_parts_data_${getCurrentDate()}.xlsx`);
        
        // Kembalikan tombol ke state normal
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download';
    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Terjadi kesalahan saat mengunduh data. Silakan coba lagi.");
        
        // Kembalikan tombol ke state normal jika terjadi error
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i> Download';
    }
}

// Fungsi untuk download master locations dalam format Excel
function downloadMasterLocations() {
    if (!masterLocations || masterLocations.length === 0) {
        alert('Tidak ada data master locations yang tersedia untuk didownload.');
        return;
    }
    
    try {
        // Persiapkan data untuk Excel
        const excelData = [];
        
        // Tambahkan header row
        excelData.push(["Location Code"]);
        
        // Tambahkan data rows
        masterLocations.forEach(loc => {
            excelData.push([loc.locationCode]);
        });
        
        // Buat workbook baru
        const wb = XLSX.utils.book_new();
        
        // Buat worksheet dari data
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Tambahkan worksheet ke workbook
        XLSX.utils.book_append_sheet(wb, ws, "Master Locations");
        
        // Unduh file Excel
        XLSX.writeFile(wb, `master_locations_${getCurrentDate()}.xlsx`);
    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Terjadi kesalahan saat mengunduh data. Silakan coba lagi.");
    }
}

// Fungsi untuk download statistik customer dalam format Excel
function downloadCustomerStats() {
    if (!allLocations || allLocations.length === 0) {
        alert('Tidak ada data untuk membuat statistik customer.');
        return;
    }
    
    try {
        // Hitung statistik customer
        const customerCounts = {};
        
        // Inisialisasi counter untuk setiap customer
        Object.keys(customerColors).forEach(customer => {
            customerCounts[customer] = 0;
        });
        
        // Hitung jumlah lokasi per customer
        allLocations.forEach(location => {
            if (location.isOccupied && location.customerCode) {
                if (customerCounts.hasOwnProperty(location.customerCode)) {
                    customerCounts[location.customerCode]++;
                }
            }
        });
        
        // Persiapkan data untuk Excel
        const excelData = [];
        
        // Tambahkan header row untuk data customer
        excelData.push(["Customer Code", "Occupied Locations"]);
        
        // Tambahkan data customer
        Object.entries(customerCounts).forEach(([customer, count]) => {
            excelData.push([customer, count]);
        });
        
        // Tambahkan statistik ringkasan
        const total = allLocations.length;
        const occupied = allLocations.filter(loc => loc.isOccupied).length;
        const available = total - occupied;
        const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
        
        // Tambahkan baris kosong sebagai pemisah
        excelData.push([]);
        excelData.push(["Summary Statistics"]);
        excelData.push(["Total Locations", total]);
        excelData.push(["Occupied Locations", occupied]);
        excelData.push(["Available Locations", available]);
        excelData.push(["Occupancy Percentage", `${percentage}%`]);
        
        // Buat workbook baru
        const wb = XLSX.utils.book_new();
        
        // Buat worksheet dari data
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Tambahkan worksheet ke workbook
        XLSX.utils.book_append_sheet(wb, ws, "Customer Statistics");
        
        // Unduh file Excel
        XLSX.writeFile(wb, `customer_statistics_${getCurrentDate()}.xlsx`);
    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Terjadi kesalahan saat mengunduh data. Silakan coba lagi.");
    }
}


// Fungsi untuk mendapatkan tanggal saat ini dalam format YYYY-MM-DD
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Handle Master Location Upload (NEW)
function handleMasterLocationUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a master location file first.');
        return;
    }

    const uploadBtn = document.getElementById('uploadMasterBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_URL}/upload-master-locations`, {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        alert(`Master locations uploaded: ${data.rows_processed}`);
        bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
        fileInput.value = '';
        // Optionally reload frontend master locations
        initializeApp();
    })
    .catch(error => {
        alert(`Error uploading master locations: ${error.message}`);
    })
    .finally(() => {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    });
}

// Refresh Data from GitHub
function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const originalHtml = refreshBtn.innerHTML;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

    // Tambahkan loading spinner kecil saat refresh
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'loading-overlay';
    loadingSpinner.innerHTML = `
        <div class="spinner-container">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2">Menyegarkan data...</p>
        </div>
    `;
    document.body.appendChild(loadingSpinner);

    document.getElementById('searchInput').value = '';
    
    // Beri waktu untuk DOM update
    setTimeout(() => {
        initializeApp()
            .finally(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalHtml;
                
                // Hapus loading spinner
                if (document.body.contains(loadingSpinner)) {
                    loadingSpinner.remove();
                }
            });
    }, 100);
}

// FUNGSI BARU: Menampilkan multiple racks pada satu halaman
function displayMultipleRacks(pageNum) {
    currentPage = pageNum;
    
    // Hitung rack mana saja yang akan ditampilkan pada halaman ini
    const startRackIndex = (pageNum - 1) * RACKS_PER_PAGE;
    const endRackIndex = Math.min(startRackIndex + RACKS_PER_PAGE, allRackPrefixes.length);
    const currentRacks = allRackPrefixes.slice(startRackIndex, endRackIndex);
    
    // Update title untuk menunjukkan rentang rack yang ditampilkan
    const startRack = currentRacks[0];
    const endRack = currentRacks[currentRacks.length - 1];
    document.getElementById('rackAreaTitle').textContent = `Rack Area ${startRack}-${endRack}`;
    
    const rackContainer = document.getElementById('rackDisplayContainer');
    rackContainer.innerHTML = '';
    
    // Buat div container untuk semua racks
    const allRacksContainer = document.createElement('div');
    allRacksContainer.className = 'all-racks-container';
    
    // Loop melalui setiap rack untuk ditampilkan
    currentRacks.forEach(rackPrefix => {
        // Buat container untuk rack ini
        const rackDiv = document.createElement('div');
        rackDiv.className = 'rack-container mb-4';
        
        // Tambah header untuk rack ini
        const rackHeader = document.createElement('h5');
        rackHeader.className = 'rack-title';
        rackHeader.textContent = `Rack ${rackPrefix}`;
        rackDiv.appendChild(rackHeader);
        
        // Dapatkan blok untuk rack ini
        const blocks = getBlocksForRackPrefix(rackPrefix);
        
        // Kita tetap menampilkan hingga 15 blok per rack
        const startBlockIndex = 0;
        const endBlockIndex = Math.min(startBlockIndex + BLOCKS_PER_PAGE, blocks.length);
        const currentBlocks = blocks.slice(startBlockIndex, endBlockIndex);
        
        // Buat tabel untuk rack ini
        const table = document.createElement('table');
        table.className = 'rack-table';
        
        // Buat header tabel
        const headerRow1 = document.createElement('tr');
        const rackHeaderCell = document.createElement('th');
        rackHeaderCell.textContent = 'RACK';
        rackHeaderCell.rowSpan = 1;
        headerRow1.appendChild(rackHeaderCell);

        currentBlocks.forEach(block => {
            const blockHeaderCell = document.createElement('th');
            blockHeaderCell.colSpan = 2;
            blockHeaderCell.textContent = block;
            headerRow1.appendChild(blockHeaderCell);
        });

        const headerRow2 = document.createElement('tr');
        const rackLabel = document.createElement('th');
        rackLabel.textContent = rackPrefix;
        headerRow2.appendChild(rackLabel);
        
        currentBlocks.forEach(() => {
            const col1 = document.createElement('th');
            col1.textContent = '1';
            headerRow2.appendChild(col1);
            const col2 = document.createElement('th');
            col2.textContent = '2';
            headerRow2.appendChild(col2);
        });

        const thead = document.createElement('thead');
        thead.appendChild(headerRow1);
        thead.appendChild(headerRow2);
        table.appendChild(thead);
        
        // Buat body tabel
        const tbody = document.createElement('tbody');
        
        for (let level = 4; level >= 1; level--) {
            const row = document.createElement('tr');
            const levelCell = document.createElement('td');
            levelCell.className = 'level-cell';
            levelCell.textContent = level;
            row.appendChild(levelCell);

            currentBlocks.forEach(block => {
                // Posisi 1
                const pos1Code = `${rackPrefix}-${block}-1-${level}`;
                const pos1Cell = document.createElement('td');
                pos1Cell.className = 'location-cell';
                pos1Cell.setAttribute('data-location', pos1Code);
                pos1Cell.dataset.locationCode = pos1Code; // Store as data attribute

                // Hanya tambahkan event listener jika lokasi tidak diblokir
                if (!blockedLocations.includes(pos1Code)) {
                    pos1Cell.addEventListener('click', function() {
                        showLocationDetails(pos1Code);
                    });
                } else {
                    pos1Cell.classList.add('blocked');
                }

                updateCellAppearance(pos1Cell, pos1Code);
                row.appendChild(pos1Cell);

                // Posisi 2
                const pos2Code = `${rackPrefix}-${block}-2-${level}`;
                const pos2Cell = document.createElement('td');
                pos2Cell.className = 'location-cell';
                pos2Cell.setAttribute('data-location', pos2Code);
                pos2Cell.dataset.locationCode = pos2Code; // Store as data attribute
                
                // Hanya tambahkan event listener jika lokasi tidak diblokir
                if (!blockedLocations.includes(pos2Code)) {
                    pos2Cell.addEventListener('click', function() {
                        showLocationDetails(pos2Code);
                    });
                } else {
                    pos2Cell.classList.add('blocked');
                }

                updateCellAppearance(pos2Cell, pos2Code);
                row.appendChild(pos2Cell);
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        rackDiv.appendChild(table);
        allRacksContainer.appendChild(rackDiv);
    });
    
    rackContainer.appendChild(allRacksContainer);
    
    // Update paginasi
    const totalPages = Math.ceil(allRackPrefixes.length / RACKS_PER_PAGE);
    updatePaginationInfo(currentPage, totalPages);
    
    document.getElementById('highRackArea').style.display = 'block';
    document.getElementById('floorArea').style.display = 'none';
    
    // Highlight tombol rack yang sedang aktif
    document.querySelectorAll('.rack-area-btn').forEach(btn => {
        const btnRack = btn.textContent;
        btn.classList.toggle('active', currentRacks.includes(btnRack));
    });
}

function updateCellAppearance(cell, locationCode) {
    // Check if location is in blocked list
    if (blockedLocations.includes(locationCode)) {
        cell.classList.add('blocked');
        return;
    }
    
    // Get location data - check for mapped GA location first
    let locationData = locationCache[locationCode];
    
    // Jika ini adalah lokasi GA dan tidak ada data, coba cek format dengan NG
    if (!locationData && locationCode.startsWith('GA-') && locationMapping[locationCode]) {
        const ngLocationCode = locationMapping[locationCode];
        // Cek apakah ada data untuk format NG
        for (const loc of allLocations) {
            if (loc.locationCode === ngLocationCode) {
                locationData = loc;
                break;
            }
        }
    }

    if (locationData && locationData.isOccupied) {
        cell.classList.add('occupied');
        
        // Cek jika lokasi memiliki multiple items
        if (locationData.items && locationData.items.length > 1) {
            // Terapkan style untuk mixed parts
            cell.style.backgroundColor = customerColors['MIXED PARTS'];
            cell.classList.add('mixed-parts');
            
            // Tambahkan tooltip untuk menunjukkan jumlah part
            const partCount = locationData.items.length;
            cell.setAttribute('title', `${partCount} different parts in this location`);
            
            // Buat container untuk indikator tanpa menghapus event listener yang ada
            const container = document.createElement('div');
            container.className = 'mix-indicator-container';
            container.innerHTML = `<span class="mix-indicator">${partCount}</span>`;
            
            // Hapus konten yang ada, tapi jaga event listener
            while (cell.firstChild) {
                cell.removeChild(cell.firstChild);
            }
            
            // Tambahkan container ke cell
            cell.appendChild(container);
            
        } else if (locationData.customerCode && customerColors[locationData.customerCode]) {
            // Style regular untuk customer code tunggal
            cell.style.backgroundColor = customerColors[locationData.customerCode];
            cell.classList.add(`customer-${locationData.customerCode.replace(/\s+/g, '-').toLowerCase()}`);
        }
        else if (locationData.status) {
            cell.classList.add(`status-${locationData.status}`);
        }
    } else {
        cell.classList.add('available');
    }
}

// Display Floor Area 
function displayFloorArea(floorPrefix) {
    currentRackPrefix = floorPrefix;
    currentPage = 1;
    
    document.getElementById('floorAreaTitle').textContent = `Floor Area ${floorPrefix}`;
    const floorContainer = document.getElementById('floorDisplayContainer');
    floorContainer.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'floor-table';

    // Create header row
    const headerRow = document.createElement('tr');
    const floorHeaderCell = document.createElement('th');
    floorHeaderCell.textContent = floorPrefix;
    headerRow.appendChild(floorHeaderCell);
    
    // Determine columns for area Y
    let colStart = 1, colEnd = 1;
    if (floorPrefix === 'Y') {
        colStart = 6; // Start at 06
        colEnd = 14;  // End at 14
    } else if (floorPrefix === 'A') {
        colStart = 1;
        colEnd = 27;
    } else {
        colStart = 1;
        colEnd = 21;
    }

    // Add column headers
    for (let col = colStart; col <= colEnd; col++) {
        const colHeaderCell = document.createElement('th');
        colHeaderCell.textContent = col.toString().padStart(2, '0');
        headerRow.appendChild(colHeaderCell);
    }

    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create rows
    const tbody = document.createElement('tbody');
    
    let rowStart = 1, rowEnd = 15;
    // For area Y, rows 1-15
    if (floorPrefix === 'Y') {
        rowStart = 1;
        rowEnd = 15;
    } else if (floorPrefix === 'A') {
        rowStart = 1;
        rowEnd = 14;
    }

    for (let row = rowStart; row <= rowEnd; row++) {
        const rowFormatted = row.toString().padStart(2, '0');
        const tableRow = document.createElement('tr');
        const rowCell = document.createElement('td');
        rowCell.className = 'block-cell';
        rowCell.textContent = rowFormatted;
        tableRow.appendChild(rowCell);

        // Add cells for each column
        for (let col = colStart; col <= colEnd; col++) {
            const colFormatted = col.toString().padStart(2, '0');
            
            // Construct location code based on the format in your data
            let locationCode;
            if (floorPrefix === 'Y') {
                // For Area Y, format is Y06-01, Y07-02, etc.
                locationCode = `Y${colFormatted}-${rowFormatted}`;
            } else {
                // For Area A, format is A-22-01, A-23-02, etc. (column-row)
                locationCode = `${floorPrefix}-${colFormatted}-${rowFormatted}`;
            }
            
            const locationCell = document.createElement('td');
            locationCell.className = 'location-cell';
            locationCell.setAttribute('data-location', locationCode);
            locationCell.dataset.locationCode = locationCode; // Store as data attribute
            locationCell.addEventListener('click', function() {
                showLocationDetails(locationCode);
            });
            updateCellAppearance(locationCell, locationCode);
            tableRow.appendChild(locationCell);
        }
        
        tbody.appendChild(tableRow);
    }
    
    table.appendChild(tbody);
    floorContainer.appendChild(table);

    // Single page pagination since we're showing all at once
    updatePaginationInfo(1, 1);

    document.getElementById('highRackArea').style.display = 'none';
    document.getElementById('floorArea').style.display = 'block';
}

function inspectLoadedData() {
    // Periksa lokasi area A
    const aLocations = allLocations.filter(loc => loc.locationCode.startsWith('A-'));
    
    // Periksa khusus kolom A-22 sampai A-27 dengan format yang benar (A-column-row)
    for (let col = 22; col <= 27; col++) {
        for (let row = 1; row <= 14; row++) {
            const loc = `A-${col.toString().padStart(2, '0')}-${row.toString().padStart(2, '0')}`;
            const found = locationCache[loc] !== undefined;
        }
    }
    
    // Periksa lokasi area Y
    const yLocations = allLocations.filter(loc => loc.locationCode.startsWith('Y'));
    if (yLocations.length > 0) {
    }
}   

// Get Blocks for Rack Prefix
function getBlocksForRackPrefix(rackPrefix) {
    const blockSet = new Set();
    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        if (locationCode.startsWith(`${rackPrefix}-`)) {
            const match = locationCode.match(/^[A-Z]{2}-(\d{2})-\d-\d$/);
            if (match) blockSet.add(match[1]);
        }
    });
    return Array.from(blockSet).sort((a, b) => parseInt(a) - parseInt(b));
}

// Get Blocks for Floor Prefix
function getBlocksForFloorPrefix(floorPrefix) {
    const blockSet = new Set();
    
    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        
        // Format khusus untuk area Y
        if (floorPrefix === 'Y' && locationCode.startsWith('Y')) {
            const match = locationCode.match(/^Y(\d{2})-\d{2}$/);
            if (match) {
                blockSet.add(match[1]);
            }
        } 
        // Format untuk area A dan lainnya: A-blok-posisi
        else if (locationCode.startsWith(`${floorPrefix}-`)) {
            const match = locationCode.match(/^[A-Z]-(\d{2})-\d{2}$/);
            if (match) {
                blockSet.add(match[1]);
            }
        }
    });
    
    return Array.from(blockSet).sort((a, b) => parseInt(a) - parseInt(b));
}

function showLocationDetails(locationCode) {
    console.log(`Showing details for location: ${locationCode}`);
    
    // Periksa apakah lokasi diblokir
    if (blockedLocations.includes(locationCode)) {
        return;
    }
    
    // Bersihkan modal sebelum menunjukkannya
    cleanupModalBeforeShow();
    
    // Ambil data lokasi dengan cara yang lebih aman
    let locationData = locationCache[locationCode];
    
    // Jika ini adalah lokasi GA dengan format NG
    if (!locationData && locationCode.startsWith('GA-') && locationMapping[locationCode]) {
        const ngLocationCode = locationMapping[locationCode];
        locationData = locationCache[ngLocationCode];
    }
    
    // Header modal
    document.getElementById('locationCode').textContent = locationCode;
    
    // Modal body
    const modalBody = document.getElementById('modalContent');
    modalBody.innerHTML = '';
    
    // Jika lokasi tidak ditemukan atau kosong
    if (!locationData || !locationData.isOccupied) {
        // Tampilkan status available
        const statusDiv = document.createElement('div');
        statusDiv.className = 'detail-item';
        statusDiv.innerHTML = `
            <div class="detail-label">Status:</div>
            <div class="detail-value text-success">Available</div>
        `;
        modalBody.appendChild(statusDiv);
    } else {
        // Jika lokasi memiliki multiple item
        if (locationData.items && locationData.items.length > 0) {
            const items = locationData.items;
            
            // Tampilkan jumlah item di lokasi ini
            const itemCountDiv = document.createElement('div');
            itemCountDiv.className = 'alert alert-info mb-3';
            itemCountDiv.innerHTML = `<strong>${items.length} item${items.length > 1 ? 's' : ''} found</strong> in this location`;
            modalBody.appendChild(itemCountDiv);
            
            // Untuk setiap item, buat accordion
            const accordionDiv = document.createElement('div');
            accordionDiv.className = 'accordion';
            accordionDiv.id = 'itemsAccordion';
            
            items.forEach((item, index) => {
                const accordionItem = document.createElement('div');
                accordionItem.className = 'accordion-item';
                
                // Header accordion
                const headerId = `heading${index}`;
                const headerDiv = document.createElement('h2');
                headerDiv.className = 'accordion-header';
                headerDiv.id = headerId;
                
                const button = document.createElement('button');
                button.className = 'accordion-button' + (index === 0 ? '' : ' collapsed');
                button.type = 'button';
                button.setAttribute('data-bs-toggle', 'collapse');
                button.setAttribute('data-bs-target', `#collapse${index}`);
                button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
                button.setAttribute('aria-controls', `collapse${index}`);
                button.innerHTML = `
                    <span class="fw-bold">${item.partNo}</span>
                    <span class="ms-2 text-muted small">${item.productDescription}</span>
                `;
                headerDiv.appendChild(button);
                accordionItem.appendChild(headerDiv);
                
                // Content accordion
                const collapseDiv = document.createElement('div');
                collapseDiv.id = `collapse${index}`;
                collapseDiv.className = 'accordion-collapse collapse' + (index === 0 ? ' show' : '');
                collapseDiv.setAttribute('aria-labelledby', headerId);
                collapseDiv.setAttribute('data-bs-parent', '#itemsAccordion');
                
                const bodyDiv = document.createElement('div');
                bodyDiv.className = 'accordion-body';
                bodyDiv.innerHTML = `
                    <div class="detail-item">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value ${getStatusClass(item.status)}">${item.status || 'Occupied'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Part No:</div>
                        <div class="detail-value">${item.partNo || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Product Description:</div>
                        <div class="detail-value">${item.productDescription || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Invoice No:</div>
                        <div class="detail-value">${item.invoiceNo || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Lot No:</div>
                        <div class="detail-value">${item.lotNo || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Receive Date:</div>
                        <div class="detail-value">${item.receiveDate ? formatExcelDate(item.receiveDate) : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Quantity:</div>
                        <div class="detail-value">${item.quantity ? formatNumber(item.quantity) : '0'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Customer Code:</div>
                        <div class="detail-value">${item.customerCode || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">UID Count:</div>
                        <div class="detail-value">${item.uidCount ? formatNumber(item.uidCount) : '0'}</div>
                    </div>
                `;
                collapseDiv.appendChild(bodyDiv);
                accordionItem.appendChild(collapseDiv);
                
                accordionDiv.appendChild(accordionItem);
            });
            
            modalBody.appendChild(accordionDiv);
        } else {
            // Fallback ke tampilan lama jika tidak ada array items
            const detailsHTML = `
                <div class="detail-item">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value ${getStatusClass(locationData.status)}">${locationData.status || 'Occupied'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Part No:</div>
                    <div class="detail-value">${locationData.partNo || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Product Description:</div>
                    <div class="detail-value">${locationData.productDescription || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Invoice No:</div>
                    <div class="detail-value">${locationData.invoiceNo || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Lot No:</div>
                    <div class="detail-value">${locationData.lotNo || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Receive Date:</div>
                    <div class="detail-value">${locationData.receiveDate ? formatExcelDate(locationData.receiveDate) : '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Quantity:</div>
                    <div class="detail-value">${locationData.quantity ? formatNumber(locationData.quantity) : '0'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Customer Code:</div>
                    <div class="detail-value">${locationData.customerCode || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">UID Count:</div>
                    <div class="detail-value">${locationData.uidCount ? formatNumber(locationData.uidCount) : '0'}</div>
                </div>
            `;
            modalBody.innerHTML = detailsHTML;
        }
    }
    
    // Tampilkan modal
    const locationModal = document.getElementById('locationModal');
    const bsModal = new bootstrap.Modal(locationModal);
    
    // Tambahkan event handler khusus untuk modal ini
    locationModal.addEventListener('hidden.bs.modal', handleModalHidden, { once: true });
    
    // Tampilkan modal
    bsModal.show();
}

// Fungsi untuk membersihkan modal sebelum ditampilkan
function cleanupModalBeforeShow() {
    // Hapus semua backdrop modal yang mungkin tersisa
    const existingBackdrops = document.querySelectorAll('.modal-backdrop');
    existingBackdrops.forEach(backdrop => {
        try {
            document.body.removeChild(backdrop);
        } catch (e) {
            console.log('Backdrop already removed:', e);
        }
    });
    
    // Reset status body
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    
    // Pastikan pointer-events semua cell berfungsi
    document.querySelectorAll('.location-cell').forEach(cell => {
        cell.style.pointerEvents = 'auto';
    });
}

// Fungsi untuk menangani modal tertutup
function handleModalHidden() {
    console.log('Modal hidden handler triggered');
    
    // Hapus semua backdrop modal yang tersisa
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => {
        try {
            backdrop.parentNode.removeChild(backdrop);
        } catch (e) {
            console.log('Backdrop removal error:', e);
        }
    });
    
    // Reset body class dan style
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    
    // Pastikan semua cell dapat diinteraksi
    document.querySelectorAll('.location-cell').forEach(cell => {
        cell.style.pointerEvents = 'auto';
    });
    
    console.log('Modal cleanup complete');
}

// Fungsi helper untuk menentukan class status
function getStatusClass(status) {
    if (!status) return 'text-secondary';
    
    switch(status.toLowerCase()) {
        case 'putaway':
            return 'text-primary';
        case 'allocated':
            return 'text-warning';
        case 'hold':
            return 'text-danger';
        default:
            return 'text-secondary';
    }
}

// Update Statistics
function updateStatistics() {
    const total = allLocations.length;
    let occupied = 0;
    allLocations.forEach(location => {
        if (location.isOccupied) occupied++;
    });
    const available = total - occupied;
    const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

    document.getElementById('totalLocations').textContent = formatNumber(total);
    document.getElementById('occupiedLocations').textContent = formatNumber(occupied);
    document.getElementById('availableLocations').textContent = formatNumber(available);
    document.getElementById('occupancyPercentage').textContent = `${percentage}%`;
}

// Fungsi untuk menghitung dan menampilkan statistik customer
function updateCustomerStatistics() {
    // Object untuk menyimpan jumlah lokasi per customer
    const customerCounts = {
        'PL AUTO': 0,
        'PL AUTO 2': 0,
        'SC-2': 0,
        'T-TEC': 0,
        'TTI-PP': 0,
        'TTI-AIM': 0,
        'TTI-MACHINERY': 0
    };
    
    // Hitung jumlah lokasi yang digunakan oleh setiap customer
    allLocations.forEach(location => {
        if (location.isOccupied && location.customerCode) {
            if (customerCounts.hasOwnProperty(location.customerCode)) {
                customerCounts[location.customerCode]++;
            }
        }
    });
    
    // Update nilai pada tampilan
    document.getElementById('plAutoCount').textContent = formatNumber(customerCounts['PL AUTO']);
    document.getElementById('plAuto2Count').textContent = formatNumber(customerCounts['PL AUTO 2']);
    document.getElementById('sc2Count').textContent = formatNumber(customerCounts['SC-2']);
    document.getElementById('tTecCount').textContent = formatNumber(customerCounts['T-TEC']);
    document.getElementById('ttiPpCount').textContent = formatNumber(customerCounts['TTI-PP']);
    document.getElementById('ttiMachineryCount').textContent = formatNumber(customerCounts['TTI-MACHINERY']);
    // Pastikan elemen dengan ID ini ada di HTML sebelum mengakses
    const ttiAimCountElement = document.getElementById('ttiAimCount');
    if (ttiAimCountElement) {
        ttiAimCountElement.textContent = formatNumber(customerCounts['TTI-AIM']);
    }
}

// Update Pagination Information
function updatePaginationInfo(current, total) {
    document.getElementById('currentPage').textContent = current;
    document.getElementById('totalPages').textContent = total;
    document.getElementById('prevPage').disabled = current <= 1;
    document.getElementById('nextPage').disabled = current >= total;
}

// Change Page (DIMODIFIKASI)
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;
    
    // Jika di area high rack, gunakan displayMultipleRacks
    if (document.getElementById('highRackArea').style.display !== 'none') {
        const totalPages = Math.ceil(allRackPrefixes.length / RACKS_PER_PAGE);
        if (newPage > totalPages) return;
        currentPage = newPage;
        displayMultipleRacks(currentPage);
    } 
    // Jika di area floor, gunakan displayFloorArea
    else {
        currentPage = newPage;
        const activeFloorPrefix = document.querySelector('.rack-area-btn.active')?.textContent;
        if (activeFloorPrefix && window.rackPrefixes.floor.includes(activeFloorPrefix)) {
            displayFloorArea(activeFloorPrefix);
        }
    }
}

// Toggle Area View
function toggleAreaView(areaToShow, buttons) {
    buttons.forEach(btn => {
        if (btn.getAttribute('data-area') === areaToShow) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const areas = ['highRackArea', 'floorArea'];
    areas.forEach(area => {
        const element = document.getElementById(area);
        if (area === areaToShow) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });

    const activeAreaBtn = document.querySelector('.rack-area-btn.active');
    if (activeAreaBtn) {
        const prefix = activeAreaBtn.textContent;
        if (areaToShow === 'highRackArea' && window.rackPrefixes.highRack.includes(prefix)) {
            // Tampilkan halaman yang berisi rack yang dipilih (DIUBAH)
            const rackIndex = allRackPrefixes.indexOf(prefix);
            const pageNum = Math.floor(rackIndex / RACKS_PER_PAGE) + 1;
            displayMultipleRacks(pageNum);
        } else if (areaToShow === 'floorArea' && window.rackPrefixes.floor.includes(prefix)) {
            displayFloorArea(prefix);
        } else {
            if (areaToShow === 'highRackArea' && window.rackPrefixes.highRack.length > 0) {
                displayMultipleRacks(1); // Mulai dari halaman 1 (DIUBAH)
                document.querySelectorAll('.rack-area-btn').forEach(btn => {
                    // Highlight tombol yang aktif di halaman 1
                    const rackPrefix = btn.textContent;
                    const rackIndex = allRackPrefixes.indexOf(rackPrefix);
                    btn.classList.toggle('active', rackIndex >= 0 && rackIndex < RACKS_PER_PAGE);
                });
            } else if (areaToShow === 'floorArea' && window.rackPrefixes.floor.length > 0) {
                displayFloorArea(window.rackPrefixes.floor[0]);
                document.querySelectorAll('.rack-area-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.textContent === window.rackPrefixes.floor[0]);
                });
            }
        }
    }
}

// Handle Search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();

    if (searchTerm === '') {
        // Reset ke tampilan normal jika search field kosong
        if (document.getElementById('highRackArea').style.display !== 'none') {
            displayMultipleRacks(currentPage); // Kembali ke halaman rack saat ini (DIUBAH)
        } else {
            const activeFloorPrefix = document.querySelector('.rack-area-btn.active')?.textContent;
            if (activeFloorPrefix && window.rackPrefixes.floor.includes(activeFloorPrefix)) {
                displayFloorArea(activeFloorPrefix);
            }
        }
        return;
    }

    const results = allLocations.filter(loc =>
        loc.locationCode.toUpperCase().includes(searchTerm) ||
        (loc.partNo && loc.partNo.toUpperCase().includes(searchTerm)) ||
        (loc.productDescription && loc.productDescription.toUpperCase().includes(searchTerm)) ||
        (loc.invoiceNo && loc.invoiceNo.toUpperCase().includes(searchTerm)) ||
        (loc.customerCode && loc.customerCode.toUpperCase().includes(searchTerm))
    );

    displaySearchResults(results);
}

// Display Search Results
function displaySearchResults(results) {
    const isHighRackVisible = document.getElementById('highRackArea').style.display !== 'none';
    const container = isHighRackVisible ?
        document.getElementById('rackDisplayContainer') :
        document.getElementById('floorDisplayContainer');

    container.innerHTML = '';

    const header = document.createElement('h5');
    header.className = 'mb-3';
    header.textContent = `Search Results (${results.length} found)`;
    container.appendChild(header);

    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'alert alert-info';
        noResults.textContent = 'No locations found matching your search.';
        container.appendChild(noResults);
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }

    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'search-results-grid';
    container.appendChild(resultsGrid);

    const totalPages = Math.ceil(results.length / 30);
    const startIndex = (currentPage - 1) * 30;
    const endIndex = Math.min(startIndex + 30, results.length);
    const currentResults = results.slice(startIndex, endIndex);

    currentResults.forEach(location => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.classList.add(location.isOccupied ? 'occupied' : 'available');
        resultItem.addEventListener('click', () => showLocationDetails(location.locationCode));
        if (location.customerCode && customerColors[location.customerCode]) {
            resultItem.style.borderLeftColor = customerColors[location.customerCode];
        }

        const locationCode = document.createElement('div');
        locationCode.className = 'result-location-code';
        locationCode.textContent = location.locationCode;
        resultItem.appendChild(locationCode);

        const locationStatus = document.createElement('div');
        locationStatus.className = 'result-status';
        locationStatus.textContent = location.isOccupied ?
            (location.status ? location.status.charAt(0).toUpperCase() + location.status.slice(1) : 'Occupied') :
            'Available';
        resultItem.appendChild(locationStatus);

        if (location.customerCode) {
            const customerInfo = document.createElement('div');
            customerInfo.className = 'result-customer-info';
            customerInfo.textContent = location.customerCode;
            resultItem.appendChild(customerInfo);
        }

        if (location.isOccupied && location.partNo) {
            const partInfo = document.createElement('div');
            partInfo.className = 'result-part-info';
            partInfo.textContent = location.partNo;
            resultItem.appendChild(partInfo);
        }

        resultsGrid.appendChild(resultItem);
    });

    updatePaginationInfo(currentPage, totalPages);
    document.getElementById('paginationControls').style.display = 'flex';
}

// Format Excel Date Number to DD-MMM-YYYY
function formatExcelDate(excelDate) {
    if (typeof excelDate === 'string' && excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = excelDate.split('-').map(num => parseInt(num, 10));
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day.toString().padStart(2, '0')}-${months[month-1]}-${year}`;
    }
    if (typeof excelDate === 'string' && excelDate.includes('/')) {
        const parts = excelDate.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            const date = new Date(year, month, day);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDay = day.toString().padStart(2, '0');
            const formattedMonth = months[month];
            return `${formattedDay}-${formattedMonth}-${year}`;
        }
        return excelDate;
    }
    const excelEpoch = new Date(1899, 11, 30);
    const days = parseInt(excelDate, 10);
    if (isNaN(days)) return excelDate;
    const milliseconds = days * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + milliseconds);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Format Number with Thousand Separator
function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
}