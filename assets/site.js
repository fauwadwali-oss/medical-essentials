// Mastering Essentials: menu, click-to-load player, library filters, analytics events.
const track = (name, params = {}) => { if (typeof window.gtag === "function") window.gtag("event", name, params); };
const conversionEndpoint = "https://msdrills.com/site-monitoring/api/events";

function conversionEventId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const value = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (char === "x" ? value : (value & 3) | 8).toString(16);
  });
}

function trackCentralYouTubeEngagement() {
  try {
    const body = JSON.stringify({
      site_id: "masteringessentials",
      event_name: "youtube_engagement",
      event_id: conversionEventId()
    });
    const blob = new Blob([body], { type: "text/plain" });
    if (navigator.sendBeacon?.(conversionEndpoint, blob)) return;
    void fetch(conversionEndpoint, { method: "POST", body, headers: { "content-type": "text/plain" }, keepalive: true }).catch(() => {});
  } catch {
    // Measurement must never interrupt a lesson or outbound action.
  }
}

document.addEventListener("click", event => {
  if (!event.isTrusted) return;
  const anchor = event.target instanceof Element ? event.target.closest("a") : null;
  if (!anchor) return;
  try {
    const url = new URL(anchor.href, location.href);
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(url.hostname)) trackCentralYouTubeEngagement();
  } catch { /* Ignore malformed links. */ }
});

// Mobile menu
const toggle = document.querySelector(".menu-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };
  document.querySelectorAll(".site-nav a").forEach(a => a.addEventListener("click", close));
  matchMedia("(max-width: 860px)").addEventListener("change", e => { if (!e.matches) close(); });
}

// Share: the WhatsApp link works on its own; the other button prefers the phone's share
// sheet and falls back to copying the link.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = Object.assign(document.createElement("textarea"), { value: text });
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;opacity:0";
    document.body.append(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* not supported */ }
    field.remove();
    return ok;
  }
}
document.querySelectorAll(".share").forEach(bar => {
  const { shareUrl: url, shareTitle: title } = bar.dataset;
  const status = bar.querySelector(".share-status");
  const say = text => { status.textContent = text; setTimeout(() => { status.textContent = ""; }, 4000); };
  bar.querySelector('[data-share="whatsapp"]').addEventListener("click", () =>
    track("share", { method: "whatsapp", content_type: "page", item_id: location.pathname }));
  bar.querySelector('[data-share="native"]').addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        track("share", { method: "native", content_type: "page", item_id: location.pathname });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return; // closed the share sheet
      }
    }
    if (await copyText(url)) {
      say("لنک کاپی ہو گیا");
      track("share", { method: "copy", content_type: "page", item_id: location.pathname });
    } else {
      say(url);
    }
  });
});

document.querySelectorAll("[data-event]").forEach(el =>
  el.addEventListener("click", () => track(el.dataset.event, { link_url: el.href || "" })));

// Library: search, topic filters, sort, paging. Cards are pre-rendered so crawlers and
// no-JS visitors still get every link; this only hides and reorders them.
const grid = document.querySelector("#library-grid");
if (grid) {
  const PAGE = 30;
  const cards = [...grid.children];
  const input = document.querySelector("#library-q");
  const sort = document.querySelector("#library-sort");
  const more = document.querySelector("#library-more");
  const status = document.querySelector("#library-status");
  const empty = document.querySelector("#library-empty");
  const chips = [...document.querySelectorAll("[data-filter]")];
  const params = new URLSearchParams(location.search);
  const normalize = s => s.normalize("NFKC").toLocaleLowerCase()
    .replace(/[ً-ٰٟـ]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ه/g, "ہ").trim();
  const urdu = n => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  let filter = "all";
  let limit = PAGE;
  let searchTimer;

  input.value = params.get("q") || "";
  if (params.get("sort") === "popular") sort.value = "popular";
  const wanted = params.get("topic");
  if (wanted && chips.some(c => c.dataset.filter === `topic:${wanted}`)) filter = `topic:${wanted}`;

  function apply() {
    const words = normalize(input.value).split(/\s+/).filter(Boolean);
    const [kind, value] = filter.split(":");
    const order = sort.value === "popular"
      ? [...cards].sort((a, b) => b.dataset.views - a.dataset.views)
      : [...cards].sort((a, b) => a.dataset.order - b.dataset.order);
    const matches = order.filter(card => {
      if (kind === "topic" && card.dataset.topic !== value) return false;
      if (kind === "track" && card.dataset.track !== value) return false;
      const title = normalize(`${card.dataset.title} ${card.dataset.roman || ""}`);
      return words.every(w => title.includes(w));
    });
    const visible = new Set(matches.slice(0, limit));
    grid.append(...order);
    cards.forEach(card => { card.hidden = !visible.has(card); });
    chips.forEach(c => c.setAttribute("aria-pressed", String(c.dataset.filter === filter)));
    status.textContent = `${urdu(matches.length)} ویڈیوز`;
    empty.hidden = matches.length > 0;
    more.hidden = matches.length <= limit;
  }

  input.addEventListener("input", () => {
    limit = PAGE;
    apply();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (input.value.trim()) track("search", { search_term: input.value.trim() }); }, 1200);
  });
  sort.addEventListener("change", () => { limit = PAGE; apply(); });
  chips.forEach(chip => chip.addEventListener("click", () => {
    filter = chip.dataset.filter;
    limit = PAGE;
    apply();
    track("select_content", { content_type: "library_filter", item_id: filter });
  }));
  more.addEventListener("click", () => { limit += PAGE; apply(); });
  if (input.value.trim()) track("search", { search_term: input.value.trim() });
  apply();
}
