# maderavivagt

Sitio de Madera Viva (maderavivagt.com). HTML, CSS y JavaScript sin paso de compilación: GitHub Pages publica la carpeta tal cual.

- `index.html` — contenido de la página. El formulario usa Web3Forms; la llave se inyecta en el deploy (`__WEB3FORMS_ACCESS_KEY__`), por eso el formulario solo envía en el sitio publicado desde `main`.
- `css/site.css` — estilos. Tiene dos modos: base (todo visible, sin animación) y `html.motion` (escenas guiadas por el scroll).
- `js/site.js` — animaciones: el video de fondo del inicio que se funde en blanco al bajar, el carrusel del recorrido (cambia cada 15 s; clic o deslizar avanza), etc.
- `js/vendor/` — GSAP 3.15 (ScrollTrigger, SplitText) y Lenis 1.3, copiados aquí para no depender de un CDN.
- `img/SOURCES.md` — de dónde sale cada foto y video, y los créditos de audio.

Para verlo en tu máquina basta un servidor estático, por ejemplo `npx serve .`

Pruebas rápidas: `?estatico` muestra la versión sin animaciones; `?sinlenis` desactiva el scroll suave.

Para agregar fotos de proyectos reales, pon `<figure>` dentro de `#galeria`, entre los comentarios `PROYECTOS:INICIO` y `PROYECTOS:FIN` de `index.html` (clases opcionales `alto` y `ancho`).
## Meta Pixel

The homepage includes Meta Pixel `1509813702210954` in the document head. The Pixel ID is public by design and does not belong in GitHub Secrets.

The implementation also tracks WhatsApp and email contacts, appointment-intent clicks, successful appointment form submissions (`Lead`), commercial-video playback, Instagram outbound clicks, and first views of key sections.
Catalog events use Meta's `ViewContent` standard event for each visible design, with `content_ids`, `content_name`, `content_category`, `catalog_id`, `design_id`, and `design_slug`. Custom events record magazine opens (`CatalogMagazineView`), design views (`CatalogDesignView`), WhatsApp quote intent (`CatalogQuoteIntent`), and copied catalog links (`CatalogShare`). This makes the most-viewed catalog designs comparable in Meta Events Manager.