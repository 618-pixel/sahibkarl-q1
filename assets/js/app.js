import { $, $$, toast, emptyState, initialsOf } from './lib/dom.js';
import {
  getClient,
  getSession,
  onAuthChange,
  loadContext,
  signOut,
  claimEmployeeAccount,
  listEmployees,
  listPayments,
  listBalances,
  listWorkLogs,
  listLeaves,
  listNotes,
  listActivity,
  summarize,
  friendlyError
} from './lib/store.js';
import { initAuth, showAuth } from './auth.js';
import { openBusinessForm, openPaymentForm, openJoinCodeModal, openEmployeeForm, openWorkLogForm, openLeaveForm, openNoteForm } from './ui/forms.js';
import { openPalette } from './ui/palette.js';

import renderDashboard from './ui/views/dashboard.js';
import renderEmployees, { renderEmployeeDetail } from './ui/views/employees.js';
import renderPayroll from './ui/views/payroll.js';
import renderPayments from './ui/views/payments.js';
import renderWorklog from './ui/views/worklog.js';
import renderLeaves from './ui/views/leaves.js';
import renderNotes from './ui/views/notes.js';
import renderReports from './ui/views/reports.js';
import renderSettings from './ui/views/settings.js';
import renderProfile from './ui/views/profile.js';
import renderHelp from './ui/views/help.js';
import renderJournal from './ui/views/journal.js';
import renderNotifications, {
  renderNotificationsPopover,
  updateNotificationBadges
} from './ui/views/notifications.js';

export const state = {
  session: null,
  user: null,
  profile: null,
  spaces: [],
  activeIndex: 0,
  view: 'dashboard',
  params: {},
  employees: [],
  balances: [],
  payments: [],
  worklogs: [],
  leaves: [],
  notes: [],
  activity: [],
  summary: null,
  loadedAt: null,
  fromCache: false
};

const STORE_KEY = 'rahathesab.biz';
const THEME_KEY = 'rahathesab.theme';
const VIEW_KEY = 'rahathesab.view';
const CACHE_PREFIX = 'rahathesab.cache.v2.';

const VIEWS = {
  dashboard: { title: 'İcmal', subtitle: 'Biznesin qısa mənzərəsi', render: renderDashboard, roles: ['owner', 'employee'] },
  notifications: { title: 'Bildirişlər', subtitle: 'Diqqət tələb edən hadisələr', render: renderNotifications, roles: ['owner', 'employee'] },
  employees: { title: 'İşçilər', subtitle: 'Heyət və maaşlar', render: renderEmployees, roles: ['owner'] },
  'employee-detail': { title: 'İşçi kartı', subtitle: 'Hesablaşma və tarixçə', render: renderEmployeeDetail, roles: ['owner'] },
  payroll: { title: 'Əməkhaqqı cədvəli', subtitle: 'Aylıq hesablaşma', render: renderPayroll, roles: ['owner'] },
  payments: { title: 'Ödənişlər', subtitle: 'Avans, maaş və mükafatlar', render: renderPayments, roles: ['owner', 'employee'] },
  worklog: { title: 'Davamiyyət', subtitle: 'Gündəlik iş saatları', render: renderWorklog, roles: ['owner', 'employee'] },
  leaves: { title: 'Məzuniyyət', subtitle: 'İstəklər və qərarlar', render: renderLeaves, roles: ['owner', 'employee'] },
  notes: { title: 'Qeydlər', subtitle: 'Tapşırıqlar və xatırlatmalar', render: renderNotes, roles: ['owner'] },
  reports: { title: 'Hesabatlar', subtitle: 'Aylıq dinamika və yekunlar', render: renderReports, roles: ['owner'] },
  journal: { title: 'Jurnal', subtitle: 'Bütün əməliyyatlar xronologiyada', render: renderJournal, roles: ['owner'] },
  settings: { title: 'Tənzimləmələr', subtitle: 'Biznes profili və hesab', render: renderSettings, roles: ['owner'] },
  profile: { title: 'Şəxsi kabinet', subtitle: 'Maaş, ödənişlər və qalıq', render: renderProfile, roles: ['owner', 'employee'] },
  help: { title: 'Kömək', subtitle: 'Qısa izahlar', render: renderHelp, roles: ['owner', 'employee'] }
};

