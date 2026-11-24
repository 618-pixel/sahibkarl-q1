/**
 * QA harness — bütün görünüşləri saxta məlumatla render edir və xətaları toplayır.
 * Yalnız inkişaf/QA üçündür; build nəticəsinə (dist) daxil edilmir.
 */

const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true">
  <defs>
    ${[
      'i-grid', 'i-users', 'i-wallet', 'i-chart', 'i-settings', 'i-user', 'i-mail', 'i-lock',
      'i-eye', 'i-eye-off', 'i-shield', 'i-check-circle', 'i-check', 'i-plus', 'i-minus', 'i-close',
      'i-menu', 'i-search', 'i-edit', 'i-trash', 'i-logout', 'i-moon', 'i-sun', 'i-alert', 'i-info',
      'i-calendar', 'i-building', 'i-briefcase', 'i-banknote', 'i-trending', 'i-download', 'i-upload',
      'i-chevron-down', 'i-chevron-right', 'i-arrow-left', 'i-arrow-right', 'i-receipt', 'i-copy',
      'i-clock', 'i-key', 'i-note', 'i-help', 'i-refresh', 'i-print', 'i-filter', 'i-file',
      'i-bell', 'i-list', 'i-check-all', 'i-user-plus', 'i-clock-plus', 'i-spark', 'i-arrow-up',
      'i-arrow-down', 'i-sort', 'i-wifi-off', 'i-cash'
    ]
      .map((id) => `<symbol id="${id}" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>`)
      .join('')}
  </defs>
