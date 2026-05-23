// ─── Queue — يُدخل الوظائف المناسبة قائمة انتظار ويُرسلها واحدة وحدة ────────────

export interface QueueItem {
  userId:       string;
  userName:     string;
  userPhone:    string;
  userEmail:    string;         // SMTP email
  smtpHost:     string;
  smtpPort:     number;
  smtpSecure:   boolean;
  appPassword:  string;
  jobId:        string;
  jobTitle:     string;
  company:      string;
  toEmail:      string;         // application_email
  jobDesc:      string;
  savedBody:    string;         // cover_letter_body (if any)
  cvBytes:      Uint8Array | null;
  cvName:       string;
  cvProfile:    Record<string, unknown> | null;
  score:        number;
  matchedTerms: string[];
  fingerprint:  string;
  lang:         string;
}

export type ApplyResult = "sent" | "error" | "skipped";

export interface QueueResult {
  sent:    number;
  errors:  number;
  details: Array<{ item: QueueItem; result: ApplyResult; reason?: string }>;
}

export async function processQueue(
  items: QueueItem[],
  processor: (item: QueueItem) => Promise<{ result: ApplyResult; reason?: string }>,
  delaySec = 4,
): Promise<QueueResult> {
  let sent = 0;
  let errors = 0;
  const details: QueueResult["details"] = [];

  for (const item of items) {
    try {
      const { result, reason } = await processor(item);
      if (result === "sent")  sent++;
      if (result === "error") errors++;
      details.push({ item, result, reason });
    } catch (e) {
      errors++;
      details.push({ item, result: "error", reason: String(e).slice(0, 300) });
    }

    // تأخير بين التقديمات لتجنّب حظر SMTP
    if (delaySec > 0) {
      await new Promise(r => setTimeout(r, delaySec * 1000));
    }
  }

  return { sent, errors, details };
}
