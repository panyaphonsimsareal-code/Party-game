/* PARTYGAME GUARDIAN v1.2 — rule-based problem watcher (no AI, no bans).
   What it does: notices when something in the game breaks, and adds 1 to an anonymous public counter
   such as "game cards had a script error". That is all that leaves the phone.
   What it never does: send names, typed text, error messages, links, the tester code, or anything about the player;
   use the camera, microphone or location; block, ban or slow down a player; change how any game plays.
   If anything inside GUARDIAN itself goes wrong, it stays silent and the game carries on.

   Rules (v1):
   R1 script error (window "error" with a JS error)            -> counter  err-<game>-js
   R2 unhandled promise rejection                              -> counter  err-<game>-promise
   R3 one of the game's OWN files failed to load (script / audio / image) -> counter  err-<game>-load
      (files from other websites, e.g. Google sign-in or fonts, are not counted here)
   R4 the page froze for 5 s or more while on screen           -> counter  err-<game>-freeze
      (not counted: the first 3 s after the page comes back on screen, or gaps over 60 s = the phone was asleep)
   R8 online play (the game reports these): could not load the connection system -> err-<game>-netload,
      found the room but the two phones could not connect -> err-<game>-netp2p, connection dropped in a room -> err-<game>-netdrop,
      gave up waiting to connect -> err-<game>-nettime
   R5 the same counter is sent at most once per 30 min per device, and at most 6 counters per day per device
   R6 ignored: browser add-ons, cross-site "Script error." with no detail, ResizeObserver notices,
      fonts, and automated test browsers (navigator.webdriver)
   R9 counters are sent ONLY from the real game website (https://panyaphonsimsareal-code.github.io/Party-game/);
      copies, previews and test pages keep the local list (R7) but send nothing, so test runs never mix into real numbers
   R7 the last 20 problems stay ONLY in this tab's memory, for the "แจ้งปัญหา" email the player can choose to send.
      Only the KIND of problem is kept (e.g. "TypeError line 812", "script file", "netdrop"), never the error's own text,
      so nothing the player typed can end up in the email by accident
*/
(function(){
  "use strict";
  if(window.PartyGuardian) return;
  var CFG={
    on:true,
    countURL:"https://abacus.jasoncameron.dev/hit/khawpun-party-global/",   // the anonymous counter the game already uses
    mail:"partystudio2026@gmail.com",
    ver:"",                         // game version, set by the game
    getGame:function(){ return "menu"; },   // the game tells GUARDIAN which game is open
    freezeMs:5000,
    gapMs:30*60*1000,
    perDay:6,
    send:null                       // tests can replace the sender
  };
  var LOG=[], SEEN={}, KEY="party-guardian";
  var CATS={js:1,promise:1,load:1,freeze:1,netload:1,netp2p:1,netdrop:1,nettime:1};
  function safe(f){ return function(){ try{ return f.apply(this,arguments); }catch(e){} }; }
  function official(){ try{ return location.protocol==="https:"&&location.hostname==="panyaphonsimsareal-code.github.io"&&/^\/Party-game(?:\/|$)/.test(location.pathname); }catch(e){ return false; } }
  function bot(){ try{ return !!navigator.webdriver; }catch(e){ return false; } }
  function game(){ try{ var g=String(CFG.getGame()||"menu").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,16); return g||"menu"; }catch(e){ return "menu"; } }
  function store(){ try{ var s=JSON.parse(localStorage.getItem(KEY)||"{}"); return s&&typeof s==="object"?s:{}; }catch(e){ return {}; } }
  function save(s){ try{ localStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  function today(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  // only the kind of error (TypeError, RangeError…), never its text
  function kind(m){ var k=/\b([A-Z][A-Za-z]*Error)\b/.exec(String(m||"")); return k?k[1]:"Error"; }
  function ignored(msg,src){
    msg=String(msg||""); src=String(src||"");
    if(/^(chrome|moz|safari|safari-web)-extension:/i.test(src)) return true;
    if(/^Script error\.?$/i.test(msg)) return true;
    if(/ResizeObserver loop/i.test(msg)) return true;
    if(/fonts\.(googleapis|gstatic)\.com/i.test(src)) return true;
    return false;
  }
  var report=safe(function(cat,what){
    if(!CFG.on||!CATS[cat]) return;
    var g=game(), name="err-"+g+"-"+cat, now=Date.now();
    LOG.push({t:now,game:g,cat:cat,what:String(what||"").slice(0,40)}); if(LOG.length>20) LOG.shift();
    if(bot()) return;
    if(!CFG.send&&!official()) return;
    if(SEEN[name]&&now-SEEN[name]<CFG.gapMs) return;
    var s=store(); if(s.day!==today()){ s={day:today(),n:0,last:{}}; }
    s.last=s.last||{};
    if(s.last[name]&&now-s.last[name]<CFG.gapMs) return;
    if((s.n||0)>=CFG.perDay) return;
    SEEN[name]=now; s.last[name]=now; s.n=(s.n||0)+1; save(s);
    if(CFG.send){ CFG.send(name); return; }
    try{ fetch(CFG.countURL+name,{cache:"no-store",keepalive:true,credentials:"omit",referrerPolicy:"no-referrer"}).catch(function(){}); }catch(e){}
  });
  // R1 + R3: script errors, and files that failed to load (caught on the way down)
  window.addEventListener("error",safe(function(e){
    var t=e&&e.target;
    if(t&&t!==window&&t.tagName){
      var tag=t.tagName.toLowerCase(), src=t.src||t.href||t.currentSrc||"";
      var own=false; try{ own=new URL(src,location.href).origin===location.origin; }catch(x){}
      if(own&&(tag==="script"||tag==="audio"||tag==="video"||tag==="img"||tag==="source")) report("load",tag+" file");
      return;
    }
    if(ignored(e.message,e.filename)) return;
    report("js",kind(e.error&&e.error.name||e.message)+(e.lineno?" line "+(e.lineno|0):""));
  }),true);
  // R2
  window.addEventListener("unhandledrejection",safe(function(e){
    var r=e&&e.reason, m=r&&(r.message||r)||"rejected";
    if(ignored(m,r&&r.stack)) return;
    report("promise",kind(r&&r.name||m));
  }));
  // R4: a timer that should tick every second; if it comes back 5 s late while the page is on screen, the page froze
  var last=Date.now(), quietTill=0;
  var back=safe(function(){ last=Date.now(); quietTill=last+3000; });   // the phone may pause timers while away: start counting fresh
  window.addEventListener("pageshow",back); window.addEventListener("focus",back); document.addEventListener("resume",back);
  document.addEventListener("visibilitychange",back);
  setInterval(safe(function(){
    var now=Date.now(), late=now-last-1000; last=now;
    if(document.visibilityState!=="visible"||now<quietTill) return;
    if(late>=CFG.freezeMs&&late<=60000) report("freeze","froze "+Math.round(late/1000)+"s");
  }),1000);
  window.PartyGuardian={
    config:safe(function(o){ for(var k in o) if(Object.prototype.hasOwnProperty.call(CFG,k)) CFG[k]=o[k]; }),
    log:function(){ return LOG.slice(); },
    // the game tells GUARDIAN about a problem it noticed itself (online play): only the listed kinds are accepted
    note:safe(function(cat){ if(/^net/.test(cat)) report(cat,cat); }),
    // the "แจ้งปัญหา" email: the player sees it in their mail app and decides whether to send it
    mailto:function(){
      try{
        var ua=navigator.userAgent||"", os=/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":/Windows/i.test(ua)?"Windows":/Mac/i.test(ua)?"Mac":"อื่นๆ";
        var lines=["(เขียนเล่าได้ว่าเกิดอะไรขึ้น)","","---","เวอร์ชัน: "+(CFG.ver||"-"),"เครื่อง: "+os,"เกม: "+game()];
        LOG.slice(-5).forEach(function(x){ lines.push(x.game+" · "+x.cat+" · "+x.what); });
        return "mailto:"+CFG.mail+"?subject="+encodeURIComponent("แจ้งปัญหา PARTYGAME")+"&body="+encodeURIComponent(lines.join("\n"));
      }catch(e){ return "mailto:"+CFG.mail; }
    },
    off:function(){ CFG.on=false; }
  };
})();
