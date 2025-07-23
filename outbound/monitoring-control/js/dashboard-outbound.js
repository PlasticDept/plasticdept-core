// Dashboard Progress Outbound - Gabungan Team Sugity & Reguler

import { db, authPromise } from "./config.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

let miniDonutSugityChart;
let miniDonutRegulerChart;

// --- DOM Elements (dashboard matrix) ---
const outstandingJobValue = document.getElementById("outstandingJobValue");
const planTargetValue = document.getElementById("planTargetValue");
const actualTargetValue = document.getElementById("actualTargetValue");
const actualAchievedValue = document.getElementById("actualAchievedValue");
const actualRemainingValue = document.getElementById("actualRemainingValue");

// Team matrix DOM
const mpSugity = document.getElementById("mpSugity");
const mpReguler = document.getElementById("mpReguler");
const planSugity = document.getElementById("planSugity");
const planReguler = document.getElementById("planReguler");
const actualSugity = document.getElementById("actualSugity");
const actualReguler = document.getElementById("actualReguler");
const achievedSugity = document.getElementById("achievedSugity");
const achievedReguler = document.getElementById("achievedReguler");
const remainingSugity = document.getElementById("remainingSugity");
const remainingReguler = document.getElementById("remainingReguler");
const outstandingJobLabel = document.getElementById("outstandingJobLabel");

// Team matrix card title
const teamTitleSugity = document.querySelector('.team-matrix-card .team-title'); // biasanya yang pertama (Sugity)
const teamTitleReguler = document.querySelectorAll('.team-matrix-card .team-title')[1]; // yang kedua (Reguler)

// Chart.js chart objects
let donutChart, barChart;

// --- Helper Functions ---
/**
 * Format angka dengan ribuan
 * @param {number|string} num
 * @returns {string}
 */
function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString();
}

/**
 * Memeriksa apakah delivery date bukan hari ini atau kemarin
 * @param {string} deliveryDate - Format tanggal dari Firebase (YYYY-MM-DD)
 * @returns {boolean} - true jika bukan hari ini/kemarin, false jika hari ini/kemarin
 */
function checkDeliveryDateNotTodayYesterday(deliveryDate) {
  // Jika tidak ada delivery date, anggap valid (ikut aturan sebelumnya)
  if (!deliveryDate) return true;
  
  // Buat objek Date untuk hari ini dan kemarin
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset jam ke awal hari
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  // Parse tanggal delivery dari format YYYY-MM-DD
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  
  // Kembalikan true jika delivery date BUKAN hari ini dan BUKAN kemarin
  return delivery.getTime() !== today.getTime() && 
         delivery.getTime() !== yesterday.getTime();
}

/**
 * Update label outstanding job sesuai shift
 */
async function updateOutstandingJobLabel() {
  const snapshot = await get(ref(db, "ManPower"));
  if (outstandingJobLabel) {
    if (snapshot.exists()) {
      const shifts = Object.keys(snapshot.val() || {});
      if (shifts.length === 1) {
        if (shifts[0] === "Day Shift") {
          outstandingJobLabel.textContent = "Outstanding Job For Night Shift";
        } else if (shifts[0] === "Night Shift") {
          outstandingJobLabel.textContent = "Outstanding Job For Day Shift";
        } else {
          outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
        }
      } else if (shifts.includes("Day Shift") && !shifts.includes("Night Shift")) {
        outstandingJobLabel.textContent = "Outstanding Job For Night Shift";
      } else if (shifts.includes("Night Shift") && !shifts.includes("Day Shift")) {
        outstandingJobLabel.textContent = "Outstanding Job For Day Shift";
      } else {
        outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
      }
    } else {
      outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
    }
  }
}

// --- Status Label Utility ---
function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "newjob": return "status-newjob";
    case "downloaded":
    case "picked":
    case "partialdownloaded":
    case "partialpicked": return "status-downloaded";
    case "packed":
    case "loaded": return "status-packed";
    default: return "status-other";
  }
}

// --- Status Sort Order Utility ---
const STATUS_ORDER = [
  "newjob",
  "downloaded",
  "partialdownloaded",
  "partialpicked",
  "packed",
  "loaded",
  "completed"
];
function getStatusSortOrder(status) {
  const idx = STATUS_ORDER.indexOf((status || '').toLowerCase());
  return idx === -1 ? 999 : idx;
}

