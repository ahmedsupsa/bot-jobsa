const BASE = "https://stream-app-service.streampay.sa";

function getHeader(): string {
  const key = process.env.STREAMPAY_API_KEY || "";
  const secret = process.env.STREAMPAY_API_SECRET || "";
  const encoded = Buffer.from(`${key}:${secret}`).toString("base64");
  return encoded;
}

async function sp(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "x-api-key": getHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

export async function findOrCreateConsumer(name: string, email: string, phone?: string) {
  const listRes = await sp("GET", `/api/v2/consumers?external_id=${encodeURIComponent(email)}`);
  const existing = listRes?.data?.[0] || listRes?.[0] || null;
  if (existing) return existing;
  const body: Record<string, unknown> = {
    name,
    email,
    external_id: email,
    communication_methods: ["EMAIL"],
    preferred_language: "ar",
  };
  if (phone) body.phone_number = phone;
  const created = await sp("POST", "/api/v2/consumers", body);
  return created;
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
  return sp("POST", "/api/v2/payment_links", {
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
}

export async function getPayment(payment_id: string) {
  return sp("GET", `/api/v2/payments/${payment_id}`);
}

export async function getInvoice(invoice_id: string) {
  return sp("GET", `/api/v2/invoices/${invoice_id}`);
}
