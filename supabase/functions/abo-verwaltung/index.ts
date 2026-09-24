/* ---- ABO-VERWALTUNG ----------------------------------------------------------
   24.09.2026, Go-Live (AGB Sept. 2026 §§ 4, 5, 7):

   modus "kuendigen"  – Kündigungsfunktion (§ 7, § 312k BGB). Angemeldet: Abo des
                        Kontos. Nicht angemeldet: Name + E-Mail, Abo über die E-Mail.
                        Beendigung:
                          · Testphase           -> Ende der Testphase (§ 5)
                          · erste Laufzeit      -> Ende der ersten Laufzeit
                          · danach              -> heute + 1 Monat (unbestimmte Zeit, 1 Monat Frist)
                        Sofortige Bestätigung per E-Mail (Inhalt + Beendigungszeitpunkt),
                        Kopie an kontakt@.
   modus "vertrag"    – Vertragsbestätigung (§ 4) inkl. AGB + Widerrufsbelehrung.
                        Nur mit Service-Schlüssel (stripe-webhook, subscription.created).
   modus "ende"       – Abo beendet (stripe-webhook, subscription.deleted): endet der
                        Vertrag in einem bezahlten Zeitraum, wird der Rest tagegenau
                        erstattet (§ 7) und per E-Mail mitgeteilt.

   Alle Vorgänge stehen in public."Abo_Post". Mails wie widerruf-bestaetigen. */
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/* ---- Mail (wie widerruf-bestaetigen) ------------------------------------- */
function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/(.{76})/g, "$1\r\n");
}
function kopf(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return "=?UTF-8?B?" + btoa(Array.from(new TextEncoder().encode(s)).map((b) => String.fromCharCode(b)).join("")) + "?=";
}
function adresseSauber(s: string | null | undefined): string | null {
  const t = String(s || "").trim();
  return /^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(t) ? t : null;
}
function mimeBauen(von: string, an: string, antwortAn: string | null, betreff: string, text: string, absName: string): string {
  const id = "ri" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let out = "Date: " + new Date().toUTCString() + "\r\n"
    + "From: " + kopf(absName) + " <" + von + ">\r\n"
    + "To: " + an + "\r\n";
  if (antwortAn) out += "Reply-To: " + antwortAn + "\r\n";
  out += "Subject: " + kopf(betreff) + "\r\n"
    + "Message-ID: <" + id + "@root-index.de>\r\n"
    + "MIME-Version: 1.0\r\n"
    + "Content-Type: text/plain; charset=utf-8\r\n"
    + "Content-Transfer-Encoding: base64\r\n\r\n"
    + b64(new TextEncoder().encode(text)) + "\r\n";
  return out;
}
class Smtp {
  conn: Deno.TlsConn; buf = "";
  constructor(conn: Deno.TlsConn) { this.conn = conn; }
  async lesen(): Promise<string> {
    while (true) {
      const m = this.buf.match(/(^|\r\n)(\d{3}) [^\r\n]*\r\n$/);
      if (m) { const s = this.buf; this.buf = ""; return s; }
      const chunk = new Uint8Array(8192);
      const n = await this.conn.read(chunk);
      if (n === null) { const s = this.buf; this.buf = ""; return s; }
      for (let i = 0; i < n; i++) this.buf += String.fromCharCode(chunk[i]);
    }
  }
  async schreiben(s: string) { await this.conn.write(new TextEncoder().encode(s)); }
  async befehl(s: string, erwartet: RegExp): Promise<string> {
    await this.schreiben(s + "\r\n");
    const a = await this.lesen();
    if (!erwartet.test(a)) throw new Error("SMTP: " + s.split(" ")[0] + " -> " + a.trim());
    return a;
  }
  schliessen() { try { this.conn.close(); } catch { /* egal */ } }
}
async function senden(an: string, betreff: string, text: string, antwortAn: string | null, absName = "Root Index") {
  const von = Deno.env.get("MAIL_ADDRESS")!;
  const pass = Deno.env.get("MAIL_PASSWORD")!;
  if (!von || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen");
  const roh = mimeBauen(von, an, antwortAn ?? von, betreff, text, absName);
  const s = new Smtp(await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT }));
  try {
    const gruss = await s.lesen();
    if (!/^220/.test(gruss)) throw new Error("SMTP-Begruessung: " + gruss.trim());
    await s.befehl("EHLO root-index.de", /250/);
    await s.befehl("AUTH LOGIN", /334/);
    await s.befehl(btoa(von), /334/);
    await s.befehl(btoa(pass), /235/);
    await s.befehl("MAIL FROM:<" + von + ">", /250/);
    await s.befehl("RCPT TO:<" + an + ">", /25\d/);
    await s.befehl("DATA", /354/);
    await s.schreiben(roh.replace(/\r\n\./g, "\r\n..") + "\r\n.\r\n");
    const ok = await s.lesen();
    if (!/^250/.test(ok)) throw new Error("SMTP-Annahme: " + ok.trim());
    try { await s.befehl("QUIT", /221/); } catch { /* egal */ }
  } finally { s.schliessen(); }
}
const KONTAKT = () => Deno.env.get("MAIL_ADDRESS")!;
const FUSS = [
  "",
  "Viele Grüße",
  "Ralph Denk – Root Index",
  "Auweg 23, 84103 Postau · kontakt@root-index.de · root-index.de",
];

