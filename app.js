const shortsGrid = document.querySelector("#shorts-grid");
const shortsStatus = document.querySelector("#shorts-status");

function thumbnailFor(short) {
  if (!short.youtube_id) return "";
  return short.thumbnail_url || `https://i.ytimg.com/vi/${encodeURIComponent(short.youtube_id)}/hq720.jpg`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const URDU_RANGE = /[؀-ۿݐ-ݿ]/;

function leadsWithUrdu(title) {
  const stripped = title.trim();
  if (!stripped) return false;
  for (const char of stripped) {
    if (URDU_RANGE.test(char)) return true;
    if (/[A-Za-z]/.test(char)) return false;
  }
  return URDU_RANGE.test(stripped);
}

function renderShorts(shorts, sourceLabel) {
  if (!shortsGrid || !shortsStatus) return;

  shortsGrid.innerHTML = shorts
    .map((short) => {
      const safeTitle = escapeHtml(short.title || "");
      const safeYoutubeId = encodeURIComponent(short.youtube_id);
      const url = short.url || `https://www.youtube.com/shorts/${safeYoutubeId}`;
      const thumb = thumbnailFor(short);
      const fallbackThumb = short.youtube_id
        ? `https://i.ytimg.com/vi/${safeYoutubeId}/hqdefault.jpg`
        : "";
      const fallbackAttr = fallbackThumb
        ? ` data-fallback-src="${escapeHtml(fallbackThumb)}"`
        : "";
      const imageMarkup = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async"${fallbackAttr} />`
        : "";
      const cardClass = thumb ? "short-card" : "short-card short-card-missing-image";
      const isUrdu = leadsWithUrdu(short.title || "");
      const titleClass = isUrdu ? "" : " class=\"lang-en\"";
      const langAttr = isUrdu ? ` lang=\"ur\"` : "";

      return `
        <article class="${cardClass}">
          <a href="${url}" target="_blank" rel="noreferrer" aria-label="Watch on YouTube">
            ${imageMarkup}
            <span class="watch-label">Watch short</span>
            <h3${titleClass}${langAttr}>${safeTitle}</h3>
          </a>
        </article>
      `;
    })
    .join("");

  shortsGrid.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      const fallbackSrc = image.dataset.fallbackSrc;
      if (fallbackSrc && image.src !== fallbackSrc) {
        image.src = fallbackSrc;
        image.removeAttribute("data-fallback-src");
        return;
      }
      image.closest(".short-card")?.classList.add("short-card-missing-image");
      image.remove();
    });
  });

  shortsStatus.textContent = sourceLabel;
}

async function loadShorts() {
  try {
    const response = await fetch("data/shorts.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`shorts.json returned ${response.status}`);
    const payload = await response.json();
    const shorts = Array.isArray(payload.shorts) ? payload.shorts : [];
    if (!shorts.length) throw new Error("shorts.json has no entries");

    renderShorts(
      shorts,
      `Showing ${shorts.length} shorts from @MasteringEssentials.`
    );
  } catch (error) {
    console.error("Could not load shorts:", error);
    if (shortsStatus) {
      shortsStatus.textContent =
        "Could not load shorts. Visit the YouTube channel for the latest videos.";
    }
  }
}

loadShorts();
