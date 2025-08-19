/**
 * Contoh modul penyimpanan target job dengan business date & WIB timezone.
 * Integrasikan ke form Anda:
 * - Pastikan ID elemen form disesuaikan (jobNo, qty, jobType, shiftType, team, deliveryDate, remark, deliveryNote).
 * - Pastikan script ini dimuat dengan type="module".
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  nowInWIB,
  getBusinessDateForShift,
  breakdownBusinessDate,
  formatTimeWIB,
  formatDateTimeWIB
} from "./shift-business-date.js";

// Firebase config (samakan)
const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
await signInAnonymously(auth);

// Ambil form (ganti sesuai real form Anda)
const form = document.getElementById('targetJobForm');

function getDateDBPath(businessDate) {
  const { yearKey, monthKey, day } = breakdownBusinessDate(businessDate);
  return `outJobAchievment/${yearKey}/${monthKey}/${day}`;
}

/**
 * Handler submit
 */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const shiftType = document.getElementById('shiftType').value;        // DayShift / NightShift
    const team = document.getElementById('team').value;
    const jobNo = document.getElementById('jobNo').value.trim();
    const qtyRaw = document.getElementById('qty').value;
    const jobType = document.getElementById('jobType').value;
    const deliveryDate = (document.getElementById('deliveryDate')?.value || '').trim();
    const remark = (document.getElementById('remark')?.value || '').trim();
    const deliveryNote = (document.getElementById('deliveryNote')?.value || '').trim();

    const username = localStorage.getItem('username') || 'UnknownUser';

    // Waktu sekarang UTC & WIB
    const nowUTC = new Date();
    const wibNow = nowInWIB();

    // Hitung business date berdasarkan shift
    const businessDate = getBusinessDateForShift(shiftType, nowUTC);
    const basePath = getDateDBPath(businessDate);
    const path = `${basePath}/${shiftType}/${team}`;
    const colRef = ref(db, path);

    const qty = qtyRaw !== '' ? Number(qtyRaw) : 0;

    const payload = {
      jobNo,
      qty,
      jobType,
      deliveryDate,
      remark,
      deliveryNote,
      shift: shiftType,
      team,
      teamName: team, // ganti jika Anda punya mapping nama panjang
      businessDate,            // untuk audit
      createdBy: username,     // siapa yang input
      finishAt: formatTimeWIB(wibNow), // jam selesai input (WIB)
      actualTimestampUTC: nowUTC.toISOString(),   // jejak audit UTC
      actualTimestampWIB: formatDateTimeWIB(wibNow) // jejak audit human readable WIB
    };

    await push(colRef, payload);
    alert(`Target job tersimpan (Business Date: ${businessDate}, Shift: ${shiftType}).`);
    form.reset();
  } catch (err) {
    console.error(err);
    alert('Gagal simpan: ' + err.message);
  }
});