import { $, icon, escapeHtml, initialsOf } from '../lib/dom.js';
import { money, dateShort, KIND_LABELS } from '../lib/format.js';

let bound = false;
let items = [];
let cursor = 0;
let navigator = null;

const SECTIONS = [
  { view: 'dashboard', title: 'İcmal', roles: ['owner', 'employee'] },
  { view: 'employees', title: 'İşçilər', roles: ['owner'] },
  { view: 'payroll', title: 'Əməkhaqqı cədvəli', roles: ['owner'] },
  { view: 'payments', title: 'Ödənişlər', roles: ['owner', 'employee'] },
  { view: 'worklog', title: 'Davamiyyət', roles: ['owner', 'employee'] },
  { view: 'leaves', title: 'Məzuniyyət', roles: ['owner', 'employee'] },
  { view: 'notes', title: 'Qeydlər', roles: ['owner'] },
  { view: 'reports', title: 'Hesabatlar', roles: ['owner'] },
  { view: 'settings', title: 'Tənzimləmələr', roles: ['owner'] },
  { view: 'profile', title: 'Şəxsi kabinet', roles: ['owner', 'employee'] },
  { view: 'help', title: 'Kömək', roles: ['owner', 'employee'] }
];

export function openPalette(state, navigate) {
  const root = $('#palette');
  if (!root) return;

  navigator = navigate;
  cursor = 0;
  root.hidden = false;
  document.body.style.overflow = 'hidden';

  const input = $('#palette-input');
  input.value = '';
  build(state, '');
  setTimeout(() => input.focus(), 20);

  if (bound) return;
  bound = true;

  const close = () => {
    root.hidden = true;
    document.body.style.overflow = '';
  };

  $('#palette-close').addEventListener('click', close);
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });

  input.addEventListener('input', () => {
    cursor = 0;
    build(state, input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(items.length - 1, cursor + 1);
      paint();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(0, cursor - 1);
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(items[cursor]);
    }
  });

  $('#palette-results').addEventListener('click', (e) => {
    const el = e.target.closest('[data-index]');
    if (!el) return;
    activate(items[Number(el.dataset.index)]);
  });
}

function activate(item) {
  if (!item) return;
  $('#palette').hidden = true;
  document.body.style.overflow = '';
  if (item.type === 'section') navigator(item.view);
  else if (item.type === 'employee') navigator('employee-detail', { id: item.id, title: item.title, subtitle: item.sub });
  else if (item.type === 'payment') navigator('payments', { title: 'Ödənişlər', subtitle: item.sub });
}

function build(state, query) {
  const q = String(query || '').trim().toLowerCase();
  const role = state.spaces[state.activeIndex]?.type || 'none';
  const currency = state.spaces[state.activeIndex]?.business?.currency || 'AZN';
  const out = [];

  const match = (text) => !q || String(text || '').toLowerCase().includes(q);

  for (const s of SECTIONS) {
    if (!s.roles.includes(role)) continue;
    if (match(s.title)) out.push({ type: 'section', view: s.view, title: s.title, sub: 'Bölmə' });
  }

  if (role === 'owner') {
    for (const e of state.employees || []) {
      if (!match(e.full_name) && !match(e.position) && !match(e.access_code)) continue;
      out.push({
        type: 'employee',
        id: e.id,
        title: e.full_name,
        sub: [e.position, money(e.monthly_salary, currency)].filter(Boolean).join(' · '),
        code: e.access_code
      });
    }
  }

  for (const p of (state.payments || []).slice(0, 120)) {
    const name = p.employees?.full_name || '';
    if (!match(name) && !match(p.note) && !match(KIND_LABELS[p.kind])) continue;
    out.push({
      type: 'payment',
      title: `${KIND_LABELS[p.kind] || p.kind} · ${money(p.amount, currency)}`,
      sub: `${name} · ${dateShort(p.paid_at)}`
    });
  }

  items = out.slice(0, 24);
  paint();
}

function paint() {
  const root = $('#palette-results');
  if (!items.length) {
    root.innerHTML = `<p class="palette__empty">Nəticə tapılmadı.</p>`;
    return;
  }

  let lastType = '';
  root.innerHTML = items
    .map((item, i) => {
      const group = item.type !== lastType ? `<p class="palette__group">${labelOf(item.type)}</p>` : '';
      lastType = item.type;
      return `${group}
        <button type="button" class="palette__item ${i === cursor ? 'is-active' : ''}" data-index="${i}">
          <span class="avatar avatar--sm" aria-hidden="true">${initialsOf(item.type === 'section' ? item.title : item.title)}</span>
          <span class="palette__item-main">
            <span class="palette__item-title">${escapeHtml(item.title)}</span>
            <span class="palette__item-sub">${escapeHtml(item.sub || '')}</span>
          </span>
          ${item.type === 'employee' && item.code ? `<span class="badge">${escapeHtml(item.code)}</span>` : icon('i-chevron-right', 14)}
        </button>`;
    })
    .join('');
}

function labelOf(type) {
  if (type === 'section') return 'Bölmələr';
  if (type === 'employee') return 'İşçilər';
  return 'Ödənişlər';
}
