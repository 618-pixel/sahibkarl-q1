import { todayISO, currentPeriod, dateShort, monthLabel, money, daysBetween } from './format.js';

const READ_KEY = (businessId) => `rahathesab.notifread.v1.${businessId || 'none'}`;

function safeParse(raw, fallback) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getReadMap(businessId) {
  try {
    return safeParse(localStorage.getItem(READ_KEY(businessId)) || '{}', {});
  } catch {
    return {};
  }
}

function saveReadMap(businessId, map) {
  try {
    const keys = Object.keys(map);
    if (keys.length > 300) {
      const trimmed = {};
      keys.slice(-300).forEach((k) => {
        trimmed[k] = map[k];
      });
      localStorage.setItem(READ_KEY(businessId), JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(READ_KEY(businessId), JSON.stringify(map));
  } catch {
    /* yaddaş bağlıdır */
  }
}

export function markRead(businessId, id, isRead = true) {
  const map = getReadMap(businessId);
  if (isRead) map[id] = new Date().toISOString();
  else delete map[id];
  saveReadMap(businessId, map);
  return map;
}

export function markAllRead(businessId, items) {
  const map = getReadMap(businessId);
  const now = new Date().toISOString();
  for (const item of items || []) map[item.id] = now;
  saveReadMap(businessId, map);
  return map;
}

export function clearRead(businessId) {
  const map = getReadMap(businessId);
  saveReadMap(businessId, {});
  return map;
}

export function unreadCount(items, readMap) {
  return (items || []).reduce((sum, item) => (readMap && readMap[item.id] ? sum : sum + 1), 0);
}

const TONE_RANK = { danger: 0, warn: 1, info: 2, ok: 3 };

function alert(item) {
  return { kind: 'alert', at: null, ...item };
}

function event(item) {
  return { kind: 'event', tone: 'info', ...item };
}

function sumBy(rows, pick) {
  return (rows || []).reduce((acc, row) => acc + pick(row), 0);
}

export function buildNotifications({
  role,
  business,
  employees = [],
  balances = [],
  payments = [],
  worklogs = [],
  leaves = [],
  notes = [],
  activity = [],
  currency = 'AZN',
  employee = null
} = {}) {
  const today = todayISO();
  const thisMonth = currentPeriod();
  const items = [];

  if (role === 'owner') {
    const active = (employees || []).filter((e) => e.is_active);
    const balanceOf = new Map((balances || []).map((b) => [b.id, b]));

    const pendingLeaves = (leaves || []).filter((l) => l.status === 'pending');
    for (const l of pendingLeaves) {
      items.push(
        alert({
          id: `leave:${l.id}`,
          tone: 'warn',
          icon: 'i-calendar',
          title: 'Məzuniyyət istəyi cavab gözləyir',
          text: `${l.employees?.full_name || 'İşçi'} · ${dateShort(l.start_date)} – ${dateShort(l.end_date)} · ${daysBetween(l.start_date, l.end_date)} gün`,
          view: 'leaves',
          action: 'Qərar ver'
        })
      );
    }

    const openNotes = (notes || []).filter((n) => !n.is_done);
    for (const n of openNotes) {
      if (!n.due_date) continue;
      if (n.due_date < today) {
        items.push(
          alert({
            id: `note:${n.id}:late`,
            tone: 'danger',
            icon: 'i-alert',
            title: 'Qeydin vaxtı keçib',
            text: `${n.title} · son tarix ${dateShort(n.due_date)}`,
            view: 'notes',
            action: 'Aç'
          })
        );
      } else if (n.due_date === today) {
        items.push(
          alert({
            id: `note:${n.id}:today`,
            tone: 'info',
            icon: 'i-note',
            title: 'Bu gün son tarixli qeyd var',
            text: n.title,
            view: 'notes',
            action: 'Aç'
          })
        );
      }
    }

    const notJoined = active.filter((e) => !e.user_id);
    if (notJoined.length) {
      items.push(
        alert({
          id: 'employees:not-joined',
          tone: 'info',
          icon: 'i-key',
          title: `${notJoined.length} işçi hələ kabinetə qoşulmayıb`,
          text: 'Giriş kodunu işçiyə verin — öz maaşını və qalığını görə bilsin.',
          view: 'employees',
          action: 'Kodlar'
        })
      );
    }

    const noSalary = active.filter((e) => Number(e.monthly_salary || 0) <= 0);
    if (noSalary.length) {
      items.push(
        alert({
          id: 'employees:no-salary',
          tone: 'warn',
          icon: 'i-alert',
          title: `${noSalary.length} işçinin aylıq maaşı 0-dır`,
          text: 'Maaş yazılmayanda hesablaşma və qalıq səhv görünür.',
          view: 'employees',
          action: 'Düzəlt'
        })
      );
    }

    const unpaidRows = active
      .map((e) => {
        const b = balanceOf.get(e.id) || {};
        const salary = Number(e.monthly_salary || 0);
        const paid = Number(b.paid_this_month || 0);
        return { e, salary, paid, remaining: Math.max(0, salary - paid) };
      })
      .filter((r) => r.salary > 0 && r.remaining > 0.5);

    if (unpaidRows.length) {
      const remaining = sumBy(unpaidRows, (r) => r.remaining);
      items.push(
        alert({
          id: `month:${thisMonth}:unpaid`,
          tone: 'warn',
          icon: 'i-banknote',
          title: `${monthLabel(thisMonth)} üzrə ${unpaidRows.length} işçinin maaşı tam ödənilməyib`,
          text: `Qalıq: ${money(remaining, currency)}`,
          view: 'payroll',
          action: 'Cədvəl'
        })
      );
    }

    const debtors = active.filter((e) => Number(balanceOf.get(e.id)?.balance || 0) > 0.5);
    if (debtors.length) {
      const debt = sumBy(debtors, (e) => Number(balanceOf.get(e.id)?.balance || 0));
      items.push(
        alert({
          id: 'balances:debt',
          tone: 'info',
          icon: 'i-receipt',
          title: `${debtors.length} işçiyə ümumi borc ${money(debt, currency)}`,
          text: 'Qalıq borclar icmal səhifəsində göstərilir.',
          view: 'dashboard',
          action: 'İcmal'
        })
      );
    }

    const payDay = Number(business?.pay_day || 5);
    const dayOfMonth = new Date().getDate();
    const daysToPay = payDay >= dayOfMonth ? payDay - dayOfMonth : payDay + 30 - dayOfMonth;
    if (daysToPay <= 3 && unpaidRows.length) {
      items.push(
        alert({
          id: `payday:${thisMonth}`,
          tone: 'warn',
          icon: 'i-clock',
          title: daysToPay === 0 ? 'Bu gün maaş günüdür' : `Maaş gününə ${daysToPay} gün qalıb`,
          text: `Ödənilməli qalıq: ${money(sumBy(unpaidRows, (r) => r.remaining), currency)}`,
          view: 'payroll',
          action: 'Ödə'
        })
      );
    }

    const todayHours = (worklogs || []).filter((w) => w.work_date === today).length;
    if (active.length && !todayHours) {
      items.push(
        alert({
          id: `worklog:${today}`,
          tone: 'info',
          icon: 'i-clock',
          title: 'Bu gün üçün davamiyyət qeyd olunmayıb',
          text: 'İşçilərin saatlarını qeyd edin — hesabat dəqiq olsun.',
          view: 'worklog',
          action: 'Qeyd et'
        })
      );
    }

    if (!active.length) {
      items.push(
        alert({
          id: 'business:no-employees',
          tone: 'info',
          icon: 'i-users',
          title: 'Hələ işçi yoxdur',
          text: 'İlk işçini əlavə edin — maaş hesablaması avtomatik başlayacaq.',
          view: 'employees',
          action: 'İşçi əlavə et'
        })
      );
    }
  } else if (role === 'employee') {
    const me = (balances || []).find((b) => b.id === employee?.id) || {};

    for (const l of leaves || []) {
      if (l.status === 'approved' || l.status === 'rejected') {
        items.push(
          event({
            id: `leave:${l.id}:${l.status}`,
            tone: l.status === 'approved' ? 'ok' : 'danger',
            icon: l.status === 'approved' ? 'i-check-circle' : 'i-minus',
            title: l.status === 'approved' ? 'Məzuniyyət istəyiniz təsdiqləndi' : 'Məzuniyyət istəyiniz rədd edildi',
            text: `${dateShort(l.start_date)} – ${dateShort(l.end_date)}`,
            at: l.decided_at || l.created_at,
            view: 'leaves'
          })
        );
      } else if (l.status === 'pending') {
        items.push(
          event({
            id: `leave:${l.id}:pending`,
            tone: 'info',
            icon: 'i-clock',
            title: 'Məzuniyyət istəyiniz cavab gözləyir',
            text: `${dateShort(l.start_date)} – ${dateShort(l.end_date)}`,
            at: l.created_at,
            view: 'leaves'
          })
        );
      }
    }

    const todayLogged = (worklogs || []).some((w) => w.work_date === today);
    if (!todayLogged) {
      items.push(
        alert({
          id: `worklog:${today}`,
          tone: 'info',
          icon: 'i-clock',
          title: 'Bu gün iş saatınızı qeyd etməmisiniz',
          text: 'Gündəlik saatları əlavə edin — hesablaşma dəqiq qalsın.',
          view: 'worklog',
          action: 'Qeyd et'
        })
      );
    }

    const monthPaid = sumBy(
      (payments || []).filter(
        (p) => (p.period || String(p.paid_at || '').slice(0, 7)) === thisMonth && p.kind !== 'deduction'
      ),
      (p) => Number(p.amount || 0)
    );

    if (monthPaid > 0) {
      items.push(
        event({
          id: `paid:${thisMonth}:${Math.round(monthPaid * 100)}`,
          tone: 'ok',
          icon: 'i-wallet',
          title: `Bu ay ${money(monthPaid, currency)} aldınız`,
          text: `${monthLabel(thisMonth)} üzrə ödənişlər`,
          at: (payments || []).find((p) => (p.period || String(p.paid_at || '').slice(0, 7)) === thisMonth)?.paid_at,
          view: 'payments'
        })
      );
    }

    const balance = Math.max(0, Number(me.balance || 0));
    if (balance > 0.5) {
      items.push(
        alert({
          id: 'balance:mine',
          tone: 'info',
          icon: 'i-receipt',
          title: `Ödənilməli qalıq: ${money(balance, currency)}`,
          text: 'Sahibkarınız ödəniş etdikdə bu məbləğ azalacaq.',
          view: 'profile',
          action: 'Kabinet'
        })
      );
    }

    if (Number(employee?.monthly_salary || 0) <= 0) {
      items.push(
        alert({
          id: 'salary:zero',
          tone: 'warn',
          icon: 'i-alert',
          title: 'Aylıq maaşınız hələ təyin edilməyib',
          text: 'Sahibkarınızla əlaqə saxlayın.',
          view: 'profile',
          action: 'Kabinet'
        })
      );
    }
  }

  for (const a of (activity || []).slice(0, 12)) {
    items.push(
      event({
        id: `act:${a.id}`,
        tone: 'info',
        icon: 'i-info',
        title: a.action || 'Hadisə',
        text: [a.detail, a.actor_name].filter(Boolean).join(' · ') || '—',
        at: a.created_at,
        view: 'journal'
      })
    );
  }

  const alertRank = (item) => TONE_RANK[item.tone] ?? 9;
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'alert' ? -1 : 1;
    if (a.kind === 'alert') return alertRank(a) - alertRank(b);
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  return items;
}

export function filterNotifications(items, mode = 'all', readMap = {}) {
  if (mode === 'unread') return (items || []).filter((i) => !readMap[i.id]);
  if (mode === 'alert') return (items || []).filter((i) => i.kind === 'alert');
  return items || [];
}
