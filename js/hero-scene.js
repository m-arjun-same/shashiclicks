/* HeroScene — own-code WebGL 2D shader stack, values from CODEBASE-SPEC Annex C.
   Layers (renderOrder): plate 0 → beams 1 → haze 1.5 → contact shadow 1.8 →
   player cutout 2 (premultiplied) → dust 3 (additive) → grain post (tier 2).
   Beams tint (1,.84,.63) gain .16 · haze gain .06 · grain .028 · dust 150/500. */
window.HeroScene = (function () {
  "use strict";
  var gl = null, canvas = null, tier = 0, running = false, raf = 0;
  var W = 0, H = 0, DPR = 1, Z = 1.5, focusX = 0.5, focusY = 0.5;
  var P = {};            // programs
  var texBg = null, texPl = null, quad = null;
  var sceneFBO = null, sceneTex = null;
  var flow = null;       // {a,b,texA,texB,prog}
  var dustGeo = null, dustCount = 0;
  var t = 0, lastTs = 0;
  var par = { x: 0, y: 0 }, parT = { x: 0, y: 0 }, amp = 0, lastMove = -1e9;
  var exitP = 0, parEnabled = true;
  var sweep = { active: false, start: 0, next: 5.5, val: -1 };
  var shadowGain = 0;
  var degrade = 0, gov = { frames: 0, winT: 0, wins: [], bad: 0, base: 0 };
  var ioVisible = true;
  var CB = {};
  var hitC = null; // offscreen alpha sampler for the cutout

  var VS = "attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}";
  var COVER = [
    "uniform vec2 uRes;uniform float uZ;uniform vec2 uFocus;uniform float uZoom;uniform vec2 uShift;uniform float uExit;uniform float uWeight;",
    "vec2 cuv(vec2 uv){float A=uRes.x/uRes.y;vec2 s;if(A>uZ){s=vec2(uZ/A,1.);}else{s=vec2(1.,A/uZ);}",
    "vec2 c=(uv-.5)*s/uZoom+uFocus+uShift;c.y+=uExit*uWeight*.16;return c;}"
  ].join("\n");
  var NOISE = [
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    "return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}"
  ].join("\n");
  var BEAMMATH = [
    "float beamCoord(vec2 uv){return dot(uv-.5,vec2(-.4226,-.9063));}",
    "float bandAt(float bc,float c,float w){float d=(bc-c)/w;return exp(-d*d);}"
  ].join("\n");

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("HeroScene shader:", gl.getShaderInfoLog(s)); }
    return s;
  }
  function prog(fs, vs) {
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs || VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
    return { p: p, u: u };
  }
  function setCover(pr, zoom, weight, shiftScale) {
    var u = pr.u;
    if (u.uRes) gl.uniform2f(u.uRes, W, H);
    if (u.uZ) gl.uniform1f(u.uZ, Z);
    if (u.uFocus) gl.uniform2f(u.uFocus, focusX, focusY);
    if (u.uZoom) gl.uniform1f(u.uZoom, zoom);
    if (u.uWeight) gl.uniform1f(u.uWeight, weight);
    if (u.uExit) gl.uniform1f(u.uExit, exitP);
    if (u.uShift) {
      var k = shiftScale == null ? 1 : shiftScale;
      gl.uniform2f(u.uShift, par.x * amp * -88 / Math.max(W, 1) * k, par.y * amp * 52.8 / Math.max(H, 1) * k);
    }
  }
  function drawQuad() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  function makeTex(img) {
    var tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tx;
  }
  function makeRT(w, h, type) {
    var tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb: fb, tx: tx };
  }

  function buildPrograms() {
    P.plate = prog([
      "precision highp float;varying vec2 vUv;",
      COVER, "uniform sampler2D uTex;uniform sampler2D uFlow;uniform float uFlowOn;",
      "void main(){vec2 uv=cuv(vUv);vec2 w=texture2D(uFlow,vUv).rg;",
      "uv+=w*.009*uFlowOn;gl_FragColor=texture2D(uTex,uv);}"
    ].join("\n"));
    P.beams = prog([
      "precision highp float;varying vec2 vUv;",
      COVER, NOISE, BEAMMATH,
      "uniform float uTime;uniform sampler2D uFlow;uniform float uFlowOn;uniform float uSteer;uniform vec3 uAttract;",
      "void main(){vec2 uv=cuv(vUv);vec2 w=texture2D(uFlow,vUv).rg;",
      "float bc=beamCoord(uv)+w.x*.02*uFlowOn;",
      "float along=dot(uv-.5,vec2(.9063,-.4226));",
      "float b=bandAt(bc,.46,.105)+.6*bandAt(bc,.66,.075)+.35*bandAt(bc,.30,.140);",
      "float st=0.;st+=uAttract.x*bandAt(bc,.38,.07);st+=uAttract.y*bandAt(bc,.56,.07);st+=uAttract.z*bandAt(bc,.76,.07);",
      "b+=min(st*uSteer,.18);",
      "float shim=.72+.40*vnoise(vec2(along*2.6-uTime*.16,uTime*9.));",
      "float fall=mix(.55,1.,smoothstep(0.,.85,uv.y));",
      "float a=b*.16*shim*fall;a=min(a,1.85*.16);",
      "gl_FragColor=vec4(vec3(1.,.84,.63)*a,1.);}"
    ].join("\n"));
    P.haze = prog([
      "precision highp float;varying vec2 vUv;",
      COVER, NOISE,
      "uniform float uTime;uniform float uGain;uniform float uOct;",
      "void main(){vec2 uv=cuv(vUv);",
      "float n=vnoise(uv*3.-uTime*.02);if(uOct>1.5){n=.6*n+.4*vnoise(uv*7.+uTime*.015);}",
      "float band=exp(-pow((uv.y-.5)/.35,2.));",
      "float dens=mix(.45,1.,1.-uv.y);",
      "float a=uGain*band*dens*(.55+.45*n);",
      "gl_FragColor=vec4(vec3(1.,.85,.65)*a,1.);}"
    ].join("\n"));
    P.shadow = prog([
      "precision highp float;varying vec2 vUv;",
      COVER,
      "uniform float uGain;",
      "float blob(vec2 uv,vec2 c,vec2 r){vec2 d=(uv-c)/r;return exp(-dot(d,d));}",
      "void main(){vec2 uv=cuv(vUv);",
      "float a=max(blob(uv,vec2(.6719,.0806),vec2(.171,.014)),blob(uv,vec2(.8281,.2056),vec2(.074,.009)));",
      "gl_FragColor=vec4(0.,0.,0.,min(a,.35)*uGain);}"
    ].join("\n"));
    P.player = prog([
      "precision highp float;varying vec2 vUv;",
      COVER, BEAMMATH,
      "uniform sampler2D uTex;uniform float uSweep;",
      "void main(){vec2 uv=cuv(vUv);vec4 tx=texture2D(uTex,uv);",
      "float bc=beamCoord(uv);float sw=bandAt(bc,uSweep,.075);",
      "float rows=smoothstep(.34,.38,uv.y)*(1.-smoothstep(.80,.84,uv.y));",
      "float hot=exp(-dot((uv-vec2(.663,.603))/vec2(.045,.045),(uv-vec2(.663,.603))/vec2(.045,.045)));",
      "vec3 add=vec3(1.,.9,.75)*(sw*rows*.8+hot*sw*.6)*tx.a;",
      "gl_FragColor=vec4((tx.rgb+add)*tx.a,tx.a);}"
    ].join("\n"));
    P.grain = prog([
      "precision highp float;varying vec2 vUv;",
      "uniform sampler2D uTex;uniform float uTime;uniform float uAmt;uniform vec2 uRes;",
      "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uTime*60.)*43758.5453);}",
      "void main(){vec4 c=texture2D(uTex,vUv);",
      "float lum=dot(c.rgb,vec3(.299,.587,.114));",
      "float g=(hash(vUv*uRes)-.5)*uAmt*(1.-lum*.6);",
      "gl_FragColor=vec4(c.rgb+g+.5/255.,c.a);}"
    ].join("\n"));
    P.flow = prog([
      "precision highp float;varying vec2 vUv;",
      "uniform sampler2D uPrev;uniform vec2 uTexel;uniform float uTime;uniform vec4 uInject;uniform vec2 uPar;",
      "void main(){vec2 v=texture2D(uPrev,vUv).rg;",
      "vec2 back=vUv-v*uTexel*2.2;",
      "vec2 s=texture2D(uPrev,back).rg;",
      "s*=.965;",
      "float sw=sin(vUv.y*22.+uTime*.35)*.0016+cos(vUv.x*19.-uTime*.28)*.0016;",
      "s+=vec2(sw,-sw*.6);",
      "vec2 d=vUv-uInject.xy;float g=exp(-dot(d,d)/.0018);",
      "s+=uInject.zw*g;",
      "s+=uPar*.0009;",
      "gl_FragColor=vec4(s,0.,1.);}"
    ].join("\n"));
  }

  function buildDust(count) {
    dustCount = count;
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count * 3; i++) arr[i] = Math.random();
    dustGeo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dustGeo);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }

  function resize() {
    if (!canvas) return;
    var w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, degrade >= 3 ? 1 : 1.5);
    W = Math.max(2, Math.round(w * DPR)); H = Math.max(2, Math.round(h * DPR));
    canvas.width = W; canvas.height = H;
    focusX = (W < H) ? 0.66 : 0.5; focusY = 0.5;
    if (sceneTex) { gl.deleteTexture(sceneTex.tx); gl.deleteFramebuffer(sceneTex.fb); sceneTex = null; }
    if (tier === 2) sceneTex = makeRT(W, H, gl.UNSIGNED_BYTE);
    if (CB.onLayout) CB.onLayout(W, H);
  }

  function probeTier() {
    var rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var sd = false, slow = false;
    try { var c = navigator.connection; if (c) { sd = !!c.saveData; slow = /2g/.test(c.effectiveType || ""); } } catch (e) {}
    if (rm || sd || slow || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return 0;
    try {
      var tc = document.createElement("canvas");
      var g2 = tc.getContext("webgl2") || tc.getContext("webgl");
      if (!g2) return 0;
    } catch (e) { return 0; }
    if (matchMedia("(pointer: coarse)").matches) return 1;
    return 2;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  var api = {
    probeTier: probeTier,
    onFrame: function (fn) { CB.onFrame = fn; },
    onSweep: function (fn) { CB.onSweep = fn; },
    onLayout: function (fn) { CB.onLayout = fn; },
    load: function (bgSrc, plSrc) {
      return Promise.all([loadImage(bgSrc), loadImage(plSrc)]).then(function (imgs) {
        api._bg = imgs[0]; api._pl = imgs[1];
        if (imgs[0].naturalHeight) Z = imgs[0].naturalWidth / imgs[0].naturalHeight;
        // hit sampler
        hitC = document.createElement("canvas");
        hitC.width = 256; hitC.height = Math.max(2, Math.round(256 / Z));
        var hx = hitC.getContext("2d", { willReadFrequently: true });
        hx.drawImage(imgs[1], 0, 0, hitC.width, hitC.height);
        api._hit = hx;
        return imgs;
      });
    },
    isSubject: function (nx, ny) {
      if (!api._hit || !hitC) return false;
      var x = Math.min(hitC.width - 1, Math.max(0, Math.round(nx * hitC.width)));
      var y = Math.min(hitC.height - 1, Math.max(0, Math.round(ny * hitC.height)));
      try { return api._hit.getImageData(x, y, 1, 1).data[3] > 110; } catch (e) { return false; }
    },
    setPointer: function (nx, ny) {
      parT.x = Math.max(-0.5, Math.min(0.5, nx));
      parT.y = Math.max(-0.5, Math.min(0.5, ny));
      lastMove = t;
    },
    setScrollParallax: function (x, y) { exitP = Math.max(0, Math.min(1.2, y)); },
    setParallaxEnabled: function (on) { parEnabled = !!on; },
    setVisible: function (v) { ioVisible = !!v; },
    start: function (cv) {
      tier = probeTier();
      if (!tier) throw new Error("hero tier 0");
      canvas = cv;
      gl = cv.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
      if (!gl) { tier = 0; throw new Error("no webgl"); }
      gl.getExtension("OES_texture_half_float");
      buildPrograms();
      // dust fragment (soft disc)
      var dp = gl.createProgram();
      gl.attachShader(dp, sh(gl.VERTEX_SHADER, P.dustVertSrc));
      gl.attachShader(dp, sh(gl.FRAGMENT_SHADER,
        "precision highp float;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float m=smoothstep(.5,.12,length(d));gl_FragColor=vec4(vec3(1.,.886,.706)*vA*m,1.);}"));
      gl.linkProgram(dp);
      P.dustReal = { p: dp, u: { uTime: gl.getUniformLocation(dp, "uTime"), uRes: gl.getUniformLocation(dp, "uRes"), uPx: gl.getUniformLocation(dp, "uPx"), uFade: gl.getUniformLocation(dp, "uFade") }, aSeed: gl.getAttribLocation(dp, "aSeed") };
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      texBg = makeTex(api._bg); texPl = makeTex(api._pl);
      buildDust(tier === 2 ? 500 : 150);
      if (tier === 2) {
        var ext = gl.getExtension("OES_texture_half_float");
        var rt = makeRT(192, 192, ext && ext.HALF_FLOAT_OES ? ext.HALF_FLOAT_OES : gl.UNSIGNED_BYTE);
        var rt2 = makeRT(192, 192, ext && ext.HALF_FLOAT_OES ? ext.HALF_FLOAT_OES : gl.UNSIGNED_BYTE);
        flow = { a: rt, b: rt2 };
      }
      resize();
      addEventListener("resize", resize);
      running = true; lastTs = performance.now();
      raf = requestAnimationFrame(frame);
      return tier;
    },
    stop: function () { running = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); }
  };

  // keep the dust vertex source accessible to start()
  Object.defineProperty(P, "dustVertSrc", { value:
    "attribute vec3 aSeed;uniform float uTime;uniform vec2 uRes;uniform float uPx;uniform float uFade;" +
    "varying float vA;" +
    "void main(){float sp=.008+.02*aSeed.z;" +
    "float y=fract(aSeed.y+uTime*sp);" +
    "float x=fract(aSeed.x+sin(uTime*.11+aSeed.z*17.)*.006+uTime*.0015);" +
    "vec2 uv=vec2(x,y);" +
    "float bc=dot(uv-.5,vec2(-.4226,-.9063));" +
    "float beam=exp(-pow((bc-.46)/.16,2.))+.6*exp(-pow((bc-.66)/.11,2.));" +
    "float fl=.75+.25*sin(uTime*(1.5+aSeed.z*2.)+aSeed.x*40.);" +
    "vA=(.12+.62*min(beam,1.))*fl*mix(.45,1.,aSeed.z)*uFade;" +
    "gl_Position=vec4(uv*2.-1.,0.,1.);" +
    "gl_PointSize=mix(1.4,3.4,aSeed.z)*2.*uPx;}"
  });

  var lastInject = { x: .5, y: .5, vx: 0, vy: 0 };
  function stepFlow() {
    if (!flow || degrade >= 1) return;
    var pr = P.flow, u = pr.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, flow.b.fb);
    gl.viewport(0, 0, 192, 192);
    gl.useProgram(pr.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    var loc = gl.getAttribLocation(pr.p, "aPos");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, flow.a.tx);
    if (u.uPrev) gl.uniform1i(u.uPrev, 0);
    if (u.uTexel) gl.uniform2f(u.uTexel, 1 / 192, 1 / 192);
    if (u.uTime) gl.uniform1f(u.uTime, t);
    var ivx = (par.x - lastInject.x) * 2.2, ivy = (par.y - lastInject.y) * 2.2;
    if (u.uInject) gl.uniform4f(u.uInject, par.x + .5, .5 - par.y, ivx, ivy);
    if (u.uPar) gl.uniform2f(u.uPar, par.x, -par.y);
    lastInject.x = par.x; lastInject.y = par.y;
    drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    var tmp = flow.a; flow.a = flow.b; flow.b = tmp;
  }

  function useProg(pr) {
    gl.useProgram(pr.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    var loc = gl.getAttribLocation(pr.p, "aPos");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return pr.u;
  }
  function bindFlowTex(unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, flow ? flow.a.tx : texBg);
    gl.activeTexture(gl.TEXTURE0);
  }

  function render() {
    var usePost = tier === 2 && degrade < 1 && sceneTex;
    if (usePost) { gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTex.fb); }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.086, 0.075, 0.063, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    var flowOn = (tier === 2 && degrade < 1 && flow) ? 1 : 0;
    // plate
    var u = useProg(P.plate); setCover(P.plate, 1.05, 0.06, 0.07);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texBg);
    if (u.uTex) gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, flow ? flow.a.tx : texBg);
    if (u.uFlow) gl.uniform1i(u.uFlow, 1);
    if (u.uFlowOn) gl.uniform1f(u.uFlowOn, flowOn);
    gl.activeTexture(gl.TEXTURE0);
    drawQuad();
    // beams (additive)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    u = useProg(P.beams); setCover(P.beams, 1.03, 0.35, 0.41);
    if (u.uTime) gl.uniform1f(u.uTime, t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, flow ? flow.a.tx : texBg);
    if (u.uFlow) gl.uniform1i(u.uFlow, 1);
    if (u.uFlowOn) gl.uniform1f(u.uFlowOn, flowOn);
    if (u.uSteer) gl.uniform1f(u.uSteer, tier === 2 ? 1 : 0);
    if (u.uAttract) {
      var pull = parEnabled ? 1 : 0;
      gl.uniform3f(u.uAttract, 0.05 * pull, 0.04 * pull, 0.08 * pull);
    }
    gl.activeTexture(gl.TEXTURE0);
    drawQuad();
    // haze (additive)
    u = useProg(P.haze); setCover(P.haze, 1.04, 0.5, 0.59);
    if (u.uTime) gl.uniform1f(u.uTime, t);
    if (u.uGain) gl.uniform1f(u.uGain, degrade >= 2 ? 0.03 : 0.06);
    if (u.uOct) gl.uniform1f(u.uOct, (tier === 1 || degrade >= 2) ? 1 : 2);
    drawQuad();
    // contact shadow (alpha blend)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    u = useProg(P.shadow); setCover(P.shadow, 1.08, 0.85, 1);
    if (u.uGain) gl.uniform1f(u.uGain, shadowGain);
    drawQuad();
    // player (premultiplied)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    u = useProg(P.player); setCover(P.player, 1.08, 0.85, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPl);
    if (u.uTex) gl.uniform1i(u.uTex, 0);
    if (u.uSweep) gl.uniform1f(u.uSweep, sweep.val);
    drawQuad();
    // dust (additive points)
    var dp = P.dustReal;
    if (dp) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(dp.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustGeo);
      gl.enableVertexAttribArray(dp.aSeed);
      gl.vertexAttribPointer(dp.aSeed, 3, gl.FLOAT, false, 0, 0);
      if (dp.u.uTime) gl.uniform1f(dp.u.uTime, t);
      if (dp.u.uRes) gl.uniform2f(dp.u.uRes, W, H);
      if (dp.u.uPx) gl.uniform1f(dp.u.uPx, DPR);
      if (dp.u.uFade) gl.uniform1f(dp.u.uFade, degrade >= 2 ? 0.5 : 1);
      gl.drawArrays(gl.POINTS, 0, degrade >= 2 ? (dustCount >> 1) : dustCount);
    }
    gl.disable(gl.BLEND);
    if (usePost) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      var g = useProg(P.grain);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex.tx);
      if (g.uTex) gl.uniform1i(g.uTex, 0);
      if (g.uTime) gl.uniform1f(g.uTime, t);
      if (g.uRes) gl.uniform2f(g.uRes, W, H);
      if (g.uAmt) gl.uniform1f(g.uAmt, 0.028 * Math.min(1, t / 0.6 + 0.001));
      drawQuad();
    }
  }

  var frameCount = 0, fpsTimer = 0;
  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    if (!ioVisible || document.hidden) return;
    t += dt;
    // pointer smoothing (time constant 5/s), amp ramp 1.2s
    amp = Math.min(1, amp + dt / 1.2);
    if (!parEnabled) { parT.x = 0; parT.y = 0; }
    if (t - lastMove > 4) { parT.x = Math.sin(t * 0.3) * 0.2; parT.y = Math.cos(t * 0.23) * 0.2; }
    var k = 1 - Math.exp(-5 * dt);
    par.x += (parT.x - par.x) * k; par.y += (parT.y - par.y) * k;
    // shadow gain relax
    var tgt = Math.min(1, Math.hypot(par.x, par.y) * 2 * 2.5);
    shadowGain += (tgt - shadowGain) * Math.min(1, 3 * dt);
    // sweep scheduler
    if (!sweep.active && t >= sweep.next) {
      sweep.active = true; sweep.start = t;
      if (CB.onSweep) CB.onSweep();
    }
    if (sweep.active) {
      var sp = (t - sweep.start) / 3.2;
      if (sp >= 1) { sweep.active = false; sweep.val = -1; sweep.next = t + 11 + Math.random() * 5; }
      else { var ss = sp * sp * (3 - 2 * sp); sweep.val = -0.15 + 1.3 * ss; }
    }
    stepFlow();
    render();
    // governor
    gov.frames++; gov.winT += dt; frameCount++; fpsTimer += dt;
    if (fpsTimer > 0.5) {
      if (CB.onFrame) CB.onFrame({ fps: Math.round(frameCount / fpsTimer) });
      frameCount = 0; fpsTimer = 0;
    }
    if (gov.winT >= 2) {
      var fps = gov.frames / gov.winT;
      gov.wins.push(fps); if (gov.wins.length > 3) gov.wins.shift();
      if (!gov.base) gov.base = fps;
      var sorted = gov.wins.slice().sort(function (a, b) { return a - b; });
      var med = sorted[Math.floor(sorted.length / 2)];
      if (gov.base > 35 && med < gov.base * 0.72 && med < 55) {
        gov.bad++;
        if (gov.bad >= 2 && degrade < 3) { degrade++; gov.bad = 0; if (degrade === 3) resize(); }
      } else gov.bad = 0;
      gov.frames = 0; gov.winT = 0;
    }
  }

  return api;
})();
