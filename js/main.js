/* ShashiClicks — own code. All motion values from CODEBASE-SPEC.md
   (Annex B): Lenis lerp .09 driven by GSAP ticker, master ease
   cubic-bezier(.625,.05,0,1), loader from asset progress, wt() reveal. */
(function () {
"use strict";
gsap.registerPlugin(ScrollTrigger);
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const remap = (v, a, b) => clamp01((v - a) / (b - a));
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
const MOBILE = () => innerWidth <= 991.98;
const sf = () => parseFloat(getComputedStyle(document.body).fontSize) || 16;
const CHARS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>[]*+=-";
function scrambleText(el, txt, dur, done) {
  if (!el) return;
  if (RM) { el.textContent = txt; done && done(); return; }
  const t0 = performance.now(); let last = 0;
  (function fr(now) {
    const d = Math.min(1, (now - t0) / (dur * 1000));
    if (now - last > 33) {
      last = now;
      const e = 1 - Math.pow(1 - d, 2), n = Math.floor(e * txt.length);
      let s = txt.slice(0, n);
      for (let i = n; i < txt.length; i++) s += txt[i] === " " ? " " : CHARS[(Math.random() * CHARS.length) | 0];
      el.textContent = s;
    }
    if (d < 1) requestAnimationFrame(fr); else { el.textContent = txt; done && done(); }
  })(t0);
}

/* ---------------- Lenis on the GSAP ticker ---------------- */
const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, autoRaf: false });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
window.__lenis = lenis;

/* ---------------- data-fill headline meters ---------------- */
function splitSeg(seg) {
  if (seg._cf) return seg._cf;
  const line = document.createElement("span"); line.className = "cf-line";
  const inner = document.createElement("span"); inner.setAttribute("data-fill-text", "");
  while (seg.firstChild) inner.appendChild(seg.firstChild);
  line.appendChild(inner); seg.appendChild(line);
  return (seg._cf = line);
}
function playColorFill(E, opts) {
  opts = opts || {};
  if (!E) return null;
  let segs = $$(".cf-seg", E);
  if (!segs.length && E.textContent.trim()) segs = [E];
  segs.forEach(splitSeg);
  if (RM) { segs.forEach(s => s.style.setProperty("--p", 100)); return null; }
  const tl = gsap.timeline({ paused: true });
  segs.forEach((s, i) => {
    const o = { p: 0 };
    tl.to(o, { p: 100, duration: parseFloat(E.dataset.fillDur) || opts.dur || 1.4, ease: "power1.inOut",
      onUpdate: () => s.style.setProperty("--p", o.p) },
      (opts.delay || 0) + i * (opts.stagger != null ? opts.stagger : 0.12));
  });
  if (opts.manual || opts.noST) return tl;
  const trig = E.dataset.fillTrigger ? $(E.dataset.fillTrigger) : E;
  ScrollTrigger.create({ trigger: trig || E, start: E.dataset.fillStart || "top 75%", once: true, onEnter: () => tl.play() });
  return tl;
}
$$("[data-fill]").forEach(E => {
  if (E.closest("#hero") || E.hasAttribute("data-fill-manual")) return;
  playColorFill(E);
});

/* ---------------- Hero prep: word split, light copies, ghost ---------------- */
const heroEl = $("#hero");
const giantLine = $(".hero__h1-line--giant", heroEl);
const giantSeg = $(".cf-seg", giantLine);
let ghostSeg = null, h1FillTl = null, ghostFillTl = null, tagFillTl = null;
(function heroPrep() {
  if (!giantSeg) return;
  const txt = giantSeg.textContent.trim().replace(/\s+/g, " ");
  const cut = txt.lastIndexOf(" ");
  const pre = txt.slice(0, cut), last = txt.slice(cut + 1);
  giantSeg.innerHTML = '<span class="hero__h1-word hero__h1-word--pre">' + pre + '</span> <span class="hero__h1-word hero__h1-word--last">' + last + "</span>";
  ["ray", "sweep"].forEach(kind => {
    const s = document.createElement("span");
    s.className = "hero__h1-light hero__h1-light--" + kind;
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = giantSeg.innerHTML;
    giantSeg.appendChild(s);
  });
  const ghost = document.createElement("div");
  ghost.className = "hero__h1-ghost-line";
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = '<span class="cf-seg"><span class="hero__h1-word hero__h1-word--pre">' + pre + '</span> <span class="hero__h1-word hero__h1-word--last">' + last + "</span></span>";
  $(".hero__copy", heroEl).appendChild(ghost);
  ghostSeg = $(".cf-seg", ghost);
  const tag = $(".hero__tagline", heroEl);
  if (tag) { tag.style.setProperty("--final", "#FFBC84"); tag.style.setProperty("--unread", "rgba(255,188,132,0)"); tag.style.setProperty("--edge", "#FFBC84"); }
})();
function heroLayout() {
  if (!giantSeg || MOBILE()) return;
  const hero = heroEl, prevSize = hero.style.getPropertyValue("--h1-size");
  hero.style.removeProperty("--h1-size");
  const seg = giantSeg;
  const base = parseFloat(getComputedStyle(giantLine).fontSize);
  const segW = seg.getBoundingClientRect().width;
  if (!segW) return;
  const availW = innerWidth - sf() * 6;
  const size = Math.min(base * (availW / segW), innerHeight * 0.24);
  hero.style.setProperty("--h1-size", size.toFixed(1) + "px");
}