export function activeSpace() {
  return state.spaces[state.activeIndex] || null;
}

export function currentRole() {
  const space = activeSpace();
  return space ? space.type : 'none';
}

export function currentBusiness() {
  const space = activeSpace();
  return space ? space.business : null;
}

export function currentEmployee() {
  const space = activeSpace();
  return space ? space.employee || null : null;
}

export async function boot() {
  try {
    getClient();
  } catch (err) {
    showFatal(err);
    return;
  }

  initAuth(async (session) => {
    await startApp(session);
  });

  onAuthChange((event) => {
    if (event === 'SIGNED_OUT') {
      resetState();
      showAuth();
    }
  });

  window.addEventListener('online', () => {
    syncSet('ok', 'Onlayn');
    if (!$('#app-shell').hidden) refreshAndRender({ silent: true });
  });
  window.addEventListener('offline', () => {
    syncSet('offline', 'Oflayn');
  });

  let lastFocusRefresh = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if ($('#app-shell').hidden || !activeSpace()) return;
    const now = Date.now();
    if (now - lastFocusRefresh < 45000) return;
    lastFocusRefresh = now;
    refreshAndRender({ silent: true });
  });

  try {
    const session = await getSession();
    if (session) await startApp(session);
    else showAuth();
  } catch (err) {
    showAuth();
  }
}

function showFatal(error) {
  $('#boot-screen').hidden = true;
  $('#app-shell').hidden = true;
  $('#auth-screen').hidden = true;
  $('#fatal-screen').hidden = false;

  const msg = $('#fatal-message');
  if (msg) msg.textContent = friendlyError(error);

  const retry = $('#fatal-retry');
  if (retry) retry.onclick = () => window.location.reload();
}

/* ---------------------------------------------------------------- yaddaş */

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* yaddaş bağlıdır */
  }
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function contextCacheKey(userId) {
  return `rahathesab.ctx.v1.${userId || 'anon'}`;
}

function snapshotCacheKey(businessId) {
  return `${CACHE_PREFIX}${businessId || 'none'}`;
}

function saveContextCache() {
  if (!state.user?.id) return;
  try {
    localStorage.setItem(
      contextCacheKey(state.user.id),
      JSON.stringify({
        at: Date.now(),
        profile: state.profile,
        spaces: state.spaces
      })
    );
  } catch {
    /* yaddaş bağlıdır */
  }
}

function readContextCache(userId) {
  const cached = readJSON(contextCacheKey(userId));
  if (!cached || !Array.isArray(cached.spaces) || !cached.spaces.length) return null;
  const valid = cached.spaces.every((s) => s && s.business && s.business.id);
  return valid ? cached : null;
}

function snapshotOf() {
  return {
    at: Date.now(),
    employees: state.employees.slice(0, 300),
    balances: state.balances.slice(0, 300),
    payments: state.payments.slice(0, 220),
    worklogs: state.worklogs.slice(0, 220),
    leaves: state.leaves.slice(0, 120),
    notes: state.notes.slice(0, 160),
    activity: state.activity.slice(0, 12)
  };
}

function saveSnapshot() {
  const space = activeSpace();
  if (!space) return;
  try {
    localStorage.setItem(snapshotCacheKey(space.business.id), JSON.stringify(snapshotOf()));
  } catch {
    /* yaddaş dolub — keş olmadan davam edirik */
  }
}

function applySnapshot(snap) {
  state.employees = Array.isArray(snap.employees) ? snap.employees : [];
  state.balances = Array.isArray(snap.balances) ? snap.balances : [];
  state.payments = Array.isArray(snap.payments) ? snap.payments : [];
  state.worklogs = Array.isArray(snap.worklogs) ? snap.worklogs : [];
  state.leaves = Array.isArray(snap.leaves) ? snap.leaves : [];
  state.notes = Array.isArray(snap.notes) ? snap.notes : [];
  state.activity = Array.isArray(snap.activity) ? snap.activity : [];

  if (currentRole() === 'employee') {
    const employee = state.spaces[state.activeIndex]?.employee;
    const ownCards = employee ? [{ id: employee.id, is_active: true, monthly_salary: employee.monthly_salary }] : [];
    state.summary = summarize(state.balances, ownCards);
  } else {
    state.summary = summarize(state.balances, state.employees);
  }

  state.loadedAt = snap.at || null;
  state.fromCache = true;
}

