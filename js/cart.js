// js/cart.js

const CART_KEY = "cart";
const cartContainer = document.getElementById("cart-items");
const cartSummary = document.getElementById("cart-summary");

/* ---------------- Cart helpers (normalize format) ---------------- */
function normalizeCart(cart) {
  if (!Array.isArray(cart)) return [];
  // New format with variants
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
  // Legacy records (array of ids or plain products) → normalize to consistent format
  const map = new Map(); // key: id|size|color
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
}

function getCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return normalizeCart(raw);
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(cart)));
}
function cartItemsCount() {
  return getCart().reduce((s, i) => s + i.qty, 0);
}
function updateHeaderCount() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = cartItemsCount();
}

/* ---------------- Product helpers ---------------- */
function getProductById(id) {
  return typeof products !== "undefined" && Array.isArray(products)
    ? products.find((p) => Number(p.id) === Number(id)) || null
    : null;
}

/* ---------------- Render cart ---------------- */
function renderCart() {
  const cart = getCart();
  updateHeaderCount();
  cartContainer.innerHTML = "";
  cartSummary.innerHTML = "";

  // Wait until products are loaded
  if (typeof products === "undefined" || !Array.isArray(products)) {
    cartContainer.innerHTML = "<p>Loading products…</p>";
    return;
  }

  // Empty state
  if (cart.length === 0) {
    cartContainer.innerHTML = "<div class='empty'>Your cart is empty.</div>";
    cartSummary.innerHTML = `
      <div class="actions">
        <a class="btn btn-ghost" href="index.html" style="text-decoration:none;">← Back to catalog</a>
      </div>
    `;
    return;
  }

  // Inline SVG placeholder (if image fails to load)
  const placeholder = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='18'>
        No image
      </text>
    </svg>`
  );

  let total = 0;

  cartContainer.innerHTML = cart
    .map((item, index) => {
      const p = getProductById(item.id);
      if (!p) return ""; // skip broken entries
      const line = p.price * item.qty;
      total += line;

      const sizeStr = item.size ? `Size: ${item.size}` : "Size: —";
      const colorStr = item.color ? `Color: ${item.color}` : "Color: —";

      return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.name}"
             loading="lazy" decoding="async" fetchpriority="low"
             width="110" height="110"
             sizes="(max-width:900px) 90px, 110px"
             referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,${placeholder}'" />

        <div class="ci-title">
          <h3>${p.name}</h3>
          <p>${p.price.toFixed(2)} € each</p>
          <p class="muted">${colorStr} &nbsp;•&nbsp; ${sizeStr}</p>
        </div>

        <div class="ci-qty" role="group" aria-label="Quantity">
          <button class="btn" type="button" data-action="dec" data-index="${index}" aria-label="Decrease quantity">−</button>
          <strong aria-live="polite">${item.qty}</strong>
          <button class="btn" type="button" data-action="inc" data-index="${index}" aria-label="Increase quantity">+</button>
        </div>

        <div class="ci-line" aria-label="Line total">${line.toFixed(2)} €</div>

        <button class="icon-btn" type="button" title="Remove"
                data-action="remove" data-index="${index}" aria-label="Remove item">✕</button>
      </div>
    `;
    })
    .join("");

  cartSummary.innerHTML = `
    <div class="total-row">
      <span>Total</span>
      <span>${total.toFixed(2)} €</span>
    </div>
    <div class="actions">
      <button id="checkout" class="btn" type="button">Checkout</button>
      <button id="clear-cart" class="btn btn-danger" type="button">Clear</button>
      <a href="index.html" class="btn btn-ghost" style="text-decoration:none;">← Back to catalog</a>
    </div>
  `;

  // Summary actions
  document.getElementById("checkout").onclick = () => {
    const c = getCart();
    if (!c.length) {
      alert("Your cart is empty.");
      return;
    }
    alert("Thank you for your purchase! (demo)");
    saveCart([]);
    renderCart();
  };
  document.getElementById("clear-cart").onclick = () => {
    saveCart([]);
    renderCart();
  };
}

/* ---------------- Events (delegation for cart actions) ---------------- */
cartContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const index = Number(btn.dataset.index);

  const cart = getCart();
  if (!cart[index]) return;

  if (action === "inc") cart[index].qty += 1;
  if (action === "dec") cart[index].qty -= 1;
  if (action === "remove" || cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  saveCart(cart);
  renderCart();
});

/* ---------------- Init: wait for products and render ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const t = setInterval(() => {
    if (typeof products !== "undefined" && Array.isArray(products)) {
      clearInterval(t);
      renderCart();
    }
  }, 100);
});