/* ---------------- Loader: asset progress + giant number ---------------- */
const loaderEl = $("#loader"), numSvg = $("#loaderNumSvg"), numG = $("#loaderNumG");
const pctEl = $(".loader__pct", loaderEl), barFill = $(".loader__bar i", loaderEl), skipBtn = $("#skip");
const blocksWrap = $(".loader__blocks", loaderEl);
let numDigits = [];
(function buildLoader() {
  if (numSvg && numG) {
    for (let i = 0; i < 3; i++) {
      const tEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tEl.setAttribute("class", "loader-num__digit");
      numG.appendChild(tEl); numDigits.push(tEl);
    }
  }
  if (blocksWrap) {
    const cols = 7, rows = 5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const b = document.createElement("div");
      b.className = "loader__block";
      b.style.left = (c * 100 / cols) + "%"; b.style.top = (r * 100 / rows) + "%";
      b.style.width = (100 / cols + 0.2) + "%"; b.style.height = (100 / rows + 0.2) + "%";
      b.dataset.dir = (r + c) % 2 ? "1" : "-1";
      blocksWrap.appendChild(b);
    }
  }
})();
const numCtx = document.createElement("canvas").getContext("2d");
let numGeom = { F: 100, slot: 60, x0: 0, y0: 0, ox: 0, oy: 0 };
function numLayout() {
  if (!numDigits.length) return;
  numCtx.font = '900 200px "FK Screamer"';
  const adv = numCtx.measureText("0").width || 100;
  const M = adv / 200 * 1.04;
  const W = innerWidth, H = innerHeight, portrait = H > W;
  const F = Math.min(H * (portrait ? 0.42 : 0.7), W * 0.94 / (3 * M)) * 1.15;
  numGeom = { F, slot: F * M, x0: W * 0.60, y0: H * 0.62 };
  numGeom.ox = numGeom.x0 + numGeom.slot; numGeom.oy = numGeom.y0 - F * 0.35;
  numDigits.forEach((d, i) => {
    d.setAttribute("font-size", F.toFixed(1));
    d.setAttribute("x", (numGeom.x0 + i * numGeom.slot * 0.98).toFixed(1));
    d.setAttribute("y", numGeom.y0.toFixed(1));
  });
}
let lastShownInt = -1;
function numRender(v) {
  const n = Math.floor(v);
  if (n === lastShownInt || !numDigits.length) return;
  lastShownInt = n;
  const s = v >= 100 ? "100" : " " + String(n).padStart(2, "0");
  numDigits.forEach((d, i) => d.textContent = s[i] === " " ? "" : s[i]);
  const sc = 1 + 0.06 * Math.min(1, v / 100);
  numG.setAttribute("transform", "translate(" + numGeom.ox + " " + numGeom.oy + ") scale(" + sc + ") translate(" + (-numGeom.ox) + " " + (-numGeom.oy) + ")");
  if (pctEl) pctEl.textContent = String(n).padStart(2, "0");
  if (barFill) barFill.style.width = v + "%";
}
let navType = "navigate";
try { const nav = performance.getEntriesByType("navigation")[0]; if (nav) navType = nav.type; } catch (e) {}
let connSlow = false;
try { const c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ""))) connSlow = true; } catch (e) {}
const instantIntro = RM || connSlow || navType === "back_forward" ||
  sessionStorage.getItem("shashi-intro-seen") === "1" || sessionStorage.getItem("pt-nav") === "1";
sessionStorage.removeItem("pt-nav");

let loadTarget = 0, loadShown = 0, loadDone = false, revealStarted = false;
const loadStart = performance.now();
(function trackAssets() {
  const jobs = [];
  const imgJob = src => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = src; });
  jobs.push(imgJob("assets/img/hero.webp"), imgJob("assets/img/hero-cutout.png"));
  if (document.fonts && document.fonts.load) {
    jobs.push(document.fonts.load('900 100px "FK Screamer"').catch(() => {}));
    jobs.push(document.fonts.load("400 16px Geist").catch(() => {}));
    jobs.push(document.fonts.load('500 12px "Geist Mono"').catch(() => {}));
    jobs.push(document.fonts.load("550 28px Caveat").catch(() => {}));
  }
  let doneCount = 0;
  jobs.forEach(p => Promise.resolve(p).then(() => { doneCount++; loadTarget = doneCount / jobs.length * 100; }));
  if (!jobs.length) loadTarget = 100;
})();
function finishLoad() {
  if (loadDone) return;
  loadDone = true;
  numRender(100);
  wt(false);
}
function skipIntro() {
  if (revealStarted) return;
  loadTarget = 100; loadShown = 100;
  finishLoad();
}
if (skipBtn) {
  setTimeout(() => skipBtn.classList.add("is-on"), 1000);
  skipBtn.addEventListener("click", skipIntro);
}
addEventListener("keydown", e => { if (!loadDone && (e.key === "Escape" || e.key === "Enter")) skipIntro(); });
addEventListener("wheel", () => { if (!loadDone && performance.now() - loadStart > 400) skipIntro(); }, { passive: true });
addEventListener("touchmove", () => { if (!loadDone) skipIntro(); }, { passive: true });
setTimeout(() => { if (!loadDone) skipIntro(); }, 12000);
gsap.ticker.add(() => {
  if (loadDone) return;
  const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60);
  const step = Math.min(loadTarget - loadShown, dt * 200); // catch-up cap 2x-order chase
  loadShown += Math.max(step, loadTarget > loadShown ? dt * 24 : 0);
  if (loadTarget >= 100 && loadShown > 99.4 && performance.now() - loadStart > 500) loadShown = 100;
  numRender(loadShown);
  if (loadShown >= 100) finishLoad();
});

