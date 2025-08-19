// Utility Timezone & Business Date (WIB / UTC+7)

const WIB_OFFSET_HOURS = 7;
export const NIGHT_SHIFT_CUTOFF_HOUR = 6;   // 06:00 WIB → rollover business date
export const NIGHT_SHIFT_START_HOUR = 20;   // 20:00 WIB start (informasional)

/**
 * Date sekarang dalam WIB (object Date lokal sudah digeser ke WIB)
 */
export function nowInWIB() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + WIB_OFFSET_HOURS * 3600000);
}

/**
 * Konversi date apa pun ke WIB (hasil Date baru)
 */
export function toWIB(dateObj) {
  const utcMs = dateObj.getTime() + dateObj.getTimezoneOffset() * 60000;
  return new Date(utcMs + WIB_OFFSET_HOURS * 3600000);
}

export function formatDateWIB(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
export function formatTimeWIB(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function formatDateTimeWIB(d) {
  return `${formatDateWIB(d)} ${formatTimeWIB(d)}`;
}

/**
 * shiftKey: "NightShift" | "DayShift"
 */
export function getBusinessDateForShift(shiftKey, baseDate = new Date()) {
  const wib = toWIB(baseDate);
  const h = wib.getHours();
  const work = new Date(wib.getTime());
  if (shiftKey === 'NightShift') {
    // Night shift: jika jam < cutoff (06) → tanggal kemarin
    if (h < NIGHT_SHIFT_CUTOFF_HOUR) {
      work.setDate(work.getDate() - 1);
    }
  }
  return formatDateWIB(work);
}

export function breakdownBusinessDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return {
    yearKey: 'year' + y,
    monthKey: `${m}_${y.slice(2)}`,
    day: d
  };
}