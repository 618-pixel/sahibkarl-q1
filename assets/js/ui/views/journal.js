import { icon, emptyState, escapeHtml, debounce, downloadFile, toast, copyText } from '../../lib/dom.js';
import { buildCsv, dateShort, timeAgo, todayISO, monthLabel, money, KIND_LABELS, pluralAz } from '../../lib/format.js';

let searchTerm = '';
let typeFilter = 'all';
let visibleCount = 60;

const TYPES = [
  { value: 'all', label: 'Hamısı' },
  { value: 'payment', label: 'Ödənişlər' },
  { value: 'employee', label: 'İşçilər' },
  { value: 'worklog', label: 'Davamiyyət' },
  { value: 'leave', label: 'Məzuniyyət' },
  { value: 'note', label: 'Qeydlər' }
];

function typeLabel(type) {
  return (TYPES.find((t) => t.value === type) || {}).label || type;
}

/** Bütün biznes hadisələrini tək xronoloji jurnala yığır. */
export function buildJournal(ctx) {
  const { payments = [], worklogs = [], leaves = [], notes = [], employees = [] } = ctx;
  const empName = new Map((employees || []).map((e) => [e.id, e.full_name]));
  const rows = [];

  for (const p of payments || []) {
    rows.push({
      id: `pay:${p.id}`,
      type: 'payment',
      at: p.created_at || p.paid_at,
      date: p.paid_at,
      icon: p.kind === 'deduction' ? 'i-minus' : 'i-wallet',
      tone: p.kind === 'deduction' ? 'danger' : p.kind === 'bonus' ? 'ok' : 'info',
      title: `${KIND_LABELS[p.kind] || p.kind} · ${money(p.amount, ctx.currency)}`,
      sub: [p.employees?.full_name || empName.get(p.employee_id) || 'İşçi', p.note].filter(Boolean).join(' · ')
    });
  }

  for (const w of worklogs || []) {
    rows.push({
      id: `wl:${w.id}`,
      type: 'worklog',
      at: w.created_at || w.work_date,
      date: w.work_date,
      icon: 'i-clock',
      tone: 'info',
      title: `${Number(w.hours)} saat${Number(w.overtime) ? ` + ${Number(w.overtime)} əlavə` : ''}`,
      sub: [w.employees?.full_name || empName.get(w.employee_id) || 'İşçi', w.note].filter(Boolean).join(' · ')
    });
  }

  for (const l of leaves || []) {
    rows.push({
      id: `lv:${l.id}`,
      type: 'leave',
      at: l.decided_at || l.created_at,
      date: l.start_date,
      icon: 'i-calendar',
      tone: l.status === 'approved' ? 'ok' : l.status === 'rejected' ? 'danger' : 'warn',
      title: `Məzuniyyət — ${l.status === 'approved' ? 'təsdiqləndi' : l.status === 'rejected' ? 'rədd edildi' : 'gözləyir'}`,
      sub: [l.employees?.full_name || empName.get(l.employee_id) || 'İşçi', `${dateShort(l.start_date)} – ${dateShort(l.end_date)}`].join(' · ')
    });
  }

  for (const n of notes || []) {
    rows.push({
      id: `nt:${n.id}`,
      type: 'note',
      at: n.updated_at || n.created_at,
      date: n.due_date || n.created_at,
      icon: n.is_done ? 'i-check-circle' : 'i-note',
      tone: n.is_done ? 'ok' : 'info',
      title: n.title,
      sub: [n.is_done ? 'Tamamlanıb' : 'Açıq', n.due_date ? `son tarix ${dateShort(n.due_date)}` : null].filter(Boolean).join(' · ')
    });
  }

  for (const e of employees || []) {
    rows.push({
      id: `emp:${e.id}`,
      type: 'employee',
      at: e.created_at,
      date: e.hire_date,
      icon: 'i-users',
      tone: e.is_active ? 'info' : 'warn',
      title: `${e.full_name}${e.is_active ? '' : ' (passiv)'}`,
      sub: [e.position, money(e.monthly_salary, ctx.currency), `işə qəbul ${dateShort(e.hire_date)}`].filter(Boolean).join(' · ')
    });
  }

  rows.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  return rows;
}

