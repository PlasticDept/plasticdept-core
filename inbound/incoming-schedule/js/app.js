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
const database = firebase.database();
const auth = firebase.auth();

// User info
const currentUser = {
    login: 'PlasticDept',
    timestamp: new Date().toISOString()
};

// DOM Elements
const csvFileInput = document.getElementById('csvFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameSpan = document.getElementById('file-name');
const progressBar = document.querySelector('.progress');
const statusMessage = document.getElementById('statusMessage');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const currentDateEl = document.getElementById('currentDate');
const currentTimeEl = document.getElementById('currentTime');
const totalInboundEl = document.getElementById('totalInbound');
const totalQtyEl = document.getElementById('totalQty');
const totalUIDEl = document.getElementById('totalUID');
const ownerTotalEl = document.getElementById('ownerTotal');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbersDiv = document.getElementById('pageNumbers');
const exportBtn = document.getElementById('exportBtn');
const loadingModal = document.getElementById('loadingModal');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const userInfoEl = document.getElementById('userInfo');
const currentRangeEl = document.getElementById('currentRange');
const totalRecordsEl = document.getElementById('totalRecords');
const uploadModal = document.getElementById('uploadModal');
const openUploadBtn = document.getElementById('openUploadBtn');
const cancelBtn = document.querySelector('.cancel-btn');

// Variables
let inboundData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let currentSort = { column: null, direction: 'asc' };
let isAuthenticated = false;

// Authenticate anonymously with Firebase
function authenticateAnonymously() {
    showModal(loadingModal);
    
    if (typeof firebase.auth === 'function') {
        firebase.auth().signInAnonymously()
            .then(() => {
                console.log('Authenticated anonymously');
                isAuthenticated = true;
                hideModal(loadingModal);
                
                // Set user info in the header
                if (userInfoEl) {
                    userInfoEl.textContent = `Login: ${currentUser.login}`;
                }
                
                // Now that we're authenticated, load data
                loadDataFromFirebase();
            })
            .catch((error) => {
                hideModal(loadingModal);
                showErrorModal(`Authentication failed: ${error.message}. Please refresh the page.`);
                console.error('Authentication Error:', error);
            });
    } else {
        hideModal(loadingModal);
        showErrorModal('Firebase Authentication is not available. Please ensure Firebase Auth library is loaded properly.');
        console.error('Firebase Auth not available');
    }
}

// Listen for auth state changes if auth is available
if (typeof firebase.auth === 'function') {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            isAuthenticated = true;
        } else {
            isAuthenticated = false;
        }
    });
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (currentDateEl) {
        currentDateEl.textContent = now.toLocaleDateString('en-US', options);
    }
    
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    if (currentTimeEl) {
        currentTimeEl.textContent = now.toLocaleTimeString('en-US', timeOptions);
    }
}

// Initialize date and time, then update every second
updateDateTime();
setInterval(updateDateTime, 1000);

// File input change handler
if (csvFileInput) {
    csvFileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            const file = this.files[0];
            if (fileNameSpan) {
                fileNameSpan.textContent = file.name;
            }
            if (uploadBtn) {
                uploadBtn.disabled = false;
            }
            console.log('File selected:', file.name);
        } else {
            if (fileNameSpan) {
                fileNameSpan.textContent = 'No file selected';
            }
            if (uploadBtn) {
                uploadBtn.disabled = true;
            }
        }
    });
}

// Upload button click handler
if (uploadBtn) {
    uploadBtn.addEventListener('click', function() {
        if (!isAuthenticated && typeof firebase.auth === 'function') {
            showErrorModal('You are not authenticated. Please refresh the page.');
            return;
        }
        
        const file = csvFileInput ? csvFileInput.files[0] : null;
        if (!file) return;
        
        showModal(loadingModal);
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                processData(data, file.name);
            } catch (error) {
                hideModal(loadingModal);
                showErrorModal('Error reading file: ' + error.message);
            }
        };
        
        reader.onerror = function() {
            hideModal(loadingModal);
            showErrorModal('Error reading file.');
        };
        
        reader.readAsBinaryString(file);
    });
}

// Open upload modal
if (openUploadBtn) {
    openUploadBtn.addEventListener('click', function() {
        showModal(uploadModal);
    });
}

// Close upload modal on cancel
if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
        hideModal(uploadModal);
    });
}

