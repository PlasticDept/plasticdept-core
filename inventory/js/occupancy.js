// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Main App
document.addEventListener('DOMContentLoaded', function() {
    // Initialize application
    initializeApp();
    
    // Event listeners
    document.getElementById('uploadBtn').addEventListener('click', handleFileUpload);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    
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
    // Create rack sections
    generateRackSections();
    
    // Load initial data
    loadLocationsData();
    
    // Update statistics
    updateStatistics();
}

// Generate Rack Sections Based on Location Patterns
function generateRackSections() {
    // High Rack Area - DA Section (01-05)
    const daSection1 = document.getElementById('section-DA-01-05');
    generateGrid(daSection1, 'DA', 1, 5);
    
    // High Rack Area - DA Section (06-10)
    const daSection2 = document.getElementById('section-DA-06-10');
    generateGrid(daSection2, 'DA', 6, 10);
    
    // High Rack Area - DB Section (01-05)
    const dbSection1 = document.getElementById('section-DB-01-05');
    generateGrid(dbSection1, 'DB', 1, 5);
    
    // Floor Area - A Section (01-10)
    const aSection1 = document.getElementById('section-A-01-10');
    generateFloorGrid(aSection1, 'A', 1, 10);
    
    // Floor Area - A Section (11-20)
    const aSection2 = document.getElementById('section-A-11-20');
    generateFloorGrid(aSection2, 'A', 11, 20);
    
    // Add more sections as needed...
}

// Generate High Rack Grid (DA, DB, DC areas)
function generateGrid(container, areaPrefix, startBlock, endBlock) {
    // Clear container
    container.innerHTML = '';
    
    // Generate header row (column labels)
    for (let block = startBlock; block <= endBlock; block++) {
        const blockFormatted = block.toString().padStart(2, '0');
        
        // Each block has two columns (1 and 2)
        for (let column = 1; column <= 2; column++) {
            const headerCell = document.createElement('div');
            headerCell.className = 'rack-location header';
            headerCell.textContent = `${areaPrefix}-${blockFormatted}-${column}`;
            container.appendChild(headerCell);
        }
    }
    
    // Generate rack positions (4 rows from top to bottom)
    for (let level = 4; level >= 1; level--) {
        for (let block = startBlock; block <= endBlock; block++) {
            const blockFormatted = block.toString().padStart(2, '0');
            
            // Each block has two columns (1 and 2)
            for (let column = 1; column <= 2; column++) {
                const locationCode = `${areaPrefix}-${blockFormatted}-${column}-${level}`;
                const locationCell = document.createElement('div');
                locationCell.className = 'rack-location available';
                locationCell.textContent = locationCode;
                locationCell.setAttribute('data-location', locationCode);
                locationCell.addEventListener('click', () => showLocationDetails(locationCode));
                container.appendChild(locationCell);
            }
        }
    }
}

// Generate Floor Area Grid (A area)
function generateFloorGrid(container, areaPrefix, startBlock, endBlock) {
    // Clear container
    container.innerHTML = '';
    
    // Generate header row for each column
    for (let j = 1; j <= 10; j++) {
        const headerCell = document.createElement('div');
        headerCell.className = 'rack-location header';
        headerCell.textContent = j.toString().padStart(2, '0');
        container.appendChild(headerCell);
    }
    
    // Generate locations
    for (let block = startBlock; block <= endBlock; block++) {
        const blockFormatted = block.toString().padStart(2, '0');
        
        for (let position = 1; position <= 21; position++) {
            const positionFormatted = position.toString().padStart(2, '0');
            const locationCode = `${areaPrefix}-${blockFormatted}-${positionFormatted}`;
            const locationCell = document.createElement('div');
            locationCell.className = 'rack-location available';
            locationCell.textContent = locationCode;
            locationCell.setAttribute('data-location', locationCode);
            locationCell.addEventListener('click', () => showLocationDetails(locationCode));
            container.appendChild(locationCell);
        }
    }
}

// Load Locations Data from Firebase
function loadLocationsData() {
    db.collection('locations').get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const locationData = doc.data();
                updateLocationUI(locationData);
            });
            updateStatistics();
        })
        .catch((error) => {
            console.error("Error loading locations data: ", error);
            alert("Gagal memuat data lokasi. Silakan coba lagi.");
        });
}

