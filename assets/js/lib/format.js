const AZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'
];

const AZ_MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

const nf2 = new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const SYMBOLS = { AZN: '₼', USD: '$', EUR: '€', TRY: '₺', RUB: '₽' };

function symbolOf(currency) {
  return SYMBOLS[currency] || currency || '';
}

export function money(value, currency = 'AZN') {
  return `${nf2.format(toNumber(value))} ${symbolOf(currency)}`;
}

export function moneyCompact(value, currency = 'AZN') {
  const n = toNumber(value);
  const sym = symbolOf(currency);
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${nf2.format(n / 1000000)} mln ${sym}`;
  if (abs >= 10000) return `${nf1.format(n / 1000)} min ${sym}`;
  return `${nf0.format(Math.round(n))} ${sym}`;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const pad = (n) => String(n).padStart(2, '0');

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateLong(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dateShort(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function dateInput(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return '—';
  const [y, m] = period.split('-').map(Number);
  if (m < 1 || m > 12) return '—';
  return `${AZ_MONTHS[m - 1]} ${y}`;
}

export function lastPeriods(count = 6) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}

export function daysBetween(fromISO, toISO) {
  const a = parseDate(fromISO);
  const b = parseDate(toISO);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

export function timeAgo(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'indicə';
  if (min < 60) return `${min} dəq əvvəl`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} saat əvvəl`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'dünən';
  if (days < 7) return `${days} gün əvvəl`;
  return dateShort(iso);
}

export function pluralAz(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export const KIND_LABELS = {
  advance: 'Avans',
  salary: 'Maaş',
  bonus: 'Mükafat',
  deduction: 'Tutulma'
};

export const METHOD_LABELS = {
  cash: 'Nağd',
  card: 'Kart',
  bank: 'Bank köçürməsi',
  other: 'Digər'
};

export const LEAVE_LABELS = {
  vacation: 'Məzuniyyət',
  sick: 'Xəstəlik',
  unpaid: 'Ödənişsiz',
  other: 'Digər'
};

export const LEAVE_STATUS = {
  pending: { label: 'Gözləyir', cls: 'badge--warn' },
  approved: { label: 'Təsdiqlənib', cls: 'badge--ok' },
  rejected: { label: 'Rədd edilib', cls: 'badge--danger' }
};

export const CURRENCIES = ['AZN', 'USD', 'EUR', 'TRY', 'RUB'];

export function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(rows, delimiter = ';') {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(delimiter)).join('\r\n');
}

