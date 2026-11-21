import { $, $$, icon, toast, showError, setLoading, isEmail } from './lib/dom.js';
import {
  signIn,
  signUp,
  resetPassword,
  resendConfirmation,
  friendlyError,
  isRateLimitError,
  isAlreadyRegisteredError
} from './lib/store.js';

let onAuthenticated = null;
let pendingEmail = '';

export function initAuth(handler) {
  onAuthenticated = handler;

  const yearEl = $('#auth-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  $$('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.authTab));
  });

  $$('[data-toggle-password]').forEach((btn) => {
    btn.innerHTML = icon('i-eye', 16);
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Şifrəni gizlət' : 'Şifrəni göstər');
      btn.innerHTML = icon(show ? 'i-eye-off' : 'i-eye', 16);
    });
  });

  const pw = $('#reg-password');
  if (pw) pw.addEventListener('input', () => updateMeter(pw.value));

  $('#login-form')?.addEventListener('submit', handleLogin);
  $('#register-form')?.addEventListener('submit', handleRegister);
  $('#reset-form')?.addEventListener('submit', handleReset);

  $('#forgot-password')?.addEventListener('click', () => {
    const emailInput = $('#login-email');
    switchTab('reset');
    const resetEmail = $('#reset-email');
    if (resetEmail && emailInput?.value) resetEmail.value = emailInput.value;
    setTimeout(() => resetEmail?.focus(), 50);
  });

  $('#resend-confirm')?.addEventListener('click', handleResendConfirmation);
}

export function showAuth() {
  $('#boot-screen').hidden = true;
  $('#fatal-screen').hidden = true;
  $('#app-shell').hidden = true;
  $('#auth-screen').hidden = false;
  document.title = 'Daxil ol — RahatHesab';
}

export function switchTab(tab) {
  const name = ['login', 'register', 'reset'].includes(tab) ? tab : 'login';

  $$('[data-auth-tab]').forEach((btn) => {
    if (!btn.classList.contains('segmented__btn')) return;
    const active = btn.dataset.authTab === name;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  $('#login-form').hidden = name !== 'login';
  $('#register-form').hidden = name !== 'register';
  $('#reset-form').hidden = name !== 'reset';

  $$('#login-error, #login-success, #register-error, #register-success, #reset-error, #reset-success').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });

  const focusMap = { login: '#login-email', register: '#reg-name', reset: '#reset-email' };
  setTimeout(() => $(focusMap[name])?.focus({ preventScroll: true }), 40);
}

function updateMeter(value) {
  const meter = $('#pw-meter');
  if (!meter) return;
  const v = String(value || '');
  let score = 0;
  if (v.length >= 8) score += 1;
  if (v.length >= 12) score += 1;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score += 1;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score += 1;
  meter.setAttribute('data-level', String(Math.min(4, v ? score : 0)));
}

async function handleResendConfirmation() {
  const btn = $('#resend-confirm');
  const email = (pendingEmail || $('#login-email')?.value || '').trim();

  if (!isEmail(email)) {
    toast('Təsdiq linkini hansı e-poçta göndərək? Əvvəlcə e-poçtu yazın.', 'error', 4500);
    $('#login-email')?.focus();
    return;
  }

  setLoading(btn, true);
  try {
    await resendConfirmation(email);
    toast(`Təsdiq məktubu ${email} ünvanına göndərildi.`, 'ok', 6000);
  } catch (err) {
    toast(friendlyError(err), 'error', 7000);
  } finally {
    setLoading(btn, false);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submit = $('#login-submit');
  const errorBox = $('#login-error');
  const successBox = $('#login-success');

  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;

  showError(errorBox, '');
  showError(successBox, '');

  if (!email) return showError(errorBox, 'E-poçt ünvanını daxil edin.');
  if (!isEmail(email)) return showError(errorBox, 'E-poçt ünvanı düzgün formatda deyil.');
  if (!password) return showError(errorBox, 'Şifrənizi daxil edin.');

  setLoading(submit, true);
  try {
    const session = await signIn(email, password);
    pendingEmail = '';
    form.reset();
    toast('Xoş gəlmisiniz!', 'ok');
    if (typeof onAuthenticated === 'function') await onAuthenticated(session);
  } catch (err) {
    if (/email not confirmed|not confirmed/i.test(String(err?.message || ''))) {
      pendingEmail = email;
      showError(successBox, 'E-poçt ünvanı təsdiqlənməyib. Poçtunuzu və spam qovluğunu yoxlayın, ya da «Yenidən göndər» düyməsini basın.');
    } else {
      showError(errorBox, friendlyError(err));
    }
  } finally {
    setLoading(submit, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const submit = $('#register-submit');
  const errorBox = $('#register-error');
  const successBox = $('#register-success');

  const fullName = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const password2 = $('#reg-password2').value;
  const terms = $('#reg-terms').checked;

  showError(errorBox, '');
  showError(successBox, '');

  if (fullName.length < 2) return showError(errorBox, 'Ad və soyadınızı tam yazın.');
  if (!isEmail(email)) return showError(errorBox, 'Düzgün e-poçt ünvanı daxil edin.');
  if (password.length < 8) return showError(errorBox, 'Şifrə ən azı 8 simvol olmalıdır.');
  if (password !== password2) return showError(errorBox, 'Şifrələr uyğun gəlmir.');
  if (!terms) return showError(errorBox, 'Davam etmək üçün razılıq qeydini işarələyin.');

  setLoading(submit, true);
  try {
    const result = await signUp(email, password, fullName);

    if (result?.session) {
      $('#register-form').reset();
      updateMeter('');
      toast('Hesab yaradıldı.', 'ok');
      if (typeof onAuthenticated === 'function') await onAuthenticated(result.session);
      return;
    }

    $('#register-form').reset();
    updateMeter('');
    pendingEmail = email;
    switchTab('login');
    const loginEmail = $('#login-email');
    if (loginEmail) loginEmail.value = email;
    showError($('#login-success'), `Hesab yaradıldı. ${email} ünvanına təsdiq linki göndərdik — linki açıb daxil olun.`);
    toast('Təsdiq linki göndərildi. Poçtunuzu yoxlayın.', 'info', 6000);
  } catch (err) {
    if (isRateLimitError(err) || isAlreadyRegisteredError(err)) {
      pendingEmail = email;
      switchTab('login');
      const loginEmail = $('#login-email');
      if (loginEmail) loginEmail.value = email;
      $('#login-password')?.focus();
      showError(
        $('#login-success'),
        isAlreadyRegisteredError(err)
          ? 'Bu e-poçt ilə hesab artıq mövcuddur — şifrənizi yazıb «Daxil ol» düyməsini basın.'
          : 'E-poçt göndərmə limiti dolub, amma hesabınız yaranmış ola bilər. Şifrənizi yazıb daxil olmağı yoxlayın.'
      );
    } else {
      showError(errorBox, friendlyError(err));
    }
  } finally {
    setLoading(submit, false);
  }
}

async function handleReset(event) {
  event.preventDefault();

  const submit = $('#reset-submit');
  const errorBox = $('#reset-error');
  const successBox = $('#reset-success');
  const email = $('#reset-email').value.trim();

  showError(errorBox, '');
  showError(successBox, '');

  if (!isEmail(email)) return showError(errorBox, 'Düzgün e-poçt ünvanı daxil edin.');

  setLoading(submit, true);
  try {
    await resetPassword(email);
    showError(successBox, `Bərpa linki ${email} ünvanına göndərildi.`);
  } catch (err) {
    showError(errorBox, friendlyError(err));
  } finally {
    setLoading(submit, false);
  }
}
