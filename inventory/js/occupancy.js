// Global variables
let occupancyData = {};
let locations = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Set current date and user
    const now = new Date('2025-07-16 14:30:31');
    document.getElementById('currentDate').textContent = now.toLocaleString('id-ID');
    document.getElementById('currentUser').textContent = 'Login: PlasticDept';
    
    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'flex';
    
    try {
        // Fetch data from Supabase
        await fetchOccupancyData();
        
        // Render all areas
        renderAllAreas();
        
        // Setup
        setupModal();
        setupAreaTabs();
        setupSearch();
        setupFileUpload();
        
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Gagal memuat data: " + error.message);
    } finally {
        // Hide loading spinner
        document.getElementById('loadingSpinner').style.display = 'none';
    }
});

// Fetch data from Supabase
async function fetchOccupancyData() {
    try {
        // Menggunakan supabaseClient (bukan supabase)
        let { data, error } = await supabaseClient
            .from('master_location')
            .select('*');
            
        if (error) throw error;
        
        // Proses data seperti biasa...
        occupancyData = {};
        locations = [];
        
        data.forEach(record => {
            const locationId = record.id;
            locations.push(locationId);
            
            occupancyData[locationId] = {
                status: record.status || 'EMPTY',
                flag: record.flag || null,
                partNo: record.part_no || null,
                qty: record.qty || 0,
                receiveDate: record.receive_date || null,
                invoiceNo: record.invoice_no || null
            };
        });
        
        return data;
    } catch (error) {
        console.error("Error fetching data from Supabase:", error);
        throw error;
    }
}

function renderAllAreas() {
    renderAreaTable('A');
    renderAreaTable('DA');
    renderAreaTable('DB');
    renderAreaTable('DC');
    renderAreaTable('DD');
}

// Get all rack numbers in an area
function getRackNumbersInArea(areaCode) {
    const rackNumbers = new Set();
    
    locations.forEach(location => {
        if (location.startsWith(areaCode + '-')) {
            const parts = location.split('-');
            if (parts.length >= 2) {
                const rackNum = parseInt(parts[1]);
                if (!isNaN(rackNum)) {
                    rackNumbers.add(rackNum);
                }
            }
        }
    });
    
    return Array.from(rackNumbers).sort((a, b) => a - b);
}

// Determine cell color based on status
function getStatusColorClass(status) {
    if (!status || status === 'EMPTY') return '';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('available')) return 'customer-available';
    if (statusLower.includes('allocated')) return 'customer-allocated';
    if (statusLower.includes('putaway')) return 'customer-putaway';
    if (statusLower.includes('reserved')) return 'customer-reserved';
    
    return 'customer-available'; // Default
}

