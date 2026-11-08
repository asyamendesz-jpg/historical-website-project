/**
 * Эмоциональное путешествие — клиентская логика витрины.
 * Работает при открытии index.html напрямую (file://) и через локальный сервер.
 * IntersectionObserver, Constraint Validation API, View Transitions (где доступно).
 */
(() => {
const contactHint = () => {
  const email = window.PortfoFormMail?.getContactEmail?.() || "";
  return email ? `Напишите на ${email}` : "Попробуйте позже или свяжитесь через контакты на странице.";
};
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
    { threshold: 0.05, rootMargin: "80px 0px 10% 0px" }
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

  const submitBtn = /** @type {HTMLButtonElement | null} */ ($("#collab-submit") || form.querySelector('[type="submit"]'));
  const mailNote = $("#form-mail-note");
  const mailAddress = $("#form-mail-address");
  const mailActions = $("#form-mail-actions");
  const copyBtn = /** @type {HTMLButtonElement | null} */ ($("#form-copy-letter"));
  const gmailOpen = /** @type {HTMLButtonElement | null} */ ($("#form-gmail-open"));
  const mailtoOpen = /** @type {HTMLAnchorElement | null} */ ($("#form-mailto-open"));
  const nameInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
  const emailInput = /** @type {HTMLInputElement} */ (form.elements.namedItem("email"));
  const projectInput = /** @type {HTMLTextAreaElement} */ (form.elements.namedItem("project"));
  const timelineInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("timeline"));
  const budgetInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("budget"));
  const websiteInput = /** @type {HTMLInputElement | null} */ (form.elements.namedItem("website"));
  const usesGmailFallback = Boolean(window.PortfoFormMail && !window.PortfoFormMail.getApiUrl());
  let lastLetterText = "";
  let lastSubject = "";
  let submitting = false;
  const defaultSubmitLabel = "Отправить заявку";
  const gmailHint = "В Gmail откроется черновик. Нажмите “Отправить”, чтобы отправить заявку.";

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

  const showStatus = (message, type = "ok") => {
    status.textContent = message;
    status.classList.remove("is-ok", "is-error");
    status.classList.add("is-visible", type === "error" ? "is-error" : "is-ok");
    status.setAttribute("role", type === "error" ? "alert" : "status");
  };

  const setFieldError = (field, message) => {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    field.setCustomValidity(message);
    field.setAttribute("aria-invalid", message ? "true" : "false");
    const errorEl = field.id ? $(`#${field.id}-error`) : null;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }
  };

  const clearValidity = () => {
    for (const field of form.elements) {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        setFieldError(field, "");
      }
    }
  };

  const validate = () => {
    clearValidity();
    let firstInvalid = null;

    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      setFieldError(nameInput, "Укажите имя — не короче двух символов.");
      firstInvalid = firstInvalid || nameInput;
    }

    if (!emailInput.validity.valid || !emailInput.value.trim()) {
      setFieldError(emailInput, "Укажите контактный email.");
      firstInvalid = firstInvalid || emailInput;
    }

    const composed = window.PortfoFormContext.compose(projectInput.value);
    if (composed.trim().length < 8) {
      setFieldError(
        projectInput,
        "Напишите, что хотите сделать — своими словами. Услуга или проект не обязательны."
      );
      firstInvalid = firstInvalid || projectInput;
    } else {
      setFieldError(projectInput, "");
    }

    if (firstInvalid) {
      showStatus("Проверьте отмеченные поля — без них письмо не собрать.", "error");
      firstInvalid.focus();
      return null;
    }

    return {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      userText: projectInput.value.trim(),
      composed,
      timeline: timelineInput?.value.trim() || "",
      budget: budgetInput?.value.trim() || "",
    };
  };

  const letterFromValues = (values) => {
    const extra = [
      values.timeline ? `Срок: ${values.timeline}` : "",
      values.budget ? `Бюджет: ${values.budget}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const subject = `Сотрудничество: ${values.name}`;
    const bodyText = `Имя: ${values.name}\nКонтакт: ${values.email}${extra ? `\n${extra}` : ""}\n\nЧто хотите сделать:\n${values.composed}`;
    return { subject, bodyText };
  };

  const syncFallbackLinks = () => {
    if (!usesGmailFallback || !window.PortfoFormMail) return null;
    const values = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      composed: window.PortfoFormContext.compose(projectInput.value),
      timeline: timelineInput?.value.trim() || "",
      budget: budgetInput?.value.trim() || "",
    };
    const ready =
      values.name.length >= 2 &&
      emailInput.validity.valid &&
      values.email &&
      values.composed.trim().length >= 8;
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
    return { ...letter, gmail, mailto };
  };

  const persistDraft = (values) => {
    window.PortfoFormMail.saveDraft("contact", {
      name: values.name,
      email: values.email,
      project: values.userText != null ? values.userText : projectInput.value.trim(),
      timeline: values.timeline || "",
      budget: values.budget || "",
      context: window.PortfoFormContext.snapshot(),
    });
  };

  const restoreDraft = () => {
    const draft = window.PortfoFormMail.readDraft("contact");
    if (!draft) return;
    if (typeof draft.name === "string" && !nameInput.value) nameInput.value = draft.name;
    if (typeof draft.email === "string" && !emailInput.value) emailInput.value = draft.email;
    if (typeof draft.project === "string" && !projectInput.value) projectInput.value = draft.project;
    if (timelineInput && typeof draft.timeline === "string" && !timelineInput.value) {
      timelineInput.value = draft.timeline;
    }
    if (budgetInput && typeof draft.budget === "string" && !budgetInput.value) {
      budgetInput.value = draft.budget;
    }
    if (draft.context) window.PortfoFormContext.restore(draft.context);
  };

  restoreDraft();

  let formStarted = false;
  const markFormStart = () => {
    if (formStarted) return;
    formStarted = true;
    trackEvent("form_start", { form: "contact" });
  };

  form.addEventListener("focusin", markFormStart);
  form.addEventListener("input", () => {
    clearValidity();
    markFormStart();
    syncFallbackLinks();
  });
  form.addEventListener("change", syncFallbackLinks);

  const copyLetter = async () => {
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
      showStatus(
        `Скопировать автоматически не удалось. Выделите текст в поле задачи или ${contactHint().toLowerCase()}`,
        "error"
      );
    }
  };

  copyBtn?.addEventListener("click", () => {
    copyLetter();
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
    trackEvent("form_gmail_open", { form: "contact" });
    window.location.assign(url);
  });

  mailtoOpen?.addEventListener("click", (event) => {
    const letter = syncFallbackLinks();
    if (!letter?.mailto) {
      event.preventDefault();
      validate();
      return;
    }
    trackEvent("form_mailto_open", { form: "contact" });
    showStatus("Откроется почтовая программа. Письмо нужно отправить в ней самостоятельно.", "ok");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (usesGmailFallback) return;
    if (submitting) return;
    form.classList.remove("is-success");

    const values = validate();
    if (!values) return;

    const snapshot = window.PortfoFormContext.snapshot();
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
    form.setAttribute("aria-busy", "true");

    showStatus("Отправляем заявку…", "ok");

    let result;
    try {
      result = await window.PortfoFormMail.submit({
        form: "contact",
        name: values.name,
        email: values.email,
        project: values.composed,
        timeline: values.timeline,
        budget: values.budget,
        service: snapshot.serviceId || undefined,
        projectRef: snapshot.projectId || undefined,
        website: websiteInput?.value || "",
        subject,
        bodyText,
      });
    } finally {
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.textContent = defaultSubmitLabel;
      }
      form.removeAttribute("aria-busy");
    }

    if (result.ok && result.mode === "api") {
      trackEvent("form_success", { form: "contact" });
      form.classList.add("is-success");
      showStatus("Письмо ушло через сервер. Ася ответит на указанный email.", "ok");
      form.reset();
      window.PortfoFormContext.clear();
      window.LyusyaNavigator?.replay?.();
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
      showStatus("Слишком много попыток подряд. Поля сохранены — подождите немного или отправьте через Gmail.", "error");
      return;
    }
    if (result.error === "contact_not_configured") {
      showStatus(`Форма временно недоступна. ${contactHint()}`, "error");
      return;
    }
    showStatus("Не удалось принять заявку. Поля сохранены — можно попробовать ещё раз или отправить через Gmail.", "error");
  });
}

/**
 * Лёгкая внутренняя аналитика: data-track + события Люси.
 * Не подключает внешние сервисы.
 */
function trackEvent(name, extra = {}) {
  const payload = { name, t: Date.now(), ...extra };
  window.__portfoEvents = window.__portfoEvents || [];
  window.__portfoEvents.push(payload);
  window.dispatchEvent(new CustomEvent("portfo:event", { detail: payload }));
}

function initTrack() {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[data-track]");
      if (!el) return;
      const name = el.getAttribute("data-track");
      if (!name) return;
      const service = el.getAttribute("data-service");
      const project = el.getAttribute("data-project");
      const category = el.getAttribute("data-category");
      if (service || project || category) {
        trackEvent(name, {
          href: el.getAttribute("href") || undefined,
          ...(service ? { service } : {}),
          ...(project ? { project } : {}),
          ...(category ? { category } : {}),
        });
        return;
      }
      trackEvent(name, {
        href: el.getAttribute("href") || undefined,
        label: (el.textContent || "").trim().slice(0, 80) || undefined,
      });
    },
    true
  );

  window.addEventListener("lyusya:event", (event) => {
    const detail = /** @type {{ name?: string } & Record<string, unknown>} */ (
      event.detail || {}
    );
    if (detail.name === "start" || detail.name === "open") {
      trackEvent("lucy_start", { via: detail.name });
      trackEvent("navigator_start", { via: detail.name });
    }
    if (detail.name === "step_complete") {
      trackEvent("lucy_step_complete", {
        step: detail.step,
      });
    }
    if (detail.name === "complete") {
      trackEvent("lucy_complete", { via: "lyusya" });
      trackEvent("navigator_complete", { via: "lyusya" });
    }
    if (detail.name === "route_generated") {
      trackEvent("route_generated", { via: "lyusya" });
    }
    if (detail.name === "route_submit" || detail.name === "handoff") {
      trackEvent("route_submit", { via: detail.name });
    }
  });
}

const PORTFOLIO_CATEGORIES = [
  { id: "all", label: "Все работы" },
  { id: "sites", label: "Сайты" },
  { id: "quizzes", label: "Квизы и интерактивы" },
  { id: "games", label: "Игры" },
  { id: "products", label: "Цифровые продукты" },
];

function createFormContext() {
  const state = {
    serviceId: "",
    serviceLabel: "",
    projectId: "",
    projectLabel: "",
    lyusyaRoute: "",
  };

  const render = () => {
    const box = $("#form-context");
    const list = $("#form-context-list");
    if (!box || !list) return;
    list.replaceChildren();
    const items = [
      state.serviceLabel ? `Услуга: ${state.serviceLabel}` : "",
      state.projectLabel ? `Проект: ${state.projectLabel}` : "",
      state.lyusyaRoute ? "Маршрут Люси" : "",
    ].filter(Boolean);

    items.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.append(li);
    });
    box.hidden = items.length === 0;
  };

  const compose = (userText) => {
    const blocks = [];
    if (state.serviceLabel) blocks.push(`Маршрут: ${state.serviceLabel}`);
    if (state.projectLabel) blocks.push(`Проект: ${state.projectLabel}`);
    if (state.lyusyaRoute) blocks.push(state.lyusyaRoute.trim());
    const user = String(userText || "").trim();
    if (user) blocks.push(user);
    return blocks.join("\n\n");
  };

  const api = {
    setService(id, label) {
      if (!label) return;
      state.serviceId = id || "";
      state.serviceLabel = label;
      render();
    },
    setProject(id, label) {
      if (!label) return;
      state.projectId = id || "";
      state.projectLabel = label;
      render();
    },
    setLyusyaRoute(text) {
      state.lyusyaRoute = String(text || "").trim();
      render();
    },
    compose,
    snapshot() {
      return { ...state };
    },
    restore(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return;
      if (snapshot.serviceLabel) api.setService(snapshot.serviceId || "", snapshot.serviceLabel);
      if (snapshot.projectLabel) api.setProject(snapshot.projectId || "", snapshot.projectLabel);
      if (snapshot.lyusyaRoute) api.setLyusyaRoute(snapshot.lyusyaRoute);
    },
    clear() {
      state.serviceId = "";
      state.serviceLabel = "";
      state.projectId = "";
      state.projectLabel = "";
      state.lyusyaRoute = "";
      render();
    },
  };

  window.PortfoFormContext = api;
  render();
  return api;
}

window.PortfoFormContext = createFormContext();

function initFormContext() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest("[data-service], [data-project], [data-service-label], [data-project-label]");
    if (!el) return;
    const serviceId = el.getAttribute("data-service") || "";
    const serviceLabel = el.getAttribute("data-service-label") || "";
    const projectId = el.getAttribute("data-project") || "";
    const projectLabel = el.getAttribute("data-project-label") || "";
    if (serviceLabel) window.PortfoFormContext.setService(serviceId, serviceLabel);
    if (projectLabel) window.PortfoFormContext.setProject(projectId, projectLabel);
  });
}

function initLyusyaTriggers(reduced) {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("[data-lyusya-start]");
    if (!trigger) return;

    window.setTimeout(() => {
      const api = window.LyusyaNavigator;
      if (!api) {
        scrollToHash("#lyusya-quest", reduced);
        return;
      }
      const fromCase = Boolean(trigger.closest(".expedition, .case-bridge--after, .case-proof"));
      if (fromCase && typeof api.openFromCase === "function") api.openFromCase();
      else if (typeof api.showIntro === "function") api.showIntro(false);
      scrollToHash("#lyusya-quest", reduced);
    }, reduced ? 0 : 80);
  });
}

/**
 * @param {string} hash
 * @param {boolean} reduced
 */
function scrollToHash(hash, reduced) {
  const target = $(hash);
  if (!target) return;
  const headerH = $(".site-header")?.offsetHeight || 72;
  const top = Math.max(
    0,
    target.getBoundingClientRect().top + window.scrollY - headerH - SCROLL_OFFSET
  );
  window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
}

/**
 * View Transitions API + мягкая шторка как fallback.
 * @param {string} hash
 * @param {HTMLElement | null} veil
 * @param {boolean} reduced
 */
function urlWithHash(hash) {
  const url = new URL(window.location.href);
  url.hash = hash.startsWith("#") ? hash.slice(1) : hash;
  return `${url.pathname}${url.search}${url.hash}`;
}

function sameDocumentUrl(url) {
  const current = new URL(window.location.href);
  const normalize = (path) => path.replace(/\/index\.html$/i, "/").replace(/\/$/, "") || "/";
  return url.origin === current.origin && normalize(url.pathname) === normalize(current.pathname);
}

async function navigateToHash(hash, veil, reduced) {
  const go = () => {
    scrollToHash(hash, reduced);
    history.pushState(null, "", urlWithHash(hash));
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
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;

    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("mailto:")) return;

    let nextUrl;
    try {
      nextUrl = new URL(raw, window.location.href);
    } catch {
      return;
    }
    if (!sameDocumentUrl(nextUrl)) return;

    const hash = nextUrl.hash;
    const requestedCategory = nextUrl.searchParams.get("category");
    const changesCategory = nextUrl.searchParams.has("category") || /(?:\?|&)category=/i.test(raw);

    if (!hash && !changesCategory) return;
    if (hash === "#" ) return;

    event.preventDefault();
    if (changesCategory) {
      setPortfolioCategory(normalizeCategory(requestedCategory), {
        push: true,
        hash: hash || "#expeditions",
      });
    }
    if (hash && hash.length > 1) {
      revealHashTarget(hash);
      navigateToHash(hash, veil, reduced);
    } else if (changesCategory) {
      scrollToHash("#expeditions", reduced);
    }
  });
}

function normalizeCategory(value) {
  if (!value || value === "all") return "all";
  return PORTFOLIO_CATEGORIES.some((item) => item.id === value) ? value : "all";
}

function categoryFromLocation() {
  return normalizeCategory(new URL(window.location.href).searchParams.get("category"));
}

function ruWorksCount(n) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} работа`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} работы`;
  return `${n} работ`;
}

function setFilterHidden(el, hidden) {
  el.classList.toggle("is-filter-hidden", hidden);
  el.toggleAttribute("inert", hidden);
  if (hidden) el.setAttribute("aria-hidden", "true");
  else el.removeAttribute("aria-hidden");
}

function forcedIdsFromHash(hash) {
  const ids = new Set();
  if (!hash || hash.length < 2) return ids;
  const el = document.getElementById(hash.slice(1));
  if (!el) return ids;
  const card = el.closest("article.expedition[id]");
  if (card?.id) ids.add(card.id);
  if (el.id) ids.add(el.id);
  if (el.id === "case-portal-proof" || el.closest("#case-portal-proof")) {
    ids.add("case-portal");
    ids.add("case-portal-proof");
  }
  const related = el.getAttribute("data-related-case");
  if (related) ids.add(related);
  return ids;
}

function revealHashTarget(hash) {
  const force = forcedIdsFromHash(hash);
  if (!force.size) return;
  applyPortfolioFilter(categoryFromLocation(), force);
}

function applyPortfolioFilter(category, force = forcedIdsFromHash(window.location.hash)) {
  const cards = $$("#expeditions article.expedition[data-categories]");
  let visible = 0;
  cards.forEach((card) => {
    const cats = (card.dataset.categories || "").split(/\s+/).filter(Boolean);
    const match = category === "all" || cats.includes(category) || force.has(card.id);
    setFilterHidden(card, !match);
    if (match) visible += 1;
  });

  $$("#expeditions .case-proof, #expeditions .expedition-carousel").forEach((el) => {
    const cats = (el.dataset.categories || "").split(/\s+/).filter(Boolean);
    const related = el.getAttribute("data-related-case") || "";
    const match =
      category === "all" ||
      cats.includes(category) ||
      force.has(el.id) ||
      (related && force.has(related));
    setFilterHidden(el, !match);
  });

  $$("[data-portfolio-filter]").forEach((btn) => {
    const active = btn.getAttribute("data-portfolio-filter") === category;
    btn.setAttribute("aria-pressed", String(active));
  });

  const status = $("[data-portfolio-status]");
  if (status) {
    const label = PORTFOLIO_CATEGORIES.find((item) => item.id === category)?.label || "Все работы";
    status.textContent =
      category === "all"
        ? `Показаны все ${ruWorksCount(visible)}.`
        : `Найдено: ${ruWorksCount(visible)}. Фильтр: ${label}.`;
  }
}

function setPortfolioCategory(category, { push = true, hash } = {}) {
  const url = new URL(window.location.href);
  if (category === "all") url.searchParams.delete("category");
  else url.searchParams.set("category", category);
  if (hash) url.hash = hash.startsWith("#") ? hash.slice(1) : hash;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (push) history.pushState({ category }, "", next);
  else history.replaceState({ category }, "", next);
  applyPortfolioFilter(category);
}

function initPortfolioFilters() {
  const root = $("[data-portfolio-filters]");
  if (!root) return;

  PORTFOLIO_CATEGORIES.forEach((item) => {
    if (item.id === "all") return;
    const hasWorks = $$(`#expeditions article.expedition[data-categories~="${item.id}"]`).length > 0;
    const btn = root.querySelector(`[data-portfolio-filter="${item.id}"]`);
    if (btn && !hasWorks) btn.hidden = true;
  });

  root.addEventListener("click", (event) => {
    const btn = event.target instanceof Element ? event.target.closest("[data-portfolio-filter]") : null;
    if (!(btn instanceof HTMLButtonElement) || btn.hidden) return;
    const category = normalizeCategory(btn.getAttribute("data-portfolio-filter"));
    setPortfolioCategory(category, { push: true, hash: "#expeditions" });
  });

  window.addEventListener("popstate", () => {
    applyPortfolioFilter(categoryFromLocation());
    revealHashTarget(window.location.hash);
  });
  window.addEventListener("hashchange", () => {
    revealHashTarget(window.location.hash);
  });

  applyPortfolioFilter(categoryFromLocation());
}

