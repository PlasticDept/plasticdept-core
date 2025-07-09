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

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const years = [];
for(let y = 2022; y <= 2026; y++) years.push(y);

// Populate year and month dropdowns
const yearSelect = document.getElementById("dashboard-year");
const monthSelect = document.getElementById("dashboard-month");
years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
});
months.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i+1;
    opt.textContent = m;
    monthSelect.appendChild(opt);
});
// Set default value
yearSelect.value = "2025";
monthSelect.value = "3";

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
            borderRadius: 7,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7
        }]
    },
    options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: {
                anchor: 'end',
                align: 'top',
                font: { weight: 'bold', size: 13 },
                color: '#23507b',
                formatter: v => v
            }
        },
        layout: {
            padding: { top: 15, bottom: 0, left: 0, right: 0 }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 11 } }, max: 50 }
        }
    },
    plugins: [ChartDataLabels]
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
        responsive: false,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const pct = ((ctx.parsed / pieTotal) * 100).toFixed(0);
                        return `${pct}%`;
                    }
                }
            },
            datalabels: {
                color: '#23507b',
                font: { weight: 'bold', size: 15 },
                formatter: (value, ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = ((value / total) * 100).toFixed(0) + '%';
                    return pct;
                },
                anchor: 'center',
                align: 'center',
                display: true
            }
        }
    },
    plugins: [ChartDataLabels]
});

// Chart: 20" vs 40" (Bar)
const chartFeetBar = new Chart(document.getElementById('chart-feet-bar'), {
    type: 'bar',
    data: {
        labels: ['20"', '40"'],
        datasets: [{
            data: [feetVsFeet['20'], feetVsFeet['40']],
            backgroundColor: ['#bcbcbc', '#f38a4e'],
            borderRadius: 7,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7
        }]
    },
    options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: {
                anchor: 'end',
                align: 'top',
                font: { weight: 'bold', size: 13 },
                color: '#23507b',
                formatter: v => v
            }
        },
        layout: {
            padding: { top: 15, bottom: 0, left: 0, right: 0 }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 11 } }, max: 50 }
        }
    },
    plugins: [ChartDataLabels]
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
        responsive: false,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const pct = ((ctx.parsed / feetPieTotal) * 100).toFixed(0);
                        return `${pct}%`;
                    }
                }
            },
            datalabels: {
                color: '#23507b',
                font: { weight: 'bold', size: 15 },
                formatter: (value, ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = ((value / total) * 100).toFixed(0) + '%';
                    return pct;
                },
                anchor: 'center',
                align: 'center',
                display: true
            }
        }
    },
    plugins: [ChartDataLabels]
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
                barPercentage: 0.6,
                categoryPercentage: 0.7
            },
            {
                label: 'Feb-25',
                backgroundColor: '#f38a4e',
                data: compareData.map(d => d.feb),
                borderRadius: 7,
                borderSkipped: false,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'bottom' },
            datalabels: {
                display: true,
                anchor: 'end',
                align: 'top',
                font: { weight: 'bold', size: 13 },
                color: context => context.dataset.label === "Jan-25" ? "#5395d6" : "#f38a4e",
                formatter: v => v
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 12 } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 12 } } }
        }
    },
    plugins: [ChartDataLabels]
});

// Chart: Trend Line (Line)
const chartTrendLine = new Chart(document.getElementById('chart-trend-line'), {
    type: 'line',
    data: {
        labels: months,
        datasets: [{
            label: 'Container',
            data: trendLineData,
            fill: false,
            borderColor: '#5395d6',
            backgroundColor: '#5395d6',
            pointBackgroundColor: '#5395d6',
            pointBorderColor: '#fff',
            pointRadius: 4,
            tension: 0.28
        }]
    },
    options: {
        plugins: {
            legend: { display: false },
            datalabels: {
                align: 'top',
                anchor: 'end',
                font: { weight: 'bold', size: 12 },
                color: '#23507b',
                formatter: v => v
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 12 } } },
            y: { beginAtZero: true, grid: { color: "#e4e4e4" }, ticks: { stepSize: 10, font: { size: 11 } } }
        }
    },
    plugins: [ChartDataLabels]
});

// Render compare data table with arrow, color and sign for percentage
function formatCompareRow({label, jan, feb}) {
    let percent = ((feb-jan)/jan*100);
    let stat = percent > 0 ? "Increased" : percent < 0 ? "Decreased" : "Unchanged";
    let percentStr = (percent > 0 ? "+" : percent < 0 ? "-" : "") + Math.abs(percent).toFixed(2) + "%";
    let statClass = percent > 0 ? "increase" : percent < 0 ? "decrease" : "unchanged";
    let arrow = percent > 0
        ? '<span class="arrow" style="color:#27ae60">&#9650;</span>'
        : percent < 0
            ? '<span class="arrow" style="color:#c0392b">&#9660;</span>'
            : '<span class="arrow" style="color:#888">&#8212;</span>';

    return `<tr>
        <td>${label}</td>
        <td>${jan}</td>
        <td>${feb}</td>
        <td>
            <span class="compare-percent ${statClass}">${arrow}${percentStr}</span>
            <span class="compare-status ${statClass}">${stat}</span>
        </td>
    </tr>`;
}
document.getElementById("compare-table-body").innerHTML =
    compareData.map(formatCompareRow).join("");