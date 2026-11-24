import { icon, escapeHtml, emptyState, toast } from '../../lib/dom.js';
import { timeAgo, dateShort, pluralAz } from '../../lib/format.js';
import { buildNotifications, getReadMap, markRead, markAllRead, clearRead, unreadCount, filterNotifications } from '../../lib/notifications.js';

let mode = 'all';

export function computeNotifications(ctx) {
  return buildNotifications({
    role: ctx.role,
    business: ctx.business,
    employees: ctx.employees,
    balances: ctx.balances,
    payments: ctx.payments,
    worklogs: ctx.worklogs,
    leaves: ctx.leaves,
    notes: ctx.notes,
    activity: ctx.activity,
    currency: ctx.currency,
    employee: ctx.employee
  });
}

export function updateNotificationBadges(ctx) {
  const items = computeNotifications(ctx);
  const readMap = getReadMap(ctx.business?.id);
  const unread = unreadCount(items, readMap);

  const navBadge = document.querySelector('#nav-notif-badge');
  if (navBadge) {
    navBadge.textContent = String(unread);
    navBadge.hidden = unread === 0;
  }

  const topBadge = document.querySelector('#topbar-notif-badge');
  if (topBadge) {
    topBadge.textContent = unread > 99 ? '99+' : String(unread);
    topBadge.hidden = unread === 0;
  }

  const bell = document.querySelector('#notif-open');
  if (bell) {
    bell.classList.toggle('has-unread', unread > 0);
    bell.setAttribute('aria-label', unread > 0 ? `Bildirişlər — ${unread} oxunmamış` : 'Bildirişlər');
  }

  return { items, unread, readMap };
}

const TONE_CLASS = {
  danger: 'notif--danger',
  warn: 'notif--warn',
  ok: 'notif--ok',
  info: 'notif--info'
};

function notifRow(item, readMap, ctx, compact = false) {
  const unread = !readMap[item.id];
  const when = item.at ? timeAgo(item.at) : item.kind === 'alert' ? 'Diqqət tələb edir' : '';
  return `
    <article class="notif ${TONE_CLASS[item.tone] || 'notif--info'} ${unread ? 'is-unread' : ''}" data-notif-id="${escapeHtml(item.id)}">
      <span class="notif__icon" aria-hidden="true">${icon(item.icon || 'i-bell', 16)}</span>
      <div class="notif__main">
        <h3 class="notif__title">${escapeHtml(item.title)}</h3>
        <p class="notif__text">${escapeHtml(item.text || '')}</p>
        <div class="notif__meta">
          ${when ? `<span>${escapeHtml(when)}</span>` : ''}
          ${unread ? '<span class="notif__dot" aria-label="Oxunmamış">•</span>' : ''}
        </div>
      </div>
      <div class="notif__actions">
        ${item.view ? `
          <button class="btn btn--ghost btn--sm" type="button"
            data-notif-goto="${escapeHtml(item.view)}" data-notif-key="${escapeHtml(item.id)}">
            ${escapeHtml(item.action || 'Aç')}
          </button>
        ` : ''}
        <button class="iconbtn iconbtn--sm" type="button"
          data-notif-read="${escapeHtml(item.id)}"
          title="${unread ? 'Oxunmuş kimi işarələ' : 'Oxunmamış kimi işarələ'}"
          aria-label="${unread ? 'Oxunmuş kimi işarələ' : 'Oxunmamış kimi işarələ'}">
          ${icon(unread ? 'i-check' : 'i-refresh', 14)}
        </button>
      </div>
    </article>
  `;
}

export function renderNotificationsPopover(panel, ctx, onNavigate) {
  const { items, readMap } = updateNotificationBadges(ctx);
  const unread = unreadCount(items, readMap);
  const shown = items.slice(0, 6);

  panel.innerHTML = `
    <header class="notifpop__head">
      <div>
        <h2>Bildirişlər</h2>
        <p>${unread ? `${pluralAz(unread, 'oxunmamış bildiriş', 'oxunmamış bildiriş')}` : 'Hamısı oxunub'}</p>
      </div>
      <button class="iconbtn iconbtn--sm" type="button" id="notifpop-close" aria-label="Bağla">${icon('i-close', 15)}</button>
    </header>

    <div class="notifpop__list" role="list">
      ${shown.length
        ? shown.map((item) => notifRow(item, readMap, ctx, true)).join('')
        : `<p class="notifpop__empty">${icon('i-check-circle', 20)} Yeni bildiriş yoxdur.</p>`}
    </div>

    <footer class="notifpop__foot">
      <button class="btn btn--ghost btn--sm" type="button" id="notifpop-all">${icon('i-list', 13)} Bütün bildirişlər</button>
      <span class="spacer"></span>
      <button class="btn btn--soft btn--sm" type="button" id="notifpop-readall" ${unread ? '' : 'disabled'}>
        ${icon('i-check-all', 13)} Hamısını oxu
      </button>
    </footer>
  `;

  const close = () => {
    panel.hidden = true;
  };

  panel.querySelector('#notifpop-close')?.addEventListener('click', close);

  panel.querySelector('#notifpop-all')?.addEventListener('click', () => {
    close();
    onNavigate('notifications');
  });

  panel.querySelector('#notifpop-readall')?.addEventListener('click', () => {
    markAllRead(ctx.business?.id, items);
    renderNotificationsPopover(panel, ctx, onNavigate);
    updateNotificationBadges(ctx);
    toast('Bütün bildirişlər oxunmuş kimi işarələndi.', 'ok', 2600);
  });

  panel.querySelectorAll('[data-notif-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markRead(ctx.business?.id, btn.dataset.notifKey);
      close();
      updateNotificationBadges(ctx);
      onNavigate(btn.dataset.notifGoto);
    });
  });

  panel.querySelectorAll('[data-notif-read]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.notifRead;
      const current = getReadMap(ctx.business?.id);
      markRead(ctx.business?.id, id, !current[id]);
      renderNotificationsPopover(panel, ctx, onNavigate);
      updateNotificationBadges(ctx);
    });
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !panel.hidden) close();
    },
    { once: true }
  );
}

