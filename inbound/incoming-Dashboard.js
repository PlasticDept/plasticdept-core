// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDw17I5NwibE9BXl0YoILPQqoPQfCKH4Q",
  authDomain: "inbound-d8267.firebaseapp.com",
  databaseURL: "https://inbound-d8267-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "inbound-d8267",
  storageBucket: "inbound-d8267.appspot.com",
  messagingSenderId: "852665126418",
  appId: "1:852665126418:web:e4f029b83995e29f3052cb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM Elements
const yearSelect = document.getElementById('dashboard-year');
const monthSelect = document.getElementById('dashboard-month');
const totalContainerEl = document.getElementById('total-container');
const containerPalletizeEl = document.getElementById('container-palletize');
const containerNonPalletizeEl = document.getElementById('container-non-palletize');
const container20El = document.getElementById('container-20');
const container40El = document.getElementById('container-40');
const compareTableBody = document.getElementById('compare-table-body');

// Chart instances
let palletizeBarChart;
let palletizePieChart;
let feetBarChart;
let feetPieChart;
let compareBarChart;
let trendLineChart;

// Month mapping for database path
const monthNames = {
    1: "01_Jan",
    2: "02_Feb",
    3: "03_Mar",
    4: "04_Apr",
    5: "05_May",
    6: "06_Jun",
    7: "07_Jul",
    8: "08_Aug",
    9: "09_Sep",
    10: "10_Oct",
    11: "11_Nov",
    12: "12_Dec"
};

// Month names for display
const shortMonthNames = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec"
};

// Full month names for trend chart
const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Initialize dashboard when the page loads
document.addEventListener('DOMContentLoaded', initDashboard);

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    try {
        // Wait for authentication
        await new Promise((resolve, reject) => {
            onAuthStateChanged(auth, user => {
                if (user) {
                    console.log("✅ Logged in as anonymous");
                    resolve(user);
                } else {
                    signInAnonymously(auth)
                        .then(() => {
                            console.log("🔐 Anonymous login success");
                            resolve(null);
                        })
                        .catch(reject);
                }
            });
        });
        
        // Populate year and month dropdowns
        populateYearSelect();
        populateMonthSelect();
        
        // Set default values
        const currentDate = new Date();
        yearSelect.value = currentDate.getFullYear();
        monthSelect.value = currentDate.getMonth() + 1;
        
        // Add event listeners
        yearSelect.addEventListener('change', loadDashboardData);
        monthSelect.addEventListener('change', loadDashboardData);
        
        // Load initial dashboard data
        await loadDashboardData();
        
        console.log("Dashboard initialization complete");
        
    } catch (error) {
        console.error("Error initializing dashboard:", error);
    }
}

/**
 * Populate year dropdown with options
 */
