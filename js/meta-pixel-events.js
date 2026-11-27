/* Meta Pixel interaction events for the public Madera Viva website. */
(function () {
  'use strict';

  const track = (eventName, parameters) => {
    if (typeof window.fbq === 'function') window.fbq('track', eventName, parameters || {});
  };
  const trackCustom = (eventName, parameters) => {
    if (typeof window.fbq === 'function') window.fbq('trackCustom', eventName, parameters || {});
  };
  window.mvMetaPixel = { track, trackCustom };
  const sourceName = (element) => {
    const region = element.closest('[id]');
    return region ? region.id : 'page';
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const rawHref = link.getAttribute('href') || '';
    const source = sourceName(link);
    if (rawHref === '#agendar') {
      trackCustom('ScheduleIntent', { source });
      return;
    }

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    if (url.hostname === 'wa.me' || url.hostname.endsWith('.whatsapp.com')) {
      track('Contact', { channel: 'whatsapp', source });
    } else if (url.protocol === 'mailto:') {
      track('Contact', { channel: 'email', source });
    } else if (url.hostname === 'instagram.com' || url.hostname.endsWith('.instagram.com')) {
      trackCustom('OutboundSocial', { channel: 'instagram', source });
    }
  }, true);

  const commercialVideo = document.getElementById('comercial');
  if (commercialVideo) {
    commercialVideo.addEventListener('play', () => {
      trackCustom('VideoPlay', { video_name: 'commercial' });
    }, { once: true });
  }

  if ('IntersectionObserver' in window) {
    const sectionIds = ['catalogo', 'materiales', 'proceso', 'proyectos', 'agendar'];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        trackCustom('SectionView', { section_name: entry.target.id });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    sectionIds.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) observer.observe(section);
    });
  }
})();
