// ===== CONSTANTS / DOM CACHE =====
const DOM = {
  container: document.getElementById("products"),
  brandFilter: document.getElementById("brand-filter"),
  searchInput: document.getElementById("search-input"),
  sortPrice: document.getElementById("sort-price"),
  tabButtons: document.querySelectorAll(".tab-button"),
  cartCount: document.getElementById("cart-count"),
  themeToggle: document.getElementById("theme-toggle"), // important: click handled by header.js
  toast: document.getElementById("toast"),
};
const CART_KEY = "cart";
const UI_KEY = "uiState";

// ===== THEME (sync with header.js) + TOAST =====
(() => {
  const root = document.documentElement;

  function applyFromStorage() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    updateThemeMeta();
  }

  // initial apply
  applyFromStorage();

  // listen to changes from header.js
  window.addEventListener("storage", (e) => {
    if (e.key === "theme") applyFromStorage();
  });
  window.addEventListener("themechange", applyFromStorage);
})();

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

function showToast(msg) {
  if (!DOM.toast) return;
  DOM.toast.textContent = msg;
  DOM.toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => DOM.toast.classList.remove("show"), 1800);
}

// ===== UI STATE =====
const defaultUI = { brand: "all", q: "", sort: "default" };
let uiState = (() => {
  try {
    return {
      ...defaultUI,
      ...(JSON.parse(localStorage.getItem(UI_KEY)) || {}),
    };
  } catch {
    return { ...defaultUI };
  }
})();
const saveUI = () => localStorage.setItem(UI_KEY, JSON.stringify(uiState));

function resetUIIfFreshVisit() {
  const noQuery = !location.search || location.search === "?";
  if (!noQuery) return;
  uiState = { ...defaultUI };
  saveUI();
}

// ===== CART =====
const normalizeCart = (cart) => {
  if (!Array.isArray(cart)) return [];
  if (
    cart.length &&
    cart[0] &&
    typeof cart[0] === "object" &&
    "id" in cart[0]
  ) {
    return cart
      .filter((i) => i && typeof i === "object" && "id" in i)
      .map((i) => ({
        id: Number(i.id),
        qty: Math.max(1, Number(i.qty) || 1),
        size: i.size ?? null,
        color: i.color ?? null,
      }));
  }
  const map = new Map();
  for (const it of cart) {
    const id = typeof it === "number" ? it : it && it.id;
    if (!id) continue;
    const key = `${Number(id)}||null||null`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([key, qty]) => {
    const [id] = key.split("||");
    return { id: Number(id), qty, size: null, color: null };
  });
};

const getCart = () => {
  try {
    return normalizeCart(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
  } catch {
    return [];
  }
};
const saveCart = (cart) =>
  localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(cart)));
const cartItemsCount = () => getCart().reduce((s, i) => s + i.qty, 0);
function updateCartCount() {
  if (DOM.cartCount) DOM.cartCount.textContent = cartItemsCount();
}

function addToCart(id, sourceImgEl) {
  const cart = getCart();
  const found = cart.find(
    (i) => i.id === id && i.size === null && i.color === null
  );
  if (found) found.qty += 1;
  else cart.push({ id, qty: 1, size: null, color: null });
  saveCart(cart);

  updateCartCount?.();
  window.refreshCartBadge?.(); // sync with header badge
  window.flyToCart?.(sourceImgEl); // nice animation
  showToast("Item added to cart");
}

