const env = window.__RAHATHESAB_ENV__ || {};

const SUPABASE_URL = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');

function resolvePublicKey() {
  for (const raw of [env.SUPABASE_PUBLISHABLE_KEY, env.SUPABASE_ANON_KEY]) {
    const key = String(raw || '').trim();
    if (!key) continue;
    if (key.startsWith('sb_secret_') || /"role"\s*:\s*"service_role"/.test(key)) {
      return { key: '', invalidSecret: true };
    }
    return { key, invalidSecret: false };
  }
  return { key: '', invalidSecret: false };
}

const resolved = resolvePublicKey();
const SUPABASE_PUBLIC_KEY = resolved.key;

let client = null;

export function getClient() {
  if (client) return client;
  if (resolved.invalidSecret) throw new Error('SECRET_KEY_IN_FRONTEND');
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) throw new Error('MISSING_CONFIG');
  if (!window.supabase || typeof window.supabase.createClient !== 'function') throw new Error('LIBRARY_MISSING');
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'rahathesab.auth'
    }
  });
  return client;
}

const ERROR_MAP = {
  MISSING_CONFIG: 'Sistem konfiqurasiyası tam deyil. Dəstək ilə əlaqə saxlayın.',
  LIBRARY_MISSING: 'Səhifə tam yüklənmədi. Yeniləyin.',
  SECRET_KEY_IN_FRONTEND: 'Sistem konfiqurasiyası səhvdir.',
  PGRST301: 'Sessiyanın vaxtı bitdi. Yenidən daxil olun.',
  '23505': 'Bu məlumat artıq mövcuddur.',
  '23503': 'Əlaqəli qeyd tapılmadı.',
  '23514': 'Daxil edilən dəyər qaydalara uyğun deyil.',
  '42501': 'Bu əməliyyat üçün icazəniz yoxdur.',
  '42P01': 'Sistem hələ qurulmayıb.',
  '42883': 'Sistem yeniləməsi tələb olunur.',
  INVALID_CODE: 'Kod yanlışdır. Kodu sahibkarınızdan yenidən yoxlayın.',
  CODE_ALREADY_USED: 'Bu kod artıq başqa hesaba bağlanıb.',
  CODE_GENERATION_FAILED: 'Kod yaradıla bilmədi. Yenidən cəhd edin.',
  EMPLOYEE_NOT_FOUND: 'İşçi tapılmadı. Səhifəni yeniləyin.',
  FORBIDDEN: 'Bu əməliyyat üçün icazəniz yoxdur.',
  NOT_AUTHENTICATED: 'Əvvəlcə hesabınıza daxil olun.'
};

export function isRateLimitError(error) {
  const code = String(error?.code || error?.error_code || error?.status || '');
  const msg = String(error?.message || error?.msg || '');
  return (
    /over_email_send_rate_limit|over_request_rate_limit|email_rate_limit/i.test(code) ||
    /email rate limit exceeded|rate limit|too many requests/i.test(msg) ||
    Number(error?.status) === 429
  );
}

export function isAlreadyRegisteredError(error) {
  return /already registered|already been registered|user already exists/i.test(String(error?.message || error?.msg || ''));
}

export function isMissingTableError(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error?.msg || '');
  return code === '42P01' || code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(msg);
}

export function friendlyError(error) {
  if (!error) return 'Naməlum xəta baş verdi.';

  const code = String(error.code || error.status || '');
  const errorCode = String(error.error_code || '');
  const rawMsg = String(error.message || error.msg || '');

  if (ERROR_MAP[code]) return ERROR_MAP[code];
  if (ERROR_MAP[errorCode]) return ERROR_MAP[errorCode];
  if (ERROR_MAP[rawMsg]) return ERROR_MAP[rawMsg];

  if (isMissingTableError(error)) return 'Sistem hələ qurulmayıb. Quraşdırma tamamlanmayıb.';

  if (isRateLimitError(error)) {
    return 'E-poçt göndərmə limiti dolub. Hesabınız yaranmış ola bilər — əvvəlcə daxil olmağı yoxlayın, alınmasa bir saat sonra yenidən cəhd edin.';
  }
  if (isAlreadyRegisteredError(error)) return 'Bu e-poçt ilə hesab artıq mövcuddur. Daxil olun.';

  if (/invalid login credentials/i.test(rawMsg)) return 'E-poçt və ya şifrə yanlışdır.';
  if (/email not confirmed/i.test(rawMsg)) return 'E-poçt ünvanı təsdiqlənməyib. Poçtunuzu yoxlayın.';
  if (/password should be at least|weak password/i.test(rawMsg)) return 'Şifrə ən azı 8 simvol olmalıdır.';
  if (/new password should be different|same_password/i.test(rawMsg)) return 'Yeni şifrə köhnədən fərqli olmalıdır.';
  if (/signups not allowed|signup is disabled/i.test(rawMsg)) return 'Qeydiyyat müvəqqəti bağlıdır.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(rawMsg)) return 'Şəbəkə xətası. İnternet bağlantısını yoxlayın.';
  if (/duplicate key value/i.test(rawMsg)) return 'Bu məlumat artıq mövcuddur.';
  if (/row-level security/i.test(rawMsg)) return 'Bu əməliyyat üçün icazəniz yoxdur.';
  if (/JWT|token/i.test(rawMsg)) return 'Sessiyanın vaxtı bitdi. Yenidən daxil olun.';
  return rawMsg || 'Xəta baş verdi.';
}

