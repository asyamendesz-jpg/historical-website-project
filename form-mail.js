/**
 * Отправка форм portfo.ru: API или запасной mailto.
 * Успех API — только HTTP 2xx и { ok: true }. Ошибка API не переключается на mailto.
 */
(() => {
  const REQUEST_MS = 15000;
  const ALLOWED_KEYS = [
    "form",
    "name",
    "email",
    "project",
    "timeline",
    "budget",
    "agency",
    "service",
    "projectRef",
    "website",
  ];

  const getContactEmail = () => {
    const email = window.PORTFO_FORM?.contactEmail;
    return email ? String(email).trim() : "";
  };

  const getApiUrl = () =>
    window.PORTFO_FORM?.apiUrl ? String(window.PORTFO_FORM.apiUrl).trim() : "";

  const buildMailto = ({ subject, body }) => {
    const contactEmail = getContactEmail();
    if (!contactEmail) return "";
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const buildGmailCompose = ({ subject, body }) => {
    const contactEmail = getContactEmail();
    if (!contactEmail) return "";
    return (
      "https://mail.google.com/mail/?view=cm&fs=1&to=" +
      encodeURIComponent(contactEmail) +
      "&su=" +
      encodeURIComponent(subject || "") +
      "&body=" +
      encodeURIComponent(body || "")
    );
  };

  const pickPayload = (payload) => {
    const out = {};
    ALLOWED_KEYS.forEach((key) => {
      if (typeof payload[key] === "string") out[key] = payload[key];
    });
    return out;
  };

  const parseJsonSafe = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  /**
   * @param {object} payload
   * @param {{ fetch?: typeof fetch }} [deps]
   * @returns {Promise<{ ok: boolean, mode: "api" | "mailto", mailto?: string, error?: string }>}
   */
  async function submit(payload, deps = {}) {
    const apiUrl = getApiUrl();

    if (!apiUrl) {
      const mailto = buildMailto({
        subject: payload.subject,
        body: payload.bodyText,
      });
      if (!mailto) return { ok: false, mode: "mailto", error: "contact_not_configured" };
      return { ok: false, mode: "mailto", mailto };
    }

    const fetchFn = deps.fetch || window.fetch.bind(window);
    const controller = new AbortController();
    const schedule = typeof setTimeout === "function" ? setTimeout : window.setTimeout;
    const cancel = typeof clearTimeout === "function" ? clearTimeout : window.clearTimeout;
    const timer = schedule(() => controller.abort(), REQUEST_MS);

    try {
      const response = await fetchFn(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(pickPayload(payload)),
        signal: controller.signal,
      });

      const data = await parseJsonSafe(response);
      if (response.ok && data && data.ok === true) {
        return { ok: true, mode: "api" };
      }
      const error =
        data && typeof data.error === "string"
          ? data.error
          : response.ok
            ? "unexpected_response"
            : "send_failed";
      return { ok: false, mode: "api", error };
    } catch (error) {
      const aborted = error && (error.name === "AbortError" || error.code === 20);
      return { ok: false, mode: "api", error: aborted ? "timeout" : "network_error" };
    } finally {
      cancel(timer);
    }
  }

  window.PortfoFormMail = {
    getContactEmail,
    getApiUrl,
    submit,
    buildMailto,
    buildGmailCompose,
  };
})();
