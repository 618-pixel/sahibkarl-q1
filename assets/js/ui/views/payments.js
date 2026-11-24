import { icon, emptyState, escapeHtml, debounce, downloadFile, toast } from '../../lib/dom.js';
import {
  money, dateShort, monthLabel, KIND_LABELS, METHOD_LABELS, buildCsv,
  currentPeriod, lastPeriods, todayISO, pluralAz
} from '../../lib/format.js';
import { openPaymentForm, openPaymentEdit } from '../forms.js';

let filterKind = 'all';
let filterPeriod = 'all';
let filterEmployee = 'all';
let searchTerm = '';

export default function renderPayments(root, ctx) {
  if (ctx.role === 'employee') return renderEmployeePayments(root, ctx);
  return renderOwnerPayments(root, ctx);
}

function renderOwnerPayments(root, ctx) {
  const { payments, employees, currency, refresh } = ctx;

  const periods = lastPeriods(12).reverse();
  const known = new Set(payments.map((p) => p.period || String(p.paid_at || '').slice(0, 7)));
  const q = searchTerm.toLowerCase();

  const filtered = payments.filter((p) => {
    if (filterKind !== 'all' && p.kind !== filterKind) return false;
    const period = p.period || String(p.paid_at || '').slice(0, 7);
    if (filterPeriod !== 'all' && period !== filterPeriod) return false;
    if (filterEmployee !== 'all' && p.employee_id !== filterEmployee) return false;
    if (!q) return true;
    return [p.employees?.full_name, p.note, p.amount, dateShort(p.paid_at)]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const totals = filtered.reduce(
    (acc, p) => {
      const a = Number(p.amount || 0);
      if (p.kind === 'deduction') acc.deduction += a;
      else acc.paid += a;
      acc[p.kind] = (acc[p.kind] || 0) + a;
      return acc;
    },
    { paid: 0, advance: 0, salary: 0, bonus: 0, deduction: 0 }
  );

  const thisMonth = currentPeriod();
  const monthTotal = payments
    .filter((p) => (p.period || String(p.paid_at || '').slice(0, 7)) === thisMonth && p.kind !== 'deduction')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  root.innerHTML = `
    <div class="grid grid--stats" style="margin-bottom:12px">
      <article class="stat stat--brand">
        <div class="stat__top"><span class="stat__label">Bu ay ödənilib</span><span class="stat__icon">${icon('i-wallet', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(monthTotal, currency)}</div>
        <div class="stat__hint">${monthLabel(thisMonth)}</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Avanslar</span><span class="stat__icon stat__icon--info">${icon('i-banknote', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.advance, currency)}</div>
        <div class="stat__hint">Seçilmiş dövr üzrə</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Maaş ödənişləri</span><span class="stat__icon">${icon('i-check-circle', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.salary, currency)}</div>
        <div class="stat__hint">Mükafat ${money(totals.bonus, currency)}</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Tutulmalar</span><span class="stat__icon stat__icon--danger">${icon('i-minus', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.deduction, currency)}</div>
        <div class="stat__hint">Maaşdan çıxılan məbləğ</div>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__search">
        ${icon('i-search', 15)}
        <input id="pay-search" type="search" placeholder="İşçi, qeyd və ya məbləğ" value="${escapeHtml(searchTerm)}" />
      </div>
      <select id="pay-kind" aria-label="Növ">
        <option value="all"${filterKind === 'all' ? ' selected' : ''}>Bütün növlər</option>
        ${Object.keys(KIND_LABELS).map((k) => `<option value="${k}"${filterKind === k ? ' selected' : ''}>${KIND_LABELS[k]}</option>`).join('')}
      </select>
      <select id="pay-period" aria-label="Dövr">
        <option value="all"${filterPeriod === 'all' ? ' selected' : ''}>Bütün dövrlər</option>
        ${periods.filter((p) => known.has(p)).map((p) => `<option value="${p}"${filterPeriod === p ? ' selected' : ''}>${monthLabel(p)}</option>`).join('')}
      </select>
      <select id="pay-employee" aria-label="İşçi">
        <option value="all"${filterEmployee === 'all' ? ' selected' : ''}>Bütün işçilər</option>
        ${employees.map((e) => `<option value="${e.id}"${filterEmployee === e.id ? ' selected' : ''}>${escapeHtml(e.full_name)}</option>`).join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" id="pay-export">${icon('i-download', 13)} CSV</button>
      <button class="btn btn--primary btn--sm" type="button" id="pay-add">${icon('i-plus', 14)} Yeni ödəniş</button>
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">${pluralAz(filtered.length, 'qeyd', 'qeyd')}</h2>
          <p class="card__sub">Cəm: ${money(totals.paid, currency)}</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${filtered.length ? `
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr><th>Tarix</th><th>İşçi</th><th>Növ</th><th>Üsul</th><th class="num">Məbləğ</th><th></th></tr>
              </thead>
              <tbody>
                ${filtered.map((p) => `
                  <tr>
                    <td class="nowrap" data-label="Tarix">${dateShort(p.paid_at)}</td>
                    <td>
                      <div class="cell-name">
                        <span>
                          <strong>${escapeHtml(p.employees?.full_name || '—')}</strong>
                          ${p.note ? `<small>${escapeHtml(p.note)}</small>` : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${p.kind === 'deduction' ? 'badge--danger' : p.kind === 'bonus' ? 'badge--ok' : p.kind === 'advance' ? 'badge--info' : ''}">
                        ${escapeHtml(KIND_LABELS[p.kind] || p.kind)}
                      </span>
                    </td>
                    <td class="tiny muted" data-label="Üsul">${escapeHtml(METHOD_LABELS[p.method] || '—')}</td>
                    <td class="num" data-label="Məbləğ" style="${p.kind === 'deduction' ? 'color:var(--danger)' : ''};font-weight:600">
                      ${p.kind === 'deduction' ? '−' : ''}${money(p.amount, currency)}
                    </td>
                    <td>
                      <div class="row-actions">
                        <button class="iconbtn iconbtn--sm" type="button" title="Redaktə" data-edit="${escapeHtml(p.id)}">${icon('i-edit', 14)}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : emptyState({
          title: payments.length ? 'Nəticə yoxdur' : 'Hələ ödəniş yoxdur',
          message: payments.length ? 'Filtrləri dəyişin və ya axtarışı təmizləyin.' : 'İlk ödənişi qeyd edin — avans, maaş və ya mükafat.',
          iconName: payments.length ? 'i-filter' : 'i-wallet',
          action: payments.length
            ? '<button class="btn btn--ghost" type="button" id="pay-reset">Filtrləri sıfırla</button>'
            : `<button class="btn btn--primary" type="button" id="pay-add2">${icon('i-plus', 14)} Ödəniş qeyd et</button>`
        })}
      </div>
    </section>
  `;

  const addPayment = () => openPaymentForm({ employees, payments, currency, onSaved: refresh });

  root.querySelector('#pay-add')?.addEventListener('click', addPayment);
  root.querySelector('#pay-add2')?.addEventListener('click', addPayment);

  const searchInput = root.querySelector('#pay-search');
  searchInput?.addEventListener('input', debounce(() => {
    searchTerm = searchInput.value;
    renderOwnerPayments(root, ctx);
    const el = root.querySelector('#pay-search');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, 220));

  root.querySelector('#pay-kind')?.addEventListener('change', (e) => {
    filterKind = e.target.value;
    renderOwnerPayments(root, ctx);
  });
  root.querySelector('#pay-period')?.addEventListener('change', (e) => {
    filterPeriod = e.target.value;
    renderOwnerPayments(root, ctx);
  });
  root.querySelector('#pay-employee')?.addEventListener('change', (e) => {
    filterEmployee = e.target.value;
    renderOwnerPayments(root, ctx);
  });

  root.querySelector('#pay-reset')?.addEventListener('click', () => {
    filterKind = 'all';
    filterPeriod = 'all';
    filterEmployee = 'all';
    searchTerm = '';
    renderOwnerPayments(root, ctx);
  });

  root.querySelector('#pay-export')?.addEventListener('click', () => {
    const rows = [['Tarix', 'İşçi', 'Növ', 'Məbləğ', 'Üsul', 'Dövr', 'Qeyd']];
    for (const p of filtered) {
      rows.push([
        p.paid_at, p.employees?.full_name || '', KIND_LABELS[p.kind] || p.kind,
        p.amount, METHOD_LABELS[p.method] || '', p.period || '', p.note || ''
      ]);
    }
    downloadFile(`odenisler-${todayISO()}.csv`, buildCsv(rows), 'text/csv;charset=utf-8');
    toast('CSV yükləndi.', 'ok');
  });

  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = payments.find((x) => x.id === b.dataset.edit);
      if (p) openPaymentEdit({ payment: p, employees, currency, onSaved: refresh });
    });
  });
}

function renderEmployeePayments(root, ctx) {
  const { payments, currency, employee, balances } = ctx;
  const me = balances.find((b) => b.id === employee?.id) || {};

  const grouped = new Map();
  for (const p of payments) {
    const key = p.period || String(p.paid_at || '').slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(p);
  }
  const periods = [...grouped.keys()].sort().reverse();

  let rowsHtml = '';
  if (!periods.length) {
    rowsHtml = emptyState({
      title: 'Hələ ödəniş yoxdur',
      message: 'Sahibkarınız ödəniş qeyd edəndə burada görünəcək.',
      iconName: 'i-wallet'
    });
  } else {
    for (const period of periods) {
      const list = grouped.get(period);
      const total = list.filter((p) => p.kind !== 'deduction').reduce((s, p) => s + Number(p.amount || 0), 0);
      const deduct = list.filter((p) => p.kind === 'deduction').reduce((s, p) => s + Number(p.amount || 0), 0);
      rowsHtml += `
        <div class="card" style="margin-bottom:11px">
          <div class="card__head">
            <div>
              <h3 class="card__title">${monthLabel(period)}</h3>
              <p class="card__sub">${pluralAz(list.length, 'qeyd', 'qeyd')} · ${money(total, currency)}${deduct ? ' · tutulma ' + money(deduct, currency) : ''}</p>
            </div>
          </div>
          <div class="card__body card__body--flush">
            <div class="list">
              ${list.map((p) => `
                <div class="list-row">
                  <span class="stat__icon ${p.kind === 'deduction' ? 'stat__icon--danger' : ''}" style="width:30px;height:30px">
                    ${icon(p.kind === 'deduction' ? 'i-minus' : 'i-wallet', 14)}
                  </span>
                  <div class="list-row__main">
                    <div class="list-row__title">${escapeHtml(KIND_LABELS[p.kind] || p.kind)}</div>
                    <div class="list-row__sub">${dateShort(p.paid_at)} · ${escapeHtml(METHOD_LABELS[p.method] || '—')}${p.note ? ' · ' + escapeHtml(p.note) : ''}</div>
                  </div>
                  <div class="list-row__end">
                    <div class="list-row__amount" style="${p.kind === 'deduction' ? 'color:var(--danger)' : ''}">
                      ${p.kind === 'deduction' ? '−' : ''}${money(p.amount, currency)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  root.innerHTML = `
    <div class="grid grid--stats" style="margin-bottom:12px">
      <article class="stat stat--brand">
        <div class="stat__top"><span class="stat__label">Aylıq maaşım</span><span class="stat__icon">${icon('i-banknote', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(employee?.monthly_salary || 0, currency)}</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Ümumi aldım</span><span class="stat__icon stat__icon--info">${icon('i-wallet', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(me.total_paid || 0, currency)}</div>
      </article>
      <article class="stat ${Number(me.balance || 0) > 0.5 ? 'stat--danger' : ''}">
        <div class="stat__top"><span class="stat__label">Qalıq</span><span class="stat__icon">${icon('i-receipt', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(Math.max(0, me.balance || 0), currency)}</div>
      </article>
    </div>

    <h2 style="font-size:14px;font-weight:700;margin-bottom:10px">Aylar üzrə</h2>
    ${rowsHtml}
  `;
}
