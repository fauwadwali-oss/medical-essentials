// Shared by build-site.mjs and make-share-cards.mjs so the page title and the share card match.

// Some early uploads have the description glued onto the title. Keep the first sentence.
export function cleanTitle(raw) {
  const title = String(raw).replace(/#\S+/g, "").trim();
  for (let i = 0; i < title.length - 1; i++) {
    if (".؟?".includes(title[i]) && !/\s/.test(title[i + 1])) return title.slice(0, i + 1).trim();
  }
  return title;
}
