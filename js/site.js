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


  // The portrait hero is limited to phone-width screens; reduced-motion and data-saving users keep the poster.
  const heroVideo = $('#heroVideo');
  let heroCovered = false;
  if (heroVideo) {
    if (window.matchMedia('(max-width: 760px)').matches) {
      heroVideo.dataset.src = heroVideo.dataset.srcV;
      heroVideo.poster = heroVideo.dataset.posterV;
    }
    heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'));
    if (!reduced && !saveData) { heroVideo.preload = 'auto'; lazyVideo(heroVideo, () => !heroCovered); }
  }

  /* ------------------------------------------------------------------
     Versión estática
     ------------------------------------------------------------------ */
  if (!MOTION) {
    root.classList.add('ready');
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

  // Catálogo: con la revista abierta el scroll suave se detiene, y los enlaces #revista-… bajan con Lenis.
  window.MV = Object.assign(window.MV || {}, {
    scrollA: (el) => scrollToY(el, { duration: 1.4, offset: -Math.max(0, (window.innerHeight - el.offsetHeight) / 2) }),
  });
  if (lenis) {
    let libroOn = false;
    new MutationObserver(() => {
      const on = root.classList.contains('libro-on');
      if (on !== libroOn) { libroOn = on; on ? lenis.stop() : lenis.start(); }
    })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  // Anclas (los enlaces #revista-… los atiende el catálogo)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.startsWith('#revista-')) return;
    let target = null;
    try { target = id.length > 1 && $(id); } catch (err) { target = null; }
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    scrollToY(target, { duration: 1.8 });
    // La barra de direcciones muestra la sección (p. ej. maderavivagt.com/#catalogo) para poder copiarla y compartirla.
    history.replaceState(null, '', id === '#inicio' ? location.pathname + location.search : id);
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
     HERO — video de fondo; al bajar, la pantalla blanca entra de una vez
     ================================================================== */
  function initHero() {
    const hero = $('#inicio');
    const media = $('.hero-media', hero);
    const ui = $('#heroUi');
    const behind = $('.hero-behind', hero);
    const behindIn = $('.behind-in', hero);
    const title = $('.hero-title', hero);
    const lines = $$('.ln-in', title);
    const fades = [$('.hero-eyebrow', hero), $('.hero-sub', hero), $('.hero-actions', hero)];

    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.5,
        onUpdate: (self) => {
          ui.style.pointerEvents = self.progress > 0.18 ? 'none' : '';
          const c = self.progress > 0.8;
          if (c !== heroCovered) { heroCovered = c; syncHeroVideo(); }
        },
      },
    })
      .to(ui, { opacity: 0, y: -70, duration: 0.3 }, 0)
      .to(media, { scale: 1.1, duration: 0.7 }, 0)
      .to(behind, { opacity: 1, duration: 0.4 }, 0.14)
      .fromTo(behindIn, { opacity: 0, y: 56 }, { opacity: 1, y: 0, duration: 0.36 }, 0.38)
      .to({}, { duration: 0.26 });

    function syncHeroVideo() {
      if (!heroVideo) return;
      if (heroCovered) heroVideo.pause();
      else if (heroVideo._inView && heroVideo.getAttribute('src')) { const p = heroVideo.play(); if (p && p.catch) p.catch(() => {}); }
    }

    return {
      intro() {
        // Primero se quita el ocultado del CSS; si GSAP lo leyera, quedaría como un desplazamiento fijo
        root.classList.add('ready');
        gsap.set(lines, { y: 0, yPercent: 118 });
        gsap.set(fades, { opacity: 0, y: 26 });
        gsap.to(lines, {
          yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.12, delay: 0.05,
          onComplete: () => title.classList.add('is-in'),
        });
        gsap.to(fades, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.35, clearProps: 'transform' });
      },
    };
  }

  /* ==================================================================
     SERVICES — carousel advances every 15 seconds; click or swipe navigates
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
    const btnPrev = $('#tourPrev'), btnNext = $('#tourNext'), btnPause = $('#tourPause');
    const cursor = $('#tourCursor');
    const DUR = 15;     // segundos en cada espacio
    const TRANS = 1.35; // segundos de la transición

    const st = { r: 1 };
    let cur = 0, from = -1, fromKb = 0, elapsed = 0, active = -1, tween = null;
    let inView = false, userPaused = false;

    // Barras de avance e índice de espacios
    const barEls = [], idxEls = [];
    stops.forEach((s, i) => {
      const room = s.dataset.room;
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Ir a ' + room);
      b.addEventListener('click', () => show(i));
      bars.appendChild(b); barEls.push(b);
      const li = document.createElement('li');
      const bt = document.createElement('button');
      bt.type = 'button'; bt.textContent = room;
      bt.addEventListener('click', () => show(i));
      li.appendChild(bt); index.appendChild(li); idxEls.push(li);
    });

    // Parada con video (cielo LED) y parada con secuencia de cuadros (pérgola)
    const video = $('.stop video', track);
    const videoStop = video ? stops.indexOf(video.closest('.stop')) : -1;
    const seqCanvas = $('#seqTerraza');
    const seq = seqCanvas ? new FrameSeq(seqCanvas, (small || saveData) ? 2 : 1) : null;
    const seqStop = seqCanvas ? stops.indexOf(seqCanvas.closest('.stop')) : -1;
    const near = (k) => Math.min(Math.abs(k - cur), N - Math.abs(k - cur)) <= 1;

    function syncMedia() {
      if (video) {
        if (inView && (cur === videoStop || from === videoStop)) {
          if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
          const p = video.play(); if (p && p.catch) p.catch(() => {});
        } else video.pause();
      }
      if (seq && near(seqStop)) seq.load();
    }

    function setOn(list) {
      stops.forEach((s, k) => s.classList.toggle('is-on', list.indexOf(k) >= 0));
    }

    function render() {
      const r = st.r;
      if (from >= 0) {
        media[from].style.clipPath = 'none';
        inner[from].style.transform = 'scale(' + (1.02 + 0.1 * fromKb + 0.08 * r).toFixed(4) + ')';
        shade[from].style.opacity = (0.55 * r).toFixed(3);
        // El siguiente espacio entra por una "puerta" en arco que se abre
        const W = stage.clientWidth;
        const side = 50 * (1 - r), top = 18 * (1 - r);
        const rad = Math.min((W * r) / 2, W * 0.6 * (1 - r));
        media[cur].style.clipPath = 'inset(' + top.toFixed(2) + '% ' + side.toFixed(2) + '% 0% ' + side.toFixed(2) + '% round ' + rad.toFixed(1) + 'px ' + rad.toFixed(1) + 'px 0px 0px)';
        inner[cur].style.transform = 'scale(' + (1.02 + 0.24 * (1 - r)).toFixed(4) + ')';
        shade[cur].style.opacity = '0';
      } else {
        media[cur].style.clipPath = 'none';
        inner[cur].style.transform = 'scale(' + (1.02 + 0.1 * clamp(elapsed / DUR)).toFixed(4) + ')';
        shade[cur].style.opacity = '0';
      }

      const a = from >= 0 && r < 0.5 ? from : cur;
      if (a !== active) {
        if (active >= 0) { stops[active].classList.remove('is-active'); idxEls[active].classList.remove('on'); }
        active = a;
        stops[a].classList.add('is-active'); idxEls[a].classList.add('on');
        stops.forEach((s, k) => { s.inert = k !== a; });
        now.textContent = String(a + 1).padStart(2, '0');
      }
      const f = from >= 0 ? 0 : clamp(elapsed / DUR);
      for (let k = 0; k < N; k++) barEls[k].style.setProperty('--f', (k < cur ? 1 : k === cur ? f : 0).toFixed(3));
      if (seq && cur === seqStop) seq.draw(from < 0 ? clamp(elapsed / 7) : 0);
    }

    function show(k) {
      k = ((k % N) + N) % N;
      if (tween) tween.progress(1);
      if (k === cur) { elapsed = 0; render(); return; }
      fromKb = clamp(elapsed / DUR);
      from = cur; cur = k; elapsed = 0; st.r = 0;
      setOn([from, cur]);
      syncMedia();
      tween = gsap.to(st, {
        r: 1, duration: TRANS, ease: 'power3.inOut', onUpdate: render,
        onComplete: () => {
          media[from].style.clipPath = 'none';
          from = -1; tween = null;
          setOn([cur]); render(); syncMedia();
        },
      });
    }
    const next = () => show(cur + 1);
    const prev = () => show(cur - 1);

    // Reloj del avance automático
    gsap.ticker.add((time, dt) => {
      if (!inView || from >= 0) return;
      if (!userPaused && !document.hidden) {
        elapsed += Math.min(dt, 100) / 1000;
        if (elapsed >= DUR) { next(); return; }
        render();
      }
    });

    // Solo corre cuando el carrusel se ve casi completo
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { inView = en.intersectionRatio >= 0.55; syncMedia(); });
      }, { threshold: [0, 0.55, 1] }).observe(stage);
    } else inView = true;

    // Botones
    btnNext.addEventListener('click', next);
    btnPrev.addEventListener('click', prev);
    btnPause.addEventListener('click', () => {
      userPaused = !userPaused;
      btnPause.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      btnPause.setAttribute('aria-label', userPaused ? 'Reanudar servicios' : 'Pausar servicios');
    });

    // Clic o toque en la foto: siguiente. Deslizar: siguiente o anterior.
    let down = null;
    const isControl = (el) => el && el.closest('a, button, .tour-hud');
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || isControl(e.target)) { down = null; return; }
      down = { x: e.clientX, y: e.clientY };
    });
    stage.addEventListener('pointercancel', () => { down = null; });
    stage.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) { dx < 0 ? next() : prev(); }
      else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) next();
    });

    // Flechas del teclado mientras el carrusel está a la vista
    document.addEventListener('keydown', (e) => {
      if (!inView || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    // Etiqueta "Siguiente" que sigue al cursor
    if (cursor && finePointer) {
      let cx = 0, cy = 0, tx = 0, ty = 0, on = false;
      stage.addEventListener('pointermove', (e) => {
        const rct = stage.getBoundingClientRect();
        tx = e.clientX - rct.left + 18; ty = e.clientY - rct.top + 18;
        const over = !isControl(e.target);
        if (over && !on) { cx = tx; cy = ty; }
        on = over; cursor.classList.toggle('is-on', on);
      });
      stage.addEventListener('pointerleave', () => { on = false; cursor.classList.remove('is-on'); });
      gsap.ticker.add(() => {
        if (!on) return;
        cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25;
        cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      });
    }

    if (seq) window.addEventListener('resize', () => seq.size());
    setOn([0]);
    render();
    if (seq) { seq.size(); }
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

    // The process light follows scroll progress and activates each step.
    const pw = $('#pasos');
    if (pw) {
      const pasos = $$('.paso', pw);
      pw.style.setProperty('--p', '0');
      pw.style.setProperty('--p-y', '0%');
      ScrollTrigger.create({
        trigger: pw, start: 'top 76%', end: 'bottom 60%', scrub: 0.5,
        onUpdate: (self) => {
          const p = self.progress;
          pw.style.setProperty('--p', p.toFixed(4));
          pw.style.setProperty('--p-y', (p * 100).toFixed(2) + '%');
          pasos.forEach((el, i) => el.classList.toggle('on', p >= i / pasos.length + 0.02));
        },
      });
    }
  }

  /* ==================================================================
     Arranque
     ================================================================== */
  let hero = null;
  try { hero = initHero(); } catch (err) { hero = null; root.classList.add('ready'); }
  initTour();
  initSections();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, wait(700)])
    .catch(() => {})
    .then(() => {
      ScrollTrigger.refresh();
      if (hero) hero.intro(); else root.classList.add('ready');
    });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
