/* Blog: list of posts and single post view (blog.html?post=slug). */
(() => {
  const $ = (id) => document.getElementById(id);
  const render = (md) => DOMPurify.sanitize(marked.parse(md || ''));
  const slug = new URLSearchParams(location.search).get('post');

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const readingTime = (text) => Math.max(1, Math.round((text || '').split(/\s+/).filter(Boolean).length / 220));

  function status(text) {
    $('blog-status').hidden = !text;
    $('blog-status').textContent = text || '';
  }

  async function loadList() {
    const { data, error } = await FIAuth.client
      .from('posts')
      .select('id, slug, title, excerpt, cover_url, published, created_at')
      .order('created_at', { ascending: false });
    const list = $('post-list');
    list.innerHTML = '';
    if (error) {
      console.error(error);
      return status("Couldn't load posts right now. Please try again later.");
    }
    if (!data.length) return status('No posts yet. Check back soon!');
    status('');

    data.forEach((p) => {
      const a = document.createElement('a');
      a.className = 'post-card';
      a.href = `blog.html?post=${encodeURIComponent(p.slug)}`;

      const cover = document.createElement('div');
      cover.className = 'cover';
      if (p.cover_url) cover.style.backgroundImage = `url("${encodeURI(p.cover_url)}")`;
      else cover.hidden = true;

      const body = document.createElement('div');
      body.className = 'body';
      const meta = document.createElement('div');
      meta.className = 'post-meta';
      meta.textContent = fmtDate(p.created_at);
      if (!p.published) {
        const d = document.createElement('span');
        d.className = 'badge-pill draft';
        d.textContent = 'Draft';
        meta.appendChild(d);
      }
      const h = document.createElement('h2');
      h.textContent = p.title;
      const ex = document.createElement('p');
      ex.textContent = p.excerpt;
      body.append(meta, h, ex);
      a.append(cover, body);
      list.appendChild(a);
    });
  }

  async function loadPost() {
    $('blog-list-view').hidden = true;
    $('post-view').hidden = false;
    const { data: p, error } = await FIAuth.client.from('posts').select('*').eq('slug', slug).maybeSingle();
    if (error || !p) {
      $('post-title').textContent = error ? "Couldn't load this post" : 'Post not found';
      $('post-body').textContent = error ? 'Please try again later.' : 'It may have been moved or unpublished.';
      return;
    }
    document.title = `${p.title} – Freedom Number`;
    $('post-title').textContent = p.title;
    const meta = $('post-meta');
    meta.textContent = `${fmtDate(p.created_at)} · ${readingTime(p.content)} min read`;
    if (!p.published) {
      const d = document.createElement('span');
      d.className = 'badge-pill draft';
      d.textContent = 'Draft, only you can see this';
      meta.appendChild(d);
    }
    if (p.cover_url) {
      $('post-cover').src = p.cover_url;
      $('post-cover').hidden = false;
    }
    $('post-body').innerHTML = render(p.content);
    $('post-edit').href = `blog-editor.html?id=${encodeURIComponent(p.id)}`;
  }

  const load = () => (slug ? loadPost() : loadList());

  document.addEventListener('DOMContentLoaded', async () => {
    if (!FIAuth.enabled) {
      if (slug) {
        $('blog-list-view').hidden = false;
      }
      return status("The blog isn't connected yet. Add your Supabase settings to js/config.js (see the README).");
    }
    await FIAuth.ready; // so admins also see their drafts
    await load();
    // Logging in or out changes which posts are visible (drafts)
    FIAuth.onChange(({ event }) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load();
    });
  });
})();