// --- Main Data Loader ---
/**
 * Muat data utama dashboard, isi matrix dan render semua chart
 */
async function loadDashboardData() {
  // Add loading state indicators
  document.querySelectorAll('.matrix-value, .team-matrix-value').forEach(el => {
    el.classList.add('loading');
  });
  
  // Ambil shiftType dari localStorage yang diset dari halaman assignment
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  // Ambil data PlanTarget, OutboundJobs, dan ManPower
  const [planTargetSnap, outboundJobsSnap, manPowerSnap] = await Promise.all([
    get(ref(db, planTargetPath)),
    get(ref(db, "PhxOutboundJobs")),
    get(ref(db, manPowerPath)),
  ]);

  // Plan Target
  let planSugityVal = 0, planRegulerVal = 0;
  if (planTargetSnap.exists()) {
    const planTarget = planTargetSnap.val();
    planSugityVal = parseInt(planTarget.Sugity) || 0;
    planRegulerVal = parseInt(planTarget.Reguler) || 0;
  }

  // Outbound Jobs
  const outboundJobs = outboundJobsSnap.exists() ? outboundJobsSnap.val() : {};

  // Data ManPower
  let MP_SUGITY = 0, MP_REGULER = 0;
  if (manPowerSnap.exists()) {
    const manPowerVal = manPowerSnap.val();
    MP_SUGITY = parseFloat(manPowerVal.Sugity) || 0;
    MP_REGULER = parseFloat(manPowerVal.Reguler) || 0;
  }

  // Setelah inisialisasi MP_SUGITY dan MP_REGULER
  const manPowerTotal = +(MP_SUGITY + MP_REGULER).toFixed(2);

  // Hitung Outstanding Job For Next Shift
  let outstandingQty = 0;
  for (const jobNo in outboundJobs) {
    const job = outboundJobs[jobNo];
    const qty = parseInt(job.qty) || 0;
    const status = (job.status || '').toLowerCase();
    const deliveryDate = job.deliveryDate; // Ambil delivery date dari job

    // Cek delivery date bukan hari ini dan kemarin
    const isValidDeliveryDate = checkDeliveryDateNotTodayYesterday(deliveryDate);
    
    // Filter berdasarkan status "pending pick" DAN delivery date bukan hari ini/kemarin
    if (status === "pending pick" && isValidDeliveryDate) {
      outstandingQty += qty;
    }
  }
  if (outstandingJobValue) outstandingJobValue.textContent = formatNumber(outstandingQty) + " kg";

  // Per-team accumulator
  let sumActualSugity = 0,
      sumAchievedSugity = 0,
      sumActualReguler = 0,
      sumAchievedReguler = 0;

  let sugityJobs = [], regulerJobs = [];

  for (const jobNo in outboundJobs) {
    const job = outboundJobs[jobNo];
    const qty = parseInt(job.qty) || 0;
    const team = (job.team || '').toLowerCase();
    const status = (job.status || '').toLowerCase();

    if (team === "sugity") {
      sumActualSugity += qty;
      if (["packed", "loading", "completed"].includes(status)) {
        sumAchievedSugity += qty;
      }
      sugityJobs.push(job);
    } else if (team === "reguler") {
      sumActualReguler += qty;
      if (["packed", "loading", "completed"].includes(status)) {
        sumAchievedReguler += qty;
      }
      regulerJobs.push(job);
    }
  }

  // Remaining
  const sumRemainingSugity = sumActualSugity - sumAchievedSugity;
  const sumRemainingReguler = sumActualReguler - sumAchievedReguler;

  // Gabungan
  const totalPlanTarget = planSugityVal + planRegulerVal;
  const totalActual = sumActualSugity + sumActualReguler;
  const totalAchieved = sumAchievedSugity + sumAchievedReguler;
  const totalRemaining = totalActual - totalAchieved;

  // --- Isi Matrix Dashboard ---
  if (planTargetValue) planTargetValue.textContent = formatNumber(totalPlanTarget) + " kg";
  if (actualTargetValue) actualTargetValue.textContent = formatNumber(totalActual) + " kg";
  if (actualAchievedValue) actualAchievedValue.textContent = formatNumber(totalAchieved) + " kg";
  if (actualRemainingValue) actualRemainingValue.textContent = formatNumber(totalRemaining) + " kg";

  // --- Isi Matrix Team (otomatis) ---
  if (mpSugity) mpSugity.textContent = MP_SUGITY;
  if (mpReguler) mpReguler.textContent = MP_REGULER;
  if (planSugity) planSugity.textContent = formatNumber(planSugityVal);
  if (planReguler) planReguler.textContent = formatNumber(planRegulerVal);
  if (actualSugity) actualSugity.textContent = formatNumber(sumActualSugity);
  if (actualReguler) actualReguler.textContent = formatNumber(sumActualReguler);
  if (achievedSugity) achievedSugity.textContent = formatNumber(sumAchievedSugity);
  if (achievedReguler) achievedReguler.textContent = formatNumber(sumAchievedReguler);
  if (remainingSugity) remainingSugity.textContent = formatNumber(sumRemainingSugity);
  if (remainingReguler) remainingReguler.textContent = formatNumber(sumRemainingReguler);

  // Remove loading state indicators
  document.querySelectorAll('.matrix-value, .team-matrix-value').forEach(el => {
    el.classList.remove('loading');
  });

  // --- Render Chart ---
  renderMiniDonutSugity(sumAchievedSugity, planSugityVal);
  renderMiniDonutReguler(sumAchievedReguler, planRegulerVal);
  renderDonutChart(totalAchieved, totalPlanTarget);
  renderBarChart([sumAchievedSugity, sumAchievedReguler], [planSugityVal, planRegulerVal]);

  // --- Outbound Jobs Table sudah dihapus ---

  // --- Render Line Chart Outbound (NEW) ---
  const allJobs = [
    ...sugityJobs.map(j => ({...j, team: "Sugity"})),
    ...regulerJobs.map(j => ({...j, team: "Reguler"}))
  ];
  allJobs.sort((a, b) => {
    const orderA = getStatusSortOrder(a.status);
    const orderB = getStatusSortOrder(b.status);
    if (orderA !== orderB) return orderA - orderB;
    return (a.jobNo || '').localeCompare(b.jobNo || '');
  });

  renderLineChartOutbound(allJobs, shiftType, manPowerTotal);

  applyShiftLogicPerTeam();
  await updateOutstandingJobLabel();
  
  // Update UI element to show last update time
  const now = new Date();
  const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const refreshText = document.querySelector('.refresh-text');
  if (refreshText) {
    refreshText.textContent = `Updated at ${timeString}`;
  }
}

