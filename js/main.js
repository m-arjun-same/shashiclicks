/* ShashiClicks — own code. Motion values from the reference dossier:
   Lenis lerp .09 on GSAP ticker, ease cubic-bezier(.625,.05,0,1),
   journey frame = pow(p,.7) lerped .22, tech scrub .5, loader failsafe 8s. */
(function(){
"use strict";
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Testimonials (verbatim, from the studio's own site) ---------- */
const TESTIS = [
 {img:"assets/img/t-jinith.webp", alt:"Portrait from a ShashiClicks baby shoot — Jinith's family session", name:"Jinith Rs", role:"Lead Software Engineer at S&P Global",
  quote:"Shashi and Neelam are awesome people. It was a great experience having them shoot our baby boy.. and the photos turned out to be nothing less than magic!! with a good camera anyone can capture a good image but Shashi knows the right moment to click and the picture just turn out to be awesome!!! Neelam is so easy with the kids and my boy felt so comfortable with both of them. thank you shashiclicks for capturing our moments and making it sweet memories. I would highly recommend them to anyone reading this."},
 {img:"assets/img/t-kati.webp", alt:"Family portrait by ShashiClicks — Kati Kranthi Kiran's session", name:"Kati Kranthi Kiran", role:"Works at Genpact",
  quote:"In fact 5 rating is less for this duo of Shashi and wife Neelam. We have known them for almost 5 years… I would have given 5+ if had have option for it in google. Prices are also reasonable as well. Thank you Shashi and Neelam for your wonderful services and please keep up the good job."},
 {img:"assets/img/t-jenny.webp", alt:"Newborn photograph by ShashiClicks", name:"Jenny Lakra", role:"Newborn shoot client",
  quote:"All I can say is WOW! Shashi is amazing… Neelam is a baby whisperer. She took such great care of our son during the shoot… They are the most beautiful newborn photos I've ever seen. It's 100% worth the investment… I would recommend Shashiclicks to anyone and everyone looking for the BEST NEWBORN photographer!!"},
 {img:"assets/img/t-sampoorna.webp", alt:"Portrait of Sampoorna Jagadeesh, maternity and infant shoot client", name:"Sampoorna Jagadeesh", role:"Application Analyst at Wells Fargo",
  quote:"Pretty much appreciated your hard work @shashi and Neelam. Right from my maternity to baby infant shoot. Life time best memories 💕"}
];
const grid = document.getElementById("testiGrid");
TESTIS.forEach((t,i)=>{
  const b=document.createElement("button"); b.type="button"; b.className="tcard";
  b.setAttribute("aria-label","Read the full testimonial from "+t.name);
  b.innerHTML = '<img src="'+t.img+'" alt="'+t.alt+'" loading="lazy">'
    + '<span class="tcard__hud"><span><span class="rec">●</span> REC · CAM 0'+(i+1)+'</span><span>CLIENT STORY</span></span>'
    + '<span class="tcard__body" style="display:block"><blockquote>“'+t.quote.split(" ").slice(0,26).join(" ")+'… ”</blockquote>'
    + '<span class="tcard__who" style="display:block">'+t.name+'<small>'+t.role+'</small></span></span>';
  b.addEventListener("click",()=>openLb(t));
  grid.appendChild(b);
});
const lb=document.getElementById("lb");
let lenis=null;
function openLb(t){
  document.getElementById("lbQuote").textContent="“"+t.quote+"”";
  document.getElementById("lbWho").textContent=t.name+" — "+t.role;
  lb.classList.add("is-open"); if(lenis)lenis.stop();
  setTimeout(()=>document.getElementById("lbClose").focus(),60);
}
function closeLb(){ lb.classList.remove("is-open"); if(lenis)lenis.start(); }
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

/* ---------- Journey frames ---------- */
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

/* ---------- Court journey: scrubbed frame sequence on canvas ---------- */
const canvas=document.getElementById("journeyCanvas"), ctx=canvas.getContext("2d");
const frameNo=document.getElementById("frameNo");
let target=0, current=-1;
function sizeCanvas(){ const r=canvas.parentElement.getBoundingClientRect(); canvas.width=r.width; canvas.height=r.height; draw(current<0?0:current); }
function draw(f){
  if(!imgs.length) return;
  const i=Math.min(FRAMES.length-1, Math.max(0, Math.floor(f))), fr=f-i;
  const a=imgs[i], b=imgs[Math.min(FRAMES.length-1,i+1)];
  const drawOne=(im,alpha)=>{ if(!im||!im.complete||!im.naturalWidth) return;
    const s=Math.max(canvas.width/im.naturalWidth, canvas.height/im.naturalHeight);
    const w=im.naturalWidth*s, h=im.naturalHeight*s;
    ctx.globalAlpha=alpha; ctx.drawImage(im,(canvas.width-w)/2,(canvas.height-h)/2,w,h); };
  ctx.globalAlpha=1; ctx.fillStyle="#070503"; ctx.fillRect(0,0,canvas.width,canvas.height);
  drawOne(a,1); if(fr>0.01&&b!==a) drawOne(b,fr);
  ctx.globalAlpha=1;
  frameNo.textContent=String(i+1).padStart(2,"0");
}
ScrollTrigger.create({ trigger:"#court", start:"top top", end:"bottom bottom", scrub:.5,
  onUpdate:self=>{ target=Math.pow(self.progress,.7)*(FRAMES.length-1); } });
(function loop(){ const want=target; if(current<0) current=want;
  current += (want-current)*.22; if(Math.abs(want-current)<.001) current=want;
  draw(current); requestAnimationFrame(loop); })();
window.addEventListener("resize", sizeCanvas); sizeCanvas();

/* ---------- Tech: pinned wipe through 4 panels, scrub .5 ---------- */
const panels=gsap.utils.toArray(".tech__panel");
panels.forEach((p,i)=>{ if(i>0) gsap.set(p,{clipPath:"inset(0 0 0 100%)"}); });
const techTl=gsap.timeline({ scrollTrigger:{ trigger:"#techPin", start:"top top", end:"+=610%", pin:true, scrub:.5, invalidateOnRefresh:true } });
panels.forEach((p,i)=>{ if(i===0) return;
  techTl.to(p,{clipPath:"inset(0 0 0 0%)", ease:"none", duration:1}, i-0.0);
  techTl.fromTo(p.querySelector(".tech__info"),{y:60,opacity:0},{y:0,opacity:1,ease:"power1.out",duration:.35}, i-0.0);
});
/* transition rows at the tech boundary */
const trx=document.getElementById("trx");
for(let i=0;i<14;i++) trx.appendChild(document.createElement("i"));
ScrollTrigger.create({ trigger:"#names", start:"top 85%", once:true,
  onEnter:()=>{ gsap.fromTo("#trx i",{scaleX:0,transformOrigin:i=>i%2?"right":"left"},{scaleX:1,duration:.45,stagger:.02,ease:"power1.inOut",yoyo:true,repeat:1}); } });

/* ---------- Names scene: pinned like the reference team scene ---------- */
ScrollTrigger.create({ trigger:"#names", start:"top top", end:"+=200%", pin:true, anticipatePin:1 });

/* ---------- Finale: sticky scrub reveals ---------- */
gsap.fromTo(".finale__cards .fcard",{y:90,opacity:0},{y:0,opacity:1,stagger:.2,ease:"none",
  scrollTrigger:{trigger:"#finale",start:"top top",end:"+=140%",scrub:.6}});
gsap.fromTo(".finale__cta",{opacity:0},{opacity:1,ease:"none",
  scrollTrigger:{trigger:"#finale",start:"45% top",end:"+=60%",scrub:.6}});

/* ---------- Names tool: initials composited on the photo (canvas) ---------- */
const nInput=document.getElementById("nameInput"), nMono=document.getElementById("namesMono"),
      nCan=document.getElementById("namesCanvas"), nCtx=nCan.getContext("2d");
function initialsOf(name){
  const parts=(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "X";
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function drawMono(){
  const ini=initialsOf(nInput.value||"Shashi Patel");
  nMono.textContent=ini;
  const W=nCan.width, H=nCan.height; if(!W||!H) return;
  nCtx.clearRect(0,0,W,H);
  const cx=W*0.5, cy=H*0.74, r=Math.round(H*0.155);
  nCtx.beginPath(); nCtx.arc(cx,cy,r,0,Math.PI*2);
  nCtx.fillStyle="rgba(13,10,7,.72)"; nCtx.fill();
  nCtx.lineWidth=3; nCtx.strokeStyle="#C9A227"; nCtx.stroke();
  nCtx.beginPath(); nCtx.arc(cx,cy,r-9,0,Math.PI*2); nCtx.lineWidth=1; nCtx.stroke();
  nCtx.fillStyle="#EDE4D2"; nCtx.font="900 "+Math.round(r*0.98)+"px 'FK Screamer', Impact, sans-serif";
  nCtx.textAlign="center"; nCtx.textBaseline="middle"; nCtx.fillText(ini,cx,cy+3);
  nCtx.font=Math.round(H*0.032)+"px Caveat, cursive"; nCtx.fillStyle="#C9A227";
  nCtx.fillText("framed by ShashiClicks", cx, cy+r+Math.round(H*0.045));
}
function fitNamesCanvas(){
  const st=nCan.parentElement, w=st.clientWidth, h=st.clientHeight;
  if(w&&h&&(nCan.width!==w||nCan.height!==h)){ nCan.width=w; nCan.height=h; }
  drawMono();
}
nInput.addEventListener("input",drawMono);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitNamesCanvas);
window.addEventListener("resize",fitNamesCanvas);
fitNamesCanvas();

/* ---------- Reveals ---------- */
gsap.utils.toArray(".tech__head, .names h2, .testi h2, .dusk h2").forEach(el=>{
  gsap.fromTo(el,{y:50,opacity:0},{y:0,opacity:1,duration:.6,ease:"power1.out",
    scrollTrigger:{trigger:el,start:"top 85%",once:true}});
});
window.addEventListener("load",()=>ScrollTrigger.refresh());
})();
