// SauFox Entertainment — site content.
//
// Everything visitors read about the works lives here. To add a real work:
//   1. Put its images in assets/works/ (.jpg or .webp; cards crop to portrait).
//   2. Add an entry to CATALOG below, in the order the cards should appear.
//
// title:   name of the work
// kind:    Game, Animated series, Short film, Feature film, Novel, …
// images:  one or more image paths; the first is the card cover
// prices:  price in each currency (IRR in Rials)
// note:    instead of prices, while a work has none yet: a label and a short
//          text for the price strip, e.g. { label: "Trailer", text: "24 Nov 2026" }
// status:  released | preorder | coming | production
//
// The hero collage and the login page use every image listed here.
// The CandleWood is real. The works after it are placeholders with
// generated stand-in art (art-*.webp) until the real catalogue is ready.

const CATALOG = [
  { title: "The CandleWood", kind: "Game", images: ["assets/works/candlewood-1.webp", "assets/works/candlewood-2.webp", "assets/works/candlewood-3.webp"], note: { label: "Trailer", text: "24 Nov 2026" }, status: "coming" },
  { title: "Ember Road", kind: "Game", images: ["assets/works/art-01-lamp.webp", "assets/works/art-06-dunes.webp", "assets/works/art-11-road.webp"], prices: { USD: 19.99, EUR: 18.49, IRR: 12500000 }, status: "released" },
  { title: "Paper Foxes", kind: "Animated series", images: ["assets/works/art-05-forest.webp", "assets/works/art-10-lighthouse.webp", "assets/works/art-15-aurora.webp"], prices: { USD: 9.99, EUR: 9.29, IRR: 6200000 }, status: "preorder" },
  { title: "The Quiet Hour", kind: "Short film", images: ["assets/works/art-09-planet.webp", "assets/works/art-14-window.webp", "assets/works/art-04-city.webp"], prices: { USD: 4.99, EUR: 4.59, IRR: 3100000 }, status: "coming" },
  { title: "Salt and Ash", kind: "Novel", images: ["assets/works/art-13-sea.webp", "assets/works/art-03-mountains.webp", "assets/works/art-08-rain.webp"], prices: { USD: 14.99, EUR: 13.89, IRR: 9400000 }, status: "production" },
  { title: "Lantern Tide", kind: "Game", images: ["assets/works/art-02-moon.webp", "assets/works/art-07-corridor.webp", "assets/works/art-12-candle.webp"], prices: { USD: 24.99, EUR: 23.19, IRR: 15600000 }, status: "released" },
  { title: "Nine Winters", kind: "Feature film", images: ["assets/works/art-06-dunes.webp", "assets/works/art-11-road.webp", "assets/works/art-01-lamp.webp"], prices: { USD: 7.99, EUR: 7.39, IRR: 5000000 }, status: "released" },
  { title: "Kettle Spirits", kind: "Animated short", images: ["assets/works/art-10-lighthouse.webp", "assets/works/art-15-aurora.webp", "assets/works/art-05-forest.webp"], prices: { USD: 3.99, EUR: 3.69, IRR: 2500000 }, status: "coming" },
  { title: "Ashen Crown", kind: "Novel", images: ["assets/works/art-14-window.webp", "assets/works/art-04-city.webp", "assets/works/art-09-planet.webp"], prices: { USD: 12.99, EUR: 11.99, IRR: 8100000 }, status: "preorder" },
  { title: "Glass Orchard", kind: "Game", images: ["assets/works/art-03-mountains.webp", "assets/works/art-08-rain.webp", "assets/works/art-13-sea.webp"], prices: { USD: 29.99, EUR: 27.79, IRR: 18700000 }, status: "production" },
  { title: "Night Train to Kerman", kind: "Feature film", images: ["assets/works/art-07-corridor.webp", "assets/works/art-12-candle.webp", "assets/works/art-02-moon.webp"], prices: { USD: 8.99, EUR: 8.29, IRR: 5600000 }, status: "coming" },
  { title: "Moth and Moon", kind: "Novel", images: ["assets/works/art-11-road.webp", "assets/works/art-01-lamp.webp", "assets/works/art-06-dunes.webp"], prices: { USD: 11.99, EUR: 11.09, IRR: 7500000 }, status: "released" },
  { title: "Copper Sky", kind: "Short film", images: ["assets/works/art-15-aurora.webp", "assets/works/art-05-forest.webp", "assets/works/art-10-lighthouse.webp"], prices: { USD: 2.99, EUR: 2.79, IRR: 1900000 }, status: "released" },
];

// Every image in the catalogue, once each.
const WORKS = [...new Set(CATALOG.flatMap((work) => work.images))];
