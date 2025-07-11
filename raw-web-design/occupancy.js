document.addEventListener('DOMContentLoaded', function() {
    // Render rack area A
    renderOccupancyGrid('highRackAreaA', 'A', 20);
    
    // Render rack area B
    renderOccupancyGrid('highRackAreaB', 'B', 20);
    
    // Setup modal
    setupModal();
    
    // Setup search functionality
    setupSearch();
});

// Render grid dengan lokasi penyimpanan
function renderOccupancyGrid(containerId, areaPrefix, count) {
    const container = document.getElementById(containerId);
    
    for (let i = 1; i <= count; i++) {
        const locationCode = `${areaPrefix}${i}`;
        const locationData = occupancyData[locationCode];
        
        const locationBox = document.createElement('div');
        locationBox.className = 'location-box';
        locationBox.textContent = locationCode;
        locationBox.dataset.location = locationCode;
        
        if (locationData && locationData.status === 'occupied') {
            locationBox.classList.add('occupied');
            locationBox.classList.add(customerColors[locationData.customer]);
        }
        
        locationBox.addEventListener('click', function() {
            showLocationDetails(locationCode);
        });
        
        container.appendChild(locationBox);
    }
}

// Menampilkan detail lokasi dalam modal
function showLocationDetails(locationCode) {
    const locationData = occupancyData[locationCode];
    const modal = document.getElementById('detailModal');
    
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
    
    allBoxes.forEach(box => {
        const locationCode = box.dataset.location;
        const locationData = occupancyData[locationCode];
        
        // Cek apakah cocok dengan kode lokasi
        if (locationCode.includes(searchTerm)) {
            highlightBox(box);
            found = true;
        } 
        // Cek apakah cocok dengan nama customer
        else if (locationData && 
                 locationData.status === 'occupied' && 
                 locationData.customer.includes(searchTerm)) {
            highlightBox(box);
            found = true;
        }
    });
    
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