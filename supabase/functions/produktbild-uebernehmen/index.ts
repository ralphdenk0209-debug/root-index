// produktbild-uebernehmen — eigene Packungsfotos als Produktbild (Ralph, 30.09.2026, Weg B)
//
// Ablauf: Claude legt ein Bild per SQL in public.produktbild_eingang ab (Base64).
// Ein Trigger stoesst diese Funktion an. Sie laedt jedes offene Bild in den
// oeffentlichen Bucket "produktbilder" (Pfad p/<zeit>_<Produkt-ID>.<endung>, wie
// Produkt erfassen) und setzt "Produkte"."Bild_URL".
//
// Sicherheit: verify_jwt = false, weil der Aufruf aus der Datenbank (pg_net)
// ohne Schluessel kommt. Die Funktion nimmt KEINE Eingabe an — sie arbeitet nur
// ab, was schon in der Eingangstabelle liegt, und dort schreiben nur
// service_role/postgres (RLS an, keine Policies). Ein fremder Aufruf kann also
// nichts hochladen, hoechstens die Warteschlange frueher abarbeiten.
//
// Bild_URL wird nur gesetzt, wenn sie leer ist, schon auf unseren Bucket zeigt
// oder die Zeile ersetzen = true traegt. Sonst: hochgeladen, aber "uebersprungen".
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "produktbilder";
const ENDUNG: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function b64zuBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/^data:[^,]+,/, "").replace(/\s+/g, ""));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

Deno.serve(async () => {
  const db = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data: zeilen, error } = await db
    .from("produktbild_eingang")
    .select("id, produkt_id, daten_base64, mime, ersetzen")
    .eq("status", "offen").order("id").limit(10);
  if (error) return Response.json({ ok: false, fehler: error.message }, { status: 500 });

  const ergebnis: unknown[] = [];
  for (const z of zeilen ?? []) {
    const setze = async (felder: Record<string, unknown>) =>
      await db.from("produktbild_eingang").update({ ...felder, erledigt_am: new Date().toISOString() }).eq("id", z.id);
    try {
      if (!z.daten_base64) throw new Error("keine Bilddaten");
      const bytes = b64zuBytes(z.daten_base64);
      if (bytes.length < 1000) throw new Error(`Bild zu klein (${bytes.length} Byte)`);
      const pfad = `p/${Date.now()}_${z.produkt_id.toLowerCase()}.${ENDUNG[z.mime] ?? "jpg"}`;
      const up = await db.storage.from(BUCKET).upload(pfad, bytes, { contentType: z.mime, upsert: false });
      if (up.error) throw new Error("Upload: " + up.error.message);
      const oeffentlich = db.storage.from(BUCKET).getPublicUrl(pfad).data.publicUrl;

      const { data: p, error: pe } = await db.from("Produkte")
        .select('"Bild_URL"').eq("Produkt_ID", z.produkt_id).single();
      if (pe) throw new Error("Produkt lesen: " + pe.message);
      const vorher: string | null = (p as { Bild_URL: string | null }).Bild_URL;
      const eigenerBucket = !!vorher && vorher.includes(`/storage/v1/object/public/${BUCKET}/`);
      if (!vorher || eigenerBucket || z.ersetzen) {
        const { error: ue } = await db.from("Produkte").update({ Bild_URL: oeffentlich }).eq("Produkt_ID", z.produkt_id);
        if (ue) throw new Error("Bild_URL setzen: " + ue.message);
        await setze({ status: "erledigt", bild_url: oeffentlich, bild_url_vorher: vorher, daten_base64: null, fehler: null });
        ergebnis.push({ id: z.id, status: "erledigt", bild_url: oeffentlich });
      } else {
        await setze({ status: "uebersprungen", bild_url: oeffentlich, bild_url_vorher: vorher, daten_base64: null,
          fehler: "Bild_URL zeigt auf ein fremdes Bild – nur mit ersetzen = true ueberschreiben" });
        ergebnis.push({ id: z.id, status: "uebersprungen" });
      }
    } catch (e) {
      await setze({ status: "fehler", fehler: String((e as Error).message ?? e).slice(0, 500) });
      ergebnis.push({ id: z.id, status: "fehler", fehler: String(e) });
    }
  }
  return Response.json({ ok: true, anzahl: ergebnis.length, ergebnis });
});