/* ---------------- wt(): the reveal timeline ---------------- */
function setFinalStates() {
  $$("#hero [data-fill]").forEach(E => $$(".cf-seg", E).forEach(s => { splitSeg(s); s.style.setProperty("--p", 100); }));
  if (ghostSeg) { splitSeg(ghostSeg); ghostSeg.style.setProperty("--p", 100); }
  gsap.set(giantLine, { opacity: 1 });
  gsap.set(".hero__h1-line--giant > span", { opacity: 1 });
  gsap.set(".hero__h1-ghost-line", { opacity: 1 });
  gsap.set(".hero__tagline > span", { opacity: 1, y: 0 });
  gsap.set([".hero__para", ".hero__cta-row"], { opacity: 1, y: 0 });
  gsap.set(".hero__prod-card", { opacity: 1 });
  const learn = $(".hero__learn", heroEl); if (learn) learn.classList.add("is-on");
  heroEl.style.setProperty("--h1-ray-o", 1);
}
function wt(instant) {
  if (revealStarted) return;
  revealStarted = true;
  sessionStorage.setItem("shashi-intro-seen", "1");
  document.documentElement.classList.remove("is-prepaint");
  ScrollTrigger.refresh();
  window.__shashiRevealed = true;
  dispatchEvent(new CustomEvent("shashi-reveal"));
  if (instant) {
    if (loaderEl) loaderEl.style.display = "none";
    const ln = $(".loader-num"); if (ln) ln.style.display = "none";
    document.documentElement.classList.remove("is-intro");
    lenis.start();
    setFinalStates();
    startSlogan();
    return;
  }
  lenis.stop();
  h1FillTl = playColorFill($(".hero__h1", heroEl), { manual: true, dur: 2.6 });
  ghostFillTl = ghostSeg ? playColorFill(ghostSeg.closest(".hero__h1-ghost-line"), { manual: true, dur: 2.6 }) : null;
  tagFillTl = playColorFill($(".hero__tagline", heroEl), { manual: true, dur: 1.56 });
  const blocks = $$(".loader__block", blocksWrap);
  const tl = gsap.timeline({ defaults: { ease: "power2.inOut" }, onComplete: () => {
    if (loaderEl) loaderEl.style.display = "none";
    const ln = $(".loader-num"); if (ln) ln.style.display = "none";
    lenis.start();
  }});
  tl.to(loaderEl, { opacity: 0, duration: 0.8, ease: "power2.inOut" }, 0);
  blocks.forEach((b, i) => {
    tl.to(b, { yPercent: parseInt(b.dataset.dir, 10) * 118, duration: 0.9, ease: "power3.inOut" }, (i % 7) * 0.03 + Math.floor(i / 7) * 0.02);
  });
  // giant number handoff zoom, 1.1s power3.in, fade at .98
  const p = numGeom.ox, W = innerWidth;
  const A = 2 * Math.max(p, W - p) / Math.max(numGeom.slot, 1) * 1.2;
  const numObj = { s: 1 + 0.06 };
  tl.to(numObj, { s: A, duration: 1.1, ease: "power3.in", onUpdate: () => {
    numG.setAttribute("transform", "translate(" + p + " " + numGeom.oy + ") scale(" + numObj.s + ") translate(" + (-p) + " " + (-numGeom.oy) + ")");
  } }, 0);
  tl.to(".loader-num", { opacity: 0, duration: 0.12 }, 1.02);
  tl.add(() => {
    document.documentElement.classList.remove("is-intro");
    gsap.set(".hero__h1-line--giant > span", { opacity: 1 });
    gsap.set(".hero__h1-ghost-line", { opacity: 1 });
    if (h1FillTl) h1FillTl.play();
    if (ghostFillTl) ghostFillTl.play();
    if (tagFillTl) tagFillTl.play();
  }, 0.2);
  tl.fromTo(".hero__tagline > span", { y: "0.9em", opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.06 }, 0.4);
  const rayO = { v: 0 };
  tl.to(rayO, { v: 1, duration: 1.2, ease: "power1.inOut", onUpdate: () => heroEl.style.setProperty("--h1-ray-o", rayO.v) }, 0.9);
  tl.fromTo(".hero__para", { y: "0.875em", opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 1.76);
  tl.fromTo(".hero__cta-row", { y: "0.875em", opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 1.94);
  tl.fromTo(".hero__prod-card", { opacity: 0, y: "1em" }, { opacity: 1, y: 0, duration: 0.7 }, 2.12);
  tl.add(() => startSlogan(), 2.3);
  tl.add(() => { const l = $(".hero__learn", heroEl); if (l) l.classList.add("is-on"); }, 2.48);
}
if (instantIntro) {
  loadDone = true;
  wt(true);
} else {
  numLayout();
  numRender(0);
}

/* ---------------- Hero scene boot + DOM parallax ---------------- */
let sloganTimer = null;
function startSlogan() {
  const items = $$(".hero__slogan-item", heroEl);
  if (!items.length || sloganTimer) return;
  const texts = items.map(it => $(".hero__slogan-text", it));
  texts.forEach(tx => { if (tx && !tx.dataset.txt) tx.dataset.txt = tx.textContent; });
  let idx = 0;
  items[0].classList.add("is-on");
  sloganTimer = setInterval(() => {
    const next = (idx + 1) % items.length;
    items[idx].classList.remove("is-on");
    if (texts[next]) scrambleText(texts[next], texts[next].dataset.txt, 0.7, () => items[next].classList.add("is-on"));
    else items[next].classList.add("is-on");
    idx = next;
  }, 3000 + 280 + 700);
}
(function bootHero() {
  const canvas = $("#heroCanvas");
  let tier = 0;
  try { tier = window.HeroScene ? HeroScene.probeTier() : 0; } catch (e) { tier = 0; }
  if (tier > 0 && canvas) {
    HeroScene.load("assets/img/hero.webp", "assets/img/hero-cutout.png").then(() => {
      try {
        HeroScene.start(canvas);
        canvas.classList.add("is-live");
        HeroScene.onSweep(() => {
          gsap.fromTo(heroEl, { "--sweep-o": 1.05 }, { "--sweep-o": -0.05, duration: 3.2, ease: "none", overwrite: "auto" });
        });
      } catch (e) { /* static poster fallback stays */ }
    }).catch(() => {});
  }
  // pointer parallax (DOM layers) + GL steering + subject hit test
  const front = $(".hero__player-front", heroEl), glow = $(".hero__player-glow", heroEl), strip = $(".hero__floor-strip", heroEl);
  const qFront = front && { x: gsap.quickTo(front, "x", { duration: 0.7, ease: "power3" }), y: gsap.quickTo(front, "y", { duration: 0.7, ease: "power3" }) };
  const qGlow = glow && { x: gsap.quickTo(glow, "x", { duration: 0.7, ease: "power3" }), y: gsap.quickTo(glow, "y", { duration: 0.7, ease: "power3" }) };
  const qStrip = strip && { x: gsap.quickTo(strip, "x", { duration: 0.9, ease: "power3" }), y: gsap.quickTo(strip, "y", { duration: 0.9, ease: "power3" }) };
  if (FINE) {
    heroEl.addEventListener("pointermove", e => {
      const r = heroEl.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      if (window.HeroScene) {
        HeroScene.setPointer(nx, ny);
        const subj = HeroScene.isSubject(nx + 0.5, ny + 0.5);
        HeroScene.setParallaxEnabled(!subj);
      }
      if (qFront) { qFront.x(nx * -18.7 * 2); qFront.y(ny * -11.22 * 2); }
      if (qGlow) { qGlow.x(nx * -18.7 * 2); qGlow.y(ny * -11.22 * 2); }
      if (qStrip) { qStrip.x(nx * 19.8 * 2); qStrip.y(ny * 11.88 * 2); }
    });
  }
  // scroll exit parallax (sparallax) → GL uniform
  ScrollTrigger.create({
    trigger: heroEl, start: "top top", end: "bottom top", scrub: true,
    onUpdate: self => { if (window.HeroScene) HeroScene.setScrollParallax(0, self.progress); }
  });
  // IO visibility gate for the GL loop
  if ("IntersectionObserver" in window && window.HeroScene) {
    new IntersectionObserver(en => {
      en.forEach(en2 => HeroScene.setVisible(en2.intersectionRatio >= 0.15));
    }, { threshold: [0, 0.15, 0.5] }).observe(heroEl);
  }
  // court lantern follows the pointer (opacity is driven by journey-gl)
  const lantern = $(".court__lantern");
  if (lantern && FINE) {
    addEventListener("pointermove", e => {
      lantern.style.setProperty("--lx", (e.clientX / innerWidth * 100) + "%");
      lantern.style.setProperty("--ly", (e.clientY / innerHeight * 100) + "%");
    }, { passive: true });
  }
})();

/* ---------------- Tech strip (qq) ---------------- */
(function initQQ() {
  const sec = $("#tech"); if (!sec) return;
  const stage = $("[data-stage]", sec), strip = $("[data-strip]", sec);
  if (!stage || !strip) return;
  const dist = () => Math.max(0, strip.scrollWidth - innerWidth + 48);
  const titleBlocks = $$(".qq__endcap-title, .qq__bridge-title", sec);
  titleBlocks.forEach(tb => { $$(".cf-seg", tb).forEach(splitSeg); });
  function slideTitles() {
    titleBlocks.forEach(tb => {
      const lines = $$(".cf-line", tb);
      if (!lines.length) return;
      const r = tb.getBoundingClientRect();
      const bridge = tb.closest(".qq__bridge");
      const anchor = bridge ? (innerWidth - r.width) / 2 : (MOBILE() ? 20 : innerWidth * 0.23);
      const Ae = clamp01((innerWidth - r.left) / innerWidth);
      lines.forEach((ln, i) => {
        const ue = clamp01(Ae * 1.5 - i / Math.max(1, lines.length - 1) * 0.5);
        ln.style.transform = "translateX(" + (Math.pow(1 - ue, 3) * innerWidth * 0.34) + "px)";
        ln.style.setProperty("--p", ue * 100);
      });
    });
  }
  gsap.to(strip, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: sec, pin: stage, start: "top top", scrub: 0.6,
      end: () => "+=" + (dist() + innerHeight * 0.5),
      invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: slideTitles
    }
  });
  slideTitles();
  // bridge title driven by its own approach
  const bridge = $(".qq__bridge", sec);
  if (bridge) {
    ScrollTrigger.create({ trigger: bridge, start: "top bottom", end: "bottom bottom", scrub: true, onUpdate: slideTitles });
  }
  // panel parallax + wipe + live state, on the ticker
  const panels = $$(".qq__panel", sec).map(p => ({ p, img: $(".qq__img", p), f: 0, live: false, wiped: false }));
  panels.forEach(o => { if (!RM) gsap.set(o.p, { clipPath: "inset(100% 0% 0% 0%)" }); else o.wiped = true; });
  gsap.ticker.add(() => {
    const vw = innerWidth, amp = innerHeight * 0.34;
    panels.forEach(o => {
      const r = o.p.getBoundingClientRect();
      if (r.right < -200 || r.left > vw + 200) return;
      const norm = clamp((r.left + r.width / 2 - vw / 2) / vw, -1.2, 1.2);
      o.f += (norm * amp - o.f) * 0.11;
      o.p.style.transform = "translateY(" + o.f.toFixed(1) + "px)";
      if (o.img) o.img.style.transform = "translate(" + (-5 * (o.f / amp)) + "%," + (-4 * (o.f / amp)) + "%)";
      const live = r.right > vw * 0.08;
      if (live !== o.live) { o.live = live; o.p.classList.toggle("is-live", live); o.p.style.filter = live ? "" : "brightness(.55) saturate(.8)"; }
      if (!o.wiped && r.left < vw * 0.7) {
        o.wiped = true;
        gsap.to(o.p, { clipPath: "inset(0% 0% 0% 0%)", duration: 2, ease: "cubic-bezier(.16,1,.3,1)" });
      }
    });
  });
})();

