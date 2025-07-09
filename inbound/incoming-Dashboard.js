// incoming-Dashboard.js

// Dummy initial data for static display (replace with Firebase fetch logic later)
const summaryData = {
    totalContainer: 75,
    palletize: 45,
    nonPalletize: 30,
    feet20: 33,
    feet40: 42
};

const palletizeVsNon = {
    palletize: 45,
    nonPalletize: 30
};

const feetVsFeet = {
    '20': 33,
    '40': 42
};

const compareData = [
    { label: "Container", jan: 85, feb: 75 },
    { label: "Palletize", jan: 45, feb: 45 },
    { label: "Non Palletize", jan: 40, feb: 30 },
    { label: "20 Feet", jan: 53, feb: 33 },
    { label: "40 Feet", jan: 32, feb: 42 }
];

const trendLineData = [86, 75, 65, 61, 81, 69, 71, 79, 72, 78, 69, 71];

// Set header year and month
document.getElementById("dashboard-year").textContent = "2025";
document.getElementById("dashboard-month").textContent = "March";

// Set summary card values
document.getElementById("total-container").textContent = summaryData.totalContainer;
document.getElementById("container-palletize").textContent = summaryData.palletize;
document.getElementById("container-non-palletize").textContent = summaryData.nonPalletize;
document.getElementById("container-20").textContent = summaryData.feet20;
document.getElementById("container-40").textContent = summaryData.feet40;

// Chart: Palletize vs Non Palletize (Bar)
const chartPalletizeBar = new Chart(document.getElementById('chart-palletize-bar'), {
    type: 'bar',
    data: {
        labels: ['PALLETIZE', 'NON PALLETIZE'],
        datasets: [{
            data: [palletizeVsNon.palletize, palletizeVsNon.nonPalletize],
            backgroundColor: ['#5395d6', '#ffcc5a'],
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6
        }]
    },
    options: {
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 13, weight: 'bold' } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 12 } } }
        }
    }
});

// Chart: Palletize vs Non Palletize (Pie)
const pieTotal = palletizeVsNon.palletize + palletizeVsNon.nonPalletize;
const chartPalletizePie = new Chart(document.getElementById('chart-palletize-pie'), {
    type: 'doughnut',
    data: {
        labels: ['PALLETIZE', 'NON PALLETIZE'],
        datasets: [{
            data: [palletizeVsNon.palletize, palletizeVsNon.nonPalletize],
            backgroundColor: ['#5395d6', '#ffcc5a'],
            borderWidth: 1.5
        }]
    },
    options: {
        cutout: "68%",
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const pct = ((ctx.parsed / pieTotal) * 100).toFixed(0);
                        return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                    }
                }
            }
        }
    }
});

// Chart: 20" vs 40" (Bar)
const chartFeetBar = new Chart(document.getElementById('chart-feet-bar'), {
    type: 'bar',
    data: {
        labels: ['20"', '40"'],
        datasets: [{
            data: [feetVsFeet['20'], feetVsFeet['40']],
            backgroundColor: ['#bcbcbc', '#f38a4e'],
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6
        }]
    },
    options: {
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 13, weight: 'bold' } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 12 } } }
        }
    }
});

// Chart: 20" vs 40" (Pie)
const feetPieTotal = feetVsFeet['20'] + feetVsFeet['40'];
const chartFeetPie = new Chart(document.getElementById('chart-feet-pie'), {
    type: 'doughnut',
    data: {
        labels: ['20"', '40"'],
        datasets: [{
            data: [feetVsFeet['20'], feetVsFeet['40']],
            backgroundColor: ['#bcbcbc', '#f38a4e'],
            borderWidth: 1.5
        }]
    },
    options: {
        cutout: "68%",
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const pct = ((ctx.parsed / feetPieTotal) * 100).toFixed(0);
                        return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                    }
                }
            }
        }
    }
});

// Chart: Compare (Bar multi)
const chartCompareBar = new Chart(document.getElementById('chart-compare-bar'), {
    type: 'bar',
    data: {
        labels: compareData.map(d => d.label),
        datasets: [
            {
                label: 'Jan-25',
                backgroundColor: '#5395d6',
                data: compareData.map(d => d.jan),
                borderRadius: 7,
                borderSkipped: false,
                barPercentage: 0.6
            },
            {
                label: 'Feb-25',
                backgroundColor: '#f38a4e',
                data: compareData.map(d => d.feb),
                borderRadius: 7,
                borderSkipped: false,
                barPercentage: 0.6
            }
        ]
    },
    options: {
        plugins: { legend: { display: true, position: 'bottom' } },
        responsive: true,
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 13 } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 12 } } }
        }
    }
});

// Chart: Trend Line (Line)
const chartTrendLine = new Chart(document.getElementById('chart-trend-line'), {
    type: 'line',
    data: {
        labels: [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ],
        datasets: [{
            label: 'Container',
            data: trendLineData,
            fill: false,
            borderColor: '#5395d6',
            backgroundColor: '#5395d6',
            pointBackgroundColor: '#5395d6',
            pointBorderColor: '#fff',
            pointRadius: 5,
            tension: 0.3
        }]
    },
    options: {
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 12 } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 12 } } }
        }
    }
});
