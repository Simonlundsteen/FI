/*
 * Supabase settings. Find them in your Supabase project:
 * Project Settings → API (or "Data API") → Project URL and the "anon" / "publishable" public key.
 *
 * The anon key is designed to be public: what each visitor can read and write
 * is enforced by the row level security rules in supabase/schema.sql.
 * NEVER put the "service_role" / secret key here.
 *
 * Leave these empty and the site still works, saving only in the browser.
 */
window.FI_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
