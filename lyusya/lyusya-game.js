/**
 * Люся — логика навигатора.
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

  /** @type {{ phase: string, stepIndex: number, answers: Record<string, object>, route: { summary: string, hypothesis: string, firstStep: string } | null }} */
  let state = createState();

  function createState() {
    return { phase: "intro", stepIndex: 0, answers: {}, route: null };
  }

  function track(name, extra = {}) {
    const payload = { name, ...extra, t: Date.now() };
    window.__lyusyaEvents = window.__lyusyaEvents || [];
    window.__lyusyaEvents.push(payload);
    window.dispatchEvent(new CustomEvent("lyusya:event", { detail: payload }));
  }

  function answerValues() {
    const values = {};
    for (const step of DATA.steps) {
      values[step.key] = state.answers[step.key]?.id;
    }
    return values;
  }

  function matchSummaryRule() {
    const values = answerValues();
    return (
      DATA.summaries.find((rule) =>
        Object.entries(rule.when).every(([key, id]) => values[key] === id)
      ) || null
    );
  }

  function shortOf(key) {
    return state.answers[key]?.short || "пока неясно";
  }

  function mapOf(key) {
    return state.answers[key]?.map || "—";
  }

  function buildRoute() {
    const rule = matchSummaryRule();
    let summary = rule?.text;
    if (!summary) {
      summary = DATA.fallbackSummary
        .replace("{need}", shortOf("need"))
        .replace("{gap}", shortOf("gap"))
        .replace("{audience}", shortOf("audience"))
        .replace("{outcome}", shortOf("outcome"))
        .replace("{tried}", shortOf("tried"))
        .replace("{success}", shortOf("success"))
        .replace("{urgency}", shortOf("urgency"));
    }

    return {
      summary,
      hypothesis: rule?.hypothesis || DATA.fallbackHypothesis,
      firstStep: rule?.firstStep || DATA.fallbackFirstStep,
    };
  }

  function fillTemplate(template) {
    const route = state.route || buildRoute();
    return template
      .replace(/\{need\}/g, mapOf("need"))
      .replace(/\{gap\}/g, mapOf("gap"))
      .replace(/\{audience\}/g, mapOf("audience"))
      .replace(/\{outcome\}/g, mapOf("outcome"))
      .replace(/\{tried\}/g, mapOf("tried"))
      .replace(/\{success\}/g, mapOf("success"))
      .replace(/\{urgency\}/g, mapOf("urgency"))
      .replace(/\{hypothesis\}/g, route.hypothesis)
      .replace(/\{firstStep\}/g, route.firstStep)
      .replace(/\{summary\}/g, route.summary);
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
    list.setAttribute("aria-label", cards ? "Варианты" : "Варианты ответа");

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

  function renderIntro(fromCase = false) {
    state.phase = "intro";
    root.classList.remove("is-idle");
    stageEl?.removeAttribute("hidden");
    idleEl?.setAttribute("hidden", "");
    clearBoard();
    setAvatar(DATA.intro.avatar);
    if (fromCase) {
      setSpeech(
        "Ты только что посмотрел, как Ася разбирает чужую задачу.\nТеперь давай разберём твою."
      );
    } else {
      setSpeech(DATA.intro.speech);
    }
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
    state.route = null;
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
    track("step_complete", { step: step.id, answer: option.id });
    const reaction = step.reactions?.[option.id];
    if (reaction) setSpeech(reaction);

    const next = () => renderStep(state.stepIndex + 1);
    if (reduced) next();
    else window.setTimeout(next, reaction ? 1200 : 280);
  }

  function renderResult() {
    state.phase = "result";
    state.route = buildRoute();
    track("complete", answerValues());
    track("route_generated", {
      hypothesis: state.route.hypothesis.slice(0, 120),
    });

    clearBoard();
    setAvatar(DATA.result.avatar);
    setSpeech(DATA.result.speech);
    if (progressEl) progressEl.textContent = "Твой маршрут";

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
      dd.textContent = mapOf(field.key);
      row.append(dt, dd);
      list.append(row);
    });
    map.append(list);

    const direction = document.createElement("div");
    direction.className = "lyusya-map__extra";
    direction.innerHTML = "";
    const hypTitle = document.createElement("p");
    hypTitle.className = "lyusya-map__extra-label";
    hypTitle.textContent = "Возможное направление";
    const hypText = document.createElement("p");
    hypText.className = "lyusya-map__extra-text";
    hypText.textContent = state.route.hypothesis;
    const stepTitle = document.createElement("p");
    stepTitle.className = "lyusya-map__extra-label";
    stepTitle.textContent = "Первый шаг";
    const stepText = document.createElement("p");
    stepText.className = "lyusya-map__extra-text";
    stepText.textContent = state.route.firstStep;
    direction.append(hypTitle, hypText, stepTitle, stepText);
    map.append(direction);

    const summary = document.createElement("p");
    summary.className = "lyusya-map__summary";
    summary.textContent = state.route.summary;
    map.append(summary);
    boardEl.append(map);

    const showFinale = () => {
      state.phase = "finale";
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
      reset.textContent = "Сбросить маршрут";
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
    track("route_submit");
    const text = fillTemplate(DATA.handoff.message);

    const form = document.querySelector(DATA.handoff.formSelector);
    const field = form?.elements?.namedItem(DATA.handoff.fieldName);
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const timeline = form?.elements?.namedItem("timeline");
    if (timeline instanceof HTMLInputElement && state.answers.urgency?.map) {
      timeline.value = state.answers.urgency.map;
      timeline.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const done = document.createElement("div");
    done.className = "lyusya-map lyusya-map--done";
    done.innerHTML = "";
    const doneTitle = document.createElement("h3");
    doneTitle.className = "lyusya-map__title";
    doneTitle.textContent = "Маршрут построен";
    const doneLead = document.createElement("p");
    doneLead.className = "lyusya-map__summary";
    doneLead.textContent = "Я передала маршрут Асе. Осталось указать имя и контакт в форме ниже.";
    const doneList = document.createElement("ul");
    doneList.className = "lyusya-map__checklist";
    [
      `Проблема: ${mapOf("gap")}`,
      `Направление: ${state.route?.hypothesis || DATA.fallbackHypothesis}`,
      `Следующий шаг: ${state.route?.firstStep || DATA.fallbackFirstStep}`,
    ].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      doneList.append(li);
    });
    done.append(doneTitle, doneLead, doneList);
    clearBoard();
    boardEl?.append(done);
    setSpeech("Маршрут готов. Добавьте имя и контакт — и Ася его получит.");

    const target = document.querySelector(DATA.handoff.scrollTo);
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => {
      const nameField = form?.elements?.namedItem("name");
      if (nameField instanceof HTMLInputElement) nameField.focus();
      else field?.focus();
    }, reduced ? 0 : 450);
  }

  function replay() {
    track("reset");
    state = createState();
    renderIntro(false);
  }

  function portfolio() {
    track("portfolio");
    document.querySelector("#expeditions")?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }

  function openFromCase() {
    root.classList.remove("is-idle");
    stageEl?.removeAttribute("hidden");
    idleEl?.setAttribute("hidden", "");
    renderIntro(true);
  }

  idleEl?.querySelector("button")?.addEventListener("click", () => {
    track("resume");
    renderIntro(false);
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

  window.LyusyaNavigator = {
    start,
    openFromCase,
    showIntro: renderIntro,
    replay,
    handoff,
  };

  renderIntro(false);
})();
