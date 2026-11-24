import {
  $, icon, openModal, closeModal, toast, setLoading, escapeHtml, isEmail, confirmDialog, copyText
} from '../lib/dom.js';
import {
  createEmployee, updateEmployee, deleteEmployee, regenerateEmployeeCode,
  createPayment, updatePayment, deletePayment, createPaymentsBulk,
  createBusiness, updateBusiness,
  upsertWorkLog, deleteWorkLog,
  createLeaveRequest, decideLeave, deleteLeave,
  createNote, updateNote, deleteNote,
  claimEmployeeByCode, logActivity, friendlyError
} from '../lib/store.js';
import {
  todayISO, money, KIND_LABELS, METHOD_LABELS, LEAVE_LABELS, CURRENCIES,
  dateShort, toNumber, dateInput, monthLabel, currentPeriod
} from '../lib/format.js';

function showErr(box, message) {
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

export function openBusinessForm({ business = null, onSaved }) {
  const isEdit = !!business;
  const b = business || {};

  openModal({
    title: isEdit ? 'Biznes məlumatları' : 'Yeni biznes',
    subtitle: isEdit ? 'Məlumatları yeniləyin' : 'Biznes profilinizi yaradın',
    body: `
      <form id="business-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="biz-name">Biznes adı</label>
          <div class="field__control">
            <input id="biz-name" type="text" placeholder="Məsələn: Mərkəz Kafe" value="${escapeHtml(b.name || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="biz-legal">Hüquqi ad</label>
          <div class="field__control">
            <input id="biz-legal" type="text" placeholder="MMC / Fərdi sahibkar" value="${escapeHtml(b.legal_name || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="biz-currency">Valyuta</label>
          <div class="field__control select-wrap">
            <select id="biz-currency">
              ${CURRENCIES.map((c) => `<option value="${c}"${(b.currency || 'AZN') === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="biz-payday">Maaş günü</label>
          <div class="field__control">
            <input id="biz-payday" type="number" min="1" max="28" step="1" value="${Number(b.pay_day || 5)}" />
          </div>
          <p class="field__hint">Ayın bu günü icmalda ödəniş xatırlatması göstərilir.</p>
        </div>
        <div class="field">
          <label for="biz-phone">Telefon</label>
          <div class="field__control">
            <input id="biz-phone" type="tel" placeholder="+994 12 000 00 00" value="${escapeHtml(b.phone || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="biz-email">E-poçt</label>
          <div class="field__control">
            <input id="biz-email" type="email" placeholder="info@biznes.az" value="${escapeHtml(b.email || '')}" />
          </div>
        </div>
        <div class="field span-2">
          <label for="biz-address">Ünvan</label>
          <div class="field__control">
            <input id="biz-address" type="text" placeholder="Bakı, Nizami küç. 203" value="${escapeHtml(b.address || '')}" />
          </div>
        </div>
        <p class="form-error span-2" id="business-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="business-save">${isEdit ? 'Yadda saxla' : 'Biznesi yarat'}</button>
    `,
    onMount: (modal) => {
      const errBox = $('#business-error', modal);
      const saveBtn = $('#business-save', modal);

      $('#business-form', modal).addEventListener('submit', (e) => {
        e.preventDefault();
        saveBtn.click();
      });

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const name = $('#biz-name', modal).value.trim();
        if (name.length < 2) return showErr(errBox, 'Biznes adını daxil edin.');

        const email = $('#biz-email', modal).value.trim();
        if (email && !isEmail(email)) return showErr(errBox, 'E-poçt ünvanı düzgün deyil.');

        const payload = {
          name,
          legal_name: $('#biz-legal', modal).value.trim(),
          currency: $('#biz-currency', modal).value,
          pay_day: $('#biz-payday', modal).value,
          phone: $('#biz-phone', modal).value.trim(),
          email,
          address: $('#biz-address', modal).value.trim()
        };

        setLoading(saveBtn, true);
        try {
          if (isEdit) {
            await updateBusiness(business.id, payload);
            toast('Biznes məlumatları yeniləndi.', 'ok');
          } else {
            const created = await createBusiness(payload);
            await logActivity(created.id, 'Biznes yaradıldı', created.name);
            toast('Biznes yaradıldı.', 'ok');
          }
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

export function openEmployeeForm({ businessId, employee = null, currency = 'AZN', onSaved }) {
  const isEdit = !!employee;
  const e = employee || {};

  openModal({
    title: isEdit ? 'İşçini redaktə et' : 'Yeni işçi',
    subtitle: isEdit ? 'Məlumatları yeniləyin' : 'İşçinin əsas məlumatları',
    body: `
      <form id="employee-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="emp-name">Ad və soyad</label>
          <div class="field__control">
            <input id="emp-name" type="text" placeholder="Nigar Əliyeva" value="${escapeHtml(e.full_name || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="emp-position">Vəzifə</label>
          <div class="field__control">
            <input id="emp-position" type="text" placeholder="Satış meneceri" value="${escapeHtml(e.position || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="emp-salary">Aylıq maaş (${escapeHtml(currency)})</label>
          <div class="field__control">
            <input id="emp-salary" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"
              value="${e.monthly_salary !== undefined && e.monthly_salary !== null ? Number(e.monthly_salary) : ''}" />
          </div>
        </div>
        <div class="field">
          <label for="emp-email">E-poçt</label>
          <div class="field__control">
            <input id="emp-email" type="email" placeholder="isci@biznes.az" value="${escapeHtml(e.email || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="emp-phone">Telefon</label>
          <div class="field__control">
            <input id="emp-phone" type="tel" placeholder="+994 50 000 00 00" value="${escapeHtml(e.phone || '')}" />
          </div>
        </div>
        <div class="field span-2">
          <label for="emp-hire">İşə qəbul tarixi</label>
          <div class="field__control">
            <input id="emp-hire" type="date" value="${escapeHtml(dateInput(e.hire_date) || todayISO())}" />
          </div>
        </div>
        <div class="field span-2">
          <label for="emp-notes">Qeyd</label>
          <div class="field__control field__control--area">
            <textarea id="emp-notes" placeholder="Əlavə qeydlər">${escapeHtml(e.notes || '')}</textarea>
          </div>
        </div>
        <div class="span-2">
          <label class="checkbox">
            <input type="checkbox" id="emp-active" ${e.is_active === false ? '' : 'checked'} />
            <span>Aktiv işçidir (hesablamaya daxil edilir)</span>
          </label>
        </div>

        ${isEdit ? `
          <div class="span-2">
            <div class="codebox">
              <div style="flex:1 1 150px;min-width:0">
                <div class="tiny muted">Giriş kodu</div>
                <div class="codebox__code" id="emp-code">${escapeHtml(e.access_code || '—')}</div>
              </div>
              <button class="btn btn--ghost btn--sm" type="button" id="emp-code-copy">${icon('i-copy', 13)} Kopyala</button>
              <button class="btn btn--ghost btn--sm" type="button" id="emp-code-new">${icon('i-refresh', 13)} Yenilə</button>
            </div>
            <p class="field__hint" style="margin-top:5px">
              Bu kodu işçiyə verin — qeydiyyatdan keçib kodu daxil edəndə kabineti açılır.
            </p>
          </div>
        ` : ''}

        <p class="form-error span-2" id="employee-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="employee-save">${isEdit ? 'Yadda saxla' : 'İşçi əlavə et'}</button>
    `,
    wide: isEdit,
    onMount: (modal) => {
      const saveBtn = $('#employee-save', modal);
      const errBox = $('#employee-error', modal);

      $('#employee-form', modal).addEventListener('submit', (ev) => {
        ev.preventDefault();
        saveBtn.click();
      });

      $('#emp-code-copy', modal)?.addEventListener('click', async () => {
        const code = $('#emp-code', modal).textContent.trim();
        if (!code || code === '—') return;
        const ok = await copyText(code);
        toast(ok ? 'Kod kopyalandı.' : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error');
      });

      $('#emp-code-new', modal)?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Yeni kod yaradılsın?',
          message: 'Köhnə kod işləməyəcək. İşçi artıq qoşulubsa, hesabı açıq qalır.',
          confirmText: 'Yeni kod'
        });
        if (!ok) return;
        try {
          const code = await regenerateEmployeeCode(employee.id);
          $('#emp-code', modal).textContent = code;
          toast('Yeni kod: ' + code, 'ok', 6000);
        } catch (err) {
          toast(friendlyError(err), 'error');
        }
      });

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;

        const fullName = $('#emp-name', modal).value.trim();
        const salaryRaw = $('#emp-salary', modal).value.trim();
        const email = $('#emp-email', modal).value.trim();

        if (fullName.length < 2) return showErr(errBox, 'İşçinin adını tam yazın.');
        if (salaryRaw === '') return showErr(errBox, 'Aylıq maaşı daxil edin.');
        if (toNumber(salaryRaw) < 0) return showErr(errBox, 'Maaş mənfi ola bilməz.');
        if (email && !isEmail(email)) return showErr(errBox, 'E-poçt ünvanı düzgün deyil.');
        if (!businessId) return showErr(errBox, 'Biznes tapılmadı.');

        const payload = {
          full_name: fullName,
          position: $('#emp-position', modal).value.trim(),
          monthly_salary: toNumber(salaryRaw),
          email,
          phone: $('#emp-phone', modal).value.trim(),
          hire_date: $('#emp-hire', modal).value || todayISO(),
          is_active: $('#emp-active', modal).checked,
          notes: $('#emp-notes', modal).value.trim()
        };

        setLoading(saveBtn, true);
        try {
          if (isEdit) {
            await updateEmployee(employee.id, payload);
            toast('İşçi məlumatları yeniləndi.', 'ok');
          } else {
            await createEmployee(businessId, payload);
            await logActivity(businessId, 'Yeni işçi əlavə edildi', fullName);
            toast('İşçi əlavə edildi.', 'ok');
          }
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

export function openPaymentForm({ employees, payments = [], employee = null, currency = 'AZN', presetKind = 'salary', onSaved }) {
  const list = (employees || []).filter((x) => x.is_active || (employee && x.id === employee.id));
  if (!list.length) {
    toast('Əvvəlcə işçi əlavə edin.', 'info');
    return;
  }

  const selectedId = employee?.id || list[0].id;

  openModal({
    title: 'Ödəniş qeyd et',
    subtitle: 'Avans, maaş, mükafat və ya tutulma',
    body: `
      <form id="payment-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="pay-employee">İşçi</label>
          <div class="field__control select-wrap">
            <select id="pay-employee">
              ${list.map((x) => `<option value="${x.id}"${x.id === selectedId ? ' selected' : ''}>${escapeHtml(x.full_name)}${x.position ? ' — ' + escapeHtml(x.position) : ''}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="pay-kind">Növ</label>
          <div class="field__control select-wrap">
            <select id="pay-kind">
              ${Object.keys(KIND_LABELS).map((k) => `<option value="${k}"${k === presetKind ? ' selected' : ''}>${KIND_LABELS[k]}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="pay-amount">Məbləğ (${escapeHtml(currency)})</label>
          <div class="field__control">
            <input id="pay-amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" />
          </div>
        </div>

        <div class="field">
          <label for="pay-date">Ödəniş tarixi</label>
          <div class="field__control">
            <input id="pay-date" type="date" value="${todayISO()}" />
          </div>
        </div>

        <div class="field">
          <label for="pay-method">Ödəniş üsulu</label>
          <div class="field__control select-wrap">
            <select id="pay-method">
              ${Object.keys(METHOD_LABELS).map((m) => `<option value="${m}"${m === 'cash' ? ' selected' : ''}>${METHOD_LABELS[m]}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field span-2">
          <label for="pay-note">Qeyd</label>
          <div class="field__control field__control--area">
            <textarea id="pay-note" placeholder="Məsələn: mart ayı üçün avans"></textarea>
          </div>
        </div>

        <div class="span-2" id="pay-preview"></div>
        <p class="form-error span-2" id="payment-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="payment-save">Qeyd et</button>
    `,
    onMount: (modal) => {
      const empSelect = $('#pay-employee', modal);
      const amountInput = $('#pay-amount', modal);
      const preview = $('#pay-preview', modal);
      const errBox = $('#payment-error', modal);
      const saveBtn = $('#payment-save', modal);

      const renderPreview = () => {
        const emp = list.find((x) => x.id === empSelect.value);
        if (!emp) return void (preview.innerHTML = '');
        const rows = payments.filter((p) => p.employee_id === emp.id && p.kind !== 'deduction');
        const paid = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
        preview.innerHTML = `
          <div class="banner">
            ${icon('i-info', 16)}
            <span>
              <strong>${escapeHtml(emp.full_name)}</strong>
              Aylıq maaş: ${money(emp.monthly_salary, currency)} · Qeydə alınan ödəniş: ${money(paid, currency)}
            </span>
          </div>
        `;
      };

      empSelect.addEventListener('change', renderPreview);
      renderPreview();

      $('#payment-form', modal).addEventListener('submit', (ev) => {
        ev.preventDefault();
        saveBtn.click();
      });

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const employeeId = empSelect.value;
        const amount = toNumber(amountInput.value);
        const kind = $('#pay-kind', modal).value;
        const paidAt = $('#pay-date', modal).value || todayISO();

        if (!employeeId) return showErr(errBox, 'İşçi seçin.');
        if (!amountInput.value.trim()) return showErr(errBox, 'Məbləği daxil edin.');
        if (amount <= 0) return showErr(errBox, 'Məbləğ sıfırdan böyük olmalıdır.');

        setLoading(saveBtn, true);
        try {
          await createPayment({
            employee_id: employeeId,
            kind,
            amount,
            paid_at: paidAt,
            period: paidAt.slice(0, 7),
            method: $('#pay-method', modal).value,
            note: $('#pay-note', modal).value.trim()
          });
          toast(`${KIND_LABELS[kind]} qeyd edildi.`, 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

export function openPaymentEdit({ payment, employees, currency = 'AZN', onSaved }) {
  openModal({
    title: 'Ödənişi redaktə et',
    subtitle: `${dateShort(payment.paid_at)} tarixli qeyd`,
    body: `
      <form id="payment-edit-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="pe-employee">İşçi</label>
          <div class="field__control select-wrap">
            <select id="pe-employee">
              ${(employees || []).map((x) => `<option value="${x.id}"${x.id === payment.employee_id ? ' selected' : ''}>${escapeHtml(x.full_name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="pe-kind">Növ</label>
          <div class="field__control select-wrap">
            <select id="pe-kind">
              ${Object.keys(KIND_LABELS).map((k) => `<option value="${k}"${k === payment.kind ? ' selected' : ''}>${KIND_LABELS[k]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="pe-amount">Məbləğ (${escapeHtml(currency)})</label>
          <div class="field__control">
            <input id="pe-amount" type="number" min="0.01" step="0.01" value="${Number(payment.amount)}" />
          </div>
        </div>
        <div class="field">
          <label for="pe-date">Tarix</label>
          <div class="field__control">
            <input id="pe-date" type="date" value="${escapeHtml(dateInput(payment.paid_at))}" />
          </div>
        </div>
        <div class="field">
          <label for="pe-method">Üsul</label>
          <div class="field__control select-wrap">
            <select id="pe-method">
              ${Object.keys(METHOD_LABELS).map((m) => `<option value="${m}"${m === payment.method ? ' selected' : ''}>${METHOD_LABELS[m]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field span-2">
          <label for="pe-note">Qeyd</label>
          <div class="field__control field__control--area">
            <textarea id="pe-note">${escapeHtml(payment.note || '')}</textarea>
          </div>
        </div>
        <p class="form-error span-2" id="payment-edit-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--danger-ghost btn--sm" type="button" id="pe-delete">${icon('i-trash', 13)} Sil</button>
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="pe-save">Yadda saxla</button>
    `,
    onMount: (modal) => {
      const errBox = $('#payment-edit-error', modal);
      const saveBtn = $('#pe-save', modal);

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const amount = toNumber($('#pe-amount', modal).value);
        if (amount <= 0) return showErr(errBox, 'Məbləğ sıfırdan böyük olmalıdır.');

        setLoading(saveBtn, true);
        try {
          const dateVal = $('#pe-date', modal).value || todayISO();
          await updatePayment(payment.id, {
            employee_id: $('#pe-employee', modal).value,
            kind: $('#pe-kind', modal).value,
            amount,
            paid_at: dateVal,
            period: dateVal.slice(0, 7),
            method: $('#pe-method', modal).value,
            note: $('#pe-note', modal).value.trim()
          });
          toast('Ödəniş yeniləndi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });

      $('#pe-delete', modal).addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Ödənişi sil',
          message: 'Bu ödəniş qeydi birdəfəlik silinəcək.',
          confirmText: 'Sil',
          danger: true
        });
        if (!ok) return;
        try {
          await deletePayment(payment.id);
          toast('Ödəniş silindi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          toast(friendlyError(err), 'error');
        }
      });
    }
  });
}

export async function confirmDeleteEmployee(employee, onDone) {
  const ok = await confirmDialog({
    title: 'İşçini sil',
    message: `${employee.full_name} və onun bütün ödəniş tarixçəsi silinəcək. Bu əməliyyat geri qaytarıla bilməz.`,
    confirmText: 'Sil',
    danger: true
  });
  if (!ok) return false;
  try {
    await deleteEmployee(employee.id);
    toast('İşçi silindi.', 'ok');
    if (typeof onDone === 'function') await onDone();
    return true;
  } catch (err) {
    toast(friendlyError(err), 'error');
    return false;
  }
}

export function openJoinCodeModal({ onDone }) {
  openModal({
    title: 'Kodla qoşul',
    subtitle: 'Sahibkarınızdan aldığınız kodu yazın',
    body: `
      <form id="join-form" novalidate>
        <div class="field">
          <label for="join-code">Giriş kodu</label>
          <div class="field__control">
            <input id="join-code" type="text" autocomplete="off" spellcheck="false"
              placeholder="Məsələn: K7M4P9QX" maxlength="12"
              style="text-transform:uppercase;letter-spacing:.12em;font-weight:600;font-size:16px" />
          </div>
          <p class="field__hint">Kod böyük hərf və rəqəmlərdən ibarətdir, boşluqların fərqi yoxdur.</p>
        </div>
        <p class="form-error" id="join-error" role="alert" hidden style="margin-top:12px"></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="join-submit">Qoşul</button>
    `,
    onMount: (modal) => {
      const input = $('#join-code', modal);
      const errBox = $('#join-error', modal);
      const submit = $('#join-submit', modal);

      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });

      const doJoin = async () => {
        errBox.hidden = true;
        const code = input.value.trim();
        if (code.length < 4) return showErr(errBox, 'Kodu tam yazın.');

        setLoading(submit, true);
        try {
          const res = await claimEmployeeByCode(code);
          toast(`${res?.business_name || 'Biznes'} — qoşuldunuz.`, 'ok', 4500);
          closeModal(true);
          if (typeof onDone === 'function') await onDone();
        } catch (err) {
          const msg = String(err?.message || '');
          if (/INVALID_CODE/.test(msg)) showErr(errBox, 'Kod tapılmadı. Yoxlayıb yenidən cəhd edin.');
          else if (/CODE_ALREADY_USED/.test(msg)) showErr(errBox, 'Bu kod artıq başqa hesaba bağlanıb. Sahibkarınızdan yeni kod istəyin.');
          else showErr(errBox, friendlyError(err));
        } finally {
          setLoading(submit, false);
        }
      };

      submit.addEventListener('click', doJoin);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doJoin();
        }
      });
    }
  });
}

export function openWorkLogForm({ employees, log = null, onSaved }) {
  const list = (employees || []).filter((x) => x.is_active);
  if (!list.length) {
    toast('Əvvəlcə işçi əlavə edin.', 'info');
    return;
  }
  const l = log || {};

  openModal({
    title: log ? 'Davamiyyəti redaktə et' : 'Davamiyyət qeyd et',
    subtitle: 'Gündəlik iş saatlarını yazın',
    body: `
      <form id="worklog-form" class="form-grid" novalidate>
        <div class="field span-2">
          <label for="wl-employee">İşçi</label>
          <div class="field__control select-wrap">
            <select id="wl-employee" ${log ? 'disabled' : ''}>
              ${list.map((x) => `<option value="${x.id}"${x.id === l.employee_id ? ' selected' : ''}>${escapeHtml(x.full_name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="wl-date">Tarix</label>
          <div class="field__control">
            <input id="wl-date" type="date" value="${escapeHtml(dateInput(l.work_date) || todayISO())}" />
          </div>
        </div>
        <div class="field">
          <label for="wl-hours">İş saatı</label>
          <div class="field__control">
            <input id="wl-hours" type="number" min="0" max="24" step="0.5" value="${l.hours !== undefined ? Number(l.hours) : 8}" />
          </div>
        </div>
        <div class="field">
          <label for="wl-overtime">Əlavə saat</label>
          <div class="field__control">
            <input id="wl-overtime" type="number" min="0" max="24" step="0.5" value="${l.overtime !== undefined ? Number(l.overtime) : 0}" />
          </div>
        </div>
        <div class="field span-2">
          <label for="wl-note">Qeyd</label>
          <div class="field__control field__control--area">
            <textarea id="wl-note" placeholder="Əlavə qeyd">${escapeHtml(l.note || '')}</textarea>
          </div>
        </div>
        <p class="form-error span-2" id="worklog-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      ${log ? `<button class="btn btn--danger-ghost btn--sm" type="button" id="wl-delete">${icon('i-trash', 13)} Sil</button>` : ''}
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="worklog-save">Yadda saxla</button>
    `,
    onMount: (modal) => {
      const errBox = $('#worklog-error', modal);
      const saveBtn = $('#worklog-save', modal);

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const employeeId = log ? log.employee_id : $('#wl-employee', modal).value;
        const workDate = $('#wl-date', modal).value || todayISO();
        const hours = toNumber($('#wl-hours', modal).value);
        const overtime = toNumber($('#wl-overtime', modal).value);

        if (!employeeId) return showErr(errBox, 'İşçi seçin.');
        if (hours > 24 || overtime > 24) return showErr(errBox, 'Saat 24-dən çox ola bilməz.');

        setLoading(saveBtn, true);
        try {
          await upsertWorkLog({
            employee_id: employeeId,
            work_date: workDate,
            hours,
            overtime,
            note: $('#wl-note', modal).value.trim()
          });
          toast('Davamiyyət qeyd edildi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });

      $('#wl-delete', modal)?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Qeydi sil',
          message: 'Bu davamiyyət qeydi silinəcək.',
          confirmText: 'Sil',
          danger: true
        });
        if (!ok) return;
        try {
          await deleteWorkLog(log.id);
          toast('Qeyd silindi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          toast(friendlyError(err), 'error');
        }
      });
    }
  });
}

export function openLeaveForm({ employeeId = null, employees = [], onSaved }) {
  const list = (employees || []).filter((x) => x.is_active);
  if (!employeeId && !list.length) {
    toast('Əvvəlcə işçi əlavə edin.', 'info');
    return;
  }

  openModal({
    title: 'Məzuniyyət istəyi',
    subtitle: 'Tarixləri seçin',
    body: `
      <form id="leave-form" class="form-grid" novalidate>
        ${employeeId ? '' : `
          <div class="field span-2">
            <label for="lv-employee">İşçi</label>
            <div class="field__control select-wrap">
              <select id="lv-employee">
                ${list.map((x) => `<option value="${x.id}">${escapeHtml(x.full_name)}</option>`).join('')}
              </select>
            </div>
          </div>
        `}
        <div class="field span-2">
          <label for="lv-kind">Növ</label>
          <div class="field__control select-wrap">
            <select id="lv-kind">
              ${Object.keys(LEAVE_LABELS).map((k) => `<option value="${k}">${LEAVE_LABELS[k]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="lv-start">Başlama</label>
          <div class="field__control">
            <input id="lv-start" type="date" value="${todayISO()}" />
          </div>
        </div>
        <div class="field">
          <label for="lv-end">Bitmə</label>
          <div class="field__control">
            <input id="lv-end" type="date" value="${todayISO()}" />
          </div>
        </div>
        <div class="field span-2">
          <label for="lv-reason">Səbəb</label>
          <div class="field__control field__control--area">
            <textarea id="lv-reason" placeholder="Qısa izah"></textarea>
          </div>
        </div>
        <p class="form-error span-2" id="leave-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="leave-save">Göndər</button>
    `,
    onMount: (modal) => {
      const errBox = $('#leave-error', modal);
      const saveBtn = $('#leave-save', modal);

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const empId = employeeId || $('#lv-employee', modal)?.value;
        const start = $('#lv-start', modal).value;
        const end = $('#lv-end', modal).value;

        if (!empId) return showErr(errBox, 'İşçi seçin.');
        if (!start || !end) return showErr(errBox, 'Tarixləri seçin.');
        if (end < start) return showErr(errBox, 'Bitmə tarixi başlamadan əvvəl ola bilməz.');

        setLoading(saveBtn, true);
        try {
          await createLeaveRequest({
            employee_id: empId,
            kind: $('#lv-kind', modal).value,
            start_date: start,
            end_date: end,
            reason: $('#lv-reason', modal).value.trim()
          });
          toast('İstək göndərildi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

export async function confirmDecideLeave(leave, status, onDone) {
  const ok = await confirmDialog({
    title: status === 'approved' ? 'Təsdiqlə' : 'Rədd et',
    message: status === 'approved' ? 'Bu istəyi təsdiqləyirsiniz?' : 'Bu istəyi rədd edirsiniz?',
    confirmText: status === 'approved' ? 'Təsdiqlə' : 'Rədd et',
    danger: status === 'rejected'
  });
  if (!ok) return;
  try {
    await decideLeave(leave.id, status);
    toast('Qərar yadda saxlanıldı.', 'ok');
    if (typeof onDone === 'function') await onDone();
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
}

export async function confirmDeleteLeave(leave, onDone) {
  const ok = await confirmDialog({
    title: 'İstəyi sil',
    message: 'Bu məzuniyyət istəyi silinəcək.',
    confirmText: 'Sil',
    danger: true
  });
  if (!ok) return;
  try {
    await deleteLeave(leave.id);
    toast('İstək silindi.', 'ok');
    if (typeof onDone === 'function') await onDone();
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
}

export function openNoteForm({ businessId, note = null, onSaved }) {
  const n = note || {};

  openModal({
    title: note ? 'Qeydi redaktə et' : 'Yeni qeyd',
    subtitle: 'Tapşırıq və ya xatırlatma',
    body: `
      <form id="note-form" style="display:grid;gap:13px" novalidate>
        <div class="field">
          <label for="note-title">Başlıq</label>
          <div class="field__control">
            <input id="note-title" type="text" placeholder="Məsələn: Yeni işçi üçün müqavilə" value="${escapeHtml(n.title || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="note-body">Qeyd</label>
          <div class="field__control field__control--area">
            <textarea id="note-body" placeholder="Ətraflı qeyd">${escapeHtml(n.body || '')}</textarea>
          </div>
        </div>
        <div class="field">
          <label for="note-due">Son tarix</label>
          <div class="field__control">
            <input id="note-due" type="date" value="${escapeHtml(dateInput(n.due_date))}" />
          </div>
        </div>
        <p class="form-error" id="note-error" role="alert" hidden></p>
      </form>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="note-save">Yadda saxla</button>
    `,
    onMount: (modal) => {
      const errBox = $('#note-error', modal);
      const saveBtn = $('#note-save', modal);

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const title = $('#note-title', modal).value.trim();
        if (title.length < 2) return showErr(errBox, 'Başlıq yazın.');

        const payload = {
          title,
          body: $('#note-body', modal).value.trim(),
          due_date: $('#note-due', modal).value || null
        };

        setLoading(saveBtn, true);
        try {
          if (note) await updateNote(note.id, payload);
          else await createNote(businessId, payload);
          toast(note ? 'Qeyd yeniləndi.' : 'Qeyd əlavə edildi.', 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

export async function confirmDeleteNote(note, onDone) {
  const ok = await confirmDialog({
    title: 'Qeydi sil',
    message: 'Bu qeyd silinəcək.',
    confirmText: 'Sil',
    danger: true
  });
  if (!ok) return;
  try {
    await deleteNote(note.id);
    toast('Qeyd silindi.', 'ok');
    if (typeof onDone === 'function') await onDone();
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
}

export function openImportEmployeesModal({ businessId, currency = 'AZN', onSaved }) {
  const example = 'Ad Soyad;Vəzifə;Maaş;E-poçt;Telefon\nNigar Əliyeva;Satış;800;nigar@mail.az;+994501112233';

  openModal({
    title: 'İşçiləri CSV ilə əlavə et',
    subtitle: 'Excel-dən kopyalayıb yapışdırın',
    body: `
      <div class="banner" style="margin-bottom:12px">
        ${icon('i-info', 16)}
        <span>
          <strong>Format</strong>
          Hər sətir bir işçi: <code>Ad Soyad;Vəzifə;Maaş;E-poçt;Telefon</code>
        </span>
      </div>
      <div class="field">
        <label for="imp-text">Məlumatlar</label>
        <div class="field__control field__control--area">
          <textarea id="imp-text" style="min-height:150px;font-family:ui-monospace,monospace;font-size:12px"
            placeholder="${escapeHtml(example)}"></textarea>
        </div>
      </div>
      <p class="form-error" id="imp-error" role="alert" hidden style="margin-top:12px"></p>
      <div id="imp-result" style="margin-top:12px"></div>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" id="imp-example">Nümunə</button>
      <button class="btn btn--ghost" type="button" data-modal-close>Bağla</button>
      <button class="btn btn--primary" type="button" id="imp-save">Əlavə et</button>
    `,
    onMount: (modal) => {
      const errBox = $('#imp-error', modal);
      const saveBtn = $('#imp-save', modal);
      const resultBox = $('#imp-result', modal);
      const ta = $('#imp-text', modal);

      $('#imp-example', modal).addEventListener('click', () => {
        ta.value = example;
        ta.focus();
      });

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const raw = ta.value.trim();
        if (!raw) return showErr(errBox, 'Məlumat boşdur.');

        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const cells = lines.map((l) => l.split(delimiter).map((c) => c.trim()));

        let startIdx = 0;
        if (cells.length && /ad|name/i.test(cells[0][0]) && /vəzifə|vezife|position/i.test(cells[0][1] || '')) startIdx = 1;

        const rows = [];
        const errors = [];
        for (let i = startIdx; i < cells.length; i++) {
          const c = cells[i];
          const name = (c[0] || '').trim();
          if (name.length < 2) {
            errors.push(`${i + 1}-ci sətir: ad yoxdur`);
            continue;
          }
          const email = (c[3] || '').trim();
          if (email && !isEmail(email)) {
            errors.push(`${i + 1}-ci sətir: e-poçt səhvdir`);
            continue;
          }
          rows.push({
            full_name: name,
            position: (c[1] || '').trim(),
            monthly_salary: toNumber((c[2] || '0').replace(/\s/g, '')),
            email,
            phone: (c[4] || '').trim(),
            is_active: true
          });
        }

        if (!rows.length) return showErr(errBox, 'Düzgün sətir tapılmadı.');

        setLoading(saveBtn, true);
        let ok = 0;
        const failed = [];
        for (const row of rows) {
          try {
            await createEmployee(businessId, row);
            ok += 1;
          } catch (err) {
            failed.push(`${row.full_name}: ${friendlyError(err)}`);
          }
        }
        setLoading(saveBtn, false);

        resultBox.innerHTML = `
          <div class="banner ${ok ? 'banner--ok' : 'banner--danger'}">
            ${icon(ok ? 'i-check-circle' : 'i-alert', 16)}
            <span><strong>${ok} işçi əlavə edildi</strong>${failed.length ? failed.length + ' sətir alınmadı.' : 'Hamısı uğurla yazıldı.'}</span>
          </div>
          ${errors.length ? `<p class="tiny muted" style="margin-top:7px">${escapeHtml(errors.slice(0, 4).join(' · '))}</p>` : ''}
          ${failed.length ? `<p class="tiny" style="margin-top:7px;color:var(--danger)">${escapeHtml(failed.slice(0, 4).join(' · '))}</p>` : ''}
        `;

        if (ok > 0) {
          await logActivity(businessId, 'CSV ilə işçi əlavə edildi', `${ok} işçi`);
          toast(`${ok} işçi əlavə edildi.`, 'ok');
          if (typeof onSaved === 'function') await onSaved();
        }
      });
    }
  });
}

export function openBulkPayModal({ rows, currency = 'AZN', period = currentPeriod(), onSaved }) {
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const payable = rows.filter((r) => Number(r.amount || 0) > 0);

  if (!payable.length) {
    toast('Ödəniləcək məbləğ yoxdur.', 'info');
    return;
  }

  openModal({
    title: 'Aylıq maaşları ödə',
    subtitle: `${monthLabel(period)} · ${payable.length} işçi`,
    body: `
      <div class="banner" style="margin-bottom:14px">
        ${icon('i-info', 16)}
        <span>
          <strong>Cəmi ${money(total, currency)}</strong>
          Hər işçi üçün «maaş» növündə ödəniş qeydi yaradılacaq.
        </span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>İşçi</th><th class="num">Məbləğ</th></tr></thead>
          <tbody>
            ${payable.map((r) => `
              <tr>
                <td>${escapeHtml(r.full_name)}</td>
                <td class="num">${money(r.amount, currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="field" style="margin-top:14px">
        <label for="bulk-date">Ödəniş tarixi</label>
        <div class="field__control">
          <input id="bulk-date" type="date" value="${todayISO()}" />
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <label for="bulk-method">Ödəniş üsulu</label>
        <div class="field__control select-wrap">
          <select id="bulk-method">
            ${Object.keys(METHOD_LABELS).map((m) => `<option value="${m}"${m === 'cash' ? ' selected' : ''}>${METHOD_LABELS[m]}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="form-error" id="bulk-error" role="alert" hidden style="margin-top:12px"></p>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Ləğv et</button>
      <button class="btn btn--primary" type="button" id="bulk-save">Ödənişləri qeyd et</button>
    `,
    onMount: (modal) => {
      const errBox = $('#bulk-error', modal);
      const saveBtn = $('#bulk-save', modal);

      saveBtn.addEventListener('click', async () => {
        errBox.hidden = true;
        const paidAt = $('#bulk-date', modal).value || todayISO();
        const method = $('#bulk-method', modal).value;

        setLoading(saveBtn, true);
        try {
          await createPaymentsBulk(
            payable.map((r) => ({
              employee_id: r.employee_id,
              kind: 'salary',
              amount: r.amount,
              paid_at: paidAt,
              period,
              method,
              note: `${monthLabel(period)} maaşı`
            }))
          );
          toast(`${payable.length} işçiyə maaş ödənişi qeyd edildi.`, 'ok');
          closeModal(true);
          if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
          showErr(errBox, friendlyError(err));
        } finally {
          setLoading(saveBtn, false);
        }
      });
    }
  });
}

/**
 * Hesablaşma vərəqəsi (расчетный листок) — işçi üzrə aylıq detallı çap forması.
 * Excel/1C-dəki «расчетный листок» məntiqinin sadələşdirilmiş variantı.
 */
export function openPayslipModal({ employee, payments = [], balances = [], currency = 'AZN', period, business = null }) {
  const rows = (payments || []).filter(
    (p) => p.employee_id === employee.id && (p.period || String(p.paid_at || '').slice(0, 7)) === period
  );

  const balance = (balances || []).find((b) => b.id === employee.id) || {};
  const salary = Number(employee.monthly_salary || 0);

  const sum = (kind) => rows.filter((p) => p.kind === kind).reduce((s, p) => s + Number(p.amount || 0), 0);
  const advance = sum('advance');
  const salaryPaid = sum('salary');
  const bonus = sum('bonus');
  const deduction = sum('deduction');
  const netPaid = advance + salaryPaid + bonus - deduction;
  const remaining = Math.max(0, salary - (advance + salaryPaid + bonus));

  const periodLabel = monthLabel(period);

  openModal({
    title: 'Hesablaşma vərəqəsi',
    subtitle: `${employee.full_name || 'İşçi'} · ${periodLabel}`,
    wide: true,
    body: `
      <div class="payslip" id="payslip-print">
        <div class="payslip__head">
          <div>
            <h2 class="payslip__title">${escapeHtml(business?.name || 'Biznes')}</h2>
            <p class="payslip__meta">${escapeHtml(business?.legal_name || '')}${business?.address ? ' · ' + escapeHtml(business.address) : ''}</p>
          </div>
          <div style="text-align:right">
            <div class="badge badge--ok">Hesablaşma vərəqəsi</div>
            <p class="payslip__meta">${escapeHtml(periodLabel)}</p>
          </div>
        </div>

        <dl class="kv" style="margin-top:14px">
          <div class="kv__row"><dt>İşçi</dt><dd>${escapeHtml(employee.full_name || '—')}</dd></div>
          <div class="kv__row"><dt>Vəzifə</dt><dd>${escapeHtml(employee.position || '—')}</dd></div>
          <div class="kv__row"><dt>İşə qəbul</dt><dd>${dateShort(employee.hire_date)}</dd></div>
          <div class="kv__row"><dt>Aylıq maaş</dt><dd>${money(salary, currency)}</dd></div>
        </dl>

        <h3 style="font-size:12.5px;font-weight:700;margin:16px 0 7px">Hesablanmalar və ödənişlər</h3>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Tarix</th><th>Növ</th><th>Üsul</th><th>Qeyd</th><th class="num">Məbləğ</th></tr>
            </thead>
            <tbody>
              ${rows.length
                ? rows
                    .map(
                      (p) => `
                    <tr>
                      <td class="nowrap" data-label="Tarix">${dateShort(p.paid_at)}</td>
                      <td data-label="Növ">${escapeHtml(KIND_LABELS[p.kind] || p.kind)}</td>
                      <td data-label="Üsul">${escapeHtml(METHOD_LABELS[p.method] || '—')}</td>
                      <td data-label="Qeyd">${escapeHtml(p.note || '—')}</td>
                      <td class="num" data-label="Məbləğ" style="${p.kind === 'deduction' ? 'color:var(--danger)' : ''}">
                        ${p.kind === 'deduction' ? '−' : ''}${money(p.amount, currency)}
                      </td>
                    </tr>
                  `
                    )
                    .join('')
                : '<tr><td colspan="5" style="text-align:center;padding:18px">Bu ay üzrə ödəniş qeydə alınmayıb.</td></tr>'}
            </tbody>
            <tfoot>
              <tr><td colspan="4">Avans</td><td class="num">${money(advance, currency)}</td></tr>
              <tr><td colspan="4">Maaş ödənişi</td><td class="num">${money(salaryPaid, currency)}</td></tr>
              <tr><td colspan="4">Mükafat</td><td class="num">${money(bonus, currency)}</td></tr>
              <tr><td colspan="4">Tutulma</td><td class="num" style="color:var(--danger)">−${money(deduction, currency)}</td></tr>
              <tr><td colspan="4">Cəmi ödənilib</td><td class="num">${money(netPaid, currency)}</td></tr>
              <tr><td colspan="4">Bu ay qalıq</td><td class="num" style="${remaining > 0.5 ? 'color:var(--danger)' : ''}">${money(remaining, currency)}</td></tr>
            </tfoot>
          </table>
        </div>

        <div class="banner" style="margin-top:14px">
          ${icon('i-info', 16)}
          <span>
            <strong>Ümumi qalıq borc: ${money(Math.max(0, Number(balance.balance || 0)), currency)}</strong>
            Hesablanmış ${money(Number(balance.accrued_total || 0), currency)} · Ödənilmiş ${money(Number(balance.total_paid || 0), currency)}
          </span>
        </div>

        <p class="tiny muted" style="margin-top:14px;line-height:1.6">
          Sənəd ${dateShort(todayISO())} tarixində RahatHesab tərəfindən yaradılıb.
        </p>
      </div>
    `,
    footer: `
      <button class="btn btn--ghost" type="button" data-modal-close>Bağla</button>
      <button class="btn btn--ghost btn--sm" type="button" id="payslip-copy">${icon('i-copy', 13)} Kopyala</button>
      <button class="btn btn--primary" type="button" id="payslip-print-btn">${icon('i-print', 14)} Çap et</button>
    `,
    onMount: (modal) => {
      modal.querySelector('#payslip-print-btn')?.addEventListener('click', () => window.print());

      modal.querySelector('#payslip-copy')?.addEventListener('click', async () => {
        const lines = [
          `${business?.name || 'Biznes'} — hesablaşma vərəqəsi (${periodLabel})`,
          `İşçi: ${employee.full_name}`,
          `Vəzifə: ${employee.position || '—'}`,
          `Aylıq maaş: ${salary.toFixed(2)}`,
          '',
          'Tarix\tNöv\tÜsul\tMəbləğ'
        ];
        for (const p of rows) {
          lines.push(`${p.paid_at}\t${KIND_LABELS[p.kind] || p.kind}\t${METHOD_LABELS[p.method] || ''}\t${Number(p.amount).toFixed(2)}`);
        }
        lines.push('', `Cəmi ödənilib: ${netPaid.toFixed(2)}`, `Bu ay qalıq: ${remaining.toFixed(2)}`);
        const ok = await copyText(lines.join('\n'));
        toast(ok ? 'Vərəqə kopyalandı — Excel-ə yapışdıra bilərsiniz.' : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error', 3600);
      });
    }
  });
}
