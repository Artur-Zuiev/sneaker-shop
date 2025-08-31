// js/product-gallery.js — render product gallery and group for zoom
(function enhanceProductGallery() {
  if (window.__ProductGalleryInit) return;
  window.__ProductGalleryInit = true;

  // ===== Helpers =====
  function getIdFromQuery() {
    try {
      const u = new URL(location.href);
      return Number(u.searchParams.get("id") || 0);
    } catch {
      return 0;
    }
  }

  function findProductById(id) {
    if (typeof products === "undefined" || !Array.isArray(products))
      return null;
    return products.find((p) => Number(p.id) === Number(id)) || null;
  }

  // Render all images into the gallery container
  function renderImages(container, product) {
    if (!container || !product || !Array.isArray(product.images)) return;
    container.innerHTML = product.images
      .map(
        (src) => `
        <img src="${src}" alt="${product.name}" data-gallery="product-${product.id}">
      `
      )
      .join("");
  }

  // ===== Init =====
  document.addEventListener("DOMContentLoaded", () => {
    const id = getIdFromQuery();
    const product = findProductById(id);
    const gallery = document.querySelector(
      ".product-gallery, [data-gallery-root]"
    );
    if (!gallery || !product) return;
    renderImages(gallery, product);
  });
})();