/* ---- Hilfen ---------------------------------------------------------------- */
function datum(ts: number | string | Date): string {
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}
function zeit(ts: string | Date): string {
  return new Date(ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " Uhr";
}
function euro(cent: number): string { return (cent / 100).toFixed(2).replace(".", ",") + " €"; }
function plusMonate(sek: number, m: number): number {
  const d = new Date(sek * 1000);
  const tag = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + m);
  if (d.getUTCDate() < tag) d.setUTCDate(0); // 31.01. + 1 Monat -> 28./29.02.
  return Math.floor(d.getTime() / 1000);
}
function tarifInfo(sub: Stripe.Subscription) {
  const p = sub.items.data[0]?.price;
  const iv = p?.recurring?.interval || "month";
  const n = p?.recurring?.interval_count || 1;
  const monate = iv === "year" ? 12 * n : n;
  const name = monate === 12 ? "Jährlich" : monate === 3 ? "Vierteljährlich" : monate === 1 ? "Monatlich" : monate + " Monate";
  return { monate, name, preis: p?.unit_amount || 0 };
}
function ersteLaufzeitEnde(sub: Stripe.Subscription): number {
  const start = sub.trial_end || sub.start_date;
  return plusMonate(start, tarifInfo(sub).monate);
}
function mdZuText(md: string): string {
  return String(md || "")
    .replace(/\r/g, "")
    .replace(/^##\s*/gm, "\n")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
async function aktivesAbo(customer: string): Promise<Stripe.Subscription | null> {
  const l = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
  return l.data.find((s) => ["trialing", "active", "past_due", "unpaid"].includes(s.status)) || null;
}
async function kundeZuMail(admin: ReturnType<typeof adminClient>, email: string): Promise<{ customer: string | null; authId: string | null }> {
  const { data: b } = await admin.from("Benutzer").select("stripe_customer_id, auth_id").ilike("Email", email).limit(1).maybeSingle();
  if (b?.stripe_customer_id) return { customer: b.stripe_customer_id as string, authId: (b.auth_id as string) || null };
  const l = await stripe.customers.list({ email, limit: 5 });
  for (const c of l.data) { if (await aktivesAbo(c.id)) return { customer: c.id, authId: (c.metadata?.auth_id as string) || null }; }
  return { customer: l.data[0]?.id || null, authId: null };
}

/* ---- modus: kuendigen ------------------------------------------------------ */
async function kuendigen(req: Request, body: any) {
  const admin = adminClient();
  const authHeader = req.headers.get("Authorization") || "";
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supa.auth.getUser().catch(() => ({ data: { user: null } } as any));

  const name = String(body.name || "").trim().slice(0, 200);
  const art = body.art === "ausserordentlich" ? "ausserordentlich" : "ordentlich";
  const grund = String(body.grund || "").trim().slice(0, 2000);
  let email = adresseSauber(body.email) || "";
  let customer: string | null = null;
  let authId: string | null = null;
  let kontoMail: string | null = null;

  if (user) {
    authId = user.id;
    const { data: b } = await admin.from("Benutzer").select("stripe_customer_id, Email").eq("auth_id", user.id).maybeSingle();
    customer = (b?.stripe_customer_id as string) || null;
    kontoMail = adresseSauber((b?.Email as string) || user.email) ;
    if (!email) email = kontoMail || "";
  }
  if (!name) return json({ error: "Bitte gib deinen Namen an." }, 400);
  if (!email) return json({ error: "Bitte gib deine E-Mail-Adresse an." }, 400);
  if (art === "ausserordentlich" && !grund) return json({ error: "Bitte gib für eine außerordentliche Kündigung den Grund an." }, 400);

  const { count } = await admin.from("Abo_Post").select("id", { count: "exact", head: true })
    .eq("typ", "kuendigung").ilike("email", email).gte("erstellt", new Date(Date.now() - 86400000).toISOString());
  if ((count || 0) >= 5) return json({ error: "Zu viele Kündigungen heute. Bitte schreib an kontakt@root-index.de." }, 429);

  if (!customer) { const k = await kundeZuMail(admin, email); customer = k.customer; authId = authId || k.authId; }
  const sub = customer ? await aktivesAbo(customer) : null;
  if (customer && !kontoMail) {
    try { const c = await stripe.customers.retrieve(customer) as Stripe.Customer; kontoMail = adresseSauber(c.email); } catch { /* egal */ }
  }

  const eingang = new Date();
  let ende: number | null = null;
  let hinweis = "";
  if (sub) {
    const jetzt = Math.floor(eingang.getTime() / 1000);
    if (sub.cancel_at || sub.cancel_at_period_end) {
      ende = sub.cancel_at || sub.current_period_end;
      hinweis = "Dein Abonnement war bereits gekündigt.";
    } else if (art === "ausserordentlich") {
      // Außerordentliche Kündigung prüft Ralph; bis dahin ordentlich vormerken.
      ende = null;
      hinweis = "Deine außerordentliche Kündigung prüfen wir und melden uns innerhalb von 3 Werktagen.";
    } else if (sub.status === "trialing") {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true, metadata: { kuendigung_eingang: eingang.toISOString(), kuendigung_regel: "testphase" } });
      ende = sub.trial_end || sub.current_period_end;
      hinweis = "Die Kündigung wirkt zum Ende deiner kostenlosen Testphase. Es entstehen keine Kosten.";
    } else if (jetzt < ersteLaufzeitEnde(sub) - 60) {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true, metadata: { kuendigung_eingang: eingang.toISOString(), kuendigung_regel: "erste_laufzeit" } });
      ende = sub.current_period_end;
      hinweis = "Die Kündigung wirkt zum Ende deiner ersten Laufzeit.";
    } else {
      ende = plusMonate(jetzt, 1);
      await stripe.subscriptions.update(sub.id, { cancel_at: ende, proration_behavior: "none", metadata: { kuendigung_eingang: eingang.toISOString(), kuendigung_regel: "ein_monat" } });
      hinweis = "Die Kündigung wirkt mit einer Frist von einem Monat. Bereits bezahlte Beträge für die Zeit nach Vertragsende erstatten wir tagegenau innerhalb von 14 Tagen.";
    }
  } else {
    hinweis = "Wir haben zu dieser E-Mail-Adresse kein laufendes Premium-Abonnement gefunden. Wir prüfen deine Kündigung und melden uns innerhalb von 3 Werktagen.";
  }

  const { data: z, error } = await admin.from("Abo_Post").insert({
    typ: "kuendigung", auth_id: authId, name, email, stripe_customer: customer, stripe_sub: sub?.id || null,
    art, grund: grund || null, beendigung: ende ? new Date(ende * 1000).toISOString() : null,
    daten: { eingang: eingang.toISOString(), hinweis, angemeldet: !!user, status: sub?.status || null },
  }).select("id").single();
  if (error) throw new Error(error.message);
  const nr = "K-" + z.id;

  const inhalt = [
    "Inhalt deiner Kündigung:",
    "",
    "Hiermit kündige ich meinen Vertrag über Root Index Premium " + (art === "ausserordentlich" ? "außerordentlich aus wichtigem Grund." : "ordentlich zum nächstmöglichen Zeitpunkt."),
    ...(grund ? ["Grund: " + grund] : []),
    "",
    "Name:            " + name,
    "E-Mail:          " + email,
    "Eingang bei uns: " + zeit(eingang),
    "Vorgangsnummer:  " + nr,
    "",
    "Beendigung:      " + (ende ? datum(ende) : "wird von uns geprüft"),
  ];
  const text = ["Hallo " + name + ",", "", "wir haben deine Kündigung erhalten. Hiermit bestätigen wir den Eingang.", "", ...inhalt, "", hinweis,
    "", "Dein kostenloses Nutzerkonto bleibt bestehen, solange du es nicht gesondert löschst.", "", "Fragen? Antworte einfach auf diese E-Mail.", ...FUSS].join("\r\n");
  let fehler: string | null = null;
  try {
    const ziele = new Set<string>([email]);
    if (kontoMail && kontoMail.toLowerCase() !== email.toLowerCase()) ziele.add(kontoMail);
    for (const an of ziele) await senden(an, "Bestätigung deiner Kündigung (" + nr + ")", text, KONTAKT());
    await admin.from("Abo_Post").update({ bestaetigt_am: new Date().toISOString() }).eq("id", z.id);
    await senden(KONTAKT(), "KÜNDIGUNG " + nr + " · " + name + (sub ? "" : " · KEIN ABO GEFUNDEN") + (art === "ausserordentlich" ? " · AUSSERORDENTLICH" : ""),
      ["Kündigung über die Online-Funktion.", "", ...inhalt, "", hinweis, "", "Stripe-Kunde: " + (customer || "—"), "Stripe-Abo: " + (sub?.id || "—")].join("\r\n"), email, "Root Index Kündigung");
    await admin.from("Abo_Post").update({ kopie_am: new Date().toISOString() }).eq("id", z.id);
  } catch (e) {
    fehler = String(e).slice(0, 500);
    await admin.from("Abo_Post").update({ fehler }).eq("id", z.id);
  }
  return json({ ok: true, nr, eingang: eingang.toISOString(), beendigung: ende ? new Date(ende * 1000).toISOString() : null, hinweis, mail: !fehler });
}

