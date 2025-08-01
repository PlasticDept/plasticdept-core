import { db, authPromise } from './config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Helper: Format angka ribuan
function formatNumber(num) {
    if (typeof num === "number" && !isNaN(num)) {
        return num.toLocaleString('en-US');
    }
    return num;
}

// Helper: dapatkan tanggal esok dalam format "DD-MMM-YYYY"
function getTomorrowDateStr() {
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const day = String(besok.getDate()).padStart(2, "0");
    const month = besok.toLocaleString("en-US", { month: "short" });
    const year = besok.getFullYear();
    return `${day}-${month}-${year}`;
}

// Hitung total qty OT pada shift tertentu dari node PhxOutboundJobs
function calculateCapShiftOT(jobs, shiftLabel) {
    let total = 0;
    if (!jobs) return total;
    Object.values(jobs).forEach(job => {
        const jobType = (job.jobType || "").toUpperCase();
        const shift = (job.shift || "");
        const qty = parseInt(job.qty, 10) || 0;
        if (jobType === "OT" && shift === shiftLabel) {
            total += qty;
        }
    });
    return total;
}

// Ambil data Mp shift (dari node ManPower)
async function fetchMpShift(shiftLabel) {
    const mpSnap = await get(ref(db, `ManPower/${shiftLabel}`));
    let mpReguler = 0, mpSugity = 0;
    if (mpSnap.exists()) {
        const val = mpSnap.val();
        mpReguler = Number(val.Reguler || 0);
        mpSugity = Number(val.Sugity || 0);
    }
    return mpReguler + mpSugity;
}

// Ambil ManPowerOvertime/<Shift> (cek apakah ada node)
async function fetchMpOvertimeQty(shiftLabel) {
    const mpOtSnap = await get(ref(db, `ManPowerOvertime/${shiftLabel}`));
    return mpOtSnap.exists();
}

// Ambil data MP Overtime shift (dari node ManPowerOvertime)
async function fetchMpOvertime(shiftLabel) {
    const mpOtSnap = await get(ref(db, `ManPowerOvertime/${shiftLabel}`));
    if (mpOtSnap.exists()) {
        return Number(mpOtSnap.val()) || 0;
    }
    return 0;
}

// Render shift data ke tabel (toggle show/hide)
function renderShiftData(showDay, mpDayShift, capDayShift, mpNightShift, capNightShift, cap1MPHour) {
    // Mp day shift & Capacity day shift
    const mpDayCell = document.getElementById('mpDayShift-actual');
    const capDayCell = document.getElementById('capDayShift-actual');
    mpDayCell.textContent = showDay && mpDayShift != null ? formatNumber(mpDayShift) : '';
    capDayCell.textContent = showDay && capDayShift != null ? formatNumber(capDayShift) : '';

    // Mp night shift & Capacity night shift
    const mpNightCell = document.getElementById('mpNightShift-actual');
    const capNightCell = document.getElementById('capNightShift-actual');
    mpNightCell.textContent = !showDay && mpNightShift != null ? formatNumber(mpNightShift) : '';
    capNightCell.textContent = !showDay && capNightShift != null ? formatNumber(capNightShift) : '';

    // GAP cell
    const mpDayGapCell = document.getElementById('mpDayShift-gap');
    const capDayGapCell = document.getElementById('capDayShift-gap');
    const mpNightGapCell = document.getElementById('mpNightShift-gap');
    const capNightGapCell = document.getElementById('capNightShift-gap');
    const cap1MPHourGapCell = document.getElementById('cap1MPHour-gap');

    // Standar value
    const STD_MP_DAY = 3;
    const STD_MP_NIGHT = 2;
    const STD_CAP_DAY = 52920;
    const STD_CAP_NIGHT = 35280;
    const STD_CAP_1MP_HOUR = 2352;

    // GAP Day
    mpDayGapCell.textContent = showDay && mpDayShift != null ? formatNumber(mpDayShift - STD_MP_DAY) : '';
    capDayGapCell.textContent = showDay && capDayShift != null ? formatNumber(capDayShift - STD_CAP_DAY) : '';

    // GAP Night
    mpNightGapCell.textContent = !showDay && mpNightShift != null ? formatNumber(mpNightShift - STD_MP_NIGHT) : '';
    capNightGapCell.textContent = !showDay && capNightShift != null ? formatNumber(capNightShift - STD_CAP_NIGHT) : '';

    // GAP Capacity 1 MP/hour (selalu tampil, tidak tergantung toggle)
    cap1MPHourGapCell.textContent = cap1MPHour > 0 ? formatNumber(Math.round(cap1MPHour - STD_CAP_1MP_HOUR)) : "-";
}

