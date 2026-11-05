// pruefung.ts — Apple-Signatur (JWS mit x5c-Kette) pruefen, nur mit WebCrypto.
//
// 05.11.2026 (#898): Die Apple-Bibliothek @apple/app-store-server-library braucht
// node:crypto X509Certificate. In der Supabase-Edge-Laufzeit (Deno 2.1) wirft sie
// "Not implemented: crypto.X509Certificate.prototype.toString" -> VerificationException 1.
// Folge: Seit dem Start wurde KEIN Apple-Kauf freigeschaltet (29.10.: 2 Gratis-Tests, beide abgewiesen).
// Nachgestellt lokal mit Deno 2.1.4. Diese Pruefung macht dasselbe wie die Bibliothek
// (Kette bis zu Apples Root, Apple-Kennzeichen in Leaf und Zwischenzertifikat, Gueltigkeit
// zum Signaturdatum, ES256-Signatur), aber ohne node:crypto.

import * as x509 from "npm:@peculiar/x509@1.12.3";
import { compactVerify, decodeProtectedHeader } from "npm:jose@5.9.6";

x509.cryptoProvider.set(crypto);

// Apple-Kennzeichen (dieselben OIDs wie in Apples Bibliothek).
const OID_LEAF = "1.2.840.113635.100.6.11.1";
const OID_ZWISCHEN = "1.2.840.113635.100.6.2.1";
const SPIELRAUM_MS = 60_000;

function base64Bytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64urlText(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return new TextDecoder().decode(base64Bytes(b + "===".slice((b.length + 3) % 4)));
}

function gueltigAm(c: x509.X509Certificate, datum: Date, name: string) {
  if (c.notBefore.getTime() > datum.getTime() + SPIELRAUM_MS || c.notAfter.getTime() < datum.getTime() - SPIELRAUM_MS) {
    throw new Error(`Zertifikat ${name} am ${datum.toISOString()} nicht gueltig`);
  }
}

/** Prueft einen Apple-JWS und gibt den Inhalt zurueck. `wurzeln` = Apples Root-Zertifikate (DER). */
export async function appleJwsPruefen(jws: string, wurzeln: Uint8Array[]): Promise<any> {
  const kopf = decodeProtectedHeader(jws);
  if (kopf.alg !== "ES256") throw new Error("Algorithmus nicht ES256");
  const kette = (kopf.x5c ?? []) as string[];
  if (kette.length !== 3) throw new Error("Zertifikatskette hat nicht 3 Glieder");
  const [leaf, zwischen] = kette.slice(0, 2).map((c) => new x509.X509Certificate(base64Bytes(c)));

  // Datum wie bei Apples Bibliothek ohne Online-Pruefung: das Signaturdatum im Inhalt.
  const roh = JSON.parse(base64urlText(jws.split(".")[1] ?? ""));
  const datum = new Date(roh.signedDate ?? roh.receiptCreationDate ?? Date.now());

  // 1) Zwischenzertifikat von einer vertrauten Apple-Wurzel unterschrieben (die mitgelieferte
  //    Wurzel in x5c wird bewusst NICHT verwendet).
  let wurzel: x509.X509Certificate | null = null;
  for (const w of wurzeln.map((d) => new x509.X509Certificate(d))) {
    if (zwischen.issuer === w.subject && await zwischen.verify({ publicKey: w.publicKey, signatureOnly: true })) {
      wurzel = w;
      break;
    }
  }
  if (!wurzel) throw new Error("Zwischenzertifikat nicht von Apple-Wurzel signiert");
  // 2) Leaf vom Zwischenzertifikat unterschrieben.
  if (leaf.issuer !== zwischen.subject || !(await leaf.verify({ publicKey: zwischen.publicKey, signatureOnly: true }))) {
    throw new Error("Leaf nicht vom Zwischenzertifikat signiert");
  }
  // 3) Apple-Kennzeichen.
  if (!leaf.getExtension(OID_LEAF)) throw new Error("Leaf ohne Apple-Kennzeichen");
  if (!zwischen.getExtension(OID_ZWISCHEN)) throw new Error("Zwischenzertifikat ohne Apple-Kennzeichen");
  // 4) Gueltigkeit zum Signaturdatum.
  gueltigAm(leaf, datum, "Leaf");
  gueltigAm(zwischen, datum, "Zwischen");
  gueltigAm(wurzel, datum, "Wurzel");
  // 5) Signatur des JWS mit dem Schluessel des Leaf.
  const schluessel = await leaf.publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"]);
  const { payload } = await compactVerify(jws, schluessel);
  return JSON.parse(new TextDecoder().decode(payload));
}
