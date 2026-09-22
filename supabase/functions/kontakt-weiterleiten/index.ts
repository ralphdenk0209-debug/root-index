/* ---- KONTAKT-WEITERLEITEN -----------------------------------------------
   22.09.2026, Ralph: "pruef bitte auch, ob die nachricht an
   kontakt@root-index.de gesendet wird, diese haben wir ja jetzt eingerichtet".

   Gemessen: sie wurde es NIE. cb_kontakt_senden schrieb nur eine Zeile in
   Kontakt_Anfragen - kein Trigger, keine Mail. 27 Anfragen lagen still in der
   Tabelle. Das Postfach selbst (webspace.bz) und das Senden per SMTP gab es
   schon (mail-postfach, mail-agent), es war nur nicht angeschlossen.

   Ablauf: ein AFTER-INSERT-Trigger auf Kontakt_Anfragen ruft diese Funktion
   mit der id der neuen Zeile (dasselbe Muster wie trg_riki_scan_job_sofortstart).
   Die Funktion liest die Zeile selbst mit dem Service-Schluessel - sie glaubt
   also nichts, was ihr jemand schickt, ausser der id.

   Missbrauchsschutz: gesendet wird nur fuer eine Zeile, die es gibt und die
   noch NICHT weitergeleitet ist (weitergeleitet_am). Wer die Funktion
   aufruft, kann damit hoechstens eine Mail je echter Anfrage ausloesen - also
   nicht mehr, als das Kontaktformular ohnehin erlaubt.

   Antworten: Reply-To ist die Adresse des Absenders. Ralph drueckt im
   Postfach auf Antworten und schreibt direkt dem Kunden.

   Ausgerollt als Version 1 am 22.09.2026 (Supabase-MCP). Diese Datei ist die
   Quelle - bei Aenderungen hier aendern und neu ausrollen. */
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
function mimeBauen(von: string, an: string, antwortAn: string | null, betreff: string, text: string): string {
  const id = "ri" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let out = "Date: " + new Date().toUTCString() + "\r\n"
    + "From: Root Index Kontakt <" + von + ">\r\n"
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

const TYPNAME: Record<string, string> = { frage: "Frage", produkt: "Produktvorschlag", fehler: "Fehlermeldung" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);
  const admin = adminClient();
  let id = 0;
  try {
    const body = await req.json().catch(() => ({}));
    id = parseInt(String(body.id || "0"), 10);
    if (!id) return json({ error: "id fehlt" }, 400);

    const { data: z, error } = await admin.from("Kontakt_Anfragen")
      .select("id,typ,name,email,nachricht,produktname,marke,link,barcode,foto_url,created_at,weitergeleitet_am")
      .eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!z) return json({ error: "Anfrage nicht gefunden" }, 404);
    if (z.weitergeleitet_am) return json({ ok: true, schon: true });   // nie doppelt

    const user = Deno.env.get("MAIL_ADDRESS")!;
    const pass = Deno.env.get("MAIL_PASSWORD")!;
    if (!user || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen (Supabase-Secrets).");

    const typ = TYPNAME[String(z.typ || "")] || String(z.typ || "Anfrage");
    const wer = z.name || z.email || "ohne Namen";
    const antwortAn = adresseSauber(z.email);
    const zeilen = [
      typ + " über das Kontaktformular",
      "",
      "Von:       " + (z.name || "—"),
      "E-Mail:    " + (z.email || "— (keine angegeben, Antwort nicht möglich)"),
      z.produktname ? "Produkt:   " + z.produktname : "",
      z.marke ? "Marke:     " + z.marke : "",
      z.barcode ? "Barcode:   " + z.barcode : "",
      z.link ? "Link:      " + z.link : "",
      z.foto_url ? "Foto:      " + z.foto_url : "",
      "",
      "Nachricht:",
      String(z.nachricht || "(keine)"),
      "",
      "—",
      "Anfrage #" + z.id + " · " + new Date(z.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
      antwortAn ? "Auf „Antworten“ drücken schreibt direkt an " + antwortAn + "." : "",
    ].filter((l) => l !== "" || true);
    const text = zeilen.join("\r\n").replace(/(\r\n){3,}/g, "\r\n\r\n");

    await senden(user, pass, user, mimeBauen(user, user, antwortAn, "Kontakt · " + typ + " · " + wer, text));
    await admin.from("Kontakt_Anfragen").update({ weitergeleitet_am: new Date().toISOString(), weiterleitung_fehler: null }).eq("id", id);
    return json({ ok: true });
  } catch (e) {
    /* Der Fehler bleibt an der Zeile stehen - sichtbar im Dashboard, statt
       still zu verschwinden. */
    if (id) { try { await admin.from("Kontakt_Anfragen").update({ weiterleitung_fehler: String(e).slice(0, 500) }).eq("id", id); } catch { /* egal */ } }
    return json({ error: String(e) }, 500);
  }
});
