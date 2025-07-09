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

// Chart instances
let palletizeBarChart;
let palletizePieChart;
let feetBarChart;
let feetPieChart;

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
 * Load dashboard data based on selected year and month
 */
async function loadDashboardData() {
    try {
        const selectedYear = yearSelect.value;
        const selectedMonthNum = parseInt(monthSelect.value);
        const selectedMonthPath = monthNames[selectedMonthNum];
        
        console.log(`Loading data for ${selectedYear}/${selectedMonthPath}`);
        
        // Get reference to path matching year and month
        const scheduleRef = ref(db, `incomingSchedule/${selectedYear}/${selectedMonthPath}`);
        const snapshot = await get(scheduleRef);
        
        if (snapshot.exists()) {
            console.log("Data found for selected period");
            
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
            
            console.log(`Found ${containersData.length} containers for ${selectedYear}/${selectedMonthPath}`);
            
            // Update UI with container data
            updateCards(containersData);
            updateCharts(containersData);
        } else {
            console.log(`No data available for ${selectedYear}/${selectedMonthPath}`);
            resetDashboard();
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        resetDashboard();
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
 * Reset dashboard to default state
 */
function resetDashboard() {
    // Reset card values
    totalContainerEl.textContent = '0';
    containerPalletizeEl.textContent = '0';
    containerNonPalletizeEl.textContent = '0';
    container20El.textContent = '0';
    container40El.textContent = '0';
    
    // Destroy existing charts
    if (palletizeBarChart) palletizeBarChart.destroy();
    if (palletizePieChart) palletizePieChart.destroy();
    if (feetBarChart) feetBarChart.destroy();
    if (feetPieChart) feetPieChart.destroy();
    
    // Create empty charts
    updatePalletizeBarChart(0, 0);
    updatePalletizePieChart(0, 0);
    updateFeetBarChart(0, 0);
    updateFeetPieChart(0, 0);
}