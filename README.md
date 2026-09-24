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
- `assets/`: default avatar, images, and self-hosted fonts (Great Vibes,
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
- [x] 2. Hero: full-width collage of four slanted panels (Games, Animation,
      Films, Novels) with a curved bottom edge. Hovering a panel zooms its art
      and dims the others. Placeholder colours for now; add real art with
      `style="--art: url(assets/hero/<file>.jpg)"` on a panel.
- [ ] 3. Studio slogan
- [ ] 4. Works grid: image slider, price cycling through currencies, release status
- [ ] 5. Subscriptions: Basic and Premium

Login page:
- [ ] Login / Sign up with sliding switch, email, password with show/hide,
      Google and Apple sign-in, diagonal artwork background