function populateYearSelect() {
    const currentYear = new Date().getFullYear();
    
    // Populate years from 5 years ago to 1 year in the future
    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

/**
 * Populate month dropdown with options
 */
function populateMonthSelect() {
    const months = [
        { value: 1, name: 'January' },
        { value: 2, name: 'February' },
        { value: 3, name: 'March' },
        { value: 4, name: 'April' },
        { value: 5, name: 'May' },
        { value: 6, name: 'June' },
        { value: 7, name: 'July' },
        { value: 8, name: 'August' },
        { value: 9, name: 'September' },
        { value: 10, name: 'October' },
        { value: 11, name: 'November' },
        { value: 12, name: 'December' }
    ];
    
    for (const month of months) {
        const option = document.createElement('option');
        option.value = month.value;
        option.textContent = month.name;
        monthSelect.appendChild(option);
    }
}

/**
 * Calculate previous month and year
 */
function getPreviousMonth(year, month) {
    if (month === 1) {
        return { year: year - 1, month: 12 };
    } else {
        return { year: year, month: month - 1 };
    }
}

/**
 * Load dashboard data based on selected year and month
 */
async function loadDashboardData() {
    try {
        const selectedYear = parseInt(yearSelect.value);
        const selectedMonth = parseInt(monthSelect.value);
        
        // Get current month data
        const currentMonthData = await getMonthData(selectedYear, selectedMonth);
        
        // Update main dashboard with current month data
        updateCards(currentMonthData);
        updateCharts(currentMonthData);
        
        // Get data for previous two months for comparison
        const prevMonth = getPreviousMonth(selectedYear, selectedMonth);
        const prevPrevMonth = getPreviousMonth(prevMonth.year, prevMonth.month);
        
        const prevMonthData = await getMonthData(prevMonth.year, prevMonth.month);
        const prevPrevMonthData = await getMonthData(prevPrevMonth.year, prevPrevMonth.month);
        
        // Update comparison table and chart
        updateComparisonTable(prevMonthData, prevPrevMonthData, prevMonth, prevPrevMonth);
        updateComparisonChart(prevMonthData, prevPrevMonthData, prevMonth, prevPrevMonth);
        
        // Load trend data for the entire year
        await loadTrendData();
        
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        resetDashboard();
    }
}

/**
 * Load trend data for one year
 */
async function loadTrendData() {
    try {
        const selectedYear = parseInt(yearSelect.value);
        console.log(`Loading trend data for year ${selectedYear}`);
        
        // Array untuk menyimpan jumlah container per bulan
        const monthlyContainers = Array(12).fill(0);
        
        // Ambil data untuk setiap bulan dalam tahun
        for (let month = 1; month <= 12; month++) {
            const monthData = await getMonthData(selectedYear, month);
            monthlyContainers[month - 1] = monthData.length; // Jumlah container
        }
        
        console.log("Monthly container counts:", monthlyContainers);
        
        // Update trend chart
        updateTrendChart(monthlyContainers, selectedYear);
        
    } catch (error) {
        console.error("Error loading trend data:", error);
        resetTrendChart();
    }
}

/**
 * Get data for a specific month
 */
async function getMonthData(year, month) {
    const monthPath = monthNames[month];
    console.log(`Getting data for ${year}/${monthPath}`);
    
    // Get reference to path matching year and month
    const scheduleRef = ref(db, `incomingSchedule/${year}/${monthPath}`);
    const snapshot = await get(scheduleRef);
    
    if (snapshot.exists()) {
        console.log(`Data found for ${year}/${monthPath}`);
        
        // Process the data to extract container information
        const containersData = [];
        
        // Structure is typically incomingSchedule/year/month/day/container_id/details
        const daysData = snapshot.val();
        
        // Loop through all days in the month
        for (const day in daysData) {
            const containers = daysData[day];
            
            // Loop through all containers for the day
            for (const containerId in containers) {
                const containerData = containers[containerId];
                containersData.push(containerData);
            }
        }
        
        console.log(`Found ${containersData.length} containers for ${year}/${monthPath}`);
        return containersData;
    } else {
        console.log(`No data available for ${year}/${monthPath}`);
        return [];
    }
}

/**
 * Update card values based on filtered data
 */
function updateCards(data) {
    // 1. Total Container count
    const totalContainer = data.length;
    
    // 2. Container Palletize count
    const palletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('palletize') && 
        !item['Process Type']?.toLowerCase().includes('non')).length;
    
    // 3. Container Non Palletize count
    const nonPalletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('non palletize')).length;
    
    // 4. Container 20" count
    const container20Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('20') || feet.includes('1X20');
    }).length;
    
    // 5. Container 40" count
    const container40Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('40') || feet.includes('1X40');
    }).length;
    
    console.log("Card values:", {
        totalContainer,
        palletizeCount,
        nonPalletizeCount,
        container20Count,
        container40Count
    });
    
    // Update DOM elements
    totalContainerEl.textContent = totalContainer;
    containerPalletizeEl.textContent = palletizeCount;
    containerNonPalletizeEl.textContent = nonPalletizeCount;
    container20El.textContent = container20Count;
    container40El.textContent = container40Count;
}

/**
 * Calculate metrics for comparison
 */
function calculateMetrics(data) {
    const totalContainer = data.length;
    
    const palletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('palletize') && 
        !item['Process Type']?.toLowerCase().includes('non')).length;
    
    const nonPalletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('non palletize')).length;
    
    const container20Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('20') || feet.includes('1X20');
    }).length;
    
    const container40Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('40') || feet.includes('1X40');
    }).length;
    
    return {
        totalContainer,
        palletizeCount,
        nonPalletizeCount,
        container20Count,
        container40Count
    };
}

/**
 * Update comparison table
 */
