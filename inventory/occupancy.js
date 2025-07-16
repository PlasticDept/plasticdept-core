document.addEventListener('DOMContentLoaded', function() {
    // Mengatur waktu dan user saat ini
    document.getElementById('currentDate').textContent = '2025-07-11 10:05:09';
    document.getElementById('currentUser').textContent = 'Login: PlasticDept';
    
    // Render semua area dengan format tabel modern
    renderAllAreas();
    
    // Setup modal
    setupModal();
    
    // Setup area selector
    setupAreaTabs();
    
    // Setup search functionality
    setupSearch();
});

function renderAllAreas() {
    renderAreaTable('DA');
    renderAreaTable('DB');
    renderAreaTable('DC');
    renderAreaTable('DD');
    renderAreaTable('DE');
}

// Mengambil max rack number di area tertentu
function getMaxRackNumber(areaCode) {
    let maxRack = 0;
    
    locations.forEach(location => {
        if (location.startsWith(areaCode)) {
            const parts = location.split('-');
            const rackNum = parseInt(parts[1]);
            if (rackNum > maxRack) {
                maxRack = rackNum;
            }
        }
    });
    
    return maxRack;
}

// Mendapatkan semua rack number yang ada di area tertentu
function getRackNumbersInArea(areaCode) {
    const rackNumbers = new Set();
    
    locations.forEach(location => {
        if (location.startsWith(areaCode)) {
            const parts = location.split('-');
            rackNumbers.add(parseInt(parts[1]));
        }
    });
    
    return Array.from(rackNumbers).sort((a, b) => a - b);
}

// Render area dalam format tabel modern
function renderAreaTable(areaCode) {
    const container = document.getElementById(`area${areaCode}`);
    container.innerHTML = '';
    
    // Header area
    const areaHeader = document.createElement('h2');
    areaHeader.className = 'area-header';
    areaHeader.textContent = `Area ${areaCode} - High Rack`;
    container.appendChild(areaHeader);
    
    // Mendapatkan semua nomor rack di area ini
    const rackNumbers = getRackNumbersInArea(areaCode);
    
    // Membuat tabel untuk setiap rack
    const table = document.createElement('table');
    table.className = 'rack-table';
    
    // Header row dengan nomor rack
    const headerRow = document.createElement('tr');
    headerRow.className = 'rack-table-header';
    
    // Cell kosong di kiri atas
    const emptyHeaderCell = document.createElement('th');
    headerRow.appendChild(emptyHeaderCell);
    
    // Header untuk setiap rack
    rackNumbers.forEach(rackNum => {
        const rackHeader = document.createElement('th');
        const formattedRackNum = rackNum.toString().padStart(2, '0');
        rackHeader.textContent = `${areaCode}-${formattedRackNum}`;
        headerRow.appendChild(rackHeader);
    });
    
    table.appendChild(headerRow);
    
    // Membuat baris untuk stack 4, 3, 2, 1 (dari atas ke bawah)
    for (let stack = 4; stack >= 1; stack--) {
        const stackRow = document.createElement('tr');
        
        // Label stack
        const stackLabel = document.createElement('td');
        stackLabel.className = 'stack-label';
        stackLabel.textContent = `Stack ${stack}`;
        stackRow.appendChild(stackLabel);
        
        // Cells untuk setiap rack
        rackNumbers.forEach(rackNum => {
            const cell = document.createElement('td');
            const formattedRackNum = rackNum.toString().padStart(2, '0');
            
            // Ada 2 level untuk setiap stack (1 & 2)
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
                
                // Cek apakah lokasi ada dalam daftar
                if (locations.includes(locationCode)) {
                    const locationData = occupancyData[locationCode];
                    
                    if (locationData && locationData.status === 'occupied') {
                        locationDiv.classList.add('occupied');
                        locationDiv.classList.add(customerColors[locationData.customer]);
                    }
                    
                    locationDiv.addEventListener('click', function() {
                        showLocationDetails(locationCode);
                    });
                } else {
                    // Lokasi tidak tersedia
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
    
    container.appendChild(table);
}

// Menampilkan detail lokasi dalam modal
function showLocationDetails(locationCode) {
    const locationData = occupancyData[locationCode];
    
    if (!locationData) return; // Keluar jika tidak ada data
    
    const modal = document.getElementById('detailModal');
    
    document.getElementById('locationTitle').textContent = `Detail Lokasi: ${locationCode}`;
    document.getElementById('locationCode').textContent = locationCode;
    
    if (locationData.status === 'empty') {
        document.getElementById('locationStatus').textContent = 'Kosong';
        document.getElementById('customerName').textContent = '-';
        document.getElementById('materialName').textContent = '-';
        document.getElementById('materialQty').textContent = '-';
        document.getElementById('dateIn').textContent = '-';
    } else {
        document.getElementById('locationStatus').textContent = 'Terisi';
        document.getElementById('customerName').textContent = locationData.customer;
        document.getElementById('materialName').textContent = locationData.material;
        document.getElementById('materialQty').textContent = locationData.quantity;
        document.getElementById('dateIn').textContent = formatDate(locationData.dateIn);
    }
    
    modal.classList.add('active');
}

// Setup fungsi modal
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

// Format tanggal menjadi format lokal Indonesia
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

// Setup fungsi pencarian
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

// Melakukan pencarian berdasarkan lokasi atau customer
function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();
    
    if (searchTerm === '') return;
    
    // Reset semua highlight
    const allLocations = document.querySelectorAll('.location-cell');
    allLocations.forEach(location => {
        location.classList.remove('highlighted');
    });
    
    // Cari lokasi atau customer yang cocok
    let found = false;
    let foundArea = null;
    
    allLocations.forEach(location => {
        if (!location.dataset.location) return;
        
        const locationCode = location.dataset.location;
        const locationData = occupancyData[locationCode];
        
        // Cek apakah cocok dengan kode lokasi
        if (locationCode.includes(searchTerm)) {
            highlightLocation(location);
            found = true;
            foundArea = locationCode.split('-')[0];
        } 
        // Cek apakah cocok dengan nama customer
        else if (locationData && 
                locationData.status === 'occupied' && 
                locationData.customer.includes(searchTerm)) {
            highlightLocation(location);
            found = true;
            foundArea = locationCode.split('-')[0];
        }
    });
    
    if (found && foundArea) {
        // Aktifkan tab area yang ditemukan
        document.querySelectorAll('.area-tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.area === foundArea) {
                btn.classList.add('active');
            }
        });
        
        // Tampilkan area yang ditemukan
        document.querySelectorAll('.area-view').forEach(view => {
            view.style.display = 'none';
            if (view.id === `area${foundArea}`) {
                view.style.display = 'block';
            }
        });
    }
    
    if (!found) {
        alert('Tidak ditemukan lokasi atau customer yang sesuai dengan pencarian');
    }
}

// Highlight lokasi yang ditemukan
function highlightLocation(location) {
    location.classList.add('highlighted');
    location.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