// Update tampilan nilai mpNightShift-ot atau mpDayShift-ot sesuai shift
async function updateMpOvertimeView(shiftMode) {
    // shiftMode: 'day' atau 'night'
    const shiftLabel = shiftMode === "day" ? "Day Shift" : "Night Shift";
    const mpOt = await fetchMpOvertime(shiftLabel);
    const otCell = document.getElementById('mpNightShift-ot'); // Pastikan id sesuai di HTML
    if (otCell) otCell.textContent = mpOt > 0 ? formatNumber(mpOt) : "-";
}

// Update tampilan nilai mpDayShift-ot & mpNightShift-ot sesuai shift aktif
async function updateMpDayNightOtView(shiftMode) {
    let shiftLabel, otCellId, otherOtCellId;
    if (shiftMode === "day") {
        shiftLabel = "Day Shift";
        otCellId = 'mpDayShift-ot';
        otherOtCellId = 'mpNightShift-ot';
    } else {
        shiftLabel = "Night Shift";
        otCellId = 'mpNightShift-ot';
        otherOtCellId = 'mpDayShift-ot';
    }
    const mpOt = await fetchMpOvertime(shiftLabel);
    const otCell = document.getElementById(otCellId);
    if (otCell) otCell.textContent = mpOt > 0 ? formatNumber(mpOt) : "-";

    const otherOtCell = document.getElementById(otherOtCellId);
    if (otherOtCell) otherOtCell.textContent = ""; // Pastikan dikosongkan
}

