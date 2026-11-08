/**
 * Прежний обработчик для Vercel. Рабочий путь — PHP на Beget: forms-beget/.
 * Не деплоить и не подключать через apiUrl.
 */
const nodemailer = require("nodemailer");

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT = 8000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const BLOCKED_MAILBOXES = new Set([
  "hello@asyamendes.ru",
  "work@asyamendes.ru",
]);
const ALLOWED_FIELDS = new Set([
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
]);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://portfo.ru,https://www.portfo.ru")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const hitsByIp = new Map();

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

function json(res, status, headers, payload) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" });
  return res.end(JSON.stringify(payload));
}

function oneLine(value, max = 200) {
  return String(value || "")
    .replace(/[\r\n\0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function multiline(value, max = MAX_TEXT) {
  return String(value || "")
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

function isValidEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (/[\r\n]/.test(email)) return false;
  return email.length <= 120;
}

function isBlockedMailbox(email) {
  return BLOCKED_MAILBOXES.has(String(email || "").trim().toLowerCase());
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function allowRequest(ip) {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  return true;
}

function pickAllowed(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of ALLOWED_FIELDS) {
    if (typeof raw[key] === "string") out[key] = raw[key];
  }
  return out;
}

function readBody(req) {
  const length = Number(req.headers["content-length"] || 0);
  if (length > MAX_BODY_BYTES) {
    const error = new Error("payload_too_large");
    error.code = "payload_too_large";
    throw error;
  }
  let parsed;
  try {
    parsed = req.body;
  } catch {
    const error = new Error("invalid_json");
    error.code = "invalid_json";
    throw error;
  }
  if (typeof parsed === "string") {
    if (parsed.length > MAX_BODY_BYTES) {
      const error = new Error("payload_too_large");
      error.code = "payload_too_large";
      throw error;
    }
    parsed = JSON.parse(parsed);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("invalid_json");
    error.code = "invalid_json";
    throw error;
  }
  return pickAllowed(parsed);
}

module.exports = async (req, res) => {
  const origin = String(req.headers.origin || "");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }

  if (req.method !== "POST") {
    return json(res, 405, headers, { error: "method_not_allowed" });
  }

  if (!origin || !allowedOrigins.includes(origin)) {
    return json(res, 403, headers, { error: "origin_not_allowed" });
  }

  if (!allowRequest(clientIp(req))) {
    return json(res, 429, headers, { error: "too_many_requests" });
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return json(res, 500, headers, { error: "smtp_not_configured" });
  }

  let body;
  try {
    body = readBody(req);
  } catch (error) {
    if (error.code === "payload_too_large") {
      return json(res, 413, headers, { error: "payload_too_large" });
    }
    return json(res, 400, headers, { error: "invalid_json" });
  }

  if (oneLine(body.website, 80)) {
    return json(res, 200, headers, { ok: true });
  }

  const form = body.form === "agency" ? "agency" : "contact";
  const name = oneLine(body.name, 80);
  const email = oneLine(body.email, 120).toLowerCase();
  const project = multiline(body.project);
  const timeline = oneLine(body.timeline, 80);
  const budget = oneLine(body.budget, 80);
  const agency = oneLine(body.agency, 120);
  const service = oneLine(body.service, 40);
  const projectRef = oneLine(body.projectRef, 40);

  if (name.length < 2) return json(res, 400, headers, { error: "invalid_name" });
  if (!isValidEmail(email)) return json(res, 400, headers, { error: "invalid_email" });
  if (project.length < 8) return json(res, 400, headers, { error: "invalid_project" });
  if (form === "agency" && agency.length < 2) {
    return json(res, 400, headers, { error: "invalid_agency" });
  }

  const to = oneLine(process.env.CONTACT_EMAIL, 120);
  const from = oneLine(process.env.SMTP_FROM || SMTP_USER, 120);
  if (!isValidEmail(to) || isBlockedMailbox(to)) {
    return json(res, 500, headers, { error: "contact_not_configured" });
  }
  if (!isValidEmail(from) || isBlockedMailbox(from)) {
    return json(res, 500, headers, { error: "smtp_not_configured" });
  }

  const port = Number(process.env.SMTP_PORT || 465);
  if (port === 25) {
    return json(res, 500, headers, { error: "smtp_not_configured" });
  }
  const secure = process.env.SMTP_SECURE !== "false";

  let subject;
  let text;
  if (form === "agency") {
    subject = oneLine(`Агентство: ${agency}`, 140);
    const extra = timeline ? `\nСрок: ${timeline}` : "";
    text = `Агентство: ${agency}\nКонтакт: ${name}\nEmail: ${email}${extra}\n\nЗадача:\n${project}`;
  } else {
    subject = oneLine(`Сотрудничество: ${name}`, 140);
    const extra = [timeline ? `Срок: ${timeline}` : "", budget ? `Бюджет: ${budget}` : ""]
      .filter(Boolean)
      .join("\n");
    const context = [service ? `Услуга: ${service}` : "", projectRef ? `Проект: ${projectRef}` : ""]
      .filter(Boolean)
      .join("\n");
    text = `Имя: ${name}\nКонтакт: ${email}${extra ? `\n${extra}` : ""}${
      context ? `\n${context}` : ""
    }\n\nЧто хотите сделать:\n${project}`;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465 ? true : secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Portfo" <${from}>`,
      to,
      replyTo: email,
      envelope: { from, to },
      subject,
      text,
    });

    return json(res, 200, headers, { ok: true });
  } catch (error) {
    console.error("contact_send_failed", error && error.code ? error.code : "send_failed");
    return json(res, 500, headers, { error: "send_failed" });
  }
};
