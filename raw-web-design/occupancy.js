document.addEventListener('DOMContentLoaded', function() {
    // Render semua area
    renderArea('DA');
    renderArea('DB');
    renderArea('DC');
    renderArea('DD');
    renderArea('DE');
    
    // Setup modal
    setupModal();
    
    // Setup area selector
    setupAreaSelector();
    
    // Setup search functionality
    setupSearch();
    
    // Tampilkan tanggal dan user saat ini
    document.getElementById('currentDate').textContent = '2025-07-11 09:38:27';
    document.getElementById('currentUser').textContent = 'Login: PlasticDept';
});

// Render satu area rack
function renderArea(areaCode) {
    const container = document.getElementById(`rack${areaCode}`);
    container.innerHTML = '';
    
    // Ambil semua rack di area tertentu (01-15)
    const racks = [];
    for (let i = 1; i <= 15; i++) {
        const rackNumber = i.toString().padStart(2, '0');
        const rackCode = `${areaCode}-${rackNumber}`;
        
        // Cek apakah rack ini ada dalam data
        const rackExists = locations.some(loc => loc.startsWith(rackCode));
        if (rackExists) {
            racks.push(rackNumber);
        }
    }
    
    // Render setiap rack
    racks.forEach(rackNumber => {
        renderRack(areaCode, rackNumber, container);
    });
}

// Render sebuah rack
function renderRack(areaCode, rackNumber, container) {
    const rackDiv = document.createElement('div');
    rackDiv.className = 'rack';
    
    const rackHeader = document.createElement('div');
    rackHeader.className = 'rack-header';
    rackHeader.textContent = `${areaCode}-${rackNumber}`;
    
    const rackGrid = document.createElement('div');
    rackGrid.className = 'rack-grid';
    
    // Cari semua lokasi untuk rack ini
    const rackLocations = [];
    
    // Untuk setiap kombinasi level (1-2) dan posisi (1-4)
    for (let level = 1; level <= 2; level++) {
        for (let position = 1; position <= 4; position++) {
            const locationCode = `${areaCode}-${rackNumber}-${level}-${position}`;
            
            // Buat kotak lokasi
            const locationBox = document.createElement('div');
            locationBox.className = 'location-box';
            locationBox.textContent = `${level}-${position}`;
            locationBox.dataset.location = locationCode;
            
            // Cek apakah lokasi ini ada dalam data
            if (locations.includes(locationCode)) {
                const locationData = occupancyData[locationCode];
                
                if (locationData && locationData.status === 'occupied') {
                    locationBox.classList.add('occupied');
                    locationBox.classList.add(customerColors[locationData.customer]);
                }
                
                locationBox.addEventListener('click', function() {
                    showLocationDetails(locationCode);
                });
            } else {
                // Jika lokasi tidak ada dalam daftar, tampilkan sebagai non-interaktif
                locationBox.style.opacity = '0.3';
                locationBox.style.cursor = 'default';
                locationBox.title = 'Lokasi tidak tersedia';
            }
            
            rackGrid.appendChild(locationBox);
        }
    }
    
    rackDiv.appendChild(rackHeader);
    rackDiv.appendChild(rackGrid);
    container.appendChild(rackDiv);
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
    const allBoxes = document.querySelectorAll('.location-box');
    allBoxes.forEach(box => {
        box.style.outline = 'none';
    });
    
    // Cari lokasi atau customer yang cocok
    let found = false;
    let foundArea = null;
    
    allBoxes.forEach(box => {
        if (!box.dataset.location) return;
        
        const locationCode = box.dataset.location;
        const locationData = occupancyData[locationCode];
        
        // Cek apakah cocok dengan kode lokasi
        if (locationCode.includes(searchTerm)) {
            highlightBox(box);
            found = true;
            foundArea = locationCode.split('-')[0];
        } 
        // Cek apakah cocok dengan nama customer
        else if (locationData && 
                 locationData.status === 'occupied' && 
                 locationData.customer.includes(searchTerm)) {
            highlightBox(box);
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

// Highlight kotak yang ditemukan
function highlightBox(box) {
    box.style.outline = '3px solid #FF5722';
    box.style.outlineOffset = '3px';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}