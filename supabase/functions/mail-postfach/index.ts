/* ---- MAIL-POSTFACH -------------------------------------------------------
   17.09.2026, Ralph: Mini-Mail-Client im Dashboard fuer kontakt@root-index.de.
   Postfach liegt bei webspace.bz (IMAP: mail.webspace.bz, SMTP: smtp.webspace.bz),
   Zugangsdaten NICHT im Code - liegen als Supabase-Secrets MAIL_ADDRESS/
   MAIL_PASSWORD. Admin-Pruefung genau wie in admin-set-password (A4.2).

   v1: list/read/send (Posteingang, IMAP4rev1 per rohem TLS-Socket, da es fuer
   Deno/Supabase keine ausgereifte IMAP-Bibliothek gibt).
   v2: send akzeptiert html (Formatierung/Signatur aus postfach-ui.js).
   v3 (Ralph: "weiter ausbauen mit löschen, papierkorb, postausgang, ablage
   usw"): echte Postfach-Ordner statt nur INBOX.
   v4 (Ralph: "neu mail verfassen fehlt und ein kontaktbuch"): Kontaktbuch
     (Tabelle Postfach_Kontakte, ohne RLS-Policy - nur ueber diese Funktion mit
     Service-Role-Key erreichbar).
   v5 (Ralph: "kontakte sollen automatisch die registrierten kunden eingefuegt
     werden, wenn email vorliegt"): kontakteListe() mischt registrierte Kunden
     (Tabelle Benutzer, Spalte Email) automatisch ein - nicht loeschbar, Dublette
     zu einem manuell angelegten Kontakt (gleiche E-Mail) wird uebersprungen.
   v6 (14.11.2026): Versand ohne denomailer. Gmail/Google Workspace (z. B. Kaufland)
     lehnte unsere Mails ab: "550-5.7.1 'From' header is missing" (RFC 5322).
     Jetzt eigenes SMTP ueber TLS mit derselben selbst gebauten MIME-Nachricht,
     die auch im Postausgang landet (From, To, Date, Message-ID, Subject). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const IMAP_HOST = "mail.webspace.bz";
const IMAP_PORT = 993;
const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;
const ABSENDER_NAME = "Root Index";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
async function requireAdmin(req: Request): Promise<Response | null> {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!jwt) return json({ error: "Nicht angemeldet." }, 401);
  const admin = adminClient();
  const { data: caller, error: cErr } = await admin.auth.getUser(jwt);
  if (cErr || !caller?.user) return json({ error: "Sitzung ungültig." }, 401);
  const { data: me } = await admin.from("Benutzer").select("is_admin").eq("auth_id", caller.user.id).maybeSingle();
  if (!me || me.is_admin !== true) return json({ error: "Nur Admins dürfen das Postfach sehen." }, 403);
  return null;
}

/* ---- Kontaktbuch ----------------------------------------------------------- */
async function kontakteListe() {
  const admin = adminClient();
  const [manuellRes, kundenRes] = await Promise.all([
    admin.from("Postfach_Kontakte").select("id,name,email").order("name", { ascending: true }),
    admin.from("Benutzer").select("Name,Email").not("Email", "is", null).neq("Email", ""),
  ]);
  if (manuellRes.error) throw new Error(manuellRes.error.message);
  if (kundenRes.error) throw new Error(kundenRes.error.message);
  const manuell = (manuellRes.data || []).map((r: any) => ({ id: r.id, name: r.name, email: r.email, quelle: "manuell" }));
  const bekannt = new Set(manuell.map((r: any) => String(r.email || "").toLowerCase()));
  const kunden = (kundenRes.data || [])
    .filter((r: any) => r.Email && !bekannt.has(String(r.Email).toLowerCase()))
    .map((r: any) => ({ id: null, name: r.Name, email: r.Email, quelle: "kunde" }));
  const alle = manuell.concat(kunden);
  alle.sort((a: any, b: any) => String(a.name || a.email).localeCompare(String(b.name || b.email), "de"));
  return alle;
}
async function kontaktHinzufuegen(name: string, email: string) {
  const { error } = await adminClient().from("Postfach_Kontakte").insert({ name: name || null, email });
  if (error) throw new Error(error.message);
}
async function kontaktLoeschen(id: number) {
  const { error } = await adminClient().from("Postfach_Kontakte").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---- Byte-sicherer Zeilen-/Literal-Leser ueber den TLS-Socket ------------ */
class ImapConn {
  conn: Deno.TlsConn;
  buf = "";
  constructor(conn: Deno.TlsConn) { this.conn = conn; }
  async fill() {
    const chunk = new Uint8Array(16384);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("Verbindung geschlossen");
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(chunk[i]);
    this.buf += s;
  }
  async readLine(): Promise<string> {
    while (true) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        return line;
      }
      await this.fill();
    }
  }
  async readBytes(n: number): Promise<string> {
    while (this.buf.length < n) await this.fill();
    const s = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return s;
  }
  async write(s: string) {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    let off = 0;
    while (off < bytes.length) off += await this.conn.write(bytes.subarray(off));
  }
  close() { try { this.conn.close(); } catch { /* egal */ } }
}

