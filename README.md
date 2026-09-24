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
- `css/style.css`: styles; design tokens live in `:root`
- `js/main.js`: scripts
- `assets/`: default avatar, artwork (`works/`), and self-hosted fonts (Great Vibes,
  Barlow Condensed, Inter; all SIL Open Font License)

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
- [x] 4. Work cards: four cards (two on tablets, a swipeable row on phones).
      Each has an image slider with dots, a price strip cycling through
      USD, EUR and Rials, and a release status box. Data: `CATALOG` in
      `js/main.js` (placeholder titles and prices for now).
- [ ] 5. Subscriptions: Basic and Premium

Login page:
- [ ] Login / Sign up with sliding switch, email, password with show/hide,
      Google and Apple sign-in, diagonal artwork background