function updateComparisonTable(currentData, prevData, currentMonthInfo, prevMonthInfo) {
    // Get metrics for both months
    const currentMetrics = calculateMetrics(currentData);
    const prevMetrics = calculateMetrics(prevData);
    
    // Get month names with year
    const currentMonthLabel = `${shortMonthNames[currentMonthInfo.month]}-${currentMonthInfo.year.toString().slice(-2)}`;
    const prevMonthLabel = `${shortMonthNames[prevMonthInfo.month]}-${prevMonthInfo.year.toString().slice(-2)}`;
    
    // Update table header - Mengubah urutan kolom menjadi bulan sebelumnya dulu
    const tableHeaders = document.querySelectorAll('.compare-table th');
    if (tableHeaders.length >= 3) {
        tableHeaders[1].textContent = prevMonthLabel;     // Bulan sebelumnya (Apr)
        tableHeaders[2].textContent = currentMonthLabel;  // Bulan terkini (May)
    }
    
    // Clear existing rows
    compareTableBody.innerHTML = '';
    
    // Data to display in table
    const comparisonData = [
        {
            name: 'Container',
            current: currentMetrics.totalContainer,
            prev: prevMetrics.totalContainer
        },
        {
            name: 'Palletize',
            current: currentMetrics.palletizeCount,
            prev: prevMetrics.palletizeCount
        },
        {
            name: 'Non Palletize',
            current: currentMetrics.nonPalletizeCount,
            prev: prevMetrics.nonPalletizeCount
        },
        {
            name: '20" (Feet)',
            current: currentMetrics.container20Count,
            prev: prevMetrics.container20Count
        },
        {
            name: '40" (Feet)',
            current: currentMetrics.container40Count,
            prev: prevMetrics.container40Count
        }
    ];
    
    // Create rows for each metric
    comparisonData.forEach(item => {
        // Calculate percentage change - dari prev ke current, karena urutan kolom diubah
        // Rumus: (current - prev) / prev * 100
        let percentageChange = 0;
        if (item.prev > 0) {
            percentageChange = ((item.current - item.prev) / item.prev) * 100;
        } else if (item.current > 0) {
            percentageChange = 100; // If previous is 0 and current is > 0, then 100% increase
        }
        
        // Round percentage to 1 decimal place
        percentageChange = Math.round(percentageChange * 10) / 10;
        
        // Determine status
        const isIncrease = percentageChange > 0;
        const isUnchanged = percentageChange === 0;
        const status = isUnchanged ? 'Unchanged' : (isIncrease ? 'Increased' : 'Decreased');
        
        // Create row
        const row = document.createElement('tr');
        
        // Cell for name
        const nameCell = document.createElement('td');
        nameCell.textContent = item.name;
        row.appendChild(nameCell);
        
        // Cell for PREVIOUS month value (now first)
        const prevCell = document.createElement('td');
        prevCell.textContent = item.prev;
        row.appendChild(prevCell);
        
        // Cell for CURRENT month value (now second)
        const currentCell = document.createElement('td');
        currentCell.textContent = item.current;
        row.appendChild(currentCell);
        
        // Cell for percentage
        const percentCell = document.createElement('td');
        percentCell.classList.add('percent-column');
        if (!isUnchanged) {
            const sign = isIncrease ? '+' : '-';
            percentCell.textContent = `${sign}${Math.abs(percentageChange)}%`;
            percentCell.style.color = isIncrease ? '#27ae60' : '#c0392b';
        } else {
            percentCell.textContent = '0.0%';
            percentCell.style.color = '#888';
        }
        row.appendChild(percentCell);
        
        // Cell for status
        const statusCell = document.createElement('td');
        statusCell.classList.add('status-column');
        
        // Add arrow and status
        if (!isUnchanged) {
            const arrow = document.createElement('span');
            arrow.classList.add('arrow');
            arrow.textContent = isIncrease ? '▲' : '▼';
            statusCell.appendChild(arrow);
        }
        
        const statusText = document.createElement('span');
        statusText.textContent = status;
        statusText.classList.add(isIncrease ? 'increase' : (isUnchanged ? 'unchanged' : 'decrease'));
        statusCell.appendChild(statusText);
        
        row.appendChild(statusCell);
        
        // Add row to table
        compareTableBody.appendChild(row);
    });
    
    return comparisonData;
}

/**
 * Update comparison bar chart
 */
