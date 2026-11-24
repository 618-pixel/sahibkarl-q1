# RahatHesab

Kiçik bizneslər üçün sadə əməkhaqqı, avans, davamiyyət və məzuniyyət uçotu platforması.
Statik SPA + Supabase (PostgreSQL) — server tələb etmir, telefondan da tam işləyir.

---

## Layihə haqqında

- **Ad**: RahatHesab (v2.1)
- **Məqsəd**: Excel cədvəllərini əvəz edən, çox biznesli, real vaxtda hesablaşan əməkhaqqı sistemi
- **Texnologiya**: Vanilla JS (ES modules) + Hono olmayan statik SPA, Supabase Auth/PostgREST, Row Level Security
- **Dillər**: Azərbaycan dili (interfeys tam az)

---

## Cari funksionallıq (tamamlanmış)

### Hesab və giriş
- E-poçt/şifrə ilə qeydiyyat və giriş, e-poçt təsdiqi, şifrə bərpası
- «Məni xatırla», şifrə gücü göstəricisi, şifrə göstərmə/gizlətmə
- Sahibkar **və** işçi eyni formadan daxil olur — rol avtomatik təyin edilir
- Çox biznesli iş: sahibkar istənilən sayda biznes, işçi bir neçə biznesdə çalışa bilər
- Biznes keçidi (sidebar switcher) + yadda saxlanılan aktiv biznes

### İşçilər
- Əlavə et / redaktə et / sil, aktiv-passiv statusu
- Avtomatik 8 simvollu **giriş kodu** (kopyala, yenilə)
- CSV ilə kütləvi idxal (Excel-dən kopyala-yapışdır)
- CSV ixracı (bütün sahələr: maaş, kod, ödənilib, qalıq)
- Axtarış, filtr (aktiv/passiv/borclu/qoşulmayan), sıralama (ad/maaş/borc)
- İşçi kartı: hesablaşma, ödəniş tarixçəsi, davamiyyət, məzuniyyət

### Əməkhaqqı
- Aylıq hesablaşma cədvəli (dövr seçimi), avtomatik qalıq hesablanması
- **Toplu ödəniş** — bütün qalıqları bir kliklə maaş kimi qeyd edir
- **Hesablaşma vərəqəsi** (расчетный листок): işçi üzrə detallı çap forması + Excel-ə kopyalama
- CSV ixracı və çap (print CSS)

### Ödənişlər
- Növlər: avans, maaş, mükafat, tutulma
- Üsullar: nağd, kart, bank köçürməsi, digər
- Filtr (növ/dövr/işçi) + axtarış + redaktə/silmə
- Ödəniş formasında işçinin cari balansı göstərilir

### Davamiyyət
- Gündəlik iş saatı + əlavə iş (overtime), işçi üzrə aylıq xülasə
- Upsert məntiqi (eyni gün üçün təkrar yazılış yeniləyir)
- CSV ixracı, işçi öz saatını yaza bilir

### Məzuniyyət
- İstək yaratma, sahibkar təsdiqi/rəddi, gün sayı avtomatik
- Status nişanları, bildirişlərə inteqrasiya

### Bildirişlər (yeni — ayrıca bölmə)
- **Ayrıca «Bildirişlər» səhifəsi** + topbar zəng ikonu (badge ilə) + yan panel sayğacı
- Ağıllı bildiriş mühərriki: cavab gözləyən məzuniyyət, vaxtı keçmiş qeydlər,
  qoşulmamış işçilər, maaşı 0 olanlar, tam ödənilməmiş ay, ümumi borc,
  maaş gününə qalan gün, bu gün üçün davamiyyətsizlik
- İşçi tərəfində: məzuniyyət qərarı, bu günkü saat qeydi, aylıq ödəniş, qalıq
- Filtrlər: hamısı / oxunmamış / diqqət tələb edən
- Oxundu/oxunmadı vəziyyəti localStorage-da biznes üzrə saxlanılır
- «Hamısını oxu», «Sıfırla», birbaşa bölməyə keçid

### Jurnal (yeni)
- Bütün əməliyyatlar (ödəniş, davamiyyət, məzuniyyət, qeyd, işçi) **tək xronologiyada**
- Növ filtri, axtarış, «daha çox göstər» (60-lıq səhifələmə)
- CSV ixracı və Excel-ə yapışdırmaq üçün tab-ayrılmış kopyalama

### Hesabatlar
- 3/6/12 aylıq dinamika, orta ödəniş, trend (%)
- Ödəniş üsulları üzrə paylanma, işçilər üzrə yekun + ödəniş faizi
- CSV və çap

### Qeydlər
- Tapşırıq/xatırlatma, son tarix, tamamlanmışlar filtri
- Vaxtı keçmiş qeydlər qırmızı vurğulanır

### Tənzimləmələr / profil
- Biznes profili (ad, hüquqi ad, valyuta, maaş günü, telefon, ünvan)
- Biznes qoşulma kodu (yenilə/kopyala), şəxsi məlumatlar, şifrə dəyişmə
- Ehtiyat nüsxə (JSON), biznesi silmə (təsdiqlə)

### UX / performans (yeni)
- **Ani açılış**: son biznesin snapshot-u keşdən dərhal çəkilir, sonra fonda yenilənir
- **Skeleton yükləmə** ekranı — boş ekran yerinə struktur
- **Sinxronizasiya indikatoru** (Hazır / Yüklənir / Oflayn / Yenilənmədi)
- `preconnect`/`dns-prefetch` Supabase-ə (ilk sorğu gecikməsi azalır)
- Şəbəkə onlayn/oflayn hadisələrinə reaksiya, tab-a qayıdanda avtomatik yeniləmə
- Son baxılan bölmə yadda saxlanılır (səhifə yeniləyəndə qalır)
- Şəkillər optimallaşdırıldı: **~290 KB → ~76 KB** (logo-mark 66.5 KB → 3.6 KB)