function dropSnapshot(businessId) {
  try {
    localStorage.removeItem(snapshotCacheKey(businessId));
  } catch {
    /* yaddaş bağlıdır */
  }
}

/* ------------------------------------------------------------ sinxron chip */

function syncSet(mode, text) {
  const chip = $('#sync-chip');
  const label = $('#sync-text');
  if (!chip) return;
  chip.dataset.state = mode;
  if (label) label.textContent = text;
  chip.title = text;
}

function syncIdle() {
  if (!navigator.onLine) return syncSet('offline', 'Oflayn');
  syncSet('ok', 'Hazır');
}

/* ------------------------------------------------------------------ start */

function safeInitialView() {
  const stored = readStored(VIEW_KEY);
  const view = stored && VIEWS[stored] ? stored : 'dashboard';
  if (view === 'employee-detail') return 'employees';
  return VIEWS[view].roles.includes(currentRole()) ? view : 'dashboard';
}

export async function startApp(session) {
  state.session = session;
  state.user = session.user;

  const cachedContext = readContextCache(session.user.id);
  let paintedFromCache = false;

  if (cachedContext) {
    try {
      state.profile = cachedContext.profile || null;
      state.spaces = cachedContext.spaces;
      const savedId = readStored(STORE_KEY);
      const idx = savedId ? state.spaces.findIndex((s) => s.business.id === savedId) : -1;
      state.activeIndex = idx >= 0 ? idx : 0;

      const space = activeSpace();
      const snap = space ? readJSON(snapshotCacheKey(space.business.id)) : null;
      if (snap) applySnapshot(snap);

      state.view = safeInitialView();
      showApp();
      if (snap) navigate(state.view);
      else renderSkeleton();
      paintedFromCache = true;
    } catch {
      paintedFromCache = false;
    }
  }

  if (!paintedFromCache) syncSet('loading', 'Yüklənir');

  try {
    await buildSpaces();

    if (!state.spaces.length) {
      showApp();
      renderWelcome();
      syncIdle();
      return;
    }

    if (!paintedFromCache) {
      state.view = safeInitialView();
      showApp();
      renderSkeleton();
    } else {
      applyRoleVisibility();
    }

    if (!paintedFromCache) syncSet('loading', 'Yüklənir');
    await refreshData({ silent: paintedFromCache });
    showApp();
    navigate(VIEWS[state.view] ? state.view : 'dashboard');
    syncIdle();
  } catch (err) {
    if (paintedFromCache) {
      syncSet('error', 'Yenilənmədi');
      toast('Məlumatlar yenilənmədi. İnternet bağlantısını yoxlayın.', 'error', 5000);
      return;
    }
    if (state.session) {
      showFatal(err);
      return;
    }
    resetState();
    showAuth();
    toast(friendlyError(err), 'error', 6000);
  }
}

function renderSkeleton() {
  const root = $('#view-root');
  if (!root) return;
  const card = '<div class="skel-card"></div>';
  root.innerHTML = `
    <div class="skel" aria-busy="true" aria-label="Yüklənir">
      <div class="skel-hero"></div>
      <div class="skel-stats">${card}${card}${card}${card}</div>
      <div class="skel-main"><div class="skel-card skel-card--tall"></div><div class="skel-card skel-card--tall"></div></div>
      <p class="skel__text">Məlumatlar yüklənir…</p>
    </div>
  `;
}

async function buildSpaces() {
  const ctx = await loadContext(state.session);
  state.profile = ctx.profile;
  state.user = ctx.user;

  const spaces = [];
  for (const b of ctx.ownedBusinesses) spaces.push({ type: 'owner', business: b, employee: null });
  for (const b of ctx.memberBusinesses) spaces.push({ type: 'employee', business: b, employee: b.employee });

  state.spaces = spaces;

  if (!spaces.length) {
    const claimed = await claimEmployeeAccount();
    if (claimed) {
      const again = await loadContext(state.session);
      state.profile = again.profile;
      for (const b of again.memberBusinesses) spaces.push({ type: 'employee', business: b, employee: b.employee });
      state.spaces = spaces;
    }
  }

  const savedId = readStored(STORE_KEY);
  const idx = savedId ? spaces.findIndex((s) => s.business.id === savedId) : -1;
  state.activeIndex = idx >= 0 ? idx : 0;

  rememberActive();
  saveContextCache();
}

