/**
 * ВайбНавигатор Люся — сопровождение по залам.
 * Не переписывает игру: слушает lyusya:event, рисует редкие встречи в карманах.
 */
(() => {
  const ROOT = window.LyusyaData;
  const DATA = ROOT?.companion;
  if (!DATA) return;

  const LOCAL_KEY = "lyusyaCompanion";
  const SESSION_KEY = "lyusyaCompanionSession";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const avatars = ROOT.avatars || {};

  const readJson = (store, key) => {
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const defaultMemory = () => ({
    visited: {},
    dismissed: {},
    playedNavigator: false,
    handoffDone: false,
    microPlayed: false,
    microDeclined: false,
    idleHintShown: false,
    idleDismissed: false,
    projectPath: null,
    currentHall: "00",
  });

  const loadMemory = () => ({
    ...defaultMemory(),
    ...readJson(localStorage, LOCAL_KEY),
    ...readJson(sessionStorage, SESSION_KEY),
  });

  let memory = loadMemory();

  const save = () => {
    try {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          playedNavigator: memory.playedNavigator,
          microPlayed: memory.microPlayed,
          projectPath: memory.projectPath,
        })
      );
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          visited: memory.visited,
          dismissed: memory.dismissed,
          handoffDone: memory.handoffDone,
          microDeclined: memory.microDeclined,
          idleHintShown: memory.idleHintShown,
          idleDismissed: memory.idleDismissed,
          currentHall: memory.currentHall,
        })
      );
    } catch {
      /* private mode */
    }
  };

  const track = (name, extra = {}) => {
    const payload = { name: `companion:${name}`, ...extra, t: Date.now() };
    window.__lyusyaEvents = window.__lyusyaEvents || [];
    window.__lyusyaEvents.push(payload);
    window.dispatchEvent(new CustomEvent("lyusya:event", { detail: payload }));
  };

  const scrollToSelector = (selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const headerH = document.querySelector(".site-header")?.offsetHeight || 72;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerH - 12);
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  const filterActions = (actions = []) =>
    actions.filter((action) => {
      if (action.skipIfPlayed && memory.playedNavigator) return false;
      if (action.action === "micro" && (memory.microPlayed || memory.microDeclined)) return false;
      return true;
    });

  const makeBtn = (label, className, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  };

  const avatarSrc = (key) => avatars[key] || avatars.chibi;

  const setCardSpeech = (card, text, avatarKey) => {
    const speech = card.querySelector(".lyusya-whisper__speech");
    const img = card.querySelector(".lyusya-whisper__avatar img");
    if (speech) speech.textContent = text;
    if (img && avatarKey) img.src = avatarSrc(avatarKey);
  };

  const clearCardBoard = (card) => {
    card.querySelector(".lyusya-whisper__actions")?.replaceChildren();
    card.querySelector(".lyusya-whisper__stories")?.replaceChildren();
  };

  const runMicro = (card, encounterId) => {
    const micro = DATA.micro;
    if (!micro || memory.microPlayed || memory.microDeclined) return;

    clearCardBoard(card);
    setCardSpeech(card, micro.invite, micro.avatar);
    const actions = card.querySelector(".lyusya-whisper__actions");
    if (!actions) return;

    actions.append(
      makeBtn(micro.agree, "lyusya-whisper__btn", () => {
        clearCardBoard(card);
        setCardSpeech(card, micro.question, micro.avatar);
        micro.options.forEach((option) => {
          actions.append(
            makeBtn(option.label, "lyusya-whisper__btn lyusya-whisper__btn--ghost", () => {
              memory.microPlayed = true;
              save();
              track("micro", { id: encounterId, answer: option.id });
              clearCardBoard(card);
              setCardSpeech(card, option.reaction, micro.avatar);
            })
          );
        });
      }),
      makeBtn(micro.decline, "lyusya-whisper__btn lyusya-whisper__btn--quiet", () => {
        memory.microDeclined = true;
        save();
        track("micro-skip", { id: encounterId });
        clearCardBoard(card);
        setCardSpeech(card, "Хорошо. Я рядом, если передумаешь.", "chibi");
      })
    );
  };

  const handleAction = (card, encounter, action) => {
    track("action", { id: encounter.id, action: action.id || action.action || action.href });
    if (action.action === "micro") {
      runMicro(card, encounter.id);
      return;
    }
    if (action.href) scrollToSelector(action.href);
  };

  const renderEncounter = (host, encounter) => {
    if (!host || memory.dismissed[encounter.id]) return;
    if (encounter.skipIfHandoff && memory.handoffDone) return;

    const played = memory.playedNavigator;
    const speech = played && encounter.playedSpeech ? encounter.playedSpeech : encounter.speech;
    const actions = filterActions(encounter.actions);
    const stories = encounter.stories || [];

    const card = document.createElement("aside");
    card.className = "lyusya-whisper";
    card.dataset.encounter = encounter.id;
    card.setAttribute("aria-label", "Люся рядом");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "lyusya-whisper__close";
    close.setAttribute("aria-label", "Спрятать реплику Люси");
    close.textContent = "×";
    close.addEventListener("click", () => {
      memory.dismissed[encounter.id] = true;
      save();
      track("dismiss", { id: encounter.id });
      card.remove();
    });

    const media = document.createElement("figure");
    media.className = "lyusya-whisper__avatar";
    const img = document.createElement("img");
    img.src = avatarSrc(encounter.avatar);
    img.alt = "Люся";
    img.width = 120;
    img.height = 120;
    img.decoding = "async";
    media.append(img);

    const body = document.createElement("div");
    body.className = "lyusya-whisper__body";

    const name = document.createElement("p");
    name.className = "lyusya-whisper__name";
    name.textContent = "Люся · навигатор";

    const text = document.createElement("p");
    text.className = "lyusya-whisper__speech";
    text.textContent = speech;

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "lyusya-whisper__actions";
    actions.forEach((action) => {
      const btn = makeBtn(
        action.label,
        "lyusya-whisper__btn",
        () => handleAction(card, encounter, action)
      );
      if (action.skipIfPlayed) btn.dataset.lyusyaAction = "play";
      actionsWrap.append(btn);
    });

    body.append(name, text, actionsWrap);

    if (stories.length) {
      const storiesWrap = document.createElement("div");
      storiesWrap.className = "lyusya-whisper__stories";
      stories.forEach((story) => {
        const row = document.createElement("div");
        row.className = "lyusya-whisper__story";
        const tease = document.createElement("p");
        tease.textContent = story.tease;
        row.append(
          tease,
          makeBtn(story.label, "lyusya-whisper__btn lyusya-whisper__btn--ghost", () => {
            track("story", { id: encounter.id, story: story.id });
            scrollToSelector(story.href);
          })
        );
        storiesWrap.append(row);
      });
      body.append(storiesWrap);
    }

    card.append(close, media, body);
    host.append(card);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            track("seen", { id: encounter.id });
            observer.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(card);
    }
  };

  const hidePlayButtons = () => {
    document.querySelectorAll("[data-lyusya-action='play']").forEach((btn) => btn.remove());
    const exp = DATA.encounters.find((item) => item.id === "after-expeditions");
    const card = document.querySelector('[data-encounter="after-expeditions"]');
    if (exp?.playedSpeech && card) {
      const speech = card.querySelector(".lyusya-whisper__speech");
      if (speech) speech.textContent = exp.playedSpeech;
    }
  };

  const removeEncounter = (id) => {
    document.querySelector(`[data-encounter="${id}"]`)?.remove();
  };

  window.addEventListener("lyusya:event", (event) => {
    const name = event.detail?.name;
    if (name === "start" || name === "complete") {
      memory.playedNavigator = true;
      if (name === "complete") {
        memory.projectPath = {
          need: event.detail.need,
          goal: event.detail.goal,
          mood: event.detail.mood,
          audience: event.detail.audience,
        };
      }
      save();
      hidePlayButtons();
    }
    if (name === "handoff") {
      memory.handoffDone = true;
      save();
      removeEncounter("before-collab");
    }
  });

  const watchHalls = () => {
    const halls = [...document.querySelectorAll("[data-hall]")];
    if (!halls.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const hall = entry.target.getAttribute("data-hall");
          const id = entry.target.id || hall;
          memory.currentHall = hall || memory.currentHall;
          if (id) memory.visited[id] = true;
          save();
        });
      },
      { threshold: 0.35 }
    );
    halls.forEach((hall) => observer.observe(hall));
  };

  const stillNearEntrance = () => memory.currentHall === "00" || memory.currentHall === "01";

  const showIdleHint = () => {
    if (memory.idleHintShown || memory.idleDismissed || memory.playedNavigator) return;
    if (memory.visited.expeditions || memory.visited.lyusya || memory.visited["lyusya-quest"]) return;
    if (!stillNearEntrance()) return;

    const idle = DATA.idle;
    memory.idleHintShown = true;
    save();
    track("idle");

    const hint = document.createElement("aside");
    hint.className = "lyusya-idle-hint";
    hint.setAttribute("role", "complementary");
    hint.setAttribute("aria-label", "Подсказка Люси");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "lyusya-idle-hint__close";
    close.setAttribute("aria-label", "Закрыть подсказку");
    close.textContent = "×";
    close.addEventListener("click", () => {
      memory.idleDismissed = true;
      save();
      track("idle-dismiss");
      hint.remove();
    });

    const img = document.createElement("img");
    img.src = avatarSrc(idle.avatar);
    img.alt = "";
    img.width = 72;
    img.height = 72;
    img.decoding = "async";

    const speech = document.createElement("p");
    speech.className = "lyusya-idle-hint__speech";
    speech.textContent = idle.speech;

    const actions = document.createElement("div");
    actions.className = "lyusya-idle-hint__actions";
    filterActions(idle.actions).forEach((action) => {
      actions.append(
        makeBtn(action.label, "lyusya-whisper__btn lyusya-whisper__btn--tiny", () => {
          memory.idleDismissed = true;
          save();
          track("idle-action", { action: action.id });
          hint.remove();
          if (action.href) scrollToSelector(action.href);
        })
      );
    });

    const body = document.createElement("div");
    body.className = "lyusya-idle-hint__body";
    body.append(speech, actions);

    hint.append(close, img, body);
    document.body.append(hint);
    requestAnimationFrame(() => hint.classList.add("is-in"));
  };

  DATA.encounters.forEach((encounter) => {
    const host = document.querySelector(`[data-lyusya-encounter="${encounter.id}"]`);
    renderEncounter(host, encounter);
  });

  watchHalls();
  window.setTimeout(showIdleHint, DATA.idleMs || 60000);
})();
