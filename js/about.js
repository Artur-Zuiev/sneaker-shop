// js/about.js — animations and logic for the "About" page
// IMPORTANT: The theme switch is handled only in header.js.
// This file only synchronizes and reacts to theme changes.

(function initThemeSync() {
  const root = document.documentElement;

  function applyFromStorage() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    updateThemeMeta();
  }

  // Update <meta name="theme-color"> dynamically based on current theme background
  function updateThemeMeta() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const bg =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim() || "#ffffff";
    meta.setAttribute("content", bg);
  }

  // Initial setup + listen to changes from header.js
  applyFromStorage();
  window.addEventListener("storage", (e) => {
    if (e.key === "theme") applyFromStorage();
  });
  window.addEventListener("themechange", applyFromStorage); // header.js dispatches this event
})();

// Cart counter near the logo (if #cart-count exists)
(function initCartCountOnce() {
  const countEl = document.getElementById("cart-count");
  if (!countEl) return;

  // Normalize cart structure from storage
  function normalizeCart(cart) {
    if (!Array.isArray(cart)) return [];
    if (
      cart.length &&
      typeof cart[0] === "object" &&
      cart[0] &&
      "id" in cart[0]
    ) {
      return cart.map((i) => ({
        id: Number(i.id),
        qty: Math.max(1, Number(i.qty) || 1),
      }));
    }
    const map = new Map();
    for (const it of cart) {
      const id = typeof it === "number" ? it : it && it.id;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return Array.from(map, ([id, qty]) => ({ id: Number(id), qty }));
  }

  // Read cart from localStorage
  function readCart() {
    try {
      return normalizeCart(JSON.parse(localStorage.getItem("cart") || "[]"));
    } catch {
      return [];
    }
  }

  // Update the counter UI
  function updateCount() {
    countEl.textContent = readCart().reduce(
      (s, i) => s + (Number(i.qty) || 0),
      0
    );
  }

  updateCount();
  window.addEventListener("storage", (e) => {
    if (e.key === "cart") updateCount();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateCount();
  });
})();

// Smooth counting animation for "Statistics" section numbers
document.addEventListener("DOMContentLoaded", () => {
  const nums = document.querySelectorAll(".stat-num");
  const ov = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const raw = String(el.dataset.count || "0");
        const isSuffix = /[A-Za-z]+$/.test(raw); // e.g. "120K"
        const suffix = isSuffix ? raw.match(/[A-Za-z]+$/)[0] : "";
        const target = parseFloat(raw);
        const duration = 900;
        const start = performance.now();

        function tick(t) {
          const p = Math.min(1, (t - start) / duration);
          const val = Math.floor(target * (0.2 + 0.8 * p));
          el.textContent = (isNaN(val) ? 0 : val) + suffix;
          if (p < 1) requestAnimationFrame(tick);
          else obs.unobserve(el);
        }

        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.4 }
  );

  nums.forEach((el) => ov.observe(el));
});
