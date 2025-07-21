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
const LOCATIONS_PER_PAGE = 13; // Number of rack columns per page
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
        generateRackNavigation();
        
        // Show the first rack prefix by default
        if (allRackPrefixes.length > 0) {
            showRackSection(allRackPrefixes[0]);
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

// Generate Rack Navigation based on Analysis
function generateRackNavigation() {
    const highRackNav = document.getElementById('highRackNavigation');
    const floorNav = document.getElementById('floorNavigation');
    
    // Clear existing navigation
    highRackNav.innerHTML = '';
    floorNav.innerHTML = '';
    
    // Generate high rack navigation
    window.rackPrefixes.highRack.forEach(prefix => {
        const navBtn = document.createElement('button');
        navBtn.className = 'btn btn-outline-secondary me-2 mb-2';
        navBtn.textContent = prefix;
        navBtn.addEventListener('click', () => showRackSection(prefix));
        highRackNav.appendChild(navBtn);
    });
    
    // Generate floor navigation
    window.rackPrefixes.floor.forEach(prefix => {
        const navBtn = document.createElement('button');
        navBtn.className = 'btn btn-outline-secondary me-2 mb-2';
        navBtn.textContent = prefix;
        navBtn.addEventListener('click', () => showFloorSection(prefix));
        floorNav.appendChild(navBtn);
    });
    
    // Show pagination controls if there are rack sections
    if (window.rackPrefixes.highRack.length > 0 || window.rackPrefixes.floor.length > 0) {
        document.getElementById('paginationControls').style.display = 'flex';
    }
}

// Show High Rack Section
function showRackSection(rackPrefix) {
    currentRackPrefix = rackPrefix;
    currentPage = 1; // Reset to first page
    
    // Highlight the selected rack button
    const rackButtons = document.querySelectorAll('#highRackNavigation button');
    rackButtons.forEach(btn => {
        if (btn.textContent === rackPrefix) {
            btn.classList.add('active');
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-secondary');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }
    });
    
    // Get all blocks for this rack prefix
    const blocks = getBlocksForRackPrefix(rackPrefix);
    
    // Clear existing sections
    const container = document.getElementById('highRackContainer');
    container.innerHTML = '';
    
    // Create section title
    const sectionTitle = document.createElement('h5');
    sectionTitle.className = 'mb-3';
    sectionTitle.textContent = `Rack Area ${rackPrefix}`;
    container.appendChild(sectionTitle);
    
    // Determine block range for current page
    const startIndex = (currentPage - 1) * LOCATIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + LOCATIONS_PER_PAGE, blocks.length);
    const currentBlocks = blocks.slice(startIndex, endIndex);
    
    // Generate grid for current blocks
    const rackGrid = document.createElement('div');
    rackGrid.className = 'rack-grid';
    rackGrid.id = `section-${rackPrefix}`;
    container.appendChild(rackGrid);
    
    // Generate high rack grid
    generateGrid(rackGrid, rackPrefix, currentBlocks);
    
    // Update pagination info
    updatePaginationInfo(currentPage, Math.ceil(blocks.length / LOCATIONS_PER_PAGE));
}

// Show Floor Section
function showFloorSection(floorPrefix) {
    currentRackPrefix = floorPrefix;
    currentPage = 1; // Reset to first page
    
    // Highlight the selected floor button
    const floorButtons = document.querySelectorAll('#floorNavigation button');
    floorButtons.forEach(btn => {
        if (btn.textContent === floorPrefix) {
            btn.classList.add('active');
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-secondary');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }
    });
    
    // Get all blocks for this floor prefix
    const blocks = getBlocksForFloorPrefix(floorPrefix);
    
    // Clear existing sections
    const container = document.getElementById('floorContainer');
    container.innerHTML = '';
    
    // Create section title
    const sectionTitle = document.createElement('h5');
    sectionTitle.className = 'mb-3';
    sectionTitle.textContent = `Floor Area ${floorPrefix}`;
    container.appendChild(sectionTitle);
    
    // Determine block range for current page
    const startIndex = (currentPage - 1) * LOCATIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + LOCATIONS_PER_PAGE, blocks.length);
    const currentBlocks = blocks.slice(startIndex, endIndex);
    
    // Generate grid for current blocks
    const floorGrid = document.createElement('div');
    floorGrid.className = 'rack-grid';
    floorGrid.id = `section-${floorPrefix}`;
    container.appendChild(floorGrid);
    
    // Generate floor grid
    generateFloorGrid(floorGrid, floorPrefix, currentBlocks);
    
    // Update pagination info
    updatePaginationInfo(currentPage, Math.ceil(blocks.length / LOCATIONS_PER_PAGE));
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

// Generate High Rack Grid
function generateGrid(container, rackPrefix, blocks) {
    // Clear container
    container.innerHTML = '';
    
    // Create grid header
    const headerRow = document.createElement('div');
    headerRow.className = 'rack-header-row';
    container.appendChild(headerRow);
    
    // Add rack label
    const rackLabel = document.createElement('div');
    rackLabel.className = 'rack-label';
    rackLabel.textContent = 'RACK';
    headerRow.appendChild(rackLabel);
    
    // Add column headers
    blocks.forEach(block => {
        const blockHeader = document.createElement('div');
        blockHeader.className = 'block-header';
        blockHeader.textContent = block;
        headerRow.appendChild(blockHeader);
        
        // Add sub-column headers (1, 2)
        const subHeader = document.createElement('div');
        subHeader.className = 'sub-header-row';
        container.appendChild(subHeader);
        
        // Add empty rack label for alignment
        const emptyLabel = document.createElement('div');
        emptyLabel.className = 'rack-label';
        emptyLabel.textContent = rackPrefix;
        subHeader.appendChild(emptyLabel);
        
        // Create sub-columns (1, 2)
        const subColumns = document.createElement('div');
        subColumns.className = 'sub-columns';
        subHeader.appendChild(subColumns);
        
        const subCol1 = document.createElement('div');
        subCol1.className = 'sub-col';
        subCol1.textContent = '1';
        subColumns.appendChild(subCol1);
        
        const subCol2 = document.createElement('div');
        subCol2.className = 'sub-col';
        subCol2.textContent = '2';
        subColumns.appendChild(subCol2);
    });
    
    // Generate rows for levels (4 down to 1)
    for (let level = 4; level >= 1; level--) {
        const levelRow = document.createElement('div');
        levelRow.className = 'rack-row';
        container.appendChild(levelRow);
        
        // Add row label
        const levelLabel = document.createElement('div');
        levelLabel.className = 'rack-level';
        levelLabel.textContent = level;
        levelRow.appendChild(levelLabel);
        
        // Add cells for each block and column
        blocks.forEach(block => {
            const blockCell = document.createElement('div');
            blockCell.className = 'block-cell';
            levelRow.appendChild(blockCell);
            
            // Column 1
            const col1Code = `${rackPrefix}-${block}-1-${level}`;
            const location1 = document.createElement('div');
            location1.className = 'rack-location available';
            location1.setAttribute('data-location', col1Code);
            location1.addEventListener('click', () => showLocationDetails(col1Code));
            blockCell.appendChild(location1);
            
            // Column 2
            const col2Code = `${rackPrefix}-${block}-2-${level}`;
            const location2 = document.createElement('div');
            location2.className = 'rack-location available';
            location2.setAttribute('data-location', col2Code);
            location2.addEventListener('click', () => showLocationDetails(col2Code));
            blockCell.appendChild(location2);
            
            // Update location UI if we have data
            if (locationCache[col1Code]) {
                updateLocationUI(locationCache[col1Code]);
            }
            if (locationCache[col2Code]) {
                updateLocationUI(locationCache[col2Code]);
            }
        });
    }
}

// Generate Floor Area Grid
function generateFloorGrid(container, floorPrefix, blocks) {
    // Clear container
    container.innerHTML = '';
    
    // Create grid header
    const headerRow = document.createElement('div');
    headerRow.className = 'floor-header-row';
    container.appendChild(headerRow);
    
    // Add rack label
    const rackLabel = document.createElement('div');
    rackLabel.className = 'floor-label';
    rackLabel.textContent = floorPrefix;
    headerRow.appendChild(rackLabel);
    
    // Add column headers (1 to 21)
    for (let i = 1; i <= 21; i++) {
        const colHeader = document.createElement('div');
        colHeader.className = 'floor-col-header';
        colHeader.textContent = i.toString().padStart(2, '0');
        headerRow.appendChild(colHeader);
    }
    
    // Generate rows for each block
    blocks.forEach(block => {
        const blockRow = document.createElement('div');
        blockRow.className = 'floor-row';
        container.appendChild(blockRow);
        
        // Add row label
        const blockLabel = document.createElement('div');
        blockLabel.className = 'floor-block';
        blockLabel.textContent = block;
        blockRow.appendChild(blockLabel);
        
        // Add locations for positions 01-21
        for (let pos = 1; pos <= 21; pos++) {
            const posFormatted = pos.toString().padStart(2, '0');
            const locationCode = `${floorPrefix}-${block}-${posFormatted}`;
            
            const locationCell = document.createElement('div');
            locationCell.className = 'floor-location available';
            locationCell.setAttribute('data-location', locationCode);
            locationCell.addEventListener('click', () => showLocationDetails(locationCode));
            blockRow.appendChild(locationCell);
            
            // Update location UI if we have data
            if (locationCache[locationCode]) {
                updateLocationUI(locationCache[locationCode]);
            }
        }
    });
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
    const area = currentArea;
    const newPage = currentPage + direction;
    
    if (newPage < 1) return;
    
    currentPage = newPage;
    
    // Re-render current section with new page
    if (area === 'highRackArea') {
        showRackSection(currentRackPrefix);
    } else {
        showFloorSection(currentRackPrefix);
    }
}

// Update Location UI Based on Data
function updateLocationUI(locationData) {
    if (!locationData || !locationData.locationCode) return;
    
    const locationElements = document.querySelectorAll(`.rack-location[data-location="${locationData.locationCode}"], .floor-location[data-location="${locationData.locationCode}"]`);
    
    locationElements.forEach(element => {
        if (locationData.isOccupied) {
            element.classList.remove('available');
            element.classList.add('occupied');
            
            // Add status indicator if available
            if (locationData.status) {
                element.classList.remove('status-putaway', 'status-allocated', 'status-hold');
                element.classList.add(`status-${locationData.status.toLowerCase()}`);
            }
        } else {
            element.classList.remove('occupied');
            element.classList.add('available');
            element.classList.remove('status-putaway', 'status-allocated', 'status-hold');
        }
    });
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
            ['partNo', 'invoiceNo', 'lotNo', 'receiveDate', 'quantity', 
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
    
    // Update current area
    currentArea = areaToShow;
    
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
    
    // Reset to first page and show first rack type
    currentPage = 1;
    
    if (areaToShow === 'highRackArea' && window.rackPrefixes && window.rackPrefixes.highRack.length > 0) {
        // Select the first rack if none is selected
        if (!currentRackPrefix || !window.rackPrefixes.highRack.includes(currentRackPrefix)) {
            showRackSection(window.rackPrefixes.highRack[0]);
        } else {
            // Re-render the current rack to ensure data is visible
            showRackSection(currentRackPrefix);
        }
    } else if (areaToShow === 'floorArea' && window.rackPrefixes && window.rackPrefixes.floor.length > 0) {
        // Select the first floor if none is selected
        if (!currentRackPrefix || !window.rackPrefixes.floor.includes(currentRackPrefix)) {
            showFloorSection(window.rackPrefixes.floor[0]);
        } else {
            // Re-render the current floor to ensure data is visible
            showFloorSection(currentRackPrefix);
        }
    }
}

// Handle Search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();
    
    if (searchTerm === '') {
        // If search is cleared, revert to normal view
        if (currentArea === 'highRackArea') {
            showRackSection(currentRackPrefix);
        } else {
            showFloorSection(currentRackPrefix);
        }
        return;
    }
    
    // Find matching locations
    const results = allLocations.filter(loc => 
        loc.locationCode.toUpperCase().includes(searchTerm) ||
        (loc.partNo && loc.partNo.toUpperCase().includes(searchTerm)) ||
        (loc.invoiceNo && loc.invoiceNo.toUpperCase().includes(searchTerm)) ||
        (loc.customerCode && loc.customerCode.toUpperCase().includes(searchTerm))
    );
    
    // Display results
    displaySearchResults(results);
}

// Display Search Results
function displaySearchResults(results) {
    // Clear both containers
    const highRackContainer = document.getElementById('highRackContainer');
    const floorContainer = document.getElementById('floorContainer');
    highRackContainer.innerHTML = '';
    floorContainer.innerHTML = '';
    
    // Create results container
    const container = currentArea === 'highRackArea' ? highRackContainer : floorContainer;
    
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
                    if (currentArea === 'highRackArea') {
                        showRackSection(currentRackPrefix);
                    } else {
                        showFloorSection(currentRackPrefix);
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
                invoiceNo: row.InvoiceNo || row.invoiceNo || row['Invoice No'] || '',
                lotNo: row.LotNo || row.lotNo || row['Lot No'] || '',
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
            if (currentArea === 'highRackArea') {
                showRackSection(currentRackPrefix);
            } else {
                showFloorSection(currentRackPrefix);
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