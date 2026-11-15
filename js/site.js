/* ==========================================================================
   Madera Viva — movimiento del sitio
   GSAP + ScrollTrigger + SplitText + Lenis (en js/vendor).
   Si algo de eso falta, o el visitante pide "reducir movimiento",
   la página queda en su versión estática, con todo el contenido visible.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const params = new URLSearchParams(location.search);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasLibs = !!(window.gsap && window.ScrollTrigger);
  const MOTION = hasLibs && !reduced && !params.has('estatico');
  const small = window.matchMedia('(max-width: 760px)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let lenis = null;
  const scrollToY = (y, opts) => {
    if (lenis) lenis.scrollTo(y, Object.assign({ duration: 1.5 }, opts));
    else window.scrollTo({ top: typeof y === 'number' ? y : y.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  };

  /* ------------------------------------------------------------------
     Siempre: menú, galería, videos
     ------------------------------------------------------------------ */
  const nav = $('#nav');
  const navToggle = $('#navToggle');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Galería: se oculta mientras no haya fotos; foto ampliada al tocar
  const galeria = $('#galeria');
  const lb = $('#lightbox');
  if (galeria && !galeria.querySelector('figure')) galeria.classList.add('vacia');
  if (galeria && lb) {
    galeria.addEventListener('click', (e) => {
      const fig = e.target.closest('figure');
      const img = fig && fig.querySelector('img');
      if (!img) return;
      const big = lb.querySelector('img');
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      lb.classList.add('on');
    });
    lb.addEventListener('click', () => lb.classList.remove('on'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('on'); });
  }

  // Video de Andrés: ajusta el marco si el video es horizontal y usa un botón propio
  const comercial = $('#comercial');
  const vplay = $('#vplay');
  if (comercial) {
    const frame = $('#videoFrame');
    comercial.addEventListener('loadedmetadata', () => {
      if (comercial.videoWidth > comercial.videoHeight) frame.classList.add('landscape');
    });
    if (vplay) {
      const bar = $('.vbar b', frame);
      const label = vplay.querySelector('span');
      comercial.controls = false;
      frame.classList.add('custom');
      const toggle = () => {
        if (comercial.paused) { const p = comercial.play(); if (p && p.catch) p.catch(() => {}); }
        else comercial.pause();
      };
      vplay.addEventListener('click', toggle);
      comercial.addEventListener('click', toggle);
      const paint = () => {
        const on = !comercial.paused && !comercial.ended;
        frame.classList.toggle('is-playing', on);
        vplay.setAttribute('aria-label', on ? 'Pausar video' : 'Reproducir video');
        label.textContent = on ? 'Pausar' : 'Ver video';
      };
      ['play', 'pause', 'ended'].forEach((ev) => comercial.addEventListener(ev, paint));
      comercial.addEventListener('play', () => {
        // Un solo audio a la vez: se silencia la película si estaba sonando
        const film = $('#pelicula'), btn = $('#filmSound');
        if (film && !film.muted) { film.muted = true; if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.querySelector('span').textContent = 'Activar sonido'; } }
      });
      comercial.addEventListener('timeupdate', () => {
        if (bar && comercial.duration) bar.style.transform = 'scaleX(' + (comercial.currentTime / comercial.duration).toFixed(4) + ')';
      });
    }
  }

  // Videos de fondo: cargan y reproducen solo cuando están en pantalla
  const lazyVideo = (video, canPlay) => {
    if (!video || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        video._inView = en.isIntersecting;
        if (en.isIntersecting && (!canPlay || canPlay())) {
          if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
          const p = video.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.15 });
    io.observe(video);
  };

  const pelicula = $('#pelicula');
  const filmSound = $('#filmSound');
  lazyVideo(pelicula);
  if (pelicula && filmSound) {
    filmSound.addEventListener('click', () => {
      const withSound = pelicula.muted;
      pelicula.muted = !withSound;
      if (withSound) {
        if (comercial && !comercial.paused) comercial.pause();
        pelicula.currentTime = 0;
        const p = pelicula.play(); if (p && p.catch) p.catch(() => {});
      }
      filmSound.setAttribute('aria-pressed', withSound ? 'true' : 'false');
      filmSound.querySelector('span').textContent = withSound ? 'Silenciar' : 'Activar sonido';
    });
  }

  const loader = $('#loader');
  const hideLoader = () => loader && loader.classList.add('is-out');

  /* ------------------------------------------------------------------
     Versión estática
     ------------------------------------------------------------------ */
  if (!MOTION) {
    hideLoader();
    lazyVideo($('.stop video'));
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    return;
  }

  /* ------------------------------------------------------------------
     Con movimiento
     ------------------------------------------------------------------ */
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });
  root.classList.add('motion');

  // Scroll suave
  if (window.Lenis && !params.has('sinlenis')) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Anclas
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && $(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    scrollToY(target, { duration: 1.8 });
  });

  // Barra de navegación: se esconde al bajar, vuelve al subir. Línea de luz = avance.
  const ledProgress = $('#ledProgress');
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    if (!nav.classList.contains('open')) {
      if (y > lastY + 3 && y > 240) nav.classList.add('is-hidden');
      else if (y < lastY - 3) nav.classList.remove('is-hidden');
    }
    lastY = y;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (ledProgress) ledProgress.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0).toFixed(4) + ')';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Secuencia de cuadros en un canvas (video guiado por scroll) ---------- */
  class FrameSeq {
    constructor(canvas, step, fit) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.base = canvas.dataset.seq; this.count = +canvas.dataset.count;
      this.step = step || 1; this.fit = fit !== false;
      this.frames = []; this.idxs = null; this.u = 0; this.lastIm = null;
    }
    load() {
      if (this.idxs) return;
      const idxs = [];
      for (let i = 0; i < this.count; i += this.step) idxs.push(i);
      if (idxs[idxs.length - 1] !== this.count - 1) idxs.push(this.count - 1);
      this.idxs = idxs;
      idxs.forEach((n, k) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => {
          this.frames[k] = im;
          this.c.classList.add('is-ready');
          this.draw(this.u);
        };
        im.src = this.base + String(n + 1).padStart(3, '0') + '.webp';
      });
    }
    size() {
      if (!this.fit) return;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(this.c.offsetWidth * d), h = Math.round(this.c.offsetHeight * d);
      if (w && h && (w !== this.c.width || h !== this.c.height)) { this.c.width = w; this.c.height = h; this.lastIm = null; this.draw(this.u); }
    }
    draw(u) {
      this.u = u;
      if (!this.idxs) return;
      const n = this.idxs.length;
      const k = Math.round(clamp(u) * (n - 1));
      let im = this.frames[k];
      for (let d = 1; !im && d < n; d++) im = this.frames[k - d] || this.frames[k + d];
      if (!im || im === this.lastIm) return;
      this.lastIm = im;
      const cw = this.c.width, ch = this.c.height;
      const ir = im.naturalWidth / im.naturalHeight, cr = cw / ch;
      let dw, dh;
      if (ir > cr) { dh = ch; dw = dh * ir; } else { dw = cw; dh = dw / ir; }
      this.ctx.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
  }

  /* ==================================================================
     HERO — el muro se arma listón por listón y luego se enciende
     ================================================================== */
  function initHero() {
    const hero = $('#inicio');
    const stage = $('.hero-stage', hero);
    const cv = $('#heroCanvas');
    const ctx = cv.getContext('2d');
    const ui = $('#heroUi');
    const scrim = $('.hero-scrim', hero);
    const title = $('.hero-title', hero);
    const steps = $$('.hero-steps li', hero);
    const hint = $('.scroll-hint', hero);
    const behind = $('.behind-in', hero);

    // Centro de cada hueco entre listones en la foto (fracción del ancho), medido de la imagen.
    const GAPS = [0.0316, 0.0869, 0.1412, 0.1955, 0.25, 0.3051, 0.3596, 0.4148, 0.4713, 0.5268, 0.5828, 0.6381, 0.6934, 0.7482, 0.8031, 0.8578, 0.9121, 0.9664];
    const PITCH = 0.0549;
    const AR = 2560 / 1707;
    // Tramos del scroll (0–1): montaje · luz · pausa · apertura
    const P_BUILD = 0.46, P_L0 = 0.46, P_L1 = 0.66, P_OPEN = 0.76;

    const wall = new Image(), glow = new Image();
    wall.decoding = glow.decoding = 'async';
    wall.src = 'img/hero/wall' + (small ? '-m' : '') + '.webp';
    glow.src = 'img/hero/glow' + (small ? '-m' : '') + '.webp';

    const st = { intro: 0, p: 0 };
    const ptr = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3, a: 0, ta: 0 };
    let Wd = 0, Hd = 0, dpr = 1, slats = [], dark = null, lit = null, bg = null;
    let ok = false, dirty = true, lastW = 0;

    const flick = (u) => (u <= 0 ? 0
      : u < 0.1 ? (u / 0.1) * 0.55
      : u < 0.18 ? 0.55 - ((u - 0.1) / 0.08) * 0.45
      : u < 0.26 ? 0.1 + ((u - 0.18) / 0.08) * 0.5
      : u < 0.32 ? 0.6 - ((u - 0.26) / 0.06) * 0.3
      : 0.3 + smooth((u - 0.32) / 0.68) * 0.7);

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = stage.clientWidth, H = stage.clientHeight;
      lastW = W;
      Wd = Math.round(W * dpr); Hd = Math.round(H * dpr);
      cv.width = Wd; cv.height = Hd;

      // Cuántos listones caben: en pantallas angostas se muestra solo una parte de la foto.
      const n = clamp(W / 76, 8, 40);
      let f = Math.min(1, n * PITCH);
      let iw = Wd / f, ih = iw / AR;
      if (f >= 1 && ih < Hd) { ih = Hd; iw = ih * AR; f = Wd / iw; }
      ih = Math.ceil(ih);
      const x0 = (1 - f) / 2;

      const paint = (img) => {
        const c = document.createElement('canvas');
        c.width = Wd; c.height = Hd;
        const g = c.getContext('2d');
        const dx = -x0 * iw;
        if (ih >= Hd) {
          g.drawImage(img, dx, (Hd - ih) / 2, iw, ih);
        } else {
          // La foto no alcanza de alto: se repite en espejo para que no se note la unión.
          let y = 0, flip = false;
          while (y < Hd) {
            if (!flip) g.drawImage(img, dx, y, iw, ih);
            else { g.save(); g.translate(0, y + ih); g.scale(1, -1); g.drawImage(img, dx, 0, iw, ih); g.restore(); }
            y += ih - 1; flip = !flip;
          }
        }
        return c;
      };

      const wallC = paint(wall);
      // Muro apagado
      dark = document.createElement('canvas'); dark.width = Wd; dark.height = Hd;
      let g = dark.getContext('2d');
      g.drawImage(wallC, 0, 0);
      g.fillStyle = 'rgba(9,7,6,.7)'; g.fillRect(0, 0, Wd, Hd);
      // Muro encendido: la luz sale por los huecos reales de la foto
      const glowC = paint(glow);
      g = glowC.getContext('2d');
      const fall = g.createLinearGradient(0, 0, 0, Hd);
      fall.addColorStop(0, 'rgba(0,0,0,0)');
      fall.addColorStop(0.5, 'rgba(0,0,0,.5)');
      fall.addColorStop(1, 'rgba(0,0,0,.2)');
      g.fillStyle = fall; g.fillRect(0, 0, Wd, Hd);
      lit = document.createElement('canvas'); lit.width = Wd; lit.height = Hd;
      g = lit.getContext('2d');
      g.drawImage(wallC, 0, 0);
      g.fillStyle = 'rgba(9,7,6,.3)'; g.fillRect(0, 0, Wd, Hd);
      g.globalCompositeOperation = 'screen';
      g.drawImage(glowC, 0, 0);

      // Cada listón = el tramo de foto entre dos huecos
      const xs = [0];
      GAPS.forEach((gp) => { const x = Math.round((gp - x0) * iw); if (x > 14 && x < Wd - 14) xs.push(x); });
      xs.push(Wd);
      slats = [];
      for (let i = 0; i < xs.length - 1; i++) slats.push({ x: xs[i], w: xs[i + 1] - xs[i], c: (xs[i] + xs[i + 1]) / 2 / Wd });

      bg = ctx.createLinearGradient(0, 0, 0, Hd);
      bg.addColorStop(0, '#1d1a17'); bg.addColorStop(1, '#0f0d0b');
      dirty = true;
    }

    // Trazos del diseño sobre el muro vacío
    function guides() {
      const gi = clamp(st.intro * 1.5);
      if (gi <= 0) return;
      const N = slats.length;
      ctx.save();
      ctx.lineWidth = Math.max(1, dpr * 0.75);
      ctx.strokeStyle = 'rgba(213,193,164,.2)';
      ctx.setLineDash([5 * dpr, 9 * dpr]);
      ctx.beginPath();
      for (let i = 1; i < N; i++) {
        const k = clamp(gi * 1.6 - (i / N) * 0.6);
        if (k <= 0) continue;
        const x = slats[i].x + 0.5;
        ctx.moveTo(x, 0); ctx.lineTo(x, Hd * k);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const y = Math.round(Hd * 0.5) + 0.5;
      ctx.strokeStyle = 'rgba(213,193,164,.28)';
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(Wd * clamp(gi * 1.2), y);
      const m = 5 * dpr;
      for (let i = 1; i < N; i++) {
        const x = slats[i].x + 0.5;
        if (x > Wd * clamp(gi * 1.2)) break;
        ctx.moveTo(x - m, y); ctx.lineTo(x + m, y); ctx.moveTo(x, y - m); ctx.lineTo(x, y + m);
      }
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const p = st.p;
      const b = clamp(st.intro * 0.24 + 0.76 * clamp(p / P_BUILD));
      const l = clamp((p - P_L0) / (P_L1 - P_L0));
      const o = clamp((p - P_OPEN) / (1 - P_OPEN));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, Wd, Hd);
      if (o <= 0) {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, Wd, Hd);
        if (b < 1) guides();
      }

      const N = slats.length, win = 0.24;
      for (let i = 0; i < N; i++) {
        const s = slats[i];
        const t = clamp((b - (i / (N - 1)) * (1 - win)) / win);
        if (t <= 0) continue;
        const e = 1 - Math.pow(1 - t, 4);
        const y = Math.round((1 - e) * (i % 2 ? 1 : -1) * Hd * 1.03);
        const d = Math.abs(s.c - 0.5) * 2;
        let dw = s.w, dx = s.x;
        if (o > 0) {
          const th = smooth(clamp((o - d * 0.42) / 0.58));
          dw = s.w * Math.cos(th * Math.PI / 2);
          dx = s.x + (s.w - dw) / 2;
          if (dw < 1) continue;
        }
        if (t < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (0.5 * (1 - e)).toFixed(3) + ')'; ctx.fillRect(dx + 10 * dpr, y, dw, Hd); }
        ctx.drawImage(dark, s.x, 0, s.w, Hd, dx, y, dw, Hd);
        if (l > 0) {
          const li = flick(clamp((l - d * 0.45) / 0.55));
          if (li > 0) { ctx.globalAlpha = li; ctx.drawImage(lit, s.x, 0, s.w, Hd, dx, y, dw, Hd); ctx.globalAlpha = 1; }
        }
        if (o > 0) { ctx.fillStyle = 'rgba(12,9,6,' + (0.62 * (1 - dw / s.w)).toFixed(3) + ')'; ctx.fillRect(dx, 0, dw, Hd); }
      }

      // Luz que sigue al cursor
      if (ptr.a > 0.01 && o < 1) {
        const mx = ptr.x * Wd, my = ptr.y * Hd, R = Math.max(Wd, Hd) * 0.32;
        const a = 0.36 * ptr.a * (1 - 0.7 * l) * (1 - o);
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
        g.addColorStop(0, 'rgba(255,214,160,' + a.toFixed(3) + ')');
        g.addColorStop(0.45, 'rgba(255,190,120,' + (a * 0.3).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, Hd);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Texto y capas HTML que acompañan al canvas
    let stepNow = -1;
    function sync() {
      const p = st.p;
      const l = clamp((p - P_L0) / (P_L1 - P_L0));
      const o = clamp((p - P_OPEN) / (1 - P_OPEN));
      hero.style.setProperty('--lit', flick(clamp((l - 0.12) / 0.7)).toFixed(3));
      const out = clamp((p - 0.7) / 0.07);
      ui.style.opacity = (1 - out).toFixed(3);
      ui.style.transform = 'translate3d(0,' + (-46 * out).toFixed(1) + 'px,0)';
      ui.style.pointerEvents = out > 0.5 ? 'none' : '';
      scrim.style.opacity = (1 - clamp((p - 0.71) / 0.07)).toFixed(3);
      hint.style.opacity = (clamp(st.intro * 2 - 1) * (1 - clamp(p / 0.03))).toFixed(3);
      const step = p < 0.015 ? 0 : p < P_L0 ? 1 : 2;
      if (step !== stepNow) { stepNow = step; steps.forEach((li, i) => li.classList.toggle('on', i === step)); }
      const bh = smooth(clamp((o - 0.3) / 0.55));
      behind.style.opacity = bh.toFixed(3);
      behind.style.transform = 'translate3d(0,' + (46 * (1 - bh)).toFixed(1) + 'px,0)';
    }

    gsap.ticker.add(() => {
      if (!ok) return;
      const dx = ptr.tx - ptr.x, dy = ptr.ty - ptr.y, da = ptr.ta - ptr.a;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(da) > 0.0015) {
        ptr.x += dx * 0.12; ptr.y += dy * 0.12; ptr.a += da * 0.07; dirty = true;
      }
      if (!dirty) return;
      dirty = false;
      // Solo se dibuja mientras el hero sigue a la vista
      if (hero.getBoundingClientRect().bottom > -80) { draw(); sync(); }
    });

    gsap.to(st, {
      p: 1, ease: 'none', onUpdate: () => { dirty = true; },
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });

    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        ptr.tx = (e.clientX - r.left) / r.width; ptr.ty = (e.clientY - r.top) / r.height; ptr.ta = 1;
      });
      hero.addEventListener('pointerleave', () => { ptr.ta = 0; });
    }

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (ok && (stage.clientWidth !== lastW || finePointer)) layout(); }, 160);
    });

    const loaded = (im) => new Promise((res) => { if (im.complete && im.naturalWidth) res(); else { im.onload = res; im.onerror = res; } });
    const ready = Promise.all([loaded(wall), loaded(glow)]).then(() => {
      if (!wall.naturalWidth || !glow.naturalWidth) throw new Error('hero');
      layout(); ok = true; draw(); sync();
    });

    return {
      ready,
      intro() {
        gsap.to(st, { intro: 1, duration: 2.6, ease: 'power2.out', onUpdate: () => { dirty = true; } });
        gsap.from($$('.ln-in', title), {
          yPercent: 118, duration: 1.6, ease: 'expo.out', stagger: 0.14, delay: 0.15,
          onComplete: () => title.classList.add('is-in'),
        });
        gsap.from([$('.hero-eyebrow', hero), $('.hero-sub', hero), $('.hero-actions', hero)], { opacity: 0, y: 26, duration: 1.3, ease: 'power3.out', stagger: 0.12, delay: 0.55 });
        gsap.from($('.hero-steps', hero), { opacity: 0, duration: 1.4, delay: 0.9 });
      },
    };
  }

  /* ==================================================================
     RECORRIDO — cada parada es un espacio de la casa
     ================================================================== */
  function initTour() {
    const track = $('#tourTrack');
    if (!track) return;
    const stage = $('.tour-stage', track);
    const stops = $$('.stop', track);
    const N = stops.length;
    const media = stops.map((s) => $('.stop-media', s));
    const inner = stops.map((s) => $('.stop-inner', s));
    const shade = stops.map((s) => $('.stop-shade', s));
    const bars = $('#tourBars'), index = $('#tourIndex'), now = $('#tourNow');
    track.style.setProperty('--n', N);

    const state = { q: 0 };
    let active = -1, shown = [], stageOn = false;

    const go = (i) => {
      const t = ScrollTrigger.getById('tour');
      if (t) scrollToY(t.start + (t.end - t.start) * ((i + 0.03) / N), { duration: 1.3 });
    };
    const barEls = [], idxEls = [];
    stops.forEach((s, i) => {
      const room = s.dataset.room;
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', (i + 1) + '. ' + room);
      b.addEventListener('click', () => go(i));
      bars.appendChild(b); barEls.push(b);
      const li = document.createElement('li');
      const bt = document.createElement('button');
      bt.type = 'button'; bt.textContent = room;
      bt.addEventListener('click', () => go(i));
      li.appendChild(bt); index.appendChild(li); idxEls.push(li);
    });

    // Parada con video (cielo LED) y parada con secuencia guiada por scroll (pérgola)
    const video = $('video', stops[0]);
    const playVideo = () => {
      if (!video) return;
      if (stageOn && active <= 1) {
        if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
        const p = video.play(); if (p && p.catch) p.catch(() => {});
      } else video.pause();
    };
    const seqCanvas = $('#seqTerraza');
    const seq = seqCanvas ? new FrameSeq(seqCanvas, (small || saveData) ? 2 : 1) : null;
    const seqStop = seqCanvas ? stops.indexOf(seqCanvas.closest('.stop')) : -1;

    function render() {
      const q = clamp(state.q, 0, N - 0.0001);
      const i = Math.floor(q), f = q - i;
      // La siguiente parada entra por una "puerta" que se abre al final de cada tramo
      const r = i < N - 1 ? smooth(clamp((f - 0.58) / 0.42)) : 0;
      const want = r > 0 ? [i, i + 1] : [i];
      shown.forEach((k) => { if (want.indexOf(k) < 0) stops[k].classList.remove('is-on'); });
      want.forEach((k) => stops[k].classList.add('is-on'));
      shown = want;

      media[i].style.clipPath = 'none';
      inner[i].style.transform = 'scale(' + (1.02 + 0.1 * f + 0.1 * r).toFixed(4) + ')';
      shade[i].style.opacity = (0.5 * r).toFixed(3);
      if (r > 0) {
        const k = i + 1, W = stage.clientWidth;
        const side = 50 * (1 - r), top = 18 * (1 - r);
        const rad = Math.min((W * r) / 2, W * 0.6 * (1 - r));
        media[k].style.clipPath = 'inset(' + top.toFixed(2) + '% ' + side.toFixed(2) + '% 0% ' + side.toFixed(2) + '% round ' + rad.toFixed(1) + 'px ' + rad.toFixed(1) + 'px 0px 0px)';
        inner[k].style.transform = 'scale(' + (1.02 + 0.24 * (1 - r)).toFixed(4) + ')';
        shade[k].style.opacity = '0';
      }

      const a = r > 0.5 ? i + 1 : i;
      if (a !== active) {
        if (active >= 0) { stops[active].classList.remove('is-active'); idxEls[active].classList.remove('on'); }
        active = a;
        stops[a].classList.add('is-active'); idxEls[a].classList.add('on');
        now.textContent = String(a + 1).padStart(2, '0');
        playVideo();
        if (seq && Math.abs(a - seqStop) <= 2) seq.load();
      }
      for (let k = 0; k < N; k++) barEls[k].style.setProperty('--f', clamp(q - k).toFixed(3));
      if (seq && Math.abs(q - seqStop) < 1.6) seq.draw(clamp((q - (seqStop - 0.42)) / 1.42));
    }

    gsap.to(state, {
      q: N, ease: 'none', onUpdate: render,
      scrollTrigger: {
        id: 'tour', trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.5,
        onToggle: (self) => { stageOn = self.isActive; playVideo(); },
      },
    });
    ScrollTrigger.create({
      trigger: track, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => { stageOn = self.isActive; playVideo(); if (self.isActive && seq) seq.size(); },
    });
    if (seq) window.addEventListener('resize', () => seq.size());
    render();
  }

  /* ==================================================================
     Resto de secciones
     ================================================================== */
  function initSections() {
    // Títulos: entran línea por línea
    $$('[data-lines]').forEach((el) => {
      if (!window.SplitText) { el.style.visibility = 'visible'; return; }
      window.SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit(self) {
          el.style.visibility = 'visible';
          return gsap.from(self.lines, {
            yPercent: 112, duration: 1.4, ease: 'expo.out', stagger: 0.11,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        },
      });
    });

    // Entradas simples
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.25, ease: 'power3.out', stagger: 0.1, overwrite: true }),
    });
    ScrollTrigger.batch('[data-clip]', {
      start: 'top 88%', once: true,
      onEnter: (els) => gsap.to(els, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.out', stagger: 0.14, overwrite: true }),
    });

    // Fotos con profundidad
    $$('[data-parallax]').forEach((img) => {
      const raw = parseFloat(img.dataset.parallax) || 6;
      const v = Math.sign(raw) * Math.min(Math.abs(raw), 6.4);
      gsap.fromTo(img, { yPercent: -v }, {
        yPercent: v, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Esencia: las palabras se encienden al pasar
    const statement = $('[data-words]');
    if (statement) {
      const parts = [];
      Array.from(statement.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) parts.push(document.createTextNode(' '));
            else { const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = tok; parts.push(sp); }
          });
        } else if (n.nodeType === 1) { n.classList.add('w'); parts.push(n); }
      });
      statement.replaceChildren.apply(statement, parts);
      gsap.fromTo($$('.w', statement), { opacity: 0.13 }, {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: statement, start: 'top 84%', end: 'bottom 52%', scrub: 0.4 },
      });
    }

    // Filas de palabras: se mueven solas y aceleran con el scroll
    const rows = $$('.mq-row').map((row) => {
      const track = $('.mq-track', row);
      const unit = track.innerHTML;
      track.innerHTML = unit + unit + unit;
      const r = { track, dir: parseFloat(row.dataset.dir) || -1, w: 0, x: 0 };
      const measure = () => { r.w = track.scrollWidth / 3; };
      measure();
      window.addEventListener('resize', measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      return r;
    });
    if (rows.length) {
      let mqOn = false;
      ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: (self) => { mqOn = self.isActive; } });
      gsap.ticker.add((time, dt) => {
        if (!mqOn) return;
        const v = lenis ? lenis.velocity : 0;
        rows.forEach((r) => {
          if (!r.w) return;
          r.x += r.dir * (0.05 * dt + v * 0.5);
          r.x = ((r.x % r.w) - r.w) % r.w;
          r.track.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0)';
        });
      });
    }

    // Proceso: la línea LED avanza y enciende cada paso
    const pw = $('#pasos');
    if (pw) {
      const pasos = $$('.paso', pw);
      pw.style.setProperty('--p', '0');
      ScrollTrigger.create({
        trigger: pw, start: 'top 76%', end: 'bottom 60%', scrub: 0.5,
        onUpdate: (self) => {
          const p = self.progress;
          pw.style.setProperty('--p', p.toFixed(4));
          pasos.forEach((el, i) => el.classList.toggle('on', p >= i / pasos.length + 0.02));
        },
      });
    }

    // Película: el marco crece hasta llenar la pantalla
    const film = $('#film');
    if (film) {
      gsap.fromTo($('.film-frame', film), { '--s': small ? 0.84 : 0.68, '--r': '28px' }, {
        '--s': 1, '--r': '0px', ease: 'none',
        scrollTrigger: { trigger: film, start: 'top 94%', end: 'center 54%', scrub: 0.5 },
      });
    }

    // Logo: la M gira hasta quedar en su lugar
    const logoCanvas = $('#seqLogo');
    if (logoCanvas) {
      const ls = new FrameSeq(logoCanvas, (small || saveData) ? 2 : 1, false);
      const o = { u: 0 };
      ScrollTrigger.create({ trigger: '.agendar', start: 'top 250%', once: true, onEnter: () => ls.load() });
      gsap.to(o, {
        u: 1, ease: 'none', onUpdate: () => ls.draw(o.u),
        scrollTrigger: { trigger: '.agendar-logo', start: 'top 88%', end: 'center 46%', scrub: 0.6 },
      });
    }
  }

  /* ==================================================================
     Arranque
     ================================================================== */
  const t0 = performance.now();
  let hero = null;
  try { hero = initHero(); } catch (err) { hero = null; }
  initTour();
  initSections();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([Promise.all([hero ? hero.ready : null, fonts]), wait(3000)])
    .catch(() => {})
    .then(() => wait(Math.max(0, 900 - (performance.now() - t0))))
    .then(() => {
      ScrollTrigger.refresh();
      hideLoader();
      if (hero) hero.intro();
    });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