// --- Shift Logic Title ---
/**
 * Update judul dan data matrix per team sesuai shift
 */
function applyShiftLogicPerTeam() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  if (shiftType === "Night") {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Night Shift)";
    if (teamTitleReguler) teamTitleReguler.textContent = "Reguler (Night Shift)";
    // Kosongkan data Reguler saat shift malam
    if (mpReguler) mpReguler.textContent = "";
    if (planReguler) planReguler.textContent = "";
    if (actualReguler) actualReguler.textContent = "";
    if (achievedReguler) achievedReguler.textContent = "";
    if (remainingReguler) remainingReguler.textContent = "";
    
    // Update chip to show Night Shift
    const chipElement = document.querySelector('.chip');
    if (chipElement) {
      chipElement.textContent = "Night Shift";
    }
  } else {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Day Shift)";
    if (teamTitleReguler) teamTitleReguler.textContent = "Reguler (Day Shift)";
    
    // Update chip to show Day Shift
    const chipElement = document.querySelector('.chip');
    if (chipElement) {
      chipElement.textContent = "Day Shift";
    }
  }
}

// --- Plugin untuk label tengah donut ---
const centerLabelPlugin = {
  id: 'centerLabelPlugin',
  afterDraw: function(chart) {
    // Tidak perlu menggambar persentase di sini karena kita menggunakan animateCountUp
    // pada elemen donutCenterText yang terpisah
    return;
  }
};

