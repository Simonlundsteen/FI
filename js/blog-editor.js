/* Blog editor (admins only). blog-editor.html?id=<uuid> edits an existing post. */
(() => {
  const $ = (id) => document.getElementById(id);
  const render = (md) => DOMPurify.sanitize(marked.parse(md || ''));
  const DRAFT_KEY = 'fi.editorDraft';
  const MAX_IMAGE_MB = 5;

  let postId = new URLSearchParams(location.search).get('id');
  let slugTouched = Boolean(postId);
  let dirty = false;

  /* ---------- Helpers ---------- */
  function msg(text, kind = 'error') {
    $('ed-msg').textContent = text;
    $('ed-msg').className = `form-msg ${kind}`;
  }

  function slugify(s) {
    return s
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  let previewFrame = null;
  function updatePreview() {
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = null;
      const title = $('ed-title').value.trim();
      $('ed-preview').innerHTML = render($('ed-content').value);
      if (title) {
        const h = document.createElement('h1');
        h.style.marginTop = '0';
        h.textContent = title;
        $('ed-preview').prepend(h);
      }
    });
  }

  function updateCoverPreview() {
    const url = $('ed-cover-url').value.trim();
    $('ed-cover-preview').hidden = !url;
    if (url) $('ed-cover-preview').src = url;
  }

  function fields() {
    return {
      title: $('ed-title').value.trim(),
      slug: $('ed-slug').value.trim(),
      excerpt: $('ed-excerpt').value.trim(),
      cover_url: $('ed-cover-url').value.trim() || null,
      content: $('ed-content').value,
      published: $('ed-published').checked,
    };
  }

  function fill(p) {
    $('ed-title').value = p.title || '';
    $('ed-slug').value = p.slug || '';
    $('ed-excerpt').value = p.excerpt || '';
    $('ed-cover-url').value = p.cover_url || '';
    $('ed-content').value = p.content || '';
    $('ed-published').checked = Boolean(p.published);
    updateCoverPreview();
    updatePreview();
  }

  function setExisting(p) {
    postId = p.id;
    $('ed-heading').textContent = 'Edit post';
    $('ed-delete').hidden = false;
    $('ed-view').hidden = false;
    $('ed-view').href = `blog.html?post=${encodeURIComponent(p.slug)}`;
    history.replaceState(null, '', `blog-editor.html?id=${encodeURIComponent(p.id)}`);
  }

  /* ---------- Local backup of unsaved new posts ---------- */
  let backupTimer;
  function markDirty() {
    dirty = true;
    if (postId) return;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => FI.store.set(DRAFT_KEY, fields(), { silent: true }), 500);
  }

  /* ---------- Markdown toolbar ---------- */
  function wrapSelection(before, after = before, placeholder = 'text') {
    const ta = $('ed-content');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  function prefixLines(prefix) {
    const ta = $('ed-content');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e) || '';
    const replaced = block.split('\n').map((l) => prefix + l).join('\n');
    ta.setRangeText(replaced, lineStart, e, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  function insertAtCursor(text) {
    const ta = $('ed-content');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const pre = s > 0 && value[s - 1] !== '\n' ? '\n\n' : '';
    ta.setRangeText(pre + text + '\n', s, e, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  const TOOLS = {
    h2: () => prefixLines('## '),
    bold: () => wrapSelection('**'),
    italic: () => wrapSelection('*'),
    link: () => wrapSelection('[', '](https://)', 'link text'),
    quote: () => prefixLines('> '),
    list: () => prefixLines('- '),
  };

  /* ---------- Image upload ---------- */
  async function uploadImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Images must be under ${MAX_IMAGE_MB} MB.`);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = FIAuth.client.storage.from('blog-images');
    const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async function withUpload(input, onUrl) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    msg('Uploading image…', 'ok');
    try {
      onUrl(await uploadImage(file), file);
      msg('Image uploaded', 'ok');
    } catch (err) {
      msg(err.message || 'Upload failed.');
    }
  }

  /* ---------- Save / delete ---------- */
  async function save(e) {
    e.preventDefault();
    const f = fields();
    if (!f.title) return msg('Give your post a title.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) return msg('The link name can only use a–z, 0–9 and dashes.');
    if (!f.content.trim()) return msg('Write something in your post first.');

    const btn = $('ed-save');
    btn.disabled = true;
    msg('Saving…', 'ok');
    const q = FIAuth.client.from('posts');
    const { data, error } = postId
      ? await q.update(f).eq('id', postId).select().single()
      : await q.insert(f).select().single();
    btn.disabled = false;

    if (error) {
      if (error.code !== '23505') console.error(error);
      if (error.code === '23505') return msg('Another post already uses this link name. Change it and save again.');
      return msg(`Couldn't save: ${error.message}`);
    }
    dirty = false;
    FI.store.remove(DRAFT_KEY);
    setExisting(data);
    msg(data.published ? 'Saved and published ✓' : 'Saved as draft ✓ (only you can see it)', 'ok');
  }

  async function del() {
    if (!postId || !confirm('Delete this post permanently?')) return;
    const { error } = await FIAuth.client.from('posts').delete().eq('id', postId);
    if (error) return msg(`Couldn't delete: ${error.message}`);
    dirty = false;
    location.href = 'blog.html';
  }

  /* ---------- Startup ---------- */
  function gate(html) {
    $('ed-gate').hidden = false;
    $('ed-form').hidden = true;
    $('ed-gate-msg').innerHTML = html;
  }

  async function start() {
    if (!FIAuth.enabled) return gate("The blog isn't connected yet. Add your Supabase settings to <code>js/config.js</code> (see the README).");
    await FIAuth.ready;
    if (!FIAuth.user) return gate('Please <a href="login.html">log in</a> to write posts.');
    if (!FIAuth.isAdmin) return gate("Only the site's admin can write posts. If that's you, follow the “Make yourself admin” step in the README.");

    $('ed-gate').hidden = true;
    $('ed-form').hidden = false;

    if (postId) {
      const { data, error } = await FIAuth.client.from('posts').select('*').eq('id', postId).maybeSingle();
      if (error || !data) return gate(`That post couldn't be found. <a href="blog-editor.html">Write a new one</a>.`);
      fill(data);
      setExisting(data);
    } else {
      const backup = FI.store.get(DRAFT_KEY, null);
      if (backup && (backup.title || backup.content)) {
        fill(backup);
        slugTouched = Boolean(backup.slug);
        msg('Restored your unsaved draft from this browser.', 'ok');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('ed-title').addEventListener('input', () => {
      if (!slugTouched) $('ed-slug').value = slugify($('ed-title').value);
      updatePreview();
    });
    $('ed-slug').addEventListener('input', () => {
      slugTouched = $('ed-slug').value !== '';
      $('ed-slug').value = $('ed-slug').value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    });
    $('ed-content').addEventListener('input', updatePreview);
    $('ed-cover-url').addEventListener('input', updateCoverPreview);
    $('ed-form').addEventListener('input', markDirty);
    $('ed-form').addEventListener('change', markDirty);
    $('ed-form').addEventListener('submit', save);
    $('ed-delete').addEventListener('click', del);

    document.querySelectorAll('[data-md]').forEach((b) => b.addEventListener('click', () => TOOLS[b.dataset.md]()));

    $('ed-image-file').addEventListener('change', (e) =>
      withUpload(e.target, (url, file) => insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${url})`))
    );
    $('ed-cover-file').addEventListener('change', (e) =>
      withUpload(e.target, (url) => {
        $('ed-cover-url').value = url;
        updateCoverPreview();
        markDirty();
      })
    );

    // Upload a Markdown / text file as the post content
    $('ed-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > 1024 * 1024) return msg('That file is too big (max 1 MB).');
      let text = await file.text();
      // A leading "# Title" line becomes the post title (so it isn't shown twice)
      const m = text.match(/^\s*#\s+(.+)\r?\n/);
      if (m) {
        const fileTitle = m[1].trim();
        const current = $('ed-title').value.trim();
        if (!current || current === fileTitle || confirm(`Use “${fileTitle}” from the file as the post title?`)) {
          $('ed-title').value = fileTitle;
          text = text.slice(m[0].length).replace(/^\s+/, '');
          $('ed-title').dispatchEvent(new Event('input'));
        }
      }
      if ($('ed-content').value.trim() && !confirm('Replace the current text with the uploaded file?')) return;
      $('ed-content').value = text;
      $('ed-content').dispatchEvent(new Event('input', { bubbles: true }));
      msg(`Loaded ${file.name}`, 'ok');
    });

    window.addEventListener('beforeunload', (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    start();
  });
})();