export async function getSession() {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export function onAuthChange(cb) {
  const { data } = getClient().auth.onAuthStateChange((event, session) => cb(event, session));
  return () => {
    try {
      data.subscription.unsubscribe();
    } catch {
      /* abunəlik artıq bağlıdır */
    }
  };
}

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password
  });
  if (error) throw error;
  if (!data?.session) throw new Error('Sessiya yaradılmadı. Yenidən cəhd edin.');
  return data.session;
}

async function silentSignIn(sb, email, password) {
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return error || !data?.session ? null : data.session;
  } catch {
    return null;
  }
}

export async function signUp(email, password, fullName) {
  const sb = getClient();
  const cleanEmail = String(email).trim().toLowerCase();

  let data = null;
  let error = null;
  try {
    const res = await sb.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: String(fullName || '').trim() },
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }

  if (data?.session) return { session: data.session, user: data.user, needsConfirmation: false };

  if (error) {
    const retry = await silentSignIn(sb, cleanEmail, password);
    if (retry) return { session: retry, user: retry.user, needsConfirmation: false };
    throw error;
  }

  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    const retry = await silentSignIn(sb, cleanEmail, password);
    if (retry) return { session: retry, user: retry.user, needsConfirmation: false };
    return { session: null, user: data.user, needsConfirmation: true, maybeExisting: true };
  }

  return { session: null, user: data?.user || null, needsConfirmation: true };
}

export async function resendConfirmation(email) {
  const { error } = await getClient().auth.resend({
    type: 'signup',
    email: String(email).trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw error;
}

export async function updateProfile({ fullName, phone }) {
  const sb = getClient();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı.');

  const patch = { id: uid };
  if (fullName !== undefined) patch.full_name = String(fullName || '').trim();
  if (phone !== undefined) patch.phone = clean(phone);

  const { error } = await sb.from('profiles').upsert(patch, { onConflict: 'id' });
  if (error) throw error;

  if (fullName !== undefined) await sb.auth.updateUser({ data: { full_name: String(fullName || '').trim() } });
}

export async function changePassword(newPassword) {
  const { error } = await getClient().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function loadContext(session) {
  const sb = getClient();
  const user = session?.user;
  if (!user) throw new Error('Sessiya tapılmadı.');

  const [profileRes, empRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    sb.from('employees').select('*').eq('user_id', user.id)
  ]);

  let profile = profileRes.data || null;
  if (!profile) {
    await ensureProfile(user.user_metadata?.full_name || null);
    const again = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    profile = again.data || null;
  }

  const myEmployees = empRes.error ? [] : empRes.data || [];

  const ownedRes = await sb
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });
  const ownedBusinesses = ownedRes.error ? [] : ownedRes.data || [];

  let memberBusinesses = [];
  if (myEmployees.length) {
    const ids = [...new Set(myEmployees.map((e) => e.business_id))];
    const { data } = await sb
      .from('businesses')
      .select('id,name,currency,phone,email,address,owner_id,pay_day')
      .in('id', ids);
    memberBusinesses = (data || []).map((b) => ({
      ...b,
      employee: myEmployees.find((e) => e.business_id === b.id) || null
    }));
  }

  return { user, profile, ownedBusinesses, memberBusinesses, myEmployees };
}