function rememberActive() {
  const space = activeSpace();
  try {
    if (space) localStorage.setItem(STORE_KEY, space.business.id);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* yaddaş bağlıdır */
  }
}

export function resetState() {
  state.session = null;
  state.user = null;
  state.profile = null;
  state.spaces = [];
  state.activeIndex = 0;
  state.view = 'dashboard';
  state.params = {};
  state.employees = [];
  state.balances = [];
  state.payments = [];
  state.worklogs = [];
  state.leaves = [];
  state.notes = [];
  state.activity = [];
  state.summary = null;
  state.loadedAt = null;
  state.fromCache = false;
}

function showApp() {
  $('#boot-screen').hidden = true;
  $('#fatal-screen').hidden = true;
  $('#auth-screen').hidden = true;
  $('#app-shell').hidden = false;
  document.title = 'RahatHesab — Əməkhaqqı və işçi ucotu';

  const user = state.user;
  const name =
    state.profile?.full_name || user?.user_metadata?.full_name || user?.email || 'İstifadəçi';

  setText('#user-name', name);
  setText('#user-email', user?.email || '—');
  setText('#user-avatar', initialsOf(name));

  renderSpaceHeader();
  applyRoleVisibility();
  bindShell();
  updateNotificationBadges(viewContext());
}

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

function renderSpaceHeader() {
  const space = activeSpace();
  const bizName = space ? space.business.name : 'RahatHesab';
  setText('#business-name', bizName);
  setText('#business-avatar', initialsOf(bizName));
  setText('#business-role', space ? (space.type === 'owner' ? 'Sahibkar' : 'İşçi') : '—');

  const switchBtn = $('#business-switch-btn');
  if (switchBtn) switchBtn.disabled = state.spaces.length === 0;
}

function applyRoleVisibility() {
  const role = currentRole();

  $$('#main-nav .nav__item').forEach((btn) => {
    const cfg = VIEWS[btn.dataset.view];
    let allowed = cfg ? cfg.roles.includes(role) : true;
    if (btn.dataset.roles === 'owner') allowed = allowed && role === 'owner';
    btn.hidden = !allowed;
  });

  $$('#main-nav .nav__label').forEach((label) => {
    if (label.dataset.roles === 'owner') label.hidden = role !== 'owner';
  });

  $$('[data-roles="owner"]').forEach((el) => {
    if (el.closest('#main-nav')) return;
    el.hidden = role !== 'owner';
  });
}

let shellBound = false;

function bindShell() {
  if (shellBound) return;
  shellBound = true;

  const sidebar = $('#sidebar');
  const scrim = $('#scrim');

  const closeSidebar = () => {
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    document.body.style.overflow = '';
  };

  $('#sidebar-open')?.addEventListener('click', () => {
    sidebar.classList.add('is-open');
    scrim.hidden = false;
  });
  $('#sidebar-close')?.addEventListener('click', closeSidebar);
  scrim?.addEventListener('click', closeSidebar);

  $$('#main-nav .nav__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.view);
      closeSidebar();
    });
  });

  $('#quick-add')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentRole() !== 'owner') return;
    toggleQuickAdd();
  });

  $('#notif-open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotifPopover();
  });

  $('#search-open')?.addEventListener('click', () => openPalette(state, navigate));

  document.addEventListener('click', (e) => {
    const quickMenu = $('#quickadd-menu');
    if (quickMenu && !quickMenu.hidden && !e.target.closest('#quickadd')) closeQuickAdd();
  });

  $('#logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut();
    } catch {
      /* sessiya artıq bağlı ola bilər */
    }
    resetState();
    showAuth();
    toast('Hesabdan çıxdınız.', 'info');
  });

  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  applyTheme(getStoredTheme());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      if ($('#app-shell').hidden) return;
      e.preventDefault();
      openPalette(state, navigate);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeSidebar();
  });

  bindBusinessSwitcher();
}

