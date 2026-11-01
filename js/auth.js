/*
 * Login + account sync via Supabase.
 * When logged in, the tracker, calculator inputs and currency are saved to your
 * account and loaded on any device. Without Supabase configured (js/config.js)
 * the site keeps working with browser-only storage.
 */
const FIAuth = (() => {
  const cfg = window.FI_CONFIG || {};
  const enabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = enabled ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const KEYS = { tracker: 'fi.tracker', calculators: 'fi.calc', currency: 'fi.currency' };
  const SYNCED = Object.values(KEYS);

  let user = null;
  let isAdmin = false;
  let applyingRemote = false;
  let pushTimer = null;
  let syncState = 'idle'; // idle | saving | saved | error
  const listeners = [];

  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  if (!enabled) resolveReady();

  /* ---------- UI helpers ---------- */
  function updateNav() {
    document.querySelectorAll('[data-auth-link]').forEach((a) => {
      a.textContent = user ? 'My account' : 'Log in';
    });
    document.querySelectorAll('[data-admin-only]').forEach((el) => (el.hidden = !isAdmin));
    document.querySelectorAll('[data-user-only]').forEach((el) => (el.hidden = !user));
    document.querySelectorAll('[data-guest-only]').forEach((el) => (el.hidden = Boolean(user)));
    document.querySelectorAll('[data-sync-status]').forEach((el) => {
      el.textContent = !user
        ? ''
        : { idle: 'Synced to your account', saving: 'Saving…', saved: 'Saved to your account', error: 'Not saved, retrying on next change' }[syncState];
    });
  }

  function emit(event) {
    updateNav();
    listeners.forEach((cb) => cb({ user, isAdmin, event }));
  }

  function setSync(state) {
    syncState = state;
    updateNav();
  }

  /* ---------- Sync ---------- */
  function snapshot() {
    return {
      tracker: FI.store.get(KEYS.tracker, {}),
      calculators: FI.store.get(KEYS.calculators, {}),
      currency: FI.getCurrency(),
    };
  }

  async function push() {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (!user) return;
    setSync('saving');
    const { error } = await client.from('user_data').upsert({ user_id: user.id, ...snapshot() });
    if (error) {
      console.error(error);
      setSync('error');
      FI.toast('Could not save to your account. Your numbers are still saved in this browser.');
    } else {
      setSync('saved');
    }
  }

  async function pull() {
    const { data, error } = await client
      .from('user_data')
      .select('tracker, calculators, currency')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error(error);
      FI.toast('Could not load your saved numbers');
      return;
    }
    if (!data) {
      // First login: keep what's already in this browser and save it to the account.
      await push();
      return;
    }
    applyingRemote = true;
    FI.store.set(KEYS.tracker, data.tracker || {}, { silent: true });
    FI.store.set(KEYS.calculators, data.calculators || {}, { silent: true });
    if (data.currency) FI.setCurrency(data.currency, { silent: true });
    applyingRemote = false;
    setSync('idle');
    document.dispatchEvent(new CustomEvent('fi:synced'));
  }

  document.addEventListener('fi:storechange', (e) => {
    if (!user || applyingRemote || !SYNCED.includes(e.detail)) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 800);
  });

  // Don't lose the last change when the tab is closed or hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pushTimer) push();
  });

  /* ---------- Session ---------- */
  async function handleSession(event, session) {
    const next = session ? session.user : null;
    const changed = (next && next.id) !== (user && user.id);
    user = next;
    try {
      if (changed) {
        isAdmin = false;
        if (user) {
          const { data } = await client.rpc('is_admin');
          isAdmin = data === true;
          await pull();
        }
      }
    } catch (err) {
      console.error(err);
      FI.toast("Couldn't reach your account right now. Your numbers are still saved in this browser.");
    } finally {
      emit(event);
      resolveReady(); // never leave pages waiting
    }
  }

  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      // Supabase recommends not awaiting other calls inside this callback
      setTimeout(() => handleSession(event, session), 0);
    });
  }

  document.addEventListener('DOMContentLoaded', updateNav);

  /* ---------- Public API ---------- */
  const redirectUrl = () => new URL('login.html', location.href).href;

  return {
    enabled,
    client,
    ready,
    get user() {
      return user;
    },
    get isAdmin() {
      return isAdmin;
    },
    onChange(cb) {
      listeners.push(cb);
    },
    signUp: (email, password) =>
      client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } }),
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    resetPassword: (email) => client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }),
    updatePassword: (password) => client.auth.updateUser({ password }),
    async signOut() {
      if (pushTimer) await push();
      await client.auth.signOut();
      // Remove your numbers from this browser; they're safe in your account.
      FI.store.remove(KEYS.tracker);
      FI.store.remove(KEYS.calculators);
      document.dispatchEvent(new CustomEvent('fi:synced'));
    },
  };
})();
