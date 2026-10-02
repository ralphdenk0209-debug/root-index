import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-haiku-4-5-20251001";
const PREIS_IN = 1.0;
const PREIS_OUT = 5.0;

function antwort(body: unknown, status=200){
  return new Response(JSON.stringify(body), {status, headers:{...CORS,"Content-Type":"application/json"}});
}
function key(): string | null {
  const env=Deno.env.toObject();
  if (env.ANTHROPIC_API_KEY?.startsWith("sk-ant-")) return env.ANTHROPIC_API_KEY;
  for (const v of Object.values(env)) if (typeof v==="string" && v.startsWith("sk-ant-")) return v;
  return null;
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return antwort({ok:false,fehler:"Nur POST."},405);
  const auth=req.headers.get("Authorization") ?? "";
  if(!auth.startsWith("Bearer ")) return antwort({ok:false,fehler:"Nicht angemeldet."},401);

  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const userSb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:userData,error:userErr}=await userSb.auth.getUser();
  if(userErr || !userData.user) return antwort({ok:false,fehler:"Nicht angemeldet."},401);

  const body=await req.json().catch(()=>null) as any;
  const frage=String(body?.frage ?? "").trim();
  const kontextIn=(body?.kontext && typeof body.kontext==="object") ? body.kontext : {};
  if(!frage) return antwort({ok:false,fehler:"Frage fehlt."},400);
  if(frage.length>1200) return antwort({ok:false,fehler:"Frage ist zu lang."},400);

  const {data:lim,error:limErr}=await userSb.rpc("cb_riki_frage_limit_check");
  const l=Array.isArray(lim)?lim[0]:lim;
  if(limErr) return antwort({ok:false,fehler:"Limitprüfung fehlgeschlagen."},500);
  if(l?.erlaubt!==true) return antwort({ok:false,fehler:l?.grund ?? "RIKI-Limit erreicht.",limit:l},429);

  const {data:kontext,error:kErr}=await userSb.rpc("cb_riki_frage_kontext",{p_context:kontextIn});
  if(kErr) return antwort({ok:false,fehler:"Seitenkontext konnte nicht geladen werden."},500);

  const apiKey=key();
  if(!apiKey) return antwort({ok:false,fehler:"RIKI ist serverseitig nicht konfiguriert."},500);

  const system=`Du bist RIKI, der Begleiter von Root Index. Antworte knapp, klar und auf Deutsch.\n\nVERBINDLICHE REGELN:\n- Nutze nur die übergebenen Seitendaten. Erfinde keine Produkt-, Rezept-, Nutzer- oder Gesundheitsdaten.\n- Du erhältst absichtlich NICHT das komplette Nutzerprofil. Behaupte nicht, du wüsstest mehr über die Person.\n- Gesundheitswarnungen, Diagnosen, Therapie-, Dosierungs- oder Medikamentenempfehlungen darfst du nicht selbst erzeugen. Wenn eine Frage eine individuelle gesundheitliche Bewertung verlangt und keine ausdrücklich serverseitig entschiedene Gesundheitsinformation im Kontext vorliegt, sage klar, dass du das hier nicht sicher beurteilen kannst.\n- Produktwerte und Bewertungen nur aus dem Kontext nennen. Bei fehlenden Daten: 'nicht sicher beurteilbar' statt positiver Vermutung.\n- Beschreibe keine erfundenen Schaltflächen oder Seitenfunktionen. Die Seitenerklärung läuft separat kuratiert.\n- Bei einer normalen Sachfrage darfst du den sichtbaren Produkt-/Rezeptkontext erklären und einordnen, ohne neue medizinische Regeln zu erfinden.`;

  const t0=Date.now();
  const ai=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({model:MODEL,max_tokens:900,system,messages:[{role:"user",content:`SEITENKONTEXT (serverseitig minimiert):\n${JSON.stringify(kontext)}\n\nFRAGE:\n${frage}`}]})
  });
  const j:any=await ai.json().catch(()=>null);
  const dauer=Date.now()-t0;
  const usage=j?.usage ?? {};
  const inTok=Number(usage.input_tokens ?? 0)+Number(usage.cache_creation_input_tokens ?? 0)+Number(usage.cache_read_input_tokens ?? 0);
  const outTok=Number(usage.output_tokens ?? 0);
  const kosten=(inTok/1e6)*PREIS_IN+(outTok/1e6)*PREIS_OUT;
  const text=(j?.content ?? []).filter((x:any)=>x?.type==="text").map((x:any)=>x.text).join("\n").trim();

  // 02.10.2026: userSb.rpc() liefert keinen echten Promise mit .catch() -
  // "userSb.rpc(...).catch is not a function" warf jede Antwort weg (HTTP 500),
  // obwohl das Modell schon geantwortet hatte. Buchung jetzt mit try/await.
  try {
    await userSb.rpc("cb_riki_buchen_v2",{
      p_modus:"frage",p_modell:MODEL,p_in:inTok,p_out:outTok,p_kosten:Number(kosten.toFixed(6)),
      p_produkt_id:kontextIn?.produkt_id ?? null,p_erfolg:ai.ok,p_fehler:ai.ok?null:String(j?.error?.message ?? `HTTP ${ai.status}`).slice(0,500),p_dauer_ms:dauer
    });
  } catch (_) { /* Buchung darf die Antwort nie verhindern */ }

  if(!ai.ok || !text) return antwort({ok:false,fehler:"RIKI konnte gerade nicht antworten.",dauer_ms:dauer},502);
  return antwort({ok:true,antwort:text,dauer_ms:dauer,limit:{heute_genutzt:Number(l?.heute_genutzt ?? 0)+1,limit_tag:l?.limit_tag},kontext_scope:Object.keys(kontext ?? {})});
});
