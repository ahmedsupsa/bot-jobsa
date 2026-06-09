import nodemailer from "npm:nodemailer@6";

Deno.serve(async () => {
  try {
    const account = await nodemailer.createTestAccount();
    return new Response(JSON.stringify({ ok: true, user: account.user }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})
