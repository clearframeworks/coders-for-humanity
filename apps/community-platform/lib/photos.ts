// Downloaded from the linked Unsplash pages under https://unsplash.com/license.
// Editorial imagery only; the people pictured are not presented as CFH members.
export const photos = {
  collaboration: {
    src: "/photos/collaboration.jpg",
    alt: "People working together on laptops around a wooden table",
    photographer: "Annie Spratt",
    source:
      "https://unsplash.com/photos/group-of-people-using-laptop-computer-QckxruozjRg",
  },
  workshop: {
    src: "/photos/workshop.jpg",
    alt: "A small group sharing a workspace with laptops and notebooks",
    photographer: "Annie Spratt",
    source:
      "https://unsplash.com/photos/selective-focus-photography-of-people-sits-in-front-of-table-inside-room-sggw4-qDD54",
  },
  growing: {
    src: "/photos/growing.jpg",
    alt: "Hands holding soil and a young green plant",
    photographer: "Noah Buscher",
    source:
      "https://unsplash.com/photos/hands-holding-small-plant-seedling-in-soil-x8ZStukS2PM",
  },
  library: {
    src: "/photos/library.jpg",
    alt: "Sunlight falling across shelves of books in a library",
    photographer: "Dmitry Spravko",
    source:
      "https://unsplash.com/photos/rows-of-books-on-library-shelves-lLtNLh7EkbE",
  },
} as const;
export type PhotoName = keyof typeof photos;
export function programPhoto(slug?: string): PhotoName {
  if (slug === "food" || slug === "environment") return "growing";
  if (slug === "education" || slug === "open-science") return "library";
  return "collaboration";
}
