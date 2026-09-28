(function(){try{
if(/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent))return;
var r=document.referrer,q="direkt";
if(r){var h="";try{h=new URL(r).hostname}catch(e){}
q=/(^|\.)google\./.test(h)?"google":/bing\./.test(h)?"bing":/duckduckgo|ecosia|yahoo|qwant|startpage|brave/.test(h)?"andere-suche":/root-index\.(de|com)$/.test(h)?"intern":"andere";}
try{if(/(^|[?&])von=com([&#]|$)/.test(location.search))sessionStorage.setItem("ri_von","com");
if(sessionStorage.getItem("ri_von")==="com")q="com";}catch(e){}
fetch("https://haurbpfkfaaehorirzee.supabase.co/rest/v1/rpc/cb_seite_zaehlen",{method:"POST",keepalive:true,headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdXJicGZrZmFhZWhvcmlyemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDY2OTYsImV4cCI6MjA5Nzk4MjY5Nn0.6U0bD0m2kYM2iL0KJ9fbCFvcQMXAglr8GvwmPwyHqyw","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_quelle:q})}).catch(function(){});
}catch(e){}})();
(function(){try{
var w=document.getElementById("rmBox");if(!w)return;
function senden(u,t){return fetch("https://haurbpfkfaaehorirzee.supabase.co/rest/v1/rpc/cb_seite_rueckmeldung",{method:"POST",keepalive:true,headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdXJicGZrZmFhZWhvcmlyemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDY2OTYsImV4cCI6MjA5Nzk4MjY5Nn0.6U0bD0m2kYM2iL0KJ9fbCFvcQMXAglr8GvwmPwyHqyw","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_urteil:u,p_text:t||null})}).catch(function(){})}
function danke(){w.innerHTML='<span class="dank">Thank you for your feedback.</span>'}
function schon(){try{return localStorage.getItem("ri_rm_"+location.pathname)==="1"}catch(e){return false}}
function merken(){try{localStorage.setItem("ri_rm_"+location.pathname,"1")}catch(e){}}
if(schon()){danke();return}
var f=document.getElementById("rmForm"),ta=document.getElementById("rmText"),art="nein";
document.getElementById("rmJa").onclick=function(){senden("ja");merken();danke()};
function auf(a,txt){art=a;f.classList.add("auf");document.getElementById("rmFrage").textContent=txt;ta.focus()}
document.getElementById("rmNein").onclick=function(){auf("nein","What was missing?")};
document.getElementById("rmMeld").onclick=function(){auf("meldung","What is wrong? (ingredients, nutrition, brand …)")};
document.getElementById("rmSend").onclick=function(e){e.preventDefault();senden(art,(ta.value||"").slice(0,500));merken();danke()};
}catch(e){}})();
