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
- The admin panel's "Payments and subscriptions" switches it: Off (orders
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
  English, from the studio's Gmail over SMTP: "order received" while online
  payment is closed, and a payment receipt once paid; the studio address
  gets a copy of each. They need the secret `SMTP_PASSWORD` (the same Gmail
  app password as in Supabase Auth → SMTP settings) in Edge Functions →
  Secrets; without it no order emails are sent. Each goes out once per
  order (`placed_email_at`, `paid_email_at`).
- Paid works appear in Profile → Library ("Pre-ordered · arrives on release
  day" until they're released), and their page's buy button becomes "In
  your library".
- Subscription prices (Rials per month) are set in the same admin form;
  the home page shows them, in dollars and euros too once exchange rates
  are set. Subscriptions can't be bought yet: members see "Opens soon".

## Content protection

Text can't be selected or copied (except contact details marked `.selectable`), and images can't be dragged out or saved
from the right-click / long-press menu (`css/style.css` base rules plus
`protectContent` in `js/main.js`). This stops casual copying; anything shown
in a browser can still be captured by a determined visitor.

## Build progress

Built one section at a time from the hand-drawn sketches.

Home page:
- [x] 1. Header: script logotype in the centre (on desktop, the part under the
      mouse softly blurs); the right side depends on the visitor:
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
- [x] 2. Hero: 16:9 key art, one slanted panel per work (up to five) whose
      bottom edge steps down from left to right in a smooth S-curve; with
      more than five works the panels swap between them at random every few
      seconds. While there is only one work, its image fills the hero with no
      slant. Hovering a panel zooms its art and dims the rest. Data: each
      work's key art and phone crop, set in the admin panel.
- [x] 3. Studio slogan: a short line, "And my success is not but through God."
      (Qur'an 11:88), in the space under the hero's curve
- [x] 4. Work cards: a sliding row tucked right under the slogan; on the right
      the cards fade out under the hero's curve. Moved only by dragging, like a
      touch screen: swipe on phones, drag with the mouse on desktop (it glides
      on and settles on a card). Currency buttons below (Auto cycles USD / EUR /
      Rials, or pin one). Each card has an image slider, a price strip and a
      status box. Data: the catalogue (`public.works`).
- [x] 5. Subscriptions: Basic and Premium boxes, side by side at every
      screen size. Prices follow the currency chosen above the work cards.
      On hover each box gets a soft light that follows the
      pointer (white on Basic, orange on Premium). Plan features and prices are placeholders.

Title page (`work.html?id=<id>`):
- [x] The work's key art in the hero's curved frame, its kind, status and
      name in the corner under the curve, the poster, price, a "Watch
      trailer" button (Aparat, which plays in Iran) or the trailer date,
      a live countdown to the trailer, synopsis, a gallery of stills that
      open full size (arrow keys and Esc work), and credits. Sections with
      no data stay hidden. Home-page cards and hero panels link here.

Home page, later additions:
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
