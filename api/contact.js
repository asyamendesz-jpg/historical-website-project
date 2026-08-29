const nodemailer = require("nodemailer");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://portfo.ru,https://www.portfo.ru")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requiredString(value, min = 1) {
  return typeof value === "string" && value.trim().length >= min;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }

  if (!origin || !allowedOrigins.includes(origin)) {
    res.writeHead(403, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "origin_not_allowed" }));
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    res.writeHead(500, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "smtp_not_configured" }));
  }

  try {
    const body = req.body || {};
    const form = body.form === "agency" ? "agency" : "contact";
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const project = String(body.project || "").trim();
    const timeline = String(body.timeline || "").trim();
    const budget = String(body.budget || "").trim();
    const agency = String(body.agency || "").trim();

    if (!requiredString(name, 2)) {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_name" }));
    }

    if (!isValidEmail(email)) {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_email" }));
    }

    if (!requiredString(project, 8)) {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_project" }));
    }

    if (form === "agency" && !requiredString(agency, 2)) {
      res.writeHead(400, { ...headers, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_agency" }));
    }

    const to = process.env.CONTACT_EMAIL;
    if (!to) {
      res.writeHead(500, { ...headers, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "contact_not_configured" }));
    }

    const from = process.env.SMTP_FROM || SMTP_USER;
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE !== "false";

    let subject;
    let text;

    if (form === "agency") {
      subject = `Агентство: ${agency}`;
      const extra = timeline ? `\nСрок: ${timeline}` : "";
      text = `Агентство: ${agency}\nКонтакт: ${name}\nEmail: ${email}${extra}\n\nЗадача:\n${project}`;
    } else {
      subject = `Сотрудничество: ${name}`;
      const extra = [
        timeline ? `Срок: ${timeline}` : "",
        budget ? `Бюджет: ${budget}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      text = `Имя: ${name}\nКонтакт: ${email}${extra ? `\n${extra}` : ""}\n\nЧто хотите сделать:\n${project}`;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Portfo" <${from}>`,
      to,
      replyTo: email,
      subject,
      text,
    });

    res.writeHead(200, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error("contact_send_failed", error);
    res.writeHead(500, { ...headers, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "send_failed" }));
  }
};