function updateComparisonChart(currentData, prevData, currentMonthInfo, prevMonthInfo) {
    // Get metrics for both months
    const currentMetrics = calculateMetrics(currentData);
    const prevMetrics = calculateMetrics(prevData);
    
    // Get month names with year
    const currentMonthLabel = `${shortMonthNames[currentMonthInfo.month]}-${currentMonthInfo.year.toString().slice(-2)}`;
    const prevMonthLabel = `${shortMonthNames[prevMonthInfo.month]}-${prevMonthInfo.year.toString().slice(-2)}`;
    
    const ctx = document.getElementById('chart-compare-bar').getContext('2d');
    
    // Destroy existing chart if it exists
    if (compareBarChart) {
        compareBarChart.destroy();
    }
    
    // Create new chart - Mengubah urutan dataset untuk mencocokkan urutan di tabel
    compareBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Container', 'Palletize', 'Non Palletize', '20" (Feet)', '40" (Feet)'],
            datasets: [
                {
                    label: prevMonthLabel,  // Bulan sebelumnya dulu (Apr)
                    data: [
                        prevMetrics.totalContainer,
                        prevMetrics.palletizeCount,
                        prevMetrics.nonPalletizeCount,
                        prevMetrics.container20Count,
                        prevMetrics.container40Count
                    ],
                    backgroundColor: '#f38a4e', // Warna oranye untuk bulan sebelumnya
                    borderColor: '#e67535',
                    borderWidth: 1
                },
                {
                    label: currentMonthLabel, // Bulan terkini kedua (May)
                    data: [
                        currentMetrics.totalContainer,
                        currentMetrics.palletizeCount,
                        currentMetrics.nonPalletizeCount,
                        currentMetrics.container20Count,
                        currentMetrics.container40Count
                    ],
                    backgroundColor: '#5395d6', // Warna biru untuk bulan terkini
                    borderColor: '#3780c5',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12
                    }
                },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold'
                    },
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Update trend line chart
 */
function updateTrendChart(monthlyData, year) {
    const ctx = document.getElementById('chart-trend-line').getContext('2d');
    
    // Destroy existing chart if it exists
    if (trendLineChart) {
        trendLineChart.destroy();
    }
    
    // Create gradient fill
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(83, 149, 214, 0.6)');
    gradientFill.addColorStop(0.7, 'rgba(83, 149, 214, 0.1)');
    gradientFill.addColorStop(1, 'rgba(83, 149, 214, 0)');
    
    // Find min and max values for better axis scaling
    const maxValue = Math.max(...monthlyData) * 1.1; // Add 10% padding
    const minValue = Math.max(0, Math.min(...monthlyData) * 0.8); // Lower bound but not below 0
    
    // Create new chart
    trendLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fullMonthNames,
            datasets: [{
                label: `Total Containers ${year}`,
                data: monthlyData,
                borderColor: '#5395d6',
                backgroundColor: gradientFill,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#5395d6',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#5395d6',
                pointHoverBorderWidth: 3,
                tension: 0.3, // Makes the line smoother
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#333',
                    bodyColor: '#5395d6',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    borderColor: '#ddd',
                    borderWidth: 1,
                    caretSize: 8,
                    caretPadding: 8,
                    callbacks: {
                        title: function(context) {
                            return context[0].label + ' ' + year;
                        },
                        label: function(context) {
                            return 'Total Containers: ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: minValue,
                    max: maxValue,
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        padding: 10,
                        color: '#666'
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        padding: 5,
                        color: '#666'
                    }
                }
            }
        }
    });
}

/**
 * Update all charts based on filtered data
 */
function updateCharts(data) {
    const totalContainer = data.length;
    
    // Calculate counts
    const palletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('palletize') && 
        !item['Process Type']?.toLowerCase().includes('non')).length;
    
    const nonPalletizeCount = data.filter(item => 
        item['Process Type']?.toLowerCase().includes('non palletize')).length;
    
    const container20Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('20') || feet.includes('1X20');
    }).length;
    
    const container40Count = data.filter(item => {
        const feet = item.Feet?.toString() || '';
        return feet.includes('40') || feet.includes('1X40');
    }).length;
    
    // Calculate percentages
    const palletizePercentage = totalContainer > 0 ? Math.round((palletizeCount / totalContainer) * 100) : 0;
    const nonPalletizePercentage = totalContainer > 0 ? Math.round((nonPalletizeCount / totalContainer) * 100) : 0;
    
    const container20Percentage = totalContainer > 0 ? Math.round((container20Count / totalContainer) * 100) : 0;
    const container40Percentage = totalContainer > 0 ? Math.round((container40Count / totalContainer) * 100) : 0;
    
    console.log("Chart values:", {
        palletizeCount, nonPalletizeCount, palletizePercentage, nonPalletizePercentage,
        container20Count, container40Count, container20Percentage, container40Percentage
    });
    
    // Update all charts
    updatePalletizeBarChart(palletizeCount, nonPalletizeCount);
    updatePalletizePieChart(palletizePercentage, nonPalletizePercentage);
    updateFeetBarChart(container20Count, container40Count);
    updateFeetPieChart(container20Percentage, container40Percentage);
}

/**
 * Update bar chart for Container Packaging (Palletize vs Non Palletize)
 */
