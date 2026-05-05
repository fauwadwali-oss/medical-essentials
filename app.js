const shortsGrid = document.querySelector("#shorts-grid");
const shortsStatus = document.querySelector("#shorts-status");

const fallbackShorts = [
  {
    title: "Hospital Price Transparency Is Now Law — Protect Your Revenue Cycle",
    youtube_id: "6Rvfx7goDPM",
    previewOnly: true
  },
  {
    title: "Why EHR Implementations Fail — And How to Fix It",
    youtube_id: "PzCZsrZR4Kk",
    previewOnly: true
  },
  {
    title: "Healthcare Supply Chain Is a Clinical Risk Function — Not Back Office",
    youtube_id: "1mqwCytUYR4",
    previewOnly: true
  },
  {
    title: "Why Hospitals Lose Money on Employed Physicians",
    youtube_id: "f48r-CHVp74",
    previewOnly: true
  },
  {
    title: "Why Health Tech Pilots Fail: 4 Rules for Startup Partnerships",
    youtube_id: "UkMAT47BXQ0",
    previewOnly: true
  },
  {
    title: "Pharmacy Spend Strategy: PBM, 340B, Specialty Rx",
    youtube_id: "eubEHn1sawY",
    previewOnly: true
  }
];

function thumbnailFor(short) {
  if (!short.youtube_id) {
    return "";
  }

  return short.thumbnail_url || `https://i.ytimg.com/vi/${encodeURIComponent(short.youtube_id)}/maxresdefault.jpg`;
}

function cleanTitle(title) {
  return title
    .replace(/\s+#\S+/g, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+for MHA\s*&\s*MBA Students/gi, "")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderShorts(shorts, sourceLabel) {
  if (!shortsGrid || !shortsStatus) {
    return;
  }

  shortsGrid.innerHTML = shorts
    .map((short) => {
      const title = cleanTitle(short.title);
      const safeTitle = escapeHtml(title);
      const safeYoutubeId = encodeURIComponent(short.youtube_id);
      const url = `https://www.youtube.com/shorts/${safeYoutubeId}`;
      const thumbnail = thumbnailFor(short);
      const fallbackThumbnail = short.thumbnail_url || !short.youtube_id
        ? ""
        : `https://i.ytimg.com/vi/${safeYoutubeId}/hqdefault.jpg`;
      const fallbackAttr = fallbackThumbnail ? ` data-fallback-src="${escapeHtml(fallbackThumbnail)}"` : "";
      const imageMarkup = thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="eager" decoding="async"${fallbackAttr} />` : "";
      const cardClass = thumbnail ? "short-card" : "short-card short-card-missing-image";
      return `
        <article class="${cardClass}">
          <a href="${url}" target="_blank" rel="noreferrer" aria-label="Watch ${safeTitle} on YouTube">
            ${imageMarkup}
            <span>Watch short</span>
            <h3>${safeTitle}</h3>
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

async function loadShortsFromExport() {
  try {
    const response = await fetch("data/shorts.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Static export returned ${response.status}`);
    }

    const payload = await response.json();
    const shorts = Array.isArray(payload.shorts) ? payload.shorts.slice(0, 12) : [];

    if (shorts.length === 0) {
      throw new Error("Static export did not include shorts.");
    }

    renderShorts(shorts, `Showing ${shorts.length} of ${payload.count} Mastering Essentials trending shorts.`);
  } catch (error) {
    console.error("Could not load static shorts export:", error);
    renderShorts(fallbackShorts, "Showing a starter selection from the 273-short Mastering Essentials library.");
  }
}

loadShortsFromExport();
