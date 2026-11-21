# RahatHesab

Kiçik bizneslər üçün əməkhaqqı, avans və ödəniş uçotu. Statik SPA + Supabase (PostgreSQL + RLS).

## Nə edir

- İşçi kartları: maaş, vəzifə, əlaqə, işə qəbul tarixi
- Ödənişlər: avans, maaş, mükafat, tutulma + ödəniş üsulu
- Avtomatik hesablaşma: hesablanmış maaş, ödənilən məbləğ, qalıq borc
- Əməkhaqqı cədvəli: ay üzrə tam hesablaşma + toplu ödəniş
- Davamiyyət: gündəlik iş saatı və əlavə iş
- Məzuniyyət istəkləri: işçi göndərir, sahibkar təsdiqləyir
- Qeydlər, hesabatlar, CSV ixracı, JSON ehtiyat nüsxəsi
- Çoxbiznesli: bir hesabda istənilən sayda biznes
- İşçi 8 simvollu kodla öz kabinetinə qoşulur
- Açıq/tünd tema, mobil-first, `Ctrl/⌘ + K` axtarış

## Qurulum

### 1. Baza

Supabase Dashboard → SQL Editor → `supabase/schema.sql` faylının hamısını yapışdırıb **Run**.

Fayl idempotentdir, təkrar işə salmaq təhlükəsizdir. Yaratdığı əsas obyektlər:

| Cədvəl | Məzmun |
|---|---|
| `profiles` | istifadəçi profili (ad, telefon) |
| `businesses` | biznes (sahibkar, valyuta, maaş günü, qoşulma kodu) |
| `business_members` | biznes ↔ istifadəçi əlaqəsi |
| `employees` | işçi kartı + giriş kodu |
| `salary_payments` | ödənişlər (advance / salary / bonus / deduction) |
| `work_logs` | gündəlik iş saatları |
| `leave_requests` | məzuniyyət istəkləri |
| `notes` | tapşırıqlar |
| `activity_log` | fəaliyyət jurnalı |
| `v_employee_balances` (view) | hesablanmış maaş, ödənilən, qalıq |

Bütün cədvəllərdə RLS aktivdir: hər sahibkar yalnız öz biznesini, işçi yalnız öz kartını görür.

### 2. Auth ayarı

Supabase → Authentication → Sign In / Providers → Email:

- **Confirm email** — söndürmək tövsiyə olunur (pulsuz SMTP saatda bir neçə məktub göndərir).
- Açıq qalsa, işçi qoşulması yenə işləyir (kod əsaslıdır), sadəcə giriş üçün e-poçt təsdiqi tələb olunur.

### 3. Sayt

```bash
npm run build      # dist/ yaradır
npm run preview    # http://localhost:3000
```

Statik hostinqə `dist/` qovluğunu yerləşdirmək kifayətdir.

## Konfiqurasiya

`assets/js/config.js` publik açarları saxlayır (URL, `sb_publishable_...`, anon JWT).
`npm run build` bu faylı mühit dəyişənlərindən yenidən yaradır:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Build gizli açar (`sb_secret_...` / `service_role`) aşkarlasa dayanır.

## Struktur

```
index.html                    tətbiq qabığı + ikon sprite
assets/css/styles.css         dizayn sistemi (açıq/tünd tema)
assets/js/app.js              marşrutlama, state, shell
assets/js/auth.js             giriş / qeydiyyat / bərpa
assets/js/config.js           publik açarlar
assets/js/lib/dom.js          modal, toast, forma köməkçiləri
assets/js/lib/format.js       pul, tarix, CSV formatlaşdırma
assets/js/lib/store.js        Supabase məlumat qatı
assets/js/ui/forms.js         forma modalları
assets/js/ui/palette.js       qlobal axtarış
assets/js/ui/backup.js        JSON ehtiyat nüsxəsi
assets/js/ui/views/*.js       bölmə görünüşləri
scripts/build.mjs             build + yoxlama
supabase/schema.sql           tam baza sxemi
```

`scripts/build.mjs` həm də yoxlayır: sintaksis, import/export uyğunluğu, çatışmayan ikonlar, manifest ikonları, xarici script olmaması.

## Marşrutlar (daxili görünüşlər)

| Görünüş | Rol | Nə göstərir |
|---|---|---|
| `dashboard` | hər ikisi | icmal, xəbərdarlıqlar, qalıq borclar |
| `employees` / `employee-detail` | sahibkar | işçi siyahısı və kartı |
| `payroll` | sahibkar | aylıq hesablaşma, toplu ödəniş |
| `payments` | hər ikisi | ödəniş tarixçəsi |
| `worklog` | hər ikisi | davamiyyət |
| `leaves` | hər ikisi | məzuniyyət istəkləri |
| `notes` | sahibkar | tapşırıqlar |
| `reports` | sahibkar | dinamika, yekunlar, CSV, çap |
| `settings` | sahibkar | biznes profili, kodlar, şifrə, ehtiyat |
| `profile` | hər ikisi | şəxsi kabinet |
| `help` | hər ikisi | qısa izahlar |

URL dəyişmir — marşrutlaşdırma yaddaşdaxilidir.

## Təhlükəsizlik

- Brauzerdə yalnız publik açar var; `service_role` heç vaxt frontend-ə düşmür.
- Bütün məlumat girişi RLS ilə məhdudlaşdırılır.
- İşçi maaşa toxuna bilməz — yalnız öz telefonunu yeniləyir.

## Status

Statik SPA, build yoxlamaları keçir. Baza sxemi `supabase/schema.sql` ilə qurulur.
