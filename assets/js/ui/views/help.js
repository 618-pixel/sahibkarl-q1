import { icon, escapeHtml } from '../../lib/dom.js';

export default function renderHelp(root, ctx) {
  const isOwner = ctx.role === 'owner';

  const ownerSteps = [
    { title: 'Biznes yarat', text: 'Yan paneldə biznes adına klikləyin → «Yeni biznes». Adı yazın, valyutanı və maaş gününü seçin.' },
    { title: 'İşçi əlavə et', text: '«İşçilər» → «Yeni işçi». Ad, vəzifə və aylıq maaşı yazın. Sistem avtomatik giriş kodu verir.' },
    { title: 'Kodu işçiyə ver', text: 'İşçilər siyahısında kodu klikləyərək kopyalayın və işçiyə göndərin. İşçi qeydiyyatdan keçib kodu daxil edəndə kabineti açılır.' },
    { title: 'Ödəniş qeyd et', text: 'Pul verəndə «Ödənişlər» → «Yeni ödəniş». Avans, maaş və ya mükafat seçin. Qalıq avtomatik hesablanır.' }
  ];

  const employeeSteps = [
    { title: 'Qeydiyyatdan keç', text: '«Qeydiyyat» bölməsində adınızı, e-poçtunuzu və şifrənizi yazın.' },
    { title: 'Kodu daxil et', text: 'Sahibkarınızdan aldığınız kodu daxil edin. Sistem sizi həmin biznesə bağlayacaq.' },
    { title: 'Maaşını gör', text: '«İcmal» bölməsində aylıq maaşınız, bu ay aldığınız məbləğ və qalıq görünür.' },
    { title: 'İstək göndər', text: 'Məzuniyyət lazımdırsa «Məzuniyyət» bölməsindən istək göndərin. Sahibkar təsdiqləyəndə vəziyyət dəyişəcək.' }
  ];

  const steps = isOwner ? ownerSteps : employeeSteps;

  const faqs = [
    {
      q: 'Qalıq borc necə hesablanır?',
      a: 'Sistem belə hesablayır: (aylıq maaş × işlədiyiniz ay sayı) − (aldığınız pul) − (tutulmalar). İşçi nə qədər çox işləyibsə, o qədər qazanıb; nə qədər pul alıbsa, qalıq o qədər azalır.'
    },
    {
      q: 'İşçi kodunu itsə nə olar?',
      a: 'İşçinin kartını açıb «Yenilə» düyməsini basın. Yeni kod yaranır, köhnə kod işləmir.'
    },
    {
      q: 'Bir neçə biznesim ola bilərmi?',
      a: 'Bəli, istənilən sayda. Yan paneldəki biznes adına klikləyəndə siyahı açılır və oradan keçid edirsiniz. Hər biznesin məlumatı tamamilə ayrıdır.'
    },
    {
      q: 'Bir işçi iki biznesdə işləyə bilərmi?',
      a: 'Bəli. İşçi hər iki biznesin kodunu daxil edir və yan paneldə hər ikisi görünür. Hansına keçsə, yalnız onun məlumatını görür.'
    },
    {
      q: 'Başqa sahibkar mənim məlumatımı görür?',
      a: 'Xeyr. Hər biznesin məlumatı bazada ayrıca qorunur — bir sahibkar digərinin işçisini və ya ödənişini görə bilmir. İşçi isə yalnız öz kartını görür.'
    },
    {
      q: 'Avansla maaş arasındakı fərq nədir?',
      a: 'Avans ayın əvvəlində və ya ortasında verilən puldur. Maaş ayın sonunda tam hesablaşmadır. Hər ikisi ödənilmiş sayılır və qalıqdan çıxılır.'
    },
    {
      q: 'Tutulma nədir?',
      a: 'Tutulma işçinin maaşından çıxılan məbləğdir (məsələn cərimə). Qalıq borcu azaldır, amma ödənilmiş pul sayılmır.'
    },
    {
      q: 'Məlumatlar itə bilərmi?',
      a: 'Məlumatlar bulud bazasında saxlanılır. Brauzeri təmizləsəniz də məlumatlar qalır. Yenə də «Tənzimləmələr» → «Ehtiyat nüsxəni yüklə» ilə fayl saxlamağınız tövsiyə olunur.'
    },
    {
      q: 'Şifrəmi unutdum, nə edim?',
      a: '«Daxil ol» ekranında «Şifrəmi unutdum» düyməsini basın və e-poçtunuzu yazın. Bərpa linki göndəriləcək.'
    },
    {
      q: 'Telefonda işləyir?',
      a: 'Bəli, tam işləyir. Menyu yuxarı soldaki düymə ilə açılır.'
    }
  ];

  root.innerHTML = `
    <section class="card" style="margin-bottom:12px">
      <div class="card__body">
        <h2 style="font-size:16px;font-weight:700;letter-spacing:-.015em">
          ${isOwner ? 'RahatHesab necə işləyir' : 'Kabinetiniz necə işləyir'}
        </h2>
        <p class="tiny muted" style="margin-top:3px">Dörd addım.</p>

        <div class="grid grid--2" style="margin-top:16px">
          ${steps.map((s, i) => `
            <article style="padding:12px 14px;border-radius:var(--radius-sm);background:var(--surface-2);border:1px solid var(--line)">
              <h3 style="font-size:12.5px;font-weight:700">${i + 1}. ${escapeHtml(s.title)}</h3>
              <p class="tiny muted" style="margin-top:3px;line-height:1.6">${escapeHtml(s.text)}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Tez-tez verilən suallar</h3>
          <p class="card__sub">Qısa cavablar</p>
        </div>
      </div>
      <div class="card__body card__body--flush">
        ${faqs.map((f, i) => `
          <details class="faq"${i === 0 ? ' open' : ''}>
            <summary>
              <span>${escapeHtml(f.q)}</span>
              ${icon('i-chevron-down', 15)}
            </summary>
            <p>${escapeHtml(f.a)}</p>
          </details>
        `).join('')}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__body">
        <div class="banner banner--ok">
          ${icon('i-shield', 16)}
          <span>
            <strong>Məlumatlarınız qorunur</strong>
            Hər biznesin məlumatı ayrıca saxlanılır. İşçi yalnız öz kartını görür.
          </span>
        </div>

        <div class="row" style="margin-top:14px;gap:7px">
          <button class="btn btn--soft btn--sm" type="button" data-goto="dashboard">İcmala keç</button>
          ${isOwner ? '<button class="btn btn--ghost btn--sm" type="button" data-goto="employees">İşçilər</button>' : ''}
          <button class="btn btn--ghost btn--sm" type="button" data-goto="profile">Şəxsi kabinet</button>
        </div>
      </div>
    </section>
  `;

  root.querySelectorAll('[data-goto]').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.goto));
  });
}
