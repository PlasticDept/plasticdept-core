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
const rowsPerPage = 1000;
let currentSort = { column: null, direction: 'asc' };
let isAuthenticated = false;

// Authenticate anonymously with Firebase
function authenticateAnonymously() {
    showLoading("Melakukan autentikasi...");
    
    if (typeof firebase.auth === 'function') {
        firebase.auth().signInAnonymously()
            .then(() => {
                console.log('Authenticated anonymously');
                isAuthenticated = true;
                hideLoading();
                
                // Set user info in the header
                if (userInfoEl) {
                    userInfoEl.textContent = `Login: ${currentUser.login}`;
                }
                
                // Now that we're authenticated, load data
                loadDataFromFirebase();
            })
            .catch((error) => {
                hideLoading();
                showErrorModal(`Authentication failed: ${error.message}. Please refresh the page.`);
                console.error('Authentication Error:', error);
            });
    } else {
        hideLoading();
        showErrorModal('Firebase Authentication is not available. Please ensure Firebase Auth library is loaded properly.');
        console.error('Firebase Auth not available');
    }
}

// Fungsi yang ditingkatkan untuk menampilkan loading modal dengan pesan khusus
function showLoading(message = "Memuat data inbound...") {
    const loadingMessage = document.querySelector('.loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = message;
    }
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.style.display = 'flex';
    }
}

