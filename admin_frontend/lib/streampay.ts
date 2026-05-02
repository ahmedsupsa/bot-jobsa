const BASE = "https://stream-app-service.streampay.sa";

function getAuthHeader(): string {
  const key = process.env.STREAMPAY_API_KEY || "";
  const secret = process.env.STREAMPAY_API_SECRET || "";
  const encoded = Buffer.from(`${key}:${secret}`).toString("base64");
  return `Basic ${encoded}`;
}

async function sp(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`StreamPay returned non-JSON (${res.status}): ${await res.text().catch(() => "")}`);
  }

  if (!res.ok) {
    const msg = (json as any)?.message || (json as any)?.error || JSON.stringify(json);
    throw new Error(`StreamPay ${res.status}: ${msg}`);
  }
  return json;
}

export async function findOrCreateConsumer(name: string, email: string, phone?: string) {
  // StreamPay's list endpoint does NOT support ?external_id= filtering —
  // it only supports search_term. We search by email and then verify the match.
  try {
    const listRes = await sp("GET", `/api/v2/consumers?search_term=${encodeURIComponent(email)}&limit=50`);
    const items: Record<string, unknown>[] = listRes?.data ?? [];
    const match = items.find(
      (c) => c.email === email || c.external_id === email
    );
    if (match) return match;
  } catch {
    // If the search fails, fall through to creation
  }

  const body: Record<string, unknown> = {
    name,
    email,
    external_id: email,
    communication_methods: ["EMAIL"],
    preferred_language: "ar",
  };
  if (phone) body.phone_number = phone;

  try {
    return await sp("POST", "/api/v2/consumers", body);
  } catch (err: unknown) {
    // DUPLICATE_CONSUMER means the email/phone already exists — search again and return the existing record
    if (String(err).includes("DUPLICATE_CONSUMER")) {
      const retry = await sp("GET", `/api/v2/consumers?search_term=${encodeURIComponent(email)}&limit=50`);
      const items: Record<string, unknown>[] = retry?.data ?? [];
      const match = items.find(
        (c) => c.email === email || c.external_id === email
      );
      if (match) return match;
      if (items.length > 0) return items[0];
    }
    throw err;
  }
}

export async function createPaymentLink(opts: {
  name: string;
  description?: string;
  product_id: string;
  consumer_id: string;
  success_url: string;
  failure_url: string;
  metadata?: Record<string, string>;
}) {
  const res: any = await sp("POST", "/api/v2/payment_links", {
    name: opts.name,
    description: opts.description || opts.name,
    items: [{ product_id: opts.product_id, quantity: 1 }],
    contact_information_type: "EMAIL",
    currency: "SAR",
    max_number_of_payments: 1,
    organization_consumer_id: opts.consumer_id,
    success_redirect_url: opts.success_url,
    failure_redirect_url: opts.failure_url,
    custom_metadata: opts.metadata || {},
  });

  // Normalise URL from any known response shape
  const raw = res?.data ?? res;
  const url =
    raw?.url ||
    raw?.checkout_url ||
    raw?.payment_url ||
    raw?.short_url ||
    raw?.link ||
    null;
  const id = raw?.id || res?.id || null;

  return { ...res, _url: url, _id: id, url, id };
}

export async function createProduct(opts: {
  name: string;
  description?: string;
  price: number;
}) {
  return sp("POST", "/api/v2/products", {
    name: opts.name,
    description: opts.description?.slice(0, 500) || null,
    type: "ONE_OFF",
    prices: [
      {
        currency: "SAR",
        amount: opts.price,
        is_price_inclusive_of_vat: true,
      },
    ],
  });
}

export async function getPayment(payment_id: string) {
  return sp("GET", `/api/v2/payments/${payment_id}`);
}

export async function getInvoice(invoice_id: string) {
  return sp("GET", `/api/v2/invoices/${invoice_id}`);
}

export async function refundStreamPayPayment(payment_id: string, amount: number, reason?: string) {
  return sp("POST", `/api/v2/payments/${payment_id}/refunds`, {
    amount,
    currency: "SAR",
    reason: reason || "Customer requested refund",
  });
}
