(function(){try{
if(/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent))return;
var r=document.referrer,q="direkt";
if(r){var h="";try{h=new URL(r).hostname}catch(e){}
q=/(^|\.)google\./.test(h)?"google":/bing\./.test(h)?"bing":/duckduckgo|ecosia|yahoo|qwant|startpage|brave/.test(h)?"andere-suche":/root-index\.(de|com)$/.test(h)?"intern":"andere";}
try{if(/(^|[?&])von=com([&#]|$)/.test(location.search))sessionStorage.setItem("ri_von","com");
if(sessionStorage.getItem("ri_von")==="com")q="com";}catch(e){}
/* 21.10.2026 (Ralph: "facebook und youtube werden angeschaut"): Kanal erkennen - Referrer, In-App-Browser der Apps, ?von=ig|fb|yt|tt|pin|th|nl. Eigene Geraete (Admin geoeffnet) zaehlen als "eigen". */
try{var _r=(document.referrer||"").toLowerCase(),_u=navigator.userAgent;
if(/instagram\./.test(_r)||/Instagram/.test(_u))q="instagram";else if(/(^|\/\/|\.)(facebook\.com|fb\.me|fb\.com)/.test(_r)||/FBAN|FBAV|FB_IAB/.test(_u))q="facebook";else if(/youtube\.com|youtu\.be/.test(_r))q="youtube";else if(/tiktok\./.test(_r)||/musical_ly|BytedanceWebview|TikTok/.test(_u))q="tiktok";else if(/pinterest\.|pin\.it/.test(_r)||/Pinterest/.test(_u))q="pinterest";else if(/threads\.(net|com)/.test(_r)||/Barcelona/.test(_u))q="threads";
var _v=(location.search.match(/[?&]von=([a-z]+)/)||[])[1],_m={ig:"instagram",fb:"facebook",yt:"youtube",tt:"tiktok",pin:"pinterest",th:"threads",nl:"newsletter"};
if(_v&&_m[_v])sessionStorage.setItem("ri_von2",_m[_v]);var _s=sessionStorage.getItem("ri_von2");if(_s&&q!=="com")q=_s;
if(localStorage.getItem("ri_intern")==="1")q="eigen";}catch(e){}
fetch("https://haurbpfkfaaehorirzee.supabase.co/rest/v1/rpc/cb_seite_zaehlen",{method:"POST",keepalive:true,headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdXJicGZrZmFhZWhvcmlyemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDY2OTYsImV4cCI6MjA5Nzk4MjY5Nn0.6U0bD0m2kYM2iL0KJ9fbCFvcQMXAglr8GvwmPwyHqyw","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_quelle:q})}).catch(function(){});
}catch(e){}})();
(function(){try{
var w=document.getElementById("rmBox");if(!w)return;
function senden(u,t){return fetch("https://haurbpfkfaaehorirzee.supabase.co/rest/v1/rpc/cb_seite_rueckmeldung",{method:"POST",keepalive:true,headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdXJicGZrZmFhZWhvcmlyemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDY2OTYsImV4cCI6MjA5Nzk4MjY5Nn0.6U0bD0m2kYM2iL0KJ9fbCFvcQMXAglr8GvwmPwyHqyw","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_urteil:u,p_text:t||null})}).catch(function(){})}
function danke(){w.innerHTML='<span class="dank">Merci pour votre retour.</span>'}
function schon(){try{return localStorage.getItem("ri_rm_"+location.pathname)==="1"}catch(e){return false}}
function merken(){try{localStorage.setItem("ri_rm_"+location.pathname,"1")}catch(e){}}
if(schon()){danke();return}
var f=document.getElementById("rmForm"),ta=document.getElementById("rmText"),art="nein";
document.getElementById("rmJa").onclick=function(){senden("ja");merken();danke()};
function auf(a,txt){art=a;f.classList.add("auf");document.getElementById("rmFrage").textContent=txt;ta.focus()}
document.getElementById("rmNein").onclick=function(){auf("nein","Qu’est-ce qui manquait ?")};
document.getElementById("rmMeld").onclick=function(){auf("meldung","Qu’est-ce qui est faux ? (ingrédients, valeurs nutritionnelles, marque …)")};
document.getElementById("rmSend").onclick=function(e){e.preventDefault();senden(art,(ta.value||"").slice(0,500));merken();danke()};
}catch(e){}})();
