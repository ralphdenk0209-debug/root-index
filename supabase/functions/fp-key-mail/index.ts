/* ---- FP-KEY-MAIL ----------------------------------------------------------
   11.11.2026, Ralph (jaja), FL-1: Eine Fachperson schickt den Einlöse-Link
   eines Klienten-Keys per E-Mail an ihren Klienten. Bewusst schmal:

   - Sendet NUR diese eine Art Mail. Empfaenger, Link und Text kommen aus
     cb_fp_key_mail_vorbereiten, aufgerufen MIT dem Login der Fachperson:
     dort wird geprueft (eigener, offener Key, gueltige Adresse) und gesperrt
     (je Key und je Fachperson hoechstens n Mails in 24 h) und protokolliert.
   - verify_jwt ist an: ohne Anmeldung kommt niemand hier hinein.
   - Keine Blindkopie an das Root-Index-Postfach: schon die Mail verraet,
     dass jemand in Ernaehrungstherapie ist. Protokoll: fp_key_mail_log.
   - Antworten gehen an die Fachperson (Reply-To).

   Zugangsdaten wie mail-agent: Supabase-Secrets MAIL_ADDRESS / MAIL_PASSWORD,
   SMTP smtp.webspace.bz:465. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/* gleiche Rechnung wie klientin.html */
function dauer(tage: number): string {
  const t = Number(tage) || 0, mon = Math.round(t / 30);
  if (t >= 300 && t <= 400) return "1 Jahr";
  if (t < 28) return t + (t === 1 ? " Tag" : " Tage");
  return mon + (mon === 1 ? " Monat" : " Monate");
}

type Vorbereitet = {
  ok: boolean; grund?: string; log_id: number; an: string; code: string; tage: number;
  link: string; fachperson: string; praxis?: string | null; antwort_an?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, grund: "Nur POST" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, grund: "Bitte anmelden." }, 401);

  let body: { code?: string; email?: string } = {};
  try { body = await req.json(); } catch { /* leer */ }

  const url = Deno.env.get("SUPABASE_URL")!;
  // 1) Pruefen + Sperre + Protokoll - mit dem Login der Fachperson
  const nutzer = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data, error } = await nutzer.rpc("cb_fp_key_mail_vorbereiten", { p_code: body.code ?? "", p_email: body.email ?? "" });
  if (error) return json({ ok: false, grund: error.message }, 403);
  const d = data as Vorbereitet;
  if (!d?.ok) return json({ ok: false, grund: d?.grund ?? "Nicht möglich." });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const user = Deno.env.get("MAIL_ADDRESS");
  const pass = Deno.env.get("MAIL_PASSWORD");
  if (!user || !pass) {
    await admin.from("fp_key_mail_log").update({ status: "fehler", fehler: "MAIL_ADDRESS/MAIL_PASSWORD fehlen" }).eq("id", d.log_id);
    return json({ ok: false, grund: "Mailversand ist gerade nicht eingerichtet." }, 500);
  }

  // 2) Text
  const wer = d.fachperson + (d.praxis ? ` (${d.praxis})` : "");
  const zeit = dauer(d.tage);
  const betreff = `${d.fachperson} schenkt dir ${zeit} Root Index Premium`;
  const text =
`Hallo,

${wer} begleitet dich bei deiner Ernährung und schenkt dir ${zeit} Root Index Premium.

Root Index liest die Rückseite von Lebensmitteln: Zutaten, Zusatzstoffe und Nährwerte – und zeigt dir, was wirklich drin ist. Im Ernährungstagebuch hältst du fest, was du isst.

So geht's: Öffne diesen Link im Browser (zum Beispiel Safari oder Chrome) und lege ein Konto an oder melde dich an:
${d.link}

Dein Code: ${d.code}

Die Laufzeit von ${zeit} beginnt, wenn du den Code einlöst. Kein Abo, keine Kosten, keine Zahlungsdaten. Danach kannst du die Root-Index-App auf dem iPhone oder root-index.de mit demselben Konto nutzen.

Ob ${d.fachperson} deine Einträge sehen darf, entscheidest du selbst: erst nach deiner Einwilligung, und du kannst sie jederzeit widerrufen.

Fragen? Antworte einfach auf diese Mail – sie geht an ${d.fachperson}.

Root Index · root-index.de · kontakt@root-index.de`;

  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#F3EEDC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2a22">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#133521;color:#F3EEDC;border-radius:16px;padding:22px 20px">
    <div style="font-weight:800;font-size:15px;opacity:.85">Root Index™</div>
    <div style="font-size:22px;font-weight:800;color:#fff;margin:8px 0 4px">${esc(zeit)} Premium – geschenkt</div>
    <div style="font-size:15px;opacity:.85">von ${esc(wer)}</div>
  </div>
  <div style="background:#fff;border:1px solid #dfe6df;border-radius:16px;padding:18px 20px;margin-top:14px;font-size:16px;line-height:1.55">
    <p style="margin:0 0 12px">Hallo,</p>
    <p style="margin:0 0 12px">${esc(wer)} begleitet dich bei deiner Ernährung und schenkt dir <b>${esc(zeit)} Root Index Premium</b>.</p>
    <p style="margin:0 0 12px">Root Index liest die Rückseite von Lebensmitteln: Zutaten, Zusatzstoffe und Nährwerte – und zeigt dir, was wirklich drin ist. Im Ernährungstagebuch hältst du fest, was du isst.</p>
    <p style="margin:18px 0;text-align:center"><a href="${esc(d.link)}" style="display:inline-block;background:#2e7d46;color:#fff;text-decoration:none;font-weight:800;border-radius:12px;padding:14px 22px">Geschenk einlösen</a></p>
    <p style="margin:0 0 12px;font-size:14px;color:#5d6b61">Bitte im Browser öffnen (z. B. Safari oder Chrome). Dein Code: <b style="letter-spacing:.06em;color:#133521">${esc(d.code)}</b></p>
    <p style="margin:0 0 12px">Die Laufzeit von ${esc(zeit)} beginnt, wenn du den Code einlöst. Kein Abo, keine Kosten, keine Zahlungsdaten. Danach nutzt du die Root-Index-App auf dem iPhone oder root-index.de mit demselben Konto.</p>
    <p style="margin:0 0 12px">Ob ${esc(d.fachperson)} deine Einträge sehen darf, entscheidest du selbst: erst nach deiner Einwilligung, und du kannst sie jederzeit widerrufen.</p>
    <p style="margin:0">Fragen? Antworte einfach auf diese Mail – sie geht an ${esc(d.fachperson)}.</p>
  </div>
  <p style="font-size:12px;color:#5d6b61;text-align:center;margin-top:16px">Root Index · <a href="https://root-index.de" style="color:#2e7d46">root-index.de</a> · kontakt@root-index.de</p>
</div></body></html>`;

  // 3) Senden
  try {
    const smtp = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: user, password: pass } } });
    const msg: Record<string, unknown> = { from: `Root Index <${user}>`, to: d.an, subject: betreff, content: text, html };
    if (d.antwort_an) msg.replyTo = d.antwort_an;
    await smtp.send(msg as any);
    await smtp.close();
  } catch (e) {
    await admin.from("fp_key_mail_log").update({ status: "fehler", fehler: String(e).slice(0, 500) }).eq("id", d.log_id);
    return json({ ok: false, grund: "Die Mail konnte nicht gesendet werden. Bitte später noch einmal oder den QR-Code nutzen." }, 502);
  }
  await admin.from("fp_key_mail_log").update({ status: "gesendet" }).eq("id", d.log_id);
  return json({ ok: true, an: d.an });
});
