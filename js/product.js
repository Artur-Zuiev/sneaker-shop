// js/product.js — product page: gallery with arrows + options + cart

/* ========== TOAST ========== */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ========== HELPERS ========== */
function getProductIdFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}
function findProductById(id) {
  if (typeof products === "undefined" || !Array.isArray(products)) return null;
  return products.find((p) => Number(p.id) === Number(id)) || null;
}

/* ------- cart helpers ------- */
function normalizeCart(cart) {
  if (!Array.isArray(cart)) return [];
  // New, structured format (with variants)
  if (
    cart.length &&
    typeof cart[0] === "object" &&
    cart[0] &&
    "id" in cart[0]
  ) {
    return cart.map((i) => ({
      id: Number(i.id),
      qty: Math.max(1, Number(i.qty) || 1),
      size: i.size ?? null,
      color: i.color ?? null,
    }));
  }
  // Legacy flat arrays → collapse to {id, qty}
  const map = new Map();
  for (const it of cart) {
    const id = typeof it === "number" ? it : it && it.id;
    if (!id) continue;
    const key = `${id}||null||null`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([k, qty]) => {
    const [id] = k.split("||");
    return { id: Number(id), qty, size: null, color: null };
  });
}
function readCart() {
  try {
    return normalizeCart(JSON.parse(localStorage.getItem("cart") || "[]"));
  } catch {
    return [];
  }
}
function writeCart(cart) {
  localStorage.setItem("cart", JSON.stringify(normalizeCart(cart)));
}
function cartItemsCount() {
  return readCart().reduce((s, i) => s + i.qty, 0);
}
function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = cartItemsCount();
}
function addVariantToCart({ id, size, color }) {
  const cart = readCart();
  const idx = cart.findIndex(
    (i) => i.id === id && i.size === size && i.color === color
  );
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id, size: size || null, color: color || null, qty: 1 });
  writeCart(cart);
  window.refreshCartBadge?.();
  updateCartCount();
  showToast("Item added to cart");
}

/* ======= Tiny hit ring (cosmetic) ======= */
function hitRingAt(x, y) {
  const ring = document.createElement("div");
  ring.className = "cart-hit";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  document.body.appendChild(ring);
  requestAnimationFrame(() => ring.classList.add("go"));
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
}

/* ======= GALLERY: arrows (single source of truth) ======= */
function enhanceGalleryWithArrows(gallery) {
  if (!gallery) return;

  // Remove any previous arrows if re-render happens
  gallery.querySelectorAll(".gallery-arrow").forEach((el) => el.remove());

  const left = document.createElement("button");
  const right = document.createElement("button");
  left.className = "gallery-arrow left";
  right.className = "gallery-arrow right";
  left.type = right.type = "button";
  left.setAttribute("aria-label", "Previous photo");
  right.setAttribute("aria-label", "Next photo");
  left.textContent = "‹";
  right.textContent = "›";
  gallery.append(left, right);

  const main = gallery.querySelector(".pd-main");
  const thumbsWrap = gallery.querySelector(".pd-thumbs");
  if (!main || !thumbsWrap) return;

  // Current active thumbnail index
  function currentIndex() {
    const thumbs = [...thumbsWrap.querySelectorAll(".pd-thumb")];
    return Math.max(
      0,
      thumbs.findIndex((t) => t.classList.contains("active"))
    );
  }
  // Set index with wrap-around
  function setIndex(i) {
    const thumbs = [...thumbsWrap.querySelectorAll(".pd-thumb")];
    if (!thumbs.length) return;
    const n = (i + thumbs.length) % thumbs.length; // wrap both directions
    thumbs.forEach((t) => t.classList.remove("active"));
    thumbs[n].classList.add("active");
    main.src = thumbs[n].getAttribute("data-full") || thumbs[n].src;
  }

  left.addEventListener("click", () => setIndex(currentIndex() - 1));
  right.addEventListener("click", () => setIndex(currentIndex() + 1));

  // Keyboard support
  gallery.tabIndex = 0;
  gallery.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      left.click();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      right.click();
    }
  });
}

