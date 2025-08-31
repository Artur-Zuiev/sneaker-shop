// js/zoom.js — image viewer with arrows, keyboard & swipe (de-duplicated + circular nav)
(() => {
  if (window.__imgZoomInit) return;
  window.__imgZoomInit = true;

  // ===== Inline styles (no separate CSS file needed) =====
  const css = `
  dialog.imgbox{ all:unset; position:fixed; inset:0; z-index:13000; display:none;
    align-items:center; justify-content:center; background:rgba(0,0,0,.92) }
  html[data-theme="dark"] dialog.imgbox{ background:rgba(6,8,12,.96) }
  dialog.imgbox[open]{ display:flex }
  .imgbox__img{ max-width:92vw; max-height:88vh; border-radius:12px;
    box-shadow:0 20px 60px rgba(0,0,0,.35); user-select:none; transform:translateZ(0) }
  .imgbox__btn{ position:absolute; height:40px; min-width:40px; padding:0 12px;
    display:flex; align-items:center; justify-content:center; border-radius:10px;
    border:1px solid transparent; cursor:pointer; background:rgba(255,255,255,.92); color:#111;
    box-shadow:0 8px 24px rgba(0,0,0,.18); transition:transform .12s, opacity .15s }
  html[data-theme="dark"] .imgbox__btn{ background:rgba(18,20,24,.88); color:#fff }
  .imgbox__btn:active{ transform:translateY(1px) scale(.98) }
  .imgbox__close{ top:16px; right:16px }
  .imgbox__prev, .imgbox__next{ top:calc(50% - 20px) }
  .imgbox__prev{ left:16px } .imgbox__next{ right:16px }
  .imgbox__counter{ position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
    padding:6px 10px; border-radius:10px; font-size:14px;
    background:rgba(255,255,255,.92); color:#111; box-shadow:0 6px 18px rgba(0,0,0,.18) }
  html[data-theme="dark"] .imgbox__counter{ background:rgba(18,20,24,.88); color:#fff }
  @media (max-width:520px){ .imgbox__img{ max-width:96vw; max-height:78vh; border-radius:10px }
    .imgbox__prev, .imgbox__next{ display:none } /* use swipes on phones */ }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ===== Dialog markup =====
  const dlg = document.createElement("dialog");
  dlg.className = "imgbox";
  dlg.innerHTML = `
    <img class="imgbox__img" alt="">
    <button class="imgbox__btn imgbox__prev" type="button" aria-label="Previous">←</button>
    <button class="imgbox__btn imgbox__next" type="button" aria-label="Next">→</button>
    <button class="imgbox__btn imgbox__close" type="button" aria-label="Close">✕</button>
    <div class="imgbox__counter" aria-live="polite"></div>
  `;
  document.body.appendChild(dlg);

  const imgEl = dlg.querySelector(".imgbox__img");
  const btnPrev = dlg.querySelector(".imgbox__prev");
  const btnNext = dlg.querySelector(".imgbox__next");
  const btnClose = dlg.querySelector(".imgbox__close");
  const counter = dlg.querySelector(".imgbox__counter");

  // ===== Navigation state =====
  let list = []; // [{el, src, alt}]
  let index = 0;

  // Minimal CSS.escape fallback
  const cssEscape = (str) => {
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(str);
    return String(str).replace(/[^\w-]/g, "\\$&");
  };

  // Decide if an <img> should open the zoom
  function isZoomable(img) {
    if (!img || img.tagName !== "IMG") return false;
    if (!img.closest("main")) return false;
    if (!(img.hasAttribute("data-zoom") || img.hasAttribute("data-gallery")))
      return false;
    if (img.closest("header,.site-header,.icon-btn,.badge,nav,footer"))
      return false;
    if (img.hasAttribute("data-no-zoom")) return false;

    const src =
      img.getAttribute("data-full") || img.currentSrc || img.src || "";
    try {
      const u = new URL(src, location.href);
      if (u.origin !== location.origin) return false;
    } catch {
      return false;
    }

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w < 64 || h < 64) return false;

    return true;
  }

  // Normalize URL for duplicate detection
  function normalizeSrc(url) {
    try {
      const u = new URL(url, location.href);
      u.hash = "";
      return u.href.replace(/[\?#].*$/, "");
    } catch {
      return String(url || "");
    }
  }

  // Remove duplicates by normalized src
  function dedupe(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const key = normalizeSrc(it.src);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  // Collect all zoomable images on the page
  function gatherAllZoomables() {
    const items = [...document.querySelectorAll("main img")]
      .filter(isZoomable)
      .map((el) => {
        const src = el.getAttribute("data-full") || el.currentSrc || el.src;
        return { el, src, alt: el.alt || "" };
      });
    return dedupe(items);
  }

  // Collect images by gallery group name
  function gatherByGalleryName(name) {
    const sel = `img[data-gallery="${cssEscape(name)}"]`;
    const imgs = [...document.querySelectorAll(sel)].filter(isZoomable);
    if (!imgs.length) return null;
    const items = imgs.map((el) => ({
      el,
      src: el.getAttribute("data-full") || el.currentSrc || el.src,
      alt: el.alt || "",
    }));
    return dedupe(items);
  }

  // Open viewer at the clicked image
  function openAt(targetImg) {
    const groupName = targetImg.getAttribute("data-gallery");
    list = groupName
      ? gatherByGalleryName(groupName) || gatherAllZoomables()
      : gatherAllZoomables();

    // Prefer exact element index, fallback to src match if dedup removed it
    const byEl = list.findIndex((x) => x.el === targetImg);
    if (byEl >= 0) {
      index = byEl;
    } else {
      const tSrc = normalizeSrc(
        targetImg.getAttribute("data-full") ||
          targetImg.currentSrc ||
          targetImg.src
      );
      const bySrc = list.findIndex((x) => normalizeSrc(x.src) === tSrc);
      index = bySrc >= 0 ? bySrc : 0;
    }

    render();
    try {
      dlg.showModal();
    } catch {
      // Safari fallback
      dlg.setAttribute("open", "");
    }
  }

  function close() {
    if (dlg.open) dlg.close();
    else dlg.removeAttribute("open");
  }

  // Render current slide + preload neighbors
  function render() {
    if (!list.length) return close();
    const item = list[index];
    imgEl.src = item.src;
    imgEl.alt = item.alt || "";
    counter.textContent = `${index + 1} / ${list.length}`;
    // Preload neighbors (circular)
    const prev = list[index - 1] || list[list.length - 1];
    if (prev) new Image().src = prev.src;
    const next = list[index + 1] || list[0];
    if (next) new Image().src = next.src;
  }

  // ===== Circular navigation =====
  function next() {
    if (!list.length) return;
    index = (index + 1) % list.length; // wrap forward
    render();
  }
  function prev() {
    if (!list.length) return;
    index = (index - 1 + list.length) % list.length; // wrap backward
    render();
  }

  // ===== Open on click =====
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img");
    if (!img || !isZoomable(img)) return;
    e.preventDefault();
    openAt(img);
  });

  // ===== Buttons / keyboard / click outside =====
  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", prev);
  btnNext.addEventListener("click", next);

  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close(); // click on the backdrop
  });

  document.addEventListener("keydown", (e) => {
    if (!dlg.open) return;
    if (e.key === "Escape") return void close();
    if (e.key === "ArrowRight") return void next();
    if (e.key === "ArrowLeft") return void prev();
  });

  // ===== Pointer swipes (for touch and mouse) =====
  let startX = 0,
    startY = 0,
    active = false;
  dlg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    active = true;
    startX = e.clientX;
    startY = e.clientY;
  });
  dlg.addEventListener("pointerup", (e) => {
    if (!active) return;
    active = false;
    const dx = e.clientX - startX,
      dy = e.clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  });

  // Tap on left/right side of the image to navigate
  imgEl.addEventListener("click", (e) => {
    const mid = window.innerWidth / 2;
    if (e.clientX < mid) prev();
    else next();
  });
})();
