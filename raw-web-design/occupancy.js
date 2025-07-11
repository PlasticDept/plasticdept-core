document.addEventListener('DOMContentLoaded', function() {
    // Mengatur waktu dan user saat ini
    document.getElementById('currentDate').textContent = '2025-07-11 09:50:06';
    document.getElementById('currentUser').textContent = 'Login: PlasticDept';
    
    // Render semua area dengan format tabel
    renderAreaTable('DA');
    renderAreaTable('DB');
    renderAreaTable('DC');
    renderAreaTable('DD');
    renderAreaTable('DE');
    
    // Setup modal
    setupModal();
    
    // Setup area selector
    setupAreaSelector();
    
    // Setup search functionality
    setupSearch();
});

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

// Render area dalam format tabel
function renderAreaTable(areaCode) {
    const container = document.getElementById(`area${areaCode}`);
    
    // Membuat tabel
    const table = document.createElement('table');
    table.className = 'area-table';
    
    // Baris header untuk area
    const headerRow = document.createElement('tr');
    const areaHeader = document.createElement('th');
    areaHeader.className = 'area-header';
    areaHeader.colSpan = getMaxRackNumber(areaCode) + 1; // +1 untuk kolom header
    areaHeader.textContent = `Area ${areaCode} - High Rack`;
    headerRow.appendChild(areaHeader);
    table.appendChild(headerRow);
    
    // Membuat baris untuk setiap level-posisi (4-1 di atas, 1-1 di bawah)
    for (let position = 4; position >= 1; position--) {
        for (let level = 1; level <= 2; level++) {
            const row = document.createElement('tr');
            
            // Kolom pertama sebagai label (kosong)
            if (level === 1 && position === 4) {
                const firstCell = document.createElement('td');
                firstCell.rowSpan = 8; // 2 level x 4 posisi
                row.appendChild(firstCell);
            }
            
            // Buat cell untuk setiap rack
            for (let rack = 1; rack <= getMaxRackNumber(areaCode); rack++) {
                const rackNum = rack.toString().padStart(2, '0');
                const locationCode = `${areaCode}-${rackNum}-${level}-${position}`;
                const cell = document.createElement('td');
                
                // Cek apakah lokasi ini ada dalam data
                if (locations.includes(locationCode)) {
                    const locationData = occupancyData[locationCode];
                    
                    const locationDiv = document.createElement('div');
                    locationDiv.className = 'location-cell';
                    locationDiv.textContent = locationCode;
                    locationDiv.dataset.location = locationCode;
                    
                    if (locationData && locationData.status === 'occupied') {
                        locationDiv.classList.add('occupied');
                        locationDiv.classList.add(customerColors[locationData.customer]);
                    } else {
                        locationDiv.classList.add('empty-cell');
                    }
                    
                    locationDiv.addEventListener('click', function() {
                        showLocationDetails(locationCode);
                    });
                    
                    cell.appendChild(locationDiv);
                } else {
                    // Lokasi tidak ada dalam daftar
                    cell.textContent = locationCode;
                    cell.style.color = '#aaa';
                }
                
                row.appendChild(cell);
            }
            
            table.appendChild(row);
        }
    }
    
    // Tambahkan tabel ke container
    container.innerHTML = '';
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
    
    modal.style.display = 'block';
}

// Setup fungsi modal
function setupModal() {
    const modal = document.getElementById('detailModal');
    const closeButton = document.querySelector('.close-button');
    
    closeButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Setup area selector
function setupAreaSelector() {
    const areaButtons = document.querySelectorAll('.area-button');
    
    areaButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            areaButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
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
        document.querySelectorAll('.area-button').forEach(btn => {
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