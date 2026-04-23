const BASE_URL =
  process.env.TAMARA_SANDBOX === "true"
    ? "https://api-sandbox.tamara.co"
    : "https://api.tamara.co";

const API_TOKEN = process.env.TAMARA_API_TOKEN || "";

async function tamaraFetch(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(`Tamara ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/* ─── Phone normalizer → +966xxxxxxxxx ─── */
function normalizePhone(raw: string): string {
  const clean = raw.replace(/\D/g, "");
  if (clean.startsWith("966")) return `+${clean}`;
  if (clean.startsWith("0")) return `+966${clean.slice(1)}`;
  return `+966${clean}`;
}

/* ─── Create checkout session ─── */
export interface TamaraCheckoutInput {
  orderId: string;
  orderReference?: string;
  amount: number;
  name: string;
  email: string;
  phone: string;
  productName: string;
  productDescription: string;
  successUrl: string;
  failureUrl: string;
  cancelUrl: string;
  notificationUrl: string;
}

export async function createCheckoutSession(p: TamaraCheckoutInput) {
  const parts = p.name.trim().split(" ");
  const firstName = parts[0] || p.name;
  const lastName = parts.slice(1).join(" ") || "—";
  const amountStr = Number(p.amount).toFixed(2);
  const reference = p.orderReference || p.orderId;

  return tamaraFetch("POST", "/checkout", {
    order_reference_id: reference,
    order_number: reference,
    total_amount: { amount: amountStr, currency: "SAR" },
    description: p.productDescription,
    country_code: "SA",
    payment_type: "PAY_BY_LATER",
    instalments: null,
    locale: "ar_SA",
    items: [
      {
        reference_id: reference,
        type: "Digital",
        name: p.productName,
        sku: reference,
        quantity: 1,
        unit_price: { amount: amountStr, currency: "SAR" },
        discount_amount: { amount: "0.00", currency: "SAR" },
        total_amount: { amount: amountStr, currency: "SAR" },
      },
    ],
    consumer: {
      first_name: firstName,
      last_name: lastName,
      phone_number: normalizePhone(p.phone),
      email: p.email,
    },
    billing_address: {
      first_name: firstName,
      last_name: lastName,
      line1: "Riyadh",
      city: "Riyadh",
      country_code: "SA",
    },
    shipping_address: {
      first_name: firstName,
      last_name: lastName,
      line1: "Riyadh",
      city: "Riyadh",
      country_code: "SA",
    },
    tax_amount: { amount: "0.00", currency: "SAR" },
    shipping_amount: { amount: "0.00", currency: "SAR" },
    discount: { amount: "0.00", currency: "SAR", name: "No Discount" },
    merchant_url: {
      success: p.successUrl,
      failure: p.failureUrl,
      cancel: p.cancelUrl,
      notification: p.notificationUrl,
    },
    platform: "Custom",
    is_mobile: false,
  });
}

/* ─── Get order status ─── */
export async function getTamaraOrder(tamaraOrderId: string) {
  return tamaraFetch("GET", `/orders/${tamaraOrderId}`);
}

/* ─── Capture payment ─── */
export async function captureOrder(tamaraOrderId: string, amount: number) {
  const amountStr = Number(amount).toFixed(2);
  return tamaraFetch("POST", `/orders/${tamaraOrderId}/payments/capture`, {
    total_amount: { amount: amountStr, currency: "SAR" },
    shipping_amount: { amount: "0.00", currency: "SAR" },
    tax_amount: { amount: "0.00", currency: "SAR" },
    discount_amount: { amount: "0.00", currency: "SAR" },
    items: [],
  });
}

/* ─── Cancel order ─── */
export async function cancelTamaraOrder(tamaraOrderId: string) {
  return tamaraFetch("POST", `/orders/${tamaraOrderId}/payments/cancel`, {
    cancel_reason: "Customer cancelled",
  });
}

/* ─── Refund a captured order ─── */
export async function refundTamaraOrder(tamaraOrderId: string, amount: number, comment?: string) {
  const amountStr = Number(amount).toFixed(2);
  return tamaraFetch("POST", `/orders/${tamaraOrderId}/refunds`, {
    refunds: [
      {
        order_item_reference_id: tamaraOrderId,
        total_amount: { amount: amountStr, currency: "SAR" },
        comment: comment || "استرجاع بناءً على طلب العميل",
      },
    ],
  });
}

/* ─── Verify webhook signature ─── */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.TAMARA_NOTIFICATION_TOKEN || "";
  if (!secret) return true; // skip if not configured
  try {
    const crypto = require("crypto");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    return expected === signature;
  } catch {
    return false;
  }
}