// Process the Excel/CSV data
function processData(data, fileName) {
    try {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Find header row and column indices
        let headerRowIndex = -1;
        let ownerCodeIndex = -1;
        let inboundNoIndex = -1;
        let receivedDateIndex = -1;
        let inboundRefNoIndex = -1;
        let totalQtyIndex = -1;
        let uidCountIndex = -1;
        
        for (let i = 0; i < jsonData.length; i++) {
            if (!jsonData[i] || jsonData[i].length === 0) continue;
            
            const row = jsonData[i].map(cell => String(cell).trim().toLowerCase());
            
            if (row.includes('owner code') && row.includes('inbound no.') && row.includes('received date')) {
                headerRowIndex = i;
                ownerCodeIndex = row.indexOf('owner code');
                inboundNoIndex = row.indexOf('inbound no.');
                receivedDateIndex = row.indexOf('received date');
                inboundRefNoIndex = row.indexOf('inbound ref no.');
                totalQtyIndex = row.indexOf('total qty');
                uidCountIndex = row.indexOf('uid count');
                break;
            }
        }
        
        if (headerRowIndex === -1) {
            hideModal(loadingModal);
            showErrorModal('Invalid file format. Required headers not found.');
            return;
        }
        
        // Extract data rows
        const processedData = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0 || !row[ownerCodeIndex]) continue;
            
            const ownerCode = row[ownerCodeIndex];
            const inboundNo = row[inboundNoIndex];
            
            // Skip rows without essential data
            if (!ownerCode || !inboundNo) continue;
            
            // Format received date properly
            let receivedDate = row[receivedDateIndex];
            if (receivedDate) {
                // If it's a date object from Excel
                if (typeof receivedDate === 'object' && receivedDate instanceof Date) {
                    receivedDate = receivedDate.toISOString().split('T')[0];
                } else if (typeof receivedDate === 'number') {
                    // Excel stores dates as days since 1900-01-01
                    receivedDate = new Date(Math.round((receivedDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                }
            }
            
            // Format quantity to remove commas and convert to number
            let qty = row[totalQtyIndex];
            if (typeof qty === 'string') {
                qty = parseFloat(qty.replace(/,/g, ''));
            }
            
            processedData.push({
                ownerCode: ownerCode,
                inboundNo: inboundNo,
                receivedDate: receivedDate || '',
                invoiceNo: row[inboundRefNoIndex] || '',
                qty: qty || 0,
                uid: row[uidCountIndex] || 0,
                timestamp: new Date().toISOString(),
                uploadedBy: currentUser.login
            });
        }
        
        if (processedData.length === 0) {
            hideModal(loadingModal);
            showErrorModal('No valid data found in the file.');
            return;
        }
        
        // Save data to Firebase dengan struktur baru
        saveToFirebase(processedData, fileName);
        
    } catch (error) {
        hideModal(loadingModal);
        showErrorModal('Error processing file: ' + error.message);
    }
}

// Save processed data to Firebase dengan struktur baru
function saveToFirebase(data, fileName) {
    if (!isAuthenticated) {
        hideModal(loadingModal);
        showErrorModal('You are not authenticated. Please refresh the page.');
        return;
    }
    
    // Update progress bar
    if (progressBar) {
        progressBar.style.width = '50%';
    }
    if (statusMessage) {
        statusMessage.textContent = 'Uploading data to database...';
    }
    
    // Group data by receivedDate and inboundNo
    const groupedData = {};
    const promises = [];
    
    data.forEach(item => {
        // Format tanggal untuk path database
        const uploadDate = new Date();
        const year = uploadDate.getFullYear();
        
        // Format bulan dengan nama bulan (01_Jan, 02_Feb, dst)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = String(uploadDate.getMonth() + 1).padStart(2, '0') + "_" + monthNames[uploadDate.getMonth()];
        
        const day = String(uploadDate.getDate()).padStart(2, '0');
        
        // Buat path untuk inbound item
        const dbPath = `inbDailyReport/${year}/${month}/${day}/${item.inboundNo}`;
        
        // Set data ke Firebase dengan path baru
        const promise = database.ref(dbPath).set({
            inboundNo: item.inboundNo,
            ownerCode: item.ownerCode,
            receivedDate: item.receivedDate,
            invoiceNo: item.invoiceNo,
            qty: item.qty,
            uid: item.uid,
            timestamp: new Date().toISOString(),
            uploadedBy: currentUser.login
        });
        
        promises.push(promise);
        
        // Simpan referensi untuk grup data yang sama
        if (!groupedData[year]) groupedData[year] = {};
        if (!groupedData[year][month]) groupedData[year][month] = {};
        if (!groupedData[year][month][day]) groupedData[year][month][day] = [];
        
        groupedData[year][month][day].push(item.inboundNo);
    });
    
    // Tunggu semua promises selesai
    Promise.all(promises)
        .then(() => {
            // Update progress bar to complete
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            if (statusMessage) {
                statusMessage.textContent = 'Upload complete!';
            }
            
            setTimeout(() => {
                hideModal(loadingModal);
                hideModal(uploadModal);
                showSuccessModal(`Data successfully uploaded to database. Total ${data.length} records.`);
                
                // Reset file input
                if (csvFileInput) {
                    csvFileInput.value = '';
                }
                if (fileNameSpan) {
                    fileNameSpan.textContent = 'No file selected';
                }
                if (uploadBtn) {
                    uploadBtn.disabled = true;
                }
                
                // Reset progress bar
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
                if (statusMessage) {
                    statusMessage.textContent = '';
                }
                
                // Reload data
                loadDataFromFirebase();
            }, 800);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed to save data to database: ' + error.message);
        });
}

// Load data from Firebase - Modified for new structure
function loadDataFromFirebase(filterParams = {}) {
    if (!isAuthenticated) {
        showErrorModal('You are not authenticated. Please refresh the page.');
        return;
    }
    
    showModal(loadingModal);
    
    // Default: load data dari 30 hari terakhir jika tidak ada filter
    const now = new Date();
    let startDate = new Date();
    startDate.setDate(now.getDate() - 30); // Default 30 hari terakhir
    
    // Jika ada filter khusus
    if (filterParams.startDate) {
        startDate = new Date(filterParams.startDate);
    }
    if (filterParams.endDate) {
        now.setTime(new Date(filterParams.endDate).getTime());
    }
    
    // Jika filter hanya untuk tahun/bulan/hari tertentu
    if (filterParams.year && filterParams.month && filterParams.day) {
        loadDataByDay(filterParams.year, filterParams.month, filterParams.day);
        return;
    } else if (filterParams.year && filterParams.month) {
        loadDataByMonth(filterParams.year, filterParams.month);
        return;
    } else if (filterParams.year) {
        loadDataByYear(filterParams.year);
        return;
    }
    
    // Jika tidak ada filter khusus, load data dari rentang waktu
    inboundData = [];
    
    // Iterasi dari tanggal mulai hingga akhir
    const currentDate = new Date(startDate);
    const promises = [];
    
    while (currentDate <= now) {
        const year = currentDate.getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = String(currentDate.getMonth() + 1).padStart(2, '0') + "_" + monthNames[currentDate.getMonth()];
        const day = String(currentDate.getDate()).padStart(2, '0');
        
        // Buat path untuk tanggal ini
        const dbPath = `inbDailyReport/${year}/${month}/${day}`;
        
        // Ambil data untuk tanggal ini
        const promise = database.ref(dbPath).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    snapshot.forEach(childSnapshot => {
                        const inboundItem = childSnapshot.val();
                        inboundData.push({
                            ...inboundItem,
                            key: childSnapshot.key
                        });
                    });
                }
            })
            .catch(error => console.error(`Error loading data for ${dbPath}:`, error));
        
        promises.push(promise);
        
        // Tambah 1 hari
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Tunggu semua promises selesai
    Promise.all(promises)
        .then(() => {
            // Sort by received date (newest first)
            inboundData.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));
            
            filteredData = [...inboundData];
            updateTable();
            updateSummary();
            updateTableInfo();
            hideModal(loadingModal);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed to load data from database: ' + error.message);
        });
}

