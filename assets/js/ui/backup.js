import { downloadFile, toast } from '../lib/dom.js';
import { todayISO } from '../lib/format.js';

export function exportBackup(ctx) {
  const { business, employees, payments, worklogs, leaves, notes, currency } = ctx;

  const payload = {
    app: 'RahatHesab',
    version: 1,
    exported_at: new Date().toISOString(),
    business: {
      id: business?.id,
      name: business?.name,
      legal_name: business?.legal_name || null,
      currency: currency || 'AZN',
      pay_day: business?.pay_day ?? null
    },
    employees: (employees || []).map((e) => ({
      id: e.id,
      full_name: e.full_name,
      position: e.position || null,
      monthly_salary: Number(e.monthly_salary || 0),
      email: e.email || null,
      phone: e.phone || null,
      hire_date: e.hire_date || null,
      is_active: !!e.is_active,
      notes: e.notes || null
    })),
    payments: (payments || []).map((p) => ({
      employee: p.employees?.full_name || null,
      kind: p.kind,
      amount: Number(p.amount || 0),
      paid_at: p.paid_at,
      period: p.period || null,
      method: p.method || null,
      note: p.note || null
    })),
    work_logs: (worklogs || []).map((w) => ({
      employee: w.employees?.full_name || null,
      work_date: w.work_date,
      hours: Number(w.hours || 0),
      overtime: Number(w.overtime || 0),
      note: w.note || null
    })),
    leave_requests: (leaves || []).map((l) => ({
      employee: l.employees?.full_name || null,
      kind: l.kind,
      start_date: l.start_date,
      end_date: l.end_date,
      status: l.status,
      reason: l.reason || null
    })),
    notes: (notes || []).map((n) => ({
      title: n.title,
      body: n.body || null,
      is_done: !!n.is_done,
      due_date: n.due_date || null
    }))
  };

  const safeName = String(business?.name || 'biznes')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'biznes';

  downloadFile(`rahathesab-${safeName}-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('Ehtiyat nüsxə yükləndi.', 'ok');
}

