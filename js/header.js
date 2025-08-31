// js/header.js — Header + Theme toggle + Cart badge + FlyToCart + Mobile menu
(function injectHeader() {
  const host = document.getElementById("site-header");
  if (!host) return;

  const path = (location.pathname || "").toLowerCase();
  const isCatalog =
    path.endsWith("/index.html") || path.endsWith("/") || path === "";
  const isCart = path.endsWith("/cart.html");
  const isAbout = path.endsWith("/about.html");

  // ----- Render header layout -----
  host.innerHTML = `
  <div class="container nav">
    <div class="brand">
      <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-controls="topnav" aria-expanded="false">☰</button>
      <span class="dot" aria-hidden="true"></span>
      <span>Sneaker Shop</span>
    </div>

    <nav class="topnav" id="topnav" aria-label="Main navigation">
      <a href="index.html" class="nav-link ${isCatalog ? "active" : ""}" ${
    isCatalog ? 'aria-current="page"' : ""
  }>
        <span class="nav-icon" aria-hidden="true">🏷️</span>
        <span class="nav-text">Catalog</span>
      </a>
      <a href="about.html" class="nav-link ${isAbout ? "active" : ""}" ${
    isAbout ? 'aria-current="page"' : ""
  }>
        <span class="nav-icon" aria-hidden="true">💬</span>
        <span class="nav-text">About</span>
      </a>
      <a href="cart.html" class="nav-link ${isCart ? "active" : ""}" ${
    isCart ? 'aria-current="page"' : ""
  }>
        <span class="nav-icon" aria-hidden="true">🛒</span>
        <span class="nav-text">Cart</span>
      </a>
    </nav>

    <div class="actions">
      <button id="theme-toggle" class="icon-btn theme-toggle" title="Theme" aria-label="Toggle theme">🌓</button>
      <a href="cart.html" id="cart-link" class="icon-btn" aria-label="Cart">
        🛒
        <span class="badge" id="cart-badge" aria-label="Cart items" style="display:none">
          <span id="cart-count"></span>
        </span>
      </a>
    </div>
  </div>
`;

  host.classList.add("site-header");

  // ----- Body offset for sticky header -----
  const adjustHeaderOffset = () => {
    const h = Math.ceil(host.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-h", h + "px");
  };
  adjustHeaderOffset();
  window.addEventListener("load", adjustHeaderOffset);
  window.addEventListener("resize", adjustHeaderOffset);
  window.addEventListener("themechange", adjustHeaderOffset);
  new MutationObserver(adjustHeaderOffset).observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  // ----- Shadow / compact mode on scroll -----
  (function smartHeader() {
    const el = host;
    const onScroll = () => {
      const y = window.scrollY || 0;
      el.classList.toggle("header--scrolled", y > 4);
      el.classList.toggle("header--compact", y > 120);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  })();

  // ----- Theme (persist + sync across tabs) -----
  (function initThemeOnce() {
    if (window.__themeInit) return;
    window.__themeInit = true;

    const root = document.documentElement;
    const ensureMeta = () => {
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      return meta;
    };
    const apply = (mode) => {
      if (mode === "dark") root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      ensureMeta().setAttribute(
        "content",
        mode === "dark" ? "#0a0d18" : "#f6f7fb"
      );
      window.dispatchEvent(
        new CustomEvent("themechange", { detail: { theme: mode } })
      );
    };
    const getSaved = () =>
      localStorage.getItem("theme") === "dark" ? "dark" : "light";
    apply(getSaved());

    const bindToggle = () => {
      const btn = document.getElementById("theme-toggle");
      if (!btn || btn.__themeBound) return;
      btn.__themeBound = true;
      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          const next = getSaved() === "dark" ? "light" : "dark";
          localStorage.setItem("theme", next);
          apply(next);
        },
        { capture: true }
      );
    };
    bindToggle();
    document.addEventListener("DOMContentLoaded", bindToggle);
    requestAnimationFrame(bindToggle);

    // Cross-tab sync
    window.addEventListener("storage", (e) => {
      if (e.key === "theme" && e.newValue) {
        apply(e.newValue === "dark" ? "dark" : "light");
      }
    });
  })();

  // ----- Cart badge -----
  function normalizeCart(raw) {
    if (!Array.isArray(raw)) return [];
    if (raw.length && typeof raw[0] === "object") {
      return raw.map((it) => ({
        id: Number(it.id),
        qty: Math.max(1, Number(it.qty ?? it.quantity ?? 1)),
        size: it.size ?? null,
        color: it.color ?? null,
      }));
    }
    const map = new Map();
    for (const x of raw) {
      const id = typeof x === "number" ? x : x && x.id;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return [...map.entries()].map(([id, qty]) => ({ id: Number(id), qty }));
  }

  (function initCartBadgeOnce() {
    if (window.__cartBadgeInit) return;
    window.__cartBadgeInit = true;

    const badge = document.getElementById("cart-badge");
    const countEl = document.getElementById("cart-count");

    const parseCart = () => {
      try {
        const raw = localStorage.getItem("cart");
        if (!raw) return [];
        return normalizeCart(JSON.parse(raw));
      } catch {
        return [];
      }
    };

    const getQtySum = (items) =>
      items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    const updateCartBadge = () => {
      const qty = getQtySum(parseCart());
      if (badge && countEl) {
        if (qty > 0) {
          countEl.textContent = String(qty);
          badge.style.display = "";
          badge.setAttribute("aria-hidden", "false");
        } else {
          countEl.textContent = "";
          badge.style.display = "none";
          badge.setAttribute("aria-hidden", "true");
        }
      }
    };

    window.refreshCartBadge = updateCartBadge;
    updateCartBadge();

    window.addEventListener("storage", (e) => {
      if (e.key === "cart") updateCartBadge();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") updateCartBadge();
    });
  })();

  // ----- Mobile menu -----
  (function mobileMenu() {
    const btn = document.getElementById("menu-toggle");
    const nav = document.getElementById("topnav");
    if (!btn || !nav) return;

    const close = () => {
      host.classList.remove("menu-open");
      btn.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      host.classList.add("menu-open");
      btn.setAttribute("aria-expanded", "true");
    };

    btn.addEventListener("click", () => {
      const opened = host.classList.contains("menu-open");
      opened ? close() : open();
    });

    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) close();
    });

    const mq = window.matchMedia("(min-width: 769px)");
    mq.addEventListener?.("change", (ev) => {
      if (ev.matches) close();
    });
  })();
})();

