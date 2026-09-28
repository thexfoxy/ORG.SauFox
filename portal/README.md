# SauFox customer portal

`portal.saufoxentertainment.ir`: a member's support tickets, orders and
help, on its own subdomain. A static site (GitHub Pages) on the same
Supabase project as the main site, so tickets, orders and every database
rule are shared with it.

- `index.html`, `portal.css`, `portal.js` (the whole app: sign-in screen,
  sidebar, and the views `#/`, `#/tickets`, `#/tickets/<id>`,
  `#/new?order=<id>`, `#/orders`, `#/help`), `js/supabase.js` (supabase-js,
  MIT, see `js/supabase.LICENSE`), `assets/` (fonts, logos, icons), `CNAME`.
- Tickets are a chat: bubbles on two sides, a line between days, a box at
  the bottom (Enter sends, Shift+Enter is a new line, a paper clip
  attaches), live through Supabase Realtime (`tickets` and
  `ticket_messages` are in the `supabase_realtime` publication; each change
  only reaches those the row-level security lets read it), with a 20-second
  check as well.
- Admins (a row in `admins`) also get the Support desk (`#/desk`,
  `#/desk/<id>`), and land there: every conversation on one side (unread
  first with a dot, the last message, filters and search), the chat on the
  other, with the member's name and email, their order, and Close / Reopen.
  An admin's message is marked staff by the database and emailed to the
  member. On phones the list and the chat take turns.
- English and Persian (`FA` in `portal.js`; the choice is kept per site).

## Signing in

Members sign in on the main site only. "Sign in with your SauFox account"
opens `saufoxentertainment.ir/portal-signin`, which (after the main site's
login, if needed) asks the `library` Edge Function for a one-time sign-in
(`launcher-token`, a magic-link token hash) and sends it here in the
address: `#signin=<token_hash>`. `portal.js` removes it from the address at
once and turns it into its own session with
`auth.verifyOtp({ token_hash, type: "magiclink" })`. The main site's session
is never handed over; the code works once and only for a short while, and
`portal-signin` only ever sends it to this fixed address.

## Publishing

This folder is the root of the `Portal.SauFox` repository (GitHub Pages
from its main branch, custom domain `portal.saufoxentertainment.ir`, HTTPS
on). DNS: a CNAME record `portal` → `thexfoxy.github.io`.