export async function ensureProfile(fullName = null) {
  try {
    const { data, error } = await getClient().rpc('ensure_my_profile', {
      p_full_name: fullName === null ? null : String(fullName)
    });
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function claimEmployeeByCode(code) {
  const { data, error } = await getClient().rpc('claim_employee_by_code', {
    p_code: String(code || '').trim().toUpperCase()
  });
  if (error) throw error;
  return data;
}

export async function claimEmployeeAccount() {
  try {
    const { data, error } = await getClient().rpc('claim_employee_account');
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function createBusiness(payload) {
  const sb = getClient();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı.');

  const name = String(payload.name || '').trim();
  if (name.length < 2) throw new Error('Biznes adını daxil edin.');

  const row = {
    owner_id: uid,
    name,
    legal_name: clean(payload.legal_name),
    phone: clean(payload.phone),
    email: clean(payload.email),
    address: clean(payload.address),
    currency: payload.currency || 'AZN',
    pay_day: clampPayDay(payload.pay_day)
  };

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newUuid();
    const { error } = await sb.from('businesses').insert({ id, ...row });

    if (error) {
      lastError = error;
      if (/23505|duplicate key/i.test(String(error.code || error.message || ''))) continue;
      throw error;
    }

    for (let i = 0; i < 4; i++) {
      const { data } = await sb.from('businesses').select('*').eq('id', id).maybeSingle();
      if (data) return data;
      await sleep(120);
    }
    throw new Error('Biznes yaradıldı, amma siyahıda görünmür. Səhifəni yeniləyin.');
  }

  throw lastError || new Error('Biznes yaradıla bilmədi. Yenidən cəhd edin.');
}

function newUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function updateBusiness(id, payload) {
  const patch = {};
  if (payload.name !== undefined) patch.name = String(payload.name || '').trim();
  if (payload.legal_name !== undefined) patch.legal_name = clean(payload.legal_name);
  if (payload.phone !== undefined) patch.phone = clean(payload.phone);
  if (payload.email !== undefined) patch.email = clean(payload.email);
  if (payload.address !== undefined) patch.address = clean(payload.address);
  if (payload.currency !== undefined) patch.currency = payload.currency || 'AZN';
  if (payload.pay_day !== undefined) patch.pay_day = clampPayDay(payload.pay_day);

  const { data, error } = await getClient().from('businesses').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBusiness(id) {
  const { error } = await getClient().from('businesses').delete().eq('id', id);
  if (error) throw error;
}

export async function rotateJoinCode(businessId) {
  const { data, error } = await getClient().rpc('rotate_join_code', { p_business_id: businessId });
  if (error) throw error;
  return data;
}

export async function listEmployees(businessId) {
  const { data, error } = await getClient()
    .from('employees')
    .select('*')
    .eq('business_id', businessId)
    .order('is_active', { ascending: false })
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listBalances(businessId) {
  let query = getClient().from('v_employee_balances').select('*');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createEmployee(businessId, payload) {
  const { data, error } = await getClient()
    .from('employees')
    .insert({
      business_id: businessId,
      full_name: String(payload.full_name || '').trim(),
      position: clean(payload.position),
      monthly_salary: Number(payload.monthly_salary) || 0,
      email: normalizeEmail(payload.email),
      phone: clean(payload.phone),
      hire_date: payload.hire_date || null,
      is_active: payload.is_active !== false,
      notes: clean(payload.notes)
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id, payload) {
  const patch = {};
  if (payload.full_name !== undefined) patch.full_name = String(payload.full_name || '').trim();
  if (payload.position !== undefined) patch.position = clean(payload.position);
  if (payload.monthly_salary !== undefined) patch.monthly_salary = Number(payload.monthly_salary) || 0;
  if (payload.email !== undefined) patch.email = normalizeEmail(payload.email);
  if (payload.phone !== undefined) patch.phone = clean(payload.phone);
  if (payload.hire_date !== undefined) patch.hire_date = payload.hire_date || null;
  if (payload.is_active !== undefined) patch.is_active = !!payload.is_active;
  if (payload.notes !== undefined) patch.notes = clean(payload.notes);

  const { data, error } = await getClient().from('employees').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setEmployeeActive(id, isActive) {
  const { error } = await getClient().from('employees').update({ is_active: !!isActive }).eq('id', id);
  if (error) throw error;
}

export async function regenerateEmployeeCode(employeeId) {
  const sb = getClient();
  try {
    const { data, error } = await sb.rpc('regenerate_employee_code', { p_employee_id: employeeId });
    if (!error && typeof data === 'string' && data.length >= 4) return data;
  } catch {
    /* funksiya yoxdursa yerli üsula keçilir */
  }

  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await sb
      .from('employees')
      .update({ access_code: makeCode(8) })
      .eq('id', employeeId)
      .select('id,access_code')
      .single();
    if (!error && data?.access_code) return data.access_code;
    lastError = error;
    if (!/23505|duplicate key/i.test(String(error?.code || error?.message || ''))) break;
  }
  throw lastError || new Error('CODE_GENERATION_FAILED');
}

export async function deleteEmployee(id) {
  const { error } = await getClient().from('employees').delete().eq('id', id);
  if (error) throw error;
}

export async function updateMyContact(phone) {
  const { error } = await getClient().rpc('update_my_contact', { p_phone: String(phone || '') });
  if (error) throw error;
}

export async function listPayments({ businessId = null, employeeId = null, limit = 500 } = {}) {
  let query = getClient()
    .from('salary_payments')
    .select('*, employees!inner(id, full_name, position)')
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (businessId) query = query.eq('business_id', businessId);
  if (employeeId) query = query.eq('employee_id', employeeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPayment(payload) {
  const { data, error } = await getClient()
    .from('salary_payments')
    .insert({
      employee_id: payload.employee_id,
      kind: payload.kind || 'salary',
      amount: Number(payload.amount) || 0,
      paid_at: payload.paid_at || todayISOString(),
      period: payload.period || null,
      method: payload.method || 'cash',
      note: clean(payload.note)
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPaymentsBulk(rows) {
  const payload = rows.map((r) => ({
    employee_id: r.employee_id,
    kind: r.kind || 'salary',
    amount: Number(r.amount) || 0,
    paid_at: r.paid_at || todayISOString(),
    period: r.period || null,
    method: r.method || 'cash',
    note: clean(r.note)
  }));
  const { data, error } = await getClient().from('salary_payments').insert(payload).select();
  if (error) throw error;
  return data || [];
}

export async function updatePayment(id, payload) {
  const { data, error } = await getClient()
    .from('salary_payments')
    .update({
      employee_id: payload.employee_id,
      kind: payload.kind || 'salary',
      amount: Number(payload.amount) || 0,
      paid_at: payload.paid_at,
      period: payload.period || null,
      method: payload.method || 'cash',
      note: clean(payload.note)
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePayment(id) {
  const { error } = await getClient().from('salary_payments').delete().eq('id', id);
  if (error) throw error;
}

export async function listWorkLogs({ businessId = null, employeeId = null, limit = 500 } = {}) {
  let query = getClient()
    .from('work_logs')
    .select('*, employees!inner(id, full_name)')
    .order('work_date', { ascending: false })
    .limit(limit);

  if (businessId) query = query.eq('business_id', businessId);
  if (employeeId) query = query.eq('employee_id', employeeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertWorkLog(payload) {
  const sb = getClient();
  const employeeId = payload.employee_id;
  const workDate = payload.work_date;
  if (!employeeId || !workDate) throw new Error('İşçi və tarix mütləqdir.');

  const row = {
    hours: Number(payload.hours) || 0,
    overtime: Number(payload.overtime) || 0,
    note: clean(payload.note)
  };

  const existing = await readWorkLog(sb, employeeId, workDate);

  if (existing) {
    const { error } = await sb
      .from('work_logs')
      .update(row)
      .eq('employee_id', employeeId)
      .eq('work_date', workDate);
    if (error) throw error;
    const updated = await readWorkLog(sb, employeeId, workDate);
    if (updated) return updated;
    throw new Error('Qeyd yenilənmədi. Yenidən cəhd edin.');
  }

  const ins = await sb.from('work_logs').insert({ employee_id: employeeId, work_date: workDate, ...row });
  if (ins.error) {
    if (/23505|duplicate key/i.test(String(ins.error.code || ins.error.message || ''))) {
      const { error } = await sb
        .from('work_logs')
        .update(row)
        .eq('employee_id', employeeId)
        .eq('work_date', workDate);
      if (error) throw error;
      const again = await readWorkLog(sb, employeeId, workDate);
      if (again) return again;
    }
    throw ins.error;
  }

  const created = await readWorkLog(sb, employeeId, workDate);
  if (created) return created;
  throw new Error('Qeyd yazıldı. Səhifəni yeniləyin.');
}

async function readWorkLog(sb, employeeId, workDate) {
  const { data, error } = await sb
    .from('work_logs')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export async function deleteWorkLog(id) {
  const { data, error } = await getClient().from('work_logs').delete().eq('id', id).select('id');
  if (error) throw error;
  if (Array.isArray(data) && data.length === 0) throw new Error('Qeyd silinmədi — icazə yoxdur.');
}

export async function listLeaves({ businessId = null, employeeId = null, limit = 200 } = {}) {
  let query = getClient()
    .from('leave_requests')
    .select('*, employees!inner(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (businessId) query = query.eq('business_id', businessId);
  if (employeeId) query = query.eq('employee_id', employeeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createLeaveRequest(payload) {
  const { data, error } = await getClient()
    .from('leave_requests')
    .insert({
      employee_id: payload.employee_id,
      kind: payload.kind || 'vacation',
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: clean(payload.reason),
      status: 'pending'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function decideLeave(id, status) {
  const { data, error } = await getClient()
    .from('leave_requests')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLeave(id) {
  const { data, error } = await getClient().from('leave_requests').delete().eq('id', id).select('id');
  if (error) throw error;
  if (Array.isArray(data) && data.length === 0) throw new Error('İstək silinmədi — icazə yoxdur.');
}

export async function listNotes(businessId) {
  const { data, error } = await getClient()
    .from('notes')
    .select('*')
    .eq('business_id', businessId)
    .order('is_done', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createNote(businessId, payload) {
  const { data, error } = await getClient()
    .from('notes')
    .insert({
      business_id: businessId,
      title: String(payload.title || '').trim(),
      body: clean(payload.body),
      due_date: payload.due_date || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleNote(id, isDone) {
  const { error } = await getClient().from('notes').update({ is_done: !!isDone }).eq('id', id);
  if (error) throw error;
}

export async function updateNote(id, payload) {
  const { error } = await getClient()
    .from('notes')
    .update({
      title: String(payload.title || '').trim(),
      body: clean(payload.body),
      due_date: payload.due_date || null
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id) {
  const { error } = await getClient().from('notes').delete().eq('id', id);
  if (error) throw error;
}

export async function listActivity(businessId, limit = 12) {
  const { data, error } = await getClient()
    .from('activity_log')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function logActivity(businessId, action, detail = null, actorName = null) {
  try {
    await getClient().from('activity_log').insert({
      business_id: businessId,
      action: String(action || '').slice(0, 120),
      detail: detail ? String(detail).slice(0, 300) : null,
      actor_name: actorName
    });
  } catch {
    /* jurnal kritik deyil */
  }
}

export function clean(value) {
  const s = value === null || value === undefined ? '' : String(value).trim();
  return s === '' ? null : s;
}

function normalizeEmail(value) {
  const s = String(value || '').trim().toLowerCase();
  return s === '' ? null : s;
}

function clampPayDay(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(28, Math.max(1, n)) : 5;
}

function todayISOString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function makeCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(len);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(arr);
  else for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 4294967296);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function summarize(balances, employees) {
  const list = Array.isArray(balances) ? balances : [];
  const active = (employees || []).filter((e) => e.is_active);
  const activeIds = new Set(active.map((e) => e.id));

  const totals = {
    monthlyFund: active.reduce((sum, e) => sum + Number(e.monthly_salary || 0), 0),
    accrued: 0,
    paid: 0,
    balance: 0,
    advance: 0,
    salaryPaid: 0,
    bonus: 0,
    deduction: 0,
    paidThisMonth: 0
  };

  for (const row of list) {
    if (!activeIds.has(row.id)) continue;
    totals.accrued += Number(row.accrued_total || 0);
    totals.paid += Number(row.total_paid || 0);
    totals.balance += Number(row.balance || 0);
    totals.advance += Number(row.total_advance || 0);
    totals.salaryPaid += Number(row.total_salary_paid || 0);
    totals.bonus += Number(row.total_bonus || 0);
    totals.deduction += Number(row.total_deduction || 0);
    totals.paidThisMonth += Number(row.paid_this_month || 0);
  }

  return {
    ...totals,
    employeeCount: active.length,
    totalCount: (employees || []).length,
    inactiveCount: Math.max(0, (employees || []).length - active.length),
    payoutRate: totals.accrued > 0 ? Math.min(100, (totals.paid / totals.accrued) * 100) : 0
  };
}