// Update Location UI Based on Data
function updateLocationUI(locationData) {
    const locationElement = document.querySelector(`.rack-location[data-location="${locationData.locationCode}"]`);
    if (locationElement) {
        if (locationData.isOccupied) {
            locationElement.classList.remove('available');
            locationElement.classList.add('occupied');
        } else {
            locationElement.classList.remove('occupied');
            locationElement.classList.add('available');
        }
    }
}

// Show Location Details in Modal
function showLocationDetails(locationCode) {
    // Get location data from Firebase
    db.collection('locations').doc(locationCode).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Populate modal with data
                document.getElementById('locationCode').textContent = locationCode;
                document.getElementById('locationStatus').textContent = data.isOccupied ? 
                    data.status || 'Occupied' : 'Available';
                document.getElementById('partNo').textContent = data.partNo || '-';
                document.getElementById('invoiceNo').textContent = data.invoiceNo || '-';
                document.getElementById('lotNo').textContent = data.lotNo || '-';
                document.getElementById('receiveDate').textContent = data.receiveDate || '-';
                document.getElementById('quantity').textContent = data.quantity || '0';
                document.getElementById('customerCode').textContent = data.customerCode || '-';
                document.getElementById('uidCount').textContent = data.uidCount || '0';
                
                // Style the status based on its value
                const statusElement = document.getElementById('locationStatus');
                statusElement.className = 'detail-value';
                
                if (data.isOccupied) {
                    if (data.status === 'putaway') {
                        statusElement.classList.add('text-primary');
                    } else if (data.status === 'allocated') {
                        statusElement.classList.add('text-warning');
                    } else if (data.status === 'hold') {
                        statusElement.classList.add('text-danger');
                    }
                } else {
                    statusElement.classList.add('text-success');
                }
                
            } else {
                // If no detailed data exists, show basic info
                document.getElementById('locationCode').textContent = locationCode;
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
        })
        .catch((error) => {
            console.error("Error getting location details: ", error);
            alert("Gagal memuat detail lokasi. Silakan coba lagi.");
        });
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
}

// Handle File Upload
function handleFileUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Silakan pilih file terlebih dahulu.');
        return;
    }
    
    // Show loading state
    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.textContent;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
    
    // Read Excel file
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        
        // Get first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Process data
        processUploadedData(jsonData)
            .then(() => {
                // Close modal and reset
                bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                fileInput.value = '';
                alert('Data berhasil diupload dan diproses!');
                
                // Refresh displayed data
                loadLocationsData();
            })
            .catch(error => {
                console.error("Error processing uploaded data:", error);
                alert('Terjadi kesalahan saat memproses data. Silakan coba lagi.');
            })
            .finally(() => {
                // Reset button state
                uploadBtn.disabled = false;
                uploadBtn.textContent = originalText;
            });
    };
    
    reader.readAsArrayBuffer(file);
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
                receiveDate: row.ReceiveDate || row.receiveDate || row['Receive Date'] || '',
                status: row.Status || row.status || 'putaway',
                quantity: parseInt(row.Quantity || row.quantity || row.QTY || '0', 10),
                customerCode: row.CustomerCode || row.customerCode || row['Customer Code'] || '',
                uidCount: parseInt(row.UIDCount || row.uidCount || row.UID || '0', 10)
            };
            
            batch.set(locationRef, locationData, { merge: true });
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
    
    // Reload locations data
    loadLocationsData()
        .then(() => {
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
            document.getElementById('totalLocations').textContent = total;
            document.getElementById('occupiedLocations').textContent = occupied;
            document.getElementById('availableLocations').textContent = available;
            document.getElementById('occupancyPercentage').textContent = `${percentage}%`;
        })
        .catch((error) => {
            console.error("Error calculating statistics: ", error);
        });
}