// Fungsi untuk load data per hari
function loadDataByDay(year, month, day) {
    showModal(loadingModal);
    inboundData = [];
    
    database.ref(`inbDailyReport/${year}/${month}/${day}`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                // Iterate melalui inbound items
                snapshot.forEach(itemSnapshot => {
                    const inboundItem = itemSnapshot.val();
                    inboundData.push({
                        ...inboundItem,
                        key: itemSnapshot.key
                    });
                });
                
                // Sort and update UI
                inboundData.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));
                filteredData = [...inboundData];
                updateTable();
                updateSummary();
                updateTableInfo();
            } else {
                filteredData = [];
                updateTable();
                updateSummary();
                updateTableInfo();
            }
            
            hideModal(loadingModal);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed to load data: ' + error.message);
        });
}

// Fungsi untuk load data per bulan
function loadDataByMonth(year, month) {
    showModal(loadingModal);
    inboundData = [];
    
    database.ref(`inbDailyReport/${year}/${month}`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                // Iterate melalui hari
                snapshot.forEach(daySnapshot => {
                    // Iterate melalui inbound items
                    daySnapshot.forEach(itemSnapshot => {
                        const inboundItem = itemSnapshot.val();
                        inboundData.push({
                            ...inboundItem,
                            key: itemSnapshot.key
                        });
                    });
                });
                
                // Sort and update UI
                inboundData.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));
                filteredData = [...inboundData];
                updateTable();
                updateSummary();
                updateTableInfo();
            } else {
                filteredData = [];
                updateTable();
                updateSummary();
                updateTableInfo();
            }
            
            hideModal(loadingModal);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed to load data: ' + error.message);
        });
}