/* ---- modus: vertrag -------------------------------------------------------- */
async function vertrag(body: any) {
  const admin = adminClient();
  const sub = await stripe.subscriptions.retrieve(String(body.sub));
  const { data: da } = await admin.from("Abo_Post").select("id").eq("typ", "vertrag").eq("stripe_sub", sub.id).limit(1);
  if (da && da.length) return json({ ok: true, schon: true });
  const kunde = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
  const { data: b } = await admin.from("Benutzer").select("Email, auth_id").eq("stripe_customer_id", sub.customer as string).maybeSingle();
  const email = adresseSauber((b?.Email as string) || kunde.email);
  const t = tarifInfo(sub);
  const ersteZahlung = sub.trial_end || sub.start_date;
  const { data: rt } = await admin.from("Rechtstext").select("schluessel, inhalt, stand").in("schluessel", ["agb", "widerruf"]);
  const agb = rt?.find((r: any) => r.schluessel === "agb");
  const wdr = rt?.find((r: any) => r.schluessel === "widerruf");

  const { data: z, error } = await admin.from("Abo_Post").insert({
    typ: "vertrag", auth_id: (b?.auth_id as string) || null, email, stripe_customer: sub.customer as string, stripe_sub: sub.id,
    daten: { tarif: t.name, preis: t.preis, testphase_bis: sub.trial_end, erste_zahlung: ersteZahlung, erste_laufzeit_bis: ersteLaufzeitEnde(sub), agb_stand: agb?.stand, widerruf_stand: wdr?.stand },
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (!email) { await admin.from("Abo_Post").update({ fehler: "keine E-Mail-Adresse" }).eq("id", z.id); return json({ error: "keine E-Mail" }, 400); }

  const text = [
    "Hallo,",
    "",
    "vielen Dank für deine Bestellung. Hiermit bestätigen wir deinen Vertrag über Root Index Premium.",
    "",
    "Vertragspartner:   Ralph Denk – Root Index, Auweg 23, 84103 Postau, kontakt@root-index.de",
    "Vertragsschluss:   " + datum(sub.start_date),
    "Tarif:             " + t.name + " – " + euro(t.preis) + " je Abrechnungszeitraum (Endpreis; gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen)",
    sub.trial_end
      ? "Testphase:         kostenlos bis " + datum(sub.trial_end) + ". Kündigst du bis dahin, entstehen keine Kosten."
      : "Testphase:         keine (die kostenlose Testphase gilt nur für das erste Abonnement)",
    "Erste Abrechnung:  " + datum(ersteZahlung) + " über " + euro(t.preis),
    "Erste Laufzeit:    bis " + datum(ersteLaufzeitEnde(sub)),
    "",
    "Danach läuft das Abonnement auf unbestimmte Zeit weiter und ist jederzeit mit einer Frist von einem Monat kündbar; zu viel gezahlte Beträge erstatten wir tagegenau (AGB § 7).",
    "Kündigen:  root-index.de/?kuendigen oder per E-Mail an kontakt@root-index.de",
    "Widerruf:  14 Tage ab Vertragsschluss – root-index.de/?widerruf oder per E-Mail",
    "",
    "Du hast ausdrücklich verlangt, dass Root Index Premium bereits vor Ablauf der vierzehntägigen Widerrufsfrist freigeschaltet wird. Dir ist bekannt, dass du bei einem Widerruf unter den in der Widerrufsbelehrung beschriebenen gesetzlichen Voraussetzungen anteiligen Wertersatz leisten musst. Die siebentägige Testphase bleibt kostenlos.",
    "",
    "Vertragsnummer: V-" + z.id + " (Stripe " + sub.id + ")",
    ...FUSS,
    "",
    "",
    "════════════════════════════════════════",
    "ANLAGE 1 – ALLGEMEINE GESCHÄFTSBEDINGUNGEN",
    "════════════════════════════════════════",
    "",
    mdZuText(agb?.inhalt || "siehe root-index.de/?agb"),
    "",
    "",
    "════════════════════════════════════════",
    "ANLAGE 2 – WIDERRUFSBELEHRUNG UND MUSTER-WIDERRUFSFORMULAR",
    "════════════════════════════════════════",
    "",
    mdZuText(wdr?.inhalt || "siehe root-index.de/?widerrufsbelehrung"),
  ].join("\r\n");
  try {
    await senden(email, "Deine Vertragsbestätigung – Root Index Premium (V-" + z.id + ")", text, KONTAKT());
    await admin.from("Abo_Post").update({ bestaetigt_am: new Date().toISOString() }).eq("id", z.id);
    await senden(KONTAKT(), "NEUES ABO V-" + z.id + " · " + t.name + " · " + email, "Neues Premium-Abo.\r\n\r\n" + text.split("════")[0], email, "Root Index Abo");
    await admin.from("Abo_Post").update({ kopie_am: new Date().toISOString() }).eq("id", z.id);
  } catch (e) {
    await admin.from("Abo_Post").update({ fehler: String(e).slice(0, 500) }).eq("id", z.id);
    throw e;
  }
  return json({ ok: true, nr: "V-" + z.id });
}

/* ---- modus: ende (tagegenaue Erstattung) ----------------------------------- */
async function ende(body: any) {
  const admin = adminClient();
  const sub = await stripe.subscriptions.retrieve(String(body.sub));
  const { data: da } = await admin.from("Abo_Post").select("id").eq("typ", "erstattung").eq("stripe_sub", sub.id).limit(1);
  if (da && da.length) return json({ ok: true, schon: true });
  const beendet = sub.ended_at || sub.canceled_at || Math.floor(Date.now() / 1000);
  const inv = (await stripe.invoices.list({ subscription: sub.id, status: "paid", limit: 1 })).data[0];
  if (!inv || !inv.amount_paid) return json({ ok: true, erstattung: 0, grund: "keine bezahlte Rechnung" });
  const zeile = inv.lines.data.find((l) => l.type === "subscription") || inv.lines.data[0];
  const von = zeile?.period?.start || inv.period_start;
  const bis = zeile?.period?.end || inv.period_end;
  const restTage = Math.floor((bis - beendet) / 86400);
  const alleTage = Math.max(1, Math.round((bis - von) / 86400));
  if (restTage < 1) return json({ ok: true, erstattung: 0, grund: "kein Rest" });
  const betrag = Math.floor(inv.amount_paid * restTage / alleTage);
  if (betrag < 1) return json({ ok: true, erstattung: 0 });

  const kunde = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
  const email = adresseSauber(kunde.email);
  const { data: z, error } = await admin.from("Abo_Post").insert({
    typ: "erstattung", email, stripe_customer: sub.customer as string, stripe_sub: sub.id, beendigung: new Date(beendet * 1000).toISOString(),
    daten: { rechnung: inv.id, bezahlt: inv.amount_paid, zeitraum_von: von, zeitraum_bis: bis, rest_tage: restTage, alle_tage: alleTage, betrag },
  }).select("id").single();
  if (error) throw new Error(error.message);
  try {
    const ziel: any = inv.payment_intent ? { payment_intent: inv.payment_intent as string } : { charge: inv.charge as string };
    const r = await stripe.refunds.create({ ...ziel, amount: betrag, reason: "requested_by_customer", metadata: { grund: "AGB § 7 tagegenaue Erstattung", abo: sub.id } }, { idempotencyKey: "erstattung-" + sub.id });
    await admin.from("Abo_Post").update({ daten: { rechnung: inv.id, bezahlt: inv.amount_paid, rest_tage: restTage, alle_tage: alleTage, betrag, refund: r.id } }).eq("id", z.id);
    if (email) {
      await senden(email, "Erstattung nach Vertragsende – Root Index Premium (E-" + z.id + ")", [
        "Hallo,", "",
        "dein Vertrag über Root Index Premium endete am " + datum(beendet) + ".",
        "Für die bereits bezahlte Zeit danach (" + restTage + " von " + alleTage + " Tagen) erstatten wir dir " + euro(betrag) + " auf dein ursprüngliches Zahlungsmittel.",
        "Je nach Bank kann die Gutschrift einige Tage dauern.", ...FUSS].join("\r\n"), KONTAKT());
      await admin.from("Abo_Post").update({ bestaetigt_am: new Date().toISOString() }).eq("id", z.id);
    }
    await senden(KONTAKT(), "ERSTATTUNG E-" + z.id + " · " + euro(betrag) + " · " + (email || sub.customer), "Automatische Erstattung nach AGB § 7.\r\nAbo " + sub.id + ", Rechnung " + inv.id + ", Refund " + r.id, email, "Root Index Abo");
    await admin.from("Abo_Post").update({ kopie_am: new Date().toISOString() }).eq("id", z.id);
    return json({ ok: true, erstattung: betrag });
  } catch (e) {
    await admin.from("Abo_Post").update({ fehler: String(e).slice(0, 500) }).eq("id", z.id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const modus = String(body.modus || "");
    if (modus === "kuendigen") return await kuendigen(req, body);
    const dienst = (req.headers.get("Authorization") || "") === "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!dienst) return json({ error: "nicht erlaubt" }, 403);
    if (modus === "vertrag") return await vertrag(body);
    if (modus === "ende") return await ende(body);
    return json({ error: "unbekannter modus" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
