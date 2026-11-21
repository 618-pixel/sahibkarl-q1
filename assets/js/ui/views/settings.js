import { icon, escapeHtml, toast, setLoading, copyText, confirmDialog } from '../../lib/dom.js';
import { updateProfile, changePassword, friendlyError, rotateJoinCode, deleteBusiness } from '../../lib/store.js';
import { openBusinessForm } from '../forms.js';
import { exportBackup } from '../backup.js';
import { dateShort } from '../../lib/format.js';

export default function renderSettings(root, ctx) {
  const { business, profile, state, employees, reloadSpaces, refresh } = ctx;
  const user = state.user || {};
  const name = profile?.full_name || user.user_metadata?.full_name || '';

  root.innerHTML = `
    <div class="grid grid--2">
      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Biznes profili</h3>
            <p class="card__sub">Ad, valyuta, maaş günü</p>
          </div>
          <button class="btn btn--ghost btn--sm" type="button" id="set-biz-edit">${icon('i-edit', 13)} Redaktə</button>
        </div>
        <div class="card__body">
          <dl class="kv">
            <div class="kv__row"><dt>Ad</dt><dd>${escapeHtml(business?.name || '—')}</dd></div>
            <div class="kv__row"><dt>Hüquqi ad</dt><dd>${escapeHtml(business?.legal_name || '—')}</dd></div>
            <div class="kv__row"><dt>Valyuta</dt><dd>${escapeHtml(business?.currency || 'AZN')}</dd></div>
            <div class="kv__row"><dt>Maaş günü</dt><dd>Ayın ${Number(business?.pay_day || 5)}-i</dd></div>
            <div class="kv__row"><dt>Telefon</dt><dd>${escapeHtml(business?.phone || '—')}</dd></div>
            <div class="kv__row"><dt>E-poçt</dt><dd>${escapeHtml(business?.email || '—')}</dd></div>
            <div class="kv__row"><dt>Ünvan</dt><dd>${escapeHtml(business?.address || '—')}</dd></div>
            <div class="kv__row"><dt>İşçi sayı</dt><dd>${employees.length}</dd></div>
          </dl>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">İşçi qoşulma kodu</h3>
            <p class="card__sub">Kodla qoşulma</p>
          </div>
        </div>
        <div class="card__body">
          <div class="banner" style="margin-bottom:12px">
            ${icon('i-key', 16)}
            <span>
              <strong>Hər işçinin öz kodu var</strong>
              «İşçilər» bölməsində işçi kartını açın — kod orada görünür.
            </span>
          </div>

          <div class="codebox">
            <div style="flex:1 1 130px;min-width:0">
              <div class="tiny muted">Biznesin ümumi kodu</div>
              <div class="codebox__code" id="set-join-code">${escapeHtml(business?.join_code || '——')}</div>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" id="set-code-copy">${icon('i-copy', 13)} Kopyala</button>
            <button class="btn btn--ghost btn--sm" type="button" id="set-code-new">${icon('i-refresh', 13)} Yenilə</button>
          </div>
        </div>
      </section>
    </div>

    <div class="grid grid--2" style="margin-top:12px">
      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Şəxsi məlumatlar</h3>
            <p class="card__sub">Ad və telefon</p>
          </div>
        </div>
        <div class="card__body">
          <form id="set-profile-form" style="display:grid;gap:11px" novalidate>
            <div class="field">
              <label for="set-name">Ad və soyad</label>
              <div class="field__control">
                <input id="set-name" type="text" value="${escapeHtml(name)}" placeholder="Ad Soyad" />
              </div>
            </div>
            <div class="field">
              <label for="set-phone">Telefon</label>
              <div class="field__control">
                <input id="set-phone" type="tel" value="${escapeHtml(profile?.phone || '')}" placeholder="+994 50 000 00 00" />
              </div>
            </div>
            <p class="form-error" id="set-profile-err" role="alert" hidden></p>
            <button class="btn btn--primary btn--block btn--sm" type="submit" id="set-profile-save">Yadda saxla</button>
          </form>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Şifrə</h3>
            <p class="card__sub">Hesabın təhlükəsizliyi</p>
          </div>
        </div>
        <div class="card__body">
          <form id="set-pass-form" style="display:grid;gap:11px" novalidate>
            <div class="field">
              <label for="set-pass1">Yeni şifrə</label>
              <div class="field__control">
                <input id="set-pass1" type="password" autocomplete="new-password" placeholder="Ən azı 8 simvol" />
              </div>
            </div>
            <div class="field">
              <label for="set-pass2">Təkrar</label>
              <div class="field__control">
                <input id="set-pass2" type="password" autocomplete="new-password" placeholder="Şifrəni təkrar yazın" />
              </div>
            </div>
            <p class="form-error" id="set-pass-err" role="alert" hidden></p>
            <p class="form-success" id="set-pass-ok" role="status" hidden></p>
            <button class="btn btn--ghost btn--block btn--sm" type="submit" id="set-pass-save">Şifrəni dəyiş</button>
          </form>

          <p class="tiny muted" style="margin-top:12px;line-height:1.6">
            Hesab: <b>${escapeHtml(user.email || '—')}</b><br />
            Qeydiyyat: ${dateShort(user.created_at)}
          </p>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <div>
          <h3 class="card__title">Məlumatların ehtiyat nüsxəsi</h3>
          <p class="card__sub">Bütün məlumatları fayla yükləyin</p>
        </div>
      </div>
      <div class="card__body">
        <p class="tiny muted" style="line-height:1.65;margin-bottom:12px">
          İşçilər, ödənişlər, davamiyyət və qeydlər bir JSON faylında saxlanılır. Faylı özünüzdə arxiv kimi saxlaya bilərsiniz.
        </p>
        <button class="btn btn--ghost btn--sm" type="button" id="set-backup">${icon('i-download', 13)} Ehtiyat nüsxəni yüklə</button>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <div>
          <h3 class="card__title">Biznesi sil</h3>
          <p class="card__sub">Geri qaytarıla bilməyən əməliyyat</p>
        </div>
      </div>
      <div class="card__body">
        <div class="banner banner--danger" style="margin-bottom:12px">
          ${icon('i-alert', 16)}
          <span>
            <strong>Diqqət</strong>
            Biznes silinəndə bütün işçilər, ödənişlər, davamiyyət və qeydlər də silinir.
          </span>
        </div>
        <button class="btn btn--danger-ghost btn--sm" type="button" id="set-biz-delete">
          ${icon('i-trash', 13)} «${escapeHtml(business?.name || 'Biznes')}» biznesini sil
        </button>
      </div>
    </section>
  `;

  root.querySelector('#set-biz-edit')?.addEventListener('click', () => {
    openBusinessForm({ business, onSaved: reloadSpaces });
  });

  root.querySelector('#set-code-copy')?.addEventListener('click', async () => {
    const ok = await copyText(business?.join_code || '');
    toast(ok ? 'Kod kopyalandı.' : 'Kopyalamaq mümkün olmadı.', ok ? 'ok' : 'error');
  });

  root.querySelector('#set-code-new')?.addEventListener('click', async () => {
    try {
      const code = await rotateJoinCode(business.id);
      const el = root.querySelector('#set-join-code');
      if (el) el.textContent = code;
      toast('Yeni kod: ' + code, 'ok', 6000);
      await refresh();
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  root.querySelector('#set-backup')?.addEventListener('click', () => exportBackup(ctx));

  root.querySelector('#set-biz-delete')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Biznesi sil',
      message: `«${business?.name || 'Biznes'}» və ona aid bütün işçilər, ödənişlər və qeydlər silinəcək. Bu əməliyyat geri qaytarıla bilməz.`,
      confirmText: 'Bəli, sil',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteBusiness(business.id);
      toast('Biznes silindi.', 'ok');
      await reloadSpaces();
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  const profileForm = root.querySelector('#set-profile-form');
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = root.querySelector('#set-profile-err');
    const btn = root.querySelector('#set-profile-save');
    errBox.hidden = true;

    const fullName = root.querySelector('#set-name').value.trim();
    if (fullName.length < 2) {
      errBox.textContent = 'Adınızı tam yazın.';
      errBox.hidden = false;
      return;
    }

    setLoading(btn, true);
    try {
      await updateProfile({ fullName, phone: root.querySelector('#set-phone').value.trim() });
      toast('Məlumatlar yeniləndi.', 'ok');
      await reloadSpaces();
    } catch (err) {
      errBox.textContent = friendlyError(err);
      errBox.hidden = false;
    } finally {
      setLoading(btn, false);
    }
  });

  const passForm = root.querySelector('#set-pass-form');
  passForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = root.querySelector('#set-pass-err');
    const okBox = root.querySelector('#set-pass-ok');
    const btn = root.querySelector('#set-pass-save');
    errBox.hidden = true;
    okBox.hidden = true;

    const p1 = root.querySelector('#set-pass1').value;
    const p2 = root.querySelector('#set-pass2').value;

    if (p1.length < 8) {
      errBox.textContent = 'Şifrə ən azı 8 simvol olmalıdır.';
      errBox.hidden = false;
      return;
    }
    if (p1 !== p2) {
      errBox.textContent = 'Şifrələr uyğun gəlmir.';
      errBox.hidden = false;
      return;
    }

    setLoading(btn, true);
    try {
      await changePassword(p1);
      okBox.textContent = 'Şifrə dəyişdirildi.';
      okBox.hidden = false;
      passForm.reset();
      toast('Şifrə dəyişdirildi.', 'ok');
    } catch (err) {
      errBox.textContent = friendlyError(err);
      errBox.hidden = false;
    } finally {
      setLoading(btn, false);
    }
  });
}
