/* ---- NEWSLETTER-VERSAND ---------------------------------------------------
   30.09.2026, Ralph: Newsletter Wochen im Voraus vorbereiten, Versand erst
   nach seiner Freigabe (Cockpit-Kachel "Newsletter").

   Nur mit Service-Schluessel aufrufbar (cron -> cb_newsletter_takt ->
   cb_edge_rufen, oder pg_net aus cb_newsletter_anmelden). Nimmt ausser
   "modus" keine Eingabe an – alles steht in den Tabellen:
     newsletter_abonnent  (Double-Opt-In: offen -> bestaetigt -> abgemeldet)
     newsletter_ausgabe   (entwurf -> freigegeben -> laeuft -> versendet | gestoppt)
     newsletter_versand   (je Ausgabe x Abonnent genau eine Zeile = kein Doppelversand)

   modus:
     doi   – Bestaetigungsmails an neue Anmeldungen
     test  – Testmail angeforderter Ausgaben an das eigene Postfach
     takt  – alles: doi + test + faellige FREIGEGEBENE Ausgaben (Stapel)
   Ohne Status "freigegeben" verlaesst keine Ausgabe das Haus.
   SMTP wie mail-agent v4 (eine MIME-Ebene, direkt, INWX). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;
const SEITE = "https://root-index.de/";
const STAPEL = 40;            // Mails je Lauf
const ZEIT_MS = 200_000;      // Zeitbudget je Lauf

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/* ---- MIME ---------------------------------------------------------------- */
function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/(.{76})/g, "$1\r\n");
}
function kopf(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return "=?UTF-8?B?" + btoa(Array.from(new TextEncoder().encode(s)).map((b) => String.fromCharCode(b)).join("")) + "?=";
}
function mime(von: string, an: string, betreff: string, text: string, html: string, abmelden?: string): string {
  const g = "nl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const enc = new TextEncoder();
  let out = "Date: " + new Date().toUTCString() + "\r\n"
    + "From: Root Index <" + von + ">\r\n"
    + "To: " + an + "\r\n"
    + "Subject: " + kopf(betreff) + "\r\n"
    + "Message-ID: <" + g + "@root-index.de>\r\n"
    + "MIME-Version: 1.0\r\n";
  if (abmelden) {
    out += "List-Unsubscribe: <" + abmelden + ">, <mailto:" + von + "?subject=Newsletter%20abmelden>\r\n"
      + "List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n"
      + "Precedence: bulk\r\n";
  }
  out += 'Content-Type: multipart/alternative; boundary="' + g + '"\r\n\r\n'
    + "--" + g + "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    + b64(enc.encode(text)) + "\r\n\r\n"
    + "--" + g + "\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    + b64(enc.encode(html)) + "\r\n\r\n"
    + "--" + g + "--\r\n";
  return out;
}

/* ---- SMTP: eine Verbindung, mehrere Mails -------------------------------- */
class Smtp {
  conn!: Deno.TlsConn; buf = ""; von = "";
  async lesen(): Promise<string> {
    while (true) {
      if (/(^|\r\n)(\d{3}) [^\r\n]*\r\n$/.test(this.buf)) { const s = this.buf; this.buf = ""; return s; }
      const chunk = new Uint8Array(8192);
      const n = await this.conn.read(chunk);
      if (n === null) { const s = this.buf; this.buf = ""; return s; }
      for (let i = 0; i < n; i++) this.buf += String.fromCharCode(chunk[i]);
    }
  }
  async schreiben(s: string) { await this.conn.write(new TextEncoder().encode(s)); }
  async befehl(s: string, erw: RegExp): Promise<string> {
    await this.schreiben(s + "\r\n");
    const a = await this.lesen();
    if (!erw.test(a)) throw new Error("SMTP " + s.split(" ")[0] + " -> " + a.trim().slice(0, 200));
    return a;
  }
  async oeffnen(von: string, pass: string) {
    this.von = von;
    this.conn = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });
    const gruss = await this.lesen();
    if (!/^220/.test(gruss)) throw new Error("SMTP-Begruessung: " + gruss.trim());
    await this.befehl("EHLO root-index.de", /250/);
    await this.befehl("AUTH LOGIN", /334/);
    await this.befehl(btoa(von), /334/);
    await this.befehl(btoa(pass), /235/);
  }
  async mail(an: string, roh: string) {
    try {
      await this.befehl("MAIL FROM:<" + this.von + ">", /250/);
      await this.befehl("RCPT TO:<" + an + ">", /25\d/);
      await this.befehl("DATA", /354/);
      await this.schreiben(roh.replace(/\r\n\./g, "\r\n..") + "\r\n.\r\n");
      const ok = await this.lesen();
      if (!/^250/.test(ok)) throw new Error("SMTP-Annahme: " + ok.trim().slice(0, 200));
    } catch (e) {
      try { await this.befehl("RSET", /250/); } catch { /* egal */ }
      throw e;
    }
  }
  async schliessen() {
    try { await this.befehl("QUIT", /221/); } catch { /* egal */ }
    try { this.conn.close(); } catch { /* egal */ }
  }
}

