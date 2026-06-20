const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const filterButtons = document.querySelectorAll(".filter-button");
const videoGrid = document.querySelector("#video-grid");

menuToggle?.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("menu-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    document.body.classList.remove("menu-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

const URDU_RANGE = /[\u0600-\u06ff\u0750-\u077f]/;
const MHAMBA_HINTS = [
  "mha",
  "mba",
  "mhamba",
  "cphq",
  "healthcare",
  "hospital",
  "leadership",
  "quality",
  "admin",
  "management",
  "finance",
  "accounting",
  "cost",
  "insurance",
  "policy"
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function leadsWithUrdu(title) {
  for (const char of title.trim()) {
    if (URDU_RANGE.test(char)) return true;
    if (/[A-Za-z]/.test(char)) return false;
  }
  return false;
}

function classifyTrack(title) {
  const normalized = title.toLowerCase();
  return MHAMBA_HINTS.some((hint) => normalized.includes(hint)) ? "mhamba" : "mph";
}

function thumbnailFor(short) {
  if (!short.youtube_id) return "";
  return short.thumbnail_url || `https://i.ytimg.com/vi/${encodeURIComponent(short.youtube_id)}/hq720.jpg`;
}

function renderVideoCards(shorts) {
  if (!videoGrid || !Array.isArray(shorts) || !shorts.length) return;

  videoGrid.innerHTML = shorts.slice(0, 8).map((short) => {
    const title = short.title || "Mastering Essentials Urdu video";
    const track = classifyTrack(title);
    const trackLabel = track === "mhamba" ? "MHAMBA" : "MPH";
    const safeTitle = escapeHtml(title);
    const youtubeId = encodeURIComponent(short.youtube_id || "");
    const url = short.url || `https://www.youtube.com/shorts/${youtubeId}`;
    const thumbnail = thumbnailFor(short);
    const urdu = leadsWithUrdu(title);
    const titleLang = urdu ? ' lang="ur" dir="rtl"' : "";

    return `
      <article class="video-card" data-track="${track}">
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
          <div class="thumb ${track === "mhamba" ? "thumb-gold" : "thumb-teal"}">
            ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async" />` : ""}
            <span>${trackLabel}</span>
            <strong${titleLang}>${safeTitle}</strong>
            <small>Watch</small>
          </div>
          <h3${titleLang}>${safeTitle}</h3>
          <p>${track === "mhamba" ? "Healthcare management and leadership in Urdu." : "Public health and health systems explained in Urdu."}</p>
        </a>
      </article>
    `;
  }).join("");
}

async function loadShorts() {
  try {
    const response = await fetch("data/shorts.json", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    renderVideoCards(payload.shorts);
  } catch (error) {
    console.error("Could not load shorts:", error);
  }
}

function applyFilter(filter) {
  document.querySelectorAll(".video-card").forEach((card) => {
    const shouldShow = filter === "all" || card.dataset.track === filter;
    card.classList.toggle("is-hidden", !shouldShow);
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter || "all";

    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });

    applyFilter(filter);
  });
});

loadShorts();