</svg>`;
document.body.insertAdjacentHTML('afterbegin', SPRITE);

const out = document.getElementById('qa-out');
const log = (msg) => {
  out.textContent += msg + '\n';
};
const errors = [];
window.addEventListener('error', (e) => errors.push(`window.error: ${e.message}`));

const now = new Date();
const iso = (d) => d.toISOString();
const day = (offset) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return iso(d).slice(0, 10);
};
const month = (offset) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const business = {
  id: 'b1',
  name: 'Mərkəz Kafe',
  legal_name: 'Mərkəz Kafe MMC',
  currency: 'AZN',
  pay_day: 5,
  phone: '+994 12 555 44 33',
  email: 'info@merkez.az',
  address: 'Bakı, Nizami küç. 203',
  join_code: 'K7M4P9QX'
};

const employees = [
  { id: 'e1', business_id: 'b1', full_name: 'Nigar Əliyeva', position: 'Satış meneceri', monthly_salary: 1200, phone: '+994501112233', email: 'nigar@mail.az', hire_date: day(-400), is_active: true, access_code: 'AAA11111', user_id: 'u2', notes: 'Səhifə növbəsi' },
  { id: 'e2', business_id: 'b1', full_name: 'Rəşad Məmmədov', position: 'Aşpaz', monthly_salary: 950, phone: '', email: '', hire_date: day(-200), is_active: true, access_code: 'BBB22222', user_id: null },
  { id: 'e3', business_id: 'b1', full_name: 'Aygün Həsənova', position: '', monthly_salary: 0, phone: '', email: '', hire_date: day(-30), is_active: true, access_code: 'CCC33333', user_id: null },
  { id: 'e4', business_id: 'b1', full_name: 'Elvin Quliyev', position: 'Ofisiant', monthly_salary: 700, phone: '', email: '', hire_date: day(-700), is_active: false, access_code: 'DDD44444', user_id: null }
];

const balances = employees.map((e, i) => ({
  id: e.id,
  business_id: 'b1',
  full_name: e.full_name,
  position: e.position,
  monthly_salary: e.monthly_salary,
  is_active: e.is_active,
  user_id: e.user_id,
  months_count: i + 3,
  accrued_total: e.monthly_salary * (i + 3),
  total_advance: 300 * i,
  total_salary_paid: 500,
  total_bonus: i === 0 ? 150 : 0,
  total_deduction: i === 1 ? 50 : 0,
  total_paid: 300 * i + 500,
  paid_this_month: i === 0 ? 400 : 0,
  balance: Math.max(0, e.monthly_salary * (i + 3) - (300 * i + 500))
}));

const payments = [];
const kinds = ['advance', 'salary', 'bonus', 'deduction'];
const methods = ['cash', 'card', 'bank'];
for (let m = 5; m >= 0; m--) {
  for (let i = 0; i < 4; i++) {
    const emp = employees[i];
    const kind = kinds[(m + i) % kinds.length];
    payments.push({
      id: `p${m}${i}`,
      business_id: 'b1',
      employee_id: emp.id,
      employees: { id: emp.id, full_name: emp.full_name, position: emp.position },
      kind,
      amount: 100 + i * 120 + m * 30,
      paid_at: day(-m * 30 - i),
      period: month(-m),
      method: methods[i % methods.length],
      note: m % 2 ? 'Aylıq ödəniş' : '',
      created_at: iso(new Date(now.getTime() - (m * 30 + i) * 86400000))
    });
  }
}

const worklogs = [];
for (let d = 0; d < 40; d++) {
  for (let i = 0; i < 3; i++) {
    worklogs.push({
      id: `w${d}${i}`,
      business_id: 'b1',
      employee_id: employees[i].id,
      employees: { id: employees[i].id, full_name: employees[i].full_name },
      work_date: day(-d),
      hours: 8,
      overtime: d % 5 === 0 ? 2 : 0,
      note: d === 0 ? '' : 'Normal növbə',
      created_at: iso(new Date(now.getTime() - d * 86400000))
    });
  }
}

const leaves = [
  { id: 'l1', business_id: 'b1', employee_id: 'e1', employees: { id: 'e1', full_name: 'Nigar Əliyeva' }, kind: 'vacation', start_date: day(10), end_date: day(17), reason: 'Ailəvi səbəb', status: 'pending', created_at: iso(now), decided_at: null },
  { id: 'l2', business_id: 'b1', employee_id: 'e2', employees: { id: 'e2', full_name: 'Rəşad Məmmədov' }, kind: 'sick', start_date: day(-5), end_date: day(-3), reason: '', status: 'approved', created_at: iso(new Date(now.getTime() - 6 * 86400000)), decided_at: iso(new Date(now.getTime() - 5 * 86400000)) },
  { id: 'l3', business_id: 'b1', employee_id: 'e3', employees: { id: 'e3', full_name: 'Aygün Həsənova' }, kind: 'unpaid', start_date: day(-20), end_date: day(-18), reason: 'Şəxsi', status: 'rejected', created_at: iso(new Date(now.getTime() - 21 * 86400000)), decided_at: iso(new Date(now.getTime() - 19 * 86400000)) }
];

const notes = [
  { id: 'n1', business_id: 'b1', title: 'Yeni işçi üçün müqavilə', body: 'Hüquqşünasla razılaşdırmaq lazımdır', is_done: false, due_date: day(-2), created_at: iso(new Date(now.getTime() - 5 * 86400000)), updated_at: iso(now) },
  { id: 'n2', business_id: 'b1', title: 'Vergi bəyannaməsi', body: '', is_done: false, due_date: day(0), created_at: iso(now), updated_at: iso(now) },
  { id: 'n3', business_id: 'b1', title: 'Kassa inventarı', body: 'Aylıq yoxlama', is_done: true, due_date: day(-10), created_at: iso(new Date(now.getTime() - 12 * 86400000)), updated_at: iso(new Date(now.getTime() - 9 * 86400000)) }
];

const activity = [
  { id: 'a1', business_id: 'b1', action: 'Yeni işçi əlavə edildi', detail: 'Aygün Həsənova', actor_name: 'Sahibkar', created_at: iso(new Date(now.getTime() - 3600000)) },
  { id: 'a2', business_id: 'b1', action: 'Ödəniş qeyd edildi', detail: 'Nigar Əliyeva — 520 ₼', actor_name: 'Sahibkar', created_at: iso(new Date(now.getTime() - 7200000)) },
  { id: 'a3', business_id: 'b1', action: 'Biznes yaradıldı', detail: 'Mərkəz Kafe', actor_name: 'Sahibkar', created_at: iso(new Date(now.getTime() - 60 * 86400000)) }
];

const state = {
  session: { user: { id: 'u1', email: 'owner@merkez.az', created_at: iso(now) } },
  user: { id: 'u1', email: 'owner@merkez.az', user_metadata: { full_name: 'Sahibkar Adam' }, created_at: iso(now) },
  profile: { id: 'u1', full_name: 'Sahibkar Adam', phone: '+994501234567' },
  spaces: [{ type: 'owner', business, employee: null }],
  activeIndex: 0,
  view: 'dashboard',
  params: {},
  employees,
  balances,
  payments,
  worklogs,
  leaves,
  notes,
  activity,
  summary: null
};

const summarize = (bals, emps) => {
  const active = (emps || []).filter((e) => e.is_active);
  const ids = new Set(active.map((e) => e.id));
  const t = { monthlyFund: active.reduce((s, e) => s + Number(e.monthly_salary || 0), 0), accrued: 0, paid: 0, balance: 0, advance: 0, salaryPaid: 0, bonus: 0, deduction: 0, paidThisMonth: 0 };
  for (const r of bals || []) {
    if (!ids.has(r.id)) continue;
    t.accrued += Number(r.accrued_total || 0);
    t.paid += Number(r.total_paid || 0);
    t.balance += Number(r.balance || 0);
    t.advance += Number(r.total_advance || 0);
    t.salaryPaid += Number(r.total_salary_paid || 0);
    t.bonus += Number(r.total_bonus || 0);
    t.deduction += Number(r.total_deduction || 0);
    t.paidThisMonth += Number(r.paid_this_month || 0);
  }
  return { ...t, employeeCount: active.length, totalCount: (emps || []).length, inactiveCount: (emps || []).length - active.length, payoutRate: t.accrued > 0 ? Math.min(100, (t.paid / t.accrued) * 100) : 0 };
};
state.summary = summarize(balances, employees);

const views = await Promise.all([
  import('../assets/js/ui/views/dashboard.js'),
  import('../assets/js/ui/views/employees.js'),
  import('../assets/js/ui/views/payroll.js'),
  import('../assets/js/ui/views/payments.js'),
  import('../assets/js/ui/views/worklog.js'),
  import('../assets/js/ui/views/leaves.js'),
  import('../assets/js/ui/views/notes.js'),
  import('../assets/js/ui/views/reports.js'),
  import('../assets/js/ui/views/settings.js'),
  import('../assets/js/ui/views/profile.js'),
  import('../assets/js/ui/views/help.js'),
  import('../assets/js/ui/views/journal.js'),
  import('../assets/js/ui/views/notifications.js'),
  import('../assets/js/ui/forms.js')
]);

const [dashboard, employeesView, payrollV, paymentsV, worklogV, leavesV, notesV, reportsV, settingsV, profileV, helpV, journalV, notificationsV, forms] = views;

const root = document.getElementById('view-root');
const ctxOf = (role, employee = null) => ({
  state,
  role,
  business,
  employee,
  space: role === 'owner' ? state.spaces[0] : { type: 'employee', business, employee },
  employees: role === 'owner' ? employees : [],
  balances: role === 'owner' ? balances : balances.filter((b) => b.id === employee?.id),
  payments: role === 'owner' ? payments : payments.filter((p) => p.employee_id === employee?.id),
  worklogs: role === 'owner' ? worklogs : worklogs.filter((w) => w.employee_id === employee?.id),
  leaves: role === 'owner' ? leaves : leaves.filter((l) => l.employee_id === employee?.id),
  notes: role === 'owner' ? notes : [],
  activity: role === 'owner' ? activity : [],
  summary: state.summary,
  currency: 'AZN',
  navigate: () => {},
  rerender: () => {},
  refresh: async () => {},
  reloadSpaces: async () => {}
});

const cases = [
  ['dashboard (owner)', () => dashboard.default(root, ctxOf('owner'))],
  ['dashboard (employee)', () => dashboard.default(root, ctxOf('employee', employees[0]))],
  ['employees', () => employeesView.default(root, ctxOf('owner'))],
  ['employee-detail', () => employeesView.renderEmployeeDetail(root, { ...ctxOf('owner'), state: { ...state, params: { id: 'e1' } } })],
  ['employee-detail (missing)', () => employeesView.renderEmployeeDetail(root, { ...ctxOf('owner'), state: { ...state, params: { id: 'nope' } } })],
  ['payroll', () => payrollV.default(root, ctxOf('owner'))],
  ['payments (owner)', () => paymentsV.default(root, ctxOf('owner'))],
  ['payments (employee)', () => paymentsV.default(root, ctxOf('employee', employees[0]))],
  ['worklog (owner)', () => worklogV.default(root, ctxOf('owner'))],
  ['worklog (employee)', () => worklogV.default(root, ctxOf('employee', employees[0]))],
  ['leaves (owner)', () => leavesV.default(root, ctxOf('owner'))],
  ['leaves (employee)', () => leavesV.default(root, ctxOf('employee', employees[0]))],
  ['notes', () => notesV.default(root, ctxOf('owner'))],
  ['reports', () => reportsV.default(root, ctxOf('owner'))],
  ['journal', () => journalV.default(root, ctxOf('owner'))],
  ['notifications (owner)', () => notificationsV.default(root, ctxOf('owner'))],
  ['notifications (employee)', () => notificationsV.default(root, ctxOf('employee', employees[0]))],
  ['settings', () => settingsV.default(root, ctxOf('owner'))],
  ['profile (owner)', () => profileV.default(root, ctxOf('owner'))],
  ['profile (employee)', () => profileV.default(root, ctxOf('employee', employees[0]))],
  ['help (owner)', () => helpV.default(root, ctxOf('owner'))],
  ['help (employee)', () => helpV.default(root, ctxOf('employee', employees[0]))]
];

const emptyCtx = () => {
  const empty = {
    ...ctxOf('owner'),
    employees: [],
    balances: [],
    payments: [],
    worklogs: [],
    leaves: [],
    notes: [],
    activity: [],
    summary: summarize([], [])
  };
  return empty;
};

const emptyCases = [
  ['dashboard (boş)', () => dashboard.default(root, emptyCtx())],
  ['employees (boş)', () => employeesView.default(root, emptyCtx())],
  ['payroll (boş)', () => payrollV.default(root, emptyCtx())],
  ['payments (boş)', () => paymentsV.default(root, emptyCtx())],
  ['worklog (boş)', () => worklogV.default(root, emptyCtx())],
  ['leaves (boş)', () => leavesV.default(root, emptyCtx())],
  ['notes (boş)', () => notesV.default(root, emptyCtx())],
  ['reports (boş)', () => reportsV.default(root, emptyCtx())],
  ['journal (boş)', () => journalV.default(root, emptyCtx())],
  ['notifications (boş)', () => notificationsV.default(root, emptyCtx())]
];

function check(html, label) {
  const problems = [];
  if (/undefined|NaN|\[object Object\]/.test(html)) problems.push('məzmunda undefined/NaN/[object Object]');
  if (html.trim().length < 40) problems.push('çıxış çox qısadır');
  const broken = [...html.matchAll(/href="#(i-[a-z-]+)"/g)].map((m) => m[1]);
  const spriteIds = new Set(['i-grid','i-users','i-wallet','i-chart','i-settings','i-user','i-mail','i-lock','i-eye','i-eye-off','i-shield','i-check-circle','i-check','i-plus','i-minus','i-close','i-menu','i-search','i-edit','i-trash','i-logout','i-moon','i-sun','i-alert','i-info','i-calendar','i-building','i-briefcase','i-banknote','i-trending','i-download','i-upload','i-chevron-down','i-chevron-right','i-arrow-left','i-arrow-right','i-receipt','i-copy','i-clock','i-key','i-note','i-help','i-refresh','i-print','i-filter','i-file','i-bell','i-list','i-check-all','i-user-plus','i-clock-plus','i-spark','i-arrow-up','i-arrow-down','i-sort','i-wifi-off','i-cash']);
  const missing = [...new Set(broken)].filter((id) => !spriteIds.has(id));
  if (missing.length) problems.push(`sprite-də olmayan ikon: ${missing.join(', ')}`);
  return problems;
}

let pass = 0;
let fail = 0;

for (const [label, run] of [...cases, ...emptyCases]) {
  root.innerHTML = '';
  try {
    run();
    const problems = check(root.innerHTML, label);
    if (problems.length) {
      fail++;
      log(`FAIL  ${label}: ${problems.join(' | ')}`);
    } else {
      pass++;
      log(`ok    ${label}`);
    }
  } catch (err) {
    fail++;
    log(`ERROR ${label}: ${err.message}`);
  }
}

// Formaları açıb yoxlayırıq
const formCases = [
  ['form: business', () => forms.openBusinessForm({ business, onSaved: async () => {} })],
  ['form: employee new', () => forms.openEmployeeForm({ businessId: 'b1', currency: 'AZN', onSaved: async () => {} })],
  ['form: employee edit', () => forms.openEmployeeForm({ businessId: 'b1', employee: employees[0], currency: 'AZN', onSaved: async () => {} })],
  ['form: payment', () => forms.openPaymentForm({ employees, payments, currency: 'AZN', onSaved: async () => {} })],
  ['form: payment edit', () => forms.openPaymentEdit({ payment: payments[0], employees, currency: 'AZN', onSaved: async () => {} })],
  ['form: worklog', () => forms.openWorkLogForm({ employees, onSaved: async () => {} })],
  ['form: leave (owner)', () => forms.openLeaveForm({ employees, onSaved: async () => {} })],
  ['form: leave (employee)', () => forms.openLeaveForm({ employeeId: 'e1', onSaved: async () => {} })],
  ['form: note new', () => forms.openNoteForm({ businessId: 'b1', onSaved: async () => {} })],
  ['form: note edit', () => forms.openNoteForm({ businessId: 'b1', note: notes[0], onSaved: async () => {} })],
  ['form: import csv', () => forms.openImportEmployeesModal({ businessId: 'b1', currency: 'AZN', onSaved: async () => {} })],
  ['form: bulk pay', () => forms.openBulkPayModal({ rows: [{ employee_id: 'e1', full_name: 'Nigar Əliyeva', amount: 800 }], currency: 'AZN', period: month(0), onSaved: async () => {} })],
  ['form: join code', () => forms.openJoinCodeModal({ onDone: async () => {} })]
];

const modalRoot = document.getElementById('modal-root');
const dom = await import('../assets/js/lib/dom.js');

for (const [label, run] of formCases) {
  try {
    run();
    const html = modalRoot.innerHTML;
    const problems = [];
    if (!html.length) problems.push('modal boşdur');
    if (/undefined|NaN|\[object Object\]/.test(html)) problems.push('modalda undefined/NaN/[object Object]');
    const inputs = modalRoot.querySelectorAll('input, select, textarea');
    for (const el of inputs) {
      const id = el.id;
      if (id) {
        const labelEl = modalRoot.querySelector(`label[for="${id}"]`);
        const wrapped = el.closest('label');
        if (!labelEl && !wrapped) problems.push(`etiketə bağlanmayan sahə: #${id}`);
      }
    }
    if (problems.length) {
      fail++;
      log(`FAIL  ${label}: ${problems.join(' | ')}`);
    } else {
      pass++;
      log(`ok    ${label} (${inputs.length} sahə)`);
    }
  } catch (err) {
    fail++;
    log(`ERROR ${label}: ${err.message}`);
  } finally {
    dom.closeModal(true);
  }
}

