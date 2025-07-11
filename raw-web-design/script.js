document.addEventListener('DOMContentLoaded', function() {
    // Initialize DateRangePicker
    $('#daterange').daterangepicker({
        startDate: moment().subtract(30, 'days'),
        endDate: moment(),
        ranges: {
           'Hari Ini': [moment(), moment()],
           'Kemarin': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
           '7 Hari Terakhir': [moment().subtract(6, 'days'), moment()],
           '30 Hari Terakhir': [moment().subtract(29, 'days'), moment()],
           'Bulan Ini': [moment().startOf('month'), moment().endOf('month')],
           'Bulan Lalu': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        locale: {
            format: 'DD/MM/YYYY',
            applyLabel: 'Terapkan',
            cancelLabel: 'Batal',
            customRangeLabel: 'Rentang Kustom'
        }
    });

    // Chart.js Global Configuration
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.color = '#6c757d';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    // Stock Movement Chart - Line Chart
    const stockMovementCtx = document.getElementById('stockMovementChart').getContext('2d');
    const stockMovementChart = new Chart(stockMovementCtx, {
        type: 'line',
        data: {
            labels: ['1 Jul', '2 Jul', '3 Jul', '4 Jul', '5 Jul', '6 Jul', '7 Jul', '8 Jul', '9 Jul', '10 Jul', '11 Jul'],
            datasets: [
                {
                    label: 'Inbound',
                    data: [150, 220, 180, 200, 250, 300, 180, 120, 200, 250, 300],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Outbound',
                    data: [100, 150, 200, 170, 180, 220, 250, 180, 150, 200, 150],
                    borderColor: '#0056b3',
                    backgroundColor: 'rgba(0, 86, 179, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah (Kg)'
                    }
                }
            }
        }
    });

    // Category Distribution Chart - Pie Chart
    const categoryDistributionCtx = document.getElementById('categoryDistributionChart').getContext('2d');
    const categoryDistributionChart = new Chart(categoryDistributionCtx, {
        type: 'doughnut',
        data: {
            labels: ['HDPE', 'LDPE', 'PP', 'PS', 'PVC', 'Lainnya'],
            datasets: [{
                data: [35, 25, 15, 10, 10, 5],
                backgroundColor: [
                    '#0056b3',
                    '#4d8dcc',
                    '#28a745',
                    '#ffc107',
                    '#dc3545',
                    '#6c757d'
                ],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'right'
                }
            },
            cutout: '65%'
        }
    });

    // Rack Utilization Chart - Bar Chart
    const rackUtilizationCtx = document.getElementById('rackUtilizationChart').getContext('2d');
    const rackUtilizationChart = new Chart(rackUtilizationCtx, {
        type: 'bar',
        data: {
            labels: ['Zona A', 'Zona B', 'Zona C', 'Zona D', 'Zona E'],
            datasets: [{
                label: 'Terpakai (%)',
                data: [85, 65, 75, 90, 55],
                backgroundColor: [
                    'rgba(0, 86, 179, 0.7)',
                    'rgba(0, 86, 179, 0.7)',
                    'rgba(0, 86, 179, 0.7)',
                    'rgba(0, 86, 179, 0.7)',
                    'rgba(0, 86, 179, 0.7)'
                ],
                borderColor: [
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Persentase Terpakai (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // In-Out Trend Chart - Line Chart
    const inOutTrendCtx = document.getElementById('inOutTrendChart').getContext('2d');
    const inOutTrendChart = new Chart(inOutTrendCtx, {
        type: 'line',
        data: {
            labels: ['Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul'],
            datasets: [
                {
                    label: 'Inbound',
                    data: [5800, 6200, 5600, 6800, 7200, 7500],
                    borderColor: '#28a745',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointBackgroundColor: '#28a745',
                    borderWidth: 2
                },
                {
                    label: 'Outbound',
                    data: [5200, 5700, 5300, 6400, 7000, 6500],
                    borderColor: '#0056b3',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointBackgroundColor: '#0056b3',
                    borderWidth: 2
                }
            ]
        },
        options: {
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Jumlah (Kg)'
                    }
                }
            }
        }
    });

    // Top Items Chart - Horizontal Bar Chart
    const topItemsCtx = document.getElementById('topItemsChart').getContext('2d');
    const topItemsChart = new Chart(topItemsCtx, {
        type: 'bar',
        data: {
            labels: ['HDPE Plastic Granules', 'PVC Plastic Granules', 'LDPE Plastic Granules', 'PS Plastic Granules', 'TPE Plastic Granules'],
            datasets: [{
                label: 'Jumlah Perputaran',
                data: [52, 47, 43, 38, 35],
                backgroundColor: [
                    'rgba(0, 86, 179, 0.8)',
                    'rgba(0, 86, 179, 0.7)',
                    'rgba(0, 86, 179, 0.6)',
                    'rgba(0, 86, 179, 0.5)',
                    'rgba(0, 86, 179, 0.4)'
                ],
                borderColor: [
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)',
                    'rgba(0, 86, 179, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Perputaran Bulanan'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Toggle User Menu
    const userMenu = document.querySelector('.user-info');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    if (userMenu) {
        userMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        if (dropdownMenu && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        }
    });

    // Table Row Hover Effect
    const tableRows = document.querySelectorAll('.data-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseover', function() {
            this.style.cursor = 'pointer';
        });
    });

    // Pagination Button Click
    const paginationButtons = document.querySelectorAll('.pagination-btn');
    paginationButtons.forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', function() {
                paginationButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
            });
        }
    });
});