/* ---------------- Transition rows (trx) ---------------- */
(function initTrx() {
  const trx = $("#trx"); if (!trx) return;
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const r = document.createElement("div");
    r.className = "trx__row";
    r.style.top = (i * 100 / 14 - 1.5) + "vh";
    r.style.height = (100 / 14 + 3) + "vh";
    r.style.clipPath = "polygon(0 12%,3% 2%,97% 14%,100% 4%,100% 88%,97% 98%,3% 86%,0 96%)";
    trx.appendChild(r); rows.push(r);
  }
  ScrollTrigger.create({
    trigger: "#tech", start: "bottom top", endTrigger: "#team", end: "top bottom", scrub: true,
    onUpdate: self => {
      const p = self.progress;
      trx.classList.toggle("is-on", p > 0 && p < 1);
      const ph = p < 0.5 ? p * 2 : (1 - p) * 2;
      rows.forEach((r, i) => {
        const k = clamp01(ph * 1.35 - i * 0.022);
        const dir = i % 2 ? 1 : -1;
        r.style.transform = "translateX(" + (dir * (1 - k) * 104) + "%)";
      });
    }
  });
})();

/* ---------------- Team: your names, framed (knit) ---------------- */
(function initKnit() {
  const scene = $("#knit"); if (!scene) return;
  const bgV = $(".tbr-scene__view--bg", scene), frontV = $(".tbr-scene__view--front", scene);
  const word = $(".tbr-scene__word", scene);
  const spineEl = $("#knitSpine"), card = $("#knitCard");
  const stitchC = $("#stitchCanvas"), fxC = $("#stitchFx");
  const sctx = stitchC.getContext("2d"), fxctx = fxC.getContext("2d");
  const ANCHOR = { x: 1493, y: 893 };
  let W = 0, H = 0, coverI = 1, offX = 0, offY = 0;
  let stitchPts = [], stitchP = 0, curName = "SHASHI PATEL", cardProg = 0;
  const mapPt = (x, y) => ({ x: x * coverI + offX, y: y * coverI + offY });
  function sizeCanvases() {
    const r = scene.getBoundingClientRect();
    W = r.width; H = r.height;
    [stitchC, fxC].forEach(c => { c.width = Math.round(W); c.height = Math.round(H); });
    coverI = Math.max(W / 2400, H / 1600);
    offX = (W - 2400 * coverI) / 2; offY = (H - 1600 * coverI) / 2;
    spineEl.style.fontSize = (scene.clientWidth * 0.062 * 1.48) + "px";
    drawStitch();
  }
  function initialsOf(name) {
    return name.trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join("").slice(0, 3) || "SP";
  }
  function computeStitch() {
    const ini = initialsOf(curName);
    const oc = document.createElement("canvas"); oc.width = 2400; oc.height = 1600;
    const o = oc.getContext("2d", { willReadFrequently: true });
    o.font = "700 260px 'Geist Mono', monospace";
    o.textAlign = "center"; o.textBaseline = "middle";
    o.fillStyle = "#fff";
    o.fillText(ini, ANCHOR.x, ANCHOR.y);
    const data = o.getImageData(0, 0, 2400, 1600).data;
    stitchPts = [];
    for (let y = 0; y < 1600; y += 105) for (let x = 0; x < 2400; x += 105) {
      if (data[(y * 2400 + x) * 4 + 3] > 120) {
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        stitchPts.push({ x, y, hash: (h % 100) / 100 });
      }
    }
    stitchPts.sort((a, b) => a.x - b.x || a.y - b.y);
  }
  function drawStitch() {
    if (!W) return;
    sctx.clearRect(0, 0, W, H); fxctx.clearRect(0, 0, W, H);
    const n = Math.floor(stitchPts.length * stitchP);
    for (let i = 0; i < n; i++) {
      const pt = stitchPts[i], p = mapPt(pt.x, pt.y), v = 26 + pt.hash * 20;
      const ang = pt.hash * Math.PI;
      const dx = Math.cos(ang) * 5, dy = Math.sin(ang) * 5;
      sctx.strokeStyle = "rgba(30,24,22,.18)"; sctx.lineWidth = 2.2;
      sctx.beginPath(); sctx.moveTo(p.x - dx + 0.7, p.y - dy + 0.9); sctx.lineTo(p.x + dx + 0.7, p.y + dy + 0.9); sctx.stroke();
      sctx.strokeStyle = "rgba(" + v + "," + v + "," + (v + 6) + ",.98)"; sctx.lineWidth = 2.1;
      sctx.beginPath(); sctx.moveTo(p.x - dx, p.y - dy); sctx.lineTo(p.x + dx, p.y + dy); sctx.stroke();
      fxctx.strokeStyle = "rgba(212,206,218,.3)"; fxctx.lineWidth = 0.55;
      fxctx.beginPath(); fxctx.moveTo(p.x - dx, p.y - dy); fxctx.lineTo(p.x + dx, p.y + dy); fxctx.stroke();
    }
    if (n > 0 && stitchP < 1) {
      const last = stitchPts[n - 1], p = mapPt(last.x, last.y);
      fxctx.fillStyle = "rgba(243,235,220,.95)";
      fxctx.beginPath(); fxctx.arc(p.x, p.y, 2.1, 0, 7); fxctx.fill();
    }
  }
  function buildSpine() {
    spineEl.innerHTML = "";
    curName.toUpperCase().split("").forEach(ch => {
      const s = document.createElement("span");
      s.className = "sp-ch"; s.textContent = ch === " " ? "\u00A0" : ch;
      spineEl.appendChild(s);
    });
  }
  function spineUpdate(p) {
    const ini = initialsOf(curName).split("");
    const letters = $$(".sp-ch", spineEl);
    const count = letters.length;
    // which letter indices are initials (first letter of each word)
    const words = curName.toUpperCase().split(" ");
    const keepIdx = new Set(); let off = 0;
    words.forEach(w => { if (w) keepIdx.add(off); off += w.length + 1; });
    letters.forEach((el, i) => {
      if (keepIdx.has(i)) { el.style.transform = "scale(1)"; el.style.opacity = 1; return; }
      const local = clamp01((p - (0.3 + i * 0.42 / Math.max(count, 1))) / 0.14);
      el.style.transform = "scale(" + (1 - local) + ")";
      el.style.opacity = String(1 - local);
    });
    const anchor = mapPt(ANCHOR.x, ANCHOR.y);
    const move = remap(p, 0.18, 0.72), sc = remap(p, 0.3, 0.78);
    const cx = W / 2, cy = H / 2;
    const k = lerp(1, (260 * coverI) / Math.max(parseFloat(spineEl.style.fontSize) || 100, 1), sc);
    spineEl.style.transform = "translate(" + (cx + (anchor.x - cx) * move) + "px," + (cy + (anchor.y - cy) * move) + "px) translate(-50%,-50%) scale(" + k + ")";
    spineEl.style.opacity = String(1 - remap(p, 0.8, 0.9));
    // leader line: card → anchor
    const path = $("#leaderPath"), dot = $("#leaderDot");
    if (path && card) {
      const sr = scene.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const x1 = cr.left - sr.left + cr.width * 0.2, y1 = cr.top - sr.top + cr.height * 0.8;
      path.setAttribute("d", "M" + x1 + " " + y1 + " L" + anchor.x + " " + anchor.y);
      const len = Math.hypot(anchor.x - x1, anchor.y - y1);
      path.style.strokeDasharray = len + " " + len;
      path.style.strokeDashoffset = String(len * (1 - cardProg));
      dot.setAttribute("cx", anchor.x); dot.setAttribute("cy", anchor.y);
      dot.style.opacity = cardProg > 0.9 ? 1 : 0;
    }
  }
  buildSpine(); computeStitch(); sizeCanvases();
  const wordFill = playColorFill(word, { manual: true, dur: 1.2 });
  const cardTl = gsap.timeline({ paused: true });
  cardTl.fromTo($$(".tbr-scene__corner", card), { scale: 0 }, { scale: 1, duration: 0.2, ease: "back.out(3)", stagger: 0.05 }, 0)
    .fromTo($$(".tbr-scene__edge", card), { scaleX: 0, scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: 0.28, stagger: 0.06, ease: "power2.inOut" }, 0.16)
    .fromTo($(".tbr-scene__panel", card), { clipPath: "inset(0 100% 100% 0)" }, { clipPath: "inset(0 0% 0% 0)", duration: 0.4, ease: "power3.inOut" }, 0.32)
    .fromTo($$(".tbr-scene__panel > *", card), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.28, stagger: 0.06 }, 0.56)
    .to({}, { duration: 0.48, onUpdate: function () { cardProg = this.progress(); } }, 0.4);
  gsap.timeline({
    scrollTrigger: {
      trigger: scene, start: "top top", end: "+=240%", pin: true, scrub: 0.8, anticipatePin: 1,
      onUpdate: self => {
        const p = self.progress;
        stitchP = remap(p, 0.74, 0.98);
        drawStitch();
        spineUpdate(p);
        const cp = MOBILE() ? remap(p, 0.6, 1) : remap(p, 0.44, 1);
        cardTl.progress(cp);
        cardProg = cp;
      }
    }
  })
    .fromTo(bgV, { scale: 1.04 }, { scale: 1.22, duration: 0.72, ease: "power1.inOut" }, 0.06)
    .fromTo(frontV, { scale: 1.04 }, { scale: 1.32, duration: 0.72, ease: "power1.inOut" }, 0.06)
    .to(word, { y: () => -innerHeight * 0.04, duration: 0.66, ease: "none" }, 0.3)
    .add(() => { if (wordFill) wordFill.play(); }, 0.15);
  // name input
  const cta = $("#namesCta"), row = $("#namesRow"), input = $("#nameInput"), mono = $("#namesMono");
  if (cta) cta.addEventListener("click", () => { row.hidden = false; cta.style.display = "none"; input.focus(); });
  if (input) input.addEventListener("input", () => {
    curName = input.value.trim() || "SHASHI PATEL";
    mono.textContent = initialsOf(curName);
    buildSpine(); computeStitch(); drawStitch();
  });
  addEventListener("resize", () => { sizeCanvases(); });
})();

