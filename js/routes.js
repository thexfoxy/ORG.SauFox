// Public work addresses. IDs stay stable when a title changes.
(function () {
  const paths = window.SAUFOX_WORK_PATHS || {};
  const workUrl = (id) => Object.hasOwn(paths, id) ? paths[id] : `/work?id=${encodeURIComponent(id)}`;
  const workId = (href) => {
    const url = new URL(href, 'https://saufoxentertainment.ir/');
    const match = /^\/works\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.html|\/|\/index\.html)?$/.exec(url.pathname);
    if (match) return match[1];
    return /^\/work(?:\.html)?$/.test(url.pathname) ? url.searchParams.get('id') : null;
  };
  const canonical = (href) => {
    const url = new URL(href, 'https://saufoxentertainment.ir/');
    const id = workId(url.href);
    if (!id || !Object.hasOwn(paths, id)) return null;
    const legacy = /^\/work(?:\.html)?$/.test(url.pathname);
    if (legacy) url.searchParams.delete('id');
    return paths[id] + url.search + url.hash;
  };
  const loginReturn = (next) => {
    // Allow local page paths only; reject protocol-relative URLs and traversal.
    if (typeof next !== 'string' || /[\s\\]/.test(next)) return '/';
    if (!/^(?:\/[a-z0-9-]+(?:\/[a-z0-9-]+)*|[a-z0-9-]+\.html|\/)(?:[?#].*)?$/i.test(next)) return '/';
    return next;
  };
  window.SauFoxRoutes = Object.freeze({ workUrl, workId, canonical, loginReturn });
})();