function initYear() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function initCarousel(reduced) {
  const roots = $$("[data-carousel]");
  if (!roots.length) return;

  roots.forEach((root) => {
    const track = $("[data-carousel-track]", root);
    const slides = $$("[data-carousel-slide]", root);
    const prev = $("[data-carousel-prev]", root);
    const next = $("[data-carousel-next]", root);
    const dotsWrap = $("[data-carousel-dots]", root);
    const currentEl = $("[data-carousel-current]", root);
    const totalEl = $("[data-carousel-total]", root);
    if (!track || !slides.length) return;

    const interval = Number(root.dataset.carouselInterval) || 4200;
    let index = 0;
    let timer = 0;
    const total = slides.length;
    if (totalEl) totalEl.textContent = String(total);

    const dots = slides.map((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "carousel-dot";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-label", `Кадр ${i + 1}`);
      btn.addEventListener("click", () => goTo(i, true));
      dotsWrap?.append(btn);
      return btn;
    });

    const paint = () => {
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
      dots.forEach((dot, i) => dot.setAttribute("aria-selected", String(i === index)));
      if (currentEl) currentEl.textContent = String(index + 1);
    };

    const goTo = (nextIndex, user = false) => {
      index = (nextIndex + total) % total;
      paint();
      if (user) restartAutoplay();
    };

    const stopAutoplay = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };

    const startAutoplay = () => {
      if (reduced) return;
      stopAutoplay();
      timer = window.setInterval(() => goTo(index + 1), interval);
    };

    const restartAutoplay = () => {
      stopAutoplay();
      startAutoplay();
    };

    prev?.addEventListener("click", () => goTo(index - 1, true));
    next?.addEventListener("click", () => goTo(index + 1, true));

    root.addEventListener("pointerenter", stopAutoplay);
    root.addEventListener("pointerleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", (event) => {
      if (!root.contains(/** @type {Node} */ (event.relatedTarget))) startAutoplay();
    });

    let touchX = 0;
    track.addEventListener(
      "touchstart",
      (event) => {
        touchX = event.changedTouches[0]?.clientX ?? 0;
        stopAutoplay();
      },
      { passive: true }
    );
    track.addEventListener(
      "touchend",
      (event) => {
        const x = event.changedTouches[0]?.clientX ?? touchX;
        const delta = x - touchX;
        if (Math.abs(delta) > 40) goTo(index + (delta < 0 ? 1 : -1), true);
        else startAutoplay();
      },
      { passive: true }
    );

    paint();
    startAutoplay();
  });
}