/* ---------------- Testimonials ---------------- */
const FILMS = {
  jenny: { name: "Jenny Lakra", role: "Newborn shoot client", yt: "PV_qwUB5kUg",
    title: "Newborn Photography Session by SHASHICLICKS — Shashi Patel",
    cap: "All I can say is WOW! Shashi is amazing… Neelam is a baby whisperer. She took such great care of our son during the shoot… They are the most beautiful newborn photos I've ever seen. It's 100% worth the investment… I would recommend Shashiclicks to anyone and everyone looking for the BEST NEWBORN photographer!!" },
  jinith: { name: "Jinith Rs", role: "Lead Software Engineer · S&P Global", yt: "c9C2lxa2X_w",
    title: "Newborn BabyGirl — SHASHICLICKS, Hyderabad, India",
    cap: "Shashi and Neelam are awesome people. It was a great experience having them shoot our baby boy.. and the photos turned out to be nothing less than magic!! with a good camera anyone can capture a good image but Shashi knows the right moment to click and the picture just turn out to be awesome!!! Neelam is so easy with the kids and my boy felt so comfortable with both of them. thank you shashiclicks for capturing our moments and making it sweet memories. I would highly recommend them to anyone reading this." }
};
(function initTtl() {
  const sec = $("#testimonials"); if (!sec) return;
  ScrollTrigger.create({ trigger: sec, start: "top bottom", end: "bottom top", toggleClass: { targets: sec, className: "is-in" } });
  const head = $(".ttl__head", sec);
  const fillTl = playColorFill(head, { manual: true, stagger: 0.16, dur: 1.4 });
  const tl = gsap.timeline({ paused: true });
  tl.fromTo($$(".ttl__line-in > .cf-seg", sec), { yPercent: 115 }, { yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }, 0);
  tl.add(() => { if (fillTl) fillTl.play(); }, 0.1);
  [[".ttl__card--west", 0], [".ttl__card--gaffney", 0.35]].forEach(([sel, L]) => {
    const card = $(sel, sec); if (!card) return;
    tl.fromTo($$(".hud2__dot", card), { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(3)", stagger: 0.04 }, L);
    tl.fromTo($$(".hud2__edge--t, .hud2__edge--b", card), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, L + 0.2);
    tl.fromTo($$(".hud2__edge--l, .hud2__edge--r", card), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, L + 0.2);
    tl.fromTo($(".ttl__frame", card), { clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "power3.inOut" }, L + 0.35);
    tl.fromTo($(".ttl__credit", card), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, L + 1.15);
  });
  tl.fromTo($$(".ttl__quote-slot", sec), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 1.15);
  if (RM) { tl.progress(1); }
  ScrollTrigger.create({ trigger: sec, start: "top 62%", once: true, onEnter: () => tl.play() });
  // parallax drift
  gsap.to($(".ttl__card--west", sec), { y: () => -innerHeight * 0.07, ease: "none",
    scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.6 } });
  gsap.to($(".ttl__card--gaffney", sec), { y: () => innerHeight * 0.07, ease: "none",
    scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.6 } });
  // timecodes
  const tcs = $$("[data-tc]", sec).map((el, i) => ({ el, ph: i * 37.5 }));
  setInterval(() => {
    const now = performance.now() / 1000;
    tcs.forEach(o => {
      const s = now + o.ph;
      const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
      const ss = String(Math.floor(s) % 60).padStart(2, "0");
      const ff = String(Math.floor((s % 1) * 30)).padStart(2, "0");
      o.el.textContent = "00:" + mm + ":" + ss + ":" + ff;
    });
  }, 120);
  // cursor + lightbox
  const cursor = $("#ttl-cursor"), lb = $("#lb");
  if (cursor && FINE && !MOBILE()) {
    gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: 0.6, autoAlpha: 0 });
    cursor.style.transition = "opacity .25s ease";
    const cx = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    const cy = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
    sec.addEventListener("pointermove", e => { cx(e.clientX); cy(e.clientY); });
    $$(".ttl__card", sec).forEach(card => {
      card.addEventListener("pointerenter", () => gsap.to(cursor, { autoAlpha: 1, scale: 1, duration: 0.25 }));
      card.addEventListener("pointerleave", () => gsap.to(cursor, { autoAlpha: 0, scale: 0.6, duration: 0.25 }));
    });
  }
  function openLb(key) {
    const f = FILMS[key]; if (!f || !lb) return;
    $("#lbName").textContent = f.name + " — " + f.role;
    $("#lbTime").textContent = f.title;
    $("#lbCap").innerHTML = "<b>" + f.name + ":</b> “" + f.cap + "”";
    $("#lbMedia").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + f.yt + '?autoplay=1&rel=0" title="' + f.title + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    lb.classList.add("is-open");
    lenis.stop();
    $("#lbClose").focus();
  }
  function closeLb() {
    if (!lb) return;
    lb.classList.remove("is-open");
    $("#lbMedia").innerHTML = "";
    lenis.start();
  }
  $$(".ttl__card", sec).forEach(card => {
    card.addEventListener("click", () => openLb(card.dataset.player));
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLb(card.dataset.player); } });
  });
  if (lb) {
    $("#lbClose").addEventListener("click", closeLb);
    lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && lb.classList.contains("is-open")) closeLb(); });
  }
})();

