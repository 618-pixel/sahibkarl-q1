import { icon, emptyState, escapeHtml, toast } from '../../lib/dom.js';
import { dateShort, todayISO, timeAgo } from '../../lib/format.js';
import { toggleNote, friendlyError } from '../../lib/store.js';
import { openNoteForm, confirmDeleteNote } from '../forms.js';

let showDone = false;

export default function renderNotes(root, ctx) {
  const { notes, business, refresh } = ctx;

  const open = notes.filter((n) => !n.is_done);
  const done = notes.filter((n) => n.is_done);
  const overdue = open.filter((n) => n.due_date && n.due_date < todayISO());
  const today = open.filter((n) => n.due_date === todayISO());
  const visible = showDone ? notes : open;

  root.innerHTML = `
    <div class="grid grid--stats" style="margin-bottom:12px">
      <article class="stat stat--brand">
        <div class="stat__top"><span class="stat__label">Açıq qeyd</span><span class="stat__icon">${icon('i-note', 14)}</span></div>
        <div class="stat__value">${open.length}</div>
        <div class="stat__hint">Tamamlanmamış tapşırıq</div>
      </article>
      <article class="stat ${overdue.length ? 'stat--danger' : ''}">
        <div class="stat__top"><span class="stat__label">Vaxtı keçmiş</span><span class="stat__icon stat__icon--danger">${icon('i-alert', 14)}</span></div>
        <div class="stat__value">${overdue.length}</div>
        <div class="stat__hint">${overdue.length ? 'Diqqət tələb edir' : 'Hər şey qaydasındadır'}</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Bu gün</span><span class="stat__icon stat__icon--warn">${icon('i-calendar', 14)}</span></div>
        <div class="stat__value">${today.length}</div>
        <div class="stat__hint">Son tarixi bugün</div>
      </article>
      <article class="stat">
        <div class="stat__top"><span class="stat__label">Tamamlanmış</span><span class="stat__icon stat__icon--info">${icon('i-check-circle', 14)}</span></div>
        <div class="stat__value">${done.length}</div>
        <div class="stat__hint">Bitirilmiş tapşırıq</div>
      </article>
    </div>

    <div class="toolbar">
      <button class="btn btn--ghost btn--sm" type="button" id="notes-toggle">
        ${showDone ? 'Yalnız açıqlar' : 'Tamamlanmışlar da'}
      </button>
      <span class="spacer"></span>
      <button class="btn btn--primary btn--sm" type="button" id="notes-add">${icon('i-plus', 14)} Yeni qeyd</button>
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">${visible.length} qeyd</h3>
          <p class="card__sub">${showDone ? 'Açıq və tamamlanmış' : 'Yalnız açıq tapşırıqlar'}</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${visible.length ? `
          <div class="list">
            ${visible.map((n) => {
              const isOverdue = !n.is_done && n.due_date && n.due_date < todayISO();
              return `
                <div class="list-row" style="${n.is_done ? 'opacity:.55' : ''}">
                  <label class="checkbox" style="margin-top:0">
                    <input type="checkbox" ${n.is_done ? 'checked' : ''} data-note-toggle="${escapeHtml(n.id)}" aria-label="Tamamlandı" />
                  </label>
                  <div class="list-row__main">
                    <div class="list-row__title" style="${n.is_done ? 'text-decoration:line-through' : ''}">${escapeHtml(n.title)}</div>
                    <div class="list-row__sub">
                      ${n.due_date ? `<span style="color:${isOverdue ? 'var(--danger)' : 'inherit'};font-weight:${isOverdue ? 600 : 400}">${dateShort(n.due_date)}</span>` : 'Tarix yoxdur'}
                      ${n.body ? ' · ' + escapeHtml(n.body.slice(0, 70)) + (n.body.length > 70 ? '…' : '') : ''}
                      · ${timeAgo(n.created_at)}
                    </div>
                  </div>
                  <div class="row-actions">
                    <button class="iconbtn iconbtn--sm" type="button" title="Redaktə" data-note-edit="${escapeHtml(n.id)}">${icon('i-edit', 14)}</button>
                    <button class="iconbtn iconbtn--sm" type="button" title="Sil" data-note-del="${escapeHtml(n.id)}">${icon('i-trash', 14)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : emptyState({
          title: notes.length ? 'Açıq qeyd yoxdur' : 'Hələ qeyd yoxdur',
          message: notes.length
            ? 'Bütün tapşırıqları tamamlamısınız.'
            : 'Xatırlatmalar yaradın: müqavilə, vergi tarixi, alış-veriş siyahısı.',
          iconName: notes.length ? 'i-check-circle' : 'i-note',
          action: `<button class="btn btn--primary" type="button" id="notes-add2">${icon('i-plus', 14)} Qeyd əlavə et</button>`
        })}
      </div>
    </section>
  `;

  const addNote = () => openNoteForm({ businessId: business.id, onSaved: refresh });

  root.querySelector('#notes-add')?.addEventListener('click', addNote);
  root.querySelector('#notes-add2')?.addEventListener('click', addNote);

  root.querySelector('#notes-toggle')?.addEventListener('click', () => {
    showDone = !showDone;
    renderNotes(root, ctx);
  });

  root.querySelectorAll('[data-note-toggle]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      try {
        await toggleNote(cb.dataset.noteToggle, cb.checked);
        await refresh();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
    });
  });

  root.querySelectorAll('[data-note-edit]').forEach((b) => {
    b.addEventListener('click', () => {
      const note = notes.find((n) => n.id === b.dataset.noteEdit);
      if (note) openNoteForm({ businessId: business.id, note, onSaved: refresh });
    });
  });

  root.querySelectorAll('[data-note-del]').forEach((b) => {
    b.addEventListener('click', () => {
      const note = notes.find((n) => n.id === b.dataset.noteDel);
      if (note) confirmDeleteNote(note, refresh);
    });
  });
}
