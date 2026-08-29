/**

 * Отправка форм portfo.ru: API (SMTP) или fallback mailto.

 */

(() => {

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



  /**

   * @param {object} payload

   * @returns {Promise<{ ok: boolean, mode: "api" | "mailto", mailto?: string, error?: string }>}

   */

  async function submit(payload) {

    const apiUrl = getApiUrl();

    if (!apiUrl) {

      const mailto = buildMailto({

        subject: payload.subject,

        body: payload.bodyText,

      });



      if (!mailto) {

        return { ok: false, mode: "mailto", error: "contact_not_configured" };

      }



      return {

        ok: false,

        mode: "mailto",

        mailto,

      };

    }



    try {

      const response = await fetch(apiUrl, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Accept: "application/json",

        },

        body: JSON.stringify(payload),

      });



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        return {

          ok: false,

          mode: "api",

          error: data.error || "send_failed",

        };

      }



      return { ok: true, mode: "api" };

    } catch {

      return { ok: false, mode: "api", error: "network_error" };

    }

  }



  window.PortfoFormMail = {

    getContactEmail,

    submit,

    buildMailto,

  };

})();


