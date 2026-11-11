/* Gemeinsamer Stripe-Zugang NUR fuer die Fachleute-Abrechnung (fp-zahlung,
   fp-monatsrechnung). Bewusst getrennt von der Premium-Anbindung:
   eigener Schluessel STRIPE_FP_SECRET_KEY, nie STRIPE_SECRET_KEY.
   Sicherung: Der Schluessel muss zum Modus in fachleute_einstellung passen
   (test -> sk_test_/rk_test_, live -> sk_live_/rk_live_), sonst bricht alles ab. */

const STRIPE_VERSION = "2024-06-20";

export function stripeSchluessel(modus: string): string {
  const key = (Deno.env.get("STRIPE_FP_SECRET_KEY") || "").trim();
  if (!key) throw new Error("STRIPE_FP_SECRET_KEY fehlt.");
  const istTest = /^(sk|rk)_test_/.test(key), istLive = /^(sk|rk)_live_/.test(key);
  if (modus === "test" && !istTest) throw new Error("Modus test, aber der Schluessel ist kein Testschluessel.");
  if (modus === "live" && !istLive) throw new Error("Modus live, aber der Schluessel ist kein Live-Schluessel.");
  if (modus !== "test" && modus !== "live") throw new Error("Unbekannter Modus: " + modus);
  return key;
}

/* verschachtelte Objekte -> Stripe-Formular (a[b][0]=x) */
function form(o: Record<string, unknown>, pre = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const name = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as Record<string, unknown>, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as Record<string, unknown>, name, out);
    else out.append(name, String(v));
  }
  return out;
}

export async function stripe(key: string, methode: "GET" | "POST", pfad: string,
                             daten: Record<string, unknown> = {}, idem?: string): Promise<any> {
  const h: Record<string, string> = { Authorization: "Bearer " + key, "Stripe-Version": STRIPE_VERSION };
  let url = "https://api.stripe.com/v1/" + pfad, body: string | undefined;
  if (methode === "GET") { const q = form(daten).toString(); if (q) url += "?" + q; }
  else { body = form(daten).toString(); h["Content-Type"] = "application/x-www-form-urlencoded"; if (idem) h["Idempotency-Key"] = idem; }
  const r = await fetch(url, { method: methode, headers: h, body });
  const j = await r.json();
  if (!r.ok) throw new Error("Stripe " + r.status + ": " + (j?.error?.message || "unbekannt"));
  return j;
}

export const euro = (cent: number) => (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const monatName = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" });
