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
- `work.html`: one page per work (`work.html?id=the-candlewood`), filled from `js/content.js`
- `css/style.css`: styles; design tokens live in `:root`
- `js/content.js`: the works catalogue (titles, images, prices, status). Edit this to add real works
- `js/main.js`: scripts
- `js/vendor/supabase.js`: supabase-js 2.117.1 (UMD build, MIT), served from this site so it doesn't depend on a CDN
- `assets/`: default avatar, artwork (`works/`: stills from the released works), and self-hosted fonts (Great Vibes,
  Barlow Condensed, Inter; all SIL Open Font License)

## Hosting

The site is published with GitHub Pages at https://saufoxentertainment.ir
(`CNAME` holds the domain; `.nojekyll` makes Pages serve the files as they
are).

Pages lets browsers cache files for 10 minutes. The HTML files load CSS and
JS with a version number (`style.css?v=7`); raise it in all three pages
whenever CSS or JS changes, so visitors never get old scripts with new pages.

## Accounts

Sign-up, login and profiles use the Supabase project `saufox-entertainment`
(eu-central-1). The browser uses the project's publishable key (in
`js/main.js`); row-level security limits each member to their own data.

- `public.profiles`: one row per member (name, currency, avatar_url),
  created by the `on_auth_user_created` trigger from the sign-up name.
- Storage bucket `avatars` (public, 1 MB, JPEG / PNG / WebP): each member
  writes only to `<user id>/avatar.jpg`.

The session is kept in localStorage under `saufox.session`; the header and
the profile page check that key before first paint. Name, photo and currency
are also cached there so they show without waiting for the server.

Supabase dashboard settings (Authentication):
- Email confirmation: Supabase's built-in email only reaches the project
  team's addresses. Either turn off "Confirm email" or add a custom SMTP
  server.
- URL configuration: Site URL `https://saufoxentertainment.ir`, with
  `https://saufoxentertainment.ir/login.html` in the redirect URLs.

## Content protection

Text can't be selected or copied, and images can't be dragged out or saved
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
      slant. Hovering a panel zooms its art and dims the rest. Data: `hero`
      (and optional `heroFocus`) in `js/content.js`.
- [x] 3. Studio slogan: a short line, "And my success is not but through God."
      (Qur'an 11:88), in the space under the hero's curve
- [x] 4. Work cards: a sliding row tucked right under the slogan; on the right
      the cards fade out under the hero's curve. Moved only by dragging, like a
      touch screen: swipe on phones, drag with the mouse on desktop (it glides
      on and settles on a card). Currency buttons below (Auto cycles USD / EUR /
      Rials, or pin one). Each card has an image slider, a price strip and a
      status box. Data: `CATALOG` in `js/content.js`.
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

Login page (`login.html`):
- [x] Slanted artwork strips behind everything; a card with the studio logo,
      Login / Sign Up tabs whose forms slide past each other, email and
      password (with show / hide), and Google / Apple buttons. The card's
      right half has an image with three curved artwork layers over it. `login.html#signup` opens
      the Sign Up tab.
- [x] Real accounts through Supabase (see Accounts above): sign-up, login,
      clear error messages, and a confirmation-email step when it is on.
- [ ] Google and Apple sign-in: the buttons say they aren't connected yet.

Profile page (`profile.html`):
- [x] The avatar (the header chip's pinched shape, larger) with the name,
      email, membership date and current plan beside it. Tabs: Library, Wishlist, Orders (empty states for
      now) and Settings (profile photo, name, default currency, log out).
      Signed-out visitors are sent to the login page. The photo also shows in
      the header's profile button, and the currency choice carries over to
      the home page. All of it is saved to the member's account.
- [ ] Later: a cover image above the profile that subscribers can set
      themselves, once there are more works to choose from.
