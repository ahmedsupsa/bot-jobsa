// Saudi mobile phone validator that also blocks obvious "fake-looking" numbers
// (sequential digits, single-digit repeats, simple alternating patterns).

export type PhoneValidationResult =
  | { ok: true; phone: string }    // E.164 form: +9665XXXXXXXX
  | { ok: false; error: string };

// Extract just digits.
function digitsOnly(s: string): string {
  return String(s || "").replace(/[^\d]/g, "");
}

// Returns the 9-digit Saudi national mobile number (starts with 5),
// or null if the input cannot be parsed as one.
function toNationalSA(raw: string): string | null {
  let d = digitsOnly(raw);
  if (!d) return null;

  // Strip 00 international prefix → leave country code.
  if (d.startsWith("00")) d = d.slice(2);

  // +966 / 966 prefix → drop it.
  if (d.startsWith("966")) d = d.slice(3);

  // Local form 05XXXXXXXX → drop leading 0.
  if (d.length === 10 && d.startsWith("0")) d = d.slice(1);

  // Must now be 9 digits starting with 5 (Saudi mobile).
  if (d.length !== 9) return null;
  if (!d.startsWith("5")) return null;
  return d;
}

// Check if a digit string is strictly increasing or decreasing by 1.
function isSequential(d: string): boolean {
  if (d.length < 4) return false;
  let inc = true, dec = true;
  for (let i = 1; i < d.length; i++) {
    const diff = d.charCodeAt(i) - d.charCodeAt(i - 1);
    if (diff !== 1) inc = false;
    if (diff !== -1) dec = false;
  }
  return inc || dec;
}

// All same digit? e.g. "555555555"
function isAllSame(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

// Two-digit alternating pattern, e.g. "505050505", "121212121"
function isAlternating2(d: string): boolean {
  if (d.length < 6) return false;
  const a = d[0], b = d[1];
  if (a === b) return false;
  for (let i = 0; i < d.length; i++) {
    const expected = i % 2 === 0 ? a : b;
    if (d[i] !== expected) return false;
  }
  return true;
}

// Detect a long run of the same digit (>= 6 in a row), e.g. "500000001"
function hasLongRepeatRun(d: string): boolean {
  return /(\d)\1{5,}/.test(d);
}

// Long sequential substring (>= 6 digits in a row counting up or down)
function hasLongSequentialRun(d: string): boolean {
  let upRun = 1, downRun = 1, longest = 1;
  for (let i = 1; i < d.length; i++) {
    const diff = d.charCodeAt(i) - d.charCodeAt(i - 1);
    upRun = diff === 1 ? upRun + 1 : 1;
    downRun = diff === -1 ? downRun + 1 : 1;
    longest = Math.max(longest, upRun, downRun);
  }
  return longest >= 6;
}

export function validatePhoneSA(raw: string): PhoneValidationResult {
  if (!raw || !String(raw).trim()) {
    return { ok: false, error: "رقم الجوال مطلوب" };
  }

  const national = toNationalSA(raw);
  if (!national) {
    return {
      ok: false,
      error: "رقم الجوال غير صحيح. يجب أن يكون رقم سعودي يبدأ بـ 05 (مثال: 0512345678)",
    };
  }

  // Apply fake-pattern checks on the full national number (9 digits starting with 5).
  if (isAllSame(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }
  if (isSequential(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }
  if (isAlternating2(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }
  if (hasLongRepeatRun(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }
  if (hasLongSequentialRun(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }

  // Reject obviously fake test numbers explicitly.
  const blocked = new Set([
    "500000000", "511111111", "522222222", "533333333", "544444444",
    "555555555", "566666666", "577777777", "588888888", "599999999",
    "512345678", "523456789", "534567890", "555555550", "550000000",
    "501234567", "598765432", "587654321", "576543210", "555000000",
  ]);
  if (blocked.has(national)) {
    return { ok: false, error: "رقم الجوال يبدو غير حقيقي. الرجاء إدخال رقمك الفعلي." };
  }

  return { ok: true, phone: "+966" + national };
}