// --- Mini Donut Chart Sugity ---
/**
 * Render mini donut chart untuk Sugity
 */
function renderMiniDonutSugity(achieved, planTarget) {
  const canvas = document.getElementById("miniDonutSugity");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(achieved) || 0;
  const planTargetVal = Number(planTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

  if (miniDonutSugityChart) miniDonutSugityChart.destroy();

  miniDonutSugityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#10b981", "#f1f5f9"],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      cutout: "70%",
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
        customPercentTarget: {
          planTarget: planTargetVal
        }
      }
    },
    plugins: [centerLabelPlugin]
  });
  // Animated counter
  const donutCenterText = document.getElementById("miniDonutSugityCenter");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Mini Donut Chart Reguler ---
/**
 * Render mini donut chart untuk Reguler
 */
function renderMiniDonutReguler(achieved, planTarget) {
  const canvas = document.getElementById("miniDonutReguler");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(achieved) || 0;
  const planTargetVal = Number(planTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

  if (miniDonutRegulerChart) miniDonutRegulerChart.destroy();

  miniDonutRegulerChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#10b981", "#f1f5f9"],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      cutout: "70%",
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
        customPercentTarget: {
          planTarget: planTargetVal
        }
      }
    },
    plugins: [centerLabelPlugin]
  });
  // Animated counter
  const donutCenterText = document.getElementById("miniDonutRegulerCenter");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Donut Chart Gabungan ---
/**
 * Render donut chart total gabungan
 */
function renderDonutChart(totalAchieved, totalPlanTarget) {
  const canvas = document.getElementById("donutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(totalAchieved) || 0;
  const planTargetVal = Number(totalPlanTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#10b981", "#f1f5f9"],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      cutout: "75%",
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.label + ": " + formatNumber(ctx.raw) + " kg";
            }
          }
        }
      }
    },
    plugins: [centerLabelPlugin]
  });

  const donutCenterText = document.getElementById("donutCenterText");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Bar Chart (Progress Per Team) ---
/**
 * Render bar chart untuk progres per team
 */