/* ---------------- Finale ---------------- */
(function initFinale() {
  const rat = $("#finale"); if (!rat) return;
  const stage = $(".rat__stage", rat), shade = $(".rat__shade", rat);
  const title = $(".rat__title", rat), cta = $("[data-cta]", rat);
  const packs = $$(".rat__pack", rat).map((p, i) => ({
    drop: $("[data-drop]", p), float: $("[data-float]", p),
    shadow: $(".rat__pack-shadow", p), light: $(".rat__pack-light", p),
    sx: i === 0 ? -38 : 38, rot: i === 0 ? -11 : 10, lag: i === 0 ? 0 : 0.1, Lf: (i === 0 ? 0.55 : 0.7), W: 0
  }));
  let filled = false;
  const fillTl = playColorFill(title, { manual: true, dur: 1.4 });
  function params() {
    const vh = innerHeight;
    if (!MOBILE()) return { ds: 0.1, de: 0.58, fa: 0.21, re: 0.26 };
    const span = rat.offsetHeight - vh; // 115vh on mobile
    return { ds: 0, de: (vh * 0.9) / span, fa: (vh * 0.62) / span, re: (vh * 0.8) / span };
  }
  ScrollTrigger.create({
    trigger: rat, start: "top top", end: "bottom bottom", scrub: 0.4,
    onUpdate: self => {
      const v = self.progress, P = params();
      const M = clamp01((v - P.ds) / (P.de - P.ds));
      packs.forEach(pk => {
        const A = clamp01((M - pk.lag) / (1 - pk.lag));
        const e3 = 1 - Math.pow(1 - A, 3), e2 = 1 - Math.pow(1 - A, 2);
        pk.drop.style.transform = "translate(" + ((1 - e3) * pk.sx * innerWidth / 100) + "px," + ((1 - e2) * -120 * innerHeight / 100) + "px) rotate(" + ((1 - e2) * pk.rot) + "deg)";
        pk.W = clamp01((A - 0.55) / 0.45);
        pk.shadow.style.opacity = pk.W * 0.75;
      });
      if (shade) shade.style.opacity = String(1 - clamp01(v / 0.26));
      if (!filled && v >= P.fa) { filled = true; if (fillTl) fillTl.play(); }
      if (cta) {
        const cp = clamp01((v - P.fa) / (P.re - P.fa));
        const e = 1 - Math.pow(1 - cp, 3);
        cta.style.transform = "translateY(" + ((1 - e) * 16 * innerHeight / 100) + "px)";
        cta.style.opacity = String(Math.min(1, cp * 3));
      }
    }
  });
  // idle float + shadow/light coupling
  packs.forEach((pk, i) => {
    const LfPx = pk.Lf * sf();
    gsap.fromTo(pk.float, { y: LfPx * 0.5 }, { y: -LfPx, duration: i === 0 ? 3.4 : 3.9, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.6 });
    gsap.fromTo(pk.float, { rotation: i === 0 ? 0.7 : -0.8 }, { rotation: i === 0 ? -0.7 : 0.8, duration: (i === 0 ? 3.4 : 3.9) * 1.27, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.6 });
  });
  gsap.ticker.add(() => {
    packs.forEach(pk => {
      const LfPx = pk.Lf * sf();
      const y = gsap.getProperty(pk.float, "y");
      const I = clamp01((y + LfPx) / (LfPx * 1.5));
      pk.shadow.style.transform = "scaleX(" + (0.9 + I * 0.12) + ")";
      pk.shadow.style.opacity = String(pk.W * (0.75 + I * 0.25));
      if (pk.light) pk.light.style.opacity = String(0.72 + (1 - I) * 0.28);
    });
  });
  // pointer tilt — per pack, L = 1 / 1.3, nx/ny in [-1,1] from stage centre
  if (FINE) {
    const tilts = $$(".rat__pack-tilt", rat).map((el, i) => {
      gsap.set(el, { transformPerspective: 900 });
      return {
        L: i === 0 ? 1 : 1.3,
        rX: gsap.quickTo(el, "rotationX", { duration: 0.9, ease: "power3.out" }),
        rY: gsap.quickTo(el, "rotationY", { duration: 0.9, ease: "power3.out" }),
        pX: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" })
      };
    });
    if (tilts.length) {
      stage.addEventListener("pointermove", e => {
        const r = stage.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        tilts.forEach(t => { t.rY(nx * 7 * t.L); t.rX(-ny * 4.5 * t.L); t.pX(nx * 0.45 * sf() * t.L); });
      });
      stage.addEventListener("pointerleave", () => tilts.forEach(t => { t.rY(0); t.rX(0); t.pX(0); }));
    }
  }
})();

