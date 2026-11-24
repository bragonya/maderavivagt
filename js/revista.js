// Revista: cada categoría se abre como un libro con paso de página.
// Páginas tamaño Carta, listas para imprimir. Cada diseño ocupa un pliego (dos páginas):
//  · "pano": foto horizontal que cruza las dos páginas; el texto va en la esquina más tranquila.
//  · "par":  foto vertical limpia en una página y el texto en la otra, sobre la misma foto desenfocada.
// Así el texto nunca tapa el producto. El velo toma el color de la foto y se calcula para que se lea.
// Enlace directo: #revista-<id> baja hasta la portada y abre el libro en la primera página;
// #revista-<id>/<diseño> lo abre en ese diseño (el nombre corto sale de catalogo-data.js).
(function () {
  const C = window.CATALOGO;
  const { ESTILO, esc } = window.MV;
  const ASPECTO = 8.5 / 11;                    // ancho/alto de una página Carta
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DUR = reducir ? 20 : 1000;             // duración de un paso de página (igual que en el CSS)
  const TEX = "img/tex/burl.webp";
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const cuadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // ---------- Análisis de la foto ----------
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Solo se guardan los resultados (proporción y análisis), no las fotos: retenerlas llenaba la memoria del celular.
  const cache = new Map();
  const cargar = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const proporcion = (src) => {
    if (!cache.has("prop|" + src)) cache.set("prop|" + src, cargar(src).then((i) => i.naturalWidth / i.naturalHeight));
    return cache.get("prop|" + src);
  };
  // Fondo desenfocado ya hecho (img/ref/borroso/, lo genera sincronizar-sitio.cjs). Si falta, se usa la foto con blur de CSS.
  const borrosa = (src) => src.replace(/^img\/ref\/([^/]+)$/, "img/ref/borroso/$1");
  const fondoBorroso = (src, extra = "") => `<img class="pg-fondo borroso" src="${borrosa(src)}" alt=""${extra} onerror="this.onerror=null;this.src='${src}';this.classList.add('css')">`;

  // Regiones (en fracciones del lienzo) donde puede ir el texto.
  const REG_PAGINA = { arriba: [0, 0, 1, 0.45], abajo: [0, 0.55, 1, 1] };
  const REG_PANO = {
    "izq-abajo": [0.02, 0.5, 0.44, 1], "izq-arriba": [0.02, 0, 0.44, 0.5],
    "der-abajo": [0.56, 0.5, 0.98, 1], "der-arriba": [0.56, 0, 0.98, 0.5]
  };

  async function analizar(src, foco, aspecto, regiones) {
    const clave = [src, foco, aspecto, Object.keys(regiones).join()].join("|");
    if (cache.has(clave)) return cache.get(clave);
    const p = (async () => {
      const img = await cargar(src);
      const W = 96, H = Math.round(W / aspecto);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      const [fx, fy] = (foco || "50% 50%").split(" ").map((v) => parseFloat(v) / 100);
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      cx.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
      const d = cx.getImageData(0, 0, W, H).data;
      const L = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) L[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const out = {};
      for (const [z, [x0, y0, x1, y1]] of Object.entries(regiones)) {
        const vals = []; let r = 0, g = 0, b = 0, grad = 0, n = 0;
        for (let y = Math.floor(y0 * H); y < Math.ceil(y1 * H); y++) for (let x = Math.floor(x0 * W); x < Math.ceil(x1 * W); x++) {
          const i = y * W + x;
          vals.push(L[i]); r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++;
          if (x + 1 < W) grad += Math.abs(L[i + 1] - L[i]);
          if (y + 1 < H) grad += Math.abs(L[i + W] - L[i]);
        }
        vals.sort((a, c) => a - c);
        const media = vals.reduce((a, c) => a + c, 0) / n;
        const desv = Math.sqrt(vals.reduce((a, c) => a + (c - media) ** 2, 0) / n);
        out[z] = { media, desv, p10: vals[Math.floor(n * 0.1)], p90: vals[Math.floor(n * 0.9)], grad: grad / n, rgb: [r / n, g / n, b / n] };
        out[z].ruido = desv * 0.7 + out[z].grad * 2.2;
      }
      return out;
    })();
    cache.set(clave, p);
    return p;
  }

  // Tono del texto y velo con contraste suficiente (≥ ~5:1).
  function decidir(Z, pref = {}) {
    const mx = Math.max(...Z.rgb), sat = mx ? (mx - Math.min(...Z.rgb)) / mx : 0;
    const tono = pref.tono || ((Z.media > 0.38 && sat < 0.25) || Z.media > 0.55 ? "oscuro" : "claro");
    let rgb, alfa;
    if (tono === "claro") {
      rgb = Z.rgb.map((v) => Math.round(v * 0.26));
      const Lv = lum(...rgb), Lp = Math.max(Z.p90, 0.001);
      alfa = (Lp - 0.1) / Math.max(Lp - Lv, 0.001);
    } else {
      rgb = Z.rgb.map((v, i) => Math.round(v * 0.22 + [240, 234, 224][i] * 0.78));
      const Lv = lum(...rgb), Lp = Z.p10;
      alfa = (0.42 - Lp) / Math.max(Lv - Lp, 0.001);
    }
    const minimo = Math.min(0.88, 0.25 + Z.desv * 2 + Z.grad * 4); // fotos cargadas piden más velo
    alfa = Math.min(0.94, Math.max(minimo, alfa, pref.velo || 0)); // d.velo: velo mínimo para fondos muy cargados
    return { tono, rgb: rgb.join(","), alfa: alfa.toFixed(2) };
  }

  // Decide el pliego de cada diseño antes de armar las páginas.
  async function preparar(r) {
    const prep = { disenos: {} };
    await Promise.all(r.disenos.map(async (d) => {
      try {
        // Panorámica solo donde se verificó a mano que el texto cae en zona vacía (d.lado); si no, foto limpia + página de texto.
        // Las que no tienen d.lado no se cargan aquí: van en par.
        const modo = d.pliego || (d.lado && (await proporcion(d.img)) >= 1.25 ? "pano" : "par");
        if (modo === "par") { prep.disenos[d.id] = { modo }; return; }
        const st = await analizar(d.img, d.foco, ASPECTO * 2, REG_PANO);
        const clave = d.lado && d.zona ? `${d.lado}-${d.zona}` : Object.keys(st).reduce((a, k) => (st[k].ruido < st[a].ruido ? k : a));
        const [lado, zona] = clave.split("-");
        prep.disenos[d.id] = { modo, lado, zona, ...decidir(st[clave], d) };
      } catch (e) { prep.disenos[d.id] = { modo: "par" }; }
    }));
    try {
      const st = await analizar(r.portada, r.foco, ASPECTO, REG_PAGINA);
      prep.portada = { a: decidir(st.arriba, { tono: "claro" }), b: decidir(st.abajo, { tono: "claro" }) };
    } catch (e) { prep.portada = null; }
    return prep;
  }

  // ---------- Páginas ----------
  const chip = (e, mini) => `<span class="chip ${e}${mini ? " mini" : ""}">${ESTILO[e]}</span>`;
  const wa = (r) => `https://wa.me/${C.whatsapp}?text=` + encodeURIComponent(`Hola, vi la revista «${r.titulo}» de Madera Viva y quiero agendar la visita técnica gratis.`);
  // "Pérgola de Lamas con Luz" → "Pérgola <em>de Lamas con Luz</em>"
  const titular = (t) => {
    const m = t.match(/^(.+?)\s((?:de|con|en|para)\s.+)$/);
    return m ? `${esc(m[1])} <em>${esc(m[2])}</em>` : esc(t);
  };
  const sup = (r, d) => `<p class="ft-sup">${d.familia ? `<span>${esc(d.familia)}</span>` : `<span>Nº ${r.n}</span>`} ${chip(d.estilo, true)}</p>`;
  const datos = (d) => `
    <p class="ft-mat"><b>Materiales</b>${esc(d.materiales)}</p>
    ${d.precio ? `<p class="ft-precio">${esc(d.precio)}</p>` : ""}`;

  function pagsDe(r, prep = { disenos: {} }, { impresion = false } = {}) {
    const P = [];
    let folio = 0;
    const pie = (izq) => `<footer class="pg-folio"><span>${izq}</span><span>${++folio}</span></footer>`;
    const pt = prep.portada;
    const varsPortada = pt ? `--velo-a:${pt.a.rgb};--alfa-a:${pt.a.alfa};--velo-b:${pt.b.rgb};--alfa-b:${pt.b.alfa}` : "";

    P.push(`
      <div class="pg pg-port" style="${varsPortada}">
        <img class="pg-fondo" src="${r.portada}" alt="" style="object-position:${r.foco || "50% 50%"}">
        <div class="port-cab"><span class="port-marca">Madera Viva</span><span class="port-nro">Nº ${r.n} · Edición 2027</span></div>
        <div class="port-pie">
          <h2>${titular(r.titulo)}</h2>
          <p class="port-lema">${esc(r.lema)}</p>
          <ul>${r.disenos.slice(0, 4).map((d) => `<li>${esc(d.nombre)}</li>`).join("")}</ul>
        </div>
      </div>`);

    P.push(`
      <div class="pg pg-ft pg-intro t-claro" style="--velo:30,20,14;--alfa:.66">
        <img class="pg-fondo" src="${TEX}" alt=""><div class="velo"></div>
        <div class="ft-bloque">
          <p class="ft-sup">${esc(r.para)}</p>
          <span class="intro-num">${r.n}</span>
          <h2 class="ft-nom grande">${titular(r.titulo)}</h2>
          <p class="ft-lema">${esc(r.lema)}</p>
          <p class="ft-valor">${esc(r.intro)}</p>
          <p class="intro-ley">${chip("antigua")} ${chip("robson")} ${chip("fusion")}</p>
        </div>
        ${pie(`Madera Viva · Nº ${r.n}`)}
      </div>`);

    P.push(`
      <div class="pg pg-ft pg-indice t-claro">
        ${fondoBorroso(r.portada)}
        <div class="ft-bloque">
          <p class="ft-sup">Contenido</p>
          <h2 class="ft-nom">En esta <em>edición</em></h2>
          <div class="ind-lista">
            ${r.disenos.map((d, i) => `
              <button type="button" class="ind-fila" data-ir="${i}">
                <span class="ind-n">${3 + 2 * i}</span>
                <span class="ind-nom">${esc(d.nombre)}${d.familia ? `<small>${esc(d.familia)}</small>` : ""}</span>${chip(d.estilo, true)}
              </button>`).join("")}
          </div>
        </div>
        ${pie(impresion ? "Contenido" : "Toque un estilo para ir a su página")}
      </div>`);

    r.disenos.forEach((d, i) => {
      const pr = prep.disenos[d.id] || { modo: "par" };
      const foco = d.foco || "50% 50%";
      if (pr.modo === "pano") {
        const texto = `
          <div class="ft-bloque"${d.alto || d.ancho ? ` style="${d.alto ? `max-height:${d.alto}%;` : ""}${d.ancho ? `width:${d.ancho}%;` : ""}"` : ""}>
            ${sup(r, d)}
            <h3 class="ft-nom">${titular(d.nombre)}</h3>
            <p class="ft-valor">${esc(d.valor)}</p>
            ${datos(d)}
          </div>`;
        for (const mitad of ["izq", "der"]) {
          const conTexto = mitad === pr.lado;
          P.push(`
            <div class="pg pg-ft pg-pano mitad-${mitad} ${conTexto ? `con-texto z-${pr.zona} t-${pr.tono}${d.velo ? " velo-amplio" : ""}` : "t-claro"}" style="--velo:${pr.rgb || "20,16,12"};--alfa:${pr.alfa || 0.6}">
              <div class="pano"><img src="${d.img}" alt="${esc(d.nombre)}" style="object-position:${foco}"></div>
              <div class="velo"></div>
              ${conTexto ? texto : ""}
              ${pie(conTexto ? `Imagen ilustrativa · ${esc(r.titulo)}` : esc(d.nombre))}
            </div>`);
        }
      } else {
        // Funciones para que el folio salga en el orden real de las páginas.
        // encaje "entera": la foto completa sobre su propio fondo desenfocado (para fotos anchas que no aguantan recorte).
        const foto = () => d.encaje === "entera" ? `
          <div class="pg pg-ft pg-solo pg-entera t-claro">
            ${fondoBorroso(d.img)}
            <img class="foto-entera" src="${d.img}" alt="${esc(d.nombre)}">
            <div class="velo"></div>
            ${pie(esc(d.nombre))}
          </div>` : `
          <div class="pg pg-ft pg-solo t-claro">
            <img class="pg-fondo" src="${d.img}" alt="${esc(d.nombre)}" style="object-position:${foco}">
            <div class="velo"></div>
            ${pie(esc(d.nombre))}
          </div>`;
        const texto = () => `
          <div class="pg pg-ft pg-par t-claro">
            ${fondoBorroso(d.img, ` style="object-position:${foco}"`)}
            <div class="ft-bloque">
              ${sup(r, d)}
              <h3 class="ft-nom grande">${titular(d.nombre)}</h3>
              <p class="ft-lead">${esc(d.desc)}</p>
              <p class="ft-valor">${esc(d.valor)}</p>
              ${datos(d)}
            </div>
            ${pie(`Imagen ilustrativa · ${esc(r.titulo)}`)}
          </div>`;
        // Alterna el lado de la foto para darle ritmo a la revista.
        if (i % 2 === 0) { P.push(foto()); P.push(texto()); } else { P.push(texto()); P.push(foto()); }
      }
    });

    const ultima = r.disenos[r.disenos.length - 1];
    P.push(`
      <div class="pg pg-ft pg-cta t-claro">
        ${fondoBorroso(ultima.img)}
        <div class="ft-bloque">
          <p class="ft-sup">¿Cuál va en su espacio?</p>
          <h2 class="ft-nom grande">Lo visitamos, medimos y le proponemos el estilo <em>sin costo.</em></h2>
          <p class="ft-valor">Visita técnica gratis y sin compromiso. Si nos envía una foto de su espacio, le mandamos un render aproximado el mismo día.</p>
          <a class="boton cta-boton" href="${wa(r)}" target="_blank" rel="noopener">WhatsApp ${C.whatsappTexto}</a>
          <p class="cta-zona">Ciudad de Guatemala · Antigua Guatemala · Jutiapa</p>
        </div>
        ${pie("maderavivagt.com")}
      </div>`);

    P.push(`
      <div class="pg pg-ft pg-final t-claro" style="--velo:22,15,10;--alfa:.74">
        <img class="pg-fondo" src="${TEX}" alt="" style="object-position:20% 70%"><div class="velo"></div>
        <div class="ft-bloque">
          <img class="final-logo" src="img/logo-marfil.png" alt="Madera Viva">
          <p class="ft-sup">Otras ediciones</p>
          <div class="final-lista">
            ${C.revistas.filter((x) => x.id !== r.id).map((x) => `
              <button type="button" class="final-fila" data-revista-ir="${x.id}"><span>Nº ${x.n}</span>${esc(x.titulo)}</button>`).join("")}
          </div>
        </div>
        ${pie("maderavivagt.com · WhatsApp " + C.whatsappTexto)}
      </div>`);

    P.push(`
      <div class="pg pg-contra">
        <img class="pg-fondo" src="${TEX}" alt="" style="object-position:80% 30%">
        <div class="contra-centro">
          <img src="img/logo-marfil.png" alt="Madera Viva">
          <p>Catálogo 2027 · maderavivagt.com</p>
        </div>
      </div>`);
    return P;
  }

  // Encoge el bloque de texto si no cabe en su zona.
  function ajustarTextos(raiz) {
    raiz.querySelectorAll(".ft-bloque").forEach((el) => {
      let f = 1;
      el.style.fontSize = "";
      while (el.scrollHeight > el.clientHeight + 1 && f > 0.62) { f -= 0.03; el.style.fontSize = f + "em"; }
    });
  }

  // ---------- Visor ----------
  const capa = document.createElement("div");
  capa.className = "libro-capa";
  capa.hidden = true;
  capa.setAttribute("role", "dialog");
  capa.setAttribute("aria-modal", "true");
  capa.innerHTML = `
    <div class="libro-top">
      <span class="libro-titulo"></span>
      <div class="libro-top-acc">
        <a class="libro-btn libro-wa" href="#" target="_blank" rel="noopener"><span class="largo">Cotizar por WhatsApp</span><span class="corto">Cotizar</span></a>
        <button type="button" class="libro-btn libro-copiar"><span class="txt">Copiar enlace</span><span class="que"> de la revista</span><span class="ok">¡Enlace copiado!</span></button>
        <button type="button" class="libro-btn libro-cerrar" aria-label="Cerrar la revista">✕</button>
      </div>
    </div>
    <div class="libro-escena"><div class="libro"></div></div>
    <button type="button" class="libro-ctrl libro-prev" aria-label="Página anterior">‹</button>
    <button type="button" class="libro-ctrl libro-next" aria-label="Página siguiente">›</button>
    <div class="libro-pie"><span class="libro-pag"></span></div>`;
  document.body.appendChild(capa);
  const escena = capa.querySelector(".libro-escena");
  const libro = capa.querySelector(".libro");
  const $titulo = capa.querySelector(".libro-titulo");
  const $pag = capa.querySelector(".libro-pag");
  const $prev = capa.querySelector(".libro-prev");
  const $next = capa.querySelector(".libro-next");
  const $wa = capa.querySelector(".libro-wa");
  const $copiar = capa.querySelector(".libro-copiar");

  let rev = null, prep = null, paginas = [], hojas = [], actual = 0, modo = "doble", abierta = false, tarjeta = null, ocupado = false;
  let ultimaVistaCatalogo = "";
  // Celular y tableta (menos de 900 px): también a dos páginas, como la revista impresa. Tocar la página derecha
  // avanza y la izquierda regresa (igual que en la computadora); pellizcar con dos dedos agranda.
  // zoom: "libre" (pellizco) o "izq"/"der"/"centro" (una página a lo ancho, al pasar con las flechas estando agrandada).
  let compacto = false, escala = 1, anchoPag = 0, zoom = null, podar = 0;
  // Acercamiento de la escena: translate(x, y) scale(s). zoom "libre" = el que deja el pellizco (dos dedos o trackpad).
  let vista = { s: 1, x: 0, y: 0 };

  function medir() {
    modo = "doble";
    compacto = innerWidth < 900;
    capa.classList.toggle("compacto", compacto);
    const w = compacto ? innerWidth - 16 : innerWidth - 220, h = innerHeight - (compacto ? 150 : 140);
    const ph = Math.min(h, (w / 2) / ASPECTO), pw = ph * ASPECTO;
    anchoPag = pw;
    // Cuánto se acerca una página al tocarla: que llene el ancho sin pasarse del alto disponible.
    escala = compacto ? Math.min((innerWidth - 12) / pw, (innerHeight - 124) / ph) : 1;
    capa.style.setProperty("--pw", pw + "px");
    capa.style.setProperty("--ph", ph + "px");
    escena.style.width = pw * 2 + "px";
    escena.style.height = ph + "px";
    libro.style.fontSize = pw * 0.033 + "px";
  }

  // Solo se arman las páginas cercanas a la que está a la vista; las demás quedan vacías y ocultas.
  // Armar la revista completa (20+ páginas, cada una en su capa 3D) hacía que el celular se quedara sin memoria.
  function hoja(frente, reverso) {
    const h = document.createElement("div");
    h.className = "hoja lejos";
    h.innerHTML = `<div class="cara frente"></div><div class="cara reverso"></div>`;
    h._html = [frente, reverso];
    return h;
  }
  function llenar(h) {
    if (h._lleno) return;
    h._lleno = true; h._ajustada = false;
    h.children[0].innerHTML = h._html[0];
    h.children[1].innerHTML = h._html[1];
  }
  function vaciar(h) {
    if (!h._lleno) return;
    h._lleno = false;
    h.children[0].innerHTML = h.children[1].innerHTML = "";
  }
  // vistas: hojas que se ven ahora (la de la izquierda y la de la derecha) más las que van a girar.
  function sincronizar(extra = []) {
    const ver = new Set([actual - 1, actual, ...extra]);
    // Las que todavía están girando (pasos seguidos) siguen a la vista con sus vecinas hasta que terminan.
    hojas.forEach((h, i) => { if (h.classList.contains("girando")) { ver.add(i - 1); ver.add(i); ver.add(i + 1); } });
    const listas = new Set();
    ver.forEach((i) => { listas.add(i - 1); listas.add(i); listas.add(i + 1); }); // las vecinas cargan sus fotos por adelantado
    hojas.forEach((h, i) => {
      if (listas.has(i)) llenar(h); else vaciar(h);
      if (ver.has(i)) {
        h.classList.remove("lejos");
        if (!h._ajustada) { h._ajustada = true; ajustarTextos(h); }
      } else h.classList.add("lejos");
    });
  }

  function construir(pIndex) {
    medir();
    zoom = null; aplicarZoom(true);
    paginas = pagsDe(rev, prep);
    libro.innerHTML = "";
    hojas = [];
    for (let k = 0; k < paginas.length / 2; k++) hojas.push(hoja(paginas[2 * k], paginas[2 * k + 1]));
    actual = Math.ceil(pIndex / 2);
    hojas.forEach((h, i) => { h.classList.toggle("volteada", i < actual); marcarCara(h, i < actual); libro.appendChild(h); });
    sincronizar();
    ordenar(); posicion(); ui();
  }

  // Acercar una página (celular). La escena se agranda y se corre para que esa página llene el ancho.
  function pintarVista() {
    const { s, x, y } = vista;
    escena.style.transform = s === 1 && !x && !y ? "" : `translate(${x}px, ${y}px) scale(${s})`;
  }
  function aplicarZoom(sinAnim) {
    capa.classList.toggle("con-zoom", !!zoom);
    if (zoom !== "libre") {
      const dx = zoom === "izq" ? escala * anchoPag / 2 : zoom === "der" ? -escala * anchoPag / 2 : 0;
      vista = zoom ? { s: escala, x: dx, y: 0 } : { s: 1, x: 0, y: 0 };
    }
    if (sinAnim) escena.style.transition = "none";
    pintarVista();
    if (sinAnim) { void escena.offsetWidth; escena.style.transition = ""; }
  }

  // ---------- Pellizcar para agrandar ----------
  const maxEscala = () => (compacto ? Math.max(4, escala * 2.4) : 3);
  const centroEscena = () => ({ x: escena.offsetLeft + escena.offsetWidth / 2, y: escena.offsetTop + escena.offsetHeight / 2 });
  // Agranda o achica dejando quieto el punto (px, py) de la pantalla.
  function zoomEn(px, py, s2, base) {
    const c = centroEscena(), k = (s2 = Math.max(1, Math.min(maxEscala(), s2))) / base.s;
    return { s: s2, x: px - c.x - k * (px - c.x - base.x), y: py - c.y - k * (py - c.y - base.y) };
  }
  // Que la revista agrandada no se salga de la pantalla: si es más grande que el espacio, sus bordes no se despegan.
  function acotar(v) {
    const c = centroEscena(), W = escena.offsetWidth * v.s, H = escena.offsetHeight * v.s, m = 8;
    const arriba = compacto ? 64 : 70, abajo = innerHeight - (compacto ? 78 : 70);
    v.x = W <= innerWidth - 2 * m ? 0 : Math.min(m - c.x + W / 2, Math.max(innerWidth - m - c.x - W / 2, v.x));
    v.y = H <= abajo - arriba ? 0 : Math.min(arriba - c.y + H / 2, Math.max(abajo - c.y - H / 2, v.y));
    return v;
  }
  // Al soltar: casi sin agrandar vuelve a las dos páginas; si no, se queda donde la dejó.
  function terminarPellizco() {
    capa.classList.remove("gesto");
    if (vista.s < 1.08) { zoom = null; aplicarZoom(); }
    else { zoom = "libre"; capa.classList.add("con-zoom"); acotar(vista); pintarVista(); }
    ui();
  }
  function moverVista(v) { vista = acotar(v); zoom = "libre"; capa.classList.add("con-zoom", "gesto"); pintarVista(); }

  const ladoDe = (n) => (n === 0 || n === hojas.length ? "centro" : null);
  function alejar() { zoom = null; aplicarZoom(); ui(); }
  // Con una página acercada, "siguiente" pasa a la de al lado y, al llegar a la derecha, voltea la hoja.
  // Con el acercamiento libre, cuenta como acercada la página que está más al centro.
  function avanzar() {
    if (zoom === "libre") zoom = ladoDe(actual) || (vista.x > 0 ? "izq" : "der");
    if (!zoom) return sig();
    if (zoom === "izq") { zoom = "der"; aplicarZoom(); ui(); return; }
    if (actual >= maxActual()) return;
    sig(); zoom = ladoDe(actual) || "izq"; aplicarZoom(); ui();
  }
  function retroceder() {
    if (zoom === "libre") zoom = ladoDe(actual) || (vista.x > 0 ? "izq" : "der");
    if (!zoom) return ant();
    if (zoom === "der") { zoom = "izq"; aplicarZoom(); ui(); return; }
    if (actual <= 0) return;
    ant(); zoom = ladoDe(actual) || "der"; aplicarZoom(); ui();
  }

  const maxActual = () => (modo === "doble" ? hojas.length : hojas.length - 1);
  const paginaVisible = () => (modo === "doble" ? (actual === 0 ? 0 : 2 * actual - 1) : actual);

  function ordenar() {
    hojas.forEach((h, i) => {
      if (h.classList.contains("girando")) return;
      h.style.zIndex = h.classList.contains("volteada") ? i + 1 : hojas.length * 2 - i;
    });
  }

  function posicion() {
    libro.classList.toggle("cerrado-frente", modo === "doble" && actual === 0);
    libro.classList.toggle("cerrado-atras", modo === "doble" && actual === hojas.length);
  }

  // La cara que no mira al lector se oculta con visibility, sin depender de backface-visibility:
  // Safari en iPhone no siempre la oculta y se veía al revés, encimada sobre la página.
  // Al girar, el cambio de cara ocurre a la mitad, cuando la hoja está de canto.
  function marcarCara(h, volteada) {
    h.classList.toggle("ver-reverso", volteada);
    h.classList.toggle("ver-frente", !volteada);
  }

  function voltear(i, adelante) {
    const h = hojas[i];
    if (!h) return;
    clearTimeout(h._c);
    h._c = setTimeout(() => marcarCara(h, adelante), DUR / 2);
    h.classList.add("girando");
    h.style.zIndex = 500 + (adelante ? i : hojas.length - i);
    h.classList.toggle("volteada", adelante);
    clearTimeout(h._t);
    h._t = setTimeout(() => { h.classList.remove("girando"); ordenar(); }, DUR + 30);
  }

  function irA(n) {
    n = Math.max(0, Math.min(n, maxActual()));
    if (n === actual) return;
    const adelante = n > actual;
    let seq = [];
    if (adelante) for (let i = actual; i < n; i++) seq.push(i);
    else for (let i = actual - 1; i >= n; i--) seq.push(i);
    // En un salto largo (desde el índice, o un enlace) las hojas del medio pasan sin animación: solo se ven girar las dos últimas.
    if (seq.length > 2) {
      seq.slice(0, -2).forEach((i) => { hojas[i].classList.add("sin-trans"); hojas[i].classList.toggle("volteada", adelante); marcarCara(hojas[i], adelante); });
      seq = seq.slice(-2);
    }
    const extra = [];
    for (let i = Math.min(...seq) - 1; i <= Math.max(...seq) + 1; i++) extra.push(i);
    actual = n;
    sincronizar(extra);
    ordenar();
    void libro.offsetWidth; // que las hojas recién mostradas tengan estilo antes de girar
    libro.querySelectorAll(".sin-trans").forEach((h) => h.classList.remove("sin-trans"));
    seq.forEach((i, j) => setTimeout(() => voltear(i, adelante), reducir ? 0 : j * 110));
    clearTimeout(podar);
    podar = setTimeout(() => sincronizar(), DUR + 80 + seq.length * 110);
    posicion(); ui();
  }
  const sig = () => irA(actual + 1);
  const ant = () => irA(actual - 1);
  function irPagina(p) {
    irA(Math.ceil(p / 2));
    if (zoom) { zoom = ladoDe(actual) || (p % 2 ? "izq" : "der"); aplicarZoom(); ui(); }
  }
  const irDiseno = (i) => irPagina(3 + 2 * i);

  // Diseño que se ve ahora (cada diseño ocupa las páginas 3+2i y 4+2i), o -1.
  function disenoVisible() {
    if (!rev) return -1;
    const i = modo === "doble" ? actual - 2 : Math.floor((actual - 3) / 2);
    return i >= 0 && i < rev.disenos.length ? i : -1;
  }

  function parametrosCatalogo() {
    if (!rev) return null;
    const i = disenoVisible();
    const d = i >= 0 ? rev.disenos[i] : null;
    return {
      content_type: d ? "product" : "product_group",
      content_ids: [d ? `${rev.id}:${d.slug}` : rev.id],
      content_name: d ? d.nombre : rev.titulo,
      content_category: rev.titulo,
      catalog_id: rev.id,
      ...(d ? { design_id: d.id, design_slug: d.slug } : {}),
    };
  }

  function trackCatalogView() {
    if (!abierta || !rev || !window.mvMetaPixel) return;
    const i = disenoVisible();
    const key = i >= 0 ? `${rev.id}:${rev.disenos[i].slug}` : `magazine:${rev.id}`;
    if (key === ultimaVistaCatalogo) return;
    ultimaVistaCatalogo = key;
    const params = parametrosCatalogo();
    window.mvMetaPixel.track("ViewContent", params);
    window.mvMetaPixel.trackCustom(i >= 0 ? "CatalogDesignView" : "CatalogMagazineView", params);
  }

  // El enlace de la barra sigue a la página: así "Copiar enlace" comparte el diseño que está a la vista.
  // Enlace para compartir lo que está a la vista: el sitio da enlaces limpios (/catalogo/<revista>/<diseño>/)
  // con su propia vista previa; si no, el de esta página con #revista-…
  function enlaceActual() {
    const i = disenoVisible();
    const slug = i >= 0 ? rev.disenos[i].slug : "";
    return window.MV.enlace ? window.MV.enlace(rev.id, slug) : location.origin + location.pathname + "#revista-" + rev.id + (slug ? "/" + slug : "");
  }

  // El botón de WhatsApp cotiza el diseño a la vista (o la revista) y manda su enlace.
  function marcarEnlace() {
    if (!abierta || !rev) return;
    const i = disenoVisible();
    const hash = "#revista-" + rev.id + (i >= 0 ? "/" + rev.disenos[i].slug : "");
    history.replaceState(null, "", hash);
    $copiar.querySelector(".que").textContent = i >= 0 ? " del diseño" : " de la revista";
    const url = enlaceActual();
    const msj = i >= 0
      ? `Hola Madera Viva, me interesa el diseño «${rev.disenos[i].nombre}» del catálogo: ${url}`
      : `Hola Madera Viva, vi la revista «${rev.titulo}» del catálogo y quiero cotizar: ${url}`;
    $wa.href = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msj);
    $wa.querySelector(".largo").textContent = i >= 0 ? "Cotizar este diseño" : "Cotizar por WhatsApp";
  }

  function ui() {
    const interiores = paginas.length - 2;
    const p = paginaVisible();
    let txt;
    if (p === 0) txt = "Portada · toque para abrir";
    else if ((modo === "doble" && actual === hojas.length) || (modo === "simple" && p === paginas.length - 1)) txt = "Contraportada";
    else if (zoom === "libre") txt = `Páginas ${p}–${Math.min(p + 1, interiores)} · toque para alejar`;
    else if (zoom === "izq" || zoom === "der") txt = `Página ${zoom === "izq" ? p : p + 1} de ${interiores}`;
    else if (compacto) txt = `Páginas ${p}–${Math.min(p + 1, interiores)} · pellizque para agrandar`;
    else txt = `Páginas ${p}–${Math.min(p + 1, interiores)} de ${interiores}`;
    $pag.textContent = txt;
    $prev.disabled = actual === 0;
    $next.disabled = actual === maxActual();
    marcarEnlace();
    trackCatalogView();
  }

  // ---------- Abrir y cerrar ----------
  const totalmenteVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight; };

  async function abrir(id, pagina = 1) {
    const r = C.revistas.find((x) => x.id === id);
    if (!r || ocupado) return;
    ocupado = true;
    rev = r;
    ultimaVistaCatalogo = "";
    tarjeta = document.querySelector(`.revista[data-revista="${id}"]`);
    $titulo.innerHTML = `<b>Nº ${r.n}</b> ${esc(r.titulo)}`;
    capa.hidden = false;
    document.documentElement.classList.add("libro-on");
    libro.classList.add("sin-anim");
    if (document.fonts) await document.fonts.ready;
    prep = await preparar(r);
    construir(0);
    await cuadro();

    // La portada sale del lugar de la tarjeta y crece hasta el centro.
    const tr = tarjeta && tarjeta.getBoundingClientRect();
    if (tr && tr.width && !reducir) {
      const er = escena.getBoundingClientRect(), pr = hojas[0].getBoundingClientRect();
      const s = tr.width / pr.width;
      escena.style.transformOrigin = "0 0";
      escena.style.transition = "none";
      escena.style.transform = `translate(${tr.left - er.left - (pr.left - er.left) * s}px, ${tr.top - er.top - (pr.top - er.top) * s}px) scale(${s})`;
      tarjeta.style.visibility = "hidden";
      await cuadro();
      capa.classList.add("visible");
      escena.style.transition = "transform .8s cubic-bezier(.2,.75,.2,1)";
      escena.style.transform = "none";
      await espera(820);
    } else {
      capa.classList.add("visible");
      await espera(250);
    }
    escena.style.transition = escena.style.transformOrigin = "";
    escena.style.transform = "";
    libro.classList.remove("sin-anim");
    abierta = true;
    ocupado = false;
    history.replaceState(null, "", "#revista-" + id);
    capa.querySelector(".libro-cerrar").focus({ preventScroll: true });
    await espera(reducir ? 0 : 150);
    irPagina(pagina); // primera página (o la pedida en el enlace)
  }

  async function cerrar() {
    if (!abierta || ocupado) return;
    ocupado = true;
    abierta = false;
    escena.style.transition = "transform .45s ease";
    escena.style.transform = "scale(.94)";
    capa.classList.remove("visible");
    await espera(460);
    capa.hidden = true;
    escena.style.transition = escena.style.transform = "";
    zoom = null; vista = { s: 1, x: 0, y: 0 }; dedos.clear(); gesto = null;
    capa.classList.remove("con-zoom", "gesto");
    clearTimeout(podar);
    document.documentElement.classList.remove("libro-on");
    libro.innerHTML = "";
    hojas = [];
    if (tarjeta) { tarjeta.style.visibility = ""; tarjeta.focus({ preventScroll: true }); }
    // Al cerrar, la dirección vuelve a la sección del catálogo si la página lo indica (en el sitio, #catalogo).
    history.replaceState(null, "", location.pathname + location.search + (window.MV.hashAlCerrar || ""));
    ocupado = false;
  }

  function scrollQuieto() {
    return new Promise((res) => {
      let y = scrollY, quieto = 0;
      const t0 = Date.now();
      const iv = setInterval(() => {
        quieto = scrollY === y ? quieto + 1 : 0;
        y = scrollY;
        if (quieto >= 3 || Date.now() - t0 > 2500) { clearInterval(iv); res(); }
      }, 90);
    });
  }

  // Página a la que lleva la parte después de la barra: un número de página, o el nombre corto (o el código) de un diseño.
  function paginaDe(r, parte) {
    if (!parte) return 1;
    if (/^\d+$/.test(parte)) return Math.max(1, +parte);
    const p = parte.toLowerCase();
    const i = r.disenos.findIndex((d) => d.slug === p || d.id.toLowerCase() === p);
    return i >= 0 ? 3 + 2 * i : 1;
  }

  // #revista-<id>[/<página o diseño>]: baja hasta la portada y abre el libro.
  async function rutaHash() {
    const m = location.hash.match(/^#revista-([\w-]+?)(?:\/([\w-]+))?$/);
    if (!m) return;
    const id = m[1];
    const r = C.revistas.find((x) => x.id === id);
    if (!r) return;
    const pagina = paginaDe(r, m[2]);
    if (abierta) { if (rev.id === id) { irPagina(pagina); return; } await cerrar(); }
    const card = document.querySelector(`.revista[data-revista="${id}"]`);
    if (!card) return;
    card.classList.add("visible");
    if (!totalmenteVisible(card)) {
      // En el sitio, el scroll suave (Lenis) se encarga; aquí, el del navegador.
      if (window.MV.scrollA) window.MV.scrollA(card);
      else card.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "center" });
      await scrollQuieto();
    }
    abrir(id, pagina);
  }

  // ---------- Eventos ----------
  capa.querySelector(".libro-cerrar").addEventListener("click", cerrar);
  $wa.addEventListener("click", () => {
    if (rev && window.mvMetaPixel) window.mvMetaPixel.trackCustom("CatalogQuoteIntent", parametrosCatalogo());
  });
  $copiar.addEventListener("click", async () => {
    if (!rev) return;
    const params = parametrosCatalogo();
    if (window.mvMetaPixel) window.mvMetaPixel.trackCustom("CatalogShare", params);
    const url = enlaceActual();
    try { await navigator.clipboard.writeText(url); }
    catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    $copiar.classList.add("copiado");
    clearTimeout($copiar._t);
    $copiar._t = setTimeout(() => $copiar.classList.remove("copiado"), 1800);
  });
  $prev.addEventListener("click", retroceder);
  $next.addEventListener("click", avanzar);

  // Gestos en cualquier parte de la pantalla (menos la barra y los botones):
  //  · deslizar con un dedo pasa la página;
  //  · pellizcar con dos dedos agranda donde están los dedos; con la página agrandada, un dedo la mueve.
  const dedos = new Map();
  let gesto = null, arrastre = false;
  const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const medio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function empezarUnDedo(p) { gesto = { tipo: "uno", x: p.x, y: p.y, v: { ...vista }, movio: false }; }
  capa.addEventListener("pointerdown", (e) => {
    if (!abierta || e.target.closest(".libro-top, .libro-ctrl")) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) { arrastre = false; empezarUnDedo(dedos.get(e.pointerId)); }
    else if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      gesto = { tipo: "pinza", d: distancia(a, b), m: medio(a, b), v: { ...vista } };
      arrastre = true;
      capa.classList.add("gesto");
    }
  });
  capa.addEventListener("pointermove", (e) => {
    if (!dedos.has(e.pointerId) || !gesto) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesto.tipo === "pinza" && dedos.size >= 2) {
      const [a, b] = [...dedos.values()], m = medio(a, b);
      const v = zoomEn(gesto.m.x, gesto.m.y, gesto.v.s * distancia(a, b) / gesto.d, gesto.v);
      moverVista({ s: v.s, x: v.x + m.x - gesto.m.x, y: v.y + m.y - gesto.m.y });
    } else if (gesto.tipo === "uno" && zoom === "libre") {
      const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
      if (!gesto.movio && Math.hypot(dx, dy) < 6) return;
      gesto.movio = arrastre = true;
      moverVista({ s: gesto.v.s, x: gesto.v.x + dx, y: gesto.v.y + dy });
    }
  });
  function soltar(e) {
    if (!dedos.has(e.pointerId)) return;
    const p = dedos.get(e.pointerId);
    dedos.delete(e.pointerId);
    if (!gesto) return;
    if (gesto.tipo === "pinza") {
      if (dedos.size < 2) { terminarPellizco(); if (dedos.size === 1) { empezarUnDedo([...dedos.values()][0]); gesto.movio = true; } else gesto = null; }
      return;
    }
    const g = gesto; gesto = null;
    if (g.movio) { capa.classList.remove("gesto"); return; }
    if (e.type === "pointercancel" || zoom === "libre") return;
    const dx = p.x - g.x, dy = p.y - g.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { arrastre = true; dx < 0 ? avanzar() : retroceder(); }
  }
  capa.addEventListener("pointerup", soltar);
  capa.addEventListener("pointercancel", soltar);
  capa.addEventListener("dragstart", (e) => e.preventDefault()); // arrastrar una foto cancelaba el deslizamiento
  // Safari: que el pellizco no agrande toda la página web en vez de la revista.
  const tactil = navigator.maxTouchPoints > 0;
  let g0 = null;
  capa.addEventListener("gesturestart", (e) => {
    e.preventDefault();
    if (tactil || !abierta) return; // en el celular el pellizco ya llega por los dedos
    g0 = { v: { ...vista }, x: e.clientX, y: e.clientY };
  });
  capa.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    if (g0) moverVista(zoomEn(g0.x, g0.y, g0.v.s * e.scale, g0.v));
  });
  capa.addEventListener("gestureend", (e) => { e.preventDefault(); if (g0) { g0 = null; terminarPellizco(); } });
  // Trackpad en Chrome/Edge/Firefox: pellizcar llega como rueda con Ctrl. Con la página agrandada, dos dedos la mueven.
  let rueda = 0;
  capa.addEventListener("wheel", (e) => {
    if (!abierta) return;
    if (e.ctrlKey) {
      e.preventDefault();
      moverVista(zoomEn(e.clientX, e.clientY, vista.s * Math.exp(-e.deltaY * 0.01), vista));
    } else if (zoom === "libre") {
      e.preventDefault();
      moverVista({ ...vista, x: vista.x - e.deltaX, y: vista.y - e.deltaY });
    } else return;
    clearTimeout(rueda);
    rueda = setTimeout(terminarPellizco, 180);
  }, { passive: false });
  escena.addEventListener("click", (e) => {
    if (arrastre) { arrastre = false; return; }
    const ir = e.target.closest("[data-ir]");
    if (ir) { irDiseno(+ir.dataset.ir); return; }
    const otra = e.target.closest("[data-revista-ir]");
    if (otra) { location.hash = "#revista-" + otra.dataset.revistaIr; return; }
    if (e.target.closest("a, button")) return;
    if (zoom) { alejar(); return; } // con la revista agrandada, un toque vuelve a las dos páginas
    const h = e.target.closest(".hoja");
    if (h) h.classList.contains("volteada") ? ant() : sig();
  });

  document.addEventListener("keydown", (e) => {
    if (!abierta) return;
    if (e.key === "ArrowRight") avanzar();
    else if (e.key === "ArrowLeft") retroceder();
    else if (e.key === "Escape") cerrar();
  });

  let rz;
  addEventListener("resize", () => {
    if (!abierta) return;
    clearTimeout(rz);
    rz = setTimeout(() => {
      libro.classList.add("sin-anim");
      construir(paginaVisible());
      requestAnimationFrame(() => libro.classList.remove("sin-anim"));
    }, 150);
  });

  // Tocar una portada abre la revista ahí mismo, sin desplazar la página (el desplazamiento hasta la
  // portada es solo para los enlaces que llegan de afuera: #revista-… o /catalogo/<revista>/).
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".revista[data-revista]");
    if (!card || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (abierta || ocupado) return;
    abrir(card.dataset.revista, 1);
  });

  addEventListener("hashchange", rutaHash);
  if (/^#revista-/.test(location.hash)) {
    const iniciar = () => setTimeout(rutaHash, 350);
    document.readyState === "complete" ? iniciar() : addEventListener("load", iniciar);
  }

  // Para la versión de imprenta (imprimir.html).
  window.MV.revista = { pagsDe, preparar, ajustarTextos, ASPECTO };
})();