// Fungsi untuk load data per tahun
function loadDataByYear(year) {
    showModal(loadingModal);
    inboundData = [];
    
    database.ref(`inbDailyReport/${year}`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                // Iterate melalui bulan
                const monthPromises = [];
                
                snapshot.forEach(monthSnapshot => {
                    // Iterate melalui hari
                    monthSnapshot.forEach(daySnapshot => {
                        // Iterate melalui inbound items
                        daySnapshot.forEach(itemSnapshot => {
                            const inboundItem = itemSnapshot.val();
                            inboundData.push({
                                ...inboundItem,
                                key: itemSnapshot.key
                            });
                        });
                    });
                });
                
                // Sort and update UI
                inboundData.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));
                filteredData = [...inboundData];
                updateTable();
                updateSummary();
                updateTableInfo();
            } else {
                filteredData = [];
                updateTable();
                updateSummary();
                updateTableInfo();
            }
            
            hideModal(loadingModal);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed to load data: ' + error.message);
        });
}

// Update the data table with current filtered data
function updateTable() {
    // Calculate total pages
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    
    // Adjust current page if needed
    if (currentPage > totalPages) {
        currentPage = totalPages > 0 ? totalPages : 1;
    }
    
    // Calculate start and end indices for current page
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
    
    // Clear table body
    if (tableBody) {
        tableBody.innerHTML = '';
        
        // Add data rows
        if (filteredData.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 6;
            emptyCell.textContent = 'No data available';
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '32px';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
        } else {
            for (let i = startIndex; i < endIndex; i++) {
                const item = filteredData[i];
                const row = document.createElement('tr');
                
                // Create cells
                const ownerCodeCell = document.createElement('td');
                ownerCodeCell.textContent = item.ownerCode;
                
                const inboundNoCell = document.createElement('td');
                inboundNoCell.textContent = item.inboundNo;
                
                const receivedDateCell = document.createElement('td');
                receivedDateCell.textContent = formatDate(item.receivedDate);
                
                const invoiceNoCell = document.createElement('td');
                invoiceNoCell.textContent = item.invoiceNo;
                
                const qtyCell = document.createElement('td');
                qtyCell.textContent = formatNumber(item.qty);
                
                const uidCell = document.createElement('td');
                uidCell.textContent = formatNumber(item.uid);
                
                // Append cells to row
                row.appendChild(ownerCodeCell);
                row.appendChild(inboundNoCell);
                row.appendChild(receivedDateCell);
                row.appendChild(invoiceNoCell);
                row.appendChild(qtyCell);
                row.appendChild(uidCell);
                
                // Append row to table body
                tableBody.appendChild(row);
            }
        }
    }
    
    // Update pagination
    updatePagination(totalPages);
    
    // Update table info
    updateTableInfo();
}

// Update table information (showing x of y records)
function updateTableInfo() {
    const totalRecords = filteredData.length;
    const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endIndex = Math.min(startIndex + rowsPerPage - 1, totalRecords);
    
    if (currentRangeEl) {
        currentRangeEl.textContent = `${startIndex}-${endIndex}`;
    }
    
    if (totalRecordsEl) {
        totalRecordsEl.textContent = totalRecords;
    }
}

