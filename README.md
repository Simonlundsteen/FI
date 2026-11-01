# FI – Financial Independence

A website about financial independence (FI), built with plain HTML, CSS and JavaScript. There's no build step.
Accounts and the blog use [Supabase](https://supabase.com), which has a free plan.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | A short introduction to FI and the 4% rule, plus five calculators: FI number, years to FI, savings rate, compound growth and Coast FI. |
| `tracker.html` | Net worth tracker with 38 milestones from 10,000 to 10,000,000. Each one shows the yearly cost it can pay for under the 4% rule. Also covers your own costs and your net worth history. |
| `dashboard.html` | An overview of your key numbers from the tracker and calculators. |
| `blog.html` | The public blog. `blog.html?post=<link-name>` shows a single post. |
| `blog-editor.html` | Write, upload (.md / .txt), edit, publish and delete posts, with image uploads. Admin only. |
| `login.html` | Log in, create an account, reset your password, log out. |

Without logging in, everything is saved in the browser. When logged in, the tracker, calculator values and
currency are saved to your account and sync across devices. Everyone who signs up only ever sees their own numbers.

## Setup (one time, about 10 minutes)

1. **Create a Supabase project** at https://supabase.com (the free plan is fine).
2. **Create the database:** in Supabase open **SQL Editor → New query**, paste everything from
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. **Connect the site:** in Supabase open **Project Settings → API** (or **Data API**) and copy the
   **Project URL** and the **anon / publishable** key into [`js/config.js`](js/config.js).
   The anon key is meant to be public. Never use the `service_role` / secret key.
4. **Allow the login emails to link back to the site:** in Supabase open **Authentication → URL Configuration**:
   - **Site URL:** `https://simonlundsteen.github.io/fi/`
   - **Redirect URLs:** add `https://simonlundsteen.github.io/fi/login.html`
5. **Make yourself admin** (so you can write blog posts): sign up on the site, confirm your email, then run
   this in the SQL Editor with your own email:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'YOUR_EMAIL_HERE'
   on conflict do nothing;
   ```
   Log out and in again, and a **Write a blog post** button appears on your account page and the blog.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. To test login locally, also add `http://localhost:8000/login.html` to the
redirect URLs in step 4.

## Structure

```
index.html, tracker.html, dashboard.html, blog.html, blog-editor.html, login.html
css/style.css          styles (light + dark mode, mobile)
js/config.js           Supabase URL + public key
js/common.js           currency, formatting, storage, shared math, chart
js/auth.js             login + syncing your numbers to your account
js/calculators.js      calculators
js/tracker.js          milestone tracker
js/dashboard.js        dashboard
js/blog.js             blog list + post
js/blog-editor.js      post editor
js/login.js            login page
js/vendor/             supabase-js, marked (Markdown), DOMPurify (keeps posts safe)
supabase/schema.sql    database tables + security rules
```

For education only, not financial advice.
