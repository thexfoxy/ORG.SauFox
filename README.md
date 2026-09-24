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
- `css/style.css`: styles; design tokens live in `:root`
- `js/main.js`: scripts
- `assets/`: default avatar, artwork (`works/`), and self-hosted fonts (Great Vibes,
  Barlow Condensed, Inter; all SIL Open Font License)

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
- [x] 2. Hero: full-width collage of seven slanted panels (five on phones)
      whose bottom edge steps down from left to right in a smooth S-curve. Each load shows a random mix of works,
      and every few seconds one panel crossfades to another. Hovering a panel
      zooms its art and dims the rest. Artwork list: `WORKS` in `js/main.js`
      (placeholders in `assets/works/` for now).
- [x] 3. Studio slogan: a short line, "And my success is not but through God."
      (Qur'an 11:88), in the space under the hero's curve
- [x] 4. Work cards: a sliding row tucked right under the slogan; on the right
      the cards fade out under the hero's curve. Moved only by dragging, like a
      touch screen: swipe on phones, drag with the mouse on desktop (it glides
      on and settles on a card). Currency buttons below (Auto cycles USD / EUR /
      Rials, or pin one). Each card has an image slider, a price strip and a
      status box. Data: `CATALOG` in `js/main.js` (placeholders for now).
- [x] 5. Subscriptions: Basic and Premium boxes, side by side at every
      screen size. Prices follow the currency chosen above the work cards.
      On hover each box gets a soft light that follows the
      pointer (white on Basic, orange on Premium). Plan features and prices are placeholders.

Login page (`login.html`):
- [x] Slanted artwork strips behind everything; a card with the studio logo,
      Login / Sign Up tabs whose forms slide past each other, email and
      password (with show / hide), and Google / Apple buttons. The card's
      right half has an image with three curved artwork layers over it. `login.html#signup` opens
      the Sign Up tab.
- [ ] Real accounts: there is no account server yet. A valid form only marks
      this browser as signed in (localStorage) so the header shows the
      profile button; Google and Apple buttons say they aren't connected yet.

Profile page (`profile.html`):
- [x] Cover: a shorter copy of the home collage. Under its curve, the avatar
      (the header chip's pinched shape, larger), name, email, membership date
      and current plan. Tabs: Library, Wishlist, Orders (empty states for
      now) and Settings (profile photo, name, default currency, log out).
      Signed-out visitors are sent to the login page. The photo also shows in
      the header's profile button, and the currency choice carries over to
      the home page. All of it lives in this browser until there's an
      account server.
