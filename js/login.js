/* Login page: log in, sign up, reset password, account view. */
(() => {
  const $ = (id) => document.getElementById(id);
  let mode = 'login'; // login | signup | forgot
  let recovering = /type=recovery/.test(location.hash);

  const views = ['auth-off', 'auth-guest', 'auth-recovery', 'auth-user'];
  function show(id) {
    views.forEach((v) => ($(v).hidden = v !== id));
  }

  function msg(el, text, kind = 'error') {
    el.textContent = text;
    el.className = `form-msg ${kind}`;
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll('#auth-guest .tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    const pw = $('auth-password');
    $('pw-field').hidden = mode === 'forgot';
    pw.required = mode !== 'forgot';
    pw.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('pw-hint').textContent = mode === 'signup' ? 'min. 8 characters' : '';
    $('forgot-btn').textContent = mode === 'forgot' ? 'Back to log in' : 'Forgot your password?';
    $('auth-title').textContent = { login: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' }[mode];
    $('auth-intro').textContent = {
      login: 'Log in to save your numbers to your account and use them on any device.',
      signup: "It's free. Anything you've already entered in this browser will be saved to your new account.",
      forgot: "Enter your email and we'll send you a link to choose a new password.",
    }[mode];
    $('auth-submit').textContent = { login: 'Log in', signup: 'Create account', forgot: 'Send reset link' }[mode];
    msg($('auth-msg'), '');
  }

  function friendlyError(error) {
    const m = (error && error.message) || 'Something went wrong. Please try again.';
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
    if (/already registered/i.test(m)) return 'An account with this email already exists. Try logging in.';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
    if (/failed to fetch|network/i.test(m)) return "Couldn't reach the server. Check your connection.";
    return m;
  }

  async function submit(e) {
    e.preventDefault();
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    const out = $('auth-msg');
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg(out, 'Enter a valid email address.');
    if (mode !== 'forgot' && password.length < (mode === 'signup' ? 8 : 1)) {
      return msg(out, mode === 'signup' ? 'Use at least 8 characters for your password.' : 'Enter your password.');
    }

    const btn = $('auth-submit');
    btn.disabled = true;
    try {
      if (mode === 'login') {
        const { error } = await FIAuth.signIn(email, password);
        if (error) return msg(out, friendlyError(error));
        msg(out, 'Logged in. Loading your numbers…', 'ok');
      } else if (mode === 'signup') {
        const { data, error } = await FIAuth.signUp(email, password);
        if (error) return msg(out, friendlyError(error));
        // Supabase hides whether an email is taken: an existing user comes back with no identities
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return msg(out, 'An account with this email already exists. Try logging in.');
        }
        if (!data.session) {
          msg(out, `Almost done! We sent a confirmation link to ${email}. Click it, then log in here.`, 'ok');
        } else {
          msg(out, 'Account created. Saving your numbers…', 'ok');
        }
      } else {
        const { error } = await FIAuth.resetPassword(email);
        if (error) return msg(out, friendlyError(error));
        msg(out, `If ${email} has an account, a reset link is on its way.`, 'ok');
      }
    } catch (err) {
      msg(out, friendlyError(err));
    } finally {
      btn.disabled = false;
    }
  }

  function render({ user, isAdmin, event } = {}) {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (recovering && user) return show('auth-recovery');
    if (!user) return show('auth-guest');
    show('auth-user');
    $('user-email').textContent = user.email;
    $('admin-badge').hidden = !isAdmin;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!FIAuth.enabled) return show('auth-off');

    document.querySelectorAll('#auth-guest .tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('forgot-btn').addEventListener('click', () => setMode(mode === 'forgot' ? 'login' : 'forgot'));
    $('auth-form').addEventListener('submit', submit);

    $('recovery-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('new-password').value;
      const out = $('recovery-msg');
      if (pw.length < 8) return msg(out, 'Use at least 8 characters.');
      const { error } = await FIAuth.updatePassword(pw);
      if (error) return msg(out, friendlyError(error));
      recovering = false;
      history.replaceState(null, '', location.pathname);
      FI.toast('Password updated');
      render({ user: FIAuth.user, isAdmin: FIAuth.isAdmin });
    });

    $('signout-btn').addEventListener('click', async () => {
      $('signout-btn').disabled = true;
      await FIAuth.signOut();
      $('signout-btn').disabled = false;
      setMode('login');
      FI.toast('Logged out');
    });

    setMode('login');
    FIAuth.onChange(render);
    await FIAuth.ready;
    render({ user: FIAuth.user, isAdmin: FIAuth.isAdmin });
  });
})();