/* ---- Bestaetigungsmail (Double-Opt-In) ----------------------------------- */
function doiMail(token: string) {
  const link = SEITE + "?nl=bestaetigen&t=" + token;
  const text = "Hallo,\n\nbitte bestätige deine Anmeldung zum Root-Index-Newsletter:\n\n" + link
    + "\n\nOhne Bestätigung bekommst du keine Mails von uns. Wenn du dich nicht angemeldet hast, ignoriere diese Mail einfach.\n\n"
    + "Root Index · Ralph Denk · Auweg 23 · 84103 Postau · kontakt@root-index.de";
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:560px">'
    + "<p>Hallo,</p><p>bitte bestätige deine Anmeldung zum Root-Index-Newsletter:</p>"
    + '<p><a href="' + link + '" style="display:inline-block;background:#2f6b4f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Anmeldung bestätigen</a></p>'
    + "<p style=\"color:#666;font-size:13px\">Ohne Bestätigung bekommst du keine Mails von uns. Wenn du dich nicht angemeldet hast, ignoriere diese Mail einfach.</p>"
    + '<p style="color:#999;font-size:12px">Root Index · Ralph Denk · Auweg 23 · 84103 Postau · kontakt@root-index.de</p></div>';
  return { betreff: "Bitte bestätige deine Newsletter-Anmeldung", text, html };
}
function einsetzen(s: string, abm: string) { return s.split("{{ABMELDEN}}").join(abm); }

