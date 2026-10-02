(function (root) {
  const messages = {
    loading: ['Loading your library…', 'در حال دریافت کتابخانه…'],
    failed: ['Your library could not be loaded. Please try again.', 'کتابخانه دریافت نشد. دوباره تلاش کنید.'],
    filesFailed: ['Download details could not be loaded.', 'اطلاعات دانلود دریافت نشد.'],
    partial: ['Some work details could not be loaded. Please refresh your library.', 'اطلاعات بعضی از آثار دریافت نشد. کتابخانه را دوباره دریافت کنید.'],
    noFiles: ['No download is available yet.', 'هنوز فایلی برای دانلود آماده نشده است.'],
    pending: ['Your files will be available when this work is released.', 'فایل‌ها پس از انتشار اثر در دسترس قرار می‌گیرند.'],
    search: ['Search your library', 'جستجو در کتابخانه'],
    all: ['All works', 'همهٔ آثار'],
    ready: ['Ready to download', 'آمادهٔ دانلود'],
    preorder: ['Pre-orders', 'پیش‌خریدها'],
    filter: ['Show', 'نمایش'],
    refresh: ['Refresh library', 'دریافت دوبارهٔ کتابخانه'],
    empty: ['No works match your search.', 'اثری با این جستجو پیدا نشد.'],
    clear: ['Clear filters', 'پاک‌کردن فیلترها'],
    launcher: ['Get the Windows launcher', 'دریافت لانچر ویندوز'],
    support: ['Get help', 'دریافت پشتیبانی'],
    details: ['View work details', 'مشاهدهٔ جزئیات اثر'],
  };
  const text = (key, lang) => messages[key][lang === 'fa' ? 1 : 0];
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u200c]/g, '').trim();
  function latestBuilds(builds, workId) {
    const result = new Map();
    for (const build of builds || []) {
      if (build.work_id !== workId) continue;
      const previous = result.get(build.platform);
      if (!previous || String(build.created_at || '') > String(previous.created_at || '')) result.set(build.platform, build);
    }
    return [...result.values()].sort((a, b) => String(a.platform).localeCompare(String(b.platform)));
  }
  const matches = (entry, state) => (!state.query || normalize(`${entry.work.title} ${entry.work.title_fa || ''}`).includes(normalize(state.query))) && (!state.filter || state.filter === 'all' || (state.filter === 'ready' && entry.available) || (state.filter === 'preorder' && entry.pending));
  function create({ entries, lang, onRefresh, state = {} }) {
    const el = (tag, className, label) => {
      const node = document.createElement(tag);
      node.className = className;
      if (label) node.textContent = label;
      return node;
    };
    const view = el('div', 'library-view');
    const toolbar = el('div', 'library-toolbar');
    const searchLabel = el('label', 'library-toolbar__search', text('search', lang));
    const search = el('input', '');
    search.type = 'search';
    search.value = state.query || '';
    search.placeholder = text('search', lang);
    searchLabel.append(search);
    const filterLabel = el('label', 'library-toolbar__filter', text('filter', lang));
    const filter = el('select', '');
    for (const key of ['all', 'ready', 'preorder']) {
      const option = el('option', '', text(key, lang));
      option.value = key;
      filter.append(option);
    }
    filter.value = state.filter || 'all';
    filterLabel.append(filter);
    const refresh = el('button', 'library-toolbar__refresh', text('refresh', lang));
    refresh.type = 'button';
    refresh.addEventListener('click', onRefresh);
    toolbar.append(searchLabel, filterLabel, refresh);
    const count = el('p', 'library-count');
    count.setAttribute('role', 'status');
    const grid = el('div', 'poster-grid');
    const empty = el('div', 'empty');
    const clear = el('button', 'empty__button', text('clear', lang));
    clear.type = 'button';
    empty.append(el('p', 'empty__title', text('empty', lang)), clear);
    const update = () => {
      state.query = search.value;
      state.filter = filter.value;
      const shown = entries.filter(entry => matches(entry, state));
      grid.replaceChildren(...shown.map(entry => entry.element));
      const format = n => n.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
      count.textContent = lang === 'fa' ? `نمایش ${format(shown.length)} اثر از ${format(entries.length)} اثر` : `${format(shown.length)} of ${format(entries.length)} works`;
      empty.hidden = shown.length > 0;
      grid.hidden = !shown.length;
    };
    search.addEventListener('input', update);
    filter.addEventListener('change', update);
    clear.addEventListener('click', () => { search.value = ''; filter.value = 'all'; update(); search.focus(); });
    view.append(toolbar, count, grid, empty);
    update();
    return view;
  }
  root.SauFoxLibrary = { text, normalize, latestBuilds, matches, create };
})(typeof window === 'undefined' ? globalThis : window);
