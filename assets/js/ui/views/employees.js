import { icon, emptyState, escapeHtml, initialsOf, toast, copyText, debounce, downloadFile } from '../../lib/dom.js';
import {
  money, dateShort, dateLong, KIND_LABELS, METHOD_LABELS, LEAVE_LABELS,
  buildCsv, daysBetween, todayISO, pluralAz
} from '../../lib/format.js';
import {
  openEmployeeForm, confirmDeleteEmployee, openPaymentForm, openImportEmployeesModal
} from '../forms.js';
import { setEmployeeActive } from '../../lib/store.js';

let searchTerm = '';
let activeFilter = 'all';
let sortBy = 'name';

export default function renderEmployees(root, ctx) {
  if (ctx.state.params?.openNew) {
    const p = { ...ctx.state.params };
    delete p.openNew;
    ctx.state.params = p;
    setTimeout(() => openEmployeeForm({ businessId: ctx.business.id, currency: ctx.currency, onSaved: ctx.refresh }), 50);
  }
  renderList(root, ctx);
}

function renderList(root, ctx) {
  const { employees, balances, currency, business, payments, refresh, navigate } = ctx;

  const balanceOf = new Map((balances || []).map((b) => [b.id, b]));
  const q = searchTerm.toLowerCase();

  const filtered = employees
    .filter((e) => {
      if (activeFilter === 'active' && !e.is_active) return false;
      if (activeFilter === 'inactive' && e.is_active) return false;
      if (activeFilter === 'noaccount' && e.user_id) return false;
      if (activeFilter === 'debt' && Number(balanceOf.get(e.id)?.balance || 0) <= 0.5) return false;
      if (!q) return true;
      return [e.full_name, e.position, e.email, e.phone, e.access_code]
        .some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'balance') return Number(balanceOf.get(b.id)?.balance || 0) - Number(balanceOf.get(a.id)?.balance || 0);
      if (sortBy === 'salary') return Number(b.monthly_salary || 0) - Number(a.monthly_salary || 0);
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return String(a.full_name).localeCompare(String(b.full_name), 'az');
    });

  const totalSalary = filtered.filter((e) => e.is_active).reduce((s, e) => s + Number(e.monthly_salary || 0), 0);
  const totalDebt = filtered.reduce((s, e) => s + Math.max(0, Number(balanceOf.get(e.id)?.balance || 0)), 0);

  root.innerHTML = `
    <div class="toolbar">
      <div class="toolbar__search">
        ${icon('i-search', 15)}
        <input id="emp-search" type="search" placeholder="Ad, vəzifə, kod üzrə axtar" value="${escapeHtml(searchTerm)}" />
      </div>
      <select id="emp-filter" aria-label="Filtrləmə">
        <option value="all"${activeFilter === 'all' ? ' selected' : ''}>Hamısı (${employees.length})</option>
        <option value="active"${activeFilter === 'active' ? ' selected' : ''}>Aktiv</option>
        <option value="inactive"${activeFilter === 'inactive' ? ' selected' : ''}>Passiv</option>
        <option value="debt"${activeFilter === 'debt' ? ' selected' : ''}>Borcu olanlar</option>
        <option value="noaccount"${activeFilter === 'noaccount' ? ' selected' : ''}>Qoşulmayanlar</option>
      </select>
      <select id="emp-sort" aria-label="Sıralama">
        <option value="name"${sortBy === 'name' ? ' selected' : ''}>Ada görə</option>
        <option value="salary"${sortBy === 'salary' ? ' selected' : ''}>Maaşa görə</option>
        <option value="balance"${sortBy === 'balance' ? ' selected' : ''}>Borca görə</option>
      </select>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" id="emp-export">${icon('i-download', 13)} CSV</button>
      <button class="btn btn--ghost btn--sm" type="button" id="emp-import">${icon('i-upload', 13)} İçəri al</button>
      <button class="btn btn--primary btn--sm" type="button" id="emp-add">${icon('i-plus', 14)} Yeni işçi</button>
    </div>

    ${filtered.length ? `
      <section class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">${pluralAz(filtered.length, 'işçi', 'işçi')}</h2>
            <p class="card__sub">Aylıq fond ${money(totalSalary, currency)} · Qalıq borc ${money(totalDebt, currency)}</p>
          </div>
        </div>
        <div class="card__body card__body--flush">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>İşçi</th>
                  <th class="num">Maaş</th>
                  <th class="num">Ödənilib</th>
                  <th class="num">Qalıq</th>
                  <th>Kod</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((e) => {
                  const b = balanceOf.get(e.id) || {};
                  const balance = Number(b.balance || 0);
                  return `
                    <tr class="${e.is_active ? '' : 'is-inactive'}">
                      <td>
                        <div class="cell-name">
                          <span class="avatar avatar--sm" aria-hidden="true">${initialsOf(e.full_name)}</span>
                          <span>
                            <strong>${escapeHtml(e.full_name)}</strong>
                            <small>${escapeHtml(e.position || '—')}${e.is_active ? '' : ' · passiv'}</small>
                          </span>
                        </div>
                      </td>
                      <td class="num" data-label="Maaş">${money(e.monthly_salary, currency)}</td>
                      <td class="num" data-label="Ödənilib">${money(b.total_paid || 0, currency)}</td>
                      <td class="num" data-label="Qalıq" style="${balance > 0.5 ? 'color:var(--danger);font-weight:700' : 'color:var(--ink-3)'}">${money(balance, currency)}</td>
                      <td data-label="Kod">
                        <button class="badge ${e.user_id ? 'badge--ok' : 'badge--info'}" type="button"
                          data-copy-code="${escapeHtml(e.access_code || '')}" title="Kopyalamaq üçün klikləyin"
                          style="cursor:pointer;font-family:ui-monospace,monospace">
                          ${escapeHtml(e.access_code || '——')}
                        </button>
                      </td>
                      <td>
                        <div class="row-actions">
                          <button class="iconbtn iconbtn--sm" type="button" title="Ödəniş et" data-pay="${escapeHtml(e.id)}">${icon('i-wallet', 14)}</button>
                          <button class="iconbtn iconbtn--sm" type="button" title="Kartı aç" data-open="${escapeHtml(e.id)}">${icon('i-edit', 14)}</button>
                          <button class="iconbtn iconbtn--sm" type="button" title="Sil" data-del="${escapeHtml(e.id)}">${icon('i-trash', 14)}</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ` : emptyState({
      title: employees.length ? 'Nəticə tapılmadı' : 'Hələ işçi yoxdur',
      message: employees.length
        ? 'Axtarış sözünü dəyişin və ya filtri sıfırlayın.'
        : 'İlk işçinizi əlavə edin — sistem maaşı avtomatik hesablayacaq.',
      iconName: employees.length ? 'i-search' : 'i-users',
      action: employees.length
        ? '<button class="btn btn--ghost" type="button" id="emp-clear">Filtri sıfırla</button>'
        : `<button class="btn btn--primary" type="button" id="emp-add2">${icon('i-plus', 14)} İşçi əlavə et</button>`
    })}
  `;

  const addEmployee = () => openEmployeeForm({ businessId: business.id, currency, onSaved: refresh });

  root.querySelector('#emp-add')?.addEventListener('click', addEmployee);
  root.querySelector('#emp-add2')?.addEventListener('click', addEmployee);

  const searchInput = root.querySelector('#emp-search');
  const rerenderAndFocus = debounce(() => {
    searchTerm = searchInput.value;
    renderList(root, ctx);
    const el = root.querySelector('#emp-search');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, 220);
  searchInput?.addEventListener('input', rerenderAndFocus);

  root.querySelector('#emp-filter')?.addEventListener('change', (e) => {
    activeFilter = e.target.value;
    renderList(root, ctx);
  });

  root.querySelector('#emp-sort')?.addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderList(root, ctx);
  });

  root.querySelector('#emp-clear')?.addEventListener('click', () => {
    searchTerm = '';
    activeFilter = 'all';
    sortBy = 'name';
    renderList(root, ctx);
  });

  root.querySelector('#emp-export')?.addEventListener('click', () => {
    const rows = [['Ad Soyad', 'Vəzifə', 'Aylıq maaş', 'E-poçt', 'Telefon', 'İşə qəbul', 'Aktiv', 'Kod', 'Ödənilib', 'Qalıq']];
    for (const e of filtered) {
      const b = balanceOf.get(e.id) || {};
      rows.push([
        e.full_name, e.position || '', e.monthly_salary, e.email || '', e.phone || '',
        e.hire_date || '', e.is_active ? 'Bəli' : 'Xeyr', e.access_code || '',
        b.total_paid || 0, b.balance || 0
      ]);
    }
    downloadFile(`isci-siyahisi-${todayISO()}.csv`, buildCsv(rows), 'text/csv;charset=utf-8');
    toast('CSV faylı yükləndi.', 'ok');
  });

  root.querySelector('#emp-import')?.addEventListener('click', () => {
    openImportEmployeesModal({ businessId: business.id, currency, onSaved: refresh });
  });

  root.querySelectorAll('[data-copy-code]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.copyCode;
      if (!code) return;
      const ok = await copyText(code);
      toast(ok ? `Kod kopyalandı: ${code}` : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error', 3200);
    });
  });

  root.querySelectorAll('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emp = employees.find((x) => x.id === btn.dataset.pay);
      openPaymentForm({ employees, payments, employee: emp, currency, onSaved: refresh });
    });
  });

  root.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => navigate('employee-detail', { id: btn.dataset.open }));
  });

  root.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const emp = employees.find((x) => x.id === btn.dataset.del);
      if (!emp) return;
      await confirmDeleteEmployee(emp, refresh);
    });
  });
}

export function renderEmployeeDetail(root, ctx) {
  const { employees, balances, payments, worklogs, leaves, currency, business, refresh, navigate } = ctx;
  const id = ctx.state.params?.id;
  const emp = employees.find((e) => e.id === id);

  if (!emp) {
    root.innerHTML = emptyState({
      title: 'İşçi tapılmadı',
      message: 'Bu işçi silinib və ya başqa biznesə aiddir.',
      iconName: 'i-alert',
      action: '<button class="btn btn--primary" type="button" id="back-list">İşçilərə qayıt</button>'
    });
    root.querySelector('#back-list')?.addEventListener('click', () => navigate('employees'));
    return;
  }

  const b = balances.find((x) => x.id === emp.id) || {};
  const balance = Number(b.balance || 0);
  const empPayments = payments.filter((p) => p.employee_id === emp.id);
  const empLogs = worklogs.filter((w) => w.employee_id === emp.id).slice(0, 8);
  const empLeaves = leaves.filter((l) => l.employee_id === emp.id).slice(0, 5);
  const monthsWorked = Math.max(1, Math.round(daysBetween(emp.hire_date, todayISO()) / 30.44));

  root.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <button class="btn btn--ghost btn--sm" type="button" id="detail-back">${icon('i-arrow-left', 13)} İşçilər</button>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" type="button" id="detail-edit">${icon('i-edit', 13)} Redaktə</button>
      <button class="btn btn--primary btn--sm" type="button" id="detail-pay">${icon('i-wallet', 13)} Ödəniş et</button>
    </div>

    <div class="grid grid--main" style="margin-bottom:12px">
      <section class="card">
        <div class="card__body">
          <div class="row" style="gap:12px;align-items:flex-start;flex-wrap:nowrap">
            <span class="avatar avatar--lg" aria-hidden="true">${initialsOf(emp.full_name)}</span>
            <div style="flex:1 1 auto;min-width:0">
              <h2 style="font-size:16px;font-weight:700;letter-spacing:-.015em">${escapeHtml(emp.full_name)}</h2>
              <p class="tiny muted" style="margin-top:1px">${escapeHtml(emp.position || 'Vəzifə göstərilməyib')}</p>
              <div class="row" style="margin-top:7px;gap:5px">
                <span class="badge ${emp.is_active ? 'badge--ok' : ''}">${emp.is_active ? 'Aktiv' : 'Passiv'}</span>
                <span class="badge ${emp.user_id ? 'badge--ok' : 'badge--info'}">${emp.user_id ? 'Qoşulub' : 'Qoşulmayıb'}</span>
              </div>
            </div>
          </div>

          <dl class="kv" style="margin-top:16px">
            <div class="kv__row"><dt>Aylıq maaş</dt><dd>${money(emp.monthly_salary, currency)}</dd></div>
            <div class="kv__row"><dt>İşə qəbul</dt><dd>${dateLong(emp.hire_date)}</dd></div>
            <div class="kv__row"><dt>İş stajı</dt><dd>${monthsWorked} ay</dd></div>
            <div class="kv__row"><dt>E-poçt</dt><dd>${escapeHtml(emp.email || '—')}</dd></div>
            <div class="kv__row"><dt>Telefon</dt><dd>${escapeHtml(emp.phone || '—')}</dd></div>
            ${emp.notes ? `<div class="kv__row"><dt>Qeyd</dt><dd>${escapeHtml(emp.notes)}</dd></div>` : ''}
          </dl>

          <div class="codebox" style="margin-top:14px">
            <div style="flex:1 1 150px;min-width:0">
              <div class="tiny muted">Giriş kodu</div>
              <div class="codebox__code">${escapeHtml(emp.access_code || '——')}</div>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" id="detail-copy-code">${icon('i-copy', 13)} Kopyala</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Hesablaşma</h2>
            <p class="card__sub">Bütün dövr üzrə</p>
          </div>
        </div>
        <div class="card__body">
          <div class="grid" style="gap:9px">
            <div class="stat" style="border:0;background:var(--surface-2)">
              <div class="stat__top"><span class="stat__label">Hesablanmış maaş</span></div>
              <div class="stat__value stat__value--sm">${money(b.accrued_total || 0, currency)}</div>
              <div class="stat__hint">${b.months_count || 1} ay × ${money(emp.monthly_salary, currency)}</div>
            </div>

            <div class="stat" style="border:0;background:var(--surface-2)">
              <div class="stat__top"><span class="stat__label">Ödənilib</span></div>
              <div class="stat__value stat__value--sm">${money(b.total_paid || 0, currency)}</div>
              <div class="stat__hint">
                Avans ${money(b.total_advance || 0, currency)} · Maaş ${money(b.total_salary_paid || 0, currency)}
                ${Number(b.total_bonus || 0) ? ' · Mükafat ' + money(b.total_bonus, currency) : ''}
              </div>
            </div>

            <div class="stat ${balance > 0.5 ? 'stat--danger' : ''}" style="border:0;background:var(--surface-2)">
              <div class="stat__top"><span class="stat__label">Qalıq borc</span></div>
              <div class="stat__value stat__value--sm">${money(balance, currency)}</div>
              <div class="stat__hint">${balance > 0.5 ? 'Bu məbləğ ödənilməlidir' : 'Borç yoxdur'}</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Ödəniş tarixçəsi</h2>
            <p class="card__sub">${pluralAz(empPayments.length, 'qeyd', 'qeyd')}</p>
          </div>
        </div>
        <div class="card__body card__body--flush">
          ${empPayments.length ? `
            <div class="list">
              ${empPayments.slice(0, 10).map((p) => `
                <div class="list-row">
                  <span class="stat__icon ${p.kind === 'deduction' ? 'stat__icon--danger' : ''}" style="width:28px;height:28px">
                    ${icon(p.kind === 'deduction' ? 'i-minus' : 'i-wallet', 14)}
                  </span>
                  <div class="list-row__main">
                    <div class="list-row__title">${escapeHtml(KIND_LABELS[p.kind] || p.kind)}</div>
                    <div class="list-row__sub">
                      ${dateShort(p.paid_at)} · ${escapeHtml(METHOD_LABELS[p.method] || '—')}${p.note ? ' · ' + escapeHtml(p.note) : ''}
                    </div>
                  </div>
                  <div class="list-row__end"><div class="list-row__amount">${money(p.amount, currency)}</div></div>
                </div>
              `).join('')}
            </div>
          ` : emptyState({ title: 'Ödəniş yoxdur', message: 'Bu işçiyə hələ ödəniş qeydə alınmayıb.', iconName: 'i-wallet' })}
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Davamiyyət və məzuniyyət</h2>
            <p class="card__sub">Son qeydlər</p>
          </div>
        </div>
        <div class="card__body card__body--flush">
          ${(empLogs.length || empLeaves.length) ? `
            <div class="list">
              ${empLogs.slice(0, 5).map((w) => `
                <div class="list-row">
                  <span class="stat__icon" style="width:28px;height:28px">${icon('i-clock', 14)}</span>
                  <div class="list-row__main">
                    <div class="list-row__title">${Number(w.hours)} saat${Number(w.overtime) ? ` + ${Number(w.overtime)} əlavə` : ''}</div>
                    <div class="list-row__sub">${dateShort(w.work_date)}${w.note ? ' · ' + escapeHtml(w.note) : ''}</div>
                  </div>
                </div>
              `).join('')}
              ${empLeaves.map((l) => `
                <div class="list-row">
                  <span class="stat__icon stat__icon--warn" style="width:28px;height:28px">${icon('i-calendar', 14)}</span>
                  <div class="list-row__main">
                    <div class="list-row__title">${escapeHtml(LEAVE_LABELS[l.kind] || l.kind)}</div>
                    <div class="list-row__sub">${dateShort(l.start_date)} – ${dateShort(l.end_date)}</div>
                  </div>
                  <div class="list-row__end">
                    <span class="badge ${l.status === 'approved' ? 'badge--ok' : l.status === 'rejected' ? 'badge--danger' : 'badge--warn'}">
                      ${l.status === 'approved' ? 'Təsdiq' : l.status === 'rejected' ? 'Rədd' : 'Gözləyir'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : emptyState({ title: 'Qeyd yoxdur', message: 'Davamiyyət və məzuniyyət qeydləri burada görünəcək.', iconName: 'i-clock' })}
        </div>
      </section>
    </div>

    <div class="row" style="margin-top:14px">
      <button class="btn btn--ghost btn--sm" type="button" id="detail-toggle">${emp.is_active ? 'Passiv et' : 'Aktiv et'}</button>
      <button class="btn btn--danger-ghost btn--sm" type="button" id="detail-delete">${icon('i-trash', 13)} İşçini sil</button>
    </div>
  `;

  root.querySelector('#detail-back')?.addEventListener('click', () => navigate('employees'));

  root.querySelector('#detail-edit')?.addEventListener('click', () => {
    openEmployeeForm({ businessId: business.id, employee: emp, currency, onSaved: refresh });
  });

  root.querySelector('#detail-pay')?.addEventListener('click', () => {
    openPaymentForm({ employees, payments, employee: emp, currency, onSaved: refresh });
  });

  root.querySelector('#detail-copy-code')?.addEventListener('click', async () => {
    const ok = await copyText(emp.access_code || '');
    toast(ok ? `Kod kopyalandı: ${emp.access_code}` : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error', 3200);
  });

  root.querySelector('#detail-toggle')?.addEventListener('click', async () => {
    try {
      await setEmployeeActive(emp.id, !emp.is_active);
      toast(emp.is_active ? 'İşçi passiv edildi.' : 'İşçi aktiv edildi.', 'ok');
      await refresh();
    } catch (err) {
      toast(String(err?.message || 'Xəta'), 'error');
    }
  });

  root.querySelector('#detail-delete')?.addEventListener('click', async () => {
    const done = await confirmDeleteEmployee(emp, async () => {
      await refresh();
    });
    if (done) navigate('employees');
  });
}
