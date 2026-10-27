/*!
 * mh-world.js — "persistent world + hero object" layer for HyperFrames (needs gsap + mh-motion.js first).
 *
 * The idea (learned from studying a dense reference edit, not copied from it): a rich film has
 *   1. ONE persistent world every scene sits in (sky/ground, light, drifting depth layers),
 *   2. persistent chrome (HUD: title, route/progress strip, "now" chip) and captions,
 *   3. a HERO OBJECT per beat (gauge, path + traveler, 3D stage, callout panel, readout) — never text alone.
 * These builders create DOM at build time from data and seeded randomness (deterministic), and return
 * handles; motion is always added to a timeline you pass in, so scrubbing is exact.
 *
 * Groups: W.sky / W.skyMotion, W.hud, W.callout (+In/Out), W.gauge (+To), W.path / W.travel,
 *         W.stage3d / W.cube / W.cubeFlow / W.floor / W.orbit3d, W.drum, W.captions
 * Docs: motion-lib/README.md (World section).
 */
(function () {
  "use strict";
  var MH = window.MH, gsap = window.gsap;
  if (!MH || !gsap) throw new Error("mh-world: load gsap and mh-motion.js first");
  var NS = "http://www.w3.org/2000/svg";
  var W = (MH.world = {});

  /* ------------------------------------------------------------ helpers */
  /** Seeded PRNG (mulberry32): W.rng(7)() -> [0,1). Never use Math.random. */
  W.rng = function (seed) {
    seed = seed | 0;
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** DOM builder. tag "svg:circle" makes an SVG element. attrs: text, html, style(object), others set as attributes. */
  W.el = function (tag, attrs, parent) {
    var e = tag.indexOf("svg:") === 0 ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if ((k === "fill" || k === "stroke") && String(v).indexOf("var(") === 0) e.style[k] = v; // var() resolves reliably as a style, not an SVG attribute
      else e.setAttribute(k, v);
    });
    if (parent) parent.appendChild(e);
    return e;
  };
  function $(t) { return typeof t === "string" ? document.querySelector(t) : t; }
  function css(v, fb) { return v || fb; }

  /* ---------------------------------------------------------------- sky */
  /**
   * Persistent background world: gradient + soft directional light + N parallax cloud bands + drifting motes.
   * o: {seed, bands:3, motes:28, light:true|false, lightX:"84%", lightY:"6%"}
   * Colours come from tokens: --mh-sky-top, --mh-sky-bottom, --mh-cloud, --mh-light, --mh-mote.
   */
  W.sky = function (root, o) {
    o = o || {}; root = $(root);
    var r = W.rng(o.seed || 11), box = W.el("div", { class: "mh-sky", "data-layout-allow-overflow": "" }, root);
    if (o.light !== false) W.el("div", { class: "mh-sky-light", style: { left: o.lightX || "84%", top: o.lightY || "6%" } }, box);
    var bands = [], n = o.bands || 3;
    for (var b = 0; b < n; b++) {
      var depth = (b + 1) / n; // 0..1, nearer bands are bigger and move more
      var svg = W.el("svg:svg", { class: "mh-sky-band", viewBox: "0 0 2600 360", width: 2600, height: 360, "data-layout-allow-overflow": "" }, box);
      svg.style.top = 1080 - 150 - b * 170 + "px"; svg.style.opacity = String(0.35 + depth * 0.45);
      for (var i = 0; i < 16; i++) {
        var cx = i * 170 + r() * 90, cy = 200 + r() * 90 - depth * 30, rx = 170 + r() * 150, ry = 46 + r() * 52 * (0.6 + depth);
        W.el("svg:ellipse", { cx: cx, cy: cy, rx: rx, ry: ry, fill: "var(--mh-cloud)" }, svg);
      }
      bands.push({ el: svg, depth: depth });
    }
    var motes = [], m = o.motes == null ? 28 : o.motes;
    for (var k = 0; k < m; k++) {
      var d = W.el("div", { class: "mh-mote" }, box), s = 3 + r() * 5;
      d.style.cssText = "left:" + (r() * 1920).toFixed(0) + "px;top:" + (60 + r() * 760).toFixed(0) + "px;width:" + s + "px;height:" + s + "px";
      motes.push({ el: d, dy: -(30 + r() * 90), dx: 20 + r() * 60, ph: r() });
    }
    return { box: box, bands: bands, motes: motes };
  };
  /** Slow drift for the whole film: bands slide by depth, motes rise and twinkle. dur = film length (s). */
  W.skyMotion = function (tl, sky, dur) {
    sky.bands.forEach(function (b) { tl.fromTo(b.el, { x: 0 }, { x: -(180 + 520 * b.depth), duration: dur, ease: "none" }, 0); });
    sky.motes.forEach(function (m) {
      tl.fromTo(m.el, { x: 0, y: 0, opacity: 0.15 + m.ph * 0.3 }, { x: m.dx, y: m.dy, opacity: 0.55, duration: dur, ease: "none" }, 0);
    });
  };

  /* ---------------------------------------------------------------- HUD */
  /**
   * Persistent chrome: title (top-left), route strip (bottom) with progress line, waypoint diamonds, and a
   * "now" chip showing the current waypoint number + label. Waypoints use global film seconds (hud mounted at 0).
   * o: {title, waypoints:[{t,label}], end (film seconds), x0:360, x1:1560, y:1050}
   * returns {animate(tl)} — call once.
   */
  W.hud = function (root, o) {
    root = $(root);
    var x0 = o.x0 || 360, x1 = o.x1 || 1560, y = o.y || 1050, end = o.end, wp = o.waypoints;
    var head = W.el("div", { class: "mh-hud-head" }, root);
    W.el("span", { class: "mh-hud-mark" }, head);
    W.el("span", { class: "mh-hud-title", text: o.title }, head);
    var svg = W.el("svg:svg", { class: "mh-hud-route", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, root);
    W.el("svg:path", { d: "M" + x0 + " " + y + "H" + x1, stroke: "var(--mh-line)", "stroke-width": 3, "stroke-dasharray": "2 10", "stroke-linecap": "round", fill: "none" }, svg);
    var line = W.el("svg:path", { d: "M" + x0 + " " + y + "H" + x1, stroke: "var(--mh-accent)", "stroke-width": 4, "stroke-linecap": "round", fill: "none" }, svg);
    var xAt = function (t) { return x0 + (t / end) * (x1 - x0); };
    var dots = wp.map(function (p) {
      var x = xAt(p.t);
      return W.el("svg:rect", { x: x - 8, y: y - 8, width: 16, height: 16, transform: "rotate(45 " + x + " " + y + ")", fill: "var(--mh-surface)", stroke: "var(--mh-ink)", "stroke-width": 2.5 }, svg);
    });
    var now = W.el("div", { class: "mh-chip mh-hud-now" }, root);
    var num = W.el("b", { text: "01" }, now), lbl = W.el("span", { text: wp[0].label }, now);
    var jet = W.el("div", { class: "mh-hud-jet" }, root);
    return {
      animate: function (tl) {
        var len = x1 - x0, prog = { t: 0 };
        line.style.strokeDasharray = String(len);
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "none" }, 0);
        tl.fromTo(prog, { t: 0 }, { t: end, duration: end, ease: "none", onUpdate: function () {
          var x = xAt(prog.t);
          jet.style.transform = "translate(" + (x - 9).toFixed(1) + "px," + (y - 9) + "px) rotate(45deg)";
          now.style.transform = "translate(" + (x + 26).toFixed(1) + "px," + (y - 56) + "px)";
          line.style.strokeDashoffset = String((len - (x - x0)).toFixed(1));
        } }, 0);
        wp.forEach(function (p, i) {
          tl.fromTo(dots[i], { fill: "#122340" }, { fill: "var(--mh-accent)", duration: 0.3, ease: "none", immediateRender: false }, p.t);
          tl.call(function () { num.textContent = (i < 9 ? "0" : "") + (i + 1); lbl.textContent = p.label; }, null, p.t);
        });
      }
    };
  };

  /* ------------------------------------------------------------ callout */
  /**
   * In-world annotation: anchor dot + ring pulse → leader line → panel (kicker, value, note).
   * o: {x,y (anchor), lx,ly (panel top-left), w, kicker, value, note, tone:"accent"|"cold"|"ink"}
   */
  W.callout = function (root, o) {
    root = $(root);
    var tone = o.tone === "cold" ? "var(--mh-cold)" : o.tone === "ink" ? "var(--mh-ink)" : "var(--mh-accent)";
    var svg = W.el("svg:svg", { class: "mh-callout-svg", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, root);
    var ex = o.lx + (o.lx > o.x ? 0 : o.w), ey = o.ly + 28;
    var line = W.el("svg:path", { d: "M" + o.x + " " + o.y + "L" + ex + " " + ey, stroke: "var(--mh-ink)", "stroke-width": 2.5, fill: "none" }, svg);
    var ring = W.el("svg:circle", { cx: o.x, cy: o.y, r: 16, fill: "none", stroke: tone, "stroke-width": 3 }, svg);
    var dot = W.el("svg:circle", { cx: o.x, cy: o.y, r: 7, fill: tone }, svg);
    var box = W.el("div", { class: "mh-panel mh-callout", style: { left: o.lx + "px", top: o.ly + "px", width: o.w + "px" } }, root);
    var bar = W.el("span", { class: "mh-panel-bar" }, box); bar.style.background = tone;
    if (o.kicker) W.el("div", { class: "mh-kicker", text: o.kicker, style: { color: tone } }, box);
    var val = o.value !== undefined ? W.el("div", { class: "mh-value", html: o.value }, box) : null;
    if (o.note) W.el("div", { class: "mh-note", html: o.note }, box);
    var len = Math.hypot(ex - o.x, ey - o.y);
    line.style.strokeDasharray = String(len); line.style.strokeDashoffset = String(len);
    box.style.transformOrigin = o.lx > o.x ? "0% 50%" : "100% 50%";
    return { o: o, svg: svg, line: line, ring: ring, dot: dot, box: box, value: val, len: len };
  };
  W.calloutIn = function (tl, g, t) {
    var o = g.o, so = o.x + " " + o.y;
    tl.fromTo(g.dot, { scale: 0, svgOrigin: so }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, t);
    tl.fromTo(g.ring, { scale: 0.3, opacity: 1, svgOrigin: so }, { scale: 2.2, opacity: 0, duration: 0.9, ease: "power2.out" }, t);
    tl.fromTo(g.line, { strokeDashoffset: g.len }, { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" }, t + 0.12);
    tl.fromTo(g.box, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.45, ease: "expo.out" }, t + 0.38);
    tl.fromTo(Array.prototype.slice.call(g.box.children, 1), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", stagger: 0.06 }, t + 0.5);
    return t + 0.9;
  };
  W.calloutOut = function (tl, g, t) { tl.to([g.box, g.line, g.dot], { opacity: 0, duration: 0.3, ease: "power2.in" }, t); return t + 0.3; };

  /* ------------------------------------------------------------- drum */
  /** Odometer readout. W.drum(box, digits, {unit, sign}) → {set(v)}; tween a proxy and call set(v) in onUpdate. */
  W.drum = function (box, digits, o) {
    o = o || {}; box = $(box); box.classList.add("mh-drum");
    var sign = o.sign ? W.el("span", { class: "mh-sign" }, box) : null, cols = [];
    for (var i = digits - 1; i >= 0; i--) {
      var col = W.el("span", { class: "mh-col" }, box), strip = W.el("span", { class: "mh-strip" }, col);
      for (var d = 0; d <= 10; d++) W.el("span", { class: "mh-cell", text: String(d % 10) }, strip);
      cols.push({ i: i, strip: strip });
    }
    if (o.unit) W.el("span", { class: "mh-unit", text: o.unit }, box);
    function set(v) {
      var a = Math.abs(v);
      if (sign) sign.textContent = v < -0.5 ? "−" : "";
      cols.forEach(function (c) {
        var p10 = Math.pow(10, c.i), dd = Math.floor(a / p10) % 10, rem = a % p10, cs = p10 - 1;
        var f = c.i === 0 ? a % 1 : rem > cs ? rem - cs : 0;
        c.strip.style.transform = "translateY(" + ((-(dd + f) * 100) / 11) + "%)";
      });
    }
    set(o.start || 0);
    return { set: set };
  };
  /** Tween a drum: W.drumTo(tl, drum, from, to, at, dur) */
  W.drumTo = function (tl, drum, from, to, at, dur) {
    var p = { v: from };
    tl.fromTo(p, { v: from }, { v: to, duration: dur, ease: MH.cfg.ease.snap, onUpdate: function () { drum.set(p.v); } }, at);
    return at + dur;
  };

  /* -------------------------------------------------------------- gauge */
  /**
   * Dial gauge (SVG). o: {size:420, min, max, a0:-135, a1:135, ticks:8, unit, label, bands:[{from,to,color}], decimals:0}
   * returns {el, set(v)}. Animate with W.gaugeTo.
   */
  W.gauge = function (root, o) {
    root = $(root);
    var S = o.size || 420, c = S / 2, R = S * 0.42, a0 = o.a0 == null ? -135 : o.a0, a1 = o.a1 == null ? 135 : o.a1;
    var svg = W.el("svg:svg", { class: "mh-gauge", viewBox: "0 0 " + S + " " + S, width: S, height: S }, root);
    var pol = function (a, r) { var t = (a - 90) * Math.PI / 180; return [c + r * Math.cos(t), c + r * Math.sin(t)]; };
    var arc = function (A, B, r) { var p = pol(A, r), q = pol(B, r); return "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + "A" + r + " " + r + " 0 " + (B - A > 180 ? 1 : 0) + " 1 " + q[0].toFixed(1) + " " + q[1].toFixed(1); };
    W.el("svg:circle", { cx: c, cy: c, r: S * 0.49, fill: "var(--mh-panel)", stroke: "var(--mh-line)", "stroke-width": 3 }, svg);
    W.el("svg:path", { d: arc(a0, a1, R), stroke: "var(--mh-line)", "stroke-width": 14, fill: "none", "stroke-linecap": "round" }, svg);
    var aOf = function (v) { return a0 + ((v - o.min) / (o.max - o.min)) * (a1 - a0); };
    (o.bands || []).forEach(function (b) { W.el("svg:path", { d: arc(aOf(b.from), aOf(b.to), R), stroke: b.color, "stroke-width": 14, fill: "none" }, svg); });
    var n = o.ticks || 8;
    for (var i = 0; i <= n; i++) {
      var a = a0 + (i / n) * (a1 - a0), p = pol(a, R - 18), q = pol(a, R - 36), tx = pol(a, R - 62);
      W.el("svg:path", { d: "M" + p[0] + " " + p[1] + "L" + q[0] + " " + q[1], stroke: "var(--mh-ink)", "stroke-width": 3 }, svg);
      W.el("svg:text", { x: tx[0], y: tx[1] + 9, "text-anchor": "middle", class: "mh-gauge-t", text: String(Math.round(o.min + (i / n) * (o.max - o.min))) }, svg);
    }
    // label and readout sit in the open bottom of the dial (a0/a1 leave that gap); keep labels short (<= ~12 chars)
    if (o.label) W.el("svg:text", { x: c, y: c + S * 0.27, "text-anchor": "middle", class: "mh-gauge-l", text: o.label }, svg);
    var read = W.el("svg:text", { x: c, y: c + S * 0.4, "text-anchor": "middle", class: "mh-gauge-v", text: "" }, svg);
    var needle = W.el("svg:g", {}, svg);
    W.el("svg:path", { d: "M" + c + " " + (c - R + 14) + "L" + (c + 9) + " " + c + "L" + (c - 9) + " " + c + "Z", fill: "var(--mh-accent)" }, needle);
    W.el("svg:circle", { cx: c, cy: c, r: 14, fill: "var(--mh-ink)" }, svg);
    var dec = o.decimals || 0;
    function set(v) {
      needle.setAttribute("transform", "rotate(" + aOf(Math.max(o.min, Math.min(o.max, v))).toFixed(2) + " " + c + " " + c + ")");
      read.textContent = v.toFixed(dec) + (o.unit ? " " + o.unit : "");
    }
    set(o.min);
    return { el: svg, set: set };
  };
  /** W.gaugeTo(tl, gauge, from, to, at, dur, ease) */
  W.gaugeTo = function (tl, g, from, to, at, dur, ease) {
    var p = { v: from };
    tl.fromTo(p, { v: from }, { v: to, duration: dur, ease: ease || MH.cfg.ease.move, onUpdate: function () { g.set(p.v); } }, at);
    return at + dur;
  };

  /* ---------------------------------------------- path + traveler (flight path, tide curve, route) */
  /**
   * A guide path with a traveler that rides it and a solid trail drawn behind it.
   * o: {d, viewBox:"0 0 1920 1080", stroke, width, dash:"4 14", traveler:"<svg markup>" | "dot", size:46}
   * returns {svg, path, trail, traveler, len}. Animate with W.travel.
   */
  W.path = function (root, o) {
    root = $(root);
    var svg = W.el("svg:svg", { class: "mh-path-svg", viewBox: o.viewBox || "0 0 1920 1080", width: 1920, height: 1080 }, root);
    var path = W.el("svg:path", { d: o.d, fill: "none", stroke: "var(--mh-line)", "stroke-width": o.width || 3, "stroke-dasharray": o.dash || "4 14", "stroke-linecap": "round" }, svg);
    var trail = W.el("svg:path", { d: o.d, fill: "none", stroke: o.stroke || "var(--mh-accent)", "stroke-width": (o.width || 3) + 2, "stroke-linecap": "round" }, svg);
    var len = path.getTotalLength(); trail.style.strokeDasharray = String(len); trail.style.strokeDashoffset = String(len);
    var tr = W.el("div", { class: "mh-traveler", style: { width: (o.size || 46) + "px", height: (o.size || 46) + "px" } }, root);
    if (o.traveler && o.traveler !== "dot") tr.innerHTML = o.traveler; else tr.classList.add("mh-traveler-dot");
    return { svg: svg, path: path, trail: trail, traveler: tr, len: len, size: o.size || 46, vb: o.viewBox || "0 0 1920 1080" };
  };
  /** Move the traveler along the path from u0 to u1 (0..1), trail follows. o: {at, dur, from:0, to:1, ease, orient:true} */
  W.travel = function (tl, p, o) {
    o = o || {}; var prog = { u: o.from || 0 }, h = p.size / 2;
    var apply = function () {
      var L = p.len * prog.u, a = p.path.getPointAtLength(L), b = p.path.getPointAtLength(Math.min(p.len, L + 2));
      var ang = o.orient === false ? 0 : Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      p.traveler.style.transform = "translate(" + (a.x - h).toFixed(1) + "px," + (a.y - h).toFixed(1) + "px) rotate(" + ang.toFixed(1) + "deg)";
      p.trail.style.strokeDashoffset = String((p.len - L).toFixed(1));
    };
    apply();
    tl.fromTo(prog, { u: o.from || 0 }, { u: o.to == null ? 1 : o.to, duration: o.dur || 3, ease: o.ease || MH.cfg.ease.soft, onUpdate: apply }, o.at || 0);
    return (o.at || 0) + (o.dur || 3);
  };

  /* ---------------------------------------------------------- 3D stage */
  /**
   * CSS-3D stage (no WebGL dependency, seekable). Returns {stage, world}: put 3D children in `world`.
   * o: {w:1920, h:1080, perspective:1400, x:0, y:0}
   */
  W.stage3d = function (root, o) {
    o = o || {}; root = $(root);
    var stage = W.el("div", { class: "mh-stage", style: { left: (o.x || 0) + "px", top: (o.y || 0) + "px", width: (o.w || 1920) + "px", height: (o.h || 1080) + "px", perspective: (o.perspective || 1400) + "px" } }, root);
    var world = W.el("div", { class: "mh-world3d" }, stage);
    return { stage: stage, world: world };
  };
  /** Wireframe cube with seeded particles. o: {size:420, particles:90, seed, edge, dot, x,y,z} returns {el, dots, size} */
  W.cube = function (world, o) {
    o = o || {}; world = $(world);
    var S = o.size || 420, h = S / 2, r = W.rng(o.seed || 5);
    var cube = W.el("div", { class: "mh-cube", style: { width: S + "px", height: S + "px", left: (o.x || 0) + "px", top: (o.y || 0) + "px" } }, world);
    [["rotateY(0deg)", h], ["rotateY(180deg)", h], ["rotateY(90deg)", h], ["rotateY(-90deg)", h], ["rotateX(90deg)", h], ["rotateX(-90deg)", h]].forEach(function (f) {
      W.el("div", { class: "mh-face", style: { transform: f[0] + " translateZ(" + f[1] + "px)" } }, cube);
    });
    var dots = [], n = o.particles == null ? 90 : o.particles;
    for (var i = 0; i < n; i++) {
      var d = W.el("span", { class: "mh-dot3d" }, cube);
      var p = { x: (r() - 0.5) * (S - 40), y: (r() - 0.5) * (S - 40), z: (r() - 0.5) * (S - 40), vx: r() - 0.5, vy: r() - 0.5, vz: r() - 0.5 };
      d.style.transform = "translate3d(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px," + p.z.toFixed(1) + "px)";
      dots.push({ el: d, p: p });
    }
    return { el: cube, dots: dots, size: S };
  };
  /** Particle motion inside the cube: amplitude in px = "temperature". Tween 0→1 then particles sway; no randomness at runtime. */
  W.cubeFlow = function (tl, cube, o) {
    o = o || {}; var amp = o.amplitude || 40, S = cube.size, lim = (S - 40) / 2;
    cube.dots.forEach(function (d) {
      var tx = Math.max(-lim, Math.min(lim, d.p.x + d.p.vx * amp * 2)), ty = Math.max(-lim, Math.min(lim, d.p.y + d.p.vy * amp * 2)), tz = Math.max(-lim, Math.min(lim, d.p.z + d.p.vz * amp * 2));
      tl.fromTo(d.el, { x: 0, y: 0, z: 0 }, { x: tx - d.p.x, y: ty - d.p.y, z: tz - d.p.z, duration: o.dur || 3, ease: "sine.inOut" }, o.at || 0);
    });
    return (o.at || 0) + (o.dur || 3);
  };
  /** Perspective floor with soft bands (a surface to stand 3D objects on). o: {w:2400, h:900, rx:68, y:560, bands:12} */
  W.floor = function (world, o) {
    o = o || {}; world = $(world);
    var f = W.el("div", { class: "mh-floor", style: { width: (o.w || 2400) + "px", height: (o.h || 900) + "px", left: (960 - (o.w || 2400) / 2) + "px", top: (o.y || 560) + "px", transform: "rotateX(" + (o.rx || 68) + "deg)" } }, world);
    for (var i = 0; i < (o.bands || 12); i++) W.el("i", { style: { top: (i * (100 / (o.bands || 12))) + "%", height: (50 / (o.bands || 12)) + "%" } }, f);
    return f;
  };
  /** Camera move for a stage's world: rotation / zoom between two states. o: {at,dur,from:{ry,rx,z},to:{ry,rx,z},ease} */
  W.orbit3d = function (tl, s, o) {
    var f = o.from || {}, t = o.to || {};
    tl.fromTo(s.world, { rotationY: f.ry || 0, rotationX: f.rx || 0, z: f.z || 0 }, { rotationY: t.ry || 0, rotationX: t.rx || 0, z: t.z || 0, duration: o.dur || 4, ease: o.ease || MH.cfg.ease.soft, transformOrigin: "50% 50%" }, o.at || 0);
    return (o.at || 0) + (o.dur || 4);
  };
  /** Card entrance from a 3D angle: W.tilt3d(tl, el, {at, from:{ry:-35,rx:8}, dur}) — avoid flat cards. */
  W.tilt3d = function (tl, el, o) {
    o = o || {}; var f = o.from || { ry: -32, rx: 6 };
    tl.fromTo(el, { opacity: 0, rotationY: f.ry, rotationX: f.rx, transformPerspective: 1100, transformOrigin: "0% 50%" }, { opacity: 1, rotationY: 0, rotationX: 0, duration: o.dur || 0.7, ease: MH.cfg.ease.enter }, o.at || 0);
    return (o.at || 0) + (o.dur || 0.7);
  };

  /* ------------------------------------------------------------ captions */
  /**
   * Karaoke captions from word timings (global film seconds). Needs REAL timing (hyperframes transcribe → mh cues)
   * or clearly-labelled synthetic timing. Builds phrase groups and returns a handle; call W.captions.animate once.
   * words: [{t,end,text}]   o: {maxWords:7, maxChars:46, gap:0.5, bottom:92}
   */
  W.captions = {
    build: function (root, words, o) {
      o = o || {}; root = $(root);
      var groups = [], cur = [], chars = 0;
      var flush = function () { if (cur.length) { groups.push(cur); cur = []; chars = 0; } };
      words.forEach(function (w, i) {
        var prev = words[i - 1];
        if (cur.length && (cur.length >= (o.maxWords || 7) || chars + w.text.length > (o.maxChars || 46) || w.t - prev.end > (o.gap || 0.5))) flush();
        cur.push(w); chars += w.text.length + 1;
        if (/[.?!]$/.test(w.text)) flush();
      });
      flush();
      var out = groups.map(function (g) {
        var box = W.el("div", { class: "mh-cap", style: { bottom: (o.bottom || 92) + "px" } }, root);
        gsap.set(box, { xPercent: -50 }); // centre with GSAP so it does not fight the y tween
        var spans = g.map(function (w) { return W.el("span", { class: "mh-cap-w", text: w.text }, box); });
        return { box: box, spans: spans, words: g };
      });
      return { groups: out };
    },
    /**
     * Groups never overlap in time: with a pause >= 0.35 s between groups they fade out/in; with a shorter gap
     * (same sentence continuing) they swap instantly. Only the active word is underlined; spoken words stay lit.
     */
    animate: function (tl, built) {
      var G = built.groups, FADE = 0.35;
      G.forEach(function (g, i) {
        var prev = G[i - 1], next = G[i + 1];
        var t0 = g.words[0].t, t1 = g.words[g.words.length - 1].end;
        var gapPrev = prev ? t0 - prev.words[prev.words.length - 1].end : 9, gapNext = next ? next.words[0].t - t1 : 9;
        if (gapPrev >= FADE) tl.fromTo(g.box, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.18, ease: MH.cfg.ease.enter }, Math.max(0, t0 - 0.08));
        else { tl.set(g.box, { opacity: 0, y: 0 }, 0); tl.set(g.box, { opacity: 1, y: 0 }, t0 - 0.01); }
        g.spans.forEach(function (s, k) {
          var w = g.words[k], nextT = k + 1 < g.words.length ? g.words[k + 1].t : w.end + 0.12;
          tl.fromTo(s, { color: "var(--mh-muted)" }, { color: "var(--mh-ink)", duration: 0.08, ease: "none", immediateRender: false }, w.t);
          tl.fromTo(s, { "--u": 0 }, { "--u": 1, duration: 0.12, ease: MH.cfg.ease.snap, immediateRender: false }, w.t);
          tl.to(s, { "--u": 0, duration: 0.1, ease: "none" }, Math.max(w.t + 0.13, nextT - 0.02));
        });
        if (gapNext >= FADE) tl.to(g.box, { opacity: 0, y: -8, duration: 0.15, ease: MH.cfg.ease.exit }, t1 + 0.12);
        else tl.set(g.box, { opacity: 0 }, next.words[0].t - 0.011);
      });
    }
  };
})();