// Fungsi untuk menyembunyikan loading
function hideLoading() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.style.display = 'none';
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
        
        showLoading("Memuat data inbound...");
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                processData(data, file.name);
            } catch (error) {
                hideLoading();
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
        
        // Temukan header row dan kolom indeks
        let headerRowIndex = -1;
        let ownerCodeIndex = -1;
        let inboundNoIndex = -1;
        let putawayDateIndex = -1;
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
                putawayDateIndex = row.indexOf('putaway date');
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
        
        // Kumpulkan data mentah
        const rawData = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0 || !row[ownerCodeIndex]) continue;
            
            const ownerCode = row[ownerCodeIndex];
            const inboundNo = row[inboundNoIndex];
            
            if (!ownerCode || !inboundNo) continue;
            
            // Format putaway date
            let putawayDate = row[putawayDateIndex];
            if (putawayDate) {
                if (typeof putawayDate === 'object' && putawayDate instanceof Date) {
                    putawayDate = putawayDate.toISOString().split('T')[0];
                } else if (typeof putawayDate === 'number') {
                    putawayDate = new Date(Math.round((putawayDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                } else if (typeof putawayDate === 'string') {
                    // Pastikan format tanggal konsisten (YYYY-MM-DD)
                    const dateMatch = putawayDate.match(/(\d{4})-(\d{2})-(\d{2})/);
                    if (dateMatch) {
                        putawayDate = dateMatch[0]; // Sudah dalam format YYYY-MM-DD
                    } else {
                        // Coba format lain seperti DD/MM/YYYY atau MM/DD/YYYY
                        const parts = putawayDate.split(/[\/\-\.]/);
                        if (parts.length === 3) {
                            // Asumsikan format adalah YYYY-MM-DD jika tahun terlihat seperti 4 digit di awal
                            if (parts[0].length === 4) {
                                putawayDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            }
                            // Asumsikan format adalah DD-MM-YYYY jika angka pertama <= 31
                            else if (parseInt(parts[0]) <= 31) {
                                putawayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                        }
                    }
                }
            }
            
            // Format received date
            let receivedDate = row[receivedDateIndex];
            if (receivedDate) {
                if (typeof receivedDate === 'object' && receivedDate instanceof Date) {
                    receivedDate = receivedDate.toISOString().split('T')[0];
                } else if (typeof receivedDate === 'number') {
                    receivedDate = new Date(Math.round((receivedDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                } else if (typeof receivedDate === 'string') {
                    // Pastikan format tanggal konsisten (YYYY-MM-DD)
                    const dateMatch = receivedDate.match(/(\d{4})-(\d{2})-(\d{2})/);
                    if (dateMatch) {
                        receivedDate = dateMatch[0]; // Sudah dalam format YYYY-MM-DD
                    } else {
                        // Coba format lain seperti yang dilakukan pada putawayDate
                        const parts = receivedDate.split(/[\/\-\.]/);
                        if (parts.length === 3) {
                            if (parts[0].length === 4) {
                                receivedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            }
                            else if (parseInt(parts[0]) <= 31) {
                                receivedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                        }
                    }
                }
            }
            
            // Format quantity
            let qty = row[totalQtyIndex];
            if (typeof qty === 'string') {
                // Hapus semua karakter non-numerik kecuali titik desimal
                qty = parseFloat(qty.replace(/[^\d.-]/g, '')) || 0;
            } else {
                qty = parseFloat(qty) || 0;
            }
            
            // Format UID count
            let uidCount = row[uidCountIndex];
            if (typeof uidCount === 'string') {
                uidCount = parseInt(uidCount.replace(/[^\d.-]/g, '')) || 0;
            } else {
                uidCount = parseInt(uidCount) || 0;
            }
            
            rawData.push({
                ownerCode: ownerCode,
                inboundNo: inboundNo,
                putawayDate: putawayDate || '',
                receivedDate: receivedDate || '',
                invoiceNo: row[inboundRefNoIndex] || '',
                qty: qty,
                uid: uidCount,
                timestamp: new Date().toISOString(),
                uploadedBy: currentUser.login
            });
        }
        
        if (rawData.length === 0) {
            hideModal(loadingModal);
            showErrorModal('No valid data found in the file.');
            return;
        }
        
        // Agregasi data menggunakan logika pivot
        const pivotedData = pivotInboundData(rawData);
        
        // Simpan data yang sudah diagregasi ke Firebase
        saveToFirebase(pivotedData, fileName);
        
    } catch (error) {
        hideModal(loadingModal);
        showErrorModal('Error processing file: ' + error.message);
    }
}

// Fungsi untuk melakukan pivot/agregasi data berdasarkan nomor inbound
function pivotInboundData(rawData) {
    // Kelompokkan data berdasarkan inboundNo
    const groupedByInbound = {};
    
    // Kumpulkan semua owner code yang unik untuk menghitung jumlahnya nanti
    const uniqueOwners = new Set();
    
    // Loop melalui semua data mentah
    rawData.forEach(item => {
        // Tambahkan owner ke set unik
        uniqueOwners.add(item.ownerCode);
        
        // Jika inbound number belum ada dalam kelompok, buat entri baru
        if (!groupedByInbound[item.inboundNo]) {
            groupedByInbound[item.inboundNo] = {
                inboundNo: item.inboundNo,
                ownerCode: item.ownerCode,
                putawayDate: item.putawayDate,
                receivedDate: item.receivedDate,
                invoiceNo: item.invoiceNo,
                qty: 0, // Mulai dari 0 untuk dijumlahkan
                uid: 0, // Mulai dari 0 untuk dijumlahkan
                timestamp: item.timestamp,
                uploadedBy: item.uploadedBy,
                detailRows: [] // Simpan semua baris detail untuk referensi
            };
        }
        
        // Tambahkan kuantitas dan UID ke total inbound
        groupedByInbound[item.inboundNo].qty += item.qty;
        groupedByInbound[item.inboundNo].uid += item.uid;
        
        // Simpan baris detail
        groupedByInbound[item.inboundNo].detailRows.push(item);
    });
    
    // Konversi kelompok menjadi array
    const pivotedArray = Object.values(groupedByInbound);
    
    console.log(`Data after pivot: ${pivotedArray.length} inbound numbers from ${rawData.length} raw rows`);
    console.log(`Total unique owners: ${uniqueOwners.size}`);
    
    return pivotedArray;
}

// Fungsi untuk memperbarui tampilan ringkasan yang benar
function updateSummary(data = null) {
    // Jika data tidak disediakan, gunakan filteredData
    const summaryData = data || filteredData;
    
    if (!summaryData || summaryData.length === 0) {
        if (totalInboundEl) totalInboundEl.textContent = '0';
        if (totalQtyEl) totalQtyEl.textContent = '0';
        if (totalUIDEl) totalUIDEl.textContent = '0';
        if (ownerTotalEl) ownerTotalEl.textContent = '0';
        return;
    }
    
    // Total inbound (jumlah nomor inbound unik)
    if (totalInboundEl) {
        totalInboundEl.textContent = summaryData.length;
    }
    
    // Total quantity (jumlah semua qty)
    const totalQty = summaryData.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    if (totalQtyEl) {
        totalQtyEl.textContent = formatNumber(totalQty);
    }
    
    // Total UID (jumlah semua UID)
    const totalUID = summaryData.reduce((sum, item) => sum + (parseInt(item.uid) || 0), 0);
    if (totalUIDEl) {
        totalUIDEl.textContent = formatNumber(totalUID);
    }
    
    // Jumlah owner unik
    const uniqueOwners = new Set(summaryData.map(item => item.ownerCode));
    if (ownerTotalEl) {
        ownerTotalEl.textContent = uniqueOwners.size;
    }
}

// Save processed data to Firebase dengan struktur baru berdasarkan tanggal
function saveToFirebase(data, fileName) {
    if (!isAuthenticated) {
        hideModal(loadingModal);
        showErrorModal('You are not authenticated. Please refresh the page.');
        return;
    }
    
    // Update progress bar
    if (progressBar) {
        progressBar.style.width = '20%';
    }
    if (statusMessage) {
        statusMessage.textContent = 'Processing data by date...';
    }
    
    // Kelompokkan data berdasarkan tanggal putaway
    const dataByDate = {};
    
    // Mengelompokkan data berdasarkan putawayDate
    data.forEach(item => {
        if (!item.putawayDate) {
            console.warn('Item without putaway date:', item);
            return;
        }
        
        // Format tanggal dari putawayDate
        const dateObj = new Date(item.putawayDate);
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid putaway date format:', item.putawayDate, item);
            return;
        }
        
        const year = dateObj.getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = String(dateObj.getMonth() + 1).padStart(2, '0') + "_" + monthNames[dateObj.getMonth()];
        const day = String(dateObj.getDate()).padStart(2, '0');
        
        const datePath = `${year}/${month}/${day}`;
        
        if (!dataByDate[datePath]) {
            dataByDate[datePath] = [];
        }
        
        dataByDate[datePath].push(item);
    });
    
    if (Object.keys(dataByDate).length === 0) {
        hideModal(loadingModal);
        showErrorModal('No valid data with putaway dates found.');
        return;
    }
    
    // Update progress bar
    if (progressBar) {
        progressBar.style.width = '30%';
    }
    if (statusMessage) {
        statusMessage.textContent = `Preparing to upload data for ${Object.keys(dataByDate).length} dates...`;
    }
    
    // Menyimpan data berdasarkan tanggal
    const datePromises = [];
    const totalDates = Object.keys(dataByDate).length;
    let processedDates = 0;
    let totalRecordsUploaded = 0;
    let totalRecordsReplaced = 0;
    
    // Untuk setiap tanggal, periksa dan simpan data
    Object.entries(dataByDate).forEach(([datePath, dateData]) => {
        const dbPath = `inbDailyReport/${datePath}`;
        
        // Buat promise untuk proses overwrite dan upload data
        const datePromise = new Promise((resolve, reject) => {
            // Periksa apakah ada data di path ini
            database.ref(dbPath).once('value')
                .then(snapshot => {
                    let overwritePromise;
                    let recordsReplaced = 0;
                    
                    if (snapshot.exists()) {
                        recordsReplaced = snapshot.numChildren();
                        totalRecordsReplaced += recordsReplaced;
                        // Ada data untuk tanggal ini, perlu dihapus terlebih dahulu
                        overwritePromise = database.ref(dbPath).remove();
                    } else {
                        // Tidak ada data untuk dihapus
                        overwritePromise = Promise.resolve();
                    }
                    
                    // Setelah penghapusan (jika diperlukan), tambahkan data baru
                    overwritePromise.then(() => {
                        const promises = [];
                        
                        // Upload semua data baru untuk tanggal ini
                        dateData.forEach(item => {
                            const itemPath = `${dbPath}/${item.inboundNo}`;
                            
                            // Simpan data ke Firebase
                            const promise = database.ref(itemPath).set({
                                inboundNo: item.inboundNo,
                                ownerCode: item.ownerCode,
                                putawayDate: item.putawayDate,
                                receivedDate: item.receivedDate,
                                invoiceNo: item.invoiceNo,
                                qty: item.qty,
                                uid: item.uid,
                                timestamp: new Date().toISOString(),
                                uploadedBy: currentUser.login
                            });
                            
                            promises.push(promise);
                        });
                        
                        // Tunggu semua promises selesai untuk tanggal ini
                        Promise.all(promises)
                            .then(() => {
                                processedDates++;
                                totalRecordsUploaded += dateData.length;
                                
                                // Update progress
                                if (progressBar) {
                                    const progress = 30 + (processedDates / totalDates * 60);
                                    progressBar.style.width = `${progress}%`;
                                }
                                
                                if (statusMessage) {
                                    statusMessage.textContent = `Processed ${processedDates} of ${totalDates} dates...`;
                                }
                                
                                // Resolve dengan informasi apa yang dilakukan
                                resolve({
                                    datePath,
                                    recordsUploaded: dateData.length,
                                    recordsReplaced
                                });
                            })
                            .catch(error => {
                                reject(`Failed to upload data for ${datePath}: ${error.message}`);
                            });
                    }).catch(error => {
                        reject(`Failed to overwrite existing data for ${datePath}: ${error.message}`);
                    });
                })
                .catch(error => {
                    reject(`Failed to check for existing data for ${datePath}: ${error.message}`);
                });
        });
        
        datePromises.push(datePromise);
    });
    
    // Tunggu semua promises untuk semua tanggal selesai
    Promise.all(datePromises)
        .then((results) => {
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
                
                // Tampilkan pesan sukses dengan informasi lengkap
                const successMsg = 
                    `Upload successful! ${results.length} dates processed.` +
                    `\nTotal ${totalRecordsUploaded} records saved.` + 
                    (totalRecordsReplaced > 0 ? `\n${totalRecordsReplaced} existing records were replaced.` : '');
                
                showSuccessModal(successMsg);
                
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
                
                // Reload data dengan filter yang lebih luas untuk menampilkan semua data baru
                loadDataFromLargerDateRange();
            }, 800);
        })
        .catch(error => {
            hideModal(loadingModal);
            showErrorModal('Failed during data upload process: ' + error);
        });
}

// Fungsi untuk memuat data dari rentang tanggal yang lebih besar
function loadDataFromLargerDateRange() {
    // Dapatkan tanggal 60 hari ke belakang untuk menampilkan semua data yang diupload
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 60); // Muat data dari 60 hari terakhir
    
    const filterParams = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
    
    loadDataFromFirebase(filterParams);
}

// Load data from Firebase based on filter parameters
function loadDataFromFirebase(filterParams = {}) {
    if (!isAuthenticated) {
        showErrorModal('You are not authenticated. Please refresh the page.');
        return;
    }
    
    showLoading("Memuat data dari database...");
    
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
            hideLoading();
        })
        .catch(error => {
            hideLoading();
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
    // Tampilkan semua data
    const startIndex = 0;
    const endIndex = filteredData.length;
    
    // Bersihkan body tabel
    if (tableBody) {
        tableBody.innerHTML = '';
        
        // Tambahkan baris data
        if (filteredData.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 7; // Ubah dari 6 menjadi 7 karena kolom tambahan
            emptyCell.textContent = 'No data available';
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '32px';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
        } else {
            for (let i = startIndex; i < endIndex; i++) {
                const item = filteredData[i];
                const row = document.createElement('tr');
                
                // Buat sel-sel
                const ownerCodeCell = document.createElement('td');
                ownerCodeCell.textContent = item.ownerCode;
                
                const inboundNoCell = document.createElement('td');
                inboundNoCell.textContent = item.inboundNo;
                
                // Tambahkan putawayDateCell
                const putawayDateCell = document.createElement('td');
                putawayDateCell.textContent = formatDate(item.putawayDate);
                
                const receivedDateCell = document.createElement('td');
                receivedDateCell.textContent = formatDate(item.receivedDate);
                
                const invoiceNoCell = document.createElement('td');
                invoiceNoCell.textContent = item.invoiceNo;
                
                const qtyCell = document.createElement('td');
                qtyCell.textContent = formatNumber(item.qty);
                
                const uidCell = document.createElement('td');
                uidCell.textContent = formatNumber(item.uid);
                
                // Tambahkan sel ke baris
                row.appendChild(ownerCodeCell);
                row.appendChild(inboundNoCell);
                row.appendChild(putawayDateCell);
                row.appendChild(receivedDateCell);
                row.appendChild(invoiceNoCell);
                row.appendChild(qtyCell);
                row.appendChild(uidCell);
                
                // Tambahkan baris ke body tabel
                tableBody.appendChild(row);
            }
        }
    }
    
    // Update info tabel
    updateTableInfo();
}

// Perbarui tampilan info tabel
function updateTableInfo() {
    const totalRecords = filteredData.length;
    
    if (currentRangeEl) {
        if (totalRecords === 0) {
            currentRangeEl.textContent = "0-0";
        } else {
            currentRangeEl.textContent = `1-${totalRecords}`;
        }
    }
    
    if (totalRecordsEl) {
        totalRecordsEl.textContent = totalRecords;
    }
}

// Sembunyikan kontrol pagination yang tidak diperlukan
function hideUnneededPagination() {
    const pagination = document.querySelector('.pagination');
    if (pagination) {
        pagination.style.display = 'none';
    }
    
    // Jika masih ada tampilan pagination di bagian bawah tabel, hilangkan juga
    const pageNumbers = document.getElementById('pageNumbers');
    if (pageNumbers) {
        pageNumbers.style.display = 'none';
    }
    
    const prevPageBtn = document.getElementById('prevPage');
    if (prevPageBtn) {
        prevPageBtn.style.display = 'none';
    }
    
    const nextPageBtn = document.getElementById('nextPage');
    if (nextPageBtn) {
        nextPageBtn.style.display = 'none';
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
        else if (column === 'receivedDate' || column === 'putawayDate') {
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
            'Putaway Date': item.putawayDate,
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

// Format angka dengan pemisah ribuan
function formatNumber(number) {
    const num = parseFloat(number);
    if (isNaN(num)) return '0';
    
    return new Intl.NumberFormat('en-US').format(num);
}

// Format tanggal untuk tampilan tombol filter
function formatDateForDisplay(date) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// CALENDAR DATE PICKER IMPLEMENTATION
// -----------------------------------

// Create and initialize the calendar date picker
function createCalendarDatePicker() {
    // Create the calendar container
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'date-picker-container';
    calendarContainer.id = 'datePicker';
    
    // Create calendar structure
    calendarContainer.innerHTML = `
        <div class="date-picker-header">
            <button class="nav-btn prev-month"><i class="fas fa-chevron-left"></i></button>
            <div class="month-year-selector">
                <select class="month-selector" id="monthSelector">
                    <option value="0">January</option>
                    <option value="1">February</option>
                    <option value="2">March</option>
                    <option value="3">April</option>
                    <option value="4">May</option>
                    <option value="5">June</option>
                    <option value="6">July</option>
                    <option value="7">August</option>
                    <option value="8">September</option>
                    <option value="9">October</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                </select>
                <select class="year-selector" id="yearSelector"></select>
            </div>
            <button class="nav-btn next-month"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="calendar-content">
            <div class="calendar-grid">
                <div class="weekdays">
                    <div>Su</div>
                    <div>Mo</div>
                    <div>Tu</div>
                    <div>We</div>
                    <div>Th</div>
                    <div>Fr</div>
                    <div>Sa</div>
                </div>
                <div class="days" id="calendarDays"></div>
            </div>
        </div>
        <div class="calendar-footer">
            <button class="btn btn-secondary" id="cancelCalendarBtn">Cancel</button>
            <button class="btn btn-primary" id="applyCalendarBtn">Apply</button>
        </div>
    `;
    
    // Tambahkan style untuk fix calendar content
    const contentStyle = document.createElement('style');
    contentStyle.textContent = `
        .date-picker-container {
            display: none;
            flex-direction: column;
        }
        
        .calendar-content {
            overflow-y: auto;
            min-height: 200px;
            max-height: 300px;
        }
        
        .calendar-footer {
            position: sticky;
            bottom: 0;
            background-color: white;
            padding: 8px;
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid var(--border-color);
            z-index: 2;
        }
    `;
    document.head.appendChild(contentStyle);
    
    // Append the calendar to the dropdown container
    const dropdown = document.querySelector('.dropdown');
    if (dropdown) {
        dropdown.style.position = 'relative';
        dropdown.appendChild(calendarContainer);
    }
    
    // Populate year selector
    const yearSelector = document.getElementById('yearSelector');
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 2; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    }
    
    // Set current month and year
    const today = new Date();
    const monthSelector = document.getElementById('monthSelector');
    monthSelector.value = today.getMonth();
    yearSelector.value = today.getFullYear();
    
    // Initialize calendar
    renderCalendarDays(today.getFullYear(), today.getMonth());
    
    // Add event listeners
    addCalendarEventListeners();
}

// Render calendar days for a specific month and year
function renderCalendarDays(year, month) {
    const daysContainer = document.getElementById('calendarDays');
    if (!daysContainer) return;
    
    daysContainer.innerHTML = '';
    
    // Get the first day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Get the last day of the previous month
    const lastDayOfPrevMonth = new Date(year, month, 0).getDate();
    
    // Current date for highlighting today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ensure we always display 6 weeks (42 days) for consistent height
    // First, add days from previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
        const prevMonthDay = lastDayOfPrevMonth - firstDayOfWeek + i + 1;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        
        const dayElement = document.createElement('div');
        dayElement.className = 'day other-month';
        dayElement.textContent = prevMonthDay;
        
        const formattedMonth = (prevMonth + 1).toString().padStart(2, '0');
        const formattedDay = prevMonthDay.toString().padStart(2, '0');
        const dateStr = `${prevYear}-${formattedMonth}-${formattedDay}`;
        dayElement.dataset.date = dateStr;
        
        // Make previous month days clickable too
        dayElement.addEventListener('click', selectDay);
        
        daysContainer.appendChild(dayElement);
    }
    
    // Add days for current month
    const selectedDate = document.querySelector('.day.selected')?.dataset.date;
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.textContent = day;
        
        // Format date as YYYY-MM-DD
        const formattedMonth = (month + 1).toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');
        const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
        dayElement.dataset.date = dateStr;
        
        // Check if this is today
        const checkDate = new Date(year, month, day);
        checkDate.setHours(0, 0, 0, 0);
        if (checkDate.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }
        
        // Check if this is the selected date
        if (dateStr === selectedDate) {
            dayElement.classList.add('selected');
        }
        
        // Add click event
        dayElement.addEventListener('click', selectDay);
        
        daysContainer.appendChild(dayElement);
    }
    
    // Calculate remaining days needed to complete the grid (always show 6 rows)
    const totalDaysShown = firstDayOfWeek + lastDayOfMonth.getDate();
    const daysToAdd = 42 - totalDaysShown; // 42 = 6 rows * 7 days
    
    // Add days from next month
    for (let day = 1; day <= daysToAdd; day++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        
        const dayElement = document.createElement('div');
        dayElement.className = 'day other-month';
        dayElement.textContent = day;
        
        const formattedMonth = (nextMonth + 1).toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');
        const dateStr = `${nextYear}-${formattedMonth}-${formattedDay}`;
        dayElement.dataset.date = dateStr;
        
        // Make next month days clickable too
        dayElement.addEventListener('click', selectDay);
        
        daysContainer.appendChild(dayElement);
    }
}

// Add event listeners for calendar navigation and selection
function addCalendarEventListeners() {
    // Month and Year selector change events
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    
    if (monthSelector) {
        monthSelector.addEventListener('change', function() {
            renderCalendarDays(parseInt(yearSelector.value), parseInt(this.value));
        });
    }
    
    if (yearSelector) {
        yearSelector.addEventListener('change', function() {
            renderCalendarDays(parseInt(this.value), parseInt(monthSelector.value));
        });
    }
    
    // Previous month button
    const prevMonthBtn = document.querySelector('.prev-month');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function() {
            let month = parseInt(monthSelector.value);
            let year = parseInt(yearSelector.value);
            
            if (month === 0) {
                month = 11;
                year--;
                yearSelector.value = year;
            } else {
                month--;
            }
            
            monthSelector.value = month;
            renderCalendarDays(year, month);
        });
    }
    
    // Next month button
    const nextMonthBtn = document.querySelector('.next-month');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function() {
            let month = parseInt(monthSelector.value);
            let year = parseInt(yearSelector.value);
            
            if (month === 11) {
                month = 0;
                year++;
                yearSelector.value = year;
            } else {
                month++;
            }
            
            monthSelector.value = month;
            renderCalendarDays(year, month);
        });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancelCalendarBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            document.getElementById('datePicker').style.display = 'none';
        });
    }
    
    // Apply button
    const applyBtn = document.getElementById('applyCalendarBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            const selectedDay = document.querySelector('.day.selected');
            if (selectedDay) {
                // Get the selected date
                const dateStr = selectedDay.dataset.date;
                if (dateStr) {
                    const [year, month, day] = dateStr.split('-').map(Number);
                    
                    // Format date for filter
                    const selectedDate = new Date(year, month - 1, day);
                    const formattedDate = formatDateForDisplay(selectedDate);
                    
                    // Update filter button text
                    const filterBtn = document.querySelector('.dropdown-toggle');
                    if (filterBtn) {
                        filterBtn.innerHTML = `<i class="fas fa-filter"></i> ${formattedDate}`;
                        filterBtn.classList.add('filter-active');
                    }
                    
                    // Apply the filter
                    applyDateFilterFromCalendar(selectedDate);
                }
            }
            
            // Hide the calendar
            document.getElementById('datePicker').style.display = 'none';
        });
    }
    
    // Click outside to close
    document.addEventListener('click', function(event) {
        const datePicker = document.getElementById('datePicker');
        const filterBtn = document.querySelector('.dropdown-toggle');
        
        if (datePicker && datePicker.style.display === 'block' && 
            !datePicker.contains(event.target) && 
            filterBtn !== event.target && 
            !filterBtn.contains(event.target)) {
            datePicker.style.display = 'none';
        }
    });
}

