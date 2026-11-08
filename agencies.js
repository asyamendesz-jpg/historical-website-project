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

  const submitBtn = /** @type {HTMLButtonElement | null} */ ($("#agency-submit") || form.querySelector('[type="submit"]'));
  const mailNote = $("#form-mail-note");
  const mailAddress = $("#form-mail-address");
  const mailActions = $("#form-mail-actions");
  const copyBtn = /** @type {HTMLButtonElement | null} */ ($("#form-copy-letter"));
  const gmailOpen = /** @type {HTMLButtonElement | null} */ ($("#form-gmail-open"));
  const mailtoOpen = /** @type {HTMLAnchorElement | null} */ ($("#form-mailto-open"));
  const websiteInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("website"));
  const usesGmailFallback = Boolean(window.PortfoFormMail && !window.PortfoFormMail.getApiUrl());
  const defaultLabel = "Отправить заявку";
  const gmailHint = "В Gmail откроется черновик. Нажмите “Отправить”, чтобы отправить заявку.";
  let submitting = false;
  let lastLetterText = "";
  let lastSubject = "";
  let formStarted = false;

  if (usesGmailFallback) {
    if (submitBtn) submitBtn.hidden = true;
    if (mailNote) {
      mailNote.hidden = false;
      mailNote.textContent = gmailHint;
    }
    if (mailActions) mailActions.hidden = false;
    const contactEmail = window.PortfoFormMail.getContactEmail();
    if (mailAddress && contactEmail) {
      mailAddress.replaceChildren();
      mailAddress.append("Адрес Gmail: ");
      const addressLink = document.createElement("a");
      addressLink.href = `mailto:${contactEmail}`;
      addressLink.textContent = contactEmail;
      mailAddress.append(addressLink);
      mailAddress.hidden = false;
    }
  }

  const showStatus = (text, kind = "ok") => {
    status.textContent = text;
    status.classList.remove("is-ok", "is-error");
    status.classList.add("is-visible", kind === "error" ? "is-error" : "is-ok");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
  };

  const clearValidity = () => {
    for (const field of form.elements) {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.setCustomValidity("");
        field.setAttribute("aria-invalid", "false");
      }
    }
  };

  const agencyInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("agency"));
  const nameInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
  const emailInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("email"));
  const projectInput = /** @type {HTMLTextAreaElement} */ (form.elements.namedItem("project"));
  const timelineInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("timeline"));

  const collectValues = () => ({
    agency: agencyInput.value.trim(),
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    project: projectInput.value.trim(),
    timeline: timelineInput?.value.trim() || "",
  });

  const letterFromValues = (values) => {
    const extra = values.timeline ? `\nСрок: ${values.timeline}` : "";
    const subject = `Агентство: ${values.agency}`;
    const bodyText = `Агентство: ${values.agency}\nКонтакт: ${values.name}\nEmail: ${values.email}${extra}\n\nЗадача:\n${values.project}`;
    return { subject, bodyText };
  };

  const validate = () => {
    clearValidity();
    const values = collectValues();
    let firstInvalid = null;
    if (values.agency.length < 2) {
      agencyInput.setCustomValidity("Укажите агентство");
      agencyInput.setAttribute("aria-invalid", "true");
      firstInvalid = firstInvalid || agencyInput;
    }
    if (!values.name) {
      nameInput.setCustomValidity("Укажите имя");
      nameInput.setAttribute("aria-invalid", "true");
      firstInvalid = firstInvalid || nameInput;
    }
    if (!emailInput.validity.valid || !values.email) {
      emailInput.setCustomValidity("Укажите email");
      emailInput.setAttribute("aria-invalid", "true");
      firstInvalid = firstInvalid || emailInput;
    }
    if (values.project.length < 8) {
      projectInput.setCustomValidity("Кратко опишите задачу");
      projectInput.setAttribute("aria-invalid", "true");
      firstInvalid = firstInvalid || projectInput;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      showStatus("Заполните поля — так проще начать разговор.", "error");
      return null;
    }
    return values;
  };

  const syncFallbackLinks = () => {
    if (!usesGmailFallback || !window.PortfoFormMail) return null;
    const values = collectValues();
    const ready =
      values.agency.length >= 2 &&
      values.name &&
      emailInput.validity.valid &&
      values.email &&
      values.project.length >= 8;
    if (!ready) {
      mailtoOpen?.removeAttribute("href");
      return null;
    }
    const letter = letterFromValues(values);
    lastSubject = letter.subject;
    lastLetterText = letter.bodyText;
    const gmail = window.PortfoFormMail.buildGmailCompose({
      subject: letter.subject,
      body: letter.bodyText,
    });
    const mailto = window.PortfoFormMail.buildMailto({
      subject: letter.subject,
      body: letter.bodyText,
    });
    if (mailtoOpen && mailto) mailtoOpen.href = mailto;
    persistDraft(values);
    return { ...letter, gmail, mailto, values };
  };

  const persistDraft = (values) => {
    window.PortfoFormMail.saveDraft("agency", values);
  };

  const restoreDraft = () => {
    const draft = window.PortfoFormMail.readDraft("agency");
    if (!draft) return;
    if (typeof draft.agency === "string" && !agencyInput.value) agencyInput.value = draft.agency;
    if (typeof draft.name === "string" && !nameInput.value) nameInput.value = draft.name;
    if (typeof draft.email === "string" && !emailInput.value) emailInput.value = draft.email;
    if (typeof draft.project === "string" && !projectInput.value) projectInput.value = draft.project;
    if (timelineInput && typeof draft.timeline === "string" && !timelineInput.value) {
      timelineInput.value = draft.timeline;
    }
  };

  restoreDraft();

  form.addEventListener("focusin", () => {
    if (formStarted) return;
    formStarted = true;
    trackEvent("form_start", { form: "agency" });
  });
  form.addEventListener("input", () => {
    clearValidity();
    syncFallbackLinks();
  });
  form.addEventListener("change", syncFallbackLinks);

  copyBtn?.addEventListener("click", async () => {
    const letter = syncFallbackLinks();
    const text = letter?.bodyText || lastLetterText;
    if (!text) {
      validate();
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(text);
      showStatus("Бриф скопирован. Вставьте его в письмо, если нужно.", "ok");
    } catch {
      showStatus(`Скопировать автоматически не удалось. ${contactHint()}`, "error");
    }
  });

  gmailOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    const values = validate();
    if (!values) return;
    const letter = letterFromValues(values);
    lastSubject = letter.subject;
    lastLetterText = letter.bodyText;
    persistDraft(values);
    const url = window.PortfoFormMail.buildGmailCompose({
      subject: letter.subject,
      body: letter.bodyText,
    });
    if (!url || !url.startsWith("https://mail.google.com/mail/?view=cm")) {
      showStatus(`Не удалось собрать письмо. ${contactHint()}`, "error");
      return;
    }
    trackEvent("form_gmail_open", { form: "agency" });
    window.location.assign(url);
  });

  mailtoOpen?.addEventListener("click", (event) => {
    const letter = syncFallbackLinks();
    if (!letter?.mailto) {
      event.preventDefault();
      validate();
      return;
    }
    trackEvent("form_mailto_open", { form: "agency" });
    showStatus("Откроется почтовая программа. Письмо нужно отправить в ней самостоятельно.", "ok");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (usesGmailFallback) return;
    if (submitting) return;
    form.classList.remove("is-success");

    const values = validate();
    if (!values) return;
    const { subject, bodyText } = letterFromValues(values);
    lastLetterText = bodyText;
    lastSubject = subject;

    if (!window.PortfoFormMail) {
      showStatus(`Не удалось подготовить письмо. ${contactHint()}`, "error");
      return;
    }

    submitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
    }

    showStatus("Отправляем бриф…", "ok");

    let result;
    try {
      result = await window.PortfoFormMail.submit({
        form: "agency",
        agency: values.agency,
        name: values.name,
        email: values.email,
        project: values.project,
        timeline: values.timeline,
        website: websiteInput?.value || "",
        subject,
        bodyText,
      });
    } finally {
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.textContent = defaultLabel;
      }
    }

    if (result.ok && result.mode === "api") {
      trackEvent("form_success", { form: "agency" });
      form.classList.add("is-success");
      showStatus("Письмо ушло через сервер. Ася ответит на указанный email.", "ok");
      form.reset();
      formStarted = false;
      lastLetterText = "";
      lastSubject = "";
      await sleep(reduced ? 0 : 420);
      form.classList.remove("is-success");
      return;
    }

    if (result.error === "timeout") {
      showStatus("Сервер слишком долго не ответил. Поля сохранены — можно попробовать ещё раз или отправить через Gmail.", "error");
      return;
    }
    if (result.error === "too_many_requests") {
      showStatus("Слишком много попыток подряд. Поля сохранены — подождите немного или отправить через Gmail.", "error");
      return;
    }
    if (result.error === "contact_not_configured") {
      showStatus(`Форма временно недоступна. ${contactHint()}`, "error");
      return;
    }
    showStatus("Не удалось принять заявку. Поля сохранены — можно попробовать ещё раз или отправить через Gmail.", "error");
  });
}

function initDirectMail() {
  const link = $("#agency-direct-mail");
  const email = window.PortfoFormMail?.getContactEmail?.() || "";
  if (!link || !email) return;
  link.hidden = false;
  const gmail = window.PortfoFormMail.buildGmailCompose({
    subject: "Агентство",
    body: "",
  });
  link.href = gmail || window.PortfoFormMail.buildMailto({
    subject: "Агентство",
    body: "",
  });
  link.textContent = email;
  if (gmail) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

function boot() {
  initYear();
  initHeader();
  initMobileNav();
  initDirectMail();
  initForm(prefersReducedMotion());
  initTrack();
}

boot();
})();
