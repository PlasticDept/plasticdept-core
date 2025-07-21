// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDw17I5NwibE9BXl0YoILPQqoPQfCKH4Q",
  authDomain: "inbound-d8267.firebaseapp.com",
  databaseURL: "https://inbound-d8267-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "inbound-d8267",
  storageBucket: "inbound-d8267.firebasestorage.app",
  messagingSenderId: "852665126418",
  appId: "1:852665126418:web:e4f029b83995e29f3052cb"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Global variables
const BLOCKS_PER_PAGE = 15; // Number of rack columns to display per page
let allLocations = []; // Store all master locations
let currentPage = 1; // Current page for pagination
let currentArea = "highRackArea"; // Current selected area
let allRackPrefixes = []; // All available rack prefixes (DA, DB, DC, etc.)
let currentRackPrefix = ""; // Current selected rack prefix for high rack areas
let locationCache = {}; // Cache for location data

// Main App
document.addEventListener('DOMContentLoaded', function() {
    // Initialize application
    initializeApp();
    
    // Event listeners
    document.getElementById('uploadMasterBtn').addEventListener('click', handleMasterLocationUpload);
    document.getElementById('uploadOccupancyBtn').addEventListener('click', handleFileUpload);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
    
    // Setup area selector buttons
    const areaButtons = document.querySelectorAll('.rack-selector .btn');
    areaButtons.forEach(button => {
        button.addEventListener('click', function() {
            const area = this.getAttribute('data-area');
            toggleAreaView(area, areaButtons);
        });
    });
});

// Initialize Application
function initializeApp() {
    // Load all locations and analyze structure
    loadMasterLocations().then(() => {
        // After loading master locations, initialize rack sections
        analyzeLocationStructure();
        generateRackAreaButtons();
        
        // Show the first rack prefix by default if available
        if (allRackPrefixes.length > 0) {
            displayRackArea(allRackPrefixes[0]);
        }
        
        // Update statistics
        updateStatistics();
    });
}

// Load Master Locations from Firebase
async function loadMasterLocations() {
    try {
        const querySnapshot = await db.collection('locations').get();
        allLocations = [];
        
        querySnapshot.forEach((doc) => {
            const locationData = doc.data();
            allLocations.push({
                locationCode: doc.id,
                ...locationData
            });
            
            // Cache the location data
            locationCache[doc.id] = locationData;
        });
        
        // Sort locations by code
        allLocations.sort((a, b) => a.locationCode.localeCompare(b.locationCode));
        
        return allLocations;
    } catch (error) {
        console.error("Error loading master locations: ", error);
        alert("Gagal memuat data master lokasi. Silakan coba lagi.");
        return [];
    }
}

// Analyze Location Structure to Identify Rack Types
function analyzeLocationStructure() {
    // Extract unique rack prefixes (DA, DB, etc.)
    const highRackPrefixes = new Set();
    const floorPrefixes = new Set();
    
    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        
        // High rack format: XX-NN-C-L (e.g. DA-01-1-1)
        if (/^[A-Z]{2}-\d{2}-\d-\d$/.test(locationCode)) {
            const prefix = locationCode.substring(0, 2);
            highRackPrefixes.add(prefix);
        }
        // Floor format: X-NN-NN (e.g. A-01-01)
        else if (/^[A-Z]-\d{2}-\d{2}$/.test(locationCode)) {
            const prefix = locationCode.substring(0, 1);
            floorPrefixes.add(prefix);
        }
    });
    
    // Convert sets to sorted arrays
    allRackPrefixes = Array.from(highRackPrefixes).sort();
    const allFloorPrefixes = Array.from(floorPrefixes).sort();
    
    // Store these for later use
    window.rackPrefixes = {
        highRack: allRackPrefixes,
        floor: allFloorPrefixes
    };
}