export default function renderNotifications(root, ctx) {
  const { items, readMap } = updateNotificationBadges(ctx);
  const filtered = filterNotifications(items, mode, readMap);
  const unread = unreadCount(items, readMap);
  const alerts = items.filter((i) => i.kind === 'alert').length;
  const events = items.filter((i) => i.kind === 'event').length;

  root.innerHTML = `
    <div class="grid grid--stats" style="margin-bottom:12px">
      <article class="stat stat--brand">
        <div class="stat__top"><span class="stat__label">Oxunmamış</span><span class="stat__icon">${icon('i-bell', 14)}</span></div>
        <div class="stat__value">${unread}</div>
        <div class="stat__hint">${unread ? 'Diqqətinizi çəkir' : 'Hamısı oxunub'}</div>
      </article>
      <article class="stat ${alerts ? 'stat--danger' : ''}">
        <div class="stat__top"><span class="stat__label">Diqqət tələb edir</span><span class="stat__icon ${alerts ? 'stat__icon--danger' : ''}">${icon('i-alert', 14)}</span></div>
        <div class="stat__value">${alerts}</div>
        <div class="stat__hint">Aktiv vəzifə və xəbərdarlıq</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Hadisələr</span><span class="stat__icon stat__icon--info">${icon('i-list', 14)}</span></div>
        <div class="stat__value">${events}</div>
        <div class="stat__hint">Son hərəkətlər</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Cəmi bildiriş</span><span class="stat__icon">${icon('i-check-circle', 14)}</span></div>
        <div class="stat__value">${items.length}</div>
        <div class="stat__hint">Bu biznes üzrə</div>
      </article>
    </div>

    <div class="toolbar">
      <div class="segmented segmented--inline" role="tablist" aria-label="Bildiriş filtri">
        <button class="segmented__btn ${mode === 'all' ? 'is-active' : ''}" type="button" role="tab"
          aria-selected="${mode === 'all'}" data-notif-mode="all">Hamısı (${items.length})</button>
        <button class="segmented__btn ${mode === 'unread' ? 'is-active' : ''}" type="button" role="tab"
          aria-selected="${mode === 'unread'}" data-notif-mode="unread">Oxunmamış (${unread})</button>
        <button class="segmented__btn ${mode === 'alert' ? 'is-active' : ''}" type="button" role="tab"
          aria-selected="${mode === 'alert'}" data-notif-mode="alert">Diqqət (${alerts})</button>
      </div>
      <span class="spacer"></span>
      <button class="btn btn--soft btn--sm" type="button" id="notif-readall" ${unread ? '' : 'disabled'}>
        ${icon('i-check-all', 13)} Hamısını oxu
      </button>
      <button class="btn btn--ghost btn--sm" type="button" id="notif-reset" ${unread || Object.keys(readMap).length ? '' : 'disabled'}>
        ${icon('i-refresh', 13)} Sıfırla
      </button>
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">${pluralAz(filtered.length, 'bildiriş', 'bildiriş')}</h2>
          <p class="card__sub">${mode === 'unread' ? 'Yalnız oxunmamışlar' : mode === 'alert' ? 'Diqqət tələb edənlər' : 'Bütün bildirişlər'}</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${filtered.length
          ? `<div class="notif-list">${filtered.map((item) => notifRow(item, readMap, ctx)).join('')}</div>`
          : emptyState({
              title: mode === 'unread' ? 'Oxunmamış bildiriş yoxdur' : 'Bildiriş yoxdur',
              message:
                mode === 'unread'
                  ? 'Bütün bildirişləri oxumusunuz. Yeni hadisələr burada görünəcək.'
                  : 'Hər şey qaydasındadır. Məzuniyyət istəyi, ödəniş və ya qeyd yarandıqda burada xəbərdarlıq görünəcək.',
              iconName: 'i-check-circle'
            })}
      </div>
    </section>
  `;

  root.querySelectorAll('[data-notif-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.notifMode;
      renderNotifications(root, ctx);
    });
  });

  root.querySelector('#notif-readall')?.addEventListener('click', () => {
    markAllRead(ctx.business?.id, items);
    updateNotificationBadges(ctx);
    renderNotifications(root, ctx);
    toast('Hamısı oxunmuş kimi işarələndi.', 'ok', 2400);
  });

  root.querySelector('#notif-reset')?.addEventListener('click', () => {
    clearRead(ctx.business?.id);
    updateNotificationBadges(ctx);
    renderNotifications(root, ctx);
    toast('Oxunma vəziyyəti sıfırlandı.', 'info', 2400);
  });

  root.querySelectorAll('[data-notif-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markRead(ctx.business?.id, btn.dataset.notifKey);
      updateNotificationBadges(ctx);
      ctx.navigate(btn.dataset.notifGoto);
    });
  });

  root.querySelectorAll('[data-notif-read]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.notifRead;
      const current = getReadMap(ctx.business?.id);
      markRead(ctx.business?.id, id, !current[id]);
      updateNotificationBadges(ctx);
      renderNotifications(root, ctx);
    });
  });
}

export function resetNotificationMode() {
  mode = 'all';
}
