# Work addresses

Public work pages use `/works/<stable-work-id>`; for example `/works/the-candlewood`.
The `works` namespace leaves top-level addresses available for new site features.
An edition or other optional selection may use query parameters; `#reviews` links
to the existing reviews section. IDs must not change when a title is renamed.

GitHub Pages serves the committed `works/<id>.html` at the extensionless address.
These are real pages with HTTP 200, not a router embedded in the 404 page.
The shared work template loads the latest catalogue data. Its root base keeps
assets, checkout, login and site navigation working from the nested address.

When publishing another work, add its public ID and title to `work-routes.json`
and run `node scripts/generate-work-pages.mjs`. Commit the generated HTML and
`js/work-paths.js` with the change. Regenerate pages after editing `work.html`.
Until a new work's static page is published, links keep using `/work?id=<id>` so
catalogue additions from the admin panel do not produce broken links.

Old `/work?id=<id>` and `/work.html?id=<id>` links redirect in the browser to
the clean address while preserving other query parameters and anchors. GitHub
Pages does not provide configurable server-side redirects for these query URLs.
