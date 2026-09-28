# SauFox Entertainment

Website for SauFox Entertainment, a studio that releases games, animation,
short films, feature films and novels in physical and digital editions.

Plain HTML, CSS and JavaScript with no build step. Open `index.html` in a
browser, or serve the folder with any static server:

```sh
npx serve .
```

## Structure

- `index.html`: home page
- `login.html`: login / sign-up page
- `profile.html`: profile page (signed-in visitors only)
- `emails/`: the sign-up, login and password-reset emails (paste into Supabase)
- `404.html`, `status.html`: page not found (GitHub Pages shows 404.html for any missing address), and `status.html?reason=maintenance|offline|forbidden|error`
- `about.html`, `terms.html`, `privacy.html`: about and contact, terms of use, privacy policy
- `faq.html`: help and frequently asked questions (accounts, buying, payment, refunds)
- `work.html`: one page per work (`work.html?id=the-candlewood`), filled from the catalogue
- `checkout.html`: checkout for one work (`checkout.html?id=the-candlewood`), members only
- `admin.html`: admin panel for the catalogue and orders (admins only)
- `css/style.css`: styles; design tokens live in `:root`
- `js/main.js`: scripts
- `js/fa.js`: Persian text for everything the pages and scripts show
- `js/vendor/supabase.js`: supabase-js 2.117.1 (UMD build, MIT), served from this site so it doesn't depend on a CDN
- `assets/`: default avatar, artwork (`works/`: stills from the released works), and self-hosted fonts (Great Vibes,
  Barlow Condensed, Inter, Vazirmatn; all SIL Open Font License)

## Languages

English, or Persian (right to left). The inline script at the top of each
page's `<head>` picks the language, from the visitor's choice
(`saufox.lang` in localStorage) or else from their browser, and sets
`<html lang="fa" dir="rtl">`. A Persian page stays hidden until
`js/main.js` has swapped every English text and label listed in
`js/fa.js` for Persian; it keeps doing so for text the scripts add later.
To translate something new, add its exact English to `js/fa.js`
(`{name}` marks a part that changes). Work titles, names and emails are
marked `translate="no"` and stay as they are. About, Terms and Privacy
carry both languages in the HTML (`data-only="en"` / `data-only="fa"`).

In Persian, numbers use Persian digits and dates the Iranian calendar,
the Vazirmatn font is used (self-hosted, SIL OFL), and the card rows and
the hero keep their shape. A work's status text and synopsis can be given
in Persian in the admin panel. The switch is in the footer and on the
login pages. The admin panel stays in English.

## Hosting

The site is published with GitHub Pages at https://saufoxentertainment.ir
(`CNAME` holds the domain; `.nojekyll` makes Pages serve the files as they
are).

Pages lets browsers cache files for 10 minutes. The HTML files load CSS and
JS with a version number (`style.css?v=21`); raise it in all three pages
whenever CSS or JS changes, so visitors never get old scripts with new pages.

## Accounts

Sign-up, login and profiles use the Supabase project `saufox-entertainment`
(eu-central-1). The browser uses the project's publishable key (in
`js/main.js`); row-level security limits each member to their own data.

- `public.my_list`: the works each member saved with "My List"
  (a work id from `public.works`), readable and changeable by that member only.
- `public.works`: the catalogue, one row per work (title, type, status,
  prices, poster / key art / gallery URLs, trailer date and Aparat ID,
  synopsis, genres, platforms, rating, credits, order, published, and
  `publish_at`, an optional go-live time). Everyone reads published works
  whose `publish_at` has passed (or is empty); only admins read drafts
  and scheduled works, or change anything. A scheduled work appears on its
  own at that time, with nothing to run. Pages load it with one plain request (`loadCatalog` in
  `js/main.js`) and keep the last copy in localStorage in case a request
  fails.
- `public.site_settings`: one row; the dollar and euro exchange rates (in
  Rials) and maintenance mode (with an optional note in each language), set
  in the admin panel. Everyone reads it; only admins change it.
- `public.admins`: accounts allowed into the admin panel. The check lives
  in `private.is_admin()`, outside the API.
- Storage bucket `works` (public, 5 MB, JPEG / PNG / WebP): artwork uploaded
  from the admin panel, in `<work id>/`. Only admins can write.
- `public.profiles`: one row per member (name, currency, avatar_url),
  created by the `on_auth_user_created` trigger from the sign-up name.
- Storage bucket `avatars` (public, 1 MB, JPEG / PNG / WebP): each member
  writes only to `<user id>/avatar.jpg`.

