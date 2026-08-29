/**
 * Страница «Для агентств» — навигация, форма, аналитика.
 */
(() => {
const contactHint = () => {
  const email = window.PortfoFormMail?.getContactEmail?.() || "";
  return email ? `Напишите на ${email}` : "Попробуйте позже или свяжитесь через контакты на странице.";
};

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const $ = (selector, root = document) => root.querySelector(selector);

function initYear() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function initHeader() {
  const header = $(".site-header");
  if (!header) return;

  let ticking = false;
  const sync = () => {
    ticking = false;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  sync();
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    },
    { passive: true }
  );
}

function initMobileNav() {
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    if ("inert" in nav) {
      nav.inert = !open && window.matchMedia("(max-width: 780px)").matches;
    }
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));

  nav.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!link || !nav.contains(link)) return;
    setOpen(false);
  });
}

function trackEvent(name, extra = {}) {
  const payload = { name, t: Date.now(), ...extra };
  window.__portfoEvents = window.__portfoEvents || [];
  window.__portfoEvents.push(payload);
  window.dispatchEvent(new CustomEvent("portfo:event", { detail: payload }));
}

function initTrack() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest("[data-track]");
    if (!el) return;
    const name = el.getAttribute("data-track");
    if (!name) return;
    trackEvent(name, { href: el.getAttribute("href") || "" });
  });
}

function initForm(reduced) {
  const form = /** @type {HTMLFormElement | null} */ ($("#agency-form"));
  const status = $("#form-status");
  if (!form || !status) return;

  const showStatus = (text, kind = "ok") => {
    status.textContent = text;
    status.classList.remove("is-ok", "is-error");
    status.classList.add("is-visible", kind === "error" ? "is-error" : "is-ok");
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

    const submitBtn = /** @type {HTMLButtonElement | null} */ (form.querySelector('[type="submit"]'));
    const agencyInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("agency"));
    const nameInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
    const emailInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("email"));
    const projectInput = /** @type {HTMLTextAreaElement} */ (form.elements.namedItem("project"));
    const timelineInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("timeline"));

    if (!form.checkValidity()) {
      if (!agencyInput.value.trim()) agencyInput.setCustomValidity("Укажите агентство");
      if (!nameInput.value.trim()) nameInput.setCustomValidity("Укажите имя");
      if (!emailInput.validity.valid) emailInput.setCustomValidity("Укажите email");
      if (!projectInput.value.trim() || projectInput.value.trim().length < 8) {
        projectInput.setCustomValidity("Кратко опишите задачу");
      }
      form.reportValidity();
      showStatus("Заполните поля — так проще начать разговор.", "error");
      return;
    }

    const agency = agencyInput.value.trim();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const project = projectInput.value.trim();
    const timeline = timelineInput?.value.trim() || "";
    const subject = `Агентство: ${agency}`;
    const extra = timeline ? `\nСрок: ${timeline}` : "";
    const bodyText = `Агентство: ${agency}\nКонтакт: ${name}\nEmail: ${email}${extra}\n\nЗадача:\n${project}`;

    trackEvent("form_submit", { form: "agency" });
    trackEvent("agency_form_submit", { form: "agency" });

    if (!window.PortfoFormMail) {
      showStatus(`Не удалось отправить. ${contactHint()}`, "error");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    showStatus("Отправляем бриф…", "ok");

    const result = await window.PortfoFormMail.submit({
      form: "agency",
      agency,
      name,
      email,
      project,
      timeline,
      subject,
      bodyText,
    });

    if (submitBtn) submitBtn.disabled = false;

    if (result.ok) {
      form.classList.add("is-success");
      showStatus("Спасибо! Бриф отправили — отвечу на указанный email.", "ok");
      form.reset();
      await sleep(reduced ? 0 : 420);
      form.classList.remove("is-success");
      return;
    }

    if (result.mode === "mailto" && result.mailto) {
      showStatus("Открываю почтовый клиент…", "ok");
      form.classList.add("is-success");
      await sleep(reduced ? 0 : 420);
      window.location.href = result.mailto;
      await sleep(1000);
      showStatus(`Если письмо не открылось — ${contactHint()}`, "ok");
      form.reset();
      form.classList.remove("is-success");
      return;
    }

    if (result.error === "contact_not_configured") {
      showStatus(`Форма временно недоступна. ${contactHint()}`, "error");
      return;
    }

    showStatus(`Не удалось отправить. ${contactHint()}`, "error");
  });
}

function boot() {
  initYear();
  initHeader();
  initMobileNav();
  initForm(prefersReducedMotion());
  initTrack();
}

boot();
})();