function latin1ToUtf8(s: string): string {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); } catch { return s; }
}
function decodeCharset(bytes: Uint8Array, charset: string): string {
  try { return new TextDecoder(charset || "utf-8", { fatal: false }).decode(bytes); }
  catch { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
}
function toBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}
function decodeMimeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, charset, enc, txt) => {
    try {
      if (enc.toLowerCase() === "b") {
        return decodeCharset(toBytes(atob(txt)), charset);
      } else {
        const q = txt.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16)));
        return decodeCharset(toBytes(q), charset);
      }
    } catch { return txt; }
  });
}
function unfoldHeaders(raw: string): string {
  return raw.replace(/\r\n[ \t]+/g, " ");
}
function decodeQuotedPrintable(s: string): Uint8Array {
  const clean = s.replace(/=\r\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "=" && i + 2 < clean.length && /[0-9A-Fa-f]{2}/.test(clean.slice(i + 1, i + 3))) {
      out.push(parseInt(clean.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(clean.charCodeAt(i) & 0xff);
    }
  }
  return new Uint8Array(out);
}

type ImapLine = { text: string; literal?: string };
let tagN = 0;
function nextTag() { tagN++; return "A" + tagN; }
const q = (s: string) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

async function imapCommand(c: ImapConn, cmd: string): Promise<ImapLine[]> {
  const tag = nextTag();
  await c.write(`${tag} ${cmd}\r\n`);
  const out: ImapLine[] = [];
  while (true) {
    const line = await c.readLine();
    const lit = line.match(/\{(\d+)\}$/);
    if (lit) {
      const n = parseInt(lit[1], 10);
      const payload = await c.readBytes(n);
      out.push({ text: line, literal: payload });
      continue;
    }
    out.push({ text: line });
    if (new RegExp("^" + tag + " ", "i").test(line)) break;
    if (out.length > 20000) throw new Error("IMAP-Antwort zu lang");
  }
  const last = out[out.length - 1].text;
  if (!new RegExp("^" + tag + " OK", "i").test(last)) throw new Error("IMAP-Fehler: " + last);
  return out;
}

async function imapAppend(c: ImapConn, folder: string, raw: string, flags = "\\Seen") {
  const tag = nextTag();
  await c.write(`${tag} APPEND ${q(folder)} (${flags}) {${raw.length}}\r\n`);
  const cont = await c.readLine();
  if (!cont.startsWith("+")) throw new Error("APPEND abgelehnt: " + cont);
  await c.write(raw + "\r\n");
  const out: ImapLine[] = [];
  while (true) {
    const line = await c.readLine();
    out.push({ text: line });
    if (new RegExp("^" + tag + " ", "i").test(line)) break;
  }
  const last = out[out.length - 1].text;
  if (!new RegExp("^" + tag + " OK", "i").test(last)) throw new Error("APPEND-Fehler: " + last);
}

async function imapLogin(): Promise<ImapConn> {
  const user = Deno.env.get("MAIL_ADDRESS")!;
  const pass = Deno.env.get("MAIL_PASSWORD")!;
  if (!user || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen (Supabase-Secrets).");
  const conn = await Deno.connectTls({ hostname: IMAP_HOST, port: IMAP_PORT });
  const c = new ImapConn(conn);
  await c.readLine(); // Begruessung
  await imapCommand(c, `LOGIN ${q(user)} ${q(pass)}`);
  return c;
}
async function imapSelect(c: ImapConn, folder: string) {
  return imapCommand(c, `SELECT ${q(folder)}`);
}
async function imapEnsureFolder(c: ImapConn, folder: string) {
  try { await imapSelect(c, folder); }
  catch { await imapCommand(c, `CREATE ${q(folder)}`); }
}

/* ---- Ordner erkennen (SPECIAL-USE, sonst Namensraten) --------------------- */
function parseListLines(resp: ImapLine[]): { name: string; flags: string[] }[] {
  const rows: { name: string; flags: string[] }[] = [];
  for (const item of resp) {
    const m = item.text.match(/^\* LIST \(([^)]*)\)\s+(?:"([^"]*)"|\S+)\s+(?:"([^"]*)"|(\S+))\s*$/i);
    if (!m) continue;
    const flags = (m[1] || "").split(/\s+/).filter(Boolean);
    const name = m[3] !== undefined ? m[3] : (m[4] || "");
    if (name) rows.push({ name, flags });
  }
  return rows;
}
async function imapListFolders(c: ImapConn): Promise<{ name: string; flags: string[] }[]> {
  let rows: { name: string; flags: string[] }[] = [];
  try { rows = parseListLines(await imapCommand(c, 'LIST (SPECIAL-USE) "" "*"')); } catch { /* keine SPECIAL-USE-Erweiterung */ }
  if (!rows.some((r) => r.flags.some((f) => /Sent|Trash|Drafts|Archive|Junk/i.test(f)))) {
    try { rows = parseListLines(await imapCommand(c, 'LIST "" "*"')); } catch { /* egal, bleibt leer */ }
  }
  return rows;
}
function findFolder(rows: { name: string; flags: string[] }[], kind: "Sent" | "Trash" | "Drafts" | "Archive" | "Junk"): string | null {
  const bySpecial = rows.find((r) => r.flags.some((f) => f.replace("\\", "").toLowerCase() === kind.toLowerCase()));
  if (bySpecial) return bySpecial.name;
  const guess: Record<string, RegExp> = {
    Sent: /sent|gesendet/i, Trash: /trash|papierkorb|deleted/i, Drafts: /draft|entwurf/i,
    Archive: /archiv/i, Junk: /junk|spam/i,
  };
  const g = rows.find((r) => guess[kind].test(r.name));
  return g ? g.name : null;
}
const FALLBACK_NAME: Record<string, string> = { sent: "Sent", trash: "Trash", archive: "Archiv", drafts: "Drafts", junk: "Junk" };
async function resolveFolder(c: ImapConn, kind: string): Promise<string> {
  if (kind === "inbox") return "INBOX";
  const rows = await imapListFolders(c);
  const specialKind = (kind.charAt(0).toUpperCase() + kind.slice(1)) as "Sent" | "Trash" | "Drafts" | "Archive" | "Junk";
  let name = findFolder(rows, specialKind);
  if (!name) {
    name = FALLBACK_NAME[kind] || kind;
    await imapEnsureFolder(c, name);
  }
  return name;
}
async function folderUebersicht() {
  const c = await imapLogin();
  try {
    const rows = await imapListFolders(c);
    return {
      inbox: "INBOX",
      sent: findFolder(rows, "Sent"),
      trash: findFolder(rows, "Trash"),
      archive: findFolder(rows, "Archive"),
    };
  } finally { c.close(); }
}

/* ---- Nachrichten lesen ---------------------------------------------------- */
async function listMessages(kind: string, limit: number) {
  const c = await imapLogin();
  try {
    const folder = await resolveFolder(c, kind);
    await imapSelect(c, folder);
    const sel = await imapCommand(c, "SELECT " + q(folder));
    let exists = 0;
    for (const l of sel) { const m = l.text.match(/^\* (\d+) EXISTS/); if (m) exists = parseInt(m[1], 10); }
    if (exists === 0) return [];
    const start = Math.max(1, exists - limit + 1);
    const resp = await imapCommand(c, `FETCH ${start}:${exists} (UID FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE)])`);
    const out: { uid: number; subject: string; from: string; to: string; date: string; seen: boolean }[] = [];
    for (const item of resp) {
      if (!/^\* \d+ FETCH/.test(item.text)) continue;
      const uidM = item.text.match(/UID (\d+)/);
      if (!uidM) continue;
      const seen = /\\Seen/.test(item.text);
      let subject = "", from = "", to = "", date = "";
      if (item.literal) {
        const raw = unfoldHeaders(latin1ToUtf8(item.literal));
        const sM = raw.match(/^Subject:\s*(.*)$/im), fM = raw.match(/^From:\s*(.*)$/im);
        const tM = raw.match(/^To:\s*(.*)$/im), dM = raw.match(/^Date:\s*(.*)$/im);
        if (sM) subject = decodeMimeWords(sM[1].trim());
        if (fM) from = decodeMimeWords(fM[1].trim());
        if (tM) to = decodeMimeWords(tM[1].trim());
        if (dM) date = dM[1].trim();
      }
      out.push({ uid: parseInt(uidM[1], 10), subject, from, to, date, seen });
    }
    out.sort((a, b) => b.uid - a.uid);
    return out;
  } finally { c.close(); }
}

function parseMimeMessage(raw: string): { subject: string; from: string; to: string; date: string; text: string } {
  const sep = raw.indexOf("\r\n\r\n");
  const headerText = unfoldHeaders(sep >= 0 ? raw.slice(0, sep) : raw);
  let body = sep >= 0 ? raw.slice(sep + 4) : "";
  const head = (name: string) => {
    const m = headerText.match(new RegExp("^" + name + ":\\s*(.*)$", "im"));
    return m ? decodeMimeWords(m[1].trim()) : "";
  };
  const ctypeLine = headerText.match(/^Content-Type:\s*(.*)$/im)?.[1] || "text/plain";
  const boundaryM = ctypeLine.match(/boundary="?([^";]+)"?/i);

  function decodePart(partHeaders: string, partBody: string): { type: string; text: string } {
    const cte = (partHeaders.match(/^Content-Transfer-Encoding:\s*(.*)$/im)?.[1] || "").trim().toLowerCase();
    const ct = (partHeaders.match(/^Content-Type:\s*(.*)$/im)?.[1] || "text/plain").trim();
    const type = ct.split(";")[0].trim().toLowerCase();
    const csM = ct.match(/charset="?([^";]+)"?/i);
    const charset = csM ? csM[1] : "utf-8";
    let bytes: Uint8Array;
    if (cte === "base64") bytes = toBytes(atob(partBody.replace(/[\r\n]/g, "")));
    else if (cte === "quoted-printable") bytes = decodeQuotedPrintable(partBody);
    else bytes = toBytes(partBody);
    return { type, text: decodeCharset(bytes, charset) };
  }

  let plain = "", html = "";
  if (boundaryM) {
    const boundary = boundaryM[1];
    const parts = body.split("--" + boundary).slice(1, -1);
    for (const part of parts) {
      const pSep = part.indexOf("\r\n\r\n");
      if (pSep < 0) continue;
      const pHead = part.slice(0, pSep).replace(/^\r\n/, "");
      const pBody = part.slice(pSep + 4);
      const dec = decodePart(pHead, pBody);
      if (dec.type === "text/plain" && !plain) plain = dec.text;
      if (dec.type === "text/html" && !html) html = dec.text;
    }
  } else {
    const dec = decodePart(headerText, body);
    if (dec.type === "text/html") html = dec.text; else plain = dec.text;
  }
  let text = plain;
  if (!text && html) text = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return { subject: head("Subject"), from: head("From"), to: head("To"), date: head("Date"), text };
}

