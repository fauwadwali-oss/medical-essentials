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

function normalizeTrack(short, title) {
  if (short.track === "MHA_MBA" || short.track === "mhamba") return "mhamba";
  if (short.track === "MPH" || short.track === "mph") return "mph";
  return classifyTrack(title);
}

function homepageShorts(shorts) {
  const enriched = shorts.map((short) => ({
    ...short,
    homepageTrack: normalizeTrack(short, short.title || "")
  }));
  const mhamba = enriched.filter((short) => short.homepageTrack === "mhamba").slice(0, 4);
  const mph = enriched.filter((short) => short.homepageTrack === "mph").slice(0, 4);
  const selected = [...mhamba, ...mph];
  return selected.length >= 4 ? selected : enriched.slice(0, 8);
}

function renderVideoCards(shorts) {
  if (!videoGrid || !Array.isArray(shorts) || !shorts.length) return;

  videoGrid.innerHTML = homepageShorts(shorts).map((short) => {
    const title = short.title || "Mastering Essentials کی اردو ویڈیو";
    const track = short.homepageTrack || normalizeTrack(short, title);
    const trackLabel = track === "mhamba" ? "MHA/MBA" : "MPH";
    const safeTitle = escapeHtml(title);
    const youtubeId = encodeURIComponent(short.youtube_id || "");
    const url = short.url || `https://www.youtube.com/shorts/${youtubeId}`;
    const urdu = leadsWithUrdu(title);
    const titleLang = urdu ? ' lang="ur" dir="rtl"' : "";

    return `
      <article class="video-card" data-track="${track}">
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
          <div class="thumb ${track === "mhamba" ? "thumb-gold" : "thumb-teal"}">
            <span>${trackLabel}</span>
            <strong${titleLang}>${safeTitle}</strong>
            <small lang="ur" dir="rtl">دیکھیں</small>
          </div>
          <h3${titleLang}>${safeTitle}</h3>
          <p lang="ur" dir="rtl">${track === "mhamba" ? "ہیلتھ کیئر مینجمنٹ، فنانس، accounting اور leadership آسان اردو میں۔" : "عوامی صحت، بچاؤ، policy اور health systems آسان اردو میں۔"}</p>
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