/* Court caption safety: if the GL module failed, show the static court */
setTimeout(() => {
  if (!window.__courtReady) {
    const sec = $("#court"), cap = $(".court__caption");
    if (sec) sec.classList.add("is-static");
    if (cap) cap.style.opacity = 1;
  }
}, 5000);

/* ---------------- Dusk (empty light transition) ---------------- */
(function initDusk() {
  const dusk = $("#dusk"); if (!dusk) return;
  ScrollTrigger.create({
    trigger: dusk, start: "top bottom", end: "bottom bottom", scrub: 0.5,
    onUpdate: self => {
      const p = self.progress;
      dusk.style.setProperty("--ay", (-85 + p * 73) + "%");
      dusk.style.setProperty("--suno", String(p * 0.85));
    }
  });
})();

/* ---------------- Footer slideshow ---------------- */
(function initFoot() {
  const slides = $$(".foot__slide");
  if (slides.length < 2) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden || document.documentElement.classList.contains("is-motion-paused")) return;
    slides[i].classList.remove("is-on");
    i = (i + 1) % slides.length;
    slides[i].classList.add("is-on");
  }, 5500);
})();

/* ---------------- Chrome: bar, sound, ink zones ---------------- */
const bar = $(".bar"), snd = $("#snd");
(function initChrome() {
  let lastY = 0;
  gsap.ticker.add(() => {
    const y = scrollY;
    if (bar) {
      if (y > 80 && y > lastY + 4) bar.classList.add("bar--hidden");
      else if (y < 80 || y < lastY - 4) bar.classList.remove("bar--hidden");
    }
    if (snd) {
      const heroState = y <= 40;
      snd.classList.toggle("snd--hero", heroState);
      const learn = $(".hero__learn", heroEl);
      if (learn) learn.style.setProperty("--cue-shift", heroState ? (snd.offsetWidth + 1.166667 * sf()) + "px" : "0px");
    }
    lastY = y;
  });
  function inkST(targets, cls, start, end) {
    if (!targets) return;
    ScrollTrigger.create({ trigger: "#finale", start, endTrigger: "#dusk", end, toggleClass: { targets, className: cls } });
  }
  inkST(bar, "bar--ink", "top 5%", "45% top");
  inkST(snd, "snd--ink", "top 5%", "45% top");
  if (snd) snd.addEventListener("click", () => {
    const on = snd.classList.toggle("snd--on");
    snd.classList.toggle("snd--off", !on);
    snd.setAttribute("aria-pressed", on);
    snd.setAttribute("aria-label", on ? "Mute sound" : "Play sound");
  });
})();

/* ---------------- Motion toggle (delegated) ---------------- */
function setMotion(paused) {
  document.documentElement.classList.toggle("is-motion-paused", paused);
  try { localStorage.setItem("shashi-motion", paused ? "paused" : "on"); } catch (e) {}
  $$("[data-motion-toggle]").forEach(b => {
    b.setAttribute("aria-pressed", paused);
    const l = $("[data-motion-label]", b);
    if (l) l.textContent = paused ? "Play motion" : "Pause motion";
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-motion-toggle]");
  if (b) setMotion(!document.documentElement.classList.contains("is-motion-paused"));
});
try { if (localStorage.getItem("shashi-motion") === "paused") setMotion(true); } catch (e) {}