function renderBarChart(actualArr, planArr) {
  const canvas = document.getElementById("barChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Sugity", "Reguler"],
      datasets: [
        {
          label: "Actual Target",
          data: actualArr,
          backgroundColor: '#2563eb',
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.6
        },
        {
          label: "Plan Target",
          data: planArr,
          backgroundColor: '#f97316',
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true, 
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 6,
            padding: 20,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ": " + formatNumber(ctx.parsed.y) + " kg";
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#1e293b',
          font: { weight: 'bold', size: 11 },
          formatter: function(value) {
            return formatNumber(value) + " kg";
          },
          padding: 6
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#64748b'
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#64748b'
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ===================== LINE CHART OUTBOUND (NEW) =====================
let lineChartOutbound;

// Map plan target berdasarkan shift & total man power
const PLAN_TARGET_TABLE = {
  "Day": {
    "3": [
      { time: "8:00", target: null },
      { time: "9:00", target: 3528 },
      { time: "10:00", target: 10584 },
      { time: "11:00", target: 17640 },
      { time: "12:00", target: 24696 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 31752 },
      { time: "15:00", target: 38808 },
      { time: "16:00", target: 45864 },
      { time: "17:00", target: 52920 }
    ],
    "2.5": [
      { time: "8:00", target: null },
      { time: "9:00", target: 2940 },
      { time: "10:00", target: 8820 },
      { time: "11:00", target: 14700 },
      { time: "12:00", target: 20580 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 26460 },
      { time: "15:00", target: 32340 },
      { time: "16:00", target: 38220 },
      { time: "17:00", target: 44100 }
    ],
    "2": [
      { time: "8:00", target: null },
      { time: "9:00", target: 2352 },
      { time: "10:00", target: 7056 },
      { time: "11:00", target: 11760 },
      { time: "12:00", target: 16464 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 21168 },
      { time: "15:00", target: 25872 },
      { time: "16:00", target: 30576 },
      { time: "17:00", target: 35280 }
    ]
  },
  "Night": {
    "2": [
      { time: "20:00", target: null },
      { time: "21:00", target: 2352 },
      { time: "22:00", target: 7056 },
      { time: "23:00", target: 11760 },
      { time: "0:00", target: 16464 },
      { time: "1:00", target: 0 },
      { time: "2:00", target: 21168 },
      { time: "3:00", target: 25872 },
      { time: "4:00", target: 30576 },
      { time: "5:00", target: 35280 }
    ]
  }
};

// --- Helper: Range jam untuk per shift
function getHourRange(shiftType) {
  if (shiftType === "Day") {
    // 8:00 - 17:00
    return [
      { label: "8:00", start: 8, end: 9 },
      { label: "9:00", start: 9, end: 10 },
      { label: "10:00", start: 10, end: 11 },
      { label: "11:00", start: 11, end: 12 },
      { label: "12:00", start: 12, end: 13 },
      { label: "13:00", start: 13, end: 14 },
      { label: "14:00", start: 14, end: 15 },
      { label: "15:00", start: 15, end: 16 },
      { label: "16:00", start: 16, end: 17 },
      { label: "17:00", start: 17, end: 18 }
    ];
  } else {
    // Night: 20:00 - 5:00
    return [
      { label: "20:00", start: 20, end: 21 },
      { label: "21:00", start: 21, end: 22 },
      { label: "22:00", start: 22, end: 23 },
      { label: "23:00", start: 23, end: 24 },
      { label: "0:00", start: 0, end: 1 },
      { label: "1:00", start: 1, end: 2 },
      { label: "2:00", start: 2, end: 3 },
      { label: "3:00", start: 3, end: 4 },
      { label: "4:00", start: 4, end: 5 },
      { label: "5:00", start: 5, end: 6 }
    ];
  }
}

// Tambahan: fungsi untuk menampilkan pesan ramah di chart area
function showLineChartMessage(msg) {
  const canvas = document.getElementById("lineChartOutbound");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Style
  ctx.save();
  ctx.font = 'bold 16px Poppins, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = "center";
  ctx.textBaseline = "top"; // untuk stacking baris
  const maxWidth = canvas.width * 0.9; // padding 5% kiri/kanan

  // Word wrap utility
  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    // Center vertically
    const totalHeight = lines.length * lineHeight;
    let startY = y - totalHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i].trim(), x, startY + i * lineHeight);
    }
  }

  const lineHeight = 22;
  wrapText(msg, canvas.width / 2, canvas.height / 2, maxWidth, lineHeight);

  ctx.restore();
}

