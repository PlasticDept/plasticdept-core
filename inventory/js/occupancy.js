// Configuration and Global Variables
const API_URL = 'https://157.66.55.46:8000'; // Base URL to your FastAPI backend
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

// Customer code colors
const customerColors = {
  'PL AUTO': '#FFD580', // Light Orange
  'PL AUTO 2': '#FFA500', // Orange
  'SC-2': '#90EE90', // Light Green
  'T-TEC': '#87CEEB', // Sky Blue
  'TTI-PP': '#E6E6FA', // Lavender
  'TTI-MACHINERY': '#FFC0CB' // Pink
};

document.addEventListener('DOMContentLoaded', function() {
    updateCustomerLegend();
    initializeApp();

    document.getElementById('uploadMasterBtn').addEventListener('click', handleMasterLocationUpload);
    document.getElementById('uploadOccupancyBtn').addEventListener('click', handleFileUpload);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));

    const areaButtons = document.querySelectorAll('.rack-selector .btn');
    areaButtons.forEach(button => {
        button.addEventListener('click', function() {
            const area = this.getAttribute('data-area');
            toggleAreaView(area, areaButtons);
        });
    });
});

// Initialize Application
async function initializeApp() {
    try {
        showLoading(true);

        await loadMasterLocations();      // 1. Load master locations
        await loadOccupancyData();        // 2. Load occupancy data
        mergeOccupancyWithMaster();       // 3. Merge occupancy with master for UI

        analyzeLocationStructure();
        generateRackAreaButtons();

        if (allRackPrefixes.length > 0) {
            displayRackArea(allRackPrefixes[0]);
        }

        updateStatistics();
        showLoading(false);
    } catch (error) {
        console.error("Error initializing app:", error);
        alert("Failed to initialize application. Please try again.");
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show) {
    document.body.style.cursor = show ? 'wait' : 'default';
}

// Update the legend container with customer codes
function updateCustomerLegend() {
    const legendContainer = document.querySelector('.legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    const availableSpan = document.createElement('span');
    availableSpan.className = 'legend-item';
    availableSpan.innerHTML = `<span class="legend-color available"></span> Available`;
    legendContainer.appendChild(availableSpan);

    Object.keys(customerColors).forEach(customer => {
        const span = document.createElement('span');
        span.className = 'legend-item ms-3';
        span.innerHTML = `<span class="legend-color customer-${customer.replace(/\s+/g, '-').toLowerCase()}" style="background-color: ${customerColors[customer]}"></span> ${customer}`;
        legendContainer.appendChild(span);
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

function mergeOccupancyWithMaster() {
    const occupancyLookup = {};
    occupancyData.forEach(occ => {
        // Coba semua kemungkinan nama properti untuk lokasi
        const code = occ.Location || occ.locationCode || occ.location || occ["Location Code"];
        if (code) occupancyLookup[code] = occ;
    });

    allLocations = masterLocations.map(loc => {
        const code = loc.locationCode;
        if (occupancyLookup[code]) {
            // Mapping field dari occupancy.json ke JS
            const occ = occupancyLookup[code];
            return {
                ...loc,
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
            };
        } else {
            // Kosong
            return {
                ...loc,
                isOccupied: false,
                partNo: "",
                productDescription: "",
                invoiceNo: "",
                lotNo: "",
                receiveDate: "",
                status: "",
                quantity: 0,
                customerCode: "",
                uidCount: 0
            };
        }
    });

    locationCache = {};
    allLocations.forEach(loc => {
        locationCache[loc.locationCode] = loc;
    });
    
    // Panggil inspeksi data setelah merging
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
            displayRackArea(prefix);
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

    document.getElementById('searchInput').value = '';
    initializeApp();

    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalHtml;
}

// Display Rack Area
function displayRackArea(rackPrefix) {
    currentRackPrefix = rackPrefix;
    currentPage = 1;

    const blocks = getBlocksForRackPrefix(rackPrefix);
    const startIndex = (currentPage - 1) * BLOCKS_PER_PAGE;
    const endIndex = Math.min(startIndex + BLOCKS_PER_PAGE, blocks.length);
    const currentBlocks = blocks.slice(startIndex, endIndex);

    document.getElementById('rackAreaTitle').textContent = `Rack Area ${rackPrefix}`;
    const rackContainer = document.getElementById('rackDisplayContainer');
    rackContainer.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'rack-table';

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

    const tbody = document.createElement('tbody');
    for (let level = 4; level >= 1; level--) {
        const row = document.createElement('tr');
        const levelCell = document.createElement('td');
        levelCell.className = 'level-cell';
        levelCell.textContent = level;
        row.appendChild(levelCell);

        currentBlocks.forEach(block => {
            const pos1Code = `${rackPrefix}-${block}-1-${level}`;
            const pos1Cell = document.createElement('td');
            pos1Cell.className = 'location-cell';
            pos1Cell.setAttribute('data-location', pos1Code);
            pos1Cell.addEventListener('click', () => showLocationDetails(pos1Code));
            updateCellAppearance(pos1Cell, pos1Code);
            row.appendChild(pos1Cell);

            const pos2Code = `${rackPrefix}-${block}-2-${level}`;
            const pos2Cell = document.createElement('td');
            pos2Cell.className = 'location-cell';
            pos2Cell.setAttribute('data-location', pos2Code);
            pos2Cell.addEventListener('click', () => showLocationDetails(pos2Code));
            updateCellAppearance(pos2Cell, pos2Code);
            row.appendChild(pos2Cell);
        });
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    rackContainer.appendChild(table);

    const totalPages = Math.ceil(blocks.length / BLOCKS_PER_PAGE);
    updatePaginationInfo(currentPage, totalPages);

    document.getElementById('highRackArea').style.display = 'block';
    document.getElementById('floorArea').style.display = 'none';
}

// Update cell appearance based on occupancy and customer code
function updateCellAppearance(cell, locationCode) {
    const locationData = locationCache[locationCode];

    if (locationData && locationData.isOccupied) {
        cell.classList.add('occupied');
        if (locationData.customerCode && customerColors[locationData.customerCode]) {
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
    
    // Determine the number of columns based on prefix
    let maxPos;
    
    if (floorPrefix === 'A') {
        maxPos = 27; // Area A has 27 columns
    } else if (floorPrefix === 'Y') {
        maxPos = 14; // Area Y has 14 columns
    } else {
        maxPos = 21; // Default
    }
    
    // Add column headers (01-27 or 01-14)
    for (let col = 1; col <= maxPos; col++) {
        const colHeaderCell = document.createElement('th');
        colHeaderCell.textContent = col.toString().padStart(2, '0');
        headerRow.appendChild(colHeaderCell);
    }

    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create rows (01-14)
    const tbody = document.createElement('tbody');
    for (let row = 1; row <= 14; row++) {
        const rowFormatted = row.toString().padStart(2, '0');
        const tableRow = document.createElement('tr');
        const rowCell = document.createElement('td');
        rowCell.className = 'block-cell';
        rowCell.textContent = rowFormatted;
        tableRow.appendChild(rowCell);

        // Add cells for each column
        for (let col = 1; col <= maxPos; col++) {
            const colFormatted = col.toString().padStart(2, '0');
            
            // Construct location code based on the format in your data
            let locationCode;
            if (floorPrefix === 'Y') {
                // For Area Y, format is Y06-01, Y07-02, etc.
                locationCode = `Y${rowFormatted}-${colFormatted}`;
            } else {
                // For Area A, format is A-22-01, A-23-02, etc. (column-row)
                locationCode = `${floorPrefix}-${colFormatted}-${rowFormatted}`;
            }
            
            const locationCell = document.createElement('td');
            locationCell.className = 'location-cell';
            locationCell.setAttribute('data-location', locationCode);
            locationCell.addEventListener('click', () => showLocationDetails(locationCode));
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

// Show Location Details in Modal
function showLocationDetails(locationCode) {
    const locationData = locationCache[locationCode];
    document.getElementById('locationCode').textContent = locationCode;

    if (locationData && locationData.isOccupied) {
        document.getElementById('locationStatus').textContent = locationData.status ?
            locationData.status.charAt(0).toUpperCase() + locationData.status.slice(1) : 'Occupied';
        document.getElementById('partNo').textContent = locationData.partNo || '-';
        document.getElementById('productDescription').textContent = locationData.productDescription || '-';
        document.getElementById('invoiceNo').textContent = locationData.invoiceNo || '-';
        document.getElementById('lotNo').textContent = locationData.lotNo || '-';
        const receiveDate = locationData.receiveDate ? formatExcelDate(locationData.receiveDate) : '-';
        document.getElementById('receiveDate').textContent = receiveDate;
        const quantity = locationData.quantity ? formatNumber(locationData.quantity) : '0';
        document.getElementById('quantity').textContent = quantity;
        document.getElementById('customerCode').textContent = locationData.customerCode || '-';
        const uidCount = locationData.uidCount ? formatNumber(locationData.uidCount) : '0';
        document.getElementById('uidCount').textContent = uidCount;

        const statusElement = document.getElementById('locationStatus');
        statusElement.className = 'detail-value';
        if (locationData.status === 'putaway') {
            statusElement.classList.add('text-primary');
        } else if (locationData.status === 'allocated') {
            statusElement.classList.add('text-warning');
        } else if (locationData.status === 'hold') {
            statusElement.classList.add('text-danger');
        } else {
            statusElement.classList.add('text-secondary');
        }
    } else {
        document.getElementById('locationStatus').textContent = 'Available';
        document.getElementById('locationStatus').className = 'detail-value text-success';
        ['partNo', 'productDescription', 'invoiceNo', 'lotNo', 'receiveDate', 'quantity',
         'customerCode', 'uidCount'].forEach(id => {
            document.getElementById(id).textContent = '-';
        });
    }

    const locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
    locationModal.show();
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

// Update Pagination Information
function updatePaginationInfo(current, total) {
    document.getElementById('currentPage').textContent = current;
    document.getElementById('totalPages').textContent = total;
    document.getElementById('prevPage').disabled = current <= 1;
    document.getElementById('nextPage').disabled = current >= total;
}

// Change Page
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;
    currentPage = newPage;

    if (document.getElementById('highRackArea').style.display !== 'none') {
        displayRackArea(currentRackPrefix);
    } else {
        displayFloorArea(currentRackPrefix);
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
            displayRackArea(prefix);
        } else if (areaToShow === 'floorArea' && window.rackPrefixes.floor.includes(prefix)) {
            displayFloorArea(prefix);
        } else {
            if (areaToShow === 'highRackArea' && window.rackPrefixes.highRack.length > 0) {
                displayRackArea(window.rackPrefixes.highRack[0]);
                document.querySelectorAll('.rack-area-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.textContent === window.rackPrefixes.highRack[0]);
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
        const activeAreaBtn = document.querySelector('.rack-area-btn.active');
        if (activeAreaBtn) {
            const prefix = activeAreaBtn.textContent;
            if (document.getElementById('highRackArea').style.display !== 'none' &&
                window.rackPrefixes.highRack.includes(prefix)) {
                displayRackArea(prefix);
            } else if (window.rackPrefixes.floor.includes(prefix)) {
                displayFloorArea(prefix);
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