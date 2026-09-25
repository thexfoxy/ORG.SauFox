// SauFox Entertainment — site content.
//
// Everything visitors read about the works lives here. To add a real work:
//   1. Put its images in assets/works/ (portrait, about 600×900, .jpg or .webp).
//   2. Add an entry to CATALOG below, in the order the cards should appear.
//
// title:   name of the work
// kind:    Game, Animated series, Short film, Feature film, Novel, …
// images:  one or more image paths; the first is the card cover
// prices:  price in each currency (IRR in Rials)
// status:  released | preorder | coming | production
//
// The hero collage and the login page use every image listed here.
// The works below are placeholders until the real catalogue is ready.

const CATALOG = [
  { title: "Ember Road", kind: "Game", images: ["assets/works/placeholder-02.svg", "assets/works/placeholder-07.svg", "assets/works/placeholder-13.svg"], prices: { USD: 19.99, EUR: 18.49, IRR: 12500000 }, status: "released" },
  { title: "Paper Foxes", kind: "Animated series", images: ["assets/works/placeholder-06.svg", "assets/works/placeholder-01.svg", "assets/works/placeholder-11.svg"], prices: { USD: 9.99, EUR: 9.29, IRR: 6200000 }, status: "preorder" },
  { title: "The Quiet Hour", kind: "Short film", images: ["assets/works/placeholder-03.svg", "assets/works/placeholder-10.svg", "assets/works/placeholder-14.svg"], prices: { USD: 4.99, EUR: 4.59, IRR: 3100000 }, status: "coming" },
  { title: "Salt and Ash", kind: "Novel", images: ["assets/works/placeholder-04.svg", "assets/works/placeholder-09.svg", "assets/works/placeholder-12.svg"], prices: { USD: 14.99, EUR: 13.89, IRR: 9400000 }, status: "production" },
  { title: "Lantern Tide", kind: "Game", images: ["assets/works/placeholder-05.svg", "assets/works/placeholder-08.svg", "assets/works/placeholder-01.svg"], prices: { USD: 24.99, EUR: 23.19, IRR: 15600000 }, status: "released" },
  { title: "Nine Winters", kind: "Feature film", images: ["assets/works/placeholder-10.svg", "assets/works/placeholder-03.svg", "assets/works/placeholder-06.svg"], prices: { USD: 7.99, EUR: 7.39, IRR: 5000000 }, status: "released" },
  { title: "Kettle Spirits", kind: "Animated short", images: ["assets/works/placeholder-11.svg", "assets/works/placeholder-02.svg", "assets/works/placeholder-09.svg"], prices: { USD: 3.99, EUR: 3.69, IRR: 2500000 }, status: "coming" },
  { title: "Ashen Crown", kind: "Novel", images: ["assets/works/placeholder-12.svg", "assets/works/placeholder-05.svg", "assets/works/placeholder-07.svg"], prices: { USD: 12.99, EUR: 11.99, IRR: 8100000 }, status: "preorder" },
  { title: "Glass Orchard", kind: "Game", images: ["assets/works/placeholder-13.svg", "assets/works/placeholder-04.svg", "assets/works/placeholder-10.svg"], prices: { USD: 29.99, EUR: 27.79, IRR: 18700000 }, status: "production" },
  { title: "Night Train to Kerman", kind: "Feature film", images: ["assets/works/placeholder-14.svg", "assets/works/placeholder-06.svg", "assets/works/placeholder-02.svg"], prices: { USD: 8.99, EUR: 8.29, IRR: 5600000 }, status: "coming" },
  { title: "Moth and Moon", kind: "Novel", images: ["assets/works/placeholder-01.svg", "assets/works/placeholder-12.svg", "assets/works/placeholder-08.svg"], prices: { USD: 11.99, EUR: 11.09, IRR: 7500000 }, status: "released" },
  { title: "Copper Sky", kind: "Short film", images: ["assets/works/placeholder-09.svg", "assets/works/placeholder-14.svg", "assets/works/placeholder-05.svg"], prices: { USD: 2.99, EUR: 2.79, IRR: 1900000 }, status: "released" },
];

// Every image in the catalogue, once each.
const WORKS = [...new Set(CATALOG.flatMap((work) => work.images))];