// --- Fungsi utama render Line Chart Outbound ---
function renderLineChartOutbound(jobs, shiftType, manPowerTotal) {
  // --- Validasi manpower
  if (!manPowerTotal || isNaN(manPowerTotal) || manPowerTotal <= 0) {
    showLineChartMessage("Data Man Power belum lengkap. Silakan input Man Power terlebih dahulu.");
    return;
  }

  // --- Plan Target Array ---
  let planTargetArr = [];
  const mpKey = String(manPowerTotal);
  if (PLAN_TARGET_TABLE[shiftType] && PLAN_TARGET_TABLE[shiftType][mpKey]) {
    planTargetArr = PLAN_TARGET_TABLE[shiftType][mpKey];
  } else {
    showLineChartMessage(`Belum ada Plan Target untuk Man Power ${mpKey} pada shift ${shiftType}. Hubungi Admin untuk update data.`);
    return;
  } 

  // --- Visible Plan Chart Array ---
  let visiblePlanChartArr = planTargetArr.map((row, idx) => {
    if (idx === 0) return 0;
    if (row.target === 0) return 0;
    if (row.target === null || typeof row.target === "undefined") return null;
    return row.target;
  });

  // --- Helper: Jam Range updated ---
  const hourRange = getHourRange(shiftType);
  const finishedStatus = ["packed", "loaded", "completed"];
  let shiftLabel = shiftType === "Day" ? "Day Shift" : "Night Shift";

  function parseFinishAt(str) {
    const m = String(str).match(/(\d{1,2}):(\d{2})/);
    if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
    const iso = String(str).match(/T(\d{1,2}):(\d{2})/);
    if (iso) return { hour: parseInt(iso[1], 10), minute: parseInt(iso[2], 10) };
    return null;
  }

  // --- Qty Per Jam (bukan akumulasi) ---
  let actualPerJamArr = Array(hourRange.length).fill(0);
  for (let i = 1; i < hourRange.length; i++) {
    const prev = hourRange[i - 1];
    const curr = hourRange[i];
    jobs.forEach(job => {
      if ((job.shift || "") !== shiftLabel) return;
      if (!job.finishAt) return;
      const status = (job.status || '').toLowerCase();
      if (!finishedStatus.includes(status)) return;
      const fin = parseFinishAt(job.finishAt);
      if (!fin) return;
      let jamFin = fin.hour;
      if (shiftType === "Night" && jamFin < 6) jamFin += 24;
      let prevStart = prev.start;
      let currStart = curr.start;
      if (shiftType === "Night" && prevStart < 6) prevStart += 24;
      if (shiftType === "Night" && currStart < 6) currStart += 24;
      if (
        (jamFin > prevStart && jamFin < currStart) ||
        (jamFin === prevStart && fin.minute > 0) ||
        (jamFin === currStart && fin.minute === 0)
      ) {
        actualPerJamArr[i] += parseInt(job.qty) || 0;
      }
    });
  }

  // --- Akumulasi (untuk line grafik dan datalabel) ---
  let actualCumulative = [];
  let sum = 0;
  let lastSumBeforeBreak = 0; // Tambah variable untuk menyimpan akumulasi sebelum istirahat

  for (let i = 0; i < actualPerJamArr.length; i++) {
    if (planTargetArr[i].target === 0) { // Jam istirahat (13:00)
      lastSumBeforeBreak = sum; // Simpan akumulasi sebelum istirahat
      actualCumulative.push(0); // Push 0 untuk jam istirahat
    } else if (planTargetArr[i].target === null) { // Jam pertama (8:00)
      actualCumulative.push(0);
      sum = 0;
    } else {
      // Untuk jam setelah istirahat (14:00 dst), tambahkan lastSumBeforeBreak
      if (i > 0 && planTargetArr[i-1].target === 0) {
        sum = lastSumBeforeBreak + actualPerJamArr[i];
      } else {
        sum += actualPerJamArr[i];
      }
      actualCumulative.push(sum);
    }
  }

  // --- Datalabel per jam (tampilkan akumulasi, hanya di jam yang sudah lewat, jam istirahat = 0, jam berikutnya = null) ---
  const now = new Date();
  let currentHour = now.getHours();
  let chartHour = currentHour;
  if (shiftType === "Night" && currentHour < 6) chartHour += 24;

  let jamArr = planTargetArr.map((row, idx) => {
    let jam = parseInt(row.time);
    if (shiftType === "Night" && jam < 6) jam += 24;
    return {idx, jam};
  });
  let nowIdx = jamArr.findIndex(j => chartHour < j.jam);
  if (nowIdx === -1) nowIdx = planTargetArr.length;

  // Datalabel actual: isi dengan akumulasi di semua jam yang SUDAH LEWAT (jam ke-0/awal tetap null), istirahat = 0, jam berikutnya null
  let datalabelActualArr = [];
  for (let i = 0; i < actualCumulative.length; i++) {
    if (planTargetArr[i].target === null) {
      datalabelActualArr.push(0); // jam istirahat, label 0
    } else if (i > 0 && i < nowIdx && actualCumulative[i] !== null) {
      datalabelActualArr.push(actualCumulative[i]); // akumulasi, hanya jam yang sudah lewat
    } else {
      datalabelActualArr.push(null); // jam yang belum lewat atau jam ke-0
    }
  }

  // Sembunyikan data actualCumulative setelah jam saat ini (agar line putus di titik berikutnya)
  for (let i = nowIdx; i < actualCumulative.length; i++) {
    actualCumulative[i] = null;
  }

  const labels = planTargetArr.map(row => row.time);

  // --- Render Chart.js ---
  const canvas = document.getElementById("lineChartOutbound");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (window.lineChartOutbound && typeof window.lineChartOutbound.destroy === "function") {
    window.lineChartOutbound.destroy();
  }

  window.lineChartOutbound = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Actual Target",
          data: actualCumulative,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          borderWidth: 3,
          pointBackgroundColor: "#f97316",
          pointBorderColor: "#fff",
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: false,
          tension: 0.2,
          datalabels: {
            display: function(context) {
              return datalabelActualArr[context.dataIndex] !== null;
            },
            backgroundColor: "#f97316",
            borderColor: "#fff",
            borderWidth: 2,
            color: "#fff",
            borderRadius: 4,
            padding: 6,
            font: { weight: "bold", size: 11 },
            anchor: 'end',
            align: 'top',
            offset: 10,
            clamp: true,
            formatter: function(value, ctx) {
              return datalabelActualArr[ctx.dataIndex] !== null
                ? datalabelActualArr[ctx.dataIndex].toLocaleString()
                : "";
            }
          }
        },
        {
          label: "Plan Target",
          data: visiblePlanChartArr,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          borderWidth: 3,
          pointBackgroundColor: "#2563eb",
          pointBorderColor: "#fff",
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: false,
          tension: 0.2,
          spanGaps: true,
          datalabels: {
            display: function(context) {
              return context.dataset.data[context.dataIndex] !== null && context.dataset.data[context.dataIndex] !== 0;
            },
            backgroundColor: "#2563eb",
            borderColor: "#fff",
            borderWidth: 2,
            color: "#fff",
            borderRadius: 4,
            padding: 6,
            font: { weight: "bold", size: 11 },
            anchor: 'start',
            align: 'bottom',
            offset: 10,
            clamp: true,
            formatter: (value) => value !== null && value !== 0 ? value.toLocaleString() : ""
          }
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        y: {
          type: 'number',
          easing: 'easeOutQuart',
          duration: 1000,
          delay: function(context) {
            if (context.type !== 'data' || context.datasetIndex !== 0) return 0;
            return context.dataIndex * 100;
          }
        }
      },
      plugins: {
        legend: { 
          display: true, 
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 6,
            padding: 20,
            font: {
              size: 12
            }
          }
        },
        tooltip: { 
          mode: "index", 
          intersect: false,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          titleColor: "#1e293b",
          bodyColor: "#1e293b",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          titleFont: {
            weight: "bold"
          },
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y !== null ? context.parsed.y.toLocaleString() : '-';
              return `${label}: ${value} kg`;
            }
          }
        },
        datalabels: {}
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#64748b'
          },
          title: { 
            display: true, 
            text: "Qty (kg)", 
            font: { 
              size: 12,
              weight: "bold" 
            },
            color: '#64748b'
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#64748b'
          },
          title: { 
            display: true, 
            text: "Jam", 
            font: { 
              size: 12,
              weight: "bold" 
            },
            color: '#64748b'
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// --- Real-time update refresh when shift or data changes ---
/**
 * Setup realtime listener firebase untuk data utama
 */
function setupRealtimeListeners() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  // Show loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.innerHTML = `
    <div class="loading-spinner">
      <span class="material-symbols-outlined">sync</span>
    </div>
    <p>Mengambil data terbaru...</p>
  `;
  document.body.appendChild(loadingOverlay);

  // Setup firebase listeners
  onValue(ref(db, "PhxOutboundJobs"), (snapshot) => {
    loadDashboardData();
    // Remove loading overlay after data loaded
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
      }, 500);
    }
  });
  
  onValue(ref(db, planTargetPath), loadDashboardData);
  onValue(ref(db, manPowerPath), loadDashboardData);
  onValue(ref(db, "ManPower"), updateOutstandingJobLabel);
}

// --- Listen localStorage shiftType changes (multi-tab support) ---
window.addEventListener("storage", function(e) {
  if (e.key === "shiftType") {
    loadDashboardData();
    setupRealtimeListeners();
  }
});

/**
 * Schedule refresh dashboard pada awal jam berikutnya, lalu tiap 1 jam
 */
function scheduleHourlyUpdate() {
  const now = new Date();
  const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  
  // Show notification about next update
  const nextUpdateTime = new Date(now.getTime() + msToNextHour);
  const nextHour = nextUpdateTime.getHours().toString().padStart(2, '0');
  const nextMinute = nextUpdateTime.getMinutes().toString().padStart(2, '0');
  
  console.log(`Dashboard akan diperbarui pada pukul ${nextHour}:${nextMinute}`);
  
  setTimeout(() => {
    loadDashboardData();
    setInterval(loadDashboardData, 60 * 60 * 1000);
  }, msToNextHour);
}

// Setelah auth dan setup listener
authPromise.then(() => {
  // Show loading screen
  const loadingScreen = document.createElement('div');
  loadingScreen.className = 'fullscreen-loading';
  loadingScreen.innerHTML = `
    <div class="loading-content">
      <div class="loading-logo">
        <img src="img/reverse-logistic.png" alt="PlasticDept Logo">
      </div>
      <h2>Enterprise Dashboard</h2>
      <div class="loading-spinner-large"></div>
      <p>Memuat data dashboard...</p>
    </div>
  `;
  document.body.appendChild(loadingScreen);
  
  // Load dashboard data and setup listeners
  loadDashboardData()
    .then(() => {
      setupRealtimeListeners();
      scheduleHourlyUpdate();
      
      // Remove loading screen with animation
      setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
          loadingScreen.remove();
        }, 500);
      }, 1000);
    })
    .catch((error) => {
      console.error("Error loading dashboard data:", error);
      // Show error in loading screen
      const loadingContent = loadingScreen.querySelector('.loading-content');
      if (loadingContent) {
        loadingContent.innerHTML = `
          <div class="loading-error">
            <span class="material-symbols-outlined">error</span>
            <h2>Terjadi Kesalahan</h2>
            <p>${error.message || 'Gagal memuat data dashboard'}</p>
            <button onclick="location.reload()">Coba Lagi</button>
          </div>
        `;
      }
    });
});

/**
 * Animasi naik angka persen pada donut chart
 * @param {HTMLElement} element
 * @param {number} targetValue
 * @param {number} duration
 */
function animateCountUp(element, targetValue, duration = 1000) {
  if (!element) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * targetValue);
    element.textContent = value + "%";
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.textContent = targetValue + "%";
    }
  };
  window.requestAnimationFrame(step);
}

// Add these styles dynamically
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.5s ease;
  }
  
  .loading-overlay.fade-out {
    opacity: 0;
  }
  
  .loading-spinner {
    width: 50px;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .loading-spinner .material-symbols-outlined {
    font-size: 36px;
    color: #2563eb;
    animation: spin 1.5s linear infinite;
  }
  
  .loading-overlay p {
    color: #1e293b;
    font-size: 16px;
    font-weight: 500;
  }
  
  /* Fullscreen loading on startup */
  .fullscreen-loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #f8fafc;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    opacity: 1;
    transition: opacity 0.5s ease;
  }
  
  .fullscreen-loading.fade-out {
    opacity: 0;
  }
  
  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px;
  }
  
  .loading-logo {
    width: 80px;
    height: 80px;
    margin-bottom: 16px;
  }
  
  .loading-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .loading-content h2 {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 24px;
  }
  
  .loading-spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid #dbeafe;
    border-radius: 50%;
    border-top-color: #2563eb;
    animation: spin 1s linear infinite;
    margin-bottom: 24px;
  }
  
  .loading-content p {
    color: #64748b;
    font-size: 16px;
  }
  
  .loading-error {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .loading-error .material-symbols-outlined {
    font-size: 48px;
    color: #ef4444;
    margin-bottom: 16px;
  }
  
  .loading-error button {
    margin-top: 24px;
    padding: 8px 16px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .loading-error button:hover {
    background-color: #1e40af;
  }
  
  /* Animations */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Loading state for values */
  .matrix-value.loading, .team-matrix-value.loading {
    position: relative;
    color: transparent;
  }
  
  .matrix-value.loading::after, .team-matrix-value.loading::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
    transform: translateY(-50%);
  }
  
  .matrix-value.loading::before, .team-matrix-value.loading::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    width: 30%;
    height: 3px;
    background-color: #2563eb;
    border-radius: 3px;
    transform: translateY(-50%);
    animation: loading-bar 1s infinite ease-in-out;
    z-index: 1;
  }
  
  @keyframes loading-bar {
    0% { left: -30%; }
    100% { left: 100%; }
  }
`;

document.head.appendChild(dynamicStyles);