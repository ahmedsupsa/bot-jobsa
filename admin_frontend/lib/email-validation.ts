// Strict email validator used at store checkout to block obvious test/disposable emails.

const FORMAT_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Domains that are reserved for examples / placeholder text and should never
// receive real mail.
const PLACEHOLDER_DOMAINS = new Set([
  "email.com",         // RFC reserved-style placeholder
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.test",
  "domain.com",
  "yourdomain.com",
  "your-email.com",
  "your-domain.com",
  "mail.com",          // generic, frequently used as junk
  "asd.com",
  "aaa.com",
  "abc.com",
  "xyz.com",
  "qwe.com",
  "sample.com",
  "fake.com",
  "noemail.com",
  "no-email.com",
  "none.com",
  "null.com",
  "n/a.com",
]);

// Common disposable / temporary mail providers.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "throwawaymail.com",
  "getnada.com",
  "getairmail.com",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "fakeinbox.com",
  "tempinbox.com",
  "spamgourmet.com",
  "mohmal.com",
  "emailondeck.com",
  "mailcatch.com",
  "anonbox.net",
  "easytrashmail.com",
  "instaaddr.com",
  "mailtemp.info",
  "mailpoof.com",
]);

// Local-part patterns that obviously look like placeholders.
const PLACEHOLDER_LOCAL_RE = /^(you|user|name|your|test|tester|example|sample|fake|asd+|qwe+|aaa+|aaaa|admin|abc+|xyz+|email|noreply|none|null|na)$/i;

export type EmailValidationResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function validateEmail(raw: string): EmailValidationResult {
  const cleaned = String(raw || "").trim().toLowerCase();
  if (!cleaned) return { ok: false, error: "البريد الإلكتروني مطلوب" };

  if (!FORMAT_RE.test(cleaned)) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صحيحة" };
  }

  const at = cleaned.lastIndexOf("@");
  const local = cleaned.slice(0, at);
  const domain = cleaned.slice(at + 1);

  if (local.length < 1 || local.length > 64) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صحيحة" };
  }
  if (domain.length < 4 || domain.length > 255) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صحيحة" };
  }

  // Block bare TLDs ending with a dot, etc.
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { ok: false, error: "نطاق البريد غير صحيح" };
  }

  if (PLACEHOLDER_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "هذا البريد لا يبدو حقيقياً. الرجاء استخدام بريدك الفعلي حتى نتمكن من التواصل معك.",
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "البريد المؤقت غير مقبول. الرجاء استخدام بريد إلكتروني دائم.",
    };
  }

  if (PLACEHOLDER_LOCAL_RE.test(local)) {
    return {
      ok: false,
      error: "هذا البريد يبدو بريد تجريبي. الرجاء استخدام بريدك الحقيقي.",
    };
  }

  // Block "name@anything.invalid" / .test / .example / .localhost / .local TLDs (RFC 2606)
  const tld = domain.split(".").pop() || "";
  if (["invalid", "test", "example", "localhost", "local"].includes(tld)) {
    return { ok: false, error: "نطاق البريد غير صالح" };
  }

  return { ok: true, email: cleaned };
}
