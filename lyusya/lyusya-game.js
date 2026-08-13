/**
 * ВайбНавигатор Люся — логика игры.
 * Состояние: intro → steps[] → result → finale.
 * События: window.dispatchEvent("lyusya:event") + window.__lyusyaEvents[]
 */
(() => {
  const DATA = window.LyusyaData;
  if (!DATA) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.querySelector("#lyusya-quest");
  if (!root) return;

  const avatarEl = root.querySelector("#lyusya-avatar");
  const speechEl = root.querySelector("#lyusya-speech");
  const progressEl = root.querySelector("#lyusya-progress");
  const boardEl = root.querySelector("#lyusya-board");
  const actionsEl = root.querySelector("#lyusya-actions");
  const idleEl = root.querySelector("#lyusya-idle");
  const stageEl = root.querySelector(".lyusya-quest__play");

  /** @type {{ phase: string, stepIndex: number, answers: Record<string, object> }} */
  let state = createState();

  function createState() {
    return { phase: "intro", stepIndex: 0, answers: {} };
  }

  function track(name, extra = {}) {
    const payload = { name, ...extra, t: Date.now() };
    window.__lyusyaEvents = window.__lyusyaEvents || [];
    window.__lyusyaEvents.push(payload);
    window.dispatchEvent(new CustomEvent("lyusya:event", { detail: payload }));
  }

  function optionById(step, id) {
    return step.options.find((item) => item.id === id);
  }

  function buildSummary(answers) {
    const values = {};
    for (const step of DATA.steps) {
      values[step.key] = answers[step.key]?.id;
    }

    const special = DATA.summaries.find((rule) =>
      Object.entries(rule.when).every(([key, id]) => values[key] === id)
    );
    if (special) return special.text;

    const shortOf = (key) => answers[key]?.short || "пока неясно";
    return DATA.fallbackSummary
      .replace("{mood}", shortOf("mood"))
      .replace("{need}", shortOf("need"))
      .replace("{audience}", shortOf("audience"))
      .replace("{goal}", shortOf("goal"));
  }

  function setAvatar(key) {
    const src = DATA.avatars[key] || DATA.avatars.chibi;
    if (!avatarEl || avatarEl.getAttribute("src") === src) return;
    avatarEl.classList.add("is-swapping");
    const apply = () => {
      avatarEl.src = src;
      avatarEl.classList.remove("is-swapping");
    };
    if (reduced) apply();
    else window.setTimeout(apply, 180);
  }

  function setSpeech(text) {
    if (!speechEl) return;
    speechEl.classList.remove("is-in");
    speechEl.textContent = "";
    const write = () => {
      speechEl.textContent = text;
      speechEl.classList.add("is-in");
    };
    if (reduced) write();
    else window.setTimeout(write, 40);
  }

  function clearBoard() {
    if (boardEl) boardEl.innerHTML = "";
    if (actionsEl) actionsEl.innerHTML = "";
    if (progressEl) progressEl.textContent = "";
  }

  function focusSpeech() {
    speechEl?.focus({ preventScroll: true });
  }

  function renderChoices(items, { cards = false } = {}) {
    if (!boardEl) return;
    const list = document.createElement("div");
    list.className = cards ? "lyusya-cards" : "lyusya-choices";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", cards ? "Настроение сайта" : "Варианты ответа");

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cards ? "lyusya-card-choice" : "lyusya-choice";
      if (cards) btn.dataset.tone = item.tone || "";
      btn.setAttribute("aria-label", item.label);
      if (cards && item.icon) {
        const icon = document.createElement("span");
        icon.className = "lyusya-card-choice__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = item.icon;
        btn.append(icon);
      }
      const label = document.createElement("span");
      label.textContent = item.label;
      btn.append(label);
      btn.addEventListener("click", () => item.onSelect());
      list.append(btn);
    });

    boardEl.append(list);
  }

  function renderIntro() {
    state.phase = "intro";
    root.classList.remove("is-idle");
    stageEl?.removeAttribute("hidden");
    idleEl?.setAttribute("hidden", "");
    clearBoard();
    setAvatar(DATA.intro.avatar);
    setSpeech(DATA.intro.speech);
    renderChoices(
      DATA.intro.choices.map((choice) => ({
        ...choice,
        onSelect: () => {
          if (choice.action === "browse") return browse();
          start();
        },
      }))
    );
    focusSpeech();
  }

  function start() {
    track("start");
    state.stepIndex = 0;
    state.answers = {};
    renderStep(0);
  }

  function browse() {
    track("browse");
    state.phase = "idle";
    root.classList.add("is-idle");
    stageEl?.setAttribute("hidden", "");
    idleEl?.removeAttribute("hidden");
    setSpeech(DATA.browse.speech);
  }

  function renderStep(index) {
    const step = DATA.steps[index];
    if (!step) {
      renderResult();
      return;
    }

    state.phase = "step";
    state.stepIndex = index;
    track("step", { step: step.id, index: index + 1 });
    clearBoard();
    setAvatar(step.avatar);
    setSpeech(step.speech);
    if (progressEl) progressEl.textContent = step.progress || "";

    renderChoices(
      step.options.map((option) => ({
        ...option,
        onSelect: () => choose(step, option),
      })),
      { cards: step.type === "cards" }
    );
    focusSpeech();
  }

  function choose(step, option) {
    state.answers[step.key] = option;
    const reaction = step.reactions?.[option.id];
    if (reaction) setSpeech(reaction);

    const next = () => renderStep(state.stepIndex + 1);
    if (reduced) next();
    else window.setTimeout(next, reaction ? 1200 : 280);
  }

  function renderResult() {
    state.phase = "result";
    track("complete", {
      need: state.answers.need?.id,
      goal: state.answers.goal?.id,
      mood: state.answers.mood?.id,
      audience: state.answers.audience?.id,
    });

    clearBoard();
    setAvatar(DATA.result.avatar);
    setSpeech(DATA.result.speech);
    if (progressEl) progressEl.textContent = "Карта проекта";

    const map = document.createElement("article");
    map.className = "lyusya-map";
    map.setAttribute("aria-label", DATA.result.title);

    const title = document.createElement("h3");
    title.className = "lyusya-map__title";
    title.textContent = DATA.result.title;
    map.append(title);

    const list = document.createElement("dl");
    list.className = "lyusya-map__list";
    DATA.result.fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "lyusya-map__row";
      const dt = document.createElement("dt");
      dt.textContent = `${field.icon} ${field.label}`;
      const dd = document.createElement("dd");
      dd.textContent = state.answers[field.key]?.map || "—";
      row.append(dt, dd);
      list.append(row);
    });
    map.append(list);

    const summary = document.createElement("p");
    summary.className = "lyusya-map__summary";
    summary.textContent = buildSummary(state.answers);
    map.append(summary);
    boardEl.append(map);

    const showFinale = () => {
      setAvatar(DATA.finale.avatar);
      setSpeech(DATA.finale.speech);
      renderChoices(
        DATA.finale.choices.map((choice) => ({
          ...choice,
          onSelect: () => onFinale(choice.action),
        }))
      );
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "lyusya-reset";
      reset.textContent = "Сбросить игру";
      reset.addEventListener("click", replay);
      actionsEl.append(reset);
      focusSpeech();
    };

    if (reduced) showFinale();
    else window.setTimeout(showFinale, 1100);
  }

  function onFinale(action) {
    if (action === "handoff") return handoff();
    if (action === "replay") return replay();
    if (action === "portfolio") return portfolio();
  }

  function handoff() {
    track("handoff");
    const template = DATA.handoff.message;
    const text = template
      .replace("{need}", state.answers.need?.map || "—")
      .replace("{goal}", state.answers.goal?.map || "—")
      .replace("{mood}", state.answers.mood?.map || "—")
      .replace("{audience}", state.answers.audience?.map || "—");

    const form = document.querySelector(DATA.handoff.formSelector);
    const field = form?.elements?.namedItem(DATA.handoff.fieldName);
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const target = document.querySelector(DATA.handoff.scrollTo);
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => field?.focus(), reduced ? 0 : 450);
  }

  function replay() {
    track("reset");
    state = createState();
    renderIntro();
  }

  function portfolio() {
    track("portfolio");
    document.querySelector("#expeditions")?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }

  idleEl?.querySelector("button")?.addEventListener("click", () => {
    track("resume");
    renderIntro();
  });

  let opened = false;
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (opened) return;
        if (entries.some((entry) => entry.isIntersecting)) {
          opened = true;
          track("open");
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(root);
  } else {
    track("open");
  }

  renderIntro();
})();