// Update pagination controls
function updatePagination(totalPages) {
    // Clear page numbers
    if (!pageNumbersDiv) return;
    
    pageNumbersDiv.innerHTML = '';
    
    // Disable/enable previous and next buttons
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Add page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add first page if not visible
    if (startPage > 1) {
        addPageNumber(1);
        if (startPage > 2) {
            addEllipsis();
        }
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
        addPageNumber(i);
    }
    
    // Add last page if not visible
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            addEllipsis();
        }
        addPageNumber(totalPages);
    }
}

// Add a page number button to pagination
function addPageNumber(pageNum) {
    if (!pageNumbersDiv) return;
    
    const pageButton = document.createElement('span');
    pageButton.textContent = pageNum;
    pageButton.classList.add('page-number');
    if (pageNum === currentPage) {
        pageButton.classList.add('active');
    }
    pageButton.addEventListener('click', () => {
        currentPage = pageNum;
        updateTable();
    });
    pageNumbersDiv.appendChild(pageButton);
}

// Add ellipsis to pagination
function addEllipsis() {
    if (!pageNumbersDiv) return;
    
    const ellipsis = document.createElement('span');
    ellipsis.textContent = '...';
    ellipsis.classList.add('page-ellipsis');
    pageNumbersDiv.appendChild(ellipsis);
}

// Update summary data
function updateSummary() {
    if (filteredData.length === 0) {
        if (totalInboundEl) totalInboundEl.textContent = '0';
        if (totalQtyEl) totalQtyEl.textContent = '0';
        if (totalUIDEl) totalUIDEl.textContent = '0';
        if (ownerTotalEl) ownerTotalEl.textContent = '0';
        return;
    }
    
    // Total inbound
    if (totalInboundEl) {
        totalInboundEl.textContent = filteredData.length;
    }
    
    // Total quantity
    const totalQty = filteredData.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    if (totalQtyEl) {
        totalQtyEl.textContent = formatNumber(totalQty);
    }
    
    // Total UID
    const totalUID = filteredData.reduce((sum, item) => sum + (parseInt(item.uid) || 0), 0);
    if (totalUIDEl) {
        totalUIDEl.textContent = formatNumber(totalUID);
    }
    
    // Count unique owners
    const uniqueOwners = new Set(filteredData.map(item => item.ownerCode));
    if (ownerTotalEl) {
        ownerTotalEl.textContent = uniqueOwners.size;
    }
}

// Search functionality
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            filteredData = [...inboundData];
        } else {
            filteredData = inboundData.filter(item => 
                (item.ownerCode && item.ownerCode.toLowerCase().includes(searchTerm)) ||
                (item.inboundNo && item.inboundNo.toLowerCase().includes(searchTerm)) ||
                (item.invoiceNo && item.invoiceNo.toLowerCase().includes(searchTerm))
            );
        }
        
        currentPage = 1;
        updateTable();
        updateSummary();
    });
}

// Filter by date
document.querySelectorAll('.dropdown-content a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.getAttribute('data-filter');
        
        // Jika filter adalah custom, tampilkan modal filter tanggal
        if (filter === 'custom') {
            showDateFilterModal();
        } else {
            applyDateFilter(filter);
        }
    });
});

// Apply date filter
function applyDateFilter(filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Format untuk database path
    const year = today.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = String(today.getMonth() + 1).padStart(2, '0') + "_" + monthNames[today.getMonth()];
    const day = String(today.getDate()).padStart(2, '0');
    
    switch (filter) {
        case 'today':
            loadDataByDay(year, month, day);
            break;
        case 'week':
            // Load data dari 7 hari terakhir
            let filterParams = {
                startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: today.toISOString().split('T')[0]
            };
            loadDataFromFirebase(filterParams);
            break;
        case 'month':
            loadDataByMonth(year, month);
            break;
        case 'all':
            loadDataFromFirebase();
            break;
        default:
            loadDataFromFirebase();
    }
}

