const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const filterButtons = document.querySelectorAll(".filter-button[data-filter]");
const videoGrid = document.querySelector("#video-grid");
let loadedShorts = [];

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

function normalizeTrack(short, title) {
  if (short.track === "HEALTH") return "health";
  if (short.track === "MHA_MBA" || short.track === "mhamba") return "mhamba";
  if (short.track === "MPH" || short.track === "mph") return "mph";
  return classifyTrack(title);
}

function homepageShorts(shorts, filter = "all") {
  return shorts.map(short => ({...short, homepageTrack: normalizeTrack(short, short.title || "")}))
    .filter(short => filter === "all" || short.homepageTrack === filter).slice(0, 8);
}

function renderVideoCards(shorts) {
  if (!videoGrid || !Array.isArray(shorts) || !shorts.length) return;

  videoGrid.innerHTML = homepageShorts(shorts, document.querySelector(".filter-button.active")?.dataset.filter || "all").map((short) => {
    const title = short.title || "Mastering Essentials کی اردو ویڈیو";
    const track = short.homepageTrack || normalizeTrack(short, title);
    const trackLabel = track === "health" ? "صحت" : track === "mhamba" ? "MHA/MBA" : "MPH";
    const safeTitle = escapeHtml(title);
    const rawId = short.youtube_id || "";
    const youtubeId = encodeURIComponent(rawId);
    const url = short.url || `https://www.youtube.com/shorts/${youtubeId}`;
    const thumb = rawId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "";
    const urdu = leadsWithUrdu(title);
    const titleLang = ' lang="ur" dir="auto"';
    const thumbImg = thumb
      ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" width="480" height="360" onerror="this.remove()" />`
      : "";

    return `
      <article class="video-card" data-track="${track}">
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="${safeTitle}">
          <div class="thumb ${track === "mhamba" ? "thumb-gold" : "thumb-teal"}">
            ${thumbImg}
            <span>${trackLabel}</span>
            <small lang="ur" dir="rtl">دیکھیں</small>
          </div>
          <h3${titleLang}>${safeTitle}</h3>
          <p lang="ur" dir="rtl">${track === "health" ? "روزمرہ صحت کے بارے میں اردو ویڈیو۔" : track === "mhamba" ? "ہیلتھ کیئر مینجمنٹ، فنانس، accounting اور leadership آسان اردو میں۔" : "عوامی صحت، بچاؤ، policy اور health systems آسان اردو میں۔"}</p>
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
    loadedShorts = payload.shorts || [];
    renderVideoCards(loadedShorts);
    applyFilter(document.querySelector(".filter-button.active")?.dataset.filter || "all");
  } catch (error) {
    console.error("Could not load shorts:", error);
  }
}

function applyFilter(filter) {
  if (loadedShorts.length) renderVideoCards(loadedShorts);
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
      item.setAttribute("aria-pressed", String(isActive));
    });

    applyFilter(filter);
  });
});

if (videoGrid) loadShorts();

// Let keyboard users dismiss the mobile navigation without moving focus away.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
    document.body.classList.remove("menu-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.focus();
  }
});