The session is kept in localStorage under `saufox.session`; the header and
the profile page check that key before first paint. Name, photo and currency
are also cached there so they show without waiting for the server.

Every email sign-in goes through a code sent by email (6 to 10 digits, per Supabase's "Email OTP Length"): after
signing up, after the password at every login, and for a forgotten
password (code plus the new password, all on the login page). The
database enforces it: `private.verified()` is true only for sessions whose
JWT `amr` shows something besides the password (an emailed code, or
Google), and every member policy (profiles, My List, admins, photos) and
`private.is_admin()` require it. A session made from the password alone
opens nothing, and the pages clear it (`verifiedSession` in
`js/main.js`).

Supabase dashboard settings (Authentication):
- Emails → SMTP settings: send from the studio's own address, so emails
  come from SauFox and reach everyone (Supabase's built-in sender only
  reaches the project team). With Gmail: host `smtp.gmail.com`, port 465,
  username `saufoxentertainment@gmail.com`, password a Google app password,
  sender name `SauFox Entertainment`.
- Emails → Templates: paste `emails/confirm-signup.html` into "Confirm
  sign up", `emails/login-code.html` into "Magic link" and
  `emails/reset-password.html` into "Reset password", each with the
  subject written at the top of its file. They show the code
  (`{{ .Token }}`), in Persian and English.
- Sign In / Providers → Email: "Confirm email" on; email OTP length 6 and
  expiry 600 seconds (the emails say 10 minutes).
- URL configuration: Site URL `https://saufoxentertainment.ir`, and
  `https://saufoxentertainment.ir/**` in the redirect URLs (for Google).
- Google sign-in: Sign In / Providers → Google, with a client ID and secret
  from a Google Cloud OAuth client whose redirect URI is
  `https://gwyqkzhhnspfadqefmix.supabase.co/auth/v1/callback`. The login
  page asks Supabase whether Google is on and says "isn't connected yet"
  until it is. New Google accounts get their name and photo in their
  profile.

## Orders

Works with a Rial price get a "Buy" button on their page ("Pre-order now"
until they're released). It opens `checkout.html`, where a signed-in member
gives a name and mobile number and accepts the terms of purchase; the order
is saved in the `orders` table as "awaiting payment" with a number from 1001
up. Signed-out visitors log in first and come back to the checkout.

- The database fills in the title, price (always the work's Rial price),
  email and status itself (trigger `private.order_defaults`), so nothing
  sent from the browser can change what's charged. One open order per
  member and work.
- Members see their orders under Profile → Orders and can cancel an unpaid
  one. Admins see every order in the admin panel and set it to Paid or
  Cancelled.
- Online payment goes through Zarinpal, via the Supabase Edge Function
  `payment` (source in `supabase/functions/payment/`). "Start" checks the
  member and the order and returns the bank page; Zarinpal sends the buyer
  back to `checkout.html?order=<id>&Authority=…&Status=…`, where "verify"
  asks Zarinpal and marks the order paid with its reference number. Only
  that function can mark an order paid (the trigger lets the service role
  through); the amount always comes from the order.
- The admin panel's "Payments" switches it: Off (orders
  wait; the checkout says payment opens soon), Test (Zarinpal's sandbox,
  admins only; orders are marked test) or Live. Live needs the Zarinpal
  merchant ID in Supabase → Edge Functions → Secrets as
  `ZARINPAL_MERCHANT_ID`.
- Zarinpal only accepts requests from the server IPs registered with it.
  Edge Functions leave from a different IP each time, so the function sends
  its Zarinpal requests through the database (`public.zarinpal_call`, the
  `http` extension, service role only), which always leaves from the same
  IP. The admin panel shows that IP (`public.server_ip()`); if it ever
  changes (after a project restore or upgrade), update it in Zarinpal.
- Terms of purchase and refunds: `terms.html#purchases`.
- Order emails (`supabase/functions/payment/mail.ts`), Persian and
  English, with a plain-text copy, through Resend from
  `orders@saufoxentertainment.ir` once `RESEND_API_KEY` is set in Edge
  Functions → Secrets (optional `MAIL_FROM` overrides the address), or
  otherwise from the studio's Gmail over SMTP, which also takes over if
  Resend refuses one: "order received" while online payment is closed, and
  a payment receipt once paid; the studio address gets a copy of each.
  Gmail needs the secret `SMTP_PASSWORD` (the same Gmail app password as in
  Supabase Auth → SMTP settings) in Edge Functions → Secrets; with neither
  secret no order emails are sent. The admin panel's test email says which
  one sent it. Each goes out once per
  order (`placed_email_at`, `paid_email_at`, `processing_email_at`,
  `completed_email_at`).
- An email that fails is kept in `email_pending` (with `email_error` and
  `email_tries`) and retried: the database job `retry-order-emails`
  (pg_cron, every 15 minutes) calls the payment function with the vault
  secret `email_retry_key`, for about a day (96 tries). The admin panel
  marks those orders and has a "Send again" button.
- Sales switch (admin panel → Payments, `site_settings.sales_open`): while
  paused, only admins can place an order (the database refuses the rest
  with code `SF001`) or start a payment; work pages say sales are paused.
  Orders already placed stay, and payments already at the bank are still
  confirmed. Use it to catch up when orders or emails pile up.
- Order statuses: Awaiting payment → Paid → In progress → Completed (or
  Cancelled). Setting one in the admin panel emails the buyer: Paid sends
  the receipt, In progress and Completed their own emails; each once.
  "Send a test email" in the admin panel sends a sample receipt to the
  studio inbox, or says why it couldn't.
- Paid works appear in Profile → Library ("Pre-ordered · arrives on release
  day" until they're released), and their page's buy button becomes "In
  your library".
- Subscriptions are bought the same way (see below).

## Bot check (Cloudflare Turnstile)

The login page asks Cloudflare Turnstile for a token before every
sign-up, password login, Google sign-in, emailed code and password reset
(entering a code doesn't need one). It's on: `TURNSTILE_SITE_KEY` in
`js/main.js` holds the widget's site key. How it was set up:

1. Cloudflare dashboard → Turnstile → Add widget, hostname
   `saufoxentertainment.ir`, mode Managed. Put its site key in
   `TURNSTILE_SITE_KEY` and publish.
2. Then Supabase → Authentication → Attack Protection → Enable CAPTCHA
   protection, provider Turnstile, with the widget's secret key.

In that order: with CAPTCHA on in Supabase but no site key on the site,
nobody can log in.

## Discount codes

- `coupons` table (admins only): code (A-Z, 0-9, dashes), percent or Rials
  off, optionally one work, total uses, uses per member (default 1), start
  and end, on/off, a private note. Codes can't be renamed, and a used code
  can't be deleted (turn it off).
- Checkout: the buyer types a code and presses Apply; `public.check_coupon`
  (signed-in members) says what it takes off or why it can't be used, and
  the new total shows. The order carries `coupon_code`; the order trigger
  checks the code again (locking it, so the last use can't be taken twice)
  and sets `list_amount_irr`, `discount_irr` and `amount_irr` itself, so the
  browser never decides the price. A code that stopped working meanwhile
  fails the order with SF002, and the checkout drops it and says why.
- A use is an order with the code that isn't cancelled. The price never
  goes below 10,000 Rials (Zarinpal's smallest payment); for a free copy,
  mark the order paid in the admin panel.
- Admin panel → Discount codes: add (with a Random button), turn on/off,
  delete unused; orders show the code and what it took off.

## Subscriptions

- Three plans in `public.plans` (everyone reads; admins change): Iron,
  Gold and Titanium, each themed in its metal (name, button, ticks and a
  brushed sheen), each with a discount on
  every work (10 / 25 / 50%), what its members watch or read free
  (`free_kinds`: animation, film, novel) and whether it's on sale.
- Each plan is sold for 7 days, 1, 3 or 6 months or a year, each at its own
  price in `public.plan_prices` (plan, days, price; empty = not offered).
  The home page has a length switch over the three plans and shows what
  the longer lengths save against paying monthly. Admin panel →
  Subscriptions edits every price, the discount and the free viewing, and
  shows how many members have each plan now.
- Buying: the plan buttons go to `checkout.html?plan=<id>&days=<days>`, where
  the length can still be changed. The order carries `plan_id` and
  `plan_days`; the order trigger prices it from `plan_prices` (no discount
  codes), one unpaid plan order at a time, and refuses a plan lower than
  the one running (SF003). Paying goes through Zarinpal like any order.
- `subscriptions`: one row per paid plan order (trigger
  `orders_plan_events`), from payment for the plan's days, or after the
  same plan's current stretch when renewing. Cancelling the order in the
  admin panel removes its row. The member's plan is the highest one running
  (`private.current_plan`); `public.my_membership()` returns it.
- Plan discount: the order trigger takes it off every work order
  (`member_discount_irr`), then any code on what's left, never below 10,000
  Rials. `public.price_for(work)` gives a member their price (checkout and
  the work page show it). `public.plan_covers(work)` says whether the plan
  lets them watch or read a work free, for the player and reader to come.
- Emails: the receipt says until when the plan runs; three days before a
  plan ends (unless it's been renewed) the member gets a "renew" email,
  sent by the 15-minute email run.
- The profile shows the plan and its end date with a Renew link; the home
  page marks the member's plan (remembered in the browser) and the lower
  ones as included. Terms: terms.html#subscriptions.

## News

- `news` table: a post in Persian and/or English (title, summary, text),
  a cover, optionally the work it's about, `published` and `published_at`.
  Everyone reads published posts whose time has come; admins manage them.
- `news.html` lists posts (12 at a time); `news.html?post=<slug>` shows
  one, with its own title, description and share image. A post with only
  one language shows it on both versions of the site. The home page shows
  the latest three once there are any; every footer links to News.
- Text is written plainly and rendered as elements (never HTML): a blank
  line starts a paragraph, "## " a heading, "- " a list item, and
  **bold** and [text](https://…) links work inside.
- A post linked to a work needs no cover of its own: the work's art stands
  in (news cards, the post page), and the work gets a panel in the home
  page's hero that opens the post.
- YouTube: a post and a work can each have a YouTube link and a thumbnail
  (`youtube_url`, `youtube_thumb_url`), set in the admin panel; the
  thumbnail is uploaded to the site's storage because YouTube's own images
  don't load in Iran without a VPN (without one, YouTube's is tried). The
  thumbnail links to the video on YouTube: on the post, on the work's page
  and in the hero card. Links are saved as https://www.youtube.com/watch?v=….
- Admin panel → News: new post, edit, cover upload (to `works/news/`,
  shrunk to WebP), publish now or at a set Tehran time, delete. New posts
  aren't in sitemap.xml by themselves; news.html is.

## Browse and search

- `browse.html`: every published work, with a search box and filters for
  type, status, genre and platform (each shows only the choices the
  catalogue has, and goes when there's nothing to choose), and sorting
  (featured, newest, top rated, price). The address keeps the choices
  (`browse.html?q=…&kind=…&status=…&genre=…&platform=…&sort=…`).
- Search matches every word against the title, type, status, genres,
  platforms and the synopsis and status text in both languages, after
  `foldText` evens out Persian and Arabic letters, digits, diacritics and
  zero-width non-joiners.
- The home page has a search box beside the currency switch (it opens
  `browse.html?q=…`), and every footer links to All works.

## Account settings

- Profile → Settings also has Email (Supabase emails a confirmation link),
  Password (same rules as sign-up; if Supabase asks to reauthenticate, a
  code is emailed and the form asks for it) and Delete account.
- Edge Function `account` (`supabase/functions/account/`): `delete` removes
  the member's photo files and their auth user, after they type their
  email; admins can't delete themselves there. The profile, list, reviews,
  alerts and download log go with the user (cascade); orders are kept as
  payment records with `user_id` set to null (the order trigger lets only
  that database-side unlinking through).

## Notify me

- Work page → Notify me (works not out yet): a row in `work_alerts` (the
  trigger fills in the member and their email). When a work's status
  becomes released, or its trailer is first set, `private.work_alert_events`
  marks its alerts `pending` and asks the payment function to send them;
  the 15-minute database job asks again while any are due. Each member gets
  the release email once (and the trailer email once, only before release).
- Sending: the payment function's `retry-emails` (from the database) sends
  due alerts, 40 a run, with the `alertEmail` template in `mail.ts`; one
  that fails stays pending and is tried again every 15 minutes for about 3
  days (after 3 failures in a run, usually the day's sending limit, the
  rest wait for the next run).

## Customer portal (portal.saufoxentertainment.ir)

- The code lives in `portal/` (see `portal/README.md`) and is published from
  its own repository, `Portal.SauFox`, on the subdomain. Same Supabase
  project: tickets, orders and rules are shared.
- `portal-signin.html` (js/main.js `portalSignin`) signs the portal in with
  the account signed in here: a one-time sign-in from the `library`
  function (`launcher-token`) goes to the fixed portal address as
  `#signin=…`, and the portal makes its own session from it.
- Until the subdomain is live, `support.html` stays the support page; after
  that, the site's Support links and the ticket emails point to the portal.

## Clean addresses and fresh pages

- The address bar never shows ".html": GitHub Pages serves `/work` for
  `work.html` and `/` for `index.html`. An inline script in every `<head>`
  tidies the address on load; `cleanLinks` in `js/main.js` strips ".html"
  from every link and form, including ones added later. Links in the HTML,
  canonical/og URLs and `sitemap.xml` are written without it. (Redirects
  set elsewhere, such as the sign-in return and the payment callback, may
  still use `page.html`; the file exists, and the address is tidied.)
- Pages always start at the top (no scroll restoring; a reload or Back
  drops any `#section`). Returning to the site's tab after 8 seconds or
  more, or arriving with Back, reloads the page so it's current. It waits
  while something's typed, a box is open or a video plays, and never runs on
  login, checkout, admin, launcher or status pages. Sign-in and settings are
  in localStorage, so nothing is lost.

## Security checklist (last run 2026-09-28)

- Every public table has row-level security; writes are admin-only or
  limited to the member's own rows. Prices, discounts and order status are
  set by database triggers, never trusted from the browser; members can only
  cancel their own unpaid orders. Storage: admins write artwork, members only
  their own avatar folder.
- Edge Functions check the caller's token themselves, admin actions check
  `admins`, and payment verification uses the amount stored on the order.
  Secrets live only in Supabase (Edge Functions → Secrets), never in the repo;
  the key in `js/main.js` is the publishable one.
- The pages never put user text in as HTML (only fixed SVG icons use
  innerHTML); emails escape everything. supabase-js is served from
  `js/vendor`, not a CDN.
- Clickjacking: the head script hides the page when it's framed by another
  site (GitHub Pages can't send X-Frame-Options).
- Still to switch on in the dashboard: Authentication → Passwords → leaked
  password protection. The retired `ip-probe` function only answers "Gone"
  and can be deleted there.

## Support portal

- `support.html` (footer → Support, profile → Support tickets with an
  unread badge, Help & FAQ): a signed-in member's tickets (newest activity
  first, "New reply" on unread ones), a New ticket form (topic, one of
  their orders if they like, subject, message, one image or PDF up to 5 MB)
  and one ticket's conversation (`?t=<id>`), with a reply box and Close.
  A new message opens a closed ticket again; the page checks for replies
  every 30 seconds while a ticket is open.
- Tables `tickets` (number from 1001, topic, subject, order, status
  open / answered / closed, member_unread, studio_unread) and
  `ticket_messages` (staff marks the studio's replies). Triggers fill in
  who and when, keep members to closing their ticket or marking it read,
  and set the status from the last message. Limits: 5 unfinished tickets
  per member, a minute between new tickets, 10 seconds between messages,
  200 messages per ticket.
- Attachments: private bucket `support`, in the ticket owner's folder;
  members see only theirs, admins all; shown through one-hour links.
- Emails (Edge Function `payment`, action `ticket-email`, by the message's
  author within 10 minutes): the studio's reply goes to the member with a
  link to the ticket; a member's message goes to the studio (reply-to the
  member).
- Admin panel → Support tickets: filters (Waiting for us, Answered,
  Closed, All), unread first with a count; open one to read it, reply (with
  a file), close or reopen. Emails link to `admin.html#support`.

## Ratings and reviews

- `reviews` table: any number of comments per member per work, but one rated
  row (unique index `reviews_one_rating`), 1-10 stars (as on IMDb) and an optional
  comment (up to 2000 characters). Before a work is released it takes
  comments only; the database drops any stars. The trigger
  `private.review_defaults` fills in the author's name and photo from their
  profile and `owner` (they had paid for the work), and keeps members off
  the `hidden` and `reply` fields; admins can only hide a review or reply
  to it. `private.review_totals` keeps `works.review_count` and
  `works.review_sum` (visible rated reviews) up to date.
- Work page, under the title: "SauFox rating ★ 8.4/10"
  with the number of ratings (1.2K), and "Your rating": ☆ Rate opens a box
  of ten stars; a rating needs no written review, can be changed, and
  "Remove rating" takes it off (a written review stays, without stars).
  Before release "Your rating" reads "Opens at release". A last item,
  Comments (User reviews once out), shows how many there are and scrolls
  down to them.
- Work page → Ratings & reviews (Comments before release): the average,
  a bar for each of the ten stars, the comment box (always there and
  empty; members can post as many comments as they like, at most 20 per work
  and one every 15 seconds, enforced by `private.review_limits`; on released
  works it also shows their rating), and the list with the member's own
  comments first (Edit opens the text in place, with Save, Cancel and
  Delete); each comment shows its author's rating, and the list, 10 at a time. Scores show as ★ 8.4/10; every cover (home cards,
  category rows, browse, My List, the work page's poster) shows the average
  in its corner once a work has ratings (`coverScore`); the home page gets a "Top rated" row once two works have
  ratings (a work with few ratings is pulled towards 6).
- Admin panel → Reviews and comments: hide or show, reply, delete.
- Helpful: `review_votes`, one per member per review (not their own);
  `reviews.helpful_count` is kept by a trigger, and reviews can be sorted
  by it. Report: `review_reports` with a reason (spam, offensive, spoiler,
  other) and an optional note, one per member per review; three open
  reports hide the review (`reviews.report_count`). In the admin panel
  reported reviews come first with their reasons; "Dismiss reports" closes
  them, and showing a hidden review again closes them too. The review
  trigger skips its own nested updates (`pg_trigger_depth() > 1`) so these
  counts can't reassign or unhide a review.

## Library: files and the launcher

- Files buyers download (game builds now; films and novels later) are in a
  private Cloudflare R2 bucket. The `builds` table lists them (work,
  platform, version, file key, size, published); buyers can only read the
  published builds of works they've paid for. `downloads` logs each link.
- Edge Function `library` (`supabase/functions/library/`): `download` gives
  an owner a link to the file that works for an hour (10 a day per file);
  admins get `upload` (a link to PUT a file of up to 5 GB straight into the
  bucket) and `delete`. `r2.ts` signs the links (AWS Signature v4).
  Secrets: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and
  `R2_ACCOUNT_ID` for Cloudflare R2, or for any other S3-compatible storage
  (an Iranian cloud, say) `S3_HOST` (its endpoint's host name) and, if it
  asks for one, `S3_REGION`. The bucket needs a CORS rule allowing `PUT` and
  `GET` from `https://saufoxentertainment.ir` for uploads from the admin
  panel. Until the secrets are set, downloads and uploads say so and
  nothing else changes.
- Admin panel → Files for buyers: upload, publish, delete. Profile →
  Library shows a download button for the newest file of each platform.
- Launcher sign-in: the launcher listens on `http://127.0.0.1:<port>`, opens
  `https://saufoxentertainment.ir/launcher.html?port=<port>&state=<random,
  16-128 of A-Z a-z 0-9 _ ->` in the browser, and after the member allows
  it receives `/callback?state=…&token_hash=…&email=…` (or `error=
  cancelled`). It checks `state`, then signs in with supabase-js
  `auth.verifyOtp({ token_hash, type: "magiclink" })`, which gives it its
  own session. With that session it reads `orders` and `builds` through the
  REST API and asks `library` for `download` links (`source: "launcher"`).

## Search engines (SEO)

- Each page is in English at its plain address and in Persian at
  `?lang=fa` (the language the address names wins over the saved choice,
  and is then saved). Every public page's `<head>` has its canonical
  address, the `hreflang` pair, Open Graph and Twitter tags and the share
  image `assets/og.jpg`; `pageMeta` in `js/main.js` translates them in
  Persian and fills them in for work pages.
- `sitemap.xml` lists both languages of each page. Add each new work
  (`work.html?id=…`) there too. `robots.txt` keeps the admin, checkout,
  profile and status pages out; login and profile also say `noindex`.
- The home page carries the studio's details as schema.org data.
- Icons (from the square SAUFOX mark in `assets/logo.webp`, on the site's near-black): `assets/favicon.png` (tab), `assets/icon-192.png`, `assets/apple-touch-icon.png`.
- Google Search Console: add the domain property `saufoxentertainment.ir`,
  verify with the TXT record it gives (Cloudflare DNS), then submit
  `https://saufoxentertainment.ir/sitemap.xml`.

## Trust seals (eNamad)

Every footer has a `<div class="site-footer__seals">` (hidden while
empty). The eNamad seal (id 7933711) is in it on every page with a footer.
A new or changed snippet goes inside it on each page, unchanged,
keeping `referrerpolicy='origin'`: eNamad checks where its image is loaded
from, and its bot reads the page source, so the snippet goes in the HTML
rather than being added by script. The image comes from eNamad's server,
so it updates by itself when the seal's level changes. For eNamad's domain
check, a file they ask for goes in the repository root.

## Page background

Behind every page built from the catalogue (not login or admin), a fixed
collage of all the works' artwork (covers, key art, gallery images), 24
tiles, blurred 48px and at 16% opacity, over the dark background. It's added
after the page has loaded (so it never slows the first view) and fades in
(`pageBackdrop` in `js/main.js`, `.page-backdrop` in `css/style.css`).

## Content protection

Text can't be selected or copied (except contact details marked `.selectable`), and images can't be dragged out or saved
from the right-click / long-press menu (`css/style.css` base rules plus
`protectContent` in `js/main.js`). This stops casual copying; anything shown
in a browser can still be captured by a determined visitor.

## Build progress

Built one section at a time from the hand-drawn sketches.

Home page:
- [x] 1. Header: the SAUFOX wordmark in its own colours and texture (assets/wordmark.webp, transparent) in the centre (on desktop, the part under the
      mouse softly blurs); behind it, a WebGL backdrop (headerShader): slow
      dark-silver smoke with faint orange embers and a warm light under the
      mouse (half resolution, ~30 fps, paused in hidden tabs, still for
      reduced motion); the right side depends on the visitor:
      - first visit or no account: "Wanna create an account?"
      - has an account but signed out: "Login"
      - signed in: no button; on the left a pinched profile button (straight
        short sides, long sides curving inward) showing the avatar blurred. On
        hover or tap it comes into focus, "Profile" appears over it and the
        curved sides straighten.

      The button is bare text with no box. Its letters loop orange to white one after another; on hover the
      letters leave one by one, "Sign Up Now" / "Welcome Back" rises in their
      place, and the text glows softly. Add `?demo=new|returning|member` to
      the URL to preview each state.
- [x] 2. Hero: 16:9 key art in slanted panels whose bottom edge steps down
      from left to right in a smooth S-curve. The main work (chosen in the
      admin panel with "Main work in the home page hero", `works.hero_featured`,
      one at a time; else the one with the newest news post, else a random
      one) takes the left 72%,
      its banner nearly whole, and its card stays open (details, YouTube
      thumbnail beside the text, link on); an eye button hides it and
      brings it back, remembered in the browser (`heroCard`). The other
      works (up to five on wide screens, four on tablets, three on phones)
      share the right side in equal strips, swapping at random every few
      seconds when there are more; on a mouse, the strip under the pointer
      widens within that side and its card opens (a plain see-through dark
      card in a layer after the hero, never cut off, text never shortened).
      Strips with a news post show a "News" tag and open the post. Phones
      show no cards. While there is only one work, its image fills the hero
      with no slant. Data: each work's key art and phone crop, set in the
      admin panel; news from `news.work_id`.
- [x] 3. Studio slogan: a short line, "And my success is not but through God."
      (Qur'an 11:88), in the space under the hero's curve
- [x] 4. Work cards: a sliding row tucked right under the slogan; on the right
      the cards fade out under the hero's curve. Moved only by dragging, like a
      touch screen: swipe on phones, drag with the mouse on desktop (it glides
      on and settles on a card). Currency buttons below (Auto cycles USD / EUR /
      Rials, or pin one). Each card has an image slider, a price strip and a
      status box. Data: the catalogue (`public.works`).
- [x] 5. Subscriptions: Iron, Gold and Titanium boxes, three across on
      wide screens and stacked on phones, with a length switch (7 days to a
      year) above. Prices follow the currency chosen above the work cards.
      On hover each box gets a soft light in its metal that follows the
      pointer. Buying one
      goes through checkout (see Subscriptions).

Title page (`work.html?id=<id>`):
- [x] The work's key art in the hero's curved frame, its kind, status and
      name in the corner under the curve, the poster, price, a "Watch
      trailer" button (Aparat, which plays in Iran) or the trailer date,
      a live countdown to the trailer, synopsis, a gallery of stills that
      open full size (arrow keys and Esc work), and Cast & crew. Each person
      has a name, a photo (or initials) and any number of roles
      (`works.credits`: name, photo, roles). Anyone who directs or writes
      shows first in a row of their own (bigger photos with an accent ring,
      all their roles as a label over the name); then the crew; then the cast (people whose roles are all
      acting or voice: Actor, Voice actor, Narrator), as standing cards: the
      photo, the character they play (`character`; the admin panel asks for
      it once someone has an acting or voice role), and their own name
      smaller under it. A
      dozen per group until "Show all"; common roles show in Persian on the
      Persian site. In the admin panel each person has a photo upload (a crop window opens first: drag, zoom, rotate; saved as a 400×400 WebP), a
      name, a roles box (Enter or comma adds one, with suggestions; &times;
      removes) and a move-up arrow that moves them up within their section
      (leads, crew, AI or cast); every section on the page keeps that order. Anyone with the role "AI assistant" (such as Claude) gets an "AI Assistant" section of its own beside Crew, with a thin line between them and the same look as everyone else (under Crew on narrow screens). Older credits (one role, a group) turn
      into roles by themselves.
- [x] Category rows (Coming soon, Games, Films, Animation, Novels) under
      the main row, built from the catalogue. They stay hidden until the
      catalogue spans at least two kinds of work.
- [x] "My List": a button on each work's page saves it to the member's
      account (signed-out visitors go to login); the profile's My List tab
      shows the saved works.

Footer and text pages:
- [x] A footer on every page but login: studio links, legal links, email,
      phone and social links (Instagram, Telegram, X). The email and phone
      can be selected and copied despite the site-wide copy block
      (`.selectable`).
- [x] About (with contact details), Terms of use and Privacy policy. The
      terms and policy describe what the site actually does today; update
      them before purchases open. The sign-up page links to both.

Admin panel (`admin.html`):
- [x] For accounts in `public.admins` (the profile shows them a "Manage
      works" link). Lists every work, drafts too, in site order, with
      up / down to reorder. The editor covers title, page address, type,
      status and status text, prices, poster, key art (and which side to
      keep on phones), gallery stills, trailer date (Tehran time) and
      Aparat link, synopsis, genres, platforms, age rating, credits, and
      "Show on the site". Images are resized in the browser, saved as WebP
      and uploaded to the `works` bucket. Deleting asks for a second press
      and removes the work's uploaded images too.
- [x] Scheduling: next to "Show on the site", an optional time (Tehran)
      from which the work shows; the list marks it "Scheduled · <time>".
- [x] Exchange rates (1 dollar / 1 euro in Rials): works with only a Rial
      price also show in dollars and euros, marked "≈". The home page's
      currency buttons offer only currencies some work can show (none when
      there's just one), and a member who chose a currency in Settings sees
      prices in it without the buttons.

Status pages (`404.html`, `status.html`):
- [x] One page for every state, in the site's style and both languages: page
      not found (404), no access (403, e.g. admin.html for a non-admin),
      maintenance, can't reach the server, and a general error. GitHub
      Pages only lets a site customise its 404; other HTTP errors come from
      GitHub itself.
- [x] Maintenance mode (admin panel): visitors of the home, work and profile
      pages go to the maintenance page, which shows the admin's note and
      checks every minute, returning them once it's off. Browsers that
      opened the admin panel keep seeing the site, with a reminder bar.
- [x] If the server can't be reached and the browser has no saved copy of
      the catalogue, those pages go to "Can't reach our servers", which
      retries every 20 seconds and returns to where the visitor was.

Login page (`login.html`):
- [x] Slanted artwork strips behind everything; a card with the studio logo,
      Login / Sign Up tabs whose forms slide past each other, email and
      password (with show / hide), and a Google button. The card's
      right half has an image with three curved artwork layers over it. `login.html#signup` opens
      the Sign Up tab.
- [x] Real accounts through Supabase (see Accounts above): sign-up, login,
      clear error messages, and a confirmation-email step when it is on.
- [x] Codes by email: sign-up and every login finish with an emailed code
      (with "Send a new code" after 60 seconds); "Forgot password?" sends a
      code and takes the new password in the same form. `login.html#reset`
      opens the forgot-password form directly.
- [x] Google sign-in with Google's own button on the page (Google Identity
      Services, client ID in `js/main.js`), so Google shows
      saufoxentertainment.ir; the ID token goes to Supabase with a one-time
      nonce. If Google's script doesn't load, the plain button signs in by
      redirect instead. The OAuth client needs
      `https://saufoxentertainment.ir` under Authorized JavaScript origins.
- [ ] Apple sign-in: removed for now (needs a paid Apple Developer account,
      which Apple doesn't offer in Iran). The login code already handles any
      `.social[data-provider]` button, so adding it back is just the button.

Profile page (`profile.html`):
- [x] The avatar (the header chip's pinched shape, larger) with the name,
      email, membership date and current plan beside it. Tabs: Library, Wishlist, Orders (empty states for
      now) and Settings (profile photo, name, default currency, log out).
      Signed-out visitors are sent to the login page. The photo also shows in
      the header's profile button, and the currency choice carries over to
      the home page. All of it is saved to the member's account.
- [ ] Later: a cover image above the profile that subscribers can set
      themselves, once there are more works to choose from.
