import { icon, emptyState, escapeHtml, downloadFile, toast } from '../../lib/dom.js';
import { money, monthLabel, currentPeriod, lastPeriods, buildCsv } from '../../lib/format.js';
import { openPaymentForm, openBulkPayModal, openPayslipModal } from '../forms.js';

let period = currentPeriod();

export default function renderPayroll(root, ctx) {
  const { employees, balances, payments, currency, business, refresh } = ctx;

  const balanceOf = new Map((balances || []).map((b) => [b.id, b]));
  const active = employees.filter((e) => e.is_active);

  const options = lastPeriods(14).reverse();
  if (!options.includes(period)) options.unshift(period);

  const rows = active.map((e) => {
    const b = balanceOf.get(e.id) || {};
    const salary = Number(e.monthly_salary || 0);
    const paidThisMonth = payments
      .filter((p) => p.employee_id === e.id && (p.period || String(p.paid_at || '').slice(0, 7)) === period)
      .reduce((s, p) => (p.kind === 'deduction' ? s - Number(p.amount || 0) : s + Number(p.amount || 0)), 0);
    const remaining = Math.max(0, salary - paidThisMonth);
    return {
      employee_id: e.id,
      full_name: e.full_name,
      position: e.position,
      salary,
      paidThisMonth,
      remaining,
      totalBalance: Math.max(0, Number(b.balance || 0)),
      isPaid: salary > 0 && paidThisMonth >= salary
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      salary: acc.salary + r.salary,
      paid: acc.paid + r.paidThisMonth,
      remaining: acc.remaining + r.remaining,
      balance: acc.balance + r.totalBalance
    }),
    { salary: 0, paid: 0, remaining: 0, balance: 0 }
  );

  root.innerHTML = `
    <div class="toolbar">
      <select id="pr-period" aria-label="Dövr">
        ${options.map((p) => `<option value="${p}"${p === period ? ' selected' : ''}>${monthLabel(p)}</option>`).join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" id="pr-export">${icon('i-download', 14)} CSV</button>
      <button class="btn btn--ghost btn--sm" type="button" id="pr-print">${icon('i-print', 14)} Çap</button>
      <button class="btn btn--primary btn--sm" type="button" id="pr-bulk">Toplu ödəniş</button>
    </div>

    <div class="grid grid--stats" style="margin-bottom:14px">
      <article class="stat stat--brand">
        <div class="stat__top"><span class="stat__label">Aylıq fond</span><span class="stat__icon">${icon('i-banknote', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.salary, currency)}</div>
        <div class="stat__hint">${monthLabel(period)}</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Ödənilib</span><span class="stat__icon stat__icon--info">${icon('i-wallet', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.paid, currency)}</div>
        <div class="stat__hint">Bu dövr üzrə</div>
      </article>
      <article class="stat ${totals.remaining > 0.5 ? 'stat--danger' : ''}">
        <div class="stat__top"><span class="stat__label">Qalıq</span><span class="stat__icon ${totals.remaining > 0.5 ? 'stat__icon--danger' : ''}">${icon('i-receipt', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.remaining, currency)}</div>
        <div class="stat__hint">${rows.filter((r) => !r.isPaid && r.salary > 0).length} işçi tam ödənilməyib</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Ümumi qalıq borc</span><span class="stat__icon">${icon('i-trending', 14)}</span></div>
        <div class="stat__value stat__value--sm">${money(totals.balance, currency)}</div>
        <div class="stat__hint">Bütün dövr üzrə</div>
      </article>
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">${monthLabel(period)} — hesablaşma</h2>
          <p class="card__sub">Aylıq maaş, ödənilən məbləğ və qalıq</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${rows.length ? `
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>İşçi</th>
                  <th class="num">Maaş</th>
                  <th class="num">Ödənilib</th>
                  <th class="num">Qalıq</th>
                  <th>Vəziyyət</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r) => `
                  <tr>
                    <td>
                      <div class="cell-name">
                        <span>
                          <strong>${escapeHtml(r.full_name)}</strong>
                          <small>${escapeHtml(r.position || '—')}</small>
                        </span>
                      </div>
                    </td>
                    <td class="num" data-label="Maaş">${money(r.salary, currency)}</td>
                    <td class="num" data-label="Ödənilib">${money(r.paidThisMonth, currency)}</td>
                    <td class="num" data-label="Qalıq" style="${r.remaining > 0.5 ? 'color:var(--danger);font-weight:700' : ''}">${money(r.remaining, currency)}</td>
                    <td>
                      <span class="badge ${r.isPaid ? 'badge--ok' : r.paidThisMonth > 0 ? 'badge--warn' : ''}">
                        ${r.isPaid ? 'Ödənilib' : r.paidThisMonth > 0 ? 'Qismən' : 'Ödənilməyib'}
                      </span>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button class="iconbtn iconbtn--sm" type="button" title="Hesablaşma vərəqəsi" aria-label="Hesablaşma vərəqəsi" data-slip="${r.employee_id}">${icon('i-file', 14)}</button>
                        <button class="btn btn--ghost btn--sm" type="button" data-pay-row="${r.employee_id}">
                          ${icon('i-wallet', 13)} Ödə
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td>Cəmi</td>
                  <td class="num" data-label="Maaş">${money(totals.salary, currency)}</td>
                  <td class="num" data-label="Ödənilib">${money(totals.paid, currency)}</td>
                  <td class="num" data-label="Qalıq">${money(totals.remaining, currency)}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : emptyState({
          title: 'Aktiv işçi yoxdur',
          message: 'Əməkhaqqı cədvəli üçün əvvəlcə işçi əlavə edin.',
          iconName: 'i-users',
          action: `<button class="btn btn--primary" type="button" id="pr-add">${icon('i-plus', 15)} İşçi əlavə et</button>`
        })}
      </div>
    </section>

    <p class="tiny muted" style="margin-top:10px;line-height:1.6">
      «Toplu ödəniş» bütün qalıqları bir kliklə maaş ödənişi kimi qeyd edir.
    </p>
  `;

  root.querySelector('#pr-period')?.addEventListener('change', (e) => {
    period = e.target.value;
    renderPayroll(root, ctx);
  });

  root.querySelector('#pr-add')?.addEventListener('click', () => ctx.navigate('employees', { openNew: true }));

  root.querySelector('#pr-bulk')?.addEventListener('click', () => {
    openBulkPayModal({
      rows: rows.filter((r) => r.remaining > 0.5).map((r) => ({ employee_id: r.employee_id, full_name: r.full_name, amount: r.remaining })),
      currency,
      period,
      onSaved: refresh
    });
  });

  root.querySelectorAll('[data-pay-row]').forEach((b) => {
    b.addEventListener('click', () => {
      const emp = employees.find((x) => x.id === b.dataset.payRow);
      const row = rows.find((r) => r.employee_id === b.dataset.payRow);
      openPaymentForm({
        employees,
        payments,
        employee: emp,
        currency,
        onSaved: refresh
      });
      if (row && row.remaining > 0.5) {
        const amountInput = document.querySelector('#pay-amount');
        if (amountInput) amountInput.value = String(Math.round(row.remaining * 100) / 100);
      }
    });
  });

  root.querySelectorAll('[data-slip]').forEach((b) => {
    b.addEventListener('click', () => {
      const emp = employees.find((x) => x.id === b.dataset.slip);
      if (!emp) return;
      openPayslipModal({ employee: emp, payments, balances, currency, period, business });
    });
  });

  root.querySelector('#pr-export')?.addEventListener('click', () => {
    const out = [['İşçi', 'Vəzifə', 'Aylıq maaş', 'Ödənilib', 'Qalıq', 'Ümumi qalıq borc', 'Vəziyyət']];
    for (const r of rows) {
      out.push([
        r.full_name,
        r.position || '',
        r.salary,
        r.paidThisMonth,
        r.remaining,
        r.totalBalance,
        r.isPaid ? 'Ödənilib' : r.paidThisMonth > 0 ? 'Qismən' : 'Ödənilməyib'
      ]);
    }
    out.push([]);
    out.push(['Cəmi', '', totals.salary, totals.paid, totals.remaining, totals.balance, '']);
    downloadFile(`emekhaqqi-${period}.csv`, buildCsv(out), 'text/csv;charset=utf-8');
    toast('CSV yükləndi.', 'ok');
  });

  root.querySelector('#pr-print')?.addEventListener('click', () => window.print());
}
