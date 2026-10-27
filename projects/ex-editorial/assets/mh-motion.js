/*!
 * mh-motion.js — small, deterministic motion-design library for HyperFrames.
 *
 * Load once from index.html AFTER gsap:
 *   <script src="assets/mh-motion.js"></script>
 * Scenes then use window.MH inside their own <template><script>.
 *
 * Rules this library obeys (HyperFrames contract):
 *  - everything is a tween on a paused timeline you pass in; nothing runs by itself
 *  - no Date.now / Math.random / timers / repeat:-1
 *  - tweens use fromTo so seek-back is exact
 *  - nothing tweens display/visibility on a .clip
 *
 * Every primitive: MH.<group>.<name>(tl, target, opts) -> returns the end time (seconds)
 * so you can chain:  let t = MH.type.reveal(tl, "#h", {at: 0.3}); MH.type.reveal(tl, "#s", {at: t - 0.2});
 * Full docs: motion-lib/README.md
 */
(function () {
  "use strict";
  var g = window.gsap;
  if (!g) throw new Error("mh-motion: load gsap first");

  var cfg = {
    fps: 30,
    // named easing roles — use roles, not raw ease strings, so a project stays consistent
    ease: {
      enter: "power3.out", // things arriving
      exit: "power2.in", // things leaving
      move: "power2.inOut", // things repositioning
      snap: "expo.out", // fast, decisive settle
      soft: "sine.inOut", // slow ambient drift
      draw: "power1.inOut" // line drawing
    },
    // durations in frames; converted with cfg.fps
    dur: { micro: 6, short: 12, base: 18, long: 30, scene: 24 },
    stagger: { chars: 1, words: 3, lines: 5, items: 4 }, // frames between siblings
    exitLead: 0.0
  };

  function F(n) { return n / cfg.fps; }
  function E(role) { return cfg.ease[role] || role || cfg.ease.enter; }
  function D(v, fallbackKey) {
    if (v == null) return F(cfg.dur[fallbackKey || "base"]);
    return v; // seconds when passed explicitly
  }
  function els(t) {
    if (typeof t === "string") return Array.prototype.slice.call(document.querySelectorAll(t));
    if (t instanceof Element) return [t];
    return Array.prototype.slice.call(t || []);
  }

  var MH = { cfg: cfg, F: F };

  /** Override config: MH.configure({fps:30, ease:{enter:"expo.out"}, dur:{base:20}}) */
  MH.configure = function (o) {
    o = o || {};
    ["ease", "dur", "stagger"].forEach(function (k) {
      if (o[k]) Object.keys(o[k]).forEach(function (kk) { cfg[k][kk] = o[k][kk]; });
    });
    if (o.fps) cfg.fps = o.fps;
    return MH;
  };

  /* ---------------------------------------------------------------- timing */
  MH.timing = {
    /** frames -> seconds */
    frames: F,
    /** seconds of delay for item i given a stagger in frames */
    stagger: function (i, frames) { return i * F(frames == null ? cfg.stagger.items : frames); },
    /**
     * Entrance/exit window for a clip that lives in [start, start+dur):
     * returns {inAt, outAt} so the exit lands just BEFORE the clip ends.
     */
    window: function (start, dur, inFrames, outFrames) {
      var o = F(outFrames == null ? cfg.dur.short : outFrames);
      return { inAt: start, outAt: Math.max(start, start + dur - o - F(1)), outDur: o };
    },
    /** Snap a time to the nearest cue (beat, word start …) within `tol` seconds. */
    snap: function (t, cues, tol) {
      tol = tol == null ? 0.12 : tol;
      var best = t, d = tol + 1;
      (cues || []).forEach(function (c) {
        var dd = Math.abs(c - t);
        if (dd < d && dd <= tol) { d = dd; best = c; }
      });
      return best;
    }
  };

  /* ------------------------------------------------------------------ type */
  /**
   * Split an element's text into spans, deterministically (no randomness).
   * mode: "chars" | "words" | "lines-by-br" (split on <br>)
   * Each unit is wrapped in an overflow-clipping mask (.mh-mask > .mh-unit) when mask:true,
   * so units can slide up from behind an invisible edge.
   * Idempotent: calling twice on the same element returns the existing units.
   */
  MH.type = {};
  MH.type.split = function (target, mode, mask) {
    var el = els(target)[0];
    if (!el) throw new Error("mh.type.split: no element for " + target);
    if (el.__mhUnits) return el.__mhUnits;
    mode = mode || "words";
    var units = [];
    var make = function (txt) {
      var u = document.createElement("span");
      u.className = "mh-unit";
      u.textContent = txt;
      u.style.display = "inline-block";
      u.style.willChange = "transform";
      if (!mask) return { outer: u, unit: u };
      var m = document.createElement("span");
      m.className = "mh-mask";
      m.setAttribute("data-layout-allow-overflow", ""); // the mask is an intentional clip edge
      m.style.display = "inline-block";
      m.style.overflow = "hidden";
      m.style.verticalAlign = "top";
      m.style.paddingBottom = "0.12em"; // keep descenders
      m.style.marginBottom = "-0.12em";
      m.appendChild(u);
      return { outer: m, unit: u };
    };
    var frag = document.createDocumentFragment();
    var nodes = Array.prototype.slice.call(el.childNodes);
    var label = el.textContent;
    el.setAttribute("aria-label", label);
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var text = n.textContent;
        if (mode === "chars") {
          text.split("").forEach(function (ch) {
            if (ch === " ") { frag.appendChild(document.createTextNode(" ")); return; }
            var o = make(ch); units.push(o.unit); frag.appendChild(o.outer);
          });
        } else {
          text.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); return; }
            var o = make(w); units.push(o.unit); frag.appendChild(o.outer);
          });
        }
      } else if (n.nodeType === 1 && n.tagName === "BR") {
        frag.appendChild(n.cloneNode());
      } else if (n.nodeType === 1) {
        // keep inline elements (accent spans) as one unit
        var o2 = make(""); o2.unit.textContent = ""; o2.unit.appendChild(n.cloneNode(true));
        units.push(o2.unit); frag.appendChild(o2.outer);
      }
    });
    el.textContent = "";
    el.appendChild(frag);
    el.__mhUnits = units;
    return units;
  };

  /**
   * Staggered masked reveal — the workhorse editorial headline.
   * opts: at, mode("words"|"chars"), mask(true), from("up"|"down"|"left"|"right"), stagger(frames),
   *       dur(seconds), ease(role), distance("110%"), tracking({from:"0.08em", to:"-0.02em"})
   */
  MH.type.reveal = function (tl, target, o) {
    o = o || {};
    var mode = o.mode || "words";
    var mask = o.mask !== false;
    var units = MH.type.split(target, mode, mask);
    // o.skip: leave the first N units static so the opening frame (thumbnail) already shows the subject
    if (o.skip) units = units.slice(o.skip);
    var d = D(o.dur, "base");
    var step = F(o.stagger == null ? cfg.stagger[mode] || 3 : o.stagger);
    var dist = o.distance || "110%";
    var from = { opacity: mask ? 1 : 0 };
    if (o.from === "down") from.yPercent = "-" + dist.replace("%", "");
    else if (o.from === "left") from.xPercent = "-" + dist.replace("%", "");
    else if (o.from === "right") from.xPercent = dist.replace("%", "");
    else from.yPercent = dist.replace("%", "");
    var to = { opacity: 1, yPercent: 0, xPercent: 0, duration: d, ease: E(o.ease || "enter"), stagger: step };
    tl.fromTo(units, from, to, o.at || 0);
    if (o.tracking) MH.type.tracking(tl, target, { from: o.tracking.from, to: o.tracking.to, at: o.at || 0, dur: d + step * units.length });
    return (o.at || 0) + d + step * Math.max(0, units.length - 1);
  };

  /** Letter-spacing change over time (tracking settle). */
  MH.type.tracking = function (tl, target, o) {
    o = o || {};
    var d = D(o.dur, "long");
    tl.fromTo(target, { letterSpacing: o.from || "0.1em" }, { letterSpacing: o.to || "-0.02em", duration: d, ease: E(o.ease || "enter") }, o.at || 0);
    return (o.at || 0) + d;
  };

  /**
   * Kinetic emphasis on ONE word: a quick scale/weight punch, then settle. For meaning, not decoration.
   * Target must be a single element (e.g. <span id="x-key">). Uses scale only (no CSS transform conflict).
   */
  MH.type.punch = function (tl, target, o) {
    o = o || {};
    var at = o.at || 0, s = o.scale || 1.12;
    tl.fromTo(target, { scale: 1 }, { scale: s, duration: F(4), ease: E("snap") }, at);
    tl.to(target, { scale: 1, duration: F(8), ease: E("move") }, at + F(4));
    if (o.color) tl.fromTo(target, { color: o.colorFrom || "inherit" }, { color: o.color, duration: F(4), ease: "none" }, at);
    return at + F(12);
  };

  /** Fade+rise for body copy blocks, split by line elements you wrote (children). */
  MH.type.lines = function (tl, container, o) {
    o = o || {};
    var kids = els(container)[0].children;
    tl.fromTo(kids, { opacity: 0, y: o.y == null ? 14 : o.y },
      { opacity: 1, y: 0, duration: D(o.dur, "base"), ease: E("enter"), stagger: F(o.stagger == null ? cfg.stagger.lines : o.stagger) }, o.at || 0);
    return (o.at || 0) + D(o.dur, "base") + F((o.stagger == null ? cfg.stagger.lines : o.stagger) * (kids.length - 1));
  };

  /** Hold-then-exit for text that has been read (exit last, quick). */
  MH.type.exit = function (tl, target, o) {
    o = o || {};
    tl.to(target, { opacity: 0, y: o.y == null ? -10 : o.y, duration: D(o.dur, "short"), ease: E("exit"), stagger: F(o.stagger || 0) }, o.at || 0);
    return (o.at || 0) + D(o.dur, "short");
  };

  /* ------------------------------------------------------------ transitions */
  MH.transition = {};
  var CLIP = {
    left: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
    right: ["inset(0 0 0 100%)", "inset(0 0 0 0%)"],
    up: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
    down: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"]
  };
  /** Directional wipe: reveals `target` through a clip-path edge. dir = direction the edge travels. */
  MH.transition.wipe = function (tl, target, o) {
    o = o || {};
    var c = CLIP[o.dir || "left"];
    tl.fromTo(target, { clipPath: c[0] }, { clipPath: c[1], duration: D(o.dur, "long"), ease: E(o.ease || "move") }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long");
  };
  /** Circular reveal from a point (x,y in %, default centre). */
  MH.transition.iris = function (tl, target, o) {
    o = o || {};
    var p = (o.x == null ? 50 : o.x) + "% " + (o.y == null ? 50 : o.y) + "%";
    tl.fromTo(target, { clipPath: "circle(0% at " + p + ")" }, { clipPath: "circle(150% at " + p + ")", duration: D(o.dur, "long"), ease: E(o.ease || "move") }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long");
  };
  /** Slat/bar mask: N panels sweep to reveal; panels are existing children of `container`. */
  MH.transition.slats = function (tl, container, o) {
    o = o || {};
    var kids = els(container)[0].children;
    tl.fromTo(kids, { scaleY: 1, transformOrigin: o.origin || "50% 0%" },
      { scaleY: 0, duration: D(o.dur, "long"), ease: E(o.ease || "move"), stagger: F(o.stagger == null ? 2 : o.stagger) }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long") + F((o.stagger == null ? 2 : o.stagger) * (kids.length - 1));
  };
  /**
   * Match transition (FLIP): move/scale `el` from where `fromEl` sits to its own layout position.
   * Use for "this shape on screen A becomes that shape on screen B". Needs both elements laid out
   * at build time (use inside one composition). Deterministic: reads rects once.
   */
  MH.transition.match = function (tl, el, fromEl, o) {
    o = o || {};
    var a = els(fromEl)[0].getBoundingClientRect();
    var b = els(el)[0].getBoundingClientRect();
    var sx = a.width / b.width, sy = a.height / b.height;
    tl.fromTo(el, { x: a.left - b.left + (a.width - b.width) / 2, y: a.top - b.top + (a.height - b.height) / 2, scaleX: sx, scaleY: sy },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: D(o.dur, "scene"), ease: E(o.ease || "move") }, o.at || 0);
    return (o.at || 0) + D(o.dur, "scene");
  };
  /** Hard "motivated cut" helper: a 2-frame dip/flash plate on the beat. color from tokens. */
  MH.transition.dip = function (tl, plate, o) {
    o = o || {};
    var at = o.at || 0, h = F(o.frames || 2);
    tl.fromTo(plate, { opacity: 0 }, { opacity: 1, duration: h, ease: "none" }, at);
    tl.to(plate, { opacity: 0, duration: h * 2, ease: "none" }, at + h);
    return at + h * 3;
  };

  /* --------------------------------------------------------------- graphic */
  MH.graphic = {};
  /** Draw an SVG path/line (stroke-dash). Element must have a stroke. Uses getTotalLength once. */
  MH.graphic.draw = function (tl, target, o) {
    o = o || {};
    els(target).forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 1000;
      p.style.strokeDasharray = len;
      tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: D(o.dur, "long"), ease: E(o.ease || "draw") }, o.at || 0);
    });
    return (o.at || 0) + D(o.dur, "long");
  };
  /** Number counter: tweens textContent. opts: from,to,decimals,prefix,suffix,sep(true) */
  MH.graphic.counter = function (tl, target, o) {
    o = o || {};
    var el = els(target)[0], obj = { v: o.from || 0 }, dec = o.decimals || 0;
    var fmt = function (v) {
      var s = v.toFixed(dec);
      if (o.sep !== false) { var parts = s.split("."); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); s = parts.join("."); }
      return (o.prefix || "") + s + (o.suffix || "");
    };
    el.textContent = fmt(obj.v);
    tl.fromTo(obj, { v: o.from || 0 }, { v: o.to, duration: D(o.dur, "long"), ease: E(o.ease || "snap"), onUpdate: function () { el.textContent = fmt(obj.v); } }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long");
  };
  /**
   * Data bars: container's children each carry data-value; they grow to value/max of the axis.
   * opts: at, max, axis("y"|"x"), stagger(frames)
   */
  MH.graphic.bars = function (tl, container, o) {
    o = o || {};
    var kids = Array.prototype.slice.call(els(container)[0].children);
    var vals = kids.map(function (k) { return parseFloat(k.getAttribute("data-value")); });
    var max = o.max || Math.max.apply(null, vals);
    var horiz = o.axis === "x";
    kids.forEach(function (k, i) {
      var pct = (vals[i] / max);
      k.style.transformOrigin = horiz ? "0% 50%" : "50% 100%";
      var from = horiz ? { scaleX: 0 } : { scaleY: 0 };
      var to = horiz ? { scaleX: pct } : { scaleY: pct };
      to.duration = D(o.dur, "long"); to.ease = E(o.ease || "snap");
      tl.fromTo(k, from, to, (o.at || 0) + F((o.stagger == null ? cfg.stagger.items : o.stagger) * i));
    });
    return (o.at || 0) + D(o.dur, "long") + F((o.stagger == null ? cfg.stagger.items : o.stagger) * (kids.length - 1));
  };
  /** Callout: line grows from an anchor, then label appears. line is an element with transform-origin set by you. */
  MH.graphic.callout = function (tl, line, label, o) {
    o = o || {};
    var at = o.at || 0;
    tl.fromTo(line, { scaleX: 0, transformOrigin: o.origin || "0% 50%" }, { scaleX: 1, duration: F(10), ease: E("draw") }, at);
    tl.fromTo(label, { opacity: 0, x: o.dx == null ? 8 : o.dx }, { opacity: 1, x: 0, duration: F(8), ease: E("enter") }, at + F(8));
    return at + F(16);
  };
  /** Grid / rules reveal: children of container scale in along one axis, staggered. */
  MH.graphic.rules = function (tl, container, o) {
    o = o || {};
    var kids = els(container)[0].children;
    tl.fromTo(kids, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: D(o.dur, "long"), ease: E("move"), stagger: F(o.stagger == null ? 2 : o.stagger) }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long");
  };
  /** Geometric form entrance: scale from an origin with a rotation settle. */
  MH.graphic.form = function (tl, target, o) {
    o = o || {};
    tl.fromTo(target, { scale: o.scaleFrom == null ? 0.6 : o.scaleFrom, rotation: o.rotFrom == null ? -8 : o.rotFrom, opacity: 0, transformOrigin: o.origin || "50% 50%" },
      { scale: 1, rotation: 0, opacity: 1, duration: D(o.dur, "long"), ease: E("snap") }, o.at || 0);
    return (o.at || 0) + D(o.dur, "long");
  };

  /* ----------------------------------------------------------------- image */
  MH.image = {};
  /** Controlled push: slow scale + drift on an image inside an overflow:hidden frame. */
  MH.image.push = function (tl, img, o) {
    o = o || {};
    var dur = o.dur || 4;
    tl.fromTo(img, { scale: o.from || 1.0, xPercent: o.x0 || 0, yPercent: o.y0 || 0, transformOrigin: o.origin || "50% 50%" },
      { scale: o.to || 1.08, xPercent: o.x1 || 0, yPercent: o.y1 || 0, duration: dur, ease: E("soft") }, o.at || 0);
    return (o.at || 0) + dur;
  };
  /** Depth parallax: layers is [{el, depth}] with depth 0..1 (1 = nearest, moves most). */
  MH.image.parallax = function (tl, layers, o) {
    o = o || {};
    var travel = o.travel == null ? 60 : o.travel, dur = o.dur || 4, at = o.at || 0;
    layers.forEach(function (L) {
      tl.fromTo(L.el, { x: -travel * L.depth * 0.5 }, { x: travel * L.depth * 0.5, duration: dur, ease: E("soft") }, at);
    });
    return at + dur;
  };
  /** Crop reveal: animate object-position / clip so a tight crop opens to a wider framing. */
  MH.image.cropOpen = function (tl, frame, o) {
    o = o || {};
    tl.fromTo(frame, { clipPath: o.from || "inset(18% 30% 18% 30%)" }, { clipPath: o.to || "inset(0% 0% 0% 0%)", duration: D(o.dur, "scene"), ease: E("move") }, o.at || 0);
    return (o.at || 0) + D(o.dur, "scene");
  };

  /* ----------------------------------------------------------------- audio */
  /**
   * Audio-aware animation. Cue data must be INLINED (no fetch): run
   *   node harness/mh.mjs cues <slug> --from beats/track.json|transcript.json
   * which writes assets/mh-cues.js defining window.MH_CUES = {beats:[s…], words:[{t,end,text}…], hits:[s…]}
   * Load it before your scene scripts.
   */
  MH.audio = {};
  MH.audio.cues = function () { return window.MH_CUES || { beats: [], words: [], hits: [] }; };
  /** Times (sec, local to the scene = global - sceneStart) of beats inside [a,b). */
  MH.audio.beatsIn = function (sceneStart, a, b) {
    return MH.audio.cues().beats.map(function (t) { return t - sceneStart; }).filter(function (t) { return t >= a && t < b; });
  };
  /** Find a spoken word's start (local seconds). `nth` picks the nth occurrence. Returns null when absent. */
  MH.audio.wordAt = function (word, sceneStart, nth) {
    var w = MH.audio.cues().words.filter(function (x) { return x.text.toLowerCase().replace(/[^\w']/g, "") === word.toLowerCase(); });
    var hit = w[nth || 0];
    return hit ? hit.t - sceneStart : null;
  };
  /** Pulse a target on every beat in a window (scale, not opacity). Emphasis only — use sparingly. */
  MH.audio.pulse = function (tl, target, sceneStart, a, b, o) {
    o = o || {};
    MH.audio.beatsIn(sceneStart, a, b).forEach(function (t) {
      tl.fromTo(target, { scale: 1 }, { scale: o.scale || 1.04, duration: F(2), ease: E("snap") }, t);
      tl.to(target, { scale: 1, duration: F(6), ease: E("move") }, t + F(2));
    });
  };
  /** Land a reveal exactly on a spoken word; falls back to `fallback` seconds when no transcript. */
  MH.audio.onWord = function (tl, word, sceneStart, fn, fallback, nth) {
    var t = MH.audio.wordAt(word, sceneStart, nth);
    return fn(t == null ? fallback : t);
  };

  /* -------------------------------------------------------------------- bg */
  MH.bg = {};
  /** Slow ambient drift of a large background shape/gradient layer. Restrained: default ±2%. */
  MH.bg.drift = function (tl, target, o) {
    o = o || {};
    var dur = o.dur || 6, a = o.amount == null ? 2 : o.amount;
    tl.fromTo(target, { xPercent: -a, yPercent: a / 2 }, { xPercent: a, yPercent: -a / 2, duration: dur, ease: E("soft") }, o.at || 0);
    return (o.at || 0) + dur;
  };
  /** Light wash sweep (a soft directional band moving across); NOT a glow. */
  MH.bg.sweep = function (tl, target, o) {
    o = o || {};
    tl.fromTo(target, { xPercent: o.from == null ? -60 : o.from }, { xPercent: o.to == null ? 60 : o.to, duration: o.dur || 5, ease: E("soft") }, o.at || 0);
    return (o.at || 0) + (o.dur || 5);
  };

  /* ---------------------------------------------------------------- layout */
  MH.layout = {
    /** Safe boxes (px) for a canvas. action = 90%, title = 80%. */
    safe: function (w, h) {
      return {
        action: { x: w * 0.05, y: h * 0.05, w: w * 0.9, h: h * 0.9 },
        title: { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 }
      };
    },
    /** Platform UI keep-outs for vertical 9:16 at 1080x1920 (px). */
    verticalUI: { top: 250, bottom: 420, right: 120, left: 60 }
  };

  window.MH = MH;
})();
