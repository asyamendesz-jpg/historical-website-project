/**
 * Эмоциональное путешествие — клиентская логика витрины.
 * Работает при открытии index.html напрямую (file://) и через локальный сервер.
 * IntersectionObserver, Constraint Validation API, View Transitions (где доступно).
 */
(() => {
const CONTACT_EMAIL = "hello@asyamelnikova.ru";
const SCROLL_OFFSET = 12;
const VEIL_IN_MS = 280;
const VEIL_OUT_MS = 720;
const HALL_SWAP_MS = 180;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** @param {() => void} fn */
const onScrollRaf = (fn) => {
  let ticking = false;
  const run = () => {
    ticking = false;
    fn();
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(run);
    },
    { passive: true }
  );
};

function initHeader() {
  const header = $(".site-header");
  if (!header) return;

  const sync = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  sync();
  onScrollRaf(sync);
}

function initMobileNav() {
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    if ("inert" in HTMLElement.prototype) {
      nav.inert = !open && window.matchMedia("(max-width: 780px)").matches;
    }
  };

  setOpen(false);

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) setOpen(false);
  });

  window.matchMedia("(max-width: 780px)").addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });
}

function initReveals(reduced) {
  const items = $$(".reveal");
  if (!items.length) return;

  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
  );

  items.forEach((el, index) => {
    el.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
    observer.observe(el);
  });
}

function initHallIndicator(reduced) {
  const hall = $(".hall-indicator");
  const hallNum = $("#hall-num");
  const hallName = $("#hall-name");
  const halls = $$("[data-hall]");
  if (!hall || !hallNum || !hallName || !halls.length) return;

  let current = "";

  const paint = (num, name) => {
    hallNum.textContent = num === "00" ? "—" : num;
    hallName.textContent = name;
    hall.classList.toggle("is-visible", true);
  };

  const setHall = async (num, name) => {
    if (current === num) return;
    current = num;

    if (reduced) {
      paint(num, name);
      return;
    }

    hall.classList.add("is-updating");
    await sleep(HALL_SWAP_MS);
    paint(num, name);
    hall.classList.remove("is-updating");
  };

  if (!("IntersectionObserver" in window)) {
    paint("00", "Вход");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      const { hall: num = "00", hallName: name = "" } = visible.target.dataset;
      setHall(num, name);
    },
    { threshold: [0.25, 0.45, 0.65], rootMargin: "-20% 0px -35% 0px" }
  );

  halls.forEach((section) => observer.observe(section));
}

function initForm(reduced) {
  const form = /** @type {HTMLFormElement | null} */ ($("#collab-form"));
  const status = $("#form-status");
  if (!form || !status) return;

  const showStatus = (message, type = "ok") => {
    status.textContent = message;
    status.classList.remove("is-ok", "is-error");
    status.classList.add("is-visible", type === "error" ? "is-error" : "is-ok");
  };

  const clearValidity = () => {
    for (const field of form.elements) {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.setCustomValidity("");
      }
    }
  };

  form.addEventListener("input", clearValidity);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.classList.remove("is-success");
    clearValidity();

    const nameInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
    const emailInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("email"));
    const projectInput = /** @type {HTMLTextAreaElement} */ (form.elements.namedItem("project"));

    if (!form.checkValidity()) {
      if (!nameInput.value.trim()) nameInput.setCustomValidity("Укажите имя");
      if (!emailInput.validity.valid) emailInput.setCustomValidity("Проверьте email");
      if (!projectInput.value.trim()) projectInput.setCustomValidity("Расскажите о проекте");
      form.reportValidity();
      showStatus("Заполните поля корректно — это поможет начать разговор.", "error");
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const project = projectInput.value.trim();
    const subject = encodeURIComponent(`Сотрудничество: ${name}`);
    const body = encodeURIComponent(`Имя: ${name}\nEmail: ${email}\n\nО проекте:\n${project}`);

    showStatus("Спасибо. Открываю почтовый клиент…", "ok");
    form.classList.add("is-success");

    await sleep(reduced ? 0 : 420);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    await sleep(1000);
    showStatus(`Если письмо не открылось — напишите на ${CONTACT_EMAIL}`, "ok");
    form.reset();
    form.classList.remove("is-success");
  });
}

/**
 * @param {string} hash
 * @param {boolean} reduced
 */
function scrollToHash(hash, reduced) {
  const target = $(hash);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
  window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
}

/**
 * View Transitions API + мягкая шторка как fallback.
 * @param {string} hash
 * @param {HTMLElement | null} veil
 * @param {boolean} reduced
 */
async function navigateToHash(hash, veil, reduced) {
  const go = () => {
    scrollToHash(hash, reduced);
    history.pushState(null, "", hash);
  };

  if (reduced) {
    go();
    return;
  }

  if (document.startViewTransition) {
    document.startViewTransition(go);
    return;
  }

  if (!veil) {
    go();
    return;
  }

  veil.classList.add("is-active");
  await sleep(VEIL_IN_MS);
  go();
  await sleep(VEIL_OUT_MS - VEIL_IN_MS);
  veil.classList.remove("is-active");
}

function initAnchorNav(reduced) {
  const veil = /** @type {HTMLElement | null} */ ($("#page-veil"));

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;

    const href = link.getAttribute("href");
    if (!href || href === "#" || !$(href)) return;

    event.preventDefault();
    navigateToHash(href, veil, reduced);
  });
}

function initYear() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function boot() {
  const reduced = prefersReducedMotion();
  initYear();
  initHeader();
  initMobileNav();
  initReveals(reduced);
  initHallIndicator(reduced);
  initForm(reduced);
  initAnchorNav(reduced);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", () => {
    if (motionQuery.matches) $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  });
}

boot();
})();