// Tambahkan modal untuk filter tanggal kustom
function addDateFilterModal() {
    // Buat elemen modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dateFilterModal';
    modalDiv.className = 'modal';
    
    // HTML untuk modal
    modalDiv.innerHTML = `
        <div class="modal-content filter-modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-calendar-alt"></i> Filter by Date</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="filter-form">
                    <div class="form-group">
                        <label for="filterType">Filter Type</label>
                        <select id="filterType" class="form-control">
                            <option value="day">Specific Day</option>
                            <option value="range">Date Range</option>
                            <option value="month">Specific Month</option>
                            <option value="year">Specific Year</option>
                        </select>
                    </div>
                    
                    <div id="dayFilter" class="filter-option">
                        <div class="form-group">
                            <label for="specificDate">Select Date</label>
                            <input type="date" id="specificDate" class="form-control">
                        </div>
                    </div>
                    
                    <div id="rangeFilter" class="filter-option" style="display:none;">
                        <div class="form-group">
                            <label for="startDate">Start Date</label>
                            <input type="date" id="startDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="endDate">End Date</label>
                            <input type="date" id="endDate" class="form-control">
                        </div>
                    </div>
                    
                    <div id="monthFilter" class="filter-option" style="display:none;">
                        <div class="form-group">
                            <label for="monthYear">Select Month</label>
                            <input type="month" id="monthYear" class="form-control">
                        </div>
                    </div>
                    
                    <div id="yearFilter" class="filter-option" style="display:none;">
                        <div class="form-group">
                            <label for="yearOnly">Select Year</label>
                            <select id="yearOnly" class="form-control">
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                                <option value="2023">2023</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary cancel-date-filter-btn">Cancel</button>
                <button id="applyDateFilterBtn" class="btn btn-primary">Apply Filter</button>
            </div>
        </div>
    `;
    
    // Tambahkan ke body
    document.body.appendChild(modalDiv);
    
    // Tambahkan CSS untuk form filter
    const style = document.createElement('style');
    style.textContent = `
        .filter-modal-content {
            max-width: 450px;
        }
        .form-group {
            margin-bottom: var(--spacing-md);
        }
        .form-group label {
            display: block;
            margin-bottom: var(--spacing-xs);
            font-weight: var(--font-weight-medium);
            color: var(--text-color);
        }
        .form-control {
            width: 100%;
            padding: var(--spacing-sm) var(--spacing-md);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            font-size: var(--font-size-md);
        }
        .filter-option {
            margin-top: var(--spacing-md);
        }
    `;
    document.head.appendChild(style);
    
    // Event listeners untuk modal filter tanggal
    const dateFilterModal = document.getElementById('dateFilterModal');
    const filterType = document.getElementById('filterType');
    const dayFilter = document.getElementById('dayFilter');
    const rangeFilter = document.getElementById('rangeFilter');
    const monthFilter = document.getElementById('monthFilter');
    const yearFilter = document.getElementById('yearFilter');
    const applyDateFilterBtn = document.getElementById('applyDateFilterBtn');
    const cancelDateFilterBtn = document.querySelector('.cancel-date-filter-btn');
    const closeModalBtn = dateFilterModal.querySelector('.close-modal');
    
    // Show/hide appropriate filter options when filter type changes
    filterType.addEventListener('change', function() {
        dayFilter.style.display = 'none';
        rangeFilter.style.display = 'none';
        monthFilter.style.display = 'none';
        yearFilter.style.display = 'none';
        
        switch(this.value) {
            case 'day':
                dayFilter.style.display = 'block';
                break;
            case 'range':
                rangeFilter.style.display = 'block';
                break;
            case 'month':
                monthFilter.style.display = 'block';
                break;
            case 'year':
                yearFilter.style.display = 'block';
                break;
        }
    });
    
    // Close modal functionality
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => hideModal(dateFilterModal));
    }
    if (cancelDateFilterBtn) {
        cancelDateFilterBtn.addEventListener('click', () => hideModal(dateFilterModal));
    }
    
    // Apply filter button
    if (applyDateFilterBtn) {
        applyDateFilterBtn.addEventListener('click', function() {
            const filterTypeValue = filterType.value;
            let filterParams = {};
            
            switch(filterTypeValue) {
                case 'day':
                    const specificDate = document.getElementById('specificDate').value;
                    if (specificDate) {
                        const date = new Date(specificDate);
                        const year = date.getFullYear();
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const month = String(date.getMonth() + 1).padStart(2, '0') + "_" + monthNames[date.getMonth()];
                        const day = String(date.getDate()).padStart(2, '0');
                        
                        loadDataByDay(year, month, day);
                    }
                    break;
                case 'range':
                    const startDate = document.getElementById('startDate').value;
                    const endDate = document.getElementById('endDate').value;
                    if (startDate && endDate) {
                        filterParams = { startDate, endDate };
                        loadDataFromFirebase(filterParams);
                    }
                    break;
                case 'month':
                    const monthYear = document.getElementById('monthYear').value;
                    if (monthYear) {
                        const [year, monthNum] = monthYear.split('-');
                        const monthIndex = parseInt(monthNum) - 1;
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const month = monthNum + "_" + monthNames[monthIndex];
                        
                        loadDataByMonth(year, month);
                    }
                    break;
                case 'year':
                    const yearOnly = document.getElementById('yearOnly').value;
                    if (yearOnly) {
                        loadDataByYear(yearOnly);
                    }
                    break;
            }
            
            hideModal(dateFilterModal);
        });
    }
}