// ===== RENDER =====
const SVG_PLACEHOLDER = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'>
     <rect width='100%' height='100%' fill='#eee'/>
     <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='18'>
       No image
     </text>
   </svg>`
);

function renderProducts(list) {
  const root = DOM.container;
  if (!root) return;
  root.innerHTML = "";

  if (!list.length) {
    root.innerHTML = "<div class='empty'>No products found.</div>";
    return;
  }

  root.innerHTML = list
    .map(
      (p) => `
      <div class="product-card card" data-id="${p.id}">
        <span class="brand-badge">${p.brand}</span>
        <a href="product.html?id=${p.id}">
          <img class="skeleton" src="${p.image}" alt="${p.name}"
               loading="lazy" decoding="async" referrerpolicy="no-referrer"
               sizes="(max-width: 460px) 100vw, (max-width: 860px) 50vw, 260px"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,${SVG_PLACEHOLDER}'">
          <h3>${p.name}</h3>
          <p class="price">${p.price.toFixed(2)} €</p>
        </a>
        <button class="btn add-to-cart" data-id="${
          p.id
        }" type="button">Add to cart</button>
      </div>`
    )
    .join("");

  wireImageSkeletons(root);
}

function wireImageSkeletons(scope = document) {
  scope.querySelectorAll("img.skeleton").forEach((img) => {
    const done = () => img.classList.remove("skeleton");
    if (img.complete) done();
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

// ===== FILTERS =====
function applyFilters() {
  if (typeof products === "undefined" || !Array.isArray(products)) {
    if (DOM.container)
      DOM.container.innerHTML = "<div class='empty'>Loading products…</div>";
    return;
  }

  const q = uiState.q.trim().toLowerCase();
  let list = products.slice();

  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
  if (uiState.brand !== "all") {
    const b = uiState.brand.trim().toLowerCase();
    list = list.filter(
      (p) =>
        String(p.brand || "")
          .trim()
          .toLowerCase() === b
    );
  }
  if (uiState.sort === "asc") list.sort((a, b) => a.price - b.price);
  else if (uiState.sort === "desc") list.sort((a, b) => b.price - a.price);

  renderProducts(list);
}

// ===== TABS =====
function setActiveTab(brand) {
  DOM.tabButtons.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.brand === brand)
  );

  if (DOM.brandFilter && DOM.brandFilter.value !== brand) {
    DOM.brandFilter.value = brand;
    DOM.brandFilter.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// ===== UTILS =====
function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ===== RIPPLE EFFECT =====
function attachGlobalRipple() {
  document.addEventListener("pointerdown", (e) => {
    const target = e.target.closest(".btn, .tab-button");
    if (!target || e.button !== 0) return;

    const wasRel = getComputedStyle(target).position;
    if (wasRel === "static") target.style.position = "relative";
    target.style.overflow = "hidden";

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    target.querySelectorAll(".ripple").forEach((r) => r.remove());

    const ripple = document.createElement("span");
    ripple.className = "ripple";
    Object.assign(ripple.style, {
      position: "absolute",
      left: x + "px",
      top: y + "px",
      width: "14px",
      height: "14px",
      borderRadius: "9999px",
      background: "currentColor",
      opacity: "0.22",
      transform: "translate(-50%,-50%) scale(0.001)",
      transition:
        "transform .45s cubic-bezier(.22,.61,.36,1), opacity .6s ease",
      pointerEvents: "none",
      willChange: "transform, opacity",
    });

    target.appendChild(ripple);

    const maxX = Math.max(x, rect.width - x);
    const maxY = Math.max(y, rect.height - y);
    const radius = Math.hypot(maxX, maxY);
    const base = 12;
    const scale = (radius * 2) / base;

    requestAnimationFrame(() => {
      ripple.style.transform = `translate(-50%,-50%) scale(${scale})`;
      ripple.style.opacity = "0";
    });

    ripple.addEventListener("transitionend", () => ripple.remove(), {
      once: true,
    });
    setTimeout(() => ripple.remove(), 900);
  });
}

// ===== EVENT LISTENERS =====
const onSearch = debounce(() => {
  if (!DOM.searchInput) return;
  uiState.q = DOM.searchInput.value;
  saveUI();
  applyFilters();
}, 250);

DOM.searchInput?.addEventListener("input", onSearch);

DOM.sortPrice?.addEventListener("change", () => {
  uiState.sort = DOM.sortPrice.value;
  saveUI();
  applyFilters();
});

DOM.brandFilter?.addEventListener("change", () => {
  uiState.brand = DOM.brandFilter.value;
  saveUI();
  setActiveTab(uiState.brand);
  applyFilters();
});

DOM.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    uiState.brand = button.dataset.brand;
    if (uiState.brand === "all") {
      uiState.q = "";
      if (DOM.searchInput) DOM.searchInput.value = "";
    }
    saveUI();
    setActiveTab(uiState.brand);
    applyFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

DOM.container?.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const card = btn.closest(".product-card");
  const img = card?.querySelector("img");
  addToCart(id, img);
});

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  resetUIIfFreshVisit();

  if (DOM.brandFilter) DOM.brandFilter.value = uiState.brand;
  if (DOM.searchInput) DOM.searchInput.value = uiState.q;
  if (DOM.sortPrice) DOM.sortPrice.value = uiState.sort;
  setActiveTab(uiState.brand);

  attachGlobalRipple();

  const t = setInterval(() => {
    if (typeof products !== "undefined" && Array.isArray(products)) {
      clearInterval(t);
      applyFilters();
      updateCartCount();
      window.refreshCartBadge?.(); // sync header badge on first load
    }
  }, 100);
});

// ===== Custom Select (Selectify) =====
(function () {
  function enhanceSelect(sel) {
    const native = typeof sel === "string" ? document.getElementById(sel) : sel;
    if (!native || native.dataset.selectify) return;
    native.dataset.selectify = "1";

    const wrap = document.createElement("div");
    wrap.className = "selectify";
    native.parentNode.insertBefore(wrap, native);
    wrap.appendChild(native);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sf-control";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span class="sf-value"></span><span class="sf-caret" aria-hidden="true"></span>`;
    wrap.appendChild(btn);

    const menu = document.createElement("ul");
    menu.className = "sf-menu";
    menu.setAttribute("role", "listbox");
    menu.id = `sf-${Math.random().toString(36).slice(2)}`;
    btn.setAttribute("aria-controls", menu.id);
    wrap.appendChild(menu);

    function buildMenu() {
      menu.innerHTML = "";
      [...native.options].forEach((opt) => {
        const li = document.createElement("li");
        li.className = "sf-option";
        li.setAttribute("role", "option");
        li.dataset.value = opt.value;
        li.textContent = opt.textContent;
        li.setAttribute("aria-selected", opt.selected ? "true" : "false");
        if (opt.disabled) li.setAttribute("aria-disabled", "true");
        li.tabIndex = -1;
        menu.appendChild(li);
      });
      updateButton();
    }

    function open() {
      wrap.classList.add("sf-open");
      btn.setAttribute("aria-expanded", "true");
      const selIdx = native.selectedIndex > -1 ? native.selectedIndex : 0;
      const items = menu.querySelectorAll(".sf-option");
      if (items[selIdx]) items[selIdx].focus();
      document.addEventListener("click", onDocClick, { once: true });
      document.addEventListener("keydown", onKey);
    }
    function close() {
      wrap.classList.remove("sf-open");
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKey);
    }
    function onDocClick(e) {
      if (!wrap.contains(e.target)) close();
    }
    function onKey(e) {
      const items = [
        ...menu.querySelectorAll('.sf-option:not([aria-disabled="true"])'),
      ];
      let i = items.findIndex((el) => el === document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        btn.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (items[i + 1] || items[0]).focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        (items[i - 1] || items[items.length - 1]).focus();
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const el = document.activeElement;
        if (el && el.classList.contains("sf-option")) choose(el);
      }
    }
    function choose(el) {
      if (el.getAttribute("aria-disabled") === "true") return;
      const val = el.dataset.value;
      native.value = val;
      native.dispatchEvent(new Event("change", { bubbles: true }));
      updateButton();
      close();
      btn.focus();
    }
    function updateButton() {
      const opt = native.options[native.selectedIndex];
      const valueEl = btn.querySelector(".sf-value");
      valueEl.textContent = opt ? opt.textContent : "";
      menu.querySelectorAll(".sf-option").forEach((li) => {
        li.setAttribute(
          "aria-selected",
          li.dataset.value === native.value ? "true" : "false"
        );
      });
    }

    btn.addEventListener("click", () => {
      if (wrap.classList.contains("sf-open")) close();
      else open();
    });
    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".sf-option");
      if (item) choose(item);
    });

    native.addEventListener("change", updateButton);
    buildMenu();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ["brand-filter", "sort-price"].forEach((id) => enhanceSelect(id));
  });
})();