function bindBusinessSwitcher() {
  const btn = $('#business-switch-btn');
  const menu = $('#business-menu');
  if (!btn || !menu) return;

  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!menu.hidden) return close();
    renderBusinessMenu();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  });

  document.addEventListener('click', (e) => {
    if (menu.hidden || e.target.closest('#bizswitch')) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close();
  });

  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-space-index]');
    if (item) {
      const idx = Number(item.dataset.spaceIndex);
      close();
      switchSpace(idx);
      return;
    }
    const action = e.target.closest('[data-menu-action]')?.dataset.menuAction;
    if (action === 'new-business') {
      close();
      openBusinessForm({ onSaved: reloadSpaces });
    } else if (action === 'join-code') {
      close();
      openJoinCodeModal({ onDone: reloadSpaces });
    }
  });
}

function renderBusinessMenu() {
  const menu = $('#business-menu');
  if (!menu) return;

  const items = state.spaces
    .map((s, i) => {
      const active = i === state.activeIndex;
      return `
        <button type="button" role="option" aria-selected="${active}" class="${active ? 'is-active' : ''}" data-space-index="${i}">
          <span class="avatar avatar--sq" style="width:24px;height:24px;font-size:10px" aria-hidden="true">${initialsOf(s.business.name)}</span>
          <span style="flex:1 1 auto;min-width:0">
            <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeText(s.business.name)}</span>
            <small style="display:block;font-size:10px;color:var(--ink-4)">${s.type === 'owner' ? 'Sahibkar' : 'İşçi'}</small>
          </span>
        </button>
      `;
    })
    .join('');

  menu.innerHTML = `
    ${items || '<p class="tiny muted" style="padding:8px">Biznes yoxdur.</p>'}
    <div class="bizswitch__sep"></div>
    <button type="button" class="bizswitch__add" data-menu-action="new-business">Yeni biznes</button>
    <button type="button" data-menu-action="join-code">Kodla qoşul</button>
  `;
}

export async function reloadSpaces() {
  await buildSpaces();
  if (!state.spaces.length) {
    renderSpaceHeader();
    applyRoleVisibility();
    renderWelcome();
    return;
  }
  renderSpaceHeader();
  applyRoleVisibility();
  await refreshData();
  if (!VIEWS[state.view] || !VIEWS[state.view].roles.includes(currentRole())) state.view = 'dashboard';
  navigate(state.view);
}

export async function switchSpace(index) {
  if (index === state.activeIndex || !state.spaces[index]) return;
  state.activeIndex = index;
  rememberActive();
  renderSpaceHeader();
  applyRoleVisibility();
  state.view = 'dashboard';
  await refreshData();
  navigate('dashboard');
  toast(`${state.spaces[index].business.name} açıldı.`, 'info', 2400);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* yaddaş bağlıdır */
  }
}

function getStoredTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><use href="#${theme === 'dark' ? 'i-sun' : 'i-moon'}"></use></svg>`;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#101614' : '#14332b');
}

let navSeq = 0;

export function navigate(view, params = {}) {
  const cfg = VIEWS[view];
  if (!cfg) return;

  if (!cfg.roles.includes(currentRole())) {
    toast('Bu bölmə sizin üçün açıq deyil.', 'info', 2400);
    if (view !== 'dashboard') return navigate('dashboard');
    return;
  }

  state.view = view;
  state.params = params || {};
  const seq = ++navSeq;
  writeStored(VIEW_KEY, view);

  $$('#main-nav .nav__item').forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  setText('#page-title', params.title || cfg.title);
  setText('#page-subtitle', params.subtitle || cfg.subtitle);

  rerender(seq);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function rerender(seq = navSeq) {
  const root = $('#view-root');
  const cfg = VIEWS[state.view];
  if (!root || !cfg) return;

  const ctx = viewContext();

  try {
    cfg.render(root, ctx);
  } catch (err) {
    root.innerHTML = emptyState({
      title: 'Bölmə yüklənmədi',
      message: friendlyError(err),
      iconName: 'i-alert',
      action: '<button class="btn btn--primary" type="button" id="render-retry">Yenidən cəhd et</button>'
    });
    $('#render-retry', root)?.addEventListener('click', () => rerender(seq));
  }
}

export function currencyOf() {
  return currentBusiness()?.currency || 'AZN';
}

export function viewContext() {
  return {
    state,
    role: currentRole(),
    business: currentBusiness(),
    employee: currentEmployee(),
    space: activeSpace(),
    employees: state.employees,
    balances: state.balances,
    payments: state.payments,
    worklogs: state.worklogs,
    leaves: state.leaves,
    notes: state.notes,
    activity: state.activity,
    summary: state.summary,
    currency: currencyOf(),
    navigate,
    rerender,
    refresh: refreshAndRender,
    reloadSpaces
  };
}

export async function refreshAndRender(options = {}) {
  const silent = options.silent === true;
  if (!silent) syncSet('loading', 'Yenilənir');
  try {
    await refreshData({ silent });
    rerender();
    if (!silent) syncIdle();
  } catch (err) {
    syncSet('error', 'Yenilənmədi');
    if (!silent) toast(friendlyError(err), 'error', 5000);
    throw err;
  }
}

export async function refreshData(options = {}) {
  const space = activeSpace();
  if (!space) return;

  const businessId = space.business.id;
  if (!options.silent) syncSet('loading', 'Yüklənir');

  if (space.type === 'owner') {
    const [employees, balances, payments, worklogs, leaves, notes, activity] = await Promise.all([
      listEmployees(businessId),
      listBalances(businessId),
      listPayments({ businessId, limit: 400 }),
      listWorkLogs({ businessId, limit: 400 }),
      listLeaves({ businessId, limit: 150 }),
      listNotes(businessId),
      listActivity(businessId, 12)
    ]);
    state.employees = employees;
    state.balances = balances;
    state.payments = payments;
    state.worklogs = worklogs;
    state.leaves = leaves;
    state.notes = notes;
    state.activity = activity;
    state.summary = summarize(balances, employees);
  } else {
    const employeeId = space.employee?.id;
    const [balances, payments, worklogs, leaves] = await Promise.all([
      listBalances(null),
      employeeId ? listPayments({ employeeId, limit: 200 }) : [],
      employeeId ? listWorkLogs({ employeeId, limit: 150 }) : [],
      employeeId ? listLeaves({ employeeId, limit: 80 }) : []
    ]);
    state.employees = [];
    state.balances = balances || [];
    state.payments = payments || [];
    state.worklogs = worklogs || [];
    state.leaves = leaves || [];
    state.notes = [];
    state.activity = [];

    const ownCards = space.employee
      ? [{ id: space.employee.id, is_active: true, monthly_salary: space.employee.monthly_salary }]
      : [];
    state.summary = summarize(state.balances, ownCards);
  }

  state.loadedAt = Date.now();
  state.fromCache = false;

  updateBadges();
  saveSnapshot();
  syncIdle();
}

function updateBadges() {
  const empBadge = $('#nav-employees-badge');
  if (empBadge) {
    const count = state.employees.filter((e) => e.is_active).length;
    empBadge.textContent = String(count);
    empBadge.hidden = count === 0;
  }

  const leaveBadge = $('#nav-leaves-badge');
  if (leaveBadge) {
    const pending = state.leaves.filter((l) => l.status === 'pending').length;
    leaveBadge.textContent = String(pending);
    leaveBadge.hidden = pending === 0;
  }

  setText('#nav-payments-label', currentRole() === 'employee' ? 'Maaşım' : 'Ödənişlər');
  setText('#nav-worklog-label', currentRole() === 'employee' ? 'İş saatlarım' : 'Davamiyyət');

  updateNotificationBadges(viewContext());
}

/* -------------------------------------------------------- quick add menu */

const QUICK_ACTIONS = [
  { id: 'payment', icon: 'i-wallet', label: 'Ödəniş qeyd et' },
  { id: 'employee', icon: 'i-user-plus', label: 'Yeni işçi' },
  { id: 'worklog', icon: 'i-clock-plus', label: 'Davamiyyət qeyd et' },
  { id: 'leave', icon: 'i-calendar', label: 'Məzuniyyət istəyi' },
  { id: 'note', icon: 'i-note', label: 'Yeni qeyd' },
  { id: 'business', icon: 'i-building', label: 'Yeni biznes' },
  { id: 'join', icon: 'i-key', label: 'Kodla qoşul' },
  { id: 'backup', icon: 'i-download', label: 'Ehtiyat nüsxə' }
];

function closeQuickAdd() {
  const menu = $('#quickadd-menu');
  const btn = $('#quick-add');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleQuickAdd() {
  const menu = $('#quickadd-menu');
  const btn = $('#quick-add');
  if (!menu || !btn) return;
  if (!menu.hidden) return closeQuickAdd();

  const businessId = currentBusiness()?.id;
  menu.innerHTML = QUICK_ACTIONS.map(
    (a) => `<button type="button" role="menuitem" data-quick="${a.id}">${icon(a.icon, 15)}<span>${a.label}</span></button>`
  ).join('');

  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');

  menu.querySelectorAll('[data-quick]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.quick;
      closeQuickAdd();
      runQuickAction(action, businessId);
    });
  });
}

function runQuickAction(action, businessId) {
  const common = { onSaved: refreshAndRender };
  switch (action) {
    case 'payment':
      openPaymentForm({ employees: state.employees, payments: state.payments, currency: currencyOf(), onSaved: refreshAndRender });
      break;
    case 'employee':
      openEmployeeForm({ businessId, currency: currencyOf(), onSaved: refreshAndRender });
      break;
    case 'worklog':
      openWorkLogForm({ employees: state.employees, onSaved: refreshAndRender });
      break;
    case 'leave':
      openLeaveForm({ employees: state.employees, onSaved: refreshAndRender });
      break;
    case 'note':
      openNoteForm({ businessId, onSaved: refreshAndRender });
      break;
    case 'business':
      openBusinessForm({ onSaved: reloadSpaces });
      break;
    case 'join':
      openJoinCodeModal({ onDone: reloadSpaces });
      break;
    case 'backup':
      import('./ui/backup.js').then((m) => m.exportBackup(viewContext()));
      break;
    default:
      break;
  }
  void common;
}

/* ------------------------------------------------------- notification pop */

let notifPopBound = false;

function closeNotifPopover() {
  const pop = $('#notif-pop');
  if (!pop) return;
  pop.hidden = true;
  document.body.style.overflow = '';
}

function openNotifPopover() {
  let pop = $('#notif-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'notif-pop';
    pop.className = 'notifpop';
    pop.hidden = true;
    pop.innerHTML = '<div class="notifpop__panel" role="dialog" aria-modal="true" aria-label="Bildirişlər"></div>';
    document.body.appendChild(pop);
  }

  const panel = pop.querySelector('.notifpop__panel');
  renderNotificationsPopover(panel, viewContext(), (view) => {
    closeNotifPopover();
    navigate(view);
  });

  pop.hidden = false;
  document.body.style.overflow = 'hidden';

  if (!notifPopBound) {
    notifPopBound = true;
    pop.addEventListener('mousedown', (e) => {
      if (e.target === pop) closeNotifPopover();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) closeNotifPopover();
    });
  }
}

function renderWelcome() {
  const quick = $('#quickadd');
  if (quick) quick.hidden = true;
  setText('#page-title', 'Başlayaq');
  setText('#page-subtitle', 'Bir seçim edin');

  const root = $('#view-root');
  if (!root) return;

  root.innerHTML = `
    <div class="grid grid--2" style="max-width:820px;margin:0 auto">
      <section class="card">
        <div class="card__body">
          <h2 style="font-size:15px;font-weight:700;margin-bottom:5px">Mən sahibkaram</h2>
          <p class="tiny muted" style="line-height:1.6;margin-bottom:14px">
            Biznes yaradın, işçiləri əlavə edin və maaş uçotuna başlayın.
          </p>
          <button class="btn btn--primary btn--block" type="button" id="welcome-create-business">Biznes yarat</button>
        </div>
      </section>

      <section class="card">
        <div class="card__body">
          <h2 style="font-size:15px;font-weight:700;margin-bottom:5px">Mən işçiyəm</h2>
          <p class="tiny muted" style="line-height:1.6;margin-bottom:14px">
            Sahibkarınızdan aldığınız 8 simvollu kodu daxil edin.
          </p>
          <button class="btn btn--ghost btn--block" type="button" id="welcome-join-code">Kodu daxil et</button>
        </div>
      </section>
    </div>

    <p class="tiny muted center" style="margin-top:16px">
      Hesab: ${escapeText(state.user?.email || '—')}
    </p>
  `;

  $('#welcome-create-business', root)?.addEventListener('click', () => openBusinessForm({ onSaved: reloadSpaces }));
  $('#welcome-join-code', root)?.addEventListener('click', () => openJoinCodeModal({ onDone: reloadSpaces }));
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export { VIEWS };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
