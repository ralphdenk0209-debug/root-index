/* ---- MAIL-AGENT ----------------------------------------------------------
   20.09.2026, Ralph (Variante B): Claude darf aus dem Admin-Postfach senden,
   ohne Ralphs Anmeldung. Eigener Weg, bewusst schmal:

   - NUR senden. Lesen, Loeschen, Verschieben, Kontakte bleiben allein bei
     mail-postfach mit Admin-Anmeldung.
   - Schluessel liegt NICHT im Code: geprueft wird der SHA-256 gegen die
     Tabelle Postfach_Agent_Schluessel (Spalte Hash, Aktiv). Sperren =
     Aktiv auf false setzen, sofort wirksam.
   - Jede gesendete Mail steht in Postfach_Agent_Log und geht zusaetzlich als
     Blindkopie an das eigene Postfach - Ralph sieht also immer, was raus ist.
   - verify_jwt ist aus, weil dieser Weg seinen eigenen Schluessel prueft.

   Zugangsdaten wie bei mail-postfach: Supabase-Secrets MAIL_ADDRESS /
   MAIL_PASSWORD, SMTP smtp.webspace.bz:465. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "smtp.webspace.bz";
const SMTP_PORT = 465;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-agent-key, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const key = String(req.headers.get("x-agent-key") || body.key || "").trim();
    if (!key) return json({ error: "Schlüssel fehlt." }, 401);

    const admin = adminClient();
    const hash = await sha256Hex(key);
    const { data: schluessel, error: kErr } = await admin
      .from("Postfach_Agent_Schluessel").select("Hash,Name,Aktiv,Anzahl").eq("Hash", hash).maybeSingle();
    if (kErr) return json({ error: kErr.message }, 500);
    if (!schluessel || schluessel.Aktiv !== true) return json({ error: "Schlüssel ungültig oder gesperrt." }, 403);

    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.text || "");
    const html = body.html ? String(body.html) : undefined;
    if (!to || !text) return json({ error: "to und text nötig" }, 400);

    const user = Deno.env.get("MAIL_ADDRESS")!;
    const pass = Deno.env.get("MAIL_PASSWORD")!;
    if (!user || !pass) return json({ error: "MAIL_ADDRESS/MAIL_PASSWORD fehlen (Supabase-Secrets)." }, 500);

    const smtp = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: user, password: pass } } });
    const msg: Record<string, unknown> = { from: user, to, bcc: user, subject: subject || "(kein Betreff)", content: text };
    if (html) msg.html = html;
    await smtp.send(msg as any);
    await smtp.close();

    await admin.from("Postfach_Agent_Log").insert({ "Schluessel_Name": schluessel.Name, "An": to, "Betreff": subject });
    await admin.from("Postfach_Agent_Schluessel")
      .update({ "Letzte_Nutzung": new Date().toISOString(), "Anzahl": (schluessel.Anzahl || 0) + 1 })
      .eq("Hash", hash);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