/* ---------------- Shot clock HUD (desktop only) ---------------- */
(function initShotclock() {
  if (innerWidth < 992) return;
  const GLYPHS = {
    "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110",
    "2": "01110100010000100010001000100011111", "3": "01110100010000100110000011000101110",
    "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110",
    "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000",
    "8": "01110100011000101110100011000101110", "9": "01110100011000101111000010001001100",
    " ": "00000000000000000000000000000000000"
  };
  const chapters = [
    { el: "#hero", name: "THE STUDIO" }, { el: "#court", name: "THE JOURNEY" },
    { el: "#tech", name: "SPECIALITIES" }, { el: "#team", name: "YOUR NAMES" },
    { el: "#testimonials", name: "WORD OF MOUTH" }, { el: "#finale", name: "GET READY" },
    { el: "#dusk", name: "FINAL FRAME" }
  ];
  const nav = document.createElement("nav");
  nav.className = "shotclock"; nav.id = "shotclock"; nav.setAttribute("aria-label", "Chapters");
  nav.innerHTML =
    '<div class="shotclock__face"><div class="shotclock__led"></div>' +
    '<div class="shotclock__meta"><span class="shotclock__name"></span><span class="shotclock__count"></span></div>' +
    '<div class="shotclock__toggle"><button type="button" data-sc-index>Index</button><button type="button" data-motion-toggle aria-pressed="false">Motion</button></div></div>' +
    '<div class="shotclock__ticks"></div><div class="shotclock__preview"></div>';
  document.body.appendChild(nav);
  const led = $(".shotclock__led", nav), ticks = $(".shotclock__ticks", nav);
  const nameEl = $(".shotclock__name", nav), countEl = $(".shotclock__count", nav), preview = $(".shotclock__preview", nav);
  const slots = [];
  for (let s = 0; s < 4; s++) {
    if (s === 2) {
      const pt = document.createElement("span"); pt.className = "sc-point";
      for (let i = 0; i < 7; i++) pt.appendChild(document.createElement("i"));
      led.appendChild(pt); slots.push({ point: pt });
    } else {
      const d = document.createElement("span"); d.className = "sc-digit";
      for (let i = 0; i < 35; i++) d.appendChild(document.createElement("i"));
      led.appendChild(d); slots.push({ digit: d });
    }
  }
  const tickEls = [];
  for (let i = 0; i < 24; i++) { const tEl = document.createElement("i"); ticks.appendChild(tEl); tickEls.push(tEl); }
  function setDigit(slot, ch) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    [...slot.digit.children].forEach((c, i) => c.classList.toggle("on", g[i] === "1"));
  }
  function setPoint(on) { [...slots[2].point.children].forEach((c, i) => c.classList.toggle("on", on && i === 6)); }
  let geom = { start: 0, end: 1 };
  function docTop(el) { return el ? el.getBoundingClientRect().top + scrollY : 0; }
  function computeGeom() {
    const vh = innerHeight;
    const start = docTop($("#court"));
    const footBar = docTop($(".foot__bar"));
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    geom.start = start;
    geom.end = Math.max(start + vh, Math.min(maxScroll - 1, footBar - vh - vh * 0.001));
    preview.innerHTML = "";
    chapters.forEach((c, i) => {
      const top = docTop($(c.el));
      const tAt = 24 * (1 - clamp01((top - geom.start) / (geom.end - geom.start)));
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = "<span>" + c.name + "</span><span>" + (tAt < 5 ? tAt.toFixed(1) : String(Math.ceil(tAt)).padStart(2, "0")) + "</span>";
      b.addEventListener("click", () => {
        preview.classList.remove("is-on");
        lenis.scrollTo($(c.el), { duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
      });
      preview.appendChild(b);
    });
  }
  computeGeom();
  addEventListener("shashi-reveal", () => setTimeout(computeGeom, 60));
  ScrollTrigger.addEventListener("refresh", computeGeom);
  ScrollTrigger.create({ trigger: "#finale", start: "top 8%", endTrigger: "#dusk", end: "top 80%", toggleClass: { targets: nav, className: "shotclock--ink" } });
  $("[data-sc-index]", nav).addEventListener("click", () => preview.classList.toggle("is-on"));
  let curChapter = -1, buzzed = false, lastY = -1;
  gsap.ticker.add(() => {
    const y = scrollY;
    if (y === lastY) return;
    lastY = y;
    if (y > 0) nav.classList.add("is-on");
    const vh = innerHeight, probe = y + vh * 0.4;
    let ci = 0;
    chapters.forEach((c, i) => { if (docTop($(c.el)) <= probe) ci = i; });
    const t = 24 * (1 - clamp01((y - geom.start) / (geom.end - geom.start)));
    if (t < 5) {
      const s = t.toFixed(1).split(".");
      setDigit(slots[0], " "); setDigit(slots[1], s[0]); setPoint(true); setDigit(slots[3], s[1]);
      nav.classList.add("is-late");
    } else {
      const s = String(Math.ceil(t)).padStart(2, "0");
      setDigit(slots[0], s[0]); setDigit(slots[1], s[1]); setPoint(false); setDigit(slots[3], " ");
      nav.classList.remove("is-late");
    }
    const ct = Math.ceil(t);
    tickEls.forEach((tk, w) => tk.classList.toggle("on", w < ct));
    if (ci !== curChapter) {
      curChapter = ci;
      scrambleText(nameEl, chapters[ci].name, 0.6);
      countEl.textContent = "0" + (ci + 1) + " / 07";
      $$("button", preview).forEach((b, i) => b.classList.toggle("is-cur", i === ci));
    }
    if (t <= 0.001 && !buzzed) { buzzed = true; nav.classList.add("is-buzz"); setTimeout(() => nav.classList.remove("is-buzz"), 1150); }
    if (t > 1) buzzed = false;
  });
  window.__scGeom = computeGeom;
})();

/* ---------------- Page-transition doors ---------------- */
(function initDoors() {
  const door = $(".pt-door"); if (!door) return;
  const leafA = $(".pt-door__leaf--a", door), leafB = $(".pt-door__leaf--b", door);
  const light = $(".pt-door__light", door), flood = $(".pt-door__flood", door);
  const label = $(".pt-door__label", door), nameEl = $(".pt-door__name", door);
  let busy = false;
  function runDoor(a) {
    if (busy) return; busy = true;
    const name = a.dataset.ptName || "Book a Shoot";
    nameEl.innerHTML = "";
    name.split("").forEach(ch => {
      const s = document.createElement("span");
      s.className = "pt-door__char";
      s.textContent = ch === " " ? "\u00A0" : ch;
      nameEl.appendChild(s);
    });
    const n = name.length;
    const q = Math.max(1.16, 0.78 + (n - 1) * 0.05 + 0.28) + 0.12;
    door.classList.add("is-active");
    const tl = gsap.timeline();
    tl.set([leafA], { xPercent: -110 }).set([leafB], { xPercent: 110 })
      .set(label, { opacity: 0 }).set(light, { width: 0, opacity: 0 }).set(flood, { opacity: 0 })
      .to([leafA, leafB], { xPercent: 0, duration: 0.6, ease: "power3.inOut" }, 0)
      .to($$(".pt-door__rim", door), { opacity: 1, duration: 0.15 }, 0.5)
      .to(light, { width: "38vw", opacity: 0.9, duration: 0.3, ease: "power2.out" }, 0.5)
      .to(flood, { opacity: 0.8, duration: 0.3 }, 0.55)
      .to(label, { opacity: 1, duration: 0.2 }, 0.58)
      .fromTo($$(".pt-door__char", door), { y: "1.1em", opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: "power2.out", stagger: 0.05 }, 0.62)
      .add(() => {
        try { sessionStorage.setItem("pt-nav", "1"); } catch (e) {}
        location.href = a.href;
      }, q + 0.15);
  }
  $$("[data-pt-link]").forEach(a => {
    let prefetched = false;
    a.addEventListener("pointerover", () => {
      if (prefetched) return; prefetched = true;
      const l = document.createElement("link");
      l.rel = "prefetch"; l.href = a.href;
      document.head.appendChild(l);
    });
    a.addEventListener("click", e => {
      e.preventDefault();
      if (RM) { location.href = a.href; return; }
      runDoor(a);
    });
  });
})();

/* ---------------- Smooth anchors ---------------- */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const target = $(a.getAttribute("href"));
    if (target) { e.preventDefault(); lenis.scrollTo(target, { duration: 1.4 }); }
  });
});

/* ---------------- Resize / fonts ---------------- */
let lastW = innerWidth;
addEventListener("resize", () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth;
  heroLayout();
  if (!loadDone) { numLayout(); lastShownInt = -1; numRender(loadShown); }
  if (window.__scGeom) window.__scGeom();
});
heroLayout();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { heroLayout(); numLayout(); ScrollTrigger.refresh(); });
ScrollTrigger.refresh();
})();