// Render area table
function renderAreaTable(areaCode) {
    const container = document.getElementById(`area${areaCode}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Header area
    const areaHeader = document.createElement('h2');
    areaHeader.className = 'area-header';
    areaHeader.textContent = `Area ${areaCode} - High Rack`;
    container.appendChild(areaHeader);
    
    // Get all rack numbers in this area
    const rackNumbers = getRackNumbersInArea(areaCode);
    
    if (rackNumbers.length === 0) {
        const noDataMsg = document.createElement('p');
        noDataMsg.textContent = `Tidak ada data untuk Area ${areaCode}`;
        noDataMsg.style.textAlign = 'center';
        noDataMsg.style.padding = '20px';
        container.appendChild(noDataMsg);
        return;
    }
    
    // Create table for each rack
    const table = document.createElement('table');
    table.className = 'rack-table';
    
    // Header row with rack numbers
    const headerRow = document.createElement('tr');
    headerRow.className = 'rack-table-header';
    
    // Empty cell in top left
    const emptyHeaderCell = document.createElement('th');
    headerRow.appendChild(emptyHeaderCell);
    
    // Header for each rack
    rackNumbers.forEach(rackNum => {
        const rackHeader = document.createElement('th');
        const formattedRackNum = rackNum.toString().padStart(2, '0');
        rackHeader.textContent = `${areaCode}-${formattedRackNum}`;
        headerRow.appendChild(rackHeader);
    });
    
    table.appendChild(headerRow);
    
    // For area A: create rows for level 01 to 21 (from top to bottom)
    if (areaCode === 'A') {
        for (let level = 21; level >= 1; level--) {
            const levelRow = document.createElement('tr');
            
            // Level label
            const levelLabel = document.createElement('td');
            levelLabel.className = 'stack-label';
            levelLabel.textContent = `Level ${level.toString().padStart(2, '0')}`;
            levelRow.appendChild(levelLabel);
            
            // Cells for each rack
            rackNumbers.forEach(rackNum => {
                const cell = document.createElement('td');
                const formattedRackNum = rackNum.toString().padStart(2, '0');
                const formattedLevel = level.toString().padStart(2, '0');
                
                const locationCode = `${areaCode}-${formattedRackNum}-${formattedLevel}`;
                const locationDiv = document.createElement('div');
                locationDiv.className = 'location-cell';
                locationDiv.textContent = formattedLevel;
                locationDiv.dataset.location = locationCode;
                
                // Check if location exists in data
                if (locations.includes(locationCode)) {
                    const locationData = occupancyData[locationCode];
                    
                    if (locationData && locationData.status !== 'EMPTY') {
                        locationDiv.classList.add('occupied');
                        locationDiv.classList.add(getStatusColorClass(locationData.status));
                    }
                    
                    locationDiv.addEventListener('click', function() {
                        showLocationDetails(locationCode);
                    });
                } else {
                    // Location not available
                    locationDiv.style.opacity = '0.3';
                    locationDiv.style.cursor = 'default';
                }
                
                cell.appendChild(locationDiv);
                levelRow.appendChild(cell);
            });
            
            table.appendChild(levelRow);
        }
    }
    // For other areas: create rows for stack 4, 3, 2, 1 (from top to bottom)
    else {
        for (let stack = 4; stack >= 1; stack--) {
            const stackRow = document.createElement('tr');
            
            // Stack label
            const stackLabel = document.createElement('td');
            stackLabel.className = 'stack-label';
            stackLabel.textContent = `Stack ${stack}`;
            stackRow.appendChild(stackLabel);
            
            // Cells for each rack
            rackNumbers.forEach(rackNum => {
                const cell = document.createElement('td');
                const formattedRackNum = rackNum.toString().padStart(2, '0');
                
                // There are 2 levels for each stack (1 & 2)
                const cellContent = document.createElement('div');
                cellContent.className = 'location-cell-container';
                cellContent.style.display = 'grid';
                cellContent.style.gridTemplateColumns = '1fr 1fr';
                cellContent.style.gap = '3px';
                cellContent.style.height = '100%';
                
                for (let level = 1; level <= 2; level++) {
                    const locationCode = `${areaCode}-${formattedRackNum}-${level}-${stack}`;
                    const locationDiv = document.createElement('div');
                    locationDiv.className = 'location-cell';
                    locationDiv.textContent = `${level}-${stack}`;
                    locationDiv.dataset.location = locationCode;
                    
                    // Check if location exists
                    if (locations.includes(locationCode)) {
                        const locationData = occupancyData[locationCode];
                        
                        if (locationData && locationData.status !== 'EMPTY') {
                            locationDiv.classList.add('occupied');
                            locationDiv.classList.add(getStatusColorClass(locationData.status));
                        }
                        
                        locationDiv.addEventListener('click', function() {
                            showLocationDetails(locationCode);
                        });
                    } else {
                        // Location not available
                        locationDiv.style.opacity = '0.3';
                        locationDiv.style.cursor = 'default';
                    }
                    
                    cellContent.appendChild(locationDiv);
                }
                
                cell.appendChild(cellContent);
                stackRow.appendChild(cell);
            });
            
            table.appendChild(stackRow);
        }
    }
    
    container.appendChild(table);
}

// Show location details in modal
function showLocationDetails(locationCode) {
    const locationData = occupancyData[locationCode];
    
    if (!locationData) return; // Exit if no data
    
    const modal = document.getElementById('detailModal');
    
    document.getElementById('locationTitle').textContent = `Detail Lokasi: ${locationCode}`;
    document.getElementById('locationCode').textContent = locationCode;
    
    if (locationData.status === 'EMPTY') {
        document.getElementById('locationStatus').textContent = 'Kosong';
        document.getElementById('locationFlag').textContent = '-';
        document.getElementById('partNo').textContent = '-';
        document.getElementById('materialQty').textContent = '-';
        document.getElementById('invoiceNo').textContent = '-';
        document.getElementById('receivedDate').textContent = '-';
    } else {
        document.getElementById('locationStatus').textContent = locationData.status || 'Kosong';
        document.getElementById('locationFlag').textContent = locationData.flag || '-';
        document.getElementById('partNo').textContent = locationData.partNo || '-';
        document.getElementById('materialQty').textContent = locationData.qty || '0';
        document.getElementById('invoiceNo').textContent = locationData.invoiceNo || '-';
        document.getElementById('receivedDate').textContent = formatDate(locationData.receiveDate);
    }
    
    modal.classList.add('active');
}

// Setup modal functions
function setupModal() {
    const modal = document.getElementById('detailModal');
    const closeButton = document.querySelector('.close-button');
    
    closeButton.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Setup area tabs
function setupAreaTabs() {
    const areaTabs = document.querySelectorAll('.area-tab');
    
    areaTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            areaTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Get area code
            const areaCode = this.dataset.area;
            
            // Hide all area views
            document.querySelectorAll('.area-view').forEach(view => {
                view.style.display = 'none';
            });
            
            // Show selected area view
            document.getElementById(`area${areaCode}`).style.display = 'block';
        });
    });
}

// Format date to Indonesian locale
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
}

// Search for location or part number
function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();
    
    if (searchTerm === '') return;
    
    // Reset all highlights
    const allLocations = document.querySelectorAll('.location-cell');
    allLocations.forEach(location => {
        location.classList.remove('highlighted');
    });
    
    // Search for matching location or part no
    let found = false;
    let foundArea = null;
    
    allLocations.forEach(location => {
        if (!location.dataset.location) return;
        
        const locationCode = location.dataset.location;
        const locationData = occupancyData[locationCode];
        
        // Check if matches location code
        if (locationCode.includes(searchTerm)) {
            highlightLocation(location);
            found = true;
            foundArea = locationCode.split('-')[0];
        } 
        // Check if matches part number
        else if (locationData && 
                locationData.partNo && 
                locationData.partNo.toUpperCase().includes(searchTerm)) {
            highlightLocation(location);
            found = true;
            foundArea = locationCode.split('-')[0];
        }
    });
    
    if (found && foundArea) {
        // Activate tab for found area
        document.querySelectorAll('.area-tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.area === foundArea) {
                btn.classList.add('active');
            }
        });
        
        // Show found area
        document.querySelectorAll('.area-view').forEach(view => {
            view.style.display = 'none';
            if (view.id === `area${foundArea}`) {
                view.style.display = 'block';
            }
        });
    }
    
    if (!found) {
        alert('Tidak ditemukan lokasi atau part number yang sesuai dengan pencarian');
    }
}

// Highlight found location
function highlightLocation(location) {
    location.classList.add('highlighted');
    location.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Setup file upload
function setupFileUpload() {
    const fileInput = document.getElementById('excelFileInput');
    const fileName = document.getElementById('fileName');
    const uploadButton = document.getElementById('uploadButton');
    const progressBar = document.getElementById('progressBar');
    const uploadProgress = document.getElementById('uploadProgress');
    
    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        
        if (file) {
            fileName.textContent = file.name;
            uploadButton.disabled = false;
        } else {
            fileName.textContent = 'Belum ada file dipilih';
            uploadButton.disabled = true;
        }
    });
    
    uploadButton.addEventListener('click', async function() {
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Pilih file terlebih dahulu');
            return;
        }
        
        try {
            // Show progress bar
            uploadProgress.style.display = 'block';
            progressBar.style.width = '10%';
            
            // Process file
            const data = await readExcelFile(file);
            progressBar.style.width = '50%';
            
            // Upload to Supabase
            const result = await processAndUploadData(data);
            progressBar.style.width = '100%';
            
            // Show success message
            alert(`Berhasil memperbarui ${result.success} data. Gagal: ${result.failed}`);
            
            // Refresh data
            await fetchOccupancyData();
            renderAllAreas();
            
            // Reset file input
            fileInput.value = '';
            fileName.textContent = 'Belum ada file dipilih';
            uploadButton.disabled = true;
            
        } catch (error) {
            console.error("Error uploading file:", error);
            alert('Gagal memproses file: ' + error.message);
        } finally {
            // Hide progress bar after a delay
            setTimeout(() => {
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0';
            }, 1000);
        }
    });
}

// Read Excel or CSV file
async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                let jsonData;
                
                // Check if file is CSV or Excel
                if (file.name.endsWith('.csv')) {
                    // Parse CSV
                    const parsedData = XLSX.read(data, { type: 'binary' });
                    const sheetName = parsedData.SheetNames[0];
                    jsonData = XLSX.utils.sheet_to_json(parsedData.Sheets[sheetName], {
                        header: ['location', 'status', 'flag', 'part_no', 'receive_date', 'invoice_no', 'total']
                    });
                    
                    // Remove header row if exists
                    if (jsonData.length > 0 && 
                        jsonData[0].location === 'Location' || 
                        jsonData[0].location.toLowerCase() === 'location') {
                        jsonData.shift();
                    }
                } else {
                    // Parse Excel
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
                        raw: false
                    });
                }
                
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

// Process and upload data to Supabase
async function processAndUploadData(data) {
    let success = 0;
    let failed = 0;
    
    const batchSize = 50; // Batch size for updates
    
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const updates = [];
        
        batch.forEach(item => {
            // Extract location - this is the primary key/id
            const location = item.Location || item.location;
            if (!location) {
                failed++;
                return;
            }
            
            const locationId = location.trim();
            
            // Check if this is a valid location code
            if (!locationId) {
                failed++;
                return;
            }
            
            // Prepare data for update
            const updateData = {
                id: locationId,
                status: (item.Status || item.status || 'EMPTY').toUpperCase(),
                flag: item.Flag || item.flag || null,
                part_no: item['Part No'] || item.part_no || null,
                receive_date: item['Received Date'] || item.receive_date || null,
                invoice_no: item['Invoice No'] || item.invoice_no || null,
                qty: item.Total || item.total || 0
            };
            
            updates.push(updateData);
        });
        
        if (updates.length > 0) {
            try {
                // Use upsert - insert if not exists, update if exists
                const { data: result, error } = await supabaseClient
                    .from('master_location')
                    .upsert(updates)
                    .select();
                
                if (error) {
                    console.error("Error updating batch:", error);
                    failed += updates.length;
                } else {
                    success += data.length;
                    failed += (updates.length - data.length);
                }
            } catch (error) {
                console.error("Exception in batch update:", error);
                failed += updates.length;
            }
        }
    }
    
    return { success, failed };
}