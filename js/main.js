/* ShashiClicks — own code. Motion values from the reference dossier:
   Lenis lerp .09 on GSAP ticker, ease cubic-bezier(.625,.05,0,1),
   journey progress = pow(p,.7) lerped .22, tech scrub .5, loader failsafe 8s,
   court 200vh, tech total 748.78vh, team total 340vh, finale 410vh with −80vh overlap. */
(function(){
"use strict";
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Testimonials: verbatim reviews + real studio films ----------
   Films are the studio's own, from its public video gallery (YouTube):
   newborn c9C2lxa2X_w / PV_qwUB5kUg, maternity uJQTBqkCiWI, events _1tCSMuAeZU. */
const TESTIS = [
 {cls:"a", img:"assets/img/film-newborn-b.jpg", alt:"Still from a ShashiClicks newborn film", name:"Jenny Lakra", role:"Newborn shoot client",
  pull:"All I can say is <b>WOW!</b> …the most beautiful newborn photos I've ever seen.",
  quote:"All I can say is WOW! Shashi is amazing… Neelam is a baby whisperer. She took such great care of our son during the shoot… They are the most beautiful newborn photos I've ever seen. It's 100% worth the investment… I would recommend Shashiclicks to anyone and everyone looking for the BEST NEWBORN photographer!!",
  film:"PV_qwUB5kUg", filmTitle:"Newborn Photography Session by SHASHICLICKS — Shashi Patel", filmKind:"Newborn film"},
 {cls:"b", img:"assets/img/film-maternity.jpg", alt:"Still from a ShashiClicks maternity film", name:"Sampoorna Jagadeesh", role:"Application Analyst at Wells Fargo",
  pull:"Right from my <b>maternity</b> to baby infant shoot. Life time best memories.",
  quote:"Pretty much appreciated your hard work @shashi and Neelam. Right from my maternity to baby infant shoot. Life time best memories 💕",
  film:"uJQTBqkCiWI", filmTitle:"Best Maternity Video Shoot — Radhika & Vivek", filmKind:"Maternity film"},
 {cls:"c", img:"assets/img/film-newborn-a.jpg", alt:"Still from a ShashiClicks newborn film", name:"Jinith Rs", role:"Lead Software Engineer at S&P Global",
  pull:"the photos turned out to be nothing less than <b>magic!!</b>",
  quote:"Shashi and Neelam are awesome people. It was a great experience having them shoot our baby boy.. and the photos turned out to be nothing less than magic!! with a good camera anyone can capture a good image but Shashi knows the right moment to click and the picture just turn out to be awesome!!! Neelam is so easy with the kids and my boy felt so comfortable with both of them. thank you shashiclicks for capturing our moments and making it sweet memories. I would highly recommend them to anyone reading this.",
  film:"c9C2lxa2X_w", filmTitle:"Newborn BabyGirl — SHASHICLICKS, Hyderabad, India", filmKind:"Newborn film"},
 {cls:"d", img:"assets/img/film-events.jpg", alt:"Still from a ShashiClicks birthday film", name:"Kati Kranthi Kiran", role:"Works at Genpact",
  pull:"In fact <b>5 rating is less</b> for this duo of Shashi and wife Neelam.",
  quote:"In fact 5 rating is less for this duo of Shashi and wife Neelam. We have known them for almost 5 years… I would have given 5+ if had have option for it in google. Prices are also reasonable as well. Thank you Shashi and Neelam for your wonderful services and please keep up the good job.",
  film:"_1tCSMuAeZU", filmTitle:"Bharadwaja Birthday Shoot", filmKind:"Events film"}
];
const grid = document.getElementById("testiGrid");
TESTIS.forEach((t,i)=>{
  const b=document.createElement("button"); b.type="button"; b.className="vcard vcard--"+t.cls;
  b.setAttribute("aria-label","Watch a studio film and read the full testimonial from "+t.name);
  b.innerHTML = '<span class="vcard__media" style="display:block"><img src="'+t.img+'" alt="'+t.alt+'" loading="lazy">'
    + '<span class="vcard__hud"><span><span class="rec">●</span> Rec · Cam 0'+(i+1)+'</span><span>00:0'+i+':1'+(i*3)+'</span></span>'
    + '<span class="vcard__play">▶</span>'
    + '<span class="vcard__hud vcard__hud--bot"><span>Studio film</span><span>9:16 · 60fps</span></span></span>'
    + '<span class="vcard__who" style="display:block">'+t.name+'<small>'+t.role+'</small></span>';
  b.addEventListener("click",()=>openLb(t));
  grid.appendChild(b);
  const q=document.createElement("div"); q.className="vquote vquote--"+t.cls; q.innerHTML="“"+t.pull+"”";
  grid.appendChild(q);
});
const lb=document.getElementById("lb"), lbMedia=document.getElementById("lbMedia");
let lenis=null;
function openLb(t){
  document.getElementById("lbQuote").textContent="“"+t.quote+"”";
  document.getElementById("lbWho").textContent=t.name+" — "+t.role;
  document.getElementById("lbFilm").textContent="Studio film — “"+t.filmTitle+"” · from the ShashiClicks video gallery";
  lbMedia.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+t.film+'?autoplay=1&rel=0" title="'+t.filmTitle+'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  lb.classList.add("is-open"); if(lenis)lenis.stop();
  setTimeout(()=>document.getElementById("lbClose").focus(),60);
}
function closeLb(){ lb.classList.remove("is-open"); lbMedia.innerHTML=""; if(lenis)lenis.start(); }
document.getElementById("lbClose").addEventListener("click",closeLb);
lb.addEventListener("click",e=>{ if(e.target===lb) closeLb(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeLb(); });

/* ---------- Loader: progress = real preload of the journey frames ---------- */
const loader=document.getElementById("loader"), lNum=document.getElementById("loaderNum"),
      lPct=document.getElementById("loaderPct"), lBar=document.getElementById("loaderBar"),
      skip=document.getElementById("loaderSkip");
let booted=false;
setTimeout(()=>skip.classList.add("show"), 1200);
function setProgress(p){
  const v=Math.round(p*100);
  lNum.textContent=v; lPct.textContent=v; lBar.style.width=v+"%";
  lNum.style.transform="scale("+(1+0.06*p)+")";
}
function finishLoad(){
  if(booted) return; booted=true; window.__heroBooted=true;
  setProgress(1);
  setTimeout(()=>{ loader.classList.add("done"); document.documentElement.classList.remove("is-intro"); if(lenis)lenis.start(); }, 350);
}
skip.addEventListener("click",finishLoad);
setTimeout(finishLoad, 8000); /* hard failsafe — force-show at 8s, as the reference does */

/* ---------- Journey frames (loader progress + fallback renderer) ---------- */
const FRAMES = ["assets/img/hero.webp","assets/img/j1.webp","assets/img/j2.webp","assets/img/j3.webp","assets/img/j4.webp","assets/img/j5.webp","assets/img/j6.webp","assets/img/j7.webp","assets/img/j8.webp","assets/img/j9.webp"];
const imgs=[]; let loaded=0;
FRAMES.forEach((src,i)=>{ const im=new Image(); im.onload=im.onerror=()=>{ loaded++; setProgress(loaded/FRAMES.length); if(loaded===FRAMES.length) finishLoad(); }; im.src=src; imgs[i]=im; });

/* ---------- Smooth scroll: Lenis lerp .09 driven by GSAP ticker ---------- */
if(!reduced && window.Lenis){
  lenis = new Lenis({ lerp:.09, smoothWheel:true, syncTouch:false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); /* stopped during intro, started by finishLoad */
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener("click",e=>{ const el=document.querySelector(a.getAttribute("href")); if(el){ e.preventDefault(); lenis.scrollTo(el,{duration:1.6, easing:t=>1-Math.pow(1-t,3)}); } });
  });
}

/* ---------- Hero: fit the giant photo-filled line to the stage width (reference text-fit) ---------- */
const h1=document.getElementById("heroH1");
function fitH1(){
  if(!h1) return;
  if(window.innerWidth<=991){ h1.style.fontSize=""; return; }
  /* measure the text itself with a Range — scrollWidth never falls below
     the element's own width and would shrink the line without limit */
  const range=document.createRange(); range.selectNodeContents(h1);
  const max=window.innerWidth-8;
  let s=11.6; h1.style.fontSize=s+"em";
  let guard=40;
  while(range.getBoundingClientRect().width>max && guard-->0){ s-=0.25; h1.style.fontSize=s+"em"; }
}
fitH1();
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>fitH1());

/* ---------- Hero ticker: the studio's own lines, rotating ---------- */
const LINES=["We don't just take pictures.","We create memories.","Memories your family will cherish for generations.","Hyderabad · Since 2014"];
const tickEl=document.getElementById("tickerText"); let tickI=0;
setInterval(()=>{ if(!tickEl) return; tickEl.style.opacity=0;
  setTimeout(()=>{ tickI=(tickI+1)%LINES.length; tickEl.textContent=LINES[tickI]; tickEl.style.opacity=1; },400);
},3600);

/* ---------- Court journey: progress = pow(p,.7) smoothed at lerp .22.
   The WebGL scene itself (Three.js helix + Canon camera GLB) lives in
   js/journey-gl.js (ES module) and sets window.__glReady when live;
   until then this 2D canvas crossfades the frames as the fallback. */
const courtSec=document.getElementById("court"), canvas=document.getElementById("journeyCanvas"),
      courtBig=document.getElementById("courtBig");
let jTarget=0, jCur=-1;
ScrollTrigger.create({ trigger:"#court", start:"top top", end:window.innerWidth<=991?"bottom top":"bottom bottom",
  onUpdate:self=>{ jTarget=Math.pow(self.progress,.7); } });

/* 2D fallback renderer (poster sequence crossfade) — only drawn while the GL scene is not ready */
const ctx2 = canvas.getContext("2d");
function draw2D(f){
  if(!ctx2 || !imgs.length) return;
  const i=Math.min(FRAMES.length-1, Math.max(0, Math.floor(f))), fr=f-i;
  const a=imgs[i], b=imgs[Math.min(FRAMES.length-1,i+1)];
  const drawOne=(im,alpha)=>{ if(!im||!im.complete||!im.naturalWidth) return;
    const s=Math.max(canvas.width/im.naturalWidth, canvas.height/im.naturalHeight);
    const w=im.naturalWidth*s, h=im.naturalHeight*s;
    ctx2.globalAlpha=alpha; ctx2.drawImage(im,(canvas.width-w)/2,(canvas.height-h)/2,w,h); };
  ctx2.globalAlpha=1; ctx2.fillStyle="#070503"; ctx2.fillRect(0,0,canvas.width,canvas.height);
  drawOne(a,1); if(fr>0.01&&b!==a) drawOne(b,fr);
  ctx2.globalAlpha=1;
}
function sizeFallback(){
  const r=canvas.parentElement.getBoundingClientRect();
  canvas.width=r.width; canvas.height=r.height; draw2D(jCur<0?0:jCur*(FRAMES.length-1));
}
window.addEventListener("resize",sizeFallback); sizeFallback();

(function loop(){
  const want=jTarget;
  if(jCur<0) jCur=want;
  jCur += (want-jCur)*.22; if(Math.abs(want-jCur)<.0005) jCur=want;
  window.__jCur = jCur<0?0:jCur; /* read by js/journey-gl.js */
  const rect=courtSec.getBoundingClientRect();
  const inView = rect.bottom>0 && rect.top<innerHeight;
  window.__courtInView = inView;
  if(inView){
    courtBig.style.transform="translateX("+((0.5-jCur)*-7).toFixed(2)+"vw)";
    if(window.__glReady){ if(canvas.style.display!=="none") canvas.style.display="none"; }
    else draw2D(jCur*(FRAMES.length-1));
  }
  requestAnimationFrame(loop);
})();

/* ---------- Tech: pinned stage — headline moment, then cards glide.
   Desktop choreography rests TWO cards on stage together, staggered
   (left higher, right lower), exactly as the reference: pair in → rest →
   pair out while the next pair enters. Phones keep the one-card glide. */
const techPanels=gsap.utils.toArray(".tech__panel");
const techCards=techPanels.map(p=>p.querySelector(".tcard2"));
const techTl=gsap.timeline({ scrollTrigger:{ trigger:"#techPin", start:"top top",
  end:()=>"+="+Math.round(window.innerHeight*(window.innerWidth<=991?4.126:6.4878)), pin:true, scrub:.5, invalidateOnRefresh:true } });
techTl.fromTo("#techIntro",{x:"52vw"},{x:"0vw",duration:.7,ease:"none"},0);
techTl.to("#techIntro",{x:"-52vw",autoAlpha:0,duration:.7,ease:"none"},1.05);
techTl.to("#techMeta",{autoAlpha:0,duration:.3,ease:"none"},1.05);
if(window.innerWidth<=991){
  techPanels.forEach((p,i)=>{
    const t=1.55+i*1.35;
    techTl.fromTo(p,{x:"58vw"},{x:"0vw",duration:.55,ease:"none"},t);
    techTl.fromTo(p,{autoAlpha:0},{autoAlpha:1,duration:.16,ease:"none"},t);
    techTl.to(p,{x:"-58vw",duration:.5,ease:"none"},t+0.8);
    techTl.to(p,{autoAlpha:0,duration:.22,ease:"none"},t+1.08);
  });
}else{
  const slotX=()=>{ const w=techCards[0].offsetWidth||528; return w/2+38; };
  const slotY=[-52,52];
  techCards.forEach((c,i)=>{ gsap.set(c,{x:"76vw",autoAlpha:0}); gsap.set(techPanels[i],{autoAlpha:1,visibility:"visible"}); });
  const pairIn=(idx,t)=>{
    idx.forEach((ci,k)=>{
      techTl.to(techCards[ci],{x:()=> (k===0?-slotX():slotX()), y:slotY[k], autoAlpha:1, duration:.6, ease:"none"},t);
    });
  };
  const pairOut=(idx,t)=>{
    idx.forEach(ci=>{ techTl.to(techCards[ci],{x:"-76vw", autoAlpha:0, duration:.55, ease:"none"},t); });
  };
  pairIn([0,1],1.5);          /* Maternity + Newborn rest two-up */
  pairOut([0,1],3.05);
  pairIn([2,3],3.2);          /* Kids + Wedding rest two-up to the end */
  techTl.to({},{duration:.9},4.0); /* final rest hold */
}
/* transition rows at the tech → names boundary */
const trx=document.getElementById("trx");
for(let i=0;i<14;i++) trx.appendChild(document.createElement("i"));
ScrollTrigger.create({ trigger:"#names", start:"top 92%", once:true,
  onEnter:()=>{ gsap.fromTo("#trx i",{scaleX:0,transformOrigin:i=>i%2?"right":"left"},{scaleX:1,duration:.45,stagger:.02,ease:"power1.inOut",yoyo:true,repeat:1}); } });

/* ---------- Names: pinned full-bleed stage (total 340vh, as the reference) ---------- */
gsap.timeline({ scrollTrigger:{ trigger:"#names", start:"top top", end:"+=240%", pin:true, scrub:.5, invalidateOnRefresh:true, anticipatePin:1 } })
  .fromTo("#namesPhoto",{scale:1.15},{scale:1.3,ease:"none",duration:1},0)
  .fromTo(".names__big",{x:"-3vw",opacity:.4},{x:"0vw",opacity:1,ease:"none",duration:.4},0)
  .fromTo(".names__panel",{y:46,autoAlpha:0},{y:0,autoAlpha:1,ease:"power1.out",duration:.25},0.44)
  .fromTo(".names__vert",{opacity:0},{opacity:1,ease:"none",duration:.3},0.2);

/* ---------- Finale: sticky scrub spread across the whole 410vh —
   kicker/headline settle first, frosted frames float in slowly,
   the single CTA lands only near the end (reference pacing). ---------- */
gsap.fromTo(".finale__stage",{autoAlpha:0},{autoAlpha:1,ease:"none",
  scrollTrigger:{trigger:".finale__stage",start:"top bottom",end:"top top",scrub:.4}});
const finTl=gsap.timeline({ scrollTrigger:{ trigger:".finale__stage", start:"top bottom", end:"+=2600", scrub:.6 } });
finTl.fromTo([".finale__kick",".finale__big"],{y:-34,opacity:0},{y:0,opacity:1,stagger:.15,duration:.5,ease:"none"},0);
finTl.fromTo(".pouch",{y:700,rotation:0},{y:0,rotation:0,stagger:.25,duration:1.2,ease:"none"},1.7);
finTl.fromTo(".finale__cta",{opacity:0,y:34},{opacity:1,y:0,duration:.45,ease:"none"},2.5);
finTl.to({},{duration:.35},2.95);

/* ---------- Names tool: panel starts as heading + copy + CTA, as the reference;
   the input appears only after the CTA. Initials are drawn vertically
   into the frame and shown large at the subject zone. ---------- */
const nInput=document.getElementById("nameInput"), nMono=document.getElementById("namesMono"),
      nVert=document.getElementById("namesVert"), nPanel=document.getElementById("namesPanel"),
      nCan=document.getElementById("namesCanvas"), nCtx=nCan.getContext("2d");
document.getElementById("namesCta").addEventListener("click",()=>{
  nPanel.classList.add("open"); setTimeout(()=>nInput.focus(),60);
});
function initialsOf(name){
  const parts=(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "X";
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function drawMono(){
  const raw=nInput.value.trim();
  const ini=initialsOf(raw||"Shashi Patel");
  nMono.textContent=ini;
  nVert.textContent=ini;
  /* one vertical mark only (the HTML type at the subject zone), as in the
     reference — the canvas carries no second copy */
  const W=nCan.width, H=nCan.height; if(!W||!H) return;
  nCtx.clearRect(0,0,W,H);
}
function fitNamesCanvas(){
  const st=nCan.parentElement, w=st.clientWidth, h=st.clientHeight;
  if(w&&h&&(nCan.width!==w||nCan.height!==h)){ nCan.width=w; nCan.height=h; }
  drawMono();
}
nInput.addEventListener("input",drawMono);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitNamesCanvas);
window.addEventListener("resize",()=>{ fitNamesCanvas(); fitH1(); });
fitNamesCanvas();

/* ---------- Shot-clock HUD: 24 → 0 across the page, 7 stops ---------- */
const hudNum=document.getElementById("hudNum"), hudLabel=document.getElementById("hudLabel"),
      hudFrac=document.getElementById("hudFrac"), hudTicks=document.getElementById("hudTicks");
const TICKS=40;
for(let i=0;i<TICKS;i++) hudTicks.appendChild(document.createElement("i"));
const tickEls=hudTicks.children;
const STOPS=[["#hero","The Studio","01 / 07"],["#court","The Journey","02 / 07"],["#tech","Specialities","03 / 07"],
  ["#names","Your Names","04 / 07"],["#testi","Word of Mouth","05 / 07"],["#finale","Get Ready","06 / 07"],
  ["#founders","Final Frame","07 / 07"],["#footer","Final Frame","07 / 07"]];
const hudEl=document.getElementById("hud");
const stopEls=STOPS.map(([sel,label,frac])=>({el:document.querySelector(sel),label,frac}));
function hudUpdate(){
  const max=document.documentElement.scrollHeight-innerHeight;
  const p=max>0? Math.min(1, Math.max(0, (window.scrollY||0)/max)) : 0;
  const n=24*(1-p);
  hudNum.textContent = n>=9.95 ? String(Math.round(n)) : n.toFixed(1);
  const filled=Math.round(p*TICKS);
  for(let i=0;i<TICKS;i++) tickEls[i].className = i<filled ? "on" : "";
  const probe=(window.scrollY||0)+innerHeight*0.45;
  let cur=stopEls[0];
  for(const s of stopEls){ if(!s.el) continue;
    const host=s.el.closest(".pin-spacer")||s.el;
    const top=host.getBoundingClientRect().top+(window.scrollY||0);
    if(probe>=top) cur=s;
  }
  if(cur && hudLabel.textContent!==cur.label){
    hudLabel.textContent=cur.label; hudFrac.textContent=cur.frac;
    hudEl.classList.toggle("hud--light", cur.label==="Get Ready");
  }
  /* the hero carries its own reticle in this corner (reference grammar) —
     the shot-clock HUD only appears from the journey on */
  const onHero = cur && cur.label==="The Studio";
  hudEl.style.opacity = onHero ? "0" : "";
  hudEl.style.pointerEvents = onHero ? "none" : "";
}
window.addEventListener("scroll",hudUpdate,{passive:true});
if(lenis) lenis.on("scroll",hudUpdate);
hudUpdate();

/* ---------- Reveals ---------- */
gsap.utils.toArray(".dusk h2, .founder").forEach(el=>{
  gsap.fromTo(el,{y:44,opacity:0},{y:0,opacity:1,duration:.6,ease:"power1.out",
    scrollTrigger:{trigger:el,start:"top 92%",once:true}});
});
window.addEventListener("load",()=>ScrollTrigger.refresh());
})();