// Generate Rack Area Buttons
function generateRackAreaButtons() {
    const rackAreaButtonsContainer = document.getElementById('rackAreaButtons');
    rackAreaButtonsContainer.innerHTML = '';
    
    // Create buttons for all rack prefixes
    window.rackPrefixes.highRack.forEach(prefix => {
        const button = document.createElement('button');
        button.className = 'rack-area-btn';
        button.textContent = prefix;
        button.addEventListener('click', () => {
            // Deactivate all buttons
            document.querySelectorAll('.rack-area-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Activate this button
            button.classList.add('active');
            // Display the selected rack area
            displayRackArea(prefix);
        });
        rackAreaButtonsContainer.appendChild(button);
    });
    
    // Create buttons for floor areas
    window.rackPrefixes.floor.forEach(prefix => {
        const button = document.createElement('button');
        button.className = 'rack-area-btn';
        button.textContent = prefix;
        button.addEventListener('click', () => {
            // Deactivate all buttons
            document.querySelectorAll('.rack-area-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Activate this button
            button.classList.add('active');
            // Display the selected floor area
            displayFloorArea(prefix);
        });
        rackAreaButtonsContainer.appendChild(button);
    });
    
    // Activate the first button by default
    if (rackAreaButtonsContainer.children.length > 0) {
        rackAreaButtonsContainer.children[0].classList.add('active');
    }
}

// Display Rack Area
function displayRackArea(rackPrefix) {
    currentRackPrefix = rackPrefix;
    currentPage = 1; // Reset to first page
    
    // Get all blocks for this rack prefix
    const blocks = getBlocksForRackPrefix(rackPrefix);
    
    // Determine block range for current page
    const startIndex = (currentPage - 1) * BLOCKS_PER_PAGE;
    const endIndex = Math.min(startIndex + BLOCKS_PER_PAGE, blocks.length);
    const currentBlocks = blocks.slice(startIndex, endIndex);
    
    // Update the rack area title
    document.getElementById('rackAreaTitle').textContent = `Rack Area ${rackPrefix}`;
    
    // Clear the rack display container
    const rackContainer = document.getElementById('rackDisplayContainer');
    rackContainer.innerHTML = '';
    
    // Create the table structure
    const table = document.createElement('table');
    table.className = 'rack-table';
    
    // Create header row with block numbers
    const headerRow1 = document.createElement('tr');
    const rackHeaderCell = document.createElement('th');
    rackHeaderCell.textContent = 'RACK';
    rackHeaderCell.rowSpan = 1;
    headerRow1.appendChild(rackHeaderCell);
    
    // Add block number headers
    currentBlocks.forEach(block => {
        const blockHeaderCell = document.createElement('th');
        blockHeaderCell.colSpan = 2;
        blockHeaderCell.textContent = block;
        headerRow1.appendChild(blockHeaderCell);
    });
    
    // Add sub-header row with column numbers (1 and 2)
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
    
    // Create the table head and append header rows
    const thead = document.createElement('thead');
    thead.appendChild(headerRow1);
    thead.appendChild(headerRow2);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Generate rows for levels 4 down to 1
    for (let level = 4; level >= 1; level--) {
        const row = document.createElement('tr');
        
        // Add level number
        const levelCell = document.createElement('td');
        levelCell.className = 'level-cell';
        levelCell.textContent = level;
        row.appendChild(levelCell);
        
        // Add cells for each block's positions
        currentBlocks.forEach(block => {
            // Position 1
            const pos1Code = `${rackPrefix}-${block}-1-${level}`;
            const pos1Cell = document.createElement('td');
            pos1Cell.className = 'location-cell';
            pos1Cell.setAttribute('data-location', pos1Code);
            pos1Cell.addEventListener('click', () => showLocationDetails(pos1Code));
            
            // Update cell appearance based on occupancy
            if (locationCache[pos1Code] && locationCache[pos1Code].isOccupied) {
                pos1Cell.classList.add('occupied');
                if (locationCache[pos1Code].status) {
                    pos1Cell.classList.add(`status-${locationCache[pos1Code].status}`);
                }
            } else {
                pos1Cell.classList.add('available');
            }
            
            row.appendChild(pos1Cell);
            
            // Position 2
            const pos2Code = `${rackPrefix}-${block}-2-${level}`;
            const pos2Cell = document.createElement('td');
            pos2Cell.className = 'location-cell';
            pos2Cell.setAttribute('data-location', pos2Code);
            pos2Cell.addEventListener('click', () => showLocationDetails(pos2Code));
            
            // Update cell appearance based on occupancy
            if (locationCache[pos2Code] && locationCache[pos2Code].isOccupied) {
                pos2Cell.classList.add('occupied');
                if (locationCache[pos2Code].status) {
                    pos2Cell.classList.add(`status-${locationCache[pos2Code].status}`);
                }
            } else {
                pos2Cell.classList.add('available');
            }
            
            row.appendChild(pos2Cell);
        });
        
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    rackContainer.appendChild(table);
    
    // Update pagination info
    const totalPages = Math.ceil(blocks.length / BLOCKS_PER_PAGE);
    updatePaginationInfo(currentPage, totalPages);
    
    // Show high rack area, hide floor area
    document.getElementById('highRackArea').style.display = 'block';
    document.getElementById('floorArea').style.display = 'none';
}

// Display Floor Area
function displayFloorArea(floorPrefix) {
    currentRackPrefix = floorPrefix;
    currentPage = 1; // Reset to first page
    
    // Get all blocks for this floor prefix
    const blocks = getBlocksForFloorPrefix(floorPrefix);
    
    // Update the rack area title
    document.getElementById('floorAreaTitle').textContent = `Floor Area ${floorPrefix}`;
    
    // Clear the floor display container
    const floorContainer = document.getElementById('floorDisplayContainer');
    floorContainer.innerHTML = '';
    
    // Determine block range for current page
    const startIndex = (currentPage - 1) * 10; // Show fewer blocks per page for floor area
    const endIndex = Math.min(startIndex + 10, blocks.length);
    const currentBlocks = blocks.slice(startIndex, endIndex);
    
    // Create the table structure
    const table = document.createElement('table');
    table.className = 'floor-table';
    
    // Create header row with position numbers
    const headerRow = document.createElement('tr');
    const floorHeaderCell = document.createElement('th');
    floorHeaderCell.textContent = floorPrefix;
    headerRow.appendChild(floorHeaderCell);
    
    // Add position numbers 01-21
    for (let i = 1; i <= 21; i++) {
        const posHeaderCell = document.createElement('th');
        posHeaderCell.textContent = i.toString().padStart(2, '0');
        headerRow.appendChild(posHeaderCell);
    }
    
    // Create the table head
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Create row for each block
    currentBlocks.forEach(block => {
        const row = document.createElement('tr');
        
        // Add block number
        const blockCell = document.createElement('td');
        blockCell.className = 'block-cell';
        blockCell.textContent = block;
        row.appendChild(blockCell);
        
        // Add cells for each position
        for (let pos = 1; pos <= 21; pos++) {
            const posFormatted = pos.toString().padStart(2, '0');
            const locationCode = `${floorPrefix}-${block}-${posFormatted}`;
            
            const locationCell = document.createElement('td');
            locationCell.className = 'location-cell';
            locationCell.setAttribute('data-location', locationCode);
            locationCell.addEventListener('click', () => showLocationDetails(locationCode));
            
            // Update cell appearance based on occupancy
            if (locationCache[locationCode] && locationCache[locationCode].isOccupied) {
                locationCell.classList.add('occupied');
                if (locationCache[locationCode].status) {
                    locationCell.classList.add(`status-${locationCache[locationCode].status}`);
                }
            } else {
                locationCell.classList.add('available');
            }
            
            row.appendChild(locationCell);
        }
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    floorContainer.appendChild(table);
    
    // Update pagination info
    const totalPages = Math.ceil(blocks.length / 10);
    updatePaginationInfo(currentPage, totalPages);
    
    // Show floor area, hide high rack area
    document.getElementById('highRackArea').style.display = 'none';
    document.getElementById('floorArea').style.display = 'block';
}

// Get Blocks for Rack Prefix
function getBlocksForRackPrefix(rackPrefix) {
    // Extract all unique block numbers for this rack prefix
    const blockSet = new Set();
    
    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        
        // Match high rack format: XX-NN-C-L (e.g. DA-01-1-1)
        if (locationCode.startsWith(`${rackPrefix}-`)) {
            const match = locationCode.match(/^[A-Z]{2}-(\d{2})-\d-\d$/);
            if (match) {
                blockSet.add(match[1]);
            }
        }
    });
    
    // Convert to sorted array
    return Array.from(blockSet).sort((a, b) => parseInt(a) - parseInt(b));
}

// Get Blocks for Floor Prefix
function getBlocksForFloorPrefix(floorPrefix) {
    // Extract all unique block numbers for this floor prefix
    const blockSet = new Set();
    
    allLocations.forEach(location => {
        const locationCode = location.locationCode;
        
        // Match floor format: X-NN-NN (e.g. A-01-01)
        if (locationCode.startsWith(`${floorPrefix}-`)) {
            const match = locationCode.match(/^[A-Z]-(\d{2})-\d{2}$/);
            if (match) {
                blockSet.add(match[1]);
            }
        }
    });
    
    // Convert to sorted array
    return Array.from(blockSet).sort((a, b) => parseInt(a) - parseInt(b));
}

// Update Pagination Information
function updatePaginationInfo(current, total) {
    document.getElementById('currentPage').textContent = current;
    document.getElementById('totalPages').textContent = total;
    
    // Enable/disable pagination buttons
    document.getElementById('prevPage').disabled = current <= 1;
    document.getElementById('nextPage').disabled = current >= total;
}

// Change Page
function changePage(direction) {
    const newPage = currentPage + direction;
    
    if (newPage < 1) return;
    
    currentPage = newPage;
    
    // Re-render current view
    if (document.getElementById('highRackArea').style.display !== 'none') {
        displayRackArea(currentRackPrefix);
    } else {
        displayFloorArea(currentRackPrefix);
    }
}

// Show Location Details in Modal
function showLocationDetails(locationCode) {
    // Get location data from Firebase or cache
    const getLocationData = async () => {
        if (locationCache[locationCode]) {
            return locationCache[locationCode];
        } else {
            const doc = await db.collection('locations').doc(locationCode).get();
            if (doc.exists) {
                locationCache[locationCode] = doc.data();
                return doc.data();
            }
            return null;
        }
    };
    
    getLocationData().then(data => {
        // Populate modal with data
        document.getElementById('locationCode').textContent = locationCode;
        
        if (data && data.isOccupied) {
            // Format status
            document.getElementById('locationStatus').textContent = data.status ? 
                data.status.charAt(0).toUpperCase() + data.status.slice(1) : 'Occupied';
                
            // Format part number
            document.getElementById('partNo').textContent = data.partNo || '-';
            
            // Format product description (new field)
            document.getElementById('productDescription').textContent = data.productDescription || '-';
            
            // Format invoice number
            document.getElementById('invoiceNo').textContent = data.invoiceNo || '-';
            
            // Format lot number
            document.getElementById('lotNo').textContent = data.lotNo || '-';
            
            // Format receive date (Excel numeric date to DD-MMM-YYYY)
            const receiveDate = data.receiveDate ? formatExcelDate(data.receiveDate) : '-';
            document.getElementById('receiveDate').textContent = receiveDate;
            
            // Format quantity with thousand separator
            const quantity = data.quantity ? formatNumber(data.quantity) : '0';
            document.getElementById('quantity').textContent = quantity;
            
            // Format customer code
            document.getElementById('customerCode').textContent = data.customerCode || '-';
            
            // Format UID count with thousand separator if needed
            const uidCount = data.uidCount ? formatNumber(data.uidCount) : '0';
            document.getElementById('uidCount').textContent = uidCount;
            
            // Style the status based on its value
            const statusElement = document.getElementById('locationStatus');
            statusElement.className = 'detail-value';
            
            if (data.status === 'putaway') {
                statusElement.classList.add('text-primary');
            } else if (data.status === 'allocated') {
                statusElement.classList.add('text-warning');
            } else if (data.status === 'hold') {
                statusElement.classList.add('text-danger');
            } else {
                statusElement.classList.add('text-secondary');
            }
        } else {
            // If no detailed data exists, show basic info
            document.getElementById('locationStatus').textContent = 'Available';
            document.getElementById('locationStatus').className = 'detail-value text-success';
            
            // Reset other fields
            ['partNo', 'productDescription', 'invoiceNo', 'lotNo', 'receiveDate', 'quantity', 
             'customerCode', 'uidCount'].forEach(id => {
                document.getElementById(id).textContent = '-';
            });
        }
        
        // Show the modal
        const locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
        locationModal.show();
    }).catch(error => {
        console.error("Error getting location details: ", error);
        alert("Gagal memuat detail lokasi. Silakan coba lagi.");
    });
}

// Format Excel Date Number to DD-MMM-YYYY
function formatExcelDate(excelDate) {
    // Check if the date is already in a formatted string
    if (typeof excelDate === 'string' && excelDate.includes('/')) {
        // Parse date in MM/DD/YYYY format
        const parts = excelDate.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1; // JavaScript months are 0-based
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            
            const date = new Date(year, month, day);
            
            // Format to DD-MMM-YYYY
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDay = day.toString().padStart(2, '0');
            const formattedMonth = months[month];
            
            return `${formattedDay}-${formattedMonth}-${year}`;
        }
        return excelDate;
    }
    
    // Excel's epoch starts on 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    const days = parseInt(excelDate, 10);
    
    // Check if it's a valid number
    if (isNaN(days)) {
        return excelDate; // Return the original value if not a number
    }
    
    // Convert Excel date to JavaScript Date
    const milliseconds = days * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + milliseconds);
    
    // Format to DD-MMM-YYYY
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

// Toggle Area View
function toggleAreaView(areaToShow, buttons) {
    // Update active button
    buttons.forEach(btn => {
        if (btn.getAttribute('data-area') === areaToShow) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show selected area, hide others
    const areas = ['highRackArea', 'floorArea'];
    areas.forEach(area => {
        const element = document.getElementById(area);
        if (area === areaToShow) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });
    
    // Re-display current rack/floor based on the active rack-area-btn
    const activeAreaBtn = document.querySelector('.rack-area-btn.active');
    if (activeAreaBtn) {
        const prefix = activeAreaBtn.textContent;
        if (areaToShow === 'highRackArea' && window.rackPrefixes.highRack.includes(prefix)) {
            displayRackArea(prefix);
        } else if (areaToShow === 'floorArea' && window.rackPrefixes.floor.includes(prefix)) {
            displayFloorArea(prefix);
        } else {
            // Default to first available prefix if current is not valid for this area
            if (areaToShow === 'highRackArea' && window.rackPrefixes.highRack.length > 0) {
                displayRackArea(window.rackPrefixes.highRack[0]);
                document.querySelectorAll('.rack-area-btn').forEach(btn => {
                    if (btn.textContent === window.rackPrefixes.highRack[0]) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            } else if (areaToShow === 'floorArea' && window.rackPrefixes.floor.length > 0) {
                displayFloorArea(window.rackPrefixes.floor[0]);
                document.querySelectorAll('.rack-area-btn').forEach(btn => {
                    if (btn.textContent === window.rackPrefixes.floor[0]) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        }
    }
}

// Handle Search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();
    
    if (searchTerm === '') {
        // If search is cleared, revert to normal view
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
    
    // Find matching locations
    const results = allLocations.filter(loc => 
        loc.locationCode.toUpperCase().includes(searchTerm) ||
        (loc.partNo && loc.partNo.toUpperCase().includes(searchTerm)) ||
        (loc.productDescription && loc.productDescription.toUpperCase().includes(searchTerm)) ||
        (loc.invoiceNo && loc.invoiceNo.toUpperCase().includes(searchTerm)) ||
        (loc.customerCode && loc.customerCode.toUpperCase().includes(searchTerm))
    );
    
    // Display results
    displaySearchResults(results);
}

// Display Search Results
function displaySearchResults(results) {
    // Determine which container to use based on current view
    const isHighRackVisible = document.getElementById('highRackArea').style.display !== 'none';
    const container = isHighRackVisible ? 
        document.getElementById('rackDisplayContainer') : 
        document.getElementById('floorDisplayContainer');
    
    // Clear container
    container.innerHTML = '';
    
    // Create results header
    const header = document.createElement('h5');
    header.className = 'mb-3';
    header.textContent = `Search Results (${results.length} found)`;
    container.appendChild(header);
    
    // If no results
    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'alert alert-info';
        noResults.textContent = 'No locations found matching your search.';
        container.appendChild(noResults);
        
        // Hide pagination for search results
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }
    
    // Create results grid
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'search-results-grid';
    container.appendChild(resultsGrid);
    
    // Calculate pagination for results
    const totalPages = Math.ceil(results.length / 30);
    const startIndex = (currentPage - 1) * 30;
    const endIndex = Math.min(startIndex + 30, results.length);
    const currentResults = results.slice(startIndex, endIndex);
    
    // Create results list
    currentResults.forEach(location => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.classList.add(location.isOccupied ? 'occupied' : 'available');
        resultItem.addEventListener('click', () => showLocationDetails(location.locationCode));
        
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
        
        if (location.isOccupied && location.partNo) {
            const partInfo = document.createElement('div');
            partInfo.className = 'result-part-info';
            partInfo.textContent = location.partNo;
            resultItem.appendChild(partInfo);
        }
        
        resultsGrid.appendChild(resultItem);
    });
    
    // Update pagination for search results
    updatePaginationInfo(currentPage, totalPages);
    document.getElementById('paginationControls').style.display = 'flex';
}

// Handle File Upload
function handleFileUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];

    if (!file) {
        alert('Silakan pilih file occupancy terlebih dahulu.');
        return;
    }

    const uploadBtn = document.getElementById('uploadOccupancyBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        processUploadedData(jsonData)
            .then(() => {
                bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                fileInput.value = '';
                alert('Data occupancy berhasil diupload dan diproses!');
                loadMasterLocations().then(() => {
                    // Re-render current view
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
                    updateStatistics();
                });
            })
            .catch(error => {
                console.error("Error processing uploaded data:", error);
                alert('Terjadi kesalahan saat memproses data occupancy. Silakan coba lagi.');
            })
            .finally(() => {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = originalText;
            });
    };
    reader.readAsArrayBuffer(file);
}

// Fungsi Upload Master Lokasi CSV
function handleMasterLocationUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Silakan pilih file master lokasi CSV terlebih dahulu.');
        return;
    }

    const uploadBtn = document.getElementById('uploadMasterBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    const reader = new FileReader();
    reader.onload = function(e) {
        let csv = e.target.result;
        // Normalize line endings
        csv = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

        // Ambil index kolom "Location" dari header
        const header = lines[0].split(',');
        const locationIdx = header.findIndex(h => h.trim().toLowerCase() === 'location');
        if (locationIdx === -1) {
            alert('File CSV tidak valid! Pastikan ada header "Location"');
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
            return;
        }

        // Batch Firestore untuk efisiensi
        const batch = db.batch();
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            const locationCode = cols[locationIdx]?.replace(/['"]+/g, '').trim();
            if (locationCode) {
                const docRef = db.collection('locations').doc(locationCode);
                batch.set(docRef, {
                    locationCode,
                    isOccupied: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                count++;
            }
        }

        batch.commit().then(() => {
            alert(`Master lokasi berhasil diupload! Total lokasi: ${count}`);
            fileInput.value = '';
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
            bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
            
            // Reload application to incorporate new master data
            initializeApp();
        }).catch(err => {
            alert('Upload gagal: ' + err.message);
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
        });
    };
    reader.readAsText(file);
}

// Process Uploaded Data
async function processUploadedData(data) {
    // Get all master locations first to check against
    const locationsSnapshot = await db.collection('locations').get();
    const masterLocations = {};
    
    locationsSnapshot.forEach(doc => {
        masterLocations[doc.id] = true;
    });
    
    // Batch write to Firestore
    const batch = db.batch();
    
    // Process each row
    data.forEach(row => {
        // Check if location exists in the master data
        const locationCode = row.Location || row.location || row.LOCATION;
        
        if (locationCode && masterLocations[locationCode]) {
            const locationRef = db.collection('locations').doc(locationCode);
            
            // Prepare location data
            const locationData = {
                locationCode: locationCode,
                isOccupied: true,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                partNo: row.PartNo || row.partNo || row['Part No'] || '',
                productDescription: row.ProductDescription || row['Product Description'] || row.Description || '',
                invoiceNo: row.InvoiceNo || row.invoiceNo || row['Invoice No'] || '',
                lotNo: row.LotNo || row.lotNo || row['Lot No'] || row['Lot No.'] || '', // Added "Lot No." with period
                receiveDate: row.ReceiveDate || row.receiveDate || row['Receive Date'] || row['Received Date'] || '',
                status: row.Status || row.status || 'putaway',
                quantity: parseInt(row.Quantity || row.quantity || row.QTY || row.Qty || '0', 10),
                customerCode: row.CustomerCode || row.customerCode || row['Customer Code'] || '',
                uidCount: parseInt(row.UIDCount || row.uidCount || row.UID || '0', 10)
            };
            
            batch.set(locationRef, locationData, { merge: true });
            
            // Update cache
            locationCache[locationCode] = locationData;
        }
    });
    
    // Commit the batch
    return batch.commit();
}

// Refresh Data
function refreshData() {
    // Show loading state
    const refreshBtn = document.getElementById('refreshBtn');
    const originalHtml = refreshBtn.innerHTML;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    
    // Clear search
    document.getElementById('searchInput').value = '';
    
    // Reload locations data
    loadMasterLocations()
        .then(() => {
            // Re-render current view
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
            updateStatistics();
        })
        .catch(error => {
            console.error("Error refreshing data:", error);
            alert('Terjadi kesalahan saat memuat ulang data. Silakan coba lagi.');
        })
        .finally(() => {
            // Reset button state
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalHtml;
        });
}

// Update Statistics
function updateStatistics() {
    db.collection('locations').get()
        .then((querySnapshot) => {
            const total = querySnapshot.size;
            let occupied = 0;
            
            querySnapshot.forEach((doc) => {
                if (doc.data().isOccupied) {
                    occupied++;
                }
            });
            
            const available = total - occupied;
            const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
            
            // Update UI
            document.getElementById('totalLocations').textContent = formatNumber(total);
            document.getElementById('occupiedLocations').textContent = formatNumber(occupied);
            document.getElementById('availableLocations').textContent = formatNumber(available);
            document.getElementById('occupancyPercentage').textContent = `${percentage}%`;
        })
        .catch((error) => {
            console.error("Error calculating statistics: ", error);
        });
}