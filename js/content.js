// SauFox Entertainment — site content.
//
// Everything visitors read about the works lives here. To add a real work:
//   1. Put its images in assets/works/ (.jpg or .webp; cards crop to portrait).
//   2. Add an entry to CATALOG below, in the order the cards should appear.
//
// title:   name of the work
// kind:    Game, Animated series, Short film, Feature film, Novel, …
// images:  the card's images, 3:4 (a poster works best); the first is the cover
// hero:    a 16:9 key art image for the hero at the top of the home page
// heroFocus: optional, which part of the hero image to keep when a narrow
//          screen crops its sides, as a CSS background-position ("10% center")
// stills:  optional extra images, used behind the login page
// prices:  price in each currency you sell in: USD, EUR and/or IRR (Rials).
//          Only the ones given are shown.
// note:    instead of prices, while a work has none yet: a label and a short
//          text for the price strip, e.g. { label: "Trailer", text: "24 Nov 2026" }
// status:  released | preorder | coming | production
// statusText: optional wording for the status box instead of the default
//          ("Coming soon" and so on), e.g. "Trailer 24 Nov"
//
// The hero shows one panel per work that has a hero image, up to five; with
// more works than that, the panels swap between them at random.
// Only real works go here.

const CATALOG = [
  {
    title: "The CandleWood",
    kind: "Game",
    images: ["assets/works/candlewood-poster.webp"],
    hero: "assets/works/candlewood-hero.webp",
    heroFocus: "5% center",
    stills: [
      "assets/works/candlewood-1.webp",
      "assets/works/candlewood-2.webp",
      "assets/works/candlewood-3.webp",
      "assets/works/candlewood-4.webp",
      "assets/works/candlewood-5.webp",
      "assets/works/candlewood-6.webp",
    ],
    prices: { IRR: 3130000 },
    status: "coming",
    statusText: "Trailer 24 Nov",
  },
];

// Every image in the catalogue, once each (the login page's backgrounds).
const WORKS = [...new Set(CATALOG.flatMap((work) => [...(work.stills || []), ...work.images, work.hero].filter(Boolean)))];