export default function renderJournal(root, ctx) {
  const all = buildJournal(ctx);
  const q = searchTerm.trim().toLowerCase();

  const filtered = all.filter((r) => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (!q) return true;
    return `${r.title} ${r.sub}`.toLowerCase().includes(q);
  });

  const shown = filtered.slice(0, visibleCount);
  const counts = new Map();
  for (const r of all) counts.set(r.type, (counts.get(r.type) || 0) + 1);

  root.innerHTML = `
    <div class="toolbar">
      <div class="toolbar__search">
        ${icon('i-search', 15)}
        <input id="jn-search" type="search" placeholder="Hadisə, işçi və ya məbləğ axtar" value="${escapeHtml(searchTerm)}" />
      </div>
      <select id="jn-type" aria-label="Hadisə növü">
        ${TYPES.map((t) => `<option value="${t.value}"${typeFilter === t.value ? ' selected' : ''}>${t.label}${t.value === 'all' ? ` (${all.length})` : ` (${counts.get(t.value) || 0})`}</option>`).join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" id="jn-export">${icon('i-download', 13)} CSV</button>
      <button class="btn btn--ghost btn--sm" type="button" id="jn-copy">${icon('i-copy', 13)} Kopyala</button>
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">${pluralAz(filtered.length, 'hadisə', 'hadisə')}</h2>
          <p class="card__sub">Ödəniş, davamiyyət, məzuniyyət və qeydlər — tək xronologiyada</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${shown.length
          ? `<div class="timeline">
              ${shown
                .map(
                  (r) => `
                <article class="timeline__row timeline__row--${r.tone}">
                  <span class="timeline__icon" aria-hidden="true">${icon(r.icon, 15)}</span>
                  <div class="timeline__main">
                    <h3 class="timeline__title">${escapeHtml(r.title)}</h3>
                    <p class="timeline__sub">${escapeHtml(r.sub || '—')}</p>
                  </div>
                  <div class="timeline__end">
                    <span class="badge">${escapeHtml(typeLabel(r.type))}</span>
                    <small class="tiny muted">${dateShort(r.date)} · ${timeAgo(r.at)}</small>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
            ${filtered.length > shown.length ? `<div class="loadmore"><button class="btn btn--ghost btn--sm" type="button" id="jn-more">Daha ${Math.min(60, filtered.length - shown.length)} göstər</button></div>` : ''}`
          : emptyState({
              title: all.length ? 'Nəticə tapılmadı' : 'Hələ hadisə yoxdur',
              message: all.length
                ? 'Axtarış sözünü və ya növ filtrini dəyişin.'
                : 'İşçi əlavə edin və ya ödəniş qeyd edin — bütün hərəkətlər burada xronoloji görünəcək.',
              iconName: all.length ? 'i-search' : 'i-list',
              action: all.length ? '<button class="btn btn--ghost" type="button" id="jn-reset">Filtri sıfırla</button>' : ''
            })}
      </div>
    </section>
  `;

  const searchInput = root.querySelector('#jn-search');
  searchInput?.addEventListener(
    'input',
    debounce(() => {
      searchTerm = searchInput.value;
      visibleCount = 60;
      renderJournal(root, ctx);
      const el = root.querySelector('#jn-search');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 220)
  );

  root.querySelector('#jn-type')?.addEventListener('change', (e) => {
    typeFilter = e.target.value;
    visibleCount = 60;
    renderJournal(root, ctx);
  });

  root.querySelector('#jn-reset')?.addEventListener('click', () => {
    searchTerm = '';
    typeFilter = 'all';
    visibleCount = 60;
    renderJournal(root, ctx);
  });

  root.querySelector('#jn-more')?.addEventListener('click', () => {
    visibleCount += 60;
    renderJournal(root, ctx);
  });

  root.querySelector('#jn-export')?.addEventListener('click', () => {
    const out = [['Tarix', 'Növ', 'Hadisə', 'Detal']];
    for (const r of filtered) out.push([r.date || '', typeLabel(r.type), r.title, r.sub || '']);
    downloadFile(`jurnal-${todayISO()}.csv`, buildCsv(out), 'text/csv;charset=utf-8');
    toast('Jurnal CSV kimi yükləndi.', 'ok');
  });

  root.querySelector('#jn-copy')?.addEventListener('click', async () => {
    const lines = filtered
      .slice(0, 200)
      .map((r) => `${dateShort(r.date)}\t${typeLabel(r.type)}\t${r.title}\t${r.sub || ''}`);
    const ok = await copyText(lines.join('\n'));
    toast(ok ? 'Jurnal cədvəl kimi kopyalandı — Excel-ə yapışdıra bilərsiniz.' : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error', 4000);
  });
}

export function resetJournalFilters() {
  searchTerm = '';
  typeFilter = 'all';
  visibleCount = 60;
}