// Handler for day selection in calendar
function selectDay(event) {
    // Remove selected class from all days
    document.querySelectorAll('.day').forEach(day => day.classList.remove('selected'));
    
    // Add selected class to clicked day
    event.target.classList.add('selected');
}

// Apply filter based on selected date from calendar
function applyDateFilterFromCalendar(selectedDate) {
    // Format for Firebase path
    const year = selectedDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0') + "_" + monthNames[selectedDate.getMonth()];
    const day = String(selectedDate.getDate()).padStart(2, '0');
    
    // Load data for selected date
    loadDataByDay(year, month, day);
}

// Menambahkan fungsi untuk menangani positioning kalender
function positionCalendar() {
    const datePicker = document.getElementById('datePicker');
    const dropdown = document.querySelector('.dropdown');
    
    if (!datePicker || !dropdown) return;
    
    // Set style untuk memastikan kalender muncul di posisi yang tepat dan tidak terpotong
    datePicker.style.position = 'absolute';
    datePicker.style.right = '0';
    datePicker.style.top = '100%';
    datePicker.style.zIndex = '1000';
    
    // Pastikan kalender tidak terpotong dengan memeriksa posisinya terhadap viewport
    setTimeout(() => {
        const rect = datePicker.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Jika kalender terpotong di bagian bawah
        if (rect.bottom > viewportHeight) {
            const overflowAmount = rect.bottom - viewportHeight;
            
            // Opsi 1: Posisikan kalender di atas tombol filter jika space cukup
            if (rect.top > rect.height) {
                datePicker.style.top = 'auto';
                datePicker.style.bottom = '100%';
            }
            // Opsi 2: Atur maksimum tinggi kalender dan aktifkan scrolling
            else {
                datePicker.style.maxHeight = `${viewportHeight - rect.top - 20}px`;
                datePicker.style.overflowY = 'auto';
            }
        }
    }, 0);
}

// Toggle calendar visibility when filter button is clicked
function toggleCalendar() {
    // Remove old dropdown behavior first
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (dropdownContent) {
        dropdownContent.style.display = 'none'; // Hide the dropdown content
    }
    
    if (dropdownToggle) {
        // Remove existing event listeners by cloning and replacing
        const newDropdownToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newDropdownToggle, dropdownToggle);
        
        // Add new event listener for calendar toggle
        newDropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const datePicker = document.getElementById('datePicker');
            if (datePicker) {
                datePicker.style.display = datePicker.style.display === 'block' ? 'none' : 'block';
            }
        });
    }
}

// Initialize the page
// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    
    // Set user info (when not using auth)
    if (userInfoEl) {
        userInfoEl.textContent = `Login: ${currentUser.login}`;
    }
    
    // Create and setup calendar date picker
    createCalendarDatePicker();
    
    // Setup the filter button to show calendar
    toggleCalendar();
    
    // Hide unneeded pagination
    hideUnneededPagination();
    
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