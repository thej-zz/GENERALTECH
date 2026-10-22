document.addEventListener("DOMContentLoaded", () => {

  // ---------- WHATSAPP BOOKING ----------
  window.sendToWhatsApp = function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const addr = document.getElementById('address').value;
    const det = document.getElementById('details').value;
    const category = document.getElementById('category').value;

    const msg =
`New Work Request
Name: ${name}
Phone: ${phone}
Category: ${category}
Address: ${addr}
Details: ${det}`;

    const url = "https://wa.me/917909128161?text=" + encodeURIComponent(msg);
    window.open(url, "_blank");
  };

  // ---------- GALLERY (photos + captions come from the admin dashboard) ----------
  const gallery = document.querySelector(".gallery[data-category]");
  if (!gallery) return;

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.querySelector(".close");
  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");
  const descBox = document.getElementById("lightbox-desc");

  let items = [];
  let index = 0;

  function message(text, withRetry) {
    const box = document.createElement("div");
    box.className = "gallery-message";
    const p = document.createElement("p");
    p.textContent = text;
    box.appendChild(p);
    if (withRetry) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Try again";
      btn.addEventListener("click", load);
      box.appendChild(btn);
    }
    gallery.replaceChildren(box);
  }

  function showSkeletons() {
    gallery.setAttribute("aria-busy", "true");
    gallery.replaceChildren(...Array.from({ length: 6 }, () => {
      const d = document.createElement("div");
      d.className = "gallery-skeleton";
      return d;
    }));
  }

  function render() {
    gallery.removeAttribute("aria-busy");
    if (!items.length) return message("New projects will be added here soon.");
    gallery.replaceChildren(...items.map((it, i) => {
      const img = document.createElement("img");
      img.src = it.thumb;                       // small, fast copy for the grid
      img.alt = it.description || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.dataset.index = i;
      return img;
    }));
  }

  async function load() {
    showSkeletons();
    try {
      const res = await fetch("/api/works/" + encodeURIComponent(gallery.dataset.category), { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      items = await res.json();
      render();
    } catch (err) {
      gallery.removeAttribute("aria-busy");
      message("We couldn't load the photos right now.", true);
    }
  }

  // ---------- LIGHTBOX ----------
  gallery.addEventListener("click", e => {
    const img = e.target.closest("img[data-index]");
    if (!img) return;
    index = Number(img.dataset.index);
    showImage();
  });

  const isOpen = () => lightbox.style.display === "flex";

  function animateText(text) {
    descBox.innerHTML = "";
    [...text].forEach((char, i) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.animationDelay = `${i * 0.03}s`;
      descBox.appendChild(span);
    });
  }

  function showImage() {
    const it = items[index];
    if (!it) return;
    lightbox.style.display = "flex";
    lightboxImg.src = it.full;
    lightboxImg.alt = it.description || "";
    animateText(it.description || "");

    lightbox.classList.remove("show-desc");
    void lightbox.offsetWidth;
    lightbox.classList.add("show-desc");

    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.style.display = "none";
    document.body.style.overflow = "auto";
  }

  function step(delta) {
    if (!items.length) return;
    index = (index + delta + items.length) % items.length;
    showImage();
  }

  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));

  lightbox.addEventListener("click", e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", e => {
    if (!isOpen()) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  load();
});

window.openForm = function (category) {
  const overlay = document.getElementById("formOverlay");
  const popup   = overlay.querySelector(".form-popup");

  document.getElementById("category").value = category;

  overlay.style.display = "flex";

  // Force browser to apply mobile CSS first
  popup.getBoundingClientRect();

  if (window.innerWidth <= 768) {
    popup.style.animation = "sheetUp .45s ease";
    popup.style.transform = "none";
  }
};

window.closeForm = function () {
  const overlay = document.getElementById("formOverlay");
  const popup   = overlay.querySelector(".form-popup");

  overlay.style.display = "none";

  // Reset so desktop still works
  popup.style.animation = "";
  popup.style.transform = "";
};