### Layout və əlçatanlıq (yeni)
- Mobil cədvəllər **kart görünüşünə** çevrilir (üfüqi sürüşmə yoxdur)
- Toxunma hədəfləri ≥ 36–42 px, `-webkit-tap-highlight-color` söndürülüb
- Modallar mobilde aşağıdan açılır, sahələr `inputmode` ilə düzgün klaviatura alır
- Klaviatura: `Ctrl+K` axtarış, `Esc` bağlama, fokus tələsi (focus trap)
- `aria-*` atributları, `role`, `aria-live` bildirişlər, skip-link
- Dark/Light tema, `prefers-reduced-motion` dəstəyi

---

## İstifadəçi bələdçisi

1. **Qeydiyyat** — ad, e-poçt, şifrə (≥8 simvol) və razılıq.
2. **Sahibkar**: yan paneldəki biznes adına klik → «Yeni biznes» → ad, valyuta, maaş günü.
3. **İşçi əlavə et** — «İşçilər» → «Yeni işçi» (ad, vəzifə, aylıq maaş). Sistem giriş kodu verir.
4. **Kodu işçiyə ver** — siyahıda koda klikləyərək kopyalayın.
5. **İşçi**: qeydiyyatdan keçib «Kodu daxil et» ilə biznesə qoşulur, öz kabinetini görür.
6. **Ödəniş** — «Əlavə et» düyməsi (topbar) və ya «Ödənişlər» → «Yeni ödəniş».
7. **Çap/ixrac** — hər cədvəldə CSV, çap və Excel-ə kopyalama düymələri var.

### Klaviatura qısayolları
| Qısayol | Funksiya |
| --- | --- |
| `Ctrl/Cmd + K` | Qlobal axtarış (işçi, ödəniş, bölmə) |
| `Esc` | Modal / panel / menyu bağlama |

---

## İctimai ünvanlar

- **GitHub**: https://github.com/618-pixel/sahibkarl-q1
- **Lokal preview**: `http://localhost:3000` (`npm run preview`)
- **Deploy**: statik `dist/` — Cloudflare Pages / Netlify / GitHub Pages / Render

---

## Data arxitekturası

**Storage**: Supabase (PostgreSQL + Auth + RLS)

| Cədvəl / görünüş | Təyinat |
| --- | --- |
| `profiles` | istifadəçi adı, telefon |
| `businesses` | biznes profili, valyuta, `pay_day`, `join_code` |
| `business_members` | biznes↔istifadəçi rol xəritəsi |
| `employees` | işçi kartı, `monthly_salary`, `access_code` |
| `salary_payments` | ödənişlər (advance/salary/bonus/deduction) |
| `work_logs` | gündəlik saat + overtime (employee_id+work_date unikal) |
| `leave_requests` | məzuniyyət istəkləri və qərarlar |
| `notes` | tapşırıq/xatırlatma |
| `activity_log` | audit jurnalı |
| `v_employee_balances` | hesablaşma görünüşü (accrued, paid, balance) |

**Qalıq düsturu** (`v_employee_balances`):
```
accrued_total = monthly_salary × months_count
balance       = accrued_total − total_paid − total_deduction
```

**Təhlükəsizlik**: hər cədvəldə RLS aktivdir; `can_manage_business()` / `is_self_employee()`
funksiyaları ilə biznes izolyasiyası. İşçi yalnız öz sətrini görür.
Frontend yalnız **publik** açar (`sb_publishable_` / `anon`) istifadə edir — `service_role` build zamanı bloklanır.

---

## Deployment

- **Platform**: statik hostinq (Cloudflare Pages tövsiyə olunur)
- **Status**: ✅ Aktiv (statik build hazır)
- **Tech stack**: Vanilla JS ES modules + Supabase
- **Build**: `npm run build` → `dist/`

### Mühit dəyişənləri
```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # və ya SUPABASE_ANON_KEY
```
Verilməzsə `scripts/build.mjs` daxilindəki publik fallback istifadə olunur.

### Əmrlər
```bash
npm run build     # dist/ yarat + bütün yoxlamaları keç
npm run preview   # lokal preview (port 3000)
npm run check     # yalnız yoxlama (build daxilində avtomatik)
```

### QA
`qa/harness.html` — 47 avtomatik yoxlama: bütün görünüşlər (owner/işçi/boş),
13 modal forma, bildiriş məntiqi və jurnal. Nəticə: **47/47 keçdi**.

```bash
python3 -m http.server 3100   # sonra /qa/harness.html açın
```

---

## Hazelda implement edilməyib (növbəti addımlar)

- [ ] Əməkhaqqından avtomatik vergi/sosial ayırma (DSMF, gəlir vergisi) hesablaması
- [ ] Excel (.xlsx) faylının birbaşa idxalı (hazırda CSV/kleştirme var)
- [ ] PDF hesablaşma vərəqəsi (hazırda brauzer çapı → PDF)
- [ ] Qrafik (növbə cədvəli) planlaşdırma
- [ ] Avtomatik e-poçt bildirişləri (Resend/SendGrid inteqrasiyası)
- [ ] Çoxdilli interfeys (rus/ingilis)
- [ ] Bank ödəniş fayllarının generasiyası
- [ ] Offline-first tam rejim (service worker + IndexedDB)

---

## Lisenziya
MIT