// ----- Fly-to-Cart animation -----
(function setupFlyToCart() {
  if (window.flyToCart) return;

  function getCartTargetPoint() {
    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        cs.display !== "none" &&
        cs.visibility !== "hidden"
      );
    };

    const link = document.getElementById("cart-link");
    if (isVisible(link)) {
      const r = link.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: link };
    }
    return { x: window.innerWidth - 24, y: 24, el: null };
  }

  function pulseCartIcon() {
    const { el } = getCartTargetPoint();
    if (!el || !el.animate) return;
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.15)" },
        { transform: "scale(1)" },
      ],
      {
        duration: 350,
        easing: "cubic-bezier(.22,.61,.36,1)",
      }
    );
  }

  function flyToCart(sourceEl, opts = {}) {
    if (!sourceEl) return;
    const img =
      sourceEl.tagName?.toLowerCase() === "img"
        ? sourceEl
        : sourceEl.querySelector?.("img");
    if (!img) return;

    const imgRect = img.getBoundingClientRect();
    const { x: tx, y: ty } = getCartTargetPoint();
    const startX = imgRect.left + imgRect.width / 2;
    const startY = imgRect.top + imgRect.height / 2;
    const dx = tx - startX;
    const dy = ty - startY;

    const duration = opts.duration ?? 750;
    const endScale = opts.endScale ?? 0.16;
    const midLift = opts.midLift ?? 88;
    const tiltDeg = opts.tiltDeg ?? 22;

    const clone = img.cloneNode(true);
    Object.assign(clone.style, {
      position: "fixed",
      left: imgRect.left + "px",
      top: imgRect.top + "px",
      width: imgRect.width + "px",
      height: imgRect.height + "px",
      margin: 0,
      zIndex: 12000,
      pointerEvents: "none",
      borderRadius: "16px",
      boxShadow: "0 12px 28px rgba(0,0,0,.28)",
      transformOrigin: "50% 50%",
    });

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: "0",
      height: "0",
      perspective: "800px",
      zIndex: 12000,
      pointerEvents: "none",
    });
    document.body.appendChild(wrapper);
    wrapper.appendChild(clone);

    const kf = [
      {
        transform: "translate(0,0) scale(.92) rotate(0deg)",
        opacity: 1,
        offset: 0,
      },
      {
        transform: `translate(${dx * 0.58}px, ${
          dy * 0.58 - midLift
        }px) scale(.55) rotate(${tiltDeg / 2}deg)`,
        opacity: 0.9,
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${endScale}) rotate(${tiltDeg}deg)`,
        opacity: 0.14,
        offset: 1,
      },
    ];

    const anim = clone.animate(kf, {
      duration,
      easing: "cubic-bezier(.22,.61,.36,1)",
      fill: "forwards",
    });
    anim.addEventListener("finish", () => {
      wrapper.remove();
      window.refreshCartBadge?.();
      pulseCartIcon();
    });
  }

  window.flyToCart = flyToCart;
})();