/* ========== RENDER ========== */
function renderProduct(product) {
  const container = document.getElementById("product-detail");
  const bcName = document.getElementById("bc-name");

  if (!product) {
    if (container)
      container.innerHTML =
        "<div class='empty'>Sorry, the product was not found.</div>";
    if (bcName) bcName.textContent = "Not found";
    return;
  }

  const defaultSizes = [40, 41, 42, 43, 44, 45];
  const defaultColors = [{ name: "White", value: "#f5f5f5" }];
  const sizes =
    Array.isArray(product.sizes) && product.sizes.length
      ? product.sizes
      : defaultSizes;
  const colors =
    Array.isArray(product.colors) && product.colors.length
      ? product.colors
      : defaultColors;

  if (bcName) bcName.textContent = product.name;

  const images =
    Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image].filter(Boolean);

  const groupName = `product-${product.id}`;

  const ph = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='18'>
        No image
      </text>
    </svg>`
  );

  container.innerHTML = `
    <div class="pd-gallery card">
      <img class="pd-main"
           src="${images[0] || ""}"
           alt="${product.name}"
           loading="lazy" decoding="async" referrerpolicy="no-referrer"
           data-gallery="${groupName}"
           sizes="(max-width: 600px) 100vw, (max-width: 1024px) 90vw, 520px"
           onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,${ph}'">
      <div class="pd-thumbs">
        ${images
          .map(
            (src, i) => `
          <img class="pd-thumb ${i === 0 ? "active" : ""}"
               src="${src}" alt="${product.name} — photo ${i + 1}"
               loading="lazy" decoding="async" referrerpolicy="no-referrer"
               data-gallery="${groupName}"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,${ph}'">
        `
          )
          .join("")}
      </div>
    </div>

    <div class="pd-info card">
      <h2 class="detail-title">${product.name}</h2>
      <p class="detail-price">${(Number(product.price) || 0).toFixed(2)} €</p>
      <p class="detail-desc">${product.description || ""}</p>

      <div class="options">
        <div class="option-group" id="color-group">
          <span class="option-label">Color</span>
          ${colors
            .map(
              (c, i) => `
            <button class="swatch ${i === 0 ? "active" : ""}"
                    data-name="${c.name}" data-val="${c.value}"
                    title="${c.name}" style="background:${c.value}"></button>
          `
            )
            .join("")}
        </div>

        <div class="option-group" id="size-group">
          <span class="option-label">Size</span>
          ${sizes
            .map(
              (s, i) => `
            <button class="chip ${
              i === 0 ? "active" : ""
            }" data-size="${s}">${s}</button>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="buy-row">
        <a href="index.html" class="btn btn-ghost btn-back">← Back to catalog</a>
        <button id="add-to-cart" class="btn">Add to cart</button>
        <a href="cart.html" class="btn-link">Go to cart</a>
      </div>
    </div>
  `;

  // Thumbnails → main image swap
  const mainImg = container.querySelector(".pd-main");
  container.querySelector(".pd-thumbs")?.addEventListener("click", (e) => {
    const t = e.target.closest(".pd-thumb");
    if (!t) return;
    container
      .querySelectorAll(".pd-thumb")
      .forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    mainImg.src = t.getAttribute("data-full") || t.src;
  });

  // Arrows for the gallery with wrap-around
  enhanceGalleryWithArrows(container.querySelector(".pd-gallery"));

  // Options
  const colorGroup = container.querySelector("#color-group");
  const sizeGroup = container.querySelector("#size-group");
  let selectedColor = colors[0]?.name || null;
  let selectedSize = String(sizes[0] ?? "");

  colorGroup?.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    colorGroup
      .querySelectorAll(".swatch")
      .forEach((s) => s.classList.remove("active"));
    sw.classList.add("active");
    selectedColor = sw.dataset.name || null;
  });
  sizeGroup?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    sizeGroup
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    selectedSize = chip.dataset.size || "";
  });

  // Add to cart
  container.querySelector("#add-to-cart")?.addEventListener("click", (e) => {
    if (!selectedSize) {
      showToast("Please select a size");
      return;
    }
    addVariantToCart({
      id: product.id,
      size: String(selectedSize),
      color: selectedColor,
    });
    // Nice fly animation (provided by header.js)
    const rect = e.currentTarget.getBoundingClientRect?.();
    if (rect) hitRingAt(rect.left + rect.width / 2, rect.top);
    window.flyToCart?.(mainImg);
  });
}

/* ========== INIT ========== */
document.addEventListener("DOMContentLoaded", () => {
  const id = getProductIdFromQuery();
  const product = id != null ? findProductById(id) : null;
  renderProduct(product);
  updateCartCount();
});
