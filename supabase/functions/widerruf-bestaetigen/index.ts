/* ---- WIDERRUF-BESTAETIGEN ------------------------------------------------
   24.09.2026, Go-Live (AGB § 8, Widerrufsbelehrung Sept. 2026): Wer ueber die
   elektronische Widerrufsfunktion widerruft, bekommt UNVERZUEGLICH eine
   Eingangsbestaetigung per E-Mail mit dem Inhalt der Erklaerung sowie Datum
   und Uhrzeit des Eingangs. Ralph bekommt eine Kopie an kontakt@root-index.de
   (Reply-To = Kunde).

   Ablauf wie kontakt-weiterleiten: AFTER-INSERT-Trigger auf Widerruf_Log ruft
   diese Funktion mit der id. Sie liest die Zeile selbst (Service-Schluessel)
   und sendet nur, solange bestaetigt_am leer ist - nie doppelt.
   Quelle ist diese Datei; ausgeliefert ueber .github/workflows/edge-funktionen.yml. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/* ---- MIME, eine Ebene (siehe mail-agent v4: verschachtelt zeigt der Leser nichts) */
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
  /* Nur eine schlichte Adresse - keine Zeilenumbrueche, sonst liesse sich ein
     zusaetzlicher Kopf einschmuggeln. */
  return /^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(t) ? t : null;
}
function mimeBauen(von: string, an: string, antwortAn: string | null, betreff: string, text: string, absName = "Root Index Kontakt"): string {
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

/* ---- SMTP (wortgleich der Weg aus mail-agent) ------------------------------ */
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
async function senden(von: string, pass: string, an: string, roh: string) {
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

function zeit(ts: string): string {
  return new Date(ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " Uhr";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);
  const admin = adminClient();
  let id = 0;
  try {
    const body = await req.json().catch(() => ({}));
    id = parseInt(String(body.id || "0"), 10);
    if (!id) return json({ error: "id fehlt" }, 400);
    const { data: z, error } = await admin.from("Widerruf_Log")
      .select("id,eingang,name,email,anschrift,bestellt_am,vertrag,erklaerung,bestaetigt_am,kopie_am")
      .eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!z) return json({ error: "Widerruf nicht gefunden" }, 404);

    const user = Deno.env.get("MAIL_ADDRESS")!;
    const pass = Deno.env.get("MAIL_PASSWORD")!;
    if (!user || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen (Supabase-Secrets).");
    const kunde = adresseSauber(z.email);
    if (!kunde) throw new Error("E-Mail-Adresse ungueltig");

    const inhalt = [
      "Inhalt deiner Widerrufserklärung:",
      "",
      String(z.erklaerung),
      "",
      "Vertrag:        " + (z.vertrag || "Root Index Premium"),
      "Bestellt am:    " + (z.bestellt_am || "—"),
      "Name:           " + z.name,
      "Anschrift:      " + (z.anschrift || "—"),
      "E-Mail:         " + z.email,
      "",
      "Eingang bei uns: " + zeit(z.eingang),
      "Vorgangsnummer:  W-" + z.id,
    ];

    if (!z.bestaetigt_am) {
      const text = [
        "Hallo " + z.name + ",",
        "",
        "wir haben deinen Widerruf erhalten. Hiermit bestätigen wir den Eingang.",
        "",
        ...inhalt,
        "",
        "Bereits gezahlte Beträge erstatten wir dir unverzüglich, spätestens binnen 14 Tagen ab Eingang, über dasselbe Zahlungsmittel. Näheres steht in unserer Widerrufsbelehrung.",
        "",
        "Fragen? Antworte einfach auf diese E-Mail.",
        "",
        "Viele Grüße",
        "Ralph Denk – Root Index",
        "Auweg 23, 84103 Postau · kontakt@root-index.de · root-index.de",
      ].join("\r\n");
      await senden(user, pass, kunde, mimeBauen(user, kunde, user, "Eingangsbestätigung deines Widerrufs (W-" + z.id + ")", text, "Root Index"));
      await admin.from("Widerruf_Log").update({ bestaetigt_am: new Date().toISOString(), fehler: null }).eq("id", id);
    }
    if (!z.kopie_am) {
      const text = ["Neuer Widerruf über die Online-Funktion – bitte Abo in Stripe beenden und erstatten.", "", ...inhalt].join("\r\n");
      await senden(user, pass, user, mimeBauen(user, user, kunde, "WIDERRUF W-" + z.id + " · " + z.name, text, "Root Index Widerruf"));
      await admin.from("Widerruf_Log").update({ kopie_am: new Date().toISOString() }).eq("id", id);
    }
    return json({ ok: true });
  } catch (e) {
    if (id) { try { await admin.from("Widerruf_Log").update({ fehler: String(e).slice(0, 500) }).eq("id", id); } catch { /* egal */ } }
    return json({ error: String(e) }, 500);
  }
});
