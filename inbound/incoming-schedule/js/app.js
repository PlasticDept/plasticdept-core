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

// User info
const currentUser = {
    login: 'PlasticDept',
    timestamp: '2025-07-17 14:13:22'
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
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const userInfoEl = document.getElementById('userInfo');

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
    
    // Make sure firebase.auth is available before calling
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
                showErrorModal(`Gagal autentikasi: ${error.message}. Silakan muat ulang halaman.`);
                console.error('Authentication Error:', error);
            });
    } else {
        hideModal(loadingModal);
        showErrorModal('Firebase Authentication tidak tersedia. Pastikan library Firebase Auth dimuat dengan benar.');
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
        currentDateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
    
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    if (currentTimeEl) {
        currentTimeEl.textContent = now.toLocaleTimeString('id-ID', timeOptions);
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
                fileNameSpan.textContent = 'Belum ada file yang dipilih';
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
            showErrorModal('Anda belum terautentikasi. Silakan muat ulang halaman.');
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
                showErrorModal('Terjadi kesalahan saat membaca file: ' + error.message);
            }
        };
        
        reader.onerror = function() {
            hideModal(loadingModal);
            showErrorModal('Terjadi kesalahan saat membaca file.');
        };
        
        reader.readAsBinaryString(file);
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
            showErrorModal('Format file tidak valid. Header yang diperlukan tidak ditemukan.');
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
            showErrorModal('Tidak ada data valid yang ditemukan dalam file.');
            return;
        }
        
        // Save data to Firebase
        saveToFirebase(processedData, fileName);
        
    } catch (error) {
        hideModal(loadingModal);
        showErrorModal('Terjadi kesalahan saat memproses file: ' + error.message);
    }
}

// Save processed data to Firebase
function saveToFirebase(data, fileName) {
    if (!isAuthenticated) {
        hideModal(loadingModal);
        showErrorModal('Anda belum terautentikasi. Silakan muat ulang halaman.');
        return;
    }
    
    const uploadId = 'upload_' + new Date().getTime();
    const uploadRef = database.ref('inbDailyReport/' + uploadId);
    
    uploadRef.set({
        fileName: fileName,
        uploadDate: new Date().toISOString(),
        uploadedBy: currentUser.login,
        data: data
    })
    .then(() => {
        hideModal(loadingModal);
        showSuccessModal('Data berhasil diupload ke database. Total ' + data.length + ' data.');
        
        // Reset file input
        csvFileInput.value = '';
        fileNameSpan.textContent = 'Belum ada file yang dipilih';
        uploadBtn.disabled = true;
        
        // Reload data
        loadDataFromFirebase();
    })
    .catch(error => {
        hideModal(loadingModal);
        showErrorModal('Gagal menyimpan data ke database: ' + error.message);
    });
}

// Load data from Firebase
function loadDataFromFirebase() {
    if (!isAuthenticated) {
        showErrorModal('Anda belum terautentikasi. Silakan muat ulang halaman.');
        return;
    }
    
    showModal(loadingModal);
    
    database.ref('inbDailyReport').orderByChild('uploadDate').limitToLast(10).once('value')
        .then(snapshot => {
            inboundData = [];
            
            snapshot.forEach(childSnapshot => {
                const upload = childSnapshot.val();
                if (upload && upload.data && Array.isArray(upload.data)) {
                    upload.data.forEach(item => {
                        inboundData.push({
                            ...item,
                            uploadId: childSnapshot.key,
                            uploadDate: upload.uploadDate,
                            uploadedBy: upload.uploadedBy || 'Unknown'
                        });
                    });
                }
            });
            
            // Sort by received date (newest first)
            inboundData.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));
            
            filteredData = [...inboundData];
            updateTable();
            updateSummary();
            hideModal(loadingModal);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Gagal memuat data dari database: ' + error.message);
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
    tableBody.innerHTML = '';
    
    // Add data rows
    if (filteredData.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 6;
        emptyCell.textContent = 'Tidak ada data yang tersedia';
        emptyCell.style.textAlign = 'center';
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
    
    // Update pagination
    updatePagination(totalPages);
}

// Update pagination controls
function updatePagination(totalPages) {
    // Clear page numbers
    pageNumbersDiv.innerHTML = '';
    
    // Disable/enable previous and next buttons
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    
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
    const ellipsis = document.createElement('span');
    ellipsis.textContent = '...';
    ellipsis.classList.add('page-ellipsis');
    pageNumbersDiv.appendChild(ellipsis);
}

// Update summary data
function updateSummary() {
    if (filteredData.length === 0) {
        totalInboundEl.textContent = '0';
        totalQtyEl.textContent = '0';
        totalUIDEl.textContent = '0';
        ownerTotalEl.textContent = '0';
        return;
    }
    
    // Total inbound
    totalInboundEl.textContent = filteredData.length;
    
    // Total quantity
    const totalQty = filteredData.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    totalQtyEl.textContent = formatNumber(totalQty);
    
    // Total UID
    const totalUID = filteredData.reduce((sum, item) => sum + (parseInt(item.uid) || 0), 0);
    totalUIDEl.textContent = formatNumber(totalUID);
    
    // Count unique owners
    const uniqueOwners = new Set(filteredData.map(item => item.ownerCode));
    ownerTotalEl.textContent = uniqueOwners.size;
}

// Search functionality
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

// Filter by date
document.querySelectorAll('.dropdown-content a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.getAttribute('data-filter');
        applyDateFilter(filter);
    });
});

// Apply date filter
function applyDateFilter(filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    switch (filter) {
        case 'today':
            filteredData = inboundData.filter(item => {
                const itemDate = new Date(item.receivedDate);
                return itemDate.toDateString() === today.toDateString();
            });
            break;
        case 'week':
            filteredData = inboundData.filter(item => {
                const itemDate = new Date(item.receivedDate);
                return itemDate >= weekStart;
            });
            break;
        case 'month':
            filteredData = inboundData.filter(item => {
                const itemDate = new Date(item.receivedDate);
                return itemDate >= monthStart;
            });
            break;
        default:
            filteredData = [...inboundData];
    }
    
    currentPage = 1;
    updateTable();
    updateSummary();
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
prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
        currentPage--;
        updateTable();
    }
});

nextPageBtn.addEventListener('click', function() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateTable();
    }
});

// Export functionality
exportBtn.addEventListener('click', function() {
    if (filteredData.length === 0) {
        showErrorModal('Tidak ada data untuk diekspor.');
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
    
    // Generate file name
    const fileName = 'Inbound_Report_' + new Date().toISOString().split('T')[0] + '.xlsx';
    
    // Export to file
    XLSX.writeFile(wb, fileName);
});

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking authentication capabilities...');
    
    // Check if Firebase Auth is available
    if (typeof firebase.auth === 'function') {
        console.log('Firebase Auth is available, authenticating...');
        authenticateAnonymously();
    } else {
        console.error('Firebase Auth is not available');
        showErrorModal('Firebase Authentication tidak tersedia. Pastikan library Firebase Auth dimuat dengan benar.');
    }
});

// Helper functions for modals
function showModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error('Modal element not found');
    }
}

function hideModal(modal) {
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error('Modal element not found');
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
    
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatNumber(number) {
    return new Intl.NumberFormat('id-ID').format(number);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    authenticateAnonymously();
});