// Bildiriş məntiqini ayrıca yoxlayırıq
try {
  const notifLib = await import('../assets/js/lib/notifications.js');
  const items = notifLib.buildNotifications({ role: 'owner', business, employees, balances, payments, worklogs, leaves, notes, activity, currency: 'AZN' });
  if (!Array.isArray(items) || !items.length) throw new Error('owner bildirişləri boşdur');
  const ids = items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) throw new Error('bildiriş ID-ləri təkrarlanır');
  for (const i of items) {
    if (!i.id || !i.title || !i.tone) throw new Error(`natamam bildiriş: ${JSON.stringify(i).slice(0, 120)}`);
  }
  const empItems = notifLib.buildNotifications({ role: 'employee', business, employee: employees[0], balances, payments, worklogs, leaves, currency: 'AZN' });
  if (!empItems.length) throw new Error('işçi bildirişləri boşdur');
  const readMap = notifLib.markAllRead('qa-biz', items);
  if (notifLib.unreadCount(items, readMap) !== 0) throw new Error('markAllRead işləmədi');
  notifLib.clearRead('qa-biz');
  if (notifLib.unreadCount(items, {}) !== items.length) throw new Error('clearRead işləmədi');
  pass++;
  log(`ok    bildiriş məntiqi (owner ${items.length}, işçi ${empItems.length})`);
} catch (err) {
  fail++;
  log(`ERROR bildiriş məntiqi: ${err.message}`);
}

// Jurnal məntiqi
try {
  const rows = journalV.buildJournal(ctxOf('owner'));
  if (!rows.length) throw new Error('jurnal boşdur');
  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error('jurnal ID təkrarı');
  for (const r of rows) if (!r.type || !r.title) throw new Error('natamam jurnal sətri');
  pass++;
  log(`ok    jurnal məntiqi (${rows.length} hadisə)`);
} catch (err) {
  fail++;
  log(`ERROR jurnal: ${err.message}`);
}

// Keyboard/ARIA yoxlaması — hər görünüşdə ən azı bir başlıq olmalıdır
log('');
log(`NƏTİCƏ: ${pass} keçdi, ${fail} uğursuz`);
if (errors.length) log(`Pəncərə xətaları: ${errors.join(' | ')}`);
document.title = fail === 0 ? `QA PASS ${pass}` : `QA FAIL ${fail}`;