function initMobileCta() {
  const cta = $(".mobile-cta");
  const hideWhen = ["#collaborate", "#lyusya"].map((sel) => $(sel)).filter(Boolean);
  if (!cta || !hideWhen.length || !("IntersectionObserver" in window)) return;

  const visible = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      cta.classList.toggle("is-hidden", visible.size > 0);
    },
    { rootMargin: "0px 0px -18% 0px", threshold: 0.12 }
  );
  hideWhen.forEach((el) => observer.observe(el));
}

function initHashLanding(reduced) {
  const hash = window.location.hash;
  window.requestAnimationFrame(() => {
    revealHashTarget(hash);
    if (!hash || hash.length < 2) return;
    scrollToHash(hash, reduced);
    if (hash === "#lyusya-quest") {
      const api = window.LyusyaNavigator;
      if (api && typeof api.showIntro === "function") api.showIntro(false);
    }
  });
}

function boot() {
  const reduced = prefersReducedMotion();
  initYear();
  initHeader();
  initMobileNav();
  initReveals(reduced);
  initHallIndicator(reduced);
  initForm(reduced);
  initTrack();
  initFormContext();
  initPortfolioFilters();
  initLyusyaTriggers(reduced);
  initMobileCta();
  initAnchorNav(reduced);
  initCarousel(reduced);
  initHashLanding(reduced);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", () => {
    if (motionQuery.matches) $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  });
}

boot();
})();