Deno.serve(async (req) => {
  const dienst = (req.headers.get("Authorization") || "") === "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!dienst) return json({ error: "nur Dienst" }, 403);
  const start = Date.now();
  const body = await req.json().catch(() => ({}));
  const modus = String(body.modus || "takt");
  const db = admin();
  const von = Deno.env.get("MAIL_ADDRESS")!, pass = Deno.env.get("MAIL_PASSWORD")!;
  if (!von || !pass) return json({ error: "MAIL_ADDRESS/MAIL_PASSWORD fehlen" }, 500);
  const erg: Record<string, unknown> = { modus };
  const smtp = new Smtp();
  let offen = false;
  const verbinden = async () => { if (!offen) { await smtp.oeffnen(von, pass); offen = true; } };

  try {
    /* 1) Double-Opt-In */
    if (modus === "doi" || modus === "takt") {
      const { data: neu } = await db.from("newsletter_abonnent").select("id,email,token,doi_anzahl")
        .eq("status", "offen").is("doi_gesendet_am", null).order("id").limit(20);
      let n = 0; const f: string[] = [];
      for (const a of neu || []) {
        const m = doiMail(a.token);
        try {
          await verbinden();
          await smtp.mail(a.email, mime(von, a.email, m.betreff, m.text, m.html));
          n++;
        } catch (e) { f.push(String(e).slice(0, 160)); }
        await db.from("newsletter_abonnent").update({ doi_gesendet_am: new Date().toISOString(), doi_anzahl: (a.doi_anzahl || 0) + 1 }).eq("id", a.id);
      }
      erg.doi = { gesendet: n, fehler: f };
    }

    /* 2) Testmails an das eigene Postfach */
    if (modus === "test" || modus === "takt") {
      const { data: tests } = await db.from("newsletter_ausgabe").select("id,betreff,inhalt_text,inhalt_html").eq("testmail_angefordert", true);
      const t: unknown[] = [];
      for (const a of tests || []) {
        const abm = SEITE + "?nl=abmelden&t=TEST";
        try {
          await verbinden();
          await smtp.mail(von, mime(von, von, "[TEST] " + a.betreff, einsetzen(a.inhalt_text, abm), einsetzen(a.inhalt_html, abm), abm));
          await db.from("newsletter_ausgabe").update({ testmail_angefordert: false, testmail_am: new Date().toISOString() }).eq("id", a.id);
          t.push(a.id);
        } catch (e) { t.push({ id: a.id, fehler: String(e).slice(0, 160) }); }
      }
      erg.test = t;
    }

    /* 2b) Willkommens-Mail (art='willkommen', nur wenn Ralph sie freigegeben hat):
          einmal an jeden Bestaetigten, der sie noch nicht hat. 30.09.2026 */
    if (modus === "takt") {
      const { data: w } = await db.from("newsletter_ausgabe").select("id,betreff,inhalt_text,inhalt_html")
        .eq("art", "willkommen").eq("status", "freigegeben").order("id").limit(1);
      const wa = w?.[0];
      if (wa) {
        const { data: neue } = await db.from("newsletter_abonnent").select("id,email,token")
          .eq("status", "bestaetigt").is("willkommen_am", null).order("id").limit(STAPEL);
        let n = 0; const f: string[] = [];
        for (const r of neue || []) {
          if (Date.now() - start > ZEIT_MS) break;
          const abm = SEITE + "?nl=abmelden&t=" + r.token;
          try {
            await verbinden();
            await smtp.mail(r.email, mime(von, r.email, wa.betreff, einsetzen(wa.inhalt_text, abm), einsetzen(wa.inhalt_html, abm), abm));
            n++;
          } catch (e) { f.push(String(e).slice(0, 160)); }
          await db.from("newsletter_abonnent").update({ willkommen_am: new Date().toISOString() }).eq("id", r.id);
        }
        erg.willkommen = { gesendet: n, fehler: f };
      }
    }

    /* 3) Faellige, FREIGEGEBENE Ausgabe versenden (ohne Willkommens-Mail) */
    if (modus === "takt") {
      const { data: aus } = await db.from("newsletter_ausgabe").select("*")
        .in("status", ["freigegeben", "laeuft"]).neq("art", "willkommen").lte("geplant_fuer", new Date().toISOString())
        .order("geplant_fuer").limit(1);
      const a = aus?.[0];
      if (a) {
        if (a.status === "freigegeben") {
          await db.from("newsletter_ausgabe").update({ status: "laeuft", versand_start: new Date().toISOString() }).eq("id", a.id).eq("status", "freigegeben");
        }
        const { data: schon } = await db.from("newsletter_versand").select("abonnent_id").eq("ausgabe_id", a.id);
        const ids = new Set((schon || []).map((x: { abonnent_id: number }) => x.abonnent_id));
        const { data: alle } = await db.from("newsletter_abonnent").select("id,email,token").eq("status", "bestaetigt").order("id");
        const rest = (alle || []).filter((x: { id: number }) => !ids.has(x.id));
        let n = 0, f = 0;
        for (const r of rest.slice(0, STAPEL)) {
          if (Date.now() - start > ZEIT_MS) break;
          /* Stopp aus dem Cockpit wirkt sofort */
          if (n % 10 === 0) {
            const { data: st } = await db.from("newsletter_ausgabe").select("status").eq("id", a.id).single();
            if (st?.status !== "laeuft") { erg.gestoppt = true; break; }
          }
          const abm = SEITE + "?nl=abmelden&t=" + r.token;
          let status = "gesendet", fehler: string | null = null;
          try {
            await verbinden();
            await smtp.mail(r.email, mime(von, r.email, a.betreff, einsetzen(a.inhalt_text, abm), einsetzen(a.inhalt_html, abm), abm));
            n++;
          } catch (e) { status = "fehler"; fehler = String(e).slice(0, 300); f++; }
          await db.from("newsletter_versand").insert({ ausgabe_id: a.id, abonnent_id: r.id, status, fehler });
        }
        const { count: g } = await db.from("newsletter_versand").select("*", { count: "exact", head: true }).eq("ausgabe_id", a.id).eq("status", "gesendet");
        const { count: fe } = await db.from("newsletter_versand").select("*", { count: "exact", head: true }).eq("ausgabe_id", a.id).eq("status", "fehler");
        const fertig = rest.length <= n + f && !erg.gestoppt;
        await db.from("newsletter_ausgabe").update({
          empfaenger: g || 0, fehler: fe || 0,
          ...(fertig ? { status: "versendet", versendet_am: new Date().toISOString() } : {}),
        }).eq("id", a.id).eq("status", "laeuft");
        erg.ausgabe = { id: a.id, gesendet: n, fehler: f, rest: Math.max(0, rest.length - n - f), fertig };
      }
    }
  } catch (e) {
    erg.fehler = String(e).slice(0, 300);
  } finally {
    if (offen) await smtp.schliessen();
  }
  return json({ ok: !erg.fehler, ...erg });
});
