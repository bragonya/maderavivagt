// Catálogo en la portada: pinta las portadas de las revistas (datos en js/catalogo-data.js).
// Tocar una portada abre la revista (js/revista.js). Enlaces directos (también funcionan dentro de la página):
//   #revista-<id>                 abre la revista
//   #revista-<id>/<diseño>        la abre en ese diseño (p. ej. #revista-muros/comedor-con-molduras-en-color)
(function () {
  const C = window.CATALOGO;
  const ESTILO = { antigua: "Colonial", robson: "Contemporáneo", fusion: "Colonial moderno" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Enlaces limpios para compartir (páginas con vista previa en /catalogo/, generadas por sincronizar-sitio.cjs):
  //   /catalogo/<revista>/            abre la revista
  //   /catalogo/<revista>/<diseño>/   la abre en ese diseño
  const enlace = (id, slug) => location.origin + "/catalogo/" + id + "/" + (slug ? slug + "/" : "");
  const copiar = async (id, boton, slug) => {
    const url = enlace(id, slug);
    try { await navigator.clipboard.writeText(url); }
    catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    if (boton) { const txt = boton.textContent; boton.textContent = "¡Enlace copiado!"; setTimeout(() => (boton.textContent = txt), 1800); }
  };
  window.MV = Object.assign(window.MV || {}, { ESTILO, esc, enlace, copiar, hashAlCerrar: "#catalogo" });

  const cont = document.getElementById("revistas");
  if (!C || !cont) return;
  cont.innerHTML = C.revistas.map((r) => `
    <a class="revista aparece" href="#revista-${r.id}" data-revista="${r.id}" aria-label="Abrir la revista ${esc(r.titulo)}">
      <img src="${r.miniatura || r.portada}" alt="" loading="lazy">
      <div class="cab"><span class="marca">Madera Viva</span><span class="nro">Nº ${r.n} · Edición 2027 · ${r.disenos.length} estilos</span></div>
      <span class="abrir">Abrir →</span>
      <div class="pie-port">
        <h3>${esc(r.titulo)}</h3>
        <p class="lema">${esc(r.lema)}</p>
        <ul>${r.disenos.slice(0, 3).map((d) => `<li>${esc(d.nombre)}</li>`).join("")}${r.disenos.length > 3 ? `<li>y ${r.disenos.length - 3} más</li>` : ""}</ul>
      </div>
    </a>`).join("");

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  cont.querySelectorAll(".aparece").forEach((el) => io.observe(el));
})();
