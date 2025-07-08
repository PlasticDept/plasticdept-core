import { authPromise } from './config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let table;

document.addEventListener("DOMContentLoaded", function () {
  table = $("#containerTable").DataTable({
    order: [[8, 'asc']],
    scrollX: true,
    columns: Array.from({ length: 11 }, (_, i) => ({ title: ["No", "Container No", "Feet", "Container Type", "Invoice No", "Package", "Incoming Date", "Status", "Time In", "Unloading Time", "Finish"][i] }))
  });

  // Tunggu login anonymous berhasil dulu
  authPromise.then(({ db }) => {
    console.log("✅ Login anonymous berhasil, memuat data...");
    loadFirebaseData(db);
  }).catch((err) => {
    console.error("❌ Gagal login anonymous:", err);
  });
});

function getStatusProgress(timeIn, unloadingTime, finish) {
  timeIn = (timeIn || "").trim();
  unloadingTime = (unloadingTime || "").trim();
  finish = (finish || "").trim();
  if ([timeIn, unloadingTime, finish].some(val => val === "0")) return "Reschedule";
  if ([timeIn, unloadingTime, finish].every(val => val === "")) return "Waiting";
  if ([timeIn, unloadingTime, finish].every(val => val === "-")) return "Reschedule";
  if (timeIn && (!unloadingTime || unloadingTime === "-")) return "Outstanding";
  if (timeIn && unloadingTime && (!finish || finish === "-")) return "Processing";
  if (timeIn && unloadingTime && finish) return "Finish";
  return "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.toString().slice(-2);
  return `${day}-${monthNames[month]}-${shortYear}`;
}

function getContainerType(row) {
  const pkg = (row["PACKAGE"] || "").toUpperCase();
  if (pkg.includes("BAG")) return "NON PALLETIZE";
  if (pkg) return "PALLETIZE";
  return "";
}

function renderRow(row, index, id) {
  if (!row || !row["FEET"] || !row["PACKAGE"]) return "";

  const feet = row["FEET"].trim().toUpperCase();
  const containerType = getContainerType(row);

  const timeIn = row["TIME IN"] === "-" ? "" : (row["TIME IN"] || "");
  const unloadingTime = row["UNLOADING TIME"] === "-" ? "" : (row["UNLOADING TIME"] || "");
  const finish = row["FINISH"] === "-" ? "" : (row["FINISH"] || "");
  const status = getStatusProgress(timeIn, unloadingTime, finish);

  return `
    <tr data-id="${id}">
      <td>${index + 1}</td>
      <td>${row["NO CONTAINER"] || ""}</td>
      <td>${feet}</td>
      <td>${containerType}</td>
      <td>${row["INVOICE NO"] || ""}</td>
      <td>${row["PACKAGE"] || ""}</td>
      <td>${formatDate(row["INCOMING PLAN"])}</td>
      <td class="status-progress" data-status="${status}">
        <span class="label label-${status.toLowerCase()}">${status}</span>
      </td>
      <td>${timeIn}</td>
      <td>${unloadingTime}</td>
      <td>${finish}</td>
    </tr>
  `;
}

function updateSummaryCards(data) {
  let total = 0;
  let sudahDatang = 0;
  let belumDatang = 0;
  let sudahDiproses = 0;
  let belumDiproses = 0;
  let reschedule = 0;

  for (const id in data) {
    const row = data[id];
    if (!row || !row["FEET"] || !row["PACKAGE"]) continue;
    total += 1;

    const timeIn = row["TIME IN"] === "-" ? "" : (row["TIME IN"] || "");
    const unloadingTime = row["UNLOADING TIME"] === "-" ? "" : (row["UNLOADING TIME"] || "");
    const finish = row["FINISH"] === "-" ? "" : (row["FINISH"] || "");

    if (timeIn) sudahDatang += 1;
    else belumDatang += 1;

    const status = getStatusProgress(timeIn, unloadingTime, finish);
    if (status === "Finish") sudahDiproses += 1;
    else belumDiproses += 1;

    if (status === "Reschedule") reschedule += 1;
  }

  $("#totalKedatangan").text(total);
  $("#totalSudahDatang").text(sudahDatang);
  $("#totalBelumDatang").text(belumDatang);
  $("#totalSudahDiproses").text(sudahDiproses);
  $("#totalBelumDiproses").text(belumDiproses);
  $("#totalReschedule").text(reschedule);
}

function loadFirebaseData(db) {
  const dbRef = ref(db, "incoming_schedule");
  onValue(dbRef, snapshot => {
    const data = snapshot.val() || {};
    table.clear();

    let index = 0;
    for (const id in data) {
      const row = data[id];
      const html = renderRow(row, index++, id);
      if (html) table.row.add($(html));
    }

    table.draw();
    table.on('order.dt search.dt', function () {
      table.column(0, { search: 'applied', order: 'applied' }).nodes().each(function (cell, i) {
        cell.innerHTML = i + 1;
      });
    }).draw();

    updateSummaryCards(data);
  }, error => {
    console.error("❌ Gagal ambil data realtime dari Firebase:", error);
  });
}