// Tampilkan modal filter tanggal
function showDateFilterModal() {
    const dateFilterModal = document.getElementById('dateFilterModal');
    if (dateFilterModal) {
        showModal(dateFilterModal);
    }
}

// Sorting functionality
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', function() {
        const column = this.getAttribute('data-sort');
        sortTable(column);
    });
});

// Sort table by column
function sortTable(column) {
    const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
    
    // Update sort indicators in table headers
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const sortColumn = th.getAttribute('data-sort');
        const icon = th.querySelector('i');
        
        if (sortColumn === column) {
            icon.className = direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        } else {
            icon.className = 'fas fa-sort';
        }
    });
    
    // Sort the data
    filteredData.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];
        
        // Handle numeric values
        if (column === 'qty' || column === 'uid') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        }
        // Handle dates
        else if (column === 'receivedDate') {
            valueA = new Date(valueA || '1900-01-01');
            valueB = new Date(valueB || '1900-01-01');
        }
        // Handle strings
        else {
            valueA = String(valueA || '').toLowerCase();
            valueB = String(valueB || '').toLowerCase();
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    currentSort = { column, direction };
    currentPage = 1;
    updateTable();
}

// Pagination buttons
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateTable();
        }
    });
}

// Export functionality
if (exportBtn) {
    exportBtn.addEventListener('click', function() {
        if (filteredData.length === 0) {
            showErrorModal('No data available for export.');
            return;
        }
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
            'Owner Code': item.ownerCode,
            'Inbound No': item.inboundNo,
            'Received Date': item.receivedDate,
            'Invoice No': item.invoiceNo,
            'Qty': item.qty,
            'UID': item.uid
        })));
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inbound Report');
        
        // Generate file name with current date
        const fileName = `Inbound_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Export to file
        XLSX.writeFile(wb, fileName);
    });
}

// Help button
if (helpBtn) {
    helpBtn.addEventListener('click', function() {
        showModal(helpModal);
    });
}

// Modal functions
function showModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideModal(modal) {
    if (modal) {
        modal.style.display = 'none';
    }
}

function showSuccessModal(message) {
    if (successMessage) {
        successMessage.textContent = message;
    }
    showModal(successModal);
}

function showErrorModal(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    showModal(errorModal);
}

// Close modals when clicking on X
document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        hideModal(modal);
    });
});

// Close modals when clicking on buttons
document.querySelectorAll('.modal-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        hideModal(modal);
    });
});

// Close modals when clicking outside of content
window.addEventListener('click', function(event) {
    document.querySelectorAll('.modal').forEach(modal => {
        if (event.target === modal) {
            hideModal(modal);
        }
    });
});

// Helper functions
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    
    // Set user info (when not using auth)
    if (userInfoEl) {
        userInfoEl.textContent = `Login: ${currentUser.login}`;
    }
    
    // Add date filter modal
    addDateFilterModal();
    
    // Check if Firebase Auth is available
    if (typeof firebase.auth === 'function') {
        console.log('Firebase Auth is available, authenticating...');
        authenticateAnonymously();
    } else {
        console.error('Firebase Auth is not available');
        showErrorModal('Firebase Authentication is not available. Please ensure Firebase Auth library is loaded properly.');
        
        // Try to load data anyway (for demo purposes)
        setTimeout(() => {
            loadDataFromFirebase();
        }, 1000);
    }
});