authPromise.then(async () => {
    // Ambil referensi elemen toggle dan spinner
    const dayToggle = document.getElementById('day-shift');
    const nightToggle = document.getElementById('night-shift');
    const spinner = document.getElementById('spinner');

    // Disable toggle & tampilkan spinner saat loading
    if (dayToggle) dayToggle.disabled = true;
    if (nightToggle) nightToggle.disabled = true;
    if (spinner) spinner.style.display = '';

    // Fetch data MP shift
    const mpDayShift = await fetchMpShift('Day Shift');
    const mpNightShift = await fetchMpShift('Night Shift');

    // Listener untuk jobs (PhxOutboundJobs)
    const jobsRef = ref(db, 'PhxOutboundJobs');
    onValue(jobsRef, (snapshot) => {
        const jobs = snapshot.val();
        let totalRemaining = 0;
        let totalAdditional = 0;
        let capDayShift = 0;
        let capNightShift = 0;

        if (jobs) {
            Object.values(jobs).forEach(job => {
                const jobType = job.jobType || "";
                const qty = parseInt(job.qty, 10) || 0;
                const shift = job.shift || "";
                const team = job.team || "";

                // PATCH: Setiap job hanya masuk ke satu kategori saja (prioritas: Remaining > Additional > Order H-1)
                if (jobType === "Remaining") {
                    totalRemaining += qty;
                } else if (jobType === "Additional") {
                    totalAdditional += qty;
                }

                // Capacity day shift (filter shift & team)
                if (
                    shift === "Day Shift" &&
                    (team === "Reguler" || team === "Sugity")
                ) {
                    capDayShift += qty;
                }
                // Capacity night shift (filter shift & team)
                if (
                    shift === "Night Shift" &&
                    (team === "Reguler" || team === "Sugity")
                ) {
                    capNightShift += qty;
                }
            });
        }

        // 1. Total MP = Mp day shift + Mp night shift
        const totalMP = (mpDayShift || 0) + (mpNightShift || 0);

        // 2. Total Capacity = Capacity day shift + Capacity night shift
        const totalCap = (capDayShift || 0) + (capNightShift || 0);

        // 4. Cap 1 MP per hour
        let cap1MPHour = 0;
        if ((mpDayShift + mpNightShift) > 0) {
            cap1MPHour = (capDayShift + capNightShift) / (mpDayShift + mpNightShift) / (450 / 60);
        }

        // Tampilkan ke tabel (non-shifted)
        const remOrderDayHCell = document.getElementById('remOrderDayH-actual');
        if (remOrderDayHCell) remOrderDayHCell.textContent = totalRemaining > 0 ? formatNumber(totalRemaining) : "-";

        const addDayHCell = document.getElementById('addDayH-actual');
        if (addDayHCell) addDayHCell.textContent = totalAdditional > 0 ? formatNumber(totalAdditional) : "-";

        // Jangan update orderH1-actual dan totalOrder-actual di sini, nanti oleh updateShiftView

        const totalMPCell = document.getElementById('totalMP-actual');
        if (totalMPCell) totalMPCell.textContent = totalMP > 0 ? formatNumber(totalMP) : "-";

        const totalCapCell = document.getElementById('totalCap-actual');
        if (totalCapCell) totalCapCell.textContent = totalCap > 0 ? formatNumber(totalCap) : "-";

        // Tampilkan cap1MPHour ke tabel
        const cap1MPHourCell = document.getElementById('cap1MPHour-actual');
        if (cap1MPHourCell) {
            cap1MPHourCell.textContent = cap1MPHour > 0 ? formatNumber(Math.round(cap1MPHour)) : "-";
        }

        // DATA SUDAH SIAP: enable toggle & hide spinner
        if (dayToggle) dayToggle.disabled = false;
        if (nightToggle) nightToggle.disabled = false;
        if (spinner) spinner.style.display = 'none';

        // Fungsi update tampilan shift (hanya MP & Capacity yang dinamis)
        async function updateShiftView() {
            const shiftMode = (dayToggle && dayToggle.checked) ? "day" : "night";

            // --- Perhitungan capDayShiftActual dan capNightShiftActual ---
            // Jumlahkan qty semua job dengan shift 'Day Shift' (tanpa filter team)
            let capDayShiftActual = 0;
            if (jobs) {
                Object.values(jobs).forEach(job => {
                    if (job.shift === "Day Shift") {
                        capDayShiftActual += parseInt(job.qty, 10) || 0;
                    }
                });
            }
            const capDayShiftOt = calculateCapShiftOT(jobs, "Day Shift");
            const hasManPowerOvertimeDay = await fetchMpOvertimeQty("Day Shift");
            if (hasManPowerOvertimeDay) {
                capDayShiftActual = capDayShiftActual - capDayShiftOt;
            }

            const capNightShiftOt = calculateCapShiftOT(jobs, "Night Shift");
            const hasManPowerOvertimeNight = await fetchMpOvertimeQty("Night Shift");
            let capNightShiftActual = capNightShift;
            if (hasManPowerOvertimeNight) {
                capNightShiftActual = capNightShift - capNightShiftOt;
            }

            // --- Perhitungan orderH1-actual & remOrder-actual sesuai logika baru ---
            let orderH1Val = 0;
            let remOrderVal = 0;

            if (shiftMode === "day") {
                // orderH1-actual: semua job dengan deliveryDate bukan hari ini dan bukan kemarin
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                function formatDate(date) {
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = date.toLocaleString("en-US", { month: "short" });
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                }
                const todayStr = formatDate(today);
                const yesterdayStr = formatDate(yesterday);

                orderH1Val = Object.values(jobs || {}).reduce((sum, job) => {
                    const deliveryDate = job.deliveryDate || "";
                    const status = (job.status || "").toLowerCase();
                    const remark = (job.remark || "").toUpperCase();
                    
                    return (deliveryDate !== todayStr && 
                            deliveryDate !== yesterdayStr && 
                            (status === "pending pick" || status === "packed") &&
                            remark !== "CANCEL")
                        ? sum + (parseInt(job.qty, 10) || 0)
                        : sum;
                }, 0);

                // remOrder-actual: hitung dengan logika yang sama seperti outstandingJobValue di dashboard
                // jumlah qty semua status "pending pick" dan tidak memiliki shift yang ditetapkan
                remOrderVal = Object.values(jobs || {}).reduce((sum, job) => {
                    const status = (job.status || "").toLowerCase();
                    // Periksa apakah shift kosong (undefined, null, atau string kosong setelah trim)
                    const hasShift = typeof job.shift !== 'undefined' && job.shift !== null && String(job.shift).trim() !== '';
                    
                    // Jumlahkan qty jika status 'pending pick' dan shift benar-benar tidak ada atau kosong
                    return (status === "pending pick" && !hasShift)
                        ? sum + (parseInt(job.qty, 10) || 0)
                        : sum;
                }, 0);

            } else {
                // remOrder-actual: jumlah qty semua status pending pick (tanpa filter tanggal) 
                // dan tidak memiliki shift yang ditetapkan (sama dengan logika outstandingJobValue)
                remOrderVal = Object.values(jobs || {}).reduce((sum, job) => {
                    const status = (job.status || "").toLowerCase();
                    // Periksa apakah shift kosong (undefined, null, atau string kosong setelah trim)
                    const hasShift = typeof job.shift !== 'undefined' && job.shift !== null && String(job.shift).trim() !== '';
                    
                    // Jumlahkan qty jika status 'pending pick' dan shift benar-benar tidak ada atau kosong
                    return (status === "pending pick" && !hasShift)
                        ? sum + (parseInt(job.qty, 10) || 0)
                        : sum;
                }, 0);

                // orderH1-actual: remOrder-actual + capNightShift-actual
                orderH1Val = remOrderVal + (capNightShiftActual || 0);
            }

            // --- Tampilkan ke tabel ---
            // orderH1-actual
            const orderH1Cell = document.getElementById('orderH1-actual');
            if (orderH1Cell) orderH1Cell.textContent = orderH1Val > 0 ? formatNumber(orderH1Val) : "-";

            // remOrder-actual
            const remainingOrderCell = document.getElementById('remOrder-actual');
            if (remainingOrderCell) {
                remainingOrderCell.textContent = remOrderVal > 0 ? formatNumber(remOrderVal) : "-";
            }

            // --- totalOrder-actual: remOrderDayH-actual + addDayH-actual + orderH1-actual ---
            const remOrderDayHValForTotal = Number((document.getElementById('remOrderDayH-actual')?.textContent || "0").replace(/,/g, "")) || 0;
            const addDayHValForTotal = Number((document.getElementById('addDayH-actual')?.textContent || "0").replace(/,/g, "")) || 0;
            const orderH1ValDisplay = Number((document.getElementById('orderH1-actual')?.textContent || "0").replace(/,/g, "")) || 0;
            const totalOrderVal = remOrderDayHValForTotal + addDayHValForTotal + orderH1ValDisplay;
            const totalOrderCell = document.getElementById('totalOrder-actual');
            if (totalOrderCell) {
                totalOrderCell.textContent = totalOrderVal > 0 ? formatNumber(totalOrderVal) : "-";
            }

            // --- Render data utama ke table ---
            renderShiftData(
                shiftMode === "day",
                mpDayShift,
                capDayShiftActual,
                mpNightShift,
                capNightShiftActual,
                cap1MPHour
            );

            // --- Update tampilan nilai MP Overtime pada tabel ---
            await updateMpOvertimeView(shiftMode);

            // --- Update tampilan mpDayShift-ot & mpNightShift-ot sesuai shift aktif ---
            await updateMpDayNightOtView(shiftMode);

            // --- Update nilai capNightShift-ot dan capDayShift-ot pada tabel ---
            const capNightShiftOtCell = document.getElementById('capNightShift-ot');
            const capDayShiftOtCell = document.getElementById('capDayShift-ot');
            if (shiftMode === "night") {
                if (capNightShiftOtCell) capNightShiftOtCell.textContent = capNightShiftOt > 0 ? formatNumber(capNightShiftOt) : "-";
                if (capDayShiftOtCell) capDayShiftOtCell.textContent = "";
            } else {
                if (capDayShiftOtCell) capDayShiftOtCell.textContent = capDayShiftOt > 0 ? formatNumber(capDayShiftOt) : "-";
                if (capNightShiftOtCell) capNightShiftOtCell.textContent = "";
            }

            // ===================== ACHIEVEMENT LOGIC =========================
            const mpDayShiftActual = Number((document.getElementById("mpDayShift-actual")?.textContent || "").replace(/,/g, "")) || 0;
            const capDayShiftActualVal = Number((document.getElementById("capDayShift-actual")?.textContent || "").replace(/,/g, "")) || 0;
            const cap1MPHourAchievement = Number((document.getElementById("cap1MPHour-achievement")?.textContent || "").replace(/,/g, "")) || 0;
            const mpNightShiftActual = Number((document.getElementById("mpNightShift-actual")?.textContent || "").replace(/,/g, "")) || 0;
            const capNightShiftActualVal = Number((document.getElementById("capNightShift-actual")?.textContent || "").replace(/,/g, "")) || 0;

            if (shiftMode === "day") {
                let mpDayAchv = (mpDayShiftActual !== 0) ? capDayShiftActualVal / mpDayShiftActual : 0;
                document.getElementById("mpDayShift-achievement").textContent =
                    (mpDayShiftActual > 0 && capDayShiftActualVal > 0)
                        ? Math.round(mpDayAchv).toLocaleString('en-US')
                        : "-";

                let capDayAchv = mpDayAchv - cap1MPHourAchievement;
                document.getElementById("capDayShift-achievement").textContent =
                    (mpDayShiftActual > 0 && capDayShiftActualVal > 0 && cap1MPHourAchievement > 0)
                        ? Math.round(capDayAchv).toLocaleString('en-US')
                        : "-";

                // Kosongkan kolom night shift
                document.getElementById("mpNightShift-achievement").textContent = "";
                document.getElementById("capNightShift-achievement").textContent = "";
            } else {
                // Night shift achievement
                let mpNightAchv = (mpNightShiftActual !== 0) ? capNightShiftActualVal / mpNightShiftActual : 0;
                document.getElementById("mpNightShift-achievement").textContent =
                    (mpNightShiftActual > 0 && capNightShiftActualVal > 0)
                        ? Math.round(mpNightAchv).toLocaleString('en-US')
                        : "-";

                let capNightAchv = mpNightAchv - cap1MPHourAchievement;
                document.getElementById("capNightShift-achievement").textContent =
                    (mpNightShiftActual > 0 && capNightShiftActualVal > 0 && cap1MPHourAchievement > 0)
                        ? Math.round(capNightAchv).toLocaleString('en-US')
                        : "-";

                // Kosongkan kolom day shift
                document.getElementById("mpDayShift-achievement").textContent = "";
                document.getElementById("capDayShift-achievement").textContent = "";
            }

            // ===================== PERCENTAGE LOGIC =====================
            function percentRound(val) {
                return Math.round(val * 100);
            }
            if (shiftMode === "day") {
                let cap1MPHourPercentage = 0;
                const mpDayShiftAchievement = Number((document.getElementById("mpDayShift-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                const cap1MPHourAchievement = Number((document.getElementById("cap1MPHour-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                if (mpDayShiftAchievement !== 0) {
                    cap1MPHourPercentage = cap1MPHourAchievement / mpDayShiftAchievement;
                }
                let capDayShiftPercent = 1 - cap1MPHourPercentage;
                document.getElementById("capDayShift-percentage").textContent = percentRound(capDayShiftPercent) + "%";
                document.getElementById("capNightShift-percentage").textContent = "";
            } else {
                let cap1MPHourPercentage = 0;
                const mpNightShiftAchievement = Number((document.getElementById("mpNightShift-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                const cap1MPHourAchievement = Number((document.getElementById("cap1MPHour-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                if (mpNightShiftAchievement !== 0) {
                    cap1MPHourPercentage = cap1MPHourAchievement / mpNightShiftAchievement;
                }
                let capNightShiftPercent = 1 - cap1MPHourPercentage;
                document.getElementById("capNightShift-percentage").textContent = percentRound(capNightShiftPercent) + "%";
                document.getElementById("capDayShift-percentage").textContent = "";
            }

            const totalCapActual = Number((document.getElementById("totalCap-actual")?.textContent || "").replace(/,/g, "")) || 0;
            let totalCapPercent = (totalCapActual !== 0)
                ? 1 - (88200 / totalCapActual)
                : 0;
            document.getElementById("totalCap-percentage").textContent = percentRound(totalCapPercent) + "%";

            updateSummaryCards(shiftMode);
        }

        function updateSummaryCards(shiftMode) {
            const totalOrderSummary = document.getElementById('totalOrder-summary');
            const totalCapSummary = document.getElementById('totalCap-summary');
            const remOrderSummary = document.getElementById('remOrder-summary');
            const gapNWDSummary = document.getElementById('gapNWD-summary');
            const achievementSummary = document.getElementById('achievement-summary');

            const totalOrderActual = document.getElementById('totalOrder-actual')?.textContent || "-";
            const remOrderActual = document.getElementById('remOrder-actual')?.textContent || "-";

            let capActual = "-";
            let gapNWD = "-";
            let achv = "-";

            if (shiftMode === "day") {
                const capDayShiftActualVal = Number((document.getElementById('capDayShift-actual')?.textContent || "0").replace(/,/g, "")) || 0;
                const capDayShiftOtVal = Number((document.getElementById('capDayShift-ot')?.textContent || "0").replace(/,/g, "")) || 0;
                capActual = (capDayShiftActualVal + capDayShiftOtVal) > 0 ? formatNumber(capDayShiftActualVal + capDayShiftOtVal) : "-";
                gapNWD = document.getElementById('capDayShift-gap')?.textContent || "-";
                achv = (capDayShiftActualVal + capDayShiftOtVal) > 0 ? formatNumber(capDayShiftActualVal + capDayShiftOtVal) : "-";
            } else {
                const capNightShiftActualVal = Number((document.getElementById('capNightShift-actual')?.textContent || "0").replace(/,/g, "")) || 0;
                const capNightShiftOtVal = Number((document.getElementById('capNightShift-ot')?.textContent || "0").replace(/,/g, "")) || 0;
                capActual = (capNightShiftActualVal + capNightShiftOtVal) > 0 ? formatNumber(capNightShiftActualVal + capNightShiftOtVal) : "-";
                gapNWD = document.getElementById('capNightShift-gap')?.textContent || "-";
                achv = (capNightShiftActualVal + capNightShiftOtVal) > 0 ? formatNumber(capNightShiftActualVal + capNightShiftOtVal) : "-";
            }

            if (totalOrderSummary) totalOrderSummary.textContent = totalOrderActual;
            if (totalCapSummary) totalCapSummary.textContent = capActual;
            if (remOrderSummary) remOrderSummary.textContent = remOrderActual;
            if (gapNWDSummary) gapNWDSummary.textContent = gapNWD;
            if (achievementSummary) achievementSummary.textContent = achv;
        }

        updateShiftView();

        // Event listener toggle supaya shift responsif
        if (dayToggle) dayToggle.addEventListener('change', () => updateShiftView());
        if (nightToggle) nightToggle.addEventListener('change', () => updateShiftView());
    });

});