function updatePalletizeBarChart(palletizeCount, nonPalletizeCount) {
    const ctx = document.getElementById('chart-palletize-bar').getContext('2d');
    
    // Destroy existing chart if it exists
    if (palletizeBarChart) {
        palletizeBarChart.destroy();
    }
    
    // Create new chart
    palletizeBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['PALLETIZE', 'NON PALLETIZE'],
            datasets: [{
                data: [palletizeCount, nonPalletizeCount],
                backgroundColor: ['#5395d6', '#ffcc5a'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: '#000',
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    font: {
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Update pie chart for Container Packaging percentages
 */
function updatePalletizePieChart(palletizePercentage, nonPalletizePercentage) {
    const ctx = document.getElementById('chart-palletize-pie').getContext('2d');
    
    // Destroy existing chart if it exists
    if (palletizePieChart) {
        palletizePieChart.destroy();
    }
    
    // Create new chart
    palletizePieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['PALLETIZE', 'NON PALLETIZE'],
            datasets: [{
                data: [palletizePercentage, nonPalletizePercentage],
                backgroundColor: ['#5395d6', '#ffcc5a'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: (context) => {
                        // Darker text for light background colors
                        return context.dataset.backgroundColor[context.dataIndex] === '#ffcc5a' ? '#000' : '#fff';
                    },
                    formatter: (value) => value + '%',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Update bar chart for Container Size (20" vs 40")
 */
function updateFeetBarChart(container20Count, container40Count) {
    const ctx = document.getElementById('chart-feet-bar').getContext('2d');
    
    // Destroy existing chart if it exists
    if (feetBarChart) {
        feetBarChart.destroy();
    }
    
    // Create new chart
    feetBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['20"', '40"'],
            datasets: [{
                data: [container20Count, container40Count],
                backgroundColor: ['#bcbcbc', '#f38a4e'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: '#000',
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    font: {
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Update pie chart for Container Size percentages
 */
function updateFeetPieChart(container20Percentage, container40Percentage) {
    const ctx = document.getElementById('chart-feet-pie').getContext('2d');
    
    // Destroy existing chart if it exists
    if (feetPieChart) {
        feetPieChart.destroy();
    }
    
    // Create new chart
    feetPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['20"', '40"'],
            datasets: [{
                data: [container20Percentage, container40Percentage],
                backgroundColor: ['#bcbcbc', '#f38a4e'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: '#fff',
                    formatter: (value) => value + '%',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Reset trend chart to default state
 */
function resetTrendChart() {
    const ctx = document.getElementById('chart-trend-line').getContext('2d');
    
    // Destroy existing chart if it exists
    if (trendLineChart) {
        trendLineChart.destroy();
    }
    
    // Create gradient fill
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(83, 149, 214, 0.6)');
    gradientFill.addColorStop(0.7, 'rgba(83, 149, 214, 0.1)');
    gradientFill.addColorStop(1, 'rgba(83, 149, 214, 0)');
    
    // Create empty chart
    trendLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fullMonthNames,
            datasets: [{
                label: 'Total Containers',
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                borderColor: '#5395d6',
                backgroundColor: gradientFill,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#5395d6',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)',
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Reset dashboard to default state
 */
function resetDashboard() {
    // Reset card values
    totalContainerEl.textContent = '0';
    containerPalletizeEl.textContent = '0';
    containerNonPalletizeEl.textContent = '0';
    container20El.textContent = '0';
    container40El.textContent = '0';
    
    // Reset comparison table
    compareTableBody.innerHTML = '';
    
    // Destroy existing charts
    if (palletizeBarChart) palletizeBarChart.destroy();
    if (palletizePieChart) palletizePieChart.destroy();
    if (feetBarChart) feetBarChart.destroy();
    if (feetPieChart) feetPieChart.destroy();
    if (compareBarChart) compareBarChart.destroy();
    if (trendLineChart) trendLineChart.destroy();
    
    // Create empty charts
    updatePalletizeBarChart(0, 0);
    updatePalletizePieChart(0, 0);
    updateFeetBarChart(0, 0);
    updateFeetPieChart(0, 0);
    
    // Create empty comparison chart
    const ctx = document.getElementById('chart-compare-bar').getContext('2d');
    compareBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Container', 'Palletize', 'Non Palletize', '20" (Feet)', '40" (Feet)'],
            datasets: [
                {
                    label: 'Previous Month',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: '#f38a4e'
                },
                {
                    label: 'Current Month',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: '#5395d6'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Reset trend chart
    resetTrendChart();
}