async function readMessage(kind: string, uid: number) {
  const c = await imapLogin();
  try {
    const folder = await resolveFolder(c, kind);
    await imapSelect(c, folder);
    const resp = await imapCommand(c, `UID FETCH ${uid} (FLAGS BODY.PEEK[])`);
    const item = resp.find((l) => l.literal);
    if (!item?.literal) throw new Error("Nachricht nicht gefunden.");
    const raw = latin1ToUtf8(item.literal);
    return parseMimeMessage(raw);
  } finally { c.close(); }
}

/* ---- Loeschen / Verschieben ------------------------------------------------ */
async function imapMove(c: ImapConn, uid: number, dest: string) {
  try { await imapCommand(c, `UID MOVE ${uid} ${q(dest)}`); return; }
  catch {
    await imapCommand(c, `UID COPY ${uid} ${q(dest)}`);
    await imapCommand(c, `UID STORE ${uid} +FLAGS (\\Deleted)`);
    await imapCommand(c, "EXPUNGE");
  }
}
async function doDelete(kind: string, uid: number) {
  const c = await imapLogin();
  try {
    const folder = await resolveFolder(c, kind);
    await imapSelect(c, folder);
    const trash = await resolveFolder(c, "trash");
    await imapMove(c, uid, trash);
  } finally { c.close(); }
}
async function doPurge(kind: string, uid: number) {
  const c = await imapLogin();
  try {
    const folder = await resolveFolder(c, kind);
    await imapSelect(c, folder);
    await imapCommand(c, `UID STORE ${uid} +FLAGS (\\Deleted)`);
    await imapCommand(c, "EXPUNGE");
  } finally { c.close(); }
}
async function doArchive(kind: string, uid: number) {
  const c = await imapLogin();
  try {
    const folder = await resolveFolder(c, kind);
    await imapSelect(c, folder);
    const archive = await resolveFolder(c, "archive");
    await imapMove(c, uid, archive);
  } finally { c.close(); }
}

/* ---- Senden + Ablage im Postausgang ---------------------------------------- */
function b64Wrap(bytes: Uint8Array): string {
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/(.{76})/g, "$1\r\n");
}
function mimeEncodeHeader(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  /* v6: in Stuecke von hoechstens 45 Byte teilen (Encoded-Word <= 75 Zeichen, RFC 2047), ohne UTF-8-Zeichen zu zerschneiden. */
  const teile: string[] = []; let akt: number[] = [];
  for (const ch of s) {
    const b = Array.from(new TextEncoder().encode(ch));
    if (akt.length + b.length > 45) { teile.push("=?UTF-8?B?" + btoa(String.fromCharCode(...akt)) + "?="); akt = []; }
    akt.push(...b);
  }
  if (akt.length) teile.push("=?UTF-8?B?" + btoa(String.fromCharCode(...akt)) + "?=");
  return teile.join("\r\n ");
}
function empfaengerListe(to: string): string[] {
  return to.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/<([^>]+)>/); return (m ? m[1] : s).trim();
  }).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
}
function buildRawMime(fromAddr: string, to: string, subject: string, text: string, html?: string): string {
  const boundary = "ri-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const domain = fromAddr.split("@")[1] || "root-index.de";
  const msgId = `<${Date.now().toString(36)}.${crypto.randomUUID()}@${domain}>`;
  let out = `Date: ${new Date().toUTCString()}\r\nFrom: ${mimeEncodeHeader(ABSENDER_NAME)} <${fromAddr}>\r\nTo: ${empfaengerListe(to).join(", ")}\r\n`
    + `Subject: ${mimeEncodeHeader(subject)}\r\nMessage-ID: ${msgId}\r\nMIME-Version: 1.0\r\n`;
  if (html) {
    out += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`
      + `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64Wrap(new TextEncoder().encode(text))}\r\n\r\n`
      + `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64Wrap(new TextEncoder().encode(html))}\r\n\r\n`
      + `--${boundary}--\r\n`;
  } else {
    out += `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64Wrap(new TextEncoder().encode(text))}\r\n`;
  }
  return out;
}

/* v6: SMTP selbst - eine Antwort lesen (mehrzeilig "250-..." bis "250 ..."), Code pruefen. */
async function smtpAntwort(c: ImapConn, erwartet: number[]): Promise<string> {
  let zeile = "", alle = "";
  do { zeile = await c.readLine(); alle += zeile + "\n"; } while (/^\d{3}-/.test(zeile));
  const code = parseInt(zeile.slice(0, 3), 10);
  if (!erwartet.includes(code)) throw new Error("SMTP " + alle.trim().slice(0, 300));
  return alle;
}
async function smtpSenden(user: string, pass: string, empfaenger: string[], raw: string) {
  const c = new ImapConn(await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT }));
  try {
    await smtpAntwort(c, [220]);
    await c.write("EHLO root-index.de\r\n"); await smtpAntwort(c, [250]);
    await c.write("AUTH LOGIN\r\n"); await smtpAntwort(c, [334]);
    const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s)).map((b) => String.fromCharCode(b)).join(""));
    await c.write(b64(user) + "\r\n"); await smtpAntwort(c, [334]);
    await c.write(b64(pass) + "\r\n"); await smtpAntwort(c, [235]);
    await c.write(`MAIL FROM:<${user}>\r\n`); await smtpAntwort(c, [250]);
    for (const e of empfaenger) { await c.write(`RCPT TO:<${e}>\r\n`); await smtpAntwort(c, [250, 251]); }
    await c.write("DATA\r\n"); await smtpAntwort(c, [354]);
    const daten = raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await c.write(daten + (daten.endsWith("\r\n") ? "" : "\r\n") + ".\r\n"); await smtpAntwort(c, [250]);
    await c.write("QUIT\r\n"); try { await smtpAntwort(c, [221]); } catch { /* egal */ }
  } finally { c.close(); }
}
async function sendMail(to: string, subject: string, text: string, html?: string) {
  const user = Deno.env.get("MAIL_ADDRESS")!;
  const pass = Deno.env.get("MAIL_PASSWORD")!;
  if (!user || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen (Supabase-Secrets).");
  const empfaenger = empfaengerListe(to);
  if (!empfaenger.length) throw new Error("Keine gültige Empfänger-Adresse.");
  const raw = buildRawMime(user, to, subject, text, html);
  await smtpSenden(user, pass, empfaenger, raw);
  /* Reines SMTP legt nichts in einen IMAP-Ordner - ohne das hier waere der
     Postausgang immer leer. Ein Fehlschlag hier ist kein Grund, den (schon
     erfolgreich verschickten!) Versand als Fehler zu melden. */
  try {
    const c = await imapLogin();
    try {
      const sent = await resolveFolder(c, "sent");
      await imapAppend(c, sent, raw, "\\Seen");
    } finally { c.close(); }
  } catch (e) { console.error("Ablage im Postausgang fehlgeschlagen:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "list";
      const folder = (url.searchParams.get("folder") || "inbox").toLowerCase();
      if (action === "folders") return json({ ok: true, folders: await folderUebersicht() });
      if (action === "contacts") return json({ ok: true, kontakte: await kontakteListe() });
      if (action === "list") {
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
        return json({ ok: true, items: await listMessages(folder, limit) });
      }
      if (action === "read") {
        const uid = parseInt(url.searchParams.get("uid") || "0", 10);
        if (!uid) return json({ error: "uid fehlt" }, 400);
        return json({ ok: true, message: await readMessage(folder, uid) });
      }
      return json({ error: "Unbekannte action" }, 400);
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "send");
      if (action === "send") {
        const to = String(body.to || "").trim();
        const subject = String(body.subject || "").trim();
        const text = String(body.text || "");
        const html = body.html ? String(body.html) : undefined;
        if (!to || !text) return json({ error: "to und text nötig" }, 400);
        await sendMail(to, subject || "(kein Betreff)", text, html);
        return json({ ok: true });
      }
      if (action === "contact_add") {
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim();
        if (!email) return json({ error: "E-Mail-Adresse fehlt" }, 400);
        await kontaktHinzufuegen(name, email);
        return json({ ok: true });
      }
      if (action === "contact_delete") {
        const id = parseInt(body.id, 10);
        if (!id) return json({ error: "id fehlt" }, 400);
        await kontaktLoeschen(id);
        return json({ ok: true });
      }
      const folder = String(body.folder || "inbox").toLowerCase();
      const uid = parseInt(body.uid, 10);
      if (!uid) return json({ error: "uid fehlt" }, 400);
      if (action === "delete") { await doDelete(folder, uid); return json({ ok: true }); }
      if (action === "purge") { await doPurge(folder, uid); return json({ ok: true }); }
      if (action === "archive") { await doArchive(folder, uid); return json({ ok: true }); }
      return json({ error: "Unbekannte action" }, 400);
    }
    return json({ error: "Methode nicht unterstützt" }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
