/* =====================================================================
   AM Luxury Beauty Studio · js/main.js
   Un solo archivo. Orden: núcleo común (AM) → scroll/reseñas/horario/menú/
   evaluaciones/carrusel → galería → buscador → navegación → idioma →
   reserva → Margarita (asistente) → vídeos del equipo.
   ===================================================================== */

/* ---------- Núcleo común: helpers que antes estaban repetidos en cada bloque ---------- */
var AM = (function(){
  var root = document.documentElement, NS = 'http://www.w3.org/2000/svg', langCbs = [];
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // Un único observador del atributo <html lang>: avisa a quien se haya registrado con onLang()
  new MutationObserver(function(){ langCbs.forEach(function(f){ f(); }); })
    .observe(root, {attributes:true, attributeFilter:['lang']});

  function lang(){ return root.lang === 'en' ? 'en' : 'es'; }

  return {
    PHONE: '5354117337',                                   // WhatsApp / teléfono del estudio (sin el +)
    reduce: !!(mq && mq.matches),                          // preferencia de movimiento reducido
    debug: /[?&]debug\b/.test(location.search),            // ?debug muestra motivos de error en pantalla
    lang: lang,                                            // 'es' | 'en'
    L: function(es, en){ return lang() === 'en' ? en : es; },
    onLang: function(fn){ langCbs.push(fn); },
    el: function(tag, cls, text){                          // crea un elemento (texto siempre como textContent)
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null && text !== '') e.textContent = text;
      return e;
    },
    icon: function(id, cls){                               // <svg><use href="#id"/></svg>
      var s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
      s.setAttribute('class', cls);
      s.setAttribute('aria-hidden', 'true');
      u.setAttribute('href', '#' + id);
      s.appendChild(u);
      return s;
    },
    swipe: function(node, cb){                             // deslizar con el dedo: cb(+1) siguiente, cb(-1) anterior
      var x0 = null;
      node.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, {passive:true});
      node.addEventListener('touchend', function(e){
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 50) cb(dx < 0 ? 1 : -1);
      }, {passive:true});
    }
  };
})();


  // Año del pie de página
  document.getElementById('anio').textContent = new Date().getFullYear();

  // Botón volver arriba
  (function(){
    var btn = document.getElementById('btn-top');
    window.addEventListener('scroll', function(){
      btn.classList.toggle('visible', window.scrollY > 300);
    }, {passive:true});
    btn.addEventListener('click', function(){
      window.scrollTo({top:0, behavior:'smooth'});
    });
  })();

  // Animación de entrada al llegar a cada sección con el scroll
  (function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var reduce = AM.reduce;
    if (reduce || !('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    // Retraso escalonado entre elementos hermanos
    els.forEach(function(el){
      var sibs = Array.prototype.filter.call(el.parentNode.children, function(c){ return c.classList.contains('reveal'); });
      el.style.setProperty('--d', Math.min(sibs.indexOf(el) * 0.09, 0.45) + 's');
    });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold:0.12, rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(el){ io.observe(el); });
  })();

  // Reseñas de clientes: carrusel dinámico + formulario para añadir una reseña
  //  1) Pega la URL /exec del Apps Script de reseñas en ENDPOINT (o, mejor, en reserva-config.js:  resenasEndpoint: 'https://script.google.com/macros/s/…/exec')
  //  2) Solo se publican las reseñas con Estado = Aprobado en la hoja. Salen de la más nueva a la más antigua.
  //  3) BASE son las reseñas fijas del sitio: salen después de las de la hoja. Bórralas cuando ya tengas suficientes en la hoja.
  (function(){
    var CONFIG = { ENDPOINT: '' };   // URL del Apps Script de reseñas (termina en /exec)
    var BASE = [
      {nombre:'Claudia V',   servicio:'Manicura SPA', estrellas:5, foto:'', texto:'Me encantó todo, tu mamá muy dulce siempre y atenta a todo, en verdad es muy bonito cualquier tipo de cita en el estudio, Encantada con todo...'},
      {nombre:'Dayana O',   servicio:'Pedicura SPA',                 estrellas:5, foto:'', texto:'Un lugar donde hay que repetir, excelente servivio, muy lindo lo que transmiten, vale la pena cada minuto...'},
      {nombre:'Hanny F', servicio:'Extensiones de pestañas 3D',   estrellas:5, foto:'', texto:'Yo pase un rato muy feliz, se me paso el tiempo volando de lo bien que me sentí...'},
      {nombre:'Gabriela A',   servicio:'Diseño de cejas',              estrellas:5, foto:'', texto:'El laminado y el diseño quedaron justo como quería. Muy buena atención y el café de cortesía es un detalle genial.'},
      {nombre:'Cinthia V', servicio:'Paquete Luxury Full Service',  estrellas:5, foto:'', texto:'Una experiencia inolvidable el full service, gracias por consentirme, de verdad lo disfruté muchisimo...'}
    ];
    var track = document.getElementById('rv-track');
    if (!track) return;
    var controls = document.getElementById('rv-controls');
    var prev = document.getElementById('rv-prev');
    var next = document.getElementById('rv-next');
    var count = document.getElementById('rv-count');
    var viewport = track.parentNode;
    var PALETTE = [['#E88CA8','#C9A36A'],['#9C86D6','#E88CA8'],['#78B996','#C9A36A'],['#C9A36A','#9C86D6']];
    var RESENAS = [], slides = [], idx = 0, pv = 3;
    var reduce = AM.reduce;

    function $(id){ return document.getElementById(id); }
    var L = AM.L, el = AM.el, svgIcon = AM.icon;
    function initials(name){
      var parts = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim().split(/\s+/);
      var t = (parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
      return t.toUpperCase();
    }
    function avatar(r, i){
      var pal = PALETTE[i % PALETTE.length];
      function fallback(){
        var d = el('div', 'rv-avatar rv-initials', initials(r.nombre));
        d.style.setProperty('--a', pal[0]);
        d.style.setProperty('--b', pal[1]);
        d.setAttribute('aria-hidden', 'true');
        return d;
      }
      if (!r.foto) return fallback();
      var img = el('img', 'rv-avatar');
      img.src = r.foto;
      img.alt = 'Foto de perfil de ' + r.nombre;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function(){ if (img.parentNode) img.parentNode.replaceChild(fallback(), img); });
      return img;
    }
    function card(r, i){
      var slide = el('div', 'rv-slide');
      var c = el('article', 'rv-card');
      var head = el('div', 'rv-head');
      head.appendChild(avatar(r, i));
      var who = el('div');
      who.appendChild(el('h3', 'rv-name', r.nombre));
      if (r.servicio){
        var sv = el('p', 'rv-service');
        sv.appendChild(svgIcon('i-sparkle', 'icon'));
        sv.appendChild(document.createTextNode(r.servicio));
        who.appendChild(sv);
      }
      head.appendChild(who);
      var stars = el('div', 'rv-stars');
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', r.estrellas + ' de 5 estrellas');
      for (var k = 1; k <= 5; k++) stars.appendChild(svgIcon('i-star', 'star' + (k <= r.estrellas ? '' : ' off')));
      c.appendChild(head);
      c.appendChild(stars);
      c.appendChild(el('p', 'rv-text', r.texto));
      slide.appendChild(c);
      return slide;
    }

    function perView(){
      var w = window.innerWidth;
      return w >= 960 ? 3 : (w >= 640 ? 2 : 1);
    }
    function layout(){
      if (!slides.length) return;
      pv = perView();
      var maxIdx = Math.max(0, RESENAS.length - pv);
      if (idx > maxIdx) idx = maxIdx;
      track.style.setProperty('--pv', pv);
      track.style.transform = 'translateX(' + (-idx * 100 / pv) + '%)';
      slides.forEach(function(s, i){ s.setAttribute('aria-hidden', String(!(i >= idx && i < idx + pv))); });
      var tres = pv === 3 && RESENAS.length >= 3;                       // PC: la card central más grande, las de las esquinas más pequeñas
      slides.forEach(function(s, i){
        s.classList.toggle('is-left', tres && i === idx);
        s.classList.toggle('is-mid', tres && i === idx + 1);
        s.classList.toggle('is-right', tres && i === idx + 2);
      });
      controls.hidden = RESENAS.length <= pv;
      prev.disabled = idx <= 0;
      next.disabled = idx >= maxIdx;
      var last = Math.min(idx + pv, RESENAS.length);
      count.textContent = (pv === 1 || last === idx + 1) ? ((idx + 1) + ' de ' + RESENAS.length) : ((idx + 1) + '–' + last + ' de ' + RESENAS.length);
    }
    function go(n){ idx = n; layout(); }
    function render(list){
      RESENAS = list; slides = []; idx = 0;
      track.textContent = '';
      track.style.transform = '';
      if (!list.length){
        track.appendChild(el('p', 'rv-text', 'Pronto compartiremos las primeras reseñas de nuestros clientes.'));
        controls.hidden = true;
        return;
      }
      list.forEach(function(r, i){
        var s = card(r, i);
        slides.push(s);
        track.appendChild(s);
      });
      layout();
    }
    prev.addEventListener('click', function(){ go(Math.max(0, idx - 1)); });
    next.addEventListener('click', function(){ go(idx + 1); });
    window.addEventListener('resize', layout);

    AM.swipe(viewport, function(dir){ go(Math.max(0, idx + dir)); });   // deslizar con el dedo

    function loadingEl(){
      var d = el('div', 'rv-loading');
      d.setAttribute('role', 'status');
      var sp = el('span', 'rv-spin'); sp.setAttribute('aria-hidden', 'true');
      d.appendChild(sp);
      d.appendChild(el('span', '', 'Cargando reseñas…'));
      return d;
    }

    /* ---------- Reseñas aprobadas (hoja de Google) ---------- */
    function okPhoto(u){ return typeof u === 'string' && /^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com)\//.test(u); }
    function clean(r){
      if (!r || typeof r !== 'object') return null;
      var n = String(r.nombre || '').trim().slice(0, 70), t = String(r.texto || '').trim().slice(0, 700);
      var e = Math.round(+r.estrellas);
      if (!n || !t || !(e >= 1 && e <= 5)) return null;
      return {nombre:n, servicio:String(r.servicio || '').trim().slice(0, 80), estrellas:e, foto:okPhoto(r.foto) ? r.foto : '', texto:t, fecha:Date.parse(r.fecha) || 0};
    }
    function load(ep){
      var done = false, ctl = window.AbortController ? new AbortController() : null;
      function fin(list){
        if (done) return; done = true; clearTimeout(to);
        render((list || []).concat(BASE));
      }
      var to = setTimeout(function(){ if (ctl) ctl.abort(); fin(null); }, 9000);
      track.textContent = '';
      track.appendChild(loadingEl());
      controls.hidden = true;
      fetch(ep + (ep.indexOf('?') < 0 ? '?' : '&') + 'accion=resenas&t=' + Date.now(), ctl ? {signal: ctl.signal} : {})
        .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function(txt){
          var j;
          try { j = JSON.parse(txt); }
          catch (e) { throw new Error(/^\s*</.test(txt) ? 'el Apps Script devolvió una página web (revisa que el acceso sea "Cualquier persona")' : 'la respuesta no es JSON'); }
          if (!j || !Array.isArray(j.resenas)) throw new Error('respuesta inesperada del Apps Script');
          fin(j.resenas.map(clean).filter(Boolean).sort(function(x, y){ return y.fecha - x.fecha; }));   // más nuevas primero
        })
        .catch(function(e){
          if (window.console) console.warn('Reseñas: no se pudieron cargar →', (e && e.message) || e);
          fin(null);
        });
    }

    /* ---------- Formulario "Añadir reseña" ---------- */
    function setupForm(ep, debug){
      var addWrap = $('rv-add'), btn = $('rv-add-btn'), wrap = $('rv-form-wrap'), form = $('rv-form'), done = $('rvf-done');
      if (!addWrap || !btn || !wrap || !form) return;
      if (!ep && !debug){ addWrap.hidden = true; return; }       // sin URL del Apps Script no se muestra el botón
      var fNombre = $('rvf-nombre'), fApe = $('rvf-ape'), fServ = $('rvf-serv'), fTexto = $('rvf-texto'), fOk = $('rvf-ok'), fWeb = $('rvf-web');
      var submit = $('rvf-submit'), cancel = $('rvf-cancel'), pick = $('rvf-pick'), cnt = $('rvf-count');
      var prevBox = $('rvf-prev'), file = $('rvf-file'), clearBtn = $('rvf-clear'), defaultPrev = prevBox.innerHTML;
      var photoData = '', busy = false, progT = null, progV = 0, doneT = null;
      var LABELS = {es:['', 'Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'], en:['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']};

      function starVal(){ var c = form.querySelector('input[name="rv-estrellas"]:checked'); return c ? +c.value : 0; }
      function applyLang(){
        fTexto.placeholder = L('Cuéntanos qué te pareció el servicio, el lugar, las instalaciones y la atención…', 'Tell us about the service, the place, the facilities and the attention…');
        pick.textContent = LABELS[L('es', 'en')][starVal()] || '';
      }
      AM.onLang(applyLang);
      applyLang();

      function setErr(id, msg, f){
        var p = $(id); if (p) p.textContent = msg || '';
        if (f){ if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }
      }
      function setStatus(msg, bad){ var p = $('rvf-status'); p.className = 'bk-status' + (bad ? ' bad' : ''); p.textContent = msg || ''; }

      /* progreso del envío */
      function pStart(msg){
        clearInterval(progT);
        var p = $('rvf-prog'), bar = $('rvf-prog-bar');
        setStatus('');
        progV = 6; p.hidden = false; p.classList.remove('is-done');
        $('rvf-prog-txt').textContent = msg; bar.style.width = progV + '%'; p.setAttribute('aria-valuenow', progV);
        progT = setInterval(function(){
          progV += (92 - progV) * 0.07;
          bar.style.width = progV.toFixed(1) + '%'; p.setAttribute('aria-valuenow', Math.round(progV));
        }, 250);
      }
      function pDone(msg){
        clearInterval(progT);
        var p = $('rvf-prog'); $('rvf-prog-txt').textContent = msg;
        p.classList.add('is-done'); $('rvf-prog-bar').style.width = '100%'; p.setAttribute('aria-valuenow', 100);
      }
      function pOff(){
        clearInterval(progT);
        var p = $('rvf-prog'); p.hidden = true; p.classList.remove('is-done'); $('rvf-prog-bar').style.width = '0';
      }

      /* abrir / cerrar */
      function open(v){
        var vis = false;                                              // ¿se está viendo el formulario / mensaje ahora mismo?
        if (!v && !wrap.hidden){ try { var r = wrap.getBoundingClientRect(); vis = r.bottom > 0 && r.top < window.innerHeight; } catch (e) {} }
        wrap.hidden = !v;
        btn.setAttribute('aria-expanded', String(v));
        if (!v){
          clearTimeout(doneT); done.hidden = true; form.hidden = false;
          if (vis){ try { btn.scrollIntoView({block:'center'}); } catch (e) {} }   // al cerrar, volver a la invitación de reseñas
          return;
        }
        try { wrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'}); } catch (e) {}
        if (!form.hidden) setTimeout(function(){ try { fNombre.focus({preventScroll:true}); } catch (e) {} }, 350);
      }
      btn.addEventListener('click', function(){ open(wrap.hidden); });
      cancel.addEventListener('click', function(){ open(false); btn.focus({preventScroll:true}); });
      $('rvf-close').addEventListener('click', function(){ open(false); btn.focus({preventScroll:true}); });

      /* foto de perfil: se recorta en cuadrado y se reduce a 256 px antes de enviarla */
      function showPrev(url){
        prevBox.textContent = '';
        if (url){ var im = el('img'); im.src = url; im.alt = ''; prevBox.appendChild(im); }
        else prevBox.innerHTML = defaultPrev;
        clearBtn.hidden = !url;
      }
      $('rvf-pick-photo').addEventListener('click', function(){ file.click(); });
      clearBtn.addEventListener('click', function(){ photoData = ''; file.value = ''; showPrev(''); setErr('err-foto', ''); });
      file.addEventListener('change', function(){
        var f = file.files && file.files[0];
        if (!f) return;
        setErr('err-foto', '');
        if (!/^image\//.test(f.type)){ setErr('err-foto', L('Elige un archivo de imagen (JPG o PNG).', 'Choose an image file (JPG or PNG).')); file.value = ''; return; }
        if (f.size > 12 * 1024 * 1024){ setErr('err-foto', L('La foto es muy grande (máximo 12 MB).', 'The photo is too large (12 MB max).')); file.value = ''; return; }
        var url = URL.createObjectURL(f), img = new Image();
        img.onload = function(){
          var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
          var ctx = c.getContext('2d'), m = Math.min(img.naturalWidth, img.naturalHeight);
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
          ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S);
          try { photoData = c.toDataURL('image/jpeg', 0.82); } catch (e) { photoData = ''; }
          URL.revokeObjectURL(url);
          showPrev(photoData);
        };
        img.onerror = function(){
          URL.revokeObjectURL(url); file.value = '';
          setErr('err-foto', L('No pudimos leer esa imagen. Prueba con otra.', 'We couldn\'t read that image. Try another one.'));
        };
        img.src = url;
      });

      /* contador y limpieza de errores al escribir */
      fTexto.addEventListener('input', function(){ cnt.textContent = fTexto.value.length + '/350'; });
      function clearField(e){ var t = e.target, id = t && t.getAttribute && t.getAttribute('data-err'); if (id) setErr(id, '', t.type === 'radio' ? null : t); }
      form.addEventListener('input', clearField);
      form.addEventListener('change', function(e){
        clearField(e);
        if (e.target.name === 'rv-estrellas') pick.textContent = LABELS[L('es', 'en')][starVal()] || '';
      });

      function validate(){
        var first = null;
        function bad(id, msg, f){ setErr(id, msg, f); if (!first) first = f; }
        var n = fNombre.value.trim(), a = fApe.value.trim(), t = fTexto.value.trim();
        if (n.length < 2) bad('err-nombre', L('Escribe tu nombre.', 'Enter your first name.'), fNombre);
        if (a.length < 2) bad('err-ape', L('Escribe tus apellidos.', 'Enter your last name.'), fApe);
        if (!fServ.value) bad('err-serv', L('Elige el servicio.', 'Choose the service.'), fServ);
        if (!starVal()) bad('err-est', L('Elige de 1 a 5 estrellas.', 'Choose from 1 to 5 stars.'), $('rvs-5'));
        if (t.length < 20) bad('err-texto', L('Cuéntanos un poco más (mínimo 20 caracteres).', 'Tell us a little more (at least 20 characters).'), fTexto);
        if (!fOk.checked) bad('err-ok', L('Necesitamos tu permiso para publicarla.', 'We need your permission to publish it.'), fOk);
        if (first){ try { first.focus(); } catch (e) {} }
        return !first;
      }
      function finish(){
        pOff(); busy = false; submit.disabled = false; cancel.disabled = false;
        form.reset(); photoData = ''; showPrev(''); cnt.textContent = '0/350'; pick.textContent = ''; setStatus('');
        form.hidden = true; done.hidden = false;                       // el mensaje de gracias se quita solo a los 5 segundos
        done.classList.remove('is-run'); void done.offsetWidth; done.classList.add('is-run');
        try { wrap.scrollIntoView({block:'center'}); } catch (e) {}    // el formulario era alto: al ocultarse, centrar el mensaje de gracias
        clearTimeout(doneT); doneT = setTimeout(function(){ open(false); }, 5000);
      }
      form.addEventListener('submit', function(e){
        e.preventDefault();
        if (busy || !validate()) return;
        if (fWeb.value){ finish(); return; }                         // trampa para robots
        if (!ep){ setStatus(L('Falta configurar la URL del Apps Script de reseñas.', 'The reviews Apps Script URL is not configured yet.'), true); return; }
        busy = true; submit.disabled = true; cancel.disabled = true;
        var payload = {tipo:'resena', idioma:L('es', 'en'), nombre:fNombre.value.trim(), apellidos:fApe.value.trim(), servicio:fServ.value,
                       estrellas:starVal(), texto:fTexto.value.trim(), foto:photoData || ''};
        pStart(photoData ? L('Subiendo tu foto y enviando tu reseña…', 'Uploading your photo and sending your review…') : L('Enviando tu reseña…', 'Sending your review…'));
        var ctl = window.AbortController ? new AbortController() : null;
        var to = setTimeout(function(){ if (ctl) ctl.abort(); }, 30000);
        fetch(ep, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), signal: ctl ? ctl.signal : undefined})
          .then(function(r){ if (!r.ok) throw new Error('http'); return r.json(); })
          .then(function(j){
            clearTimeout(to);
            if (!j || !j.ok) throw new Error((j && j.error) || 'error');
            pDone(L('¡Reseña enviada!', 'Review sent!'));
            setTimeout(finish, 800);
          })
          .catch(function(){
            clearTimeout(to);
            pOff(); busy = false; submit.disabled = false; cancel.disabled = false;
            setStatus(L('No pudimos enviar tu reseña. Inténtalo de nuevo en unos minutos.', 'We couldn\'t send your review. Please try again in a few minutes.'), true);
          });
      });
    }

    function init(){
      var ep = String((window.AM_RESERVA && window.AM_RESERVA.resenasEndpoint) || CONFIG.ENDPOINT || '').trim();
      var debug = AM.debug;
      if (ep) load(ep); else render(BASE);
      setupForm(ep, debug);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  })();

  // Estado del horario: "Abierto ahora" (hora de Cuba)
  (function(){
    var H = {dias:[1,2,3,4,5], abre:8, cierra:18, zona:'America/Havana'};   // lunes a viernes, 8:00 a 18:00
    var NOMBRES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    var els = document.querySelectorAll('[data-open-status]');
    if (!els.length || !window.Intl) return;
    function ahora(){
      var p = new Intl.DateTimeFormat('en-US',{timeZone:H.zona,weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date());
      var o = {}; p.forEach(function(x){ o[x.type] = x.value; });
      var d = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday];
      return {dia:d, min:(parseInt(o.hour,10)%24)*60 + parseInt(o.minute,10)};
    }
    function hora12(h){ return (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM'); }
    function estado(){
      var n = ahora(), laboral = H.dias.indexOf(n.dia) > -1;
      if (laboral && n.min >= H.abre*60 && n.min < H.cierra*60){
        var resta = H.cierra*60 - n.min;
        return resta <= 60
          ? {c:'is-soon', t:'Cerramos pronto · hoy hasta las ' + hora12(H.cierra)}
          : {c:'is-open', t:'Abierto ahora · hasta las ' + hora12(H.cierra)};
      }
      if (laboral && n.min < H.abre*60) return {c:'is-closed', t:'Cerrado ahora · abrimos hoy a las ' + hora12(H.abre)};
      for (var i = 1; i <= 7; i++){
        var d = (n.dia + i) % 7;
        if (H.dias.indexOf(d) > -1){
          return {c:'is-closed', t:'Cerrado ahora · abrimos ' + (i === 1 ? 'mañana' : 'el ' + NOMBRES[d]) + ' a las ' + hora12(H.abre)};
        }
      }
      return null;
    }
    function pintar(){
      var e = estado(); if (!e) return;
      Array.prototype.forEach.call(els, function(el){
        el.classList.remove('is-open','is-soon','is-closed'); el.classList.add(e.c);
        el.querySelector('.txt').textContent = e.t;
      });
    }
    pintar();
    setInterval(pintar, 60000);
  })();

  // Barra de reserva móvil: aparece al bajar y se oculta en la zona de contacto
  (function(){
    var bar = document.getElementById('book-bar');
    if (!bar) return;
    var hideZone = false;
    function update(){
      var on = window.scrollY > 520 && !hideZone;
      bar.classList.toggle('visible', on);
      document.body.classList.toggle('bar-on', on);
    }
    if ('IntersectionObserver' in window){
      var seen = {};
      var io = new IntersectionObserver(function(es){
        es.forEach(function(e){ seen[e.target.id || e.target.tagName] = e.isIntersecting; });
        hideZone = Object.keys(seen).some(function(k){ return seen[k]; });
        update();
      });
      var z = document.getElementById('reserva'); if (z) io.observe(z);
      var f = document.querySelector('footer'); if (f) io.observe(f);
    }
    window.addEventListener('scroll', update, {passive:true});
    update();
    // Cada 10 s (solo si la barra está visible y la pestaña activa) brilla "Reservar cita" y el teléfono "suena"
    if (!AM.reduce){
      setInterval(function(){
        if (document.hidden || !bar.classList.contains('visible')) return;
        bar.classList.add('attn');
        setTimeout(function(){ bar.classList.remove('attn'); }, 1800);
      }, 10000);
    }
  })();

  // Menú móvil
  (function(){
    var btn = document.querySelector('.nav-toggle'), nav = document.getElementById('nav');
    if (!btn || !nav) return;
    function set(open){
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }
    btn.addEventListener('click', function(e){ e.stopPropagation(); set(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function(e){ if (e.target.closest('a')) set(false); });
    document.addEventListener('click', function(e){ if (!nav.contains(e.target)) set(false); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') set(false); });
    window.matchMedia('(min-width:1041px)').addEventListener('change', function(){ set(false); });
  })();

  // Evaluaciones: lee el JSON al cargar y envía cada voto nuevo
  (function(){
    var CONFIG = {
      JSON_URL: 'evaluaciones.json',  // solo se usa si ENDPOINT está vacío (si el archivo no existe, 0 evaluaciones)
      ENDPOINT: 'https://script.google.com/macros/s/AKfycbyJNoPmmT6luqR0TkggzDmdA9nBhYqvC_Uc6GADgjfWz6ya2yi0OKH3iuM7j-bTble0/exec'   // pega aquí la URL de Google Apps Script (termina en /exec)
    };
    var SOURCE = CONFIG.ENDPOINT || CONFIG.JSON_URL;
    var KEY = 'am_eval_voto_v2';   // clave nueva: ignora los amlux locales guardados con el sistema anterior
    try {
      localStorage.removeItem('am_eval_voto');
      // Para pruebas: añade ?reseteval a la URL y podrás votar otra vez
      if (/[?&]reseteval\b/.test(location.search)) localStorage.removeItem(KEY);
    } catch (e) {}
    var form = document.getElementById('eval-form');
    if (!form) return;
    var radios = form.querySelectorAll('input[name="estrellas"]');
    var btn  = form.querySelector('button[type="submit"]');
    var pick = document.getElementById('eval-pick');
    var msg  = document.getElementById('eval-msg');
    var numEl = document.getElementById('score-num');
    var totEl = document.getElementById('score-total');
    var starsEl = document.getElementById('score-stars');
    var fg = document.getElementById('score-fg');
    var bars = document.querySelectorAll('#eval-bars li');
    var LABELS = ['', 'Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];
    var votes = [0, 0, 0, 0, 0];

    function rawVotes(d){
      if (!d || typeof d !== 'object') return null;
      var src = d.amlux || d.votes || d.votos || (d.data && (d.data.amlux || d.data.votes || d.data.votos)) || null;
      if (!src && Array.isArray(d) && d.length === 5) src = d;                       // [1★, 2★, 3★, 4★, 5★]
      if (!src && (d['1'] !== undefined || d['5'] !== undefined)) src = d;           // {"1":0,"2":0,...}
      return (src && typeof src === 'object') ? src : null;
    }
    function norm(d){
      var v = [0, 0, 0, 0, 0], src = rawVotes(d);
      if (src){
        for (var i = 0; i < 5; i++){
          var x = Array.isArray(src) ? src[i] : (src[i + 1] !== undefined ? src[i + 1] : src[String(i + 1)]);
          v[i] = Math.max(0, parseInt(x, 10) || 0);
        }
      }
      return v;
    }
    function localVote(){
      try { var n = parseInt(localStorage.getItem(KEY), 10); return (n >= 1 && n <= 5) ? n : 0; }
      catch (e) { return 0; }
    }
    function render(v){
      var total = 0, sum = 0;
      for (var i = 0; i < 5; i++){ total += v[i]; sum += v[i] * (i + 1); }
      var avg = total ? sum / total : 0;
      numEl.textContent = avg.toFixed(1).replace('.', ',');
      fg.style.setProperty('--pct', (avg / 5 * 100) + '%');
      starsEl.setAttribute('aria-label', 'Valoración media: ' + avg.toFixed(1).replace('.', ',') + ' de 5');
      totEl.textContent = total ? (total + (total === 1 ? ' evaluación' : ' evaluaciones')) : 'Aún no hay evaluaciones';
      Array.prototype.forEach.call(bars, function(li){
        var n = parseInt(li.getAttribute('data-star'), 10);
        var c = v[n - 1];
        li.querySelector('.cnt').textContent = c;
      });
    }
    function lock(n){
      Array.prototype.forEach.call(radios, function(r){ r.checked = (parseInt(r.value, 10) === n); r.disabled = true; });
      btn.hidden = true;
      pick.textContent = LABELS[n];
      msg.textContent = '¡Gracias por evaluarnos! Tu evaluación: ' + n + ' de 5 estrellas.';
    }

    Array.prototype.forEach.call(radios, function(r){
      r.addEventListener('change', function(){
        pick.textContent = LABELS[parseInt(r.value, 10)];
        btn.disabled = false;
        msg.textContent = '';
      });
    });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var sel = form.querySelector('input[name="estrellas"]:checked');
      if (!sel){ msg.textContent = 'Elige de 1 a 5 estrellas.'; return; }
      var n = parseInt(sel.value, 10);
      btn.disabled = true;
      msg.textContent = 'Enviando…';
      function done(){
        try { localStorage.setItem(KEY, String(n)); } catch (err) {}
        lock(n);
      }
      if (CONFIG.ENDPOINT){
        fetch(CONFIG.ENDPOINT, {
          method: 'POST',
          headers: {'Content-Type': 'text/plain;charset=utf-8'},  // evita la petición previa (CORS) que Apps Script no admite
          body: JSON.stringify({estrellas: n})
        })
        .then(function(r){ if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function(d){
          if (d && d.error) throw new Error(d.error);
          if (rawVotes(d)){ votes = norm(d); render(votes); done(); return; }
          // La respuesta del envío no trae el recuento: se vuelve a pedir al servidor
          return fetch(SOURCE + (SOURCE.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), {cache: 'no-store'})
            .then(function(r){ return r.json(); })
            .then(function(d2){
              if (rawVotes(d2)){ votes = norm(d2); } else { votes[n - 1]++; }
              render(votes); done();
            });
        })
        .catch(function(err){
          btn.disabled = false;
          msg.textContent = 'No se pudo guardar tu evaluación. Inténtalo de nuevo en unos minutos.' + (AM.debug ? ' [' + (err && err.message || err) + ']' : '');
        });
      } else {
        // Sin servidor configurado: el voto se muestra y se recuerda solo en este dispositivo
        votes[n - 1]++;
        render(votes);
        done();
      }
    });

    function start(d, why){
      var ok = !!rawVotes(d);
      votes = norm(d);
      var lv = localVote();
      if (lv && !CONFIG.ENDPOINT) votes[lv - 1]++;
      render(votes);
      if (CONFIG.ENDPOINT && !ok) totEl.textContent = 'No se pudieron cargar las evaluaciones' + (AM.debug && why ? ' [' + why + ']' : '');
      if (lv) lock(lv);
    }
    /* Carga de las evaluaciones: 1) Apps Script  2) evaluaciones.json.  Cada fallo se guarda con su motivo (consola y ?debug) */
    var why = [];
    function note(e){ why.push((e && e.message) || String(e)); }
    function getJson(url, opts, label){
      return fetch(url, opts)
        .then(function(r){
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function(txt){
          try { return JSON.parse(txt); }
          catch (e) { throw new Error(/^\s*</.test(txt) ? 'devolvió una página web en vez de datos (el Apps Script debe estar publicado con acceso "Cualquier persona")' : 'la respuesta no es JSON'); }
        })
        .catch(function(e){
          var m = (e && e.name === 'TypeError') ? 'no se pudo conectar (sin internet, bloqueo CORS o página abierta como archivo local)' : ((e && e.message) || e);
          throw new Error(label + ': ' + m);
        });
    }
    function fromServer(){
      var u = CONFIG.ENDPOINT + (CONFIG.ENDPOINT.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
      return getJson(u, {cache: 'no-store'}, 'Apps Script')
        .catch(function(){ return getJson(u, {}, 'Apps Script'); })
        .then(function(d){
          if (!rawVotes(d)) throw new Error('Apps Script: respuesta inesperada ' + JSON.stringify(d).slice(0, 90));
          return d;
        });
    }
    function fromFile(){
      return getJson(CONFIG.JSON_URL + '?t=' + Date.now(), {cache: 'no-store'}, 'evaluaciones.json')
        .then(function(d){
          if (!rawVotes(d)) throw new Error('evaluaciones.json: no tiene el formato esperado');
          return d;
        });
    }
    if (window.fetch){
      if (location.protocol === 'file:') why.push('la página está abierta como archivo local (file://); pruébala desde el sitio publicado');
      (CONFIG.ENDPOINT ? fromServer().catch(function(e){ note(e); return fromFile(); }) : fromFile())
        .then(function(d){
          if (why.length && window.console) console.warn('Evaluaciones: se usó evaluaciones.json →', why.join(' | '));
          start(d, '');
        }, function(e){
          note(e);
          if (window.console) console.warn('Evaluaciones: no se pudieron cargar →', why.join(' | '));
          start(null, why.join(' | '));
        });
    } else {
      start(null, 'este navegador no admite fetch');
    }
  })();

  // Carrusel de bienvenida
  // Rota SOLO cada 5 s. Lo único que detiene la rotación es el botón Pausa del propio carrusel;
  // el ratón, el foco, los clics, el cambio de pestaña o de sección ya no la afectan.
  (function(){
    var root = document.querySelector('[data-carousel]');
    if (!root) return;
    var track  = root.querySelector('.slides');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var dots   = Array.prototype.slice.call(root.querySelectorAll('.dot'));
    var prev   = root.querySelector('.prev');
    var next   = root.querySelector('.next');
    var toggle = root.querySelector('.toggle');
    var DELAY  = 5000;                 // milisegundos entre diapositivas
    var index = 0, timer = null, userPaused = false;

    function show(n){
      index = (n + slides.length) % slides.length;
      slides.forEach(function(s, k){
        var on = k === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      });
      dots.forEach(function(d, k){ d.setAttribute('aria-current', String(k === index)); });
    }
    // Un único temporizador encadenado: cada paso programa el siguiente (aunque algo falle)
    function schedule(){
      clearTimeout(timer);
      timer = null;
      if (userPaused) return;
      timer = setTimeout(function(){
        try { show(index + 1); } finally { schedule(); }
      }, DELAY);
    }
    function syncToggle(){
      toggle.classList.toggle('is-paused', userPaused);
      toggle.setAttribute('aria-label', userPaused ? 'Reanudar carrusel' : 'Pausar carrusel');
      track.setAttribute('aria-live', userPaused ? 'polite' : 'off');
    }
    function go(n){ show(n); schedule(); }          // navegación manual: la cuenta de 5 s vuelve a empezar

    prev.addEventListener('click', function(){ go(index - 1); });
    next.addEventListener('click', function(){ go(index + 1); });
    dots.forEach(function(d, k){ d.addEventListener('click', function(){ go(k); }); });
    toggle.addEventListener('click', function(){ userPaused = !userPaused; syncToggle(); schedule(); });

    root.addEventListener('keydown', function(e){
      if (e.key === 'ArrowLeft'){ go(index - 1); }
      else if (e.key === 'ArrowRight'){ go(index + 1); }
    });
    AM.swipe(track, function(dir){ go(index + dir); });

    // Al volver a la pestaña (o a la página desde el historial) la cuenta de 5 s se reinicia; nunca se detiene
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) schedule(); });
    window.addEventListener('pageshow', schedule);

    syncToggle();
    schedule();
  })();

  // ===== Galería de trabajos =====
  // Edita la lista FOTOS para cambiar fotos, títulos y descripciones (4 por servicio).
  //  servicio : manicura | manicura-spa | pedicura | pedicura-spa | pestanas | cejas
  //  foto     : ruta de la imagen (ej. 'img/galeria/mani-01.jpg')
  //  titulo / texto : en español; titulo_en / texto_en : en inglés (opcional)
  //  pos      : punto de enfoque del recorte (ej. '50% 30%'); zoom: acercamiento (ej. 1.3)
  // Todas las miniaturas tienen el mismo tamaño; la foto completa se ve al abrirla.
  // En la pestaña "Todos" se muestran 8 fotos en PC (6 en móvil), 2 de cada grupo
  // (manicura, pedicura, cejas y pestañas), y un botón carga 4 más cada vez.
  (function(){
    var SERVICIOS = {
      'manicura':     {es:'Manicura',      en:'Manicure',       wa:{es:'Manicura',                en:'Manicure'},                ico:'img/ico-mani.webp',      ov:'232,140,168', tone:'#F5CDD6'},
      'manicura-spa': {es:'Manicura SPA',  en:'SPA Manicure',   wa:{es:'Manicura SPA',    en:'SPA Manicure'},    ico:'img/ico-mani-spa.webp',  ov:'232,140,168', tone:'#F5CDD6'},
      'pedicura':     {es:'Pedicura',      en:'Pedicure',       wa:{es:'Pedicura',                en:'Pedicure'},                ico:'img/ico-pedi.webp',      ov:'120,185,150', tone:'#C9E4D6'},
      'pedicura-spa': {es:'Pedicura SPA',  en:'SPA Pedicure',   wa:{es:'Pedicura SPA',            en:'SPA Pedicure'},            ico:'img/ico-pedi-spa.webp',  ov:'120,185,150', tone:'#C9E4D6'},
      'pestanas':     {es:'Pestañas',      en:'Lashes',         wa:{es:'Extensiones de pestañas', en:'Eyelash Extensions'},      ico:'img/ico-pestanas.webp',  ov:'165,140,215', tone:'#D8CCEF'},
      'cejas':        {es:'Cejas',         en:'Brows',          wa:{es:'Diseño de cejas',         en:'Brow Design'},             ico:'img/ico-cejas.webp',     ov:'165,140,215', tone:'#D8CCEF'}
    };
    var GRUPOS = [['manicura','manicura-spa'], ['pedicura','pedicura-spa'], ['cejas'], ['pestanas']];
    var STEP = 4;

 // Fotos de ejemplo: cámbialas por tus fotos reales
    var FOTOS = [
      {servicio:"manicura", foto:"img/galeria/m1.jpg", pos:"50% 50%", zoom:1,
       titulo:"Manicura con Builder Gel", titulo_en:"Builder Gel manicure",
       texto:"Reforzamiento y acabado impecable, con decoración delicada.", texto_en:"Reinforcement and a flawless finish, with delicate nail art."},
      {servicio:"manicura", foto:"img/galeria/m2.png", pos:"85% 70%", zoom:1,
       titulo:"Softgel", titulo_en:"Softgel",
       texto:"Resistencia y brillo duradero en un solo servicio.", texto_en:"Strength and lasting shine in a single service."},
      {servicio:"manicura", foto:"img/galeria/m3.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Dual System", titulo_en:"Dual System",
       texto:"Limpieza, molde perfecto y esmaltado profundo.", texto_en:"Cleaning, a perfect shape and a rich polish finish."},
      {servicio:"manicura", foto:"img/galeria/m4.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Reforzamiento con Builder Gel", titulo_en:"Builder Gel manicure",
       texto:"Uñas con aspecto natural y acabado suave.", texto_en:"Natural-looking nails with a soft finish."},
      {servicio:"manicura-spa", foto:"img/galeria/spam1.jpg", pos:"50% 50%", zoom:1,
       titulo:"Manicura SPA", titulo_en:"SPA manicure",
       texto:"Un entorno preparado para mimar tus manos.", texto_en:"An environment designed to pamper your hands."},
      {servicio:"manicura-spa", foto:"img/galeria/spam2.png", pos:"85% 70%", zoom:1.5,
       titulo:"Baño de manos", titulo_en:"Hand soak",
       texto:"Baño con sales y perlas, mascarilla y masaje relajante.", texto_en:"Bath with salts and pearls, mask and relaxing massage."},
      {servicio:"manicura-spa", foto:"img/galeria/spam3.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Parafina.", titulo_en:"Paraffin.",
       texto:"Parafina para hidratación intensiva de la piel.", texto_en:"Paraffin for intensive skin hydration."},
      {servicio:"manicura-spa", foto:"img/galeria/spam4.png", pos:"60% 20%", zoom:1.4,
       titulo:"Masaje relajante", titulo_en:"Relaxing massage",
       texto:"Un momento de calma para tus manos.", texto_en:"A moment of calm for your hands."},
      {servicio:"pedicura", foto:"img/galeria/p1.png", pos:"50% 50%", zoom:1,
       titulo:"Pedicura clásica", titulo_en:"Classic pedicure",
       texto:"Limpieza profunda de cutículas y molde perfecto de uñas.", texto_en:"Deep cuticle care and a perfectly shaped nail."},
      {servicio:"pedicura", foto:"img/galeria/p2.jpg", pos:"85% 70%", zoom:1.5,
       titulo:"Poly Gel + Base Ruber", titulo_en:"Poly Gel + Base Ruber",
       texto:"Esmaltado Profundo.", texto_en:"Deep Glazed"},
      {servicio:"pedicura", foto:"img/galeria/p3.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Poly Gel + Base Ruber", titulo_en:"Poly Gel + Base Ruber",
       texto:"Cuidado profesional para que tus pies se vean increibles.", texto_en:"Professional care to make your feet look incredible"},
      {servicio:"pedicura", foto:"img/galeria/p4.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Poly Gel + Base Ruber", titulo_en:"Poly Gel + Base Ruber",
       texto:"Brillo, cuidado y perfección.", texto_en:"Shine, care, and perfection."},
      {servicio:"pedicura-spa", foto:"img/galeria/spap1.jpg", pos:"50% 50%", zoom:1,
       titulo:"Pedicura SPA", titulo_en:"SPA pedicure",
       texto:"Una experiencia de lujo para renovar y consentir tus pies.", texto_en:"A luxury experience to rejuvenate and pamper your feet."},
      {servicio:"pedicura-spa", foto:"img/galeria/spap2.jpg", pos:"85% 70%", zoom:1.5,
       titulo:"Sales minerales y perlas regeneradoras.", titulo_en:"Mineral salts and regenerating pearls.",
       texto:"Relajación y suavidad en la piel.", texto_en:"Relaxation and softness for the skin."},
      {servicio:"pedicura-spa", foto:"img/galeria/spap3.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Baño de pies", titulo_en:"Foot bath ",
       texto:"Bañera de hidromasaje plegable.", texto_en:"Collapsible whirlpool tub."},
      {servicio:"pedicura-spa", foto:"img/galeria/spap4.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Masaje de pies", titulo_en:"Foot massage",
       texto:" Masaje relajante para hidratación de la piel y cutícula .", texto_en:"Relaxing massage for skin and cuticle hydration."},
      {servicio:"pestanas", foto:"img/galeria/pes1.jpg", pos:"50% 50%", zoom:1,
       titulo:"Pestañas 4D", titulo_en:"4D lashes",
       texto:"Volumen suave y ligero para una mirada definida.", texto_en:"Soft, light volume for a defined look."},
      {servicio:"pestanas", foto:"img/galeria/pes2.jpg", pos:"85% 70%", zoom:1.5,
       titulo:"Pestañas 3D", titulo_en:"3D lashes",
       texto:"Efecto natural y ligero para el día a día.", texto_en:"A natural, lightweight effect for every day."},
      {servicio:"pestanas", foto:"img/galeria/pes3.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Pestañas 3D", titulo_en:"3D lashes",
       texto:"Mayor densidad para una mirada intensa.", texto_en:"More density for an intense look."},
      {servicio:"pestanas", foto:"img/galeria/pes4.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Pestañas 2D YY", titulo_en:"2D YY lashes",
       texto:"Volumen completo con un acabado ligero.", texto_en:"Full volume with a lightweight finish."},
      {servicio:"cejas", foto:"img/galeria/c1.png", pos:"50% 50%", zoom:1,
       titulo:"Henna + Depilación + Diseño", titulo_en:"Henna + Hair removal + Design",
       texto:"Cejas peinadas y definidas, con diseño a tu medida.", texto_en:"Brushed, defined brows designed for you."},
      {servicio:"cejas", foto:"img/galeria/c2.jpg", pos:"85% 70%", zoom:1.5,
       titulo:"Laminado + Tinte Premium", titulo_en:"Brow lifting + Tint",
       texto:"Laminado y tinte con parches hidratantes.", texto_en:"Brow lifting and tint with hydrating patches."},
      {servicio:"cejas", foto:"img/galeria/c5.jpg", pos:"15% 80%", zoom:1.6,
       titulo:"Laminado + tinte", titulo_en:"Brow lifting + Tint",
       texto:"Color y forma para unas cejas más definidas.", texto_en:"Colour and shape for more defined brows."},
      {servicio:"cejas", foto:"img/galeria/c4.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Henna + Depilación + Diseño", titulo_en:"Henna + Hair removal + Design",
       texto:"Cejas definidas con una forma a tu medida.", texto_en:"Defined brows with a shape made for you."},
      {servicio:"cejas", foto:"img/galeria/c3.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Henna + Depilación + Diseño", titulo_en:"Henna + Hair removal + Design",
       texto:"Cejas definidas con una forma a tu medida.", texto_en:"Defined brows with a shape made for you."},
      {servicio:"cejas", foto:"img/galeria/pes1.jpg", pos:"60% 20%", zoom:1.4,
       titulo:"Laminado", titulo_en:"Brow lifting",
       texto:"Cejas peinadas y definidas con una forma adaptada a ti.", texto_en:"Combed and defined eyebrows with a shape adapted to you."}
    ];

    var grid = document.getElementById('g-grid');
    var filters = document.getElementById('g-filters');
    var status = document.getElementById('g-status');
    var more = document.getElementById('g-more'), moreBtn = document.getElementById('g-more-btn'), count = document.getElementById('g-count');
    if (!grid || !filters) return;

    var reduce = AM.reduce;
    var mqWide = window.matchMedia('(min-width:760px)');
    var lang = AM.lang, el = AM.el;
    function icon(id){ return AM.icon(id, 'icon'); }
    function pick(f, k){ return (lang() === 'en' && f[k + '_en']) ? f[k + '_en'] : f[k]; }

    // ---------- Filtros
    var cur = 'todos', chips = [];
    function chip(key){
      var b = el('button', 'g-chip'); b.type = 'button'; b.setAttribute('data-key', key); b.setAttribute('aria-pressed', key === 'todos' ? 'true' : 'false');
      if (key === 'todos'){ b.appendChild(icon('i-sparkle')); }
      else { var im = el('img'); im.src = SERVICIOS[key].ico; im.alt = ''; im.width = 66; im.height = 68; im.loading = 'lazy'; b.appendChild(im); }
      b.appendChild(el('span'));
      b.addEventListener('click', function(){ setFilter(key); });
      filters.appendChild(b); chips.push(b);
    }
    chip('todos');
    for (var k in SERVICIOS){ if (Object.prototype.hasOwnProperty.call(SERVICIOS, k)) chip(k); }
    function paintChips(){
      chips.forEach(function(b){
        var key = b.getAttribute('data-key');
        b.lastChild.textContent = key === 'todos' ? (lang() === 'en' ? 'All' : 'Todos') : SERVICIOS[key][lang()];
      });
    }

    // ---------- Miniaturas
    var tiles = [], curList = [];
    FOTOS.forEach(function(f){
      var s = SERVICIOS[f.servicio];
      var b = el('button', 'g-tile'); b.type = 'button';
      b.style.setProperty('--ov', s.ov); b.style.setProperty('--tone', s.tone);
      if (f.pos) b.style.setProperty('--pos', f.pos);
      if (f.zoom) b.style.setProperty('--z', f.zoom);
      var img = el('img', 'g-img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = f.foto;
      img.addEventListener('error', function(){
        img.remove(); var ph = el('img', 'g-ph'); ph.src = s.ico; ph.alt = ''; b.insertBefore(ph, b.firstChild);
      });
      var cap = el('span', 'g-cap');
      var tag = el('span', 'g-tag'); var ti = el('img'); ti.src = s.ico; ti.alt = ''; ti.width = 66; ti.height = 68; var tt = el('span'); tag.appendChild(ti); tag.appendChild(tt);
      var title = el('span', 'g-title');
      var desc = el('span', 'g-desc'); var dt = el('span'); desc.appendChild(dt);
      cap.appendChild(tag); cap.appendChild(title); cap.appendChild(desc);
      var zoom = el('span', 'g-zoom'); zoom.appendChild(icon('i-plus')); zoom.setAttribute('aria-hidden', 'true');
      var veil = el('span', 'g-veil'); veil.setAttribute('aria-hidden', 'true');
      b.appendChild(img); b.appendChild(cap); b.appendChild(zoom); b.appendChild(veil);
      b._f = f; b._tt = tt; b._title = title; b._dt = dt;
      b.addEventListener('click', function(){ openLB(curList.indexOf(b), b); });
      // Con el teclado, la foto enfocada se revela aunque aún no haya entrado en pantalla
      b.addEventListener('focus', function(){ b.classList.add('g-in'); });
      tiles.push(b);
    });
    function paintTile(b){
      var f = b._f, n = SERVICIOS[f.servicio][lang()];
      b._tt.textContent = n;
      b._title.textContent = pick(f, 'titulo');
      b._dt.textContent = pick(f, 'texto');
      b.setAttribute('aria-label', pick(f, 'titulo') + ' — ' + n);
    }

    // ---------- Orden y paginación
    function initialFor(key){ return key === 'todos' ? (mqWide.matches ? 8 : 6) : STEP; }
    function roundCols(n){ var c = mqWide.matches ? 4 : 2; return Math.ceil(n / c) * c; }
    var shown = initialFor('todos');

    // "Todos": reparte por grupos (manicura, pedicura, cejas, pestañas) para que las primeras fotos sean variadas
    function order(key){
      if (key !== 'todos') return tiles.filter(function(t){ return t._f.servicio === key; });
      var queues = GRUPOS.map(function(g){
        var per = g.map(function(s){ return tiles.filter(function(t){ return t._f.servicio === s; }); });
        var out = [], i = 0, any = true;
        while (any){ any = false; per.forEach(function(a){ if (i < a.length){ out.push(a[i]); any = true; } }); i++; }
        return out;
      });
      var res = [], r = 0, go = true;
      while (go){ go = false; queues.forEach(function(q){ if (r < q.length){ res.push(q[r]); go = true; } }); r++; }
      return res;
    }

    var io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
      var k = 0;
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.style.setProperty('--d', (k++ * 0.09) + 's'); en.target.classList.add('g-in'); io.unobserve(en.target); }
      });
    }, {threshold:0.1, rootMargin:'0px 0px -4% 0px'}) : null;
    function reveal(list){ list.forEach(function(t){ if (io) io.observe(t); else t.classList.add('g-in'); }); }

    function say(){
      var n = Math.min(shown, curList.length);
      status.textContent = lang() === 'en' ? ('Showing ' + n + ' of ' + curList.length + ' photos') : ('Mostrando ' + n + ' de ' + curList.length + ' fotos');
    }
    function updateMore(){
      var rest = curList.length - shown;
      more.hidden = rest <= 0;
      var n = Math.min(shown, curList.length);
      count.textContent = lang() === 'en' ? (n + ' of ' + curList.length) : (n + ' de ' + curList.length);
      var add = Math.min(STEP, Math.max(rest, 0));
      moreBtn.textContent = lang() === 'en' ? ('Show ' + add + ' more') : ('Ver ' + add + ' más');
    }

    function sync(){
      var vis = curList.slice(0, shown);
      tiles.forEach(function(t){ t.classList.add('g-reset'); t.classList.remove('g-leave', 'g-in'); });
      grid.textContent = '';
      vis.forEach(function(t, i){ grid.appendChild(t); t.classList.toggle('alt', i % 2 === 1); });
      void grid.offsetWidth;
      tiles.forEach(function(t){ t.classList.remove('g-reset'); });
      reveal(vis); updateMore(); say();
    }

    var timer = null;
    function setFilter(key){
      if (key !== 'todos' && !SERVICIOS[key]) key = 'todos';
      if (key === cur) return;
      cur = key;
      chips.forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-key') === key)); });
      var list = order(key);
      var old = [].slice.call(grid.querySelectorAll('.g-tile'));
      grid.style.minHeight = grid.offsetHeight + 'px';
      clearTimeout(timer);
      function run(){
        curList = list; shown = initialFor(key); sync();
        setTimeout(function(){ grid.style.minHeight = ''; }, 700);
      }
      if (reduce || !old.length){ run(); return; }
      old.forEach(function(t){ t.classList.add('g-leave'); });
      timer = setTimeout(run, 240);
    }

    moreBtn.addEventListener('click', function(){
      var prev = shown;
      shown = Math.min(curList.length, shown + STEP);
      var added = curList.slice(prev, shown);
      added.forEach(function(t, i){
        t.classList.add('g-reset'); t.classList.remove('g-in');
        grid.appendChild(t); t.classList.toggle('alt', (prev + i) % 2 === 1);
      });
      void grid.offsetWidth;
      added.forEach(function(t){ t.classList.remove('g-reset'); });
      reveal(added); updateMore(); say();
      if (added[0]) added[0].focus();
    });

    function onMq(){
      if (cur === 'todos') shown = roundCols(Math.max(shown, initialFor('todos')));
      shown = Math.min(Math.max(shown, 1), Math.max(curList.length, 1));
      sync();
    }
    if (mqWide.addEventListener) mqWide.addEventListener('change', onMq); else if (mqWide.addListener) mqWide.addListener(onMq);

    // Enlaces "Ver trabajos" de las cards de servicio
    document.addEventListener('click', function(e){
      var a = e.target.closest ? e.target.closest('[data-gal-filter]') : null;
      if (a) setFilter(a.getAttribute('data-gal-filter'));
    });

    // ---------- Visor
    var lb = document.getElementById('g-lb'), lbImg = document.getElementById('lb-img'), lbPh = document.getElementById('lb-ph');
    var openIdx = -1, lastFocus = null, closeTimer = null, swapTimer = null;
    var lbIco = document.getElementById('lb-ico'), lbSvc = document.getElementById('lb-svc'), lbTitle = document.getElementById('lb-title'),
        lbText = document.getElementById('lb-text'), lbCta = document.getElementById('lb-cta'), lbCtaT = document.getElementById('lb-cta-t'),
        lbMore = document.getElementById('lb-more'), lbCount = document.getElementById('lb-count');

    function waHref(s){
      var L = lang(), n = s.wa[L];
      var msg = L === 'en'
        ? 'Hello, I would like to book an appointment for ' + n + ' at AM Luxury Beauty Studio. What times do you have available?'
        : 'Hola, quiero reservar cita para ' + n + ' en AM Luxury Beauty Studio. ¿Qué horarios tienen disponibles?';
      return 'https://wa.me/' + AM.PHONE + '?text=' + encodeURIComponent(msg);
    }
    function paintLB(animate){
      var t = curList[openIdx]; if (!t) return;
      var f = t._f, s = SERVICIOS[f.servicio], L = lang();
      function apply(){
        lbPh.hidden = true; lbImg.alt = pick(f, 'titulo');
        lbImg.onerror = function(){ lbImg.classList.remove('in'); lbPh.src = s.ico; lbPh.hidden = false; };
        lbImg.src = f.foto; lbImg.classList.add('in');
      }
      lbIco.src = s.ico; lbSvc.textContent = s[L];
      lbTitle.textContent = pick(f, 'titulo'); lbText.textContent = pick(f, 'texto');
      lbCtaT.textContent = (L === 'en' ? 'Book ' : 'Reservar ') + s.wa[L];
      lbCta.href = waHref(s);
      lbMore.href = '#' + f.servicio;
      lbMore.lastChild.nodeValue = L === 'en' ? 'See prices and details' : 'Ver precios y detalles';
      lbCount.textContent = (openIdx + 1) + (L === 'en' ? ' of ' : ' de ') + curList.length;
      if (animate && !reduce){ lbImg.classList.remove('in'); clearTimeout(swapTimer); swapTimer = setTimeout(apply, 160); }
      else apply();
    }
    function openLB(i, opener){
      if (i < 0) return;
      clearTimeout(closeTimer);
      openIdx = i; lastFocus = opener || null;
      paintLB(false);
      lb.hidden = false; document.body.classList.add('lb-open');
      requestAnimationFrame(function(){ lb.classList.add('is-open'); });
      lb.querySelector('.lb-close').focus();
    }
    function closeLB(){
      if (lb.hidden) return;
      lb.classList.remove('is-open'); document.body.classList.remove('lb-open');
      closeTimer = setTimeout(function(){ lb.hidden = true; }, reduce ? 0 : 260);
      if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
    }
    function go(d){
      if (!curList.length) return;
      openIdx = (openIdx + d + curList.length) % curList.length;
      paintLB(true);
    }
    lb.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('[data-lb-close]')) closeLB();
    });
    document.getElementById('lb-prev').addEventListener('click', function(){ go(-1); });
    document.getElementById('lb-next').addEventListener('click', function(){ go(1); });
    document.addEventListener('keydown', function(e){
      if (lb.hidden) return;
      if (e.key === 'Escape'){ closeLB(); }
      else if (e.key === 'ArrowLeft'){ go(-1); }
      else if (e.key === 'ArrowRight'){ go(1); }
      else if (e.key === 'Tab'){
        var f = [].slice.call(lb.querySelectorAll('button, a[href]')).filter(function(x){ return x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
    AM.swipe(lb, go);

    // ---------- Idioma: repintar textos cuando cambia <html lang>
    function paintAll(){ paintChips(); tiles.forEach(paintTile); if (!lb.hidden) paintLB(false); updateMore(); say(); }
    AM.onLang(paintAll);

    // Para el buscador
    window.AMGallery = {
      setFilter: setFilter,
      items: function(){
        return FOTOS.map(function(f){ return {key:f.servicio, title:pick(f, 'titulo'), text:pick(f, 'texto'), service:SERVICIOS[f.servicio][lang()]}; });
      }
    };

    // ---------- Inicio
    paintChips(); tiles.forEach(paintTile);
    curList = order('todos'); sync();
  })();

  // ===== Buscador de la web =====
  // Lee el contenido de la página al abrirse (servicios, paquete, café y bebidas, equipo, reseñas, preguntas, contacto y galería).
  (function(){
    var btn = document.getElementById('search-toggle'), panel = document.getElementById('site-search');
    if (!btn || !panel) return;
    var input = document.getElementById('ss-input'), body = document.getElementById('ss-body'), status = document.getElementById('ss-status'),
        clear = document.getElementById('ss-clear'), closeB = document.getElementById('ss-close'), label = document.getElementById('ss-label');
    var reduce = AM.reduce;

    var STR = {
      es: {open:'Buscar en la web', ph:'Busca precios, horario, café, pestañas…', clear:'Borrar búsqueda', close:'Cerrar búsqueda',
           quick:'Búsquedas rápidas', goto:'Ir directamente a', none:'No encontramos resultados para', tip:'Prueba con otra palabra o escríbenos por WhatsApp.',
           wa:'Escribir por WhatsApp', one:'1 resultado', many:' resultados', waMsg:'Hola, tengo una duda sobre los servicios de AM Luxury Beauty Studio.',
           sec:{servicios:'Servicios', paquete:'Paquete Luxury', galeria:'Galería', cafe:'Café y bebidas', equipo:'Equipo', resenas:'Reseñas', faq:'Preguntas frecuentes', contacto:'Contacto'}},
      en: {open:'Search the site', ph:'Search prices, hours, coffee, lashes…', clear:'Clear search', close:'Close search',
           quick:'Quick searches', goto:'Jump to', none:'No results found for', tip:'Try another word or message us on WhatsApp.',
           wa:'Message on WhatsApp', one:'1 result', many:' results', waMsg:'Hello, I have a question about the services at AM Luxury Beauty Studio.',
           sec:{servicios:'Services', paquete:'Luxury Package', galeria:'Gallery', cafe:'Coffee & drinks', equipo:'Team', resenas:'Reviews', faq:'FAQ', contacto:'Contact'}}
    };
    var QUICK = [
      {es:'Precios', en:'Prices', qes:'precios', qen:'prices'},
      {es:'Horario', en:'Hours', qes:'horario', qen:'hours'},
      {es:'Ubicación', en:'Location', qes:'ubicación', qen:'location'},
      {es:'Formas de pago', en:'Payment', qes:'pago', qen:'payment'},
      {es:'Café', en:'Coffee', qes:'café', qen:'coffee'},
      {es:'Reservar', en:'Book', qes:'reservar', qen:'book'}
    ];
    var GOTO = [['#servicios','servicios'], ['#paquete','paquete'], ['#cafe','cafe'], ['#galeria','galeria'], ['#equipo','equipo'], ['#resenas','resenas'], ['#faq','faq'], ['#reserva','contacto']];

    // Palabras relacionadas (claves sin acentos)
    var SYN = {
      precio:['usd','$','cup'], precios:['usd','$','cup'], costo:['usd','$'], costos:['usd','$'], tarifa:['usd','$'], cuanto:['usd','$'],
      price:['usd','$','cup'], prices:['usd','$','cup'], cost:['usd','$'],
      horario:['lunes a viernes','8:00','atencion'], horarios:['lunes a viernes','8:00','atencion'], hora:['lunes a viernes','8:00'], abren:['lunes a viernes','8:00'], abierto:['lunes a viernes','8:00'],
      hours:['lunes a viernes','monday to friday','8:00'], schedule:['lunes a viernes','monday to friday','8:00'], open:['lunes a viernes','monday to friday','8:00'],
      ubicacion:['calle','cardenas','direccion','mapa','maps','address'], direccion:['calle','cardenas','mapa','maps','address'], donde:['calle','cardenas','mapa','maps','address'], mapa:['calle','cardenas','maps'],
      location:['calle','cardenas','direccion','mapa','maps','address'], address:['calle','cardenas','direccion','maps'], where:['calle','cardenas','direccion','maps'], map:['calle','cardenas','maps'],
      pago:['pago','usd','eur','cad','cup','payment'], pagos:['pago','usd','eur','cad','cup','payment'], pagar:['pago','usd','eur','cad','cup','payment'], tarjeta:['pago','usd','eur','cad','cup'],
      efectivo:['pago','usd','eur','cad','cup'], moneda:['pago','usd','eur','cad','cup'], payment:['pago','usd','eur','cad','cup'], pay:['pago','usd','eur','cad','cup'], cash:['pago','usd','eur','cad','cup'], currency:['pago','usd','eur','cad','cup'],
      reservar:['cita','reserva','whatsapp','book'], reserva:['cita','whatsapp','book'], cita:['reserva','whatsapp','appointment'], agendar:['cita','reserva','whatsapp'], turno:['cita','reserva','whatsapp'],
      book:['cita','reserva','whatsapp'], booking:['cita','reserva','whatsapp'], appointment:['cita','reserva','whatsapp'],
      telefono:['whatsapp','phone','llamar'], llamar:['whatsapp','telefono','phone'], phone:['telefono','whatsapp'], call:['telefono','whatsapp'],
      unas:['manicura','pedicura','manicure','pedicure','nails'], nails:['manicura','pedicura','unas'], manos:['manicura','hands'], pies:['pedicura','feet'],
      pestanas:['lashes','eyelash'], lashes:['pestanas'], eyelash:['pestanas'], eyelashes:['pestanas'], cejas:['brow','brows'], brows:['cejas'], eyebrows:['cejas'],
      cafe:['coffee','espresso','expreso'], coffee:['cafe'], bebida:['bebidas','copa','drink'], bebidas:['copa','drinks'], drinks:['bebidas','copa'], vino:['wine','copa'], wine:['vino'],
      equipo:['team','especialista'], team:['equipo','especialista']
    };
    var ALIAS = {
      'manicura':'unas manos esmaltado gel builder softgel', 'manicura-spa':'unas manos spa parafina mascarilla masaje',
      'pedicura':'pies unas callos hidromasaje', 'pedicura-spa':'pies spa hidromasaje parafina masaje',
      'pestanas':'pestanas ojos mirada extensiones volumen 2d 3d 4d 5d 6d', 'cejas':'cejas laminado henna depilacion bozo barbilla diseno'
    };

    var L = AM.lang;
    function S(){ return STR[L()]; }
    function norm(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function clean(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
    // Texto de un elemento con un espacio entre nodos (evita palabras pegadas)
    function T(el){
      if (!el) return '';
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, out = [];
      while ((n = w.nextNode())){ var v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (v) out.push(v); }
      return out.join(' ');
    }
    function q$(sel, root){ return [].slice.call((root || document).querySelectorAll(sel)); }
    var mk = AM.el;

    // ---------- Índice
    var index = [];
    function add(o){ o.nt = norm(o.title); o.ns = norm(o.section); o.nx = norm(o.text + ' ' + (o.extra || '')); index.push(o); }
    function build(){
      index = [];
      var s = S().sec;
      q$('.svc-card').forEach(function(c){
        var h = c.querySelector('h3'), b = c.querySelector('.svc-body'), hd = c.querySelector('.svc-head');
        add({title:T(h), section:s.servicios, text:T(hd) + ' ' + T(b), extra:ALIAS[c.id], el:c, block:'start'});
      });
      var pk = document.querySelector('#paquete .package-card');
      if (pk){ var ph = pk.querySelector('h2'), pb = pk.querySelector('.pk-body');
        add({title:T(ph), section:s.paquete, text:T(pb), extra:'full service combo manos pies precio', el:pk, block:'start'}); }
      if (window.AMGallery){
        var gal = document.getElementById('galeria');
        window.AMGallery.items().forEach(function(it){
          add({title:it.title, section:s.galeria, text:it.text + ' ' + it.service, extra:'foto fotos trabajos', el:gal, block:'start', act:function(){ window.AMGallery.setFilter(it.key); }});
        });
      }
      q$('.cafe-row').forEach(function(r){
        var h = r.querySelector('h2'), lead = r.querySelector('.cafe-lead'), mh = r.querySelector('.cafe-menu h3');
        add({title:T(h), section:s.cafe, text:T(lead) + ' ' + T(mh), el:r, block:'start'});
        q$('.menu>li', r).forEach(function(li){
          var n = li.querySelector('.mn'), p = li.querySelector('.mp');
          add({title:T(n), section:s.cafe, text:T(p), el:li, block:'center'});
        });
      });
      q$('.person').forEach(function(p){
        var h = p.querySelector('h3');
        add({title:T(h), section:s.equipo, text:T(p), el:p, block:'center'});
      });
      var rs = document.getElementById('resenas');
      q$('.rv-card').forEach(function(c){
        var sv = c.querySelector('.rv-service'), tx = c.querySelector('.rv-text');
        add({title:(sv ? T(sv) : T(c)), section:s.resenas, text:T(tx), el:rs, block:'start'});
      });
      q$('.faq-item').forEach(function(d){
        var sm = d.querySelector('summary'), a = d.querySelector('.faq-a');
        add({title:T(sm), section:s.faq, text:T(a), el:d, block:'center'});
      });
      var cards = q$('#reserva .r-card'), ex = ['agenda cita reservar whatsapp', 'telefono llamar whatsapp instagram facebook grupo', 'direccion mapa como llegar donde calle', 'horario hora abren abierto dias'];
      cards.forEach(function(c, i){
        var h = c.querySelector('h2, h3');
        add({title:T(h), section:s.contacto, text:T(c), extra:ex[i] || '', el:c, block:'center'});
      });
    }

    // ---------- Búsqueda
    function alts(t){ return [t].concat(SYN[t] || []); }
    function score(e, toks){
      var total = 0;
      for (var i = 0; i < toks.length; i++){
        var a = alts(toks[i]), best = 0;
        for (var j = 0; j < a.length; j++){
          var w = j === 0 ? 1 : 0.4, v = 0;
          if (e.nt.indexOf(a[j]) >= 0) v = 10 * w; else if (e.ns.indexOf(a[j]) >= 0) v = 4 * w; else if (e.nx.indexOf(a[j]) >= 0) v = 1.5 * w;
          if (v > best) best = v;
        }
        if (!best) return 0;
        total += best;
      }
      return total;
    }
    function snippet(e, toks){
      var nt = norm(e.text), pos = -1;
      toks.forEach(function(t){ alts(t).forEach(function(a){ var p = nt.indexOf(a); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }); });
      var start = Math.max(0, (pos < 0 ? 0 : pos) - 30), s = e.text.slice(start, start + 120);
      return (start > 0 ? '… ' : '') + s + (start + 120 < e.text.length ? ' …' : '');
    }
    function hl(parent, text, toks){
      var ns = norm(text), r = [], i;
      toks.forEach(function(t){ if (t.length < 2) return; i = 0; while ((i = ns.indexOf(t, i)) >= 0){ r.push([i, i + t.length]); i += t.length; } });
      r.sort(function(a, b){ return a[0] - b[0]; });
      var m = []; r.forEach(function(x){ var l = m[m.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else m.push(x); });
      var p = 0;
      m.forEach(function(x){
        if (x[0] > p) parent.appendChild(document.createTextNode(text.slice(p, x[0])));
        parent.appendChild(mk('mark', null, text.slice(x[0], x[1]))); p = x[1];
      });
      if (p < text.length) parent.appendChild(document.createTextNode(text.slice(p)));
    }
    function hrefFor(e){ var n = e.el; while (n && !n.id) n = n.parentNode; return n && n.id ? '#' + n.id : '#'; }

    function chipsBlock(withLabel){
      var blk = mk('div', 'ss-block');
      if (withLabel) blk.appendChild(mk('p', 'ss-label', S().quick));
      var w = mk('div', 'ss-chips');
      QUICK.forEach(function(q){
        var b = mk('button', 'ss-chip', q[L()]); b.type = 'button';
        b.addEventListener('click', function(){ input.value = q['q' + L()]; render(input.value); input.focus(); });
        w.appendChild(b);
      });
      blk.appendChild(w); return blk;
    }
    function renderHome(){
      body.appendChild(chipsBlock(true));
      var blk = mk('div', 'ss-block'); blk.appendChild(mk('p', 'ss-label', S().goto));
      var w = mk('div', 'ss-links');
      GOTO.forEach(function(g){ var a = mk('a', null, S().sec[g[1]]); a.href = g[0]; w.appendChild(a); });
      blk.appendChild(w); body.appendChild(blk);
    }
    function render(raw){
      var q = clean(raw), toks = norm(q).split(' ').filter(Boolean);
      body.textContent = ''; clear.hidden = !q;
      if (!q || (toks.length === 1 && toks[0].length < 2)){ renderHome(); status.textContent = ''; return; }
      var res = [];
      index.forEach(function(e, i){ var sc = score(e, toks); if (sc > 0) res.push({e:e, s:sc, i:i}); });
      res.sort(function(a, b){ return b.s - a.s || a.i - b.i; });
      res = res.slice(0, 10);
      if (!res.length){
        var p = mk('p', 'ss-none'); p.appendChild(document.createTextNode(S().none + ' “' + q + '”. ' + S().tip + ' '));
        var a = mk('a', null, S().wa); a.href = 'https://wa.me/' + AM.PHONE + '?text=' + encodeURIComponent(S().waMsg); a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a);
        body.appendChild(p); body.appendChild(chipsBlock(false));
        status.textContent = (L() === 'en' ? 'No results' : 'Sin resultados'); return;
      }
      var ul = mk('ul', 'ss-results');
      res.forEach(function(r){
        var e = r.e, li = mk('li'), a = mk('a'); a.href = hrefFor(e); a.setAttribute('data-i', String(index.indexOf(e)));
        a.appendChild(mk('span', 'sr-sec', e.section));
        var t = mk('span', 'sr-title'); hl(t, e.title, toks); a.appendChild(t);
        var sn = snippet(e, toks);
        if (clean(sn)){ var sp = mk('span', 'sr-snip'); hl(sp, sn, toks); a.appendChild(sp); }
        li.appendChild(a); ul.appendChild(li);
      });
      body.appendChild(ul);
      status.textContent = res.length === 1 ? S().one : (res.length + S().many);
    }

    // ---------- Ir al resultado
    function go(e){
      close(false);
      if (e.act) e.act();
      var el = e.el;
      if (el.tagName === 'DETAILS') el.open = true;
      setTimeout(function(){
        el.classList.remove('search-hit'); void el.offsetWidth; el.classList.add('search-hit');
        el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: e.block || 'start'});
        var had = el.hasAttribute('tabindex'); if (!had) el.setAttribute('tabindex', '-1');
        try { el.focus({preventScroll:true}); } catch(err){ el.focus(); }
        setTimeout(function(){ el.classList.remove('search-hit'); if (!had) el.removeAttribute('tabindex'); }, 2700);
      }, 80);
    }
    body.addEventListener('click', function(ev){
      var a = ev.target.closest ? ev.target.closest('a[data-i]') : null;
      if (a){ ev.preventDefault(); go(index[parseInt(a.getAttribute('data-i'), 10)]); return; }
      var l = ev.target.closest ? ev.target.closest('.ss-links a') : null;
      if (l) close(false);
    });

    // ---------- Abrir / cerrar
    var opened = false, hideTimer = null, rt = null;
    function paintUI(){
      var s = S();
      btn.setAttribute('aria-label', s.open); panel.setAttribute('aria-label', s.open);
      label.textContent = s.open; input.placeholder = s.ph;
      clear.setAttribute('aria-label', s.clear); closeB.setAttribute('aria-label', s.close);
      if (opened){ build(); render(input.value); }
    }
    function open(){
      var nt = document.querySelector('.nav-toggle');
      if (nt && nt.getAttribute('aria-expanded') === 'true') nt.click();
      clearTimeout(hideTimer);
      build(); opened = true; panel.hidden = false;
      requestAnimationFrame(function(){ panel.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      render(input.value); input.focus();
    }
    function close(ret){
      if (!opened) return;
      opened = false; panel.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
      hideTimer = setTimeout(function(){ if (!opened) panel.hidden = true; }, reduce ? 0 : 260);
      if (ret) btn.focus();
    }
    btn.addEventListener('click', function(e){ e.stopPropagation(); if (opened) close(true); else open(); });
    closeB.addEventListener('click', function(){ close(true); });
    clear.addEventListener('click', function(){ input.value = ''; render(''); input.focus(); });
    input.addEventListener('input', function(){ clearTimeout(rt); rt = setTimeout(function(){ render(input.value); }, 70); });
    input.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown'){ var f = body.querySelector('a, button'); if (f){ e.preventDefault(); f.focus(); } }
      else if (e.key === 'Enter'){ var r = body.querySelector('.ss-results a'); if (r){ e.preventDefault(); r.click(); } }
    });
    body.addEventListener('keydown', function(e){
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      var list = q$('a, button', body), i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') (list[i + 1] || list[i]).focus();
      else if (e.key === 'ArrowUp'){ if (i === 0) input.focus(); else list[i - 1].focus(); }
      else if (e.key === 'Home') list[0].focus(); else list[list.length - 1].focus();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && opened){
        if (document.activeElement === input && input.value){ input.value = ''; render(''); } else close(true);
        return;
      }
      var t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      if (!opened && !document.body.classList.contains('lb-open') && !e.altKey &&
          ((e.key === '/' && !e.ctrlKey && !e.metaKey && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))){
        e.preventDefault(); open();
      }
    });
    document.addEventListener('click', function(e){
      if (opened && document.contains(e.target) && !panel.contains(e.target) && !btn.contains(e.target)) close(false);
    });
    var nt = document.querySelector('.nav-toggle');
    if (nt) nt.addEventListener('click', function(){ if (opened) close(false); });

    AM.onLang(paintUI);
    paintUI();
  })();

  // ===== Navegación: indicador deslizante, sección activa y encabezado al hacer scroll =====
  (function(){
    var header = document.querySelector('.site-header'), nav = document.getElementById('nav');
    var box = nav && nav.querySelector('.nav-links'), pill = box && box.querySelector('.nav-pill');
    if (!header || !box || !pill) return;
    var links = [].slice.call(box.querySelectorAll('a'));
    var targets = links.map(function(a){ return document.querySelector(a.getAttribute('href')); });
    var active = null, hover = null, ticking = false;

    function place(a){
      if (!a || getComputedStyle(pill).display === 'none'){ pill.classList.remove('on'); return; }
      var first = !pill.classList.contains('on');
      if (first) pill.classList.add('snap');
      pill.style.setProperty('--ix', a.offsetLeft + 'px');
      pill.style.setProperty('--iw', a.offsetWidth + 'px');
      pill.classList.add('on');
      if (first){ void pill.offsetWidth; pill.classList.remove('snap'); }
    }
    function render(){ place(hover || active); }

    links.forEach(function(a){
      a.addEventListener('mouseenter', function(){ hover = a; render(); });
      a.addEventListener('focus', function(){ hover = a; render(); });
      a.addEventListener('blur', function(){ hover = null; render(); });
    });
    box.addEventListener('mouseleave', function(){ hover = null; render(); });

    function update(){
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      var cur = null;
      for (var i = 0; i < links.length; i++){
        if (targets[i] && targets[i].getBoundingClientRect().top <= 150) cur = links[i];
      }
      var bkf = document.getElementById('reservar-cita');
      if (bkf && !bkf.hidden && bkf.getBoundingClientRect().top <= 150) cur = null;
      if (cur !== active){
        links.forEach(function(l){
          l.classList.toggle('is-active', l === cur);
          if (l === cur) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
        });
        active = cur; render();
      }
    }
    function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', function(){ requestAnimationFrame(function(){ pill.classList.remove('on'); render(); }); });
    AM.onLang(function(){ requestAnimationFrame(function(){ pill.classList.remove('on'); render(); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ pill.classList.remove('on'); render(); });
    update();
  })();

  // ===== Idioma: español / inglés =====
  // El HTML está en español. Al elegir EN, cada texto se sustituye por su traducción.
  // Para traducir un texto nuevo, añade una línea al diccionario EN: 'texto en español': 'English text'
  (function(){
    var TRADUCIR_WHATSAPP = true;     // true = los mensajes de WhatsApp también salen en inglés
    var EN = {
 "Reservar en línea": "Book online",
 "Ir al contenido": "Skip to content",
 "Reservar por WhatsApp": "Book on WhatsApp",
 "Servicios": "Services",
 "Equipo": "Team",
 "Reseñas": "Reviews",
 "Contacto": "Contact",
 "Reservar cita": "Book now",
 "Somos AM Luxury Beauty Studio": "We are AM Luxury Beauty Studio",
 "Belleza, estética y estilo": "Beauty, aesthetics and style",
 "Un espacio creado para ti, donde la elegancia y el bienestar se encuentran, mientras cada detalle está pensado para consentirte. Déjate envolver por un agradable aroma, música relajante y una atmósfera tranquila que te invita al disfrute y la relajación total.": "A space created for you, where elegance and wellbeing meet and every detail is designed to pamper you. Let yourself be enveloped by a pleasant aroma, relaxing music and a calm atmosphere that invites you to enjoy total relaxation.",
 "Un ritual para tus manos": "A ritual for your hands",
 "Baño de manos con sales y perlas regeneradoras, mascarilla con vaporizador de ozono y un masaje relajante, con una bebida premium de cortesía.": "Hand bath with salts and regenerating pearls, mask with an ozone steamer and a relaxing massage, with a complimentary premium drink.",
 "Ver Manicura SPA": "View SPA Manicure",
 "Tus pies merecen descanso": "Your feet deserve to rest",
 "Hidromasaje con sales y perlas, termoterapia con toallas calientes y masajeador ocular 4D, en una atmósfera tranquila con música relajante.": "Hydromassage with salts and pearls, thermotherapy with hot towels and a 4D eye massager, in a calm atmosphere with relaxing music.",
 "Ver Pedicura SPA": "View SPA Pedicure",
 "Una mirada que resalta": "A look that stands out",
 "Extensiones de pestañas y diseño de cejas personalizado, con un servicio profesional y lleno de detalles. Café incluido.": "Eyelash extensions and personalized brow design, with a professional service full of details. Coffee included.",
 "Ver pestañas y cejas": "View lashes and brows",
 "Nuestros servicios": "Our services",
 "Consiéntete con tratamientos diseñados para resaltar tu belleza": "Pamper yourself with treatments designed to enhance your beauty",
 "Manicura": "Manicure",
 "Duración aprox. ·": "Approx. duration ·",
 "Desde": "From",
 "Manicura Estándar": "Standard Manicure",
 "Reforzamiento con Builder Gel": "Builder Gel reinforcement",
 "Técnica Combinada": "Combined Technique",
 "Todos los servicios de manicura incluyen": "All manicure services include",
 "Manicura macro para acabado impecable": "Macro manicure for a flawless finish",
 "Esmaltado profundo": "Deep polish application",
 "Decoración hasta 2 uñas": "Decoration on up to 2 nails",
 "Hidratación con ligero masaje": "Hydration with a light massage",
 "Masajeadores de pie y cuello opcionales": "Optional foot and neck massagers",
 "Café incluido": "Coffee included",
 "Servicios adicionales": "Additional services",
 "Retiro de sistema (no hecho en AM)": "Removal of a system (not done at AM)",
 "Decoración adicional (más de 2 uñas)": "Additional decoration (more than 2 nails)",
 "Jelly, tratamiento nutritivo": "Jelly, nourishing treatment",
 "Parafina para hidratación intensiva": "Paraffin for intensive hydration",
 "Baño de manos con sales y perlas regeneradoras": "Hand bath with salts and regenerating pearls",
 "Espuma limpiadora": "Cleansing foam",
 "Exfoliación profunda": "Deep exfoliation",
 "Mascarilla con vaporizador de ozono": "Mask with ozone steamer",
 "Velo-terapia relajante": "Relaxing veil therapy",
 "Masaje relajante": "Relaxing massage",
 "Toque final con exquisita fragancia": "Finishing touch with an exquisite fragrance",
 "Bebida premium incluida": "Premium drink included",
 "Pedicura": "Pedicure",
 "Limpieza profunda de cutículas": "Deep cuticle cleaning",
 "Molde perfecto de uñas": "Perfect nail shaping",
 "Eliminación de callos y durezas": "Removal of calluses and hardened skin",
 "7 minutos en tina de hidromasaje": "7 minutes in a hydromassage tub",
 "Masajeador de cuello (opcional)": "Neck massager (optional)",
 "Pedicura para caballeros": "Men's pedicure",
 "Pedicura SPA": "SPA Pedicure",
 "Baño de pie en tina de hidromasaje con sales y perlas": "Foot bath in a hydromassage tub with salts and pearls",
 "Termoterapia con toallas calientes": "Thermotherapy with hot towels",
 "Velo-terapia nutritiva": "Nourishing veil therapy",
 "Parafina ultra profunda": "Ultra-deep paraffin",
 "Pistola de masaje para fascia plantar": "Massage gun for the plantar fascia",
 "Masajeador ocular 4D": "4D eye massager",
 "Extensiones de pestañas": "Eyelash Extensions",
 "Extensiones de pestañas 3D": "3D Eyelash Extensions",
 "Set nuevo ·": "New set ·",
 "Retoque ·": "Touch-up ·",
 "Retiro de extensiones de pestañas": "Eyelash extension removal",
 "Diseño de cejas": "Brow Design",
 "Laminado + Diseño + Depilación": "Lamination + Design + Waxing",
 "Henna + Diseño + Depilación": "Henna + Design + Waxing",
 "Depilación de cejas + Diseño": "Brow waxing + Design",
 "Depilación de bozo": "Upper-lip waxing",
 "Depilación de barbilla": "Chin waxing",
 "Laminado Premium": "Premium Lamination",
 "Laminado + Depilación + Tinte": "Lamination + Waxing + Tint",
 "Parches hidratantes": "Hydrating patches",
 "Productos de alta calidad": "High-quality products",
 "Aceite de castor para el cuidado en casa": "Castor oil for at-home care",
 "Paquete Luxury Full Service": "Luxury Full Service Package",
 "Una experiencia completa para consentir tus manos y pies": "A complete experience to pamper your hands and feet",
 "Manos": "Hands",
 "Pies": "Feet",
 "Manicura SPA": "SPA Manicure",
 "Pedicura Estándar": "Standard Pedicure",
 "Incluye todos nuestros servicios de manos y pies. No incluye pestañas ni cejas.": "Includes all our hand and foot services. Does not include lashes or brows.",
 "Café y bebida de cortesía incluidos": "Complimentary coffee and drink included",
 "En nuestro Studio, te invitamos a vivir una gran experiencia con nuestro Full Service, que une manos y pies en un solo ritual de lujo y calidez.": "At our Studio, we invite you to enjoy a great experience with our Full Service, which brings hands and feet together in a single ritual of luxury and warmth.",
 "Reservar Full Service": "Book Full Service",
 "Cortesía de la casa": "On the house",
 "Café de cortesía": "Complimentary coffee",
 "Cada visita empieza con un café servido en bandeja dorada, para que te sientas consentida desde el primer momento. Está incluido en todos nuestros servicios, y en los SPA y el Paquete Luxury lo acompañas con una bebida premium.": "Every visit begins with a coffee served on a golden tray, so you feel pampered from the very first moment. It is included in all our services, and with the SPA services and the Luxury Package you enjoy it with a premium drink.",
 "Carta de café": "Coffee menu",
 "Para consumo adicional": "For additional orders",
 "Expreso": "Espresso",
 "Capuchino": "Cappuccino",
 "con Baileys": "with Baileys",
 "Precios en CUP.": "Prices in CUP.",
 "Para brindar": "Time to toast",
 "Carta de bebidas": "Drinks menu",
 "Completa tu visita con una copa de nuestra carta, servida con el mismo cuidado y la misma elegancia que el café.": "Complete your visit with a glass from our menu, served with the same care and elegance as the coffee.",
 "Nuestras copas": "Our glasses",
 "Copa de vino tinto": "Glass of red wine",
 "Copa de vino blanco": "Glass of white wine",
 "Copa de vino rosado": "Glass of rosé wine",
 "Copa de champagne": "Glass of champagne",
 "Copa de crema de whisky": "Glass of whisky cream",
 "El talento detrás de AM Luxury Beauty Studio": "The talent behind AM Luxury Beauty Studio",
 "Conoce a nuestros especialistas que cuidan cada detalle": "Meet our specialists who take care of every detail",
 "Especialista en técnicas de spa y tratamientos de lujo para manos y pies": "Specialist in spa techniques and luxury hand and foot treatments",
 "Especialista en extensiones de pestañas y diseño de cejas personalizado": "Specialist in eyelash extensions and personalized brow design",
 "Resalta tu belleza con un servicio profesional, personalizado y lleno de detalles": "Enhance your beauty with a professional, personalized service full of details",
 "Reseñas de nuestros clientes": "Reviews from our clients",
 "Cada opinión nos inspira a seguir cuidando los detalles": "Every opinion inspires us to keep caring for the details",
 "Clienta Anonima": "Anonymous Client",
 "Me encantó todo, tu mamá muy dulce siempre y atenta a todo, en verdad es muy bonito cualquier tipo de cita en el estudio, Encantada con todo...": "I loved everything, your mom is so sweet and attentive to everything. Honestly, any kind of appointment at the studio is really lovely. Delighted with everything...",
 "Un lugar donde hay que repetir, excelente servivio, muy lindo lo que transmiten, vale la pena cada minuto...": "A place you have to come back to, excellent service, what you convey is so lovely, every minute is worth it...",
 "Yo pase un rato muy feliz, se me paso el tiempo volando de lo bien que me sentí...": "I had a really happy time, the time flew by because I felt so good...",
 "El laminado y el diseño quedaron justo como quería. Muy buena atención y el café de cortesía es un detalle genial.": "The lamination and the design turned out exactly as I wanted. Very good service, and the complimentary coffee is a great touch.",
 "Una experiencia inolvidable el full service, gracias por consentirme, de verdad lo disfruté muchisimo...": "The full service was an unforgettable experience, thank you for pampering me, I truly enjoyed it so much...",
 "Pronto compartiremos las primeras reseñas de nuestros clientes.": "We'll soon share our first reviews from our clients.",
 "Preguntas frecuentes": "Frequently asked questions",
 "Todo lo que necesitas saber antes de tu visita": "Everything you need to know before your visit",
 "¿Aún tienes alguna duda?": "Still have a question?",
 "Será un placer atenderte. Escríbenos por WhatsApp y nuestro equipo te responderá con calma y cariño: resolveremos tus preguntas sobre servicios, duración, precios o disponibilidad, y te ayudaremos a elegir la experiencia que mejor se adapte a ti. Estamos de lunes a viernes, de 8:00 AM a 6:00 PM, listas para consentirte.": "It will be a pleasure to help you. Message us on WhatsApp and our team will reply with care and attention: we'll answer your questions about services, duration, prices or availability, and help you choose the experience that suits you best. We're here Monday to Friday, 8:00 AM to 6:00 PM, ready to pamper you.",
 "Escríbenos por WhatsApp": "Message us on WhatsApp",
 "¿Cómo reservo mi cita?": "How do I book my appointment?",
 "Escríbenos por WhatsApp o llámanos y te ayudamos a elegir tu horario. Agendamos con al menos un día de antelación, porque trabajamos con planificación para ofrecerte la mejor experiencia. Atendemos de lunes a viernes, de 8:00 AM a 6:00 PM.": "Message us on WhatsApp or call us and we will help you choose your time. We book at least one day in advance, because we work with planning to offer you the best experience. We are open Monday to Friday, from 8:00 AM to 6:00 PM.",
 "¿Dónde están y cómo llego?": "Where are you and how do I get there?",
 "Ver cómo llegar en Google Maps": "See directions on Google Maps",
 "¿Qué pasa si llego tarde?": "What if I arrive late?",
 "Te pedimos puntualidad para respetar el horario de las demás clientas. Si vas a retrasarte, avísanos por WhatsApp lo antes posible y vemos cómo ajustar tu cita.": "We ask for punctuality out of respect for our other clients' appointments. If you're going to be late, let us know on WhatsApp as soon as possible and we'll see how to adjust your appointment.",
 "¿Puedo cancelar o cambiar mi cita?": "Can I cancel or change my appointment?",
 "Sí. Escríbenos por WhatsApp con la mayor anticipación posible para reprogramar o cancelar, así podemos ofrecer ese horario a otra persona.": "Yes. Message us on WhatsApp as far in advance as possible to reschedule or cancel, so we can offer that time slot to someone else.",
 "¿Tengo que llevar algo?": "Do I need to bring anything?",
 "No necesitas llevar nada, nosotras tenemos todo listo. Si quieres un diseño en particular, puedes traer o enviarnos una foto de referencia.": "You don't need to bring anything, we have everything ready. If you'd like a particular design, you can bring or send us a reference photo.",
 "¿El café de cortesía está incluido?": "Is the complimentary coffee included?",
 "Sí. Todos nuestros servicios incluyen café de cortesía, y los servicios SPA y el Paquete Luxury suman una bebida premium. Si quieres algo más, tenemos una carta de": "Yes. All our services include a complimentary coffee, and the SPA services and the Luxury Package add a premium drink. If you'd like something more, we have a menu of",
 "café": "coffee",
 "y": "and",
 "bebidas": "drinks",
 "para consumo adicional.": "for additional orders.",
 "¿Cuánto dura cada servicio?": "How long does each service last?",
 "Agenda tu cita hoy": "Book your appointment today",
 "Déjanos consentirte, elige tu momento perfecto": "Let us pamper you, choose your perfect moment",
 "Lunes a viernes · 8:00 AM a 6:00 PM": "Monday to Friday · 8:00 AM to 6:00 PM",
 "Envíanos un mensaje": "Send us a message",
 "¡Será un placer atenderte!": "It will be a pleasure to serve you!",
 "Contacto directo": "Direct contact",
 "Recibidor de AM Luxury Beauty Studio": "AM Luxury Beauty Studio reception area",
 "Grupo de whatsap": "WhatsApp group",
 "Ubicación": "Location",
 "Cómo llegar": "Get directions",
 "Horario de atención": "Opening hours",
 "De lunes a viernes": "Monday to Friday",
 "8:00 AM a 6:00 PM": "8:00 AM to 6:00 PM",
 "Agendamos citas como minimo un dia de antelación, recuerda que trabajamos con planificación para ofrecer la mejor experiencia": "We book appointments at least one day in advance; remember that we work with planning to offer the best experience.",
 "Evalúa nuestro servicio": "Rate our service",
 "Cuéntanos cómo fue tu experiencia en AM Luxury Beauty Studio": "Tell us about your experience at AM Luxury Beauty Studio",
 "Aún no hay evaluaciones": "No ratings yet",
 "No se pudieron cargar las evaluaciones": "We couldn't load the ratings",
 "Tu evaluación": "Your rating",
 "5 estrellas, excelente": "5 stars, excellent",
 "4 estrellas, muy buena": "4 stars, very good",
 "3 estrellas, buena": "3 stars, good",
 "2 estrellas, regular": "2 stars, fair",
 "1 estrella, mala": "1 star, poor",
 "Elige de 1 a 5 estrellas": "Choose from 1 to 5 stars",
 "Enviar evaluación": "Submit rating",
 "Mala": "Poor",
 "Regular": "Fair",
 "Buena": "Good",
 "Muy buena": "Very good",
 "Excelente": "Excellent",
 "Donde la elegancia y el bienestar se encuentran.": "Where elegance and wellbeing meet.",
 "Catálogo de Servicios PDF": "Catalog of Service PDF",
 "Catálogo de Productos en Venta": "Catalog of Products for Sale",
 "Política de Privacidad": "Privacy Policy",
 "Términos y Condiciones": "Terms and Conditions",
 "Quejas y Sugerencias": "Complaints and Suggestions",
 "AM Luxury Beauty Studio. Todos los derechos reservados.": "AM Luxury Beauty Studio. All rights reserved.",
 "Volver arriba": "Back to top",
 "Llamar al estudio": "Call the studio",
 "AM Luxury Beauty Studio, inicio": "AM Luxury Beauty Studio, home",
 "Abrir menú": "Open menu",
 "Cerrar menú": "Close menu",
 "Principal": "Main",
 "Bienvenida a AM Luxury Beauty Studio": "Welcome to AM Luxury Beauty Studio",
 "Salón AM Luxury Beauty Studio": "AM Luxury Beauty Studio salon",
 "Elegir diapositiva": "Choose slide",
 "Diapositiva anterior": "Previous slide",
 "Diapositiva siguiente": "Next slide",
 "Pausar carrusel": "Pause carousel",
 "Reanudar carrusel": "Resume carousel",
 "Decoración Luxury": "Luxury decoration",
 "Reseñas de clientes": "Client reviews",
 "Reseñas anteriores": "Previous reviews",
 "Reseñas siguientes": "Next reviews",
 "Abrir la ubicación en Google Maps": "Open the location in Google Maps",
 "Mapa con la ubicación de AM Luxury Beauty Studio": "Map showing the location of AM Luxury Beauty Studio",
 "Cantidad de evaluaciones por estrellas": "Number of ratings by stars",
 "Información legal": "Legal information",
 "Café de cortesía y carta de bebidas": "Complimentary coffee and drinks menu",
 "carrusel": "carousel",
 "diapositiva": "slide",
 "Galería": "Gallery",
 "Nuestros trabajos": "Our work",
 "Mira de cerca el cuidado que ponemos en cada detalle": "See up close the care we put into every detail",
 "Ver trabajos": "See our work",
 "Filtrar por servicio": "Filter by service",
 "Galería de trabajos": "Work gallery",
 "Cerrar": "Close",
 "Foto anterior": "Previous photo",
 "Foto siguiente": "Next photo",
 "Ver precios y detalles": "See prices and details",
 "¿Qué formas de pago aceptan?": "What payment methods do you accept?",
 "Aceptamos dólares estadounidenses (USD), euros (EUR), dólares canadienses (CAD) y moneda nacional (CUP), al cambio del día con respecto al USD.": "We accept US dollars (USD), euros (EUR), Canadian dollars (CAD) and national currency (CUP), at the day's exchange rate against the USD.",
 "Añadir reseña": "Add a review",
 "Comparte tu experiencia en AM": "Share your experience at AM",
 "Cuéntanos cómo fue tu visita: el servicio, el lugar, las instalaciones y la atención. Tu reseña se publicará cuando la revisemos.": "Tell us about your visit: the service, the place, the facilities and the attention. Your review will be published once we review it.",
 "Foto de perfil (opcional)": "Profile photo (optional)",
 "Elegir foto": "Choose photo",
 "Quitar foto": "Remove photo",
 "JPG o PNG. Se mostrará en círculo.": "JPG or PNG. It will be shown as a circle.",
 "Nombre": "First name",
 "Apellidos": "Last name",
 "Solo mostraremos tu nombre y la inicial de tu apellido.": "We will only show your first name and the initial of your last name.",
 "Servicio que te hiciste": "Service you had",
 "Elige el servicio": "Choose the service",
 "Otro (visita al estudio)": "Other (visit to the studio)",
 "1 estrella": "1 star",
 "2 estrellas": "2 stars",
 "3 estrellas": "3 stars",
 "4 estrellas": "4 stars",
 "5 estrellas": "5 stars",
 "Tu reseña": "Your review",
 "Mínimo 20 caracteres.": "Minimum 20 characters.",
 "Acepto que AM Luxury Beauty Studio publique mi reseña con mi nombre y la inicial de mi apellido, y mi foto si la subí.": "I agree that AM Luxury Beauty Studio may publish my review with my first name and the initial of my last name, and my photo if I uploaded one.",
 "Progreso del envío": "Sending progress",
 "Enviar reseña": "Submit review",
 "Cancelar": "Cancel",
 "¡Gracias por compartir tu experiencia!": "Thank you for sharing your experience!",
 "Recibimos tu reseña. Se publicará en esta sección cuando la revisemos.": "We received your review. It will be published in this section once we review it.",
 "Cargando reseñas…": "Loading reviews…",
 "¿Ya viviste la experiencia AM?": "Have you lived the AM experience?",
 "Regálanos unas palabras: tu opinión nos inspira y ayuda a otras clientas a elegirnos.": "Give us a few words: your opinion inspires us and helps other clients choose us.",
 "Correo": "Email"
};
    var META_DESC_EN = "A space created for you, where elegance and wellbeing meet and every detail is designed to pamper you.";
    var DIAS = {lunes:'Monday',martes:'Tuesday','miércoles':'Wednesday',jueves:'Thursday',viernes:'Friday','sábado':'Saturday',domingo:'Sunday'};

    function norm(s){ return s.replace(/\s+/g,' ').trim(); }
    function has(o,k){ return Object.prototype.hasOwnProperty.call(o,k); }
    function tt(s){ var r = t(s); return r == null ? s : r; }
    var RX = [
      [/^Abierto ahora · hasta las (.+)$/, function(m){ return 'Open now · until ' + m[1]; }],
      [/^Cerramos pronto · hoy hasta las (.+)$/, function(m){ return 'Closing soon · open today until ' + m[1]; }],
      [/^Cerrado ahora · abrimos hoy a las (.+)$/, function(m){ return 'Closed now · we open today at ' + m[1]; }],
      [/^Cerrado ahora · abrimos mañana a las (.+)$/, function(m){ return 'Closed now · we open tomorrow at ' + m[1]; }],
      [/^Cerrado ahora · abrimos el (.+) a las (.+)$/, function(m){ return 'Closed now · we open on ' + (DIAS[m[1]] || m[1]) + ' at ' + m[2]; }],
      [/^(\d+) evaluaci(?:ón|ones)$/, function(m){ return m[1] + (m[1] === '1' ? ' rating' : ' ratings'); }],
      [/^Valoración media: (\d),(\d) de 5$/, function(m){ return 'Average rating: ' + m[1] + '.' + m[2] + ' out of 5'; }],
      [/^(\d+(?:–\d+)?) de (\d+)$/, function(m){ return m[1] + ' of ' + m[2]; }],
      [/^(\d) de 5 estrellas$/, function(m){ return m[1] + ' of 5 stars'; }],
      [/^Ir a la diapositiva (\d+)$/, function(m){ return 'Go to slide ' + m[1]; }],
      [/^¡Gracias por evaluarnos! Tu evaluación: (\d) de 5 estrellas\.$/, function(m){ return 'Thank you for rating us! Your rating: ' + m[1] + ' of 5 stars.'; }],
      [/^Elige de 1 a 5 estrellas\.$/, function(){ return 'Choose from 1 to 5 stars.'; }],
      [/^No se pudo guardar tu evaluación\. Inténtalo de nuevo en unos minutos\.(.*)$/, function(m){ return "We couldn't save your rating. Please try again in a few minutes." + m[1]; }],
      [/^Foto de perfil de (.+)$/, function(m){ return 'Profile photo of ' + tt(m[1]); }],
      [/^Precio: (\d+) dólares$/, function(m){ return 'Price: ' + m[1] + ' dollars'; }],
      [/^(\d),(\d)$/, function(m){ return m[1] + '.' + m[2]; }],
      [/^Reservar (.+)$/, function(m){ return 'Book ' + tt(m[1]); }],
      [/^Ver (.+)$/, function(m){ return 'View ' + tt(m[1]); }]
    ];
    function t(es){
      var k = norm(es);
      if (!k) return null;
      if (has(EN, k)) return EN[k];
      for (var i = 0; i < RX.length; i++){ var m = RX[i][0].exec(k); if (m) return RX[i][1](m); }
      return null;
    }

    var lang = 'es';
    var textOrig = new WeakMap(), attrOrig = new WeakMap(), hrefOrig = new WeakMap();
    var ATTRS = ['alt','aria-label','title','aria-roledescription'];
    var SKIP = {SCRIPT:1, STYLE:1, NOSCRIPT:1};

    function trText(node){
      var raw = node.nodeValue;
      if (!raw || !raw.trim()) return;
      var out = t(raw);
      if (out == null) return;
      textOrig.set(node, raw);
      node.nodeValue = raw.match(/^\s*/)[0] + out + raw.match(/\s*$/)[0];
    }
    function trAttr(el, a){
      var v = el.getAttribute(a);
      if (!v) return;
      var out = t(v);
      if (out == null) return;
      var o = attrOrig.get(el) || {}; o[a] = v; attrOrig.set(el, o);
      el.setAttribute(a, out);
    }
    function trTree(root){
      if (root.nodeType === 3){ trText(root); return; }
      if (root.nodeType !== 1 || SKIP[root.tagName]) return;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:function(n){
        return SKIP[n.parentNode.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }});
      var n; while ((n = w.nextNode())) trText(n);
      var els = [root].concat([].slice.call(root.querySelectorAll('[alt],[aria-label],[title],[aria-roledescription]')));
      els.forEach(function(el){ ATTRS.forEach(function(a){ if (el.hasAttribute(a)) trAttr(el, a); }); });
    }
    function restoreTree(){
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())){ if (textOrig.has(n)){ n.nodeValue = textOrig.get(n); textOrig.delete(n); } }
      [].slice.call(document.querySelectorAll('[alt],[aria-label],[title],[aria-roledescription]')).forEach(function(el){
        var o = attrOrig.get(el); if (!o) return;
        Object.keys(o).forEach(function(a){ el.setAttribute(a, o[a]); });
        attrOrig.delete(el);
      });
    }

    // Enlaces de WhatsApp: mensaje en el idioma elegido
    function waMsgEn(es){
      var m;
      if ((m = /^Hola, quiero reservar cita para (.+) en AM Luxury Beauty Studio\. ¿Qué horarios tienen disponibles\?$/.exec(es)))
        return 'Hello, I would like to book an appointment for ' + tt(m[1]) + ' at AM Luxury Beauty Studio. What times do you have available?';
      if (es === 'Hola, quiero reservar el Paquete Luxury Full Service en AM Luxury Beauty Studio. ¿Qué horarios tienen disponibles?')
        return 'Hello, I would like to book the Luxury Full Service Package at AM Luxury Beauty Studio. What times do you have available?';
      if (es === 'Hola, quiero reservar una cita en AM Luxury Beauty Studio.')
        return 'Hello, I would like to book an appointment at AM Luxury Beauty Studio.';
      if (es === 'Hola, tengo una duda sobre los servicios de AM Luxury Beauty Studio.')
        return 'Hello, I have a question about the services at AM Luxury Beauty Studio.';
      return es;
    }
    function waLinks(en){
      [].slice.call(document.querySelectorAll('a[href^="https://wa.me/"]')).forEach(function(a){
        if (!en){ if (hrefOrig.has(a)){ a.setAttribute('href', hrefOrig.get(a)); hrefOrig.delete(a); } return; }
        var h = hrefOrig.get(a) || a.getAttribute('href'), i = h.indexOf('?text=');
        if (i < 0) return;
        hrefOrig.set(a, h);
        try { a.setAttribute('href', h.slice(0, i + 6) + encodeURIComponent(waMsgEn(decodeURIComponent(h.slice(i + 6))))); } catch(e){}
      });
    }

    var metaDesc = document.querySelector('meta[name="description"]'), metaEs = metaDesc && metaDesc.getAttribute('content');

    var mo = new MutationObserver(function(list){
      if (lang !== 'en') return;
      list.forEach(function(m){
        if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') trAttr(m.target, m.attributeName);
        else [].forEach.call(m.addedNodes, trTree);
      });
    });

    function setLang(l, save){
      lang = l;
      document.documentElement.lang = l;
      [].forEach.call(document.querySelectorAll('.lang-switch [data-lang]'), function(b){
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l));
      });
      if (l === 'en'){
        trTree(document.body);
        if (TRADUCIR_WHATSAPP) waLinks(true);
        if (metaDesc) metaDesc.setAttribute('content', META_DESC_EN);
      } else {
        restoreTree();
        waLinks(false);
        if (metaDesc && metaEs) metaDesc.setAttribute('content', metaEs);
      }
      if (save){ try { localStorage.setItem('am_lang', l); } catch(e){} }
    }

    mo.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
    [].forEach.call(document.querySelectorAll('.lang-switch [data-lang]'), function(b){
      b.addEventListener('click', function(){ setLang(b.getAttribute('data-lang'), true); });
    });

    // Idioma inicial: ?lang=en en la dirección, o el último elegido; por defecto español
    var inicial = 'es';
    try { inicial = localStorage.getItem('am_lang') || 'es'; } catch(e){}
    var q = /[?&]lang=(en|es)\b/.exec(location.search);
    if (q) inicial = q[1];
    if (inicial === 'en') setLang('en', !!q);
  })();

  // ===== Reserva en línea =====
  // El cliente elige categoría(s), servicio(s), adicionales, día y hora, y envía la solicitud por el medio que prefiera.
  // Los textos del formulario están aquí, en pares {es, en}. Para cambiar un precio o un servicio edita la lista CATS.
  (function(){
    var root = document.getElementById('reservar-cita');
    if (!root) return;

    /* ---------- Configuración ---------- */
    var CFG = {
      phone: AM.PHONE,                     // WhatsApp y teléfono del estudio (sin el +); se define una sola vez en AM.PHONE
      phoneShow: '+' + AM.PHONE,
      address: 'Calle Coronel Verdugo, E/ Ave. 47 y 51, Edif. 15, Esc. 1307, Apto. 7, Brisas del Mar, Cárdenas, Matanzas',
      email: 'amluxury.beautystudio@gmail.com',                           // correo del estudio (provisional: cámbialo por el real). Si lo dejas vacío, las opciones de correo no se muestran
      instagram: 'amluxury_beautystudio',  // usuario de Instagram (para abrir el chat)
      endpoint: '',                        // mejor ponlo en reserva-config.js. URL del Apps Script de citas (termina en /exec). Vacío = no se muestra "Enviar desde esta página"
      days: [1,2,3,4,5],                   // días de atención: 1 = lunes … 5 = viernes
      open: 8, close: 18,                  // horario: 8:00 a 18:00
      step: 30,                            // minutos entre una hora y la siguiente
      leadDays: 1,                         // antelación mínima (días)
      horizonDays: 60,                     // hasta cuántos días adelante se puede reservar
      blockOverflow: true,                 // true = no ofrece horas en las que los servicios terminarían después del cierre
      tz: 'America/Havana'
    };

    /* ---------- Catálogo (precios y duraciones de la web) ---------- */
    // dur = minutos. group = servicios que no se pueden combinar entre sí. opts = variantes (técnica, set nuevo/retoque).
    // Ajustes propios que NO se pierden al actualizar el index: se escriben en reserva-config.js (endpoint, correo…)
    var EXT = window.AM_RESERVA || {};
    ['endpoint', 'email', 'phone', 'phoneShow', 'instagram', 'address'].forEach(function(k){
      if (typeof EXT[k] === 'string') CFG[k] = EXT[k].replace(/^\s+|\s+$/g, '');
    });

    var CATS = [
      {id:'manicura', es:'Manicura', en:'Manicure', ico:'img/ico-mani.webp', tone:'var(--rose)',
       svcs:[
         {id:'mani-std', es:'Manicura Estándar', en:'Standard Manicure', price:15, dur:135, group:'mani',
          optLabel:{es:'Técnica', en:'Technique'},
          opts:[{es:'Reforzamiento con Builder Gel', en:'Builder Gel reinforcement'}, {es:'Técnica Combinada', en:'Combined Technique'}]},
         {id:'mani-dual', es:'Dual System', en:'Dual System', price:18, dur:135, group:'mani'},
         {id:'mani-soft', es:'Softgel', en:'Softgel', price:17, dur:135, group:'mani'}
       ],
       extras:[
         {id:'mani-retiro', es:'Retiro de sistema (no hecho en AM)', en:'Removal of a system (not done at AM)', price:2},
         {id:'mani-deco', es:'Decoración adicional (más de 2 uñas)', en:'Additional decoration (more than 2 nails)', price:1},
         {id:'mani-jelly', es:'Jelly, tratamiento nutritivo', en:'Jelly, nourishing treatment', price:4},
         {id:'mani-paraf', es:'Parafina para hidratación intensiva', en:'Paraffin for intensive hydration', price:5}
       ]},
      {id:'manicura-spa', es:'Manicura SPA', en:'SPA Manicure', ico:'img/ico-mani-spa.webp', tone:'var(--rose)',
       svcs:[{id:'mspa', es:'Manicura SPA', en:'SPA Manicure', price:14, dur:60}],
       extras:[{id:'mspa-jelly', es:'Jelly, tratamiento nutritivo', en:'Jelly, nourishing treatment', price:4}]},
      {id:'pedicura', es:'Pedicura', en:'Pedicure', ico:'img/ico-pedi.webp', tone:'var(--sage)',
       svcs:[{id:'pedi', es:'Pedicura', en:'Pedicure', price:15, dur:90}],
       extras:[
         {id:'pedi-paraf', es:'Parafina para hidratación intensiva', en:'Paraffin for intensive hydration', price:6},
         {id:'pedi-cab', es:'Pedicura para caballeros', en:'Men\'s pedicure', price:10}
       ]},
      {id:'pedicura-spa', es:'Pedicura SPA', en:'SPA Pedicure', ico:'img/ico-pedi-spa.webp', tone:'var(--sage)',
       svcs:[{id:'pspa', es:'Pedicura SPA', en:'SPA Pedicure', price:18, dur:80}], extras:[]},
      {id:'pestanas', es:'Extensiones de pestañas', en:'Eyelash extensions', ico:'img/ico-pestanas.webp', tone:'var(--lilac)',
       svcs:[
         {id:'p2d', es:'2D YY', en:'2D YY', price:13, dur:150, group:'lash'},
         {id:'p3d', es:'3D', en:'3D', price:15, dur:150, group:'lash'},
         {id:'p4d', es:'4D', en:'4D', price:17, dur:150, group:'lash'},
         {id:'p5d', es:'5D', en:'5D', price:20, dur:150, group:'lash'},
         {id:'p6d', es:'6D', en:'6D', price:20, dur:150, group:'lash'}
       ],
       optAll:{label:{es:'Tipo de cita', en:'Appointment type'},
         list:[{es:'Set nuevo', en:'New set', dur:150}, {es:'Retoque', en:'Refill', dur:90}]},
       extras:[{id:'pest-retiro', es:'Retiro de extensiones de pestañas', en:'Eyelash extension removal', price:4}]},
      {id:'cejas', es:'Diseño de cejas', en:'Brow design', ico:'img/ico-cejas.webp', tone:'var(--lilac)',
       svcs:[
         {id:'c-lam', es:'Laminado + Diseño + Depilación', en:'Lamination + Design + Waxing', price:10, dur:60, group:'brow'},
         {id:'c-hen', es:'Henna + Diseño + Depilación', en:'Henna + Design + Waxing', price:10, dur:60, group:'brow'},
         {id:'c-dep', es:'Depilación de cejas + Diseño', en:'Brow waxing + Design', price:5, dur:60, group:'brow'},
         {id:'c-prem', es:'Laminado Premium', en:'Premium Lamination', price:16, dur:60, group:'brow'},
         {id:'c-bozo', es:'Depilación de bozo', en:'Upper-lip waxing', price:3, dur:60},
         {id:'c-barb', es:'Depilación de barbilla', en:'Chin waxing', price:4, dur:60}
       ], extras:[]},
      {id:'paquete', es:'Paquete Luxury Full Service', en:'Luxury Full Service Package', chip:{es:'Paquete Full Service', en:'Full Service Package'}, svg:'diamond', tone:'var(--peach)',
       // 365 = suma de manicura estándar + manicura SPA + pedicura + pedicura SPA. Ajústalo si se hacen a la vez.
       svcs:[{id:'full', es:'Paquete Luxury Full Service (manos y pies)', en:'Luxury Full Service Package (hands and feet)', price:50, dur:365}],
       extras:[]}
    ];
    var CAT = {}, SVC = {}, EXTRA = {};
    CATS.forEach(function(c){
      CAT[c.id] = c;
      c.svcs.forEach(function(s){ SVC[s.id] = s; s.cat = c; });
      c.extras.forEach(function(x){ EXTRA[x.id] = x; x.cat = c; });
    });

    /* ---------- Utilidades ---------- */
    var lang = AM.lang, L = AM.L;
    function nm(o){ return o[lang()]; }
    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function $(s, c){ return (c || root).querySelector(s); }
    function $$(s, c){ return [].slice.call((c || root).querySelectorAll(s)); }
    function pad(n){ return (n < 10 ? '0' : '') + n; }
    function usd(n){ return '$' + n + ' USD'; }
    var reduce = AM.reduce;
    var touch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

    var ICON = {
      mail:'<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>',
      copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      ig:'<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
      sms:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      send:'<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m8.8 15.2 2.2 2.2 4.4-4.6"/>',
      user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
      bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      printer:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      prev:'<polyline points="15 18 9 12 15 6"/>', next:'<polyline points="9 18 15 12 9 6"/>',
      wa:'<use href="#i-msg"/>', globe:'<use href="#i-globe"/>', clock:'<use href="#i-clock"/>', diamond:'<use href="#i-diamond"/>'
    };
    function ico(n){ return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[n] + '</svg>'; }

    /* ---------- Estado ---------- */
    var sel = {cats:{}, svc:{}, extra:{}, optAll:{}, date:'', time:null};   // time: minutos desde las 0:00, o 'any'
    var cal = {y:0, m:0};

    /* ---------- Fechas (siempre en hora de Cuba) ---------- */
    function todayUTC(){
      var y, m, d;
      try {
        var p = new Intl.DateTimeFormat('en-CA', {timeZone:CFG.tz, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
        p.forEach(function(x){ if (x.type === 'year') y = +x.value; if (x.type === 'month') m = +x.value; if (x.type === 'day') d = +x.value; });
      } catch(e){}
      if (!y){ var n = new Date(); y = n.getFullYear(); m = n.getMonth() + 1; d = n.getDate(); }
      return Date.UTC(y, m - 1, d);
    }
    function isOpenDay(t){ return CFG.days.indexOf(new Date(t).getUTCDay()) >= 0; }
    function iso(t){ var d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    function fromIso(s){ var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
    var DAY = 864e5, MIN_T, MAX_T;
    function setRange(){
      var t = todayUTC() + CFG.leadDays * DAY;
      while (!isOpenDay(t)) t += DAY;
      MIN_T = t; MAX_T = todayUTC() + CFG.horizonDays * DAY;
    }
    function loc(){ return lang() === 'en' ? 'en-US' : 'es-ES'; }
    function fmt(t, o){ o.timeZone = 'UTC'; try { return new Intl.DateTimeFormat(loc(), o).format(new Date(t)); } catch(e){ return iso(t); } }
    function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
    function fullDate(t){ return fmt(t, {weekday:'long', day:'numeric', month:'long', year:'numeric'}); }
    function hm(min){
      var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
      return h12 + ':' + pad(m) + ' ' + ap;
    }
    function fmtDur(min){
      var h = Math.floor(min / 60), m = min % 60;
      return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
    }

    /* ---------- Cálculo de la selección ---------- */
    function optOf(s){
      var i = sel.svc[s.id] ? (sel.svc[s.id].opt || 0) : 0;
      if (s.opts) return s.opts[i] || s.opts[0];
      if (s.cat.optAll) return s.cat.optAll.list[sel.optAll[s.cat.id] || 0];
      return null;
    }
    function totals(){
      var items = [], extras = [], total = 0, dur = 0;
      CATS.forEach(function(c){
        if (!sel.cats[c.id]) return;
        var catDur = 0, any = false;
        c.svcs.forEach(function(s){
          if (!sel.svc[s.id]) return;
          any = true;
          var o = optOf(s), d = (o && o.dur) || s.dur || 0;
          if (d > catDur) catDur = d;
          total += s.price;
          items.push({s:s, o:o});
        });
        if (!any) return;
        c.extras.forEach(function(x){ if (sel.extra[x.id]){ total += x.price; extras.push(x); } });
        dur += catDur;
      });
      return {items:items, extras:extras, total:total, dur:dur};
    }

    /* ---------- Estructura ---------- */
    function sumHead(){
      return '<div class="bk-sum-h"><h4>' + L('Tu cita en AM Luxury Beauty Studio', 'Your appointment at AM Luxury Beauty Studio') + '</h4>' +
        '<div class="bk-sum-btns"><button type="button" class="bk-print" data-print>' + ico('printer') + L('Imprimir', 'Print') + '</button>' +
        '<button type="button" class="bk-print" data-pdf>' + ico('download') + L('Guardar PDF', 'Save PDF') + '</button></div></div>';
    }
    function shell(){
      root.innerHTML =
        '<div class="bk-head">' +
          '<span class="bk-badge" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="8" width="30" height="34" rx="4"/><path d="M16 4v8M24 4v8M32 4v8M9 18h30"/><path d="M17 30l4.5 4.5L31 25"/></svg></span>' +
          '<h3 id="bk-title" tabindex="-1">' + L('Reserva tu cita en línea', 'Book your appointment online') + '</h3>' +
          '<div class="faq-divider" aria-hidden="true"><i></i><span class="gem"></span><i></i></div>' +
          '<p class="quote">' + L('Elige tus servicios, el día y la hora. Te confirmaremos la disponibilidad.', 'Choose your services, day and time. We\'ll confirm availability.') + '</p>' +
        '</div>' +
        '<div class="bk-layout">' +
        '<form class="bk-form" id="bk-form" novalidate>' +
          '<fieldset class="bk-step" id="bk-s1">' +
            '<legend><span class="bk-num" aria-hidden="true">1</span>' + L('Elige tus servicios', 'Choose your services') + '</legend>' +
            '<p class="bk-hint">' + L('Toca una o varias categorías y marca los servicios que quieres.', 'Tap one or more categories and tick the services you want.') + '</p>' +
            '<div class="bk-cats" id="bk-cats" role="group" aria-label="' + L('Categorías', 'Categories') + '"></div>' +
            '<div class="bk-panels" id="bk-panels"></div>' +
            '<p class="bk-err" id="err-svc" role="alert" hidden></p>' +
          '</fieldset>' +
          '<fieldset class="bk-step" id="bk-s2">' +
            '<legend><span class="bk-num" aria-hidden="true">2</span>' + L('Elige el día y la hora', 'Choose the day and time') + '</legend>' +
            '<p class="bk-hint">' + L('Atendemos de lunes a viernes, de 8:00 AM a 6:00 PM (hora de Cuba). Reserva con al menos un día de antelación.',
              'We\'re open Monday to Friday, 8:00 AM to 6:00 PM (Cuba time). Book at least one day in advance.') + '</p>' +
            '<div class="bk-when">' +
              '<div><p class="bk-label" id="bk-day-l">' + L('Día', 'Day') + '</p><div class="bk-cal" id="bk-cal" role="group" aria-labelledby="bk-day-l"></div>' +
                '<p class="bk-err" id="err-date" role="alert" hidden></p></div>' +
              '<div><p class="bk-label" id="bk-time-l">' + L('Hora de inicio', 'Start time') + '</p>' +
                '<div class="bk-times" id="bk-times" role="radiogroup" aria-labelledby="bk-time-l"></div>' +
                '<p class="bk-note" id="bk-time-note"></p>' +
                '<p class="bk-err" id="err-time" role="alert" hidden></p></div>' +
            '</div>' +
            '<div class="bk-field"><label for="bk-alt">' + L('Otro día u hora que también te sirva', 'Another day or time that also works for you') + ' <span class="opt">' + L('(opcional)', '(optional)') + '</span></label>' +
              '<input type="text" id="bk-alt" name="alternativa" maxlength="120" autocomplete="off"></div>' +
          '</fieldset>' +
          '<fieldset class="bk-step" id="bk-s3">' +
            '<legend><span class="bk-num" aria-hidden="true">3</span>' + L('Tus datos', 'Your details') + '</legend>' +
            '<div class="bk-fields">' +
              '<div class="bk-field"><label for="bk-name">' + L('Nombre y apellido', 'Full name') + '</label>' +
                '<div class="bk-inp">' + ico('user') + '<input type="text" id="bk-name" name="nombre" autocomplete="name" maxlength="80" aria-describedby="err-name"></div><p class="bk-err" id="err-name" role="alert" hidden></p></div>' +
              '<div class="bk-field"><label for="bk-phone">' + L('Teléfono o WhatsApp', 'Phone or WhatsApp') + '</label>' +
                '<div class="bk-inp">' + ico('phone') + '<input type="tel" id="bk-phone" name="telefono" autocomplete="tel" inputmode="tel" maxlength="30" aria-describedby="err-phone"></div><p class="bk-err" id="err-phone" role="alert" hidden></p></div>' +
              '<div class="bk-field"><label for="bk-mail">' + L('Correo electrónico', 'Email') + ' <span class="opt">' + L('(opcional)', '(optional)') + '</span></label>' +
                '<div class="bk-inp">' + ico('mail') + '<input type="email" id="bk-mail" name="correo" autocomplete="email" maxlength="100" aria-describedby="err-mail"></div><p class="bk-err" id="err-mail" role="alert" hidden></p></div>' +
              '<div class="bk-field"><label for="bk-people">' + L('Número de personas', 'Number of people') + '</label>' +
                '<div class="bk-inp">' + ico('users') + '<select id="bk-people" name="personas"></select></div></div>' +
              '<div class="bk-field wide"><label for="bk-how">' + L('¿Cómo prefieres que te confirmemos?', 'How would you like us to confirm?') + '</label>' +
                '<div class="bk-inp">' + ico('bell') + '<select id="bk-how" name="confirmar"></select></div></div>' +
              '<div class="bk-field wide"><label for="bk-notes">' + L('Comentarios', 'Comments') + ' <span class="opt">' + L('(opcional)', '(optional)') + '</span></label>' +
                '<textarea id="bk-notes" name="comentarios" maxlength="400" placeholder="' + L('Un diseño en particular, si es tu primera visita…', 'A particular design, if it\'s your first visit…') + '"></textarea></div>' +
              '<div class="bk-field wide"><label class="bk-consent"><input type="checkbox" id="bk-ok" aria-describedby="err-ok"><span>' +
                L('Acepto que AM Luxury Beauty Studio use estos datos solo para gestionar mi cita. Más información en la <a href="politica-de-privacidad.html" target="_blank" rel="noopener">Política de Privacidad</a>.',
                  'I agree that AM Luxury Beauty Studio uses these details only to manage my appointment. More information in the <a href="politica-de-privacidad.html" target="_blank" rel="noopener">Privacy Policy</a>.') +
                '</span></label><p class="bk-err" id="err-ok" role="alert" hidden></p></div>' +
            '</div>' +
            '<input type="text" class="bk-trap" id="bk-web" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '</fieldset>' +
          '<fieldset class="bk-step" id="bk-s4">' +
            '<legend><span class="bk-num" aria-hidden="true">4</span>' + L('Envía tu solicitud', 'Send your request') + '</legend>' +
            '<div class="bk-mini">' + sumHead() + '<div data-sum></div></div>' +
            '<p class="bk-hint">' + L('Elige cómo quieres enviarla. No necesitas tener WhatsApp: si una opción no se abre, usa otra o copia el mensaje.',
              'Choose how to send it. You don\'t need WhatsApp: if an option doesn\'t open, use another one or copy the message.') + '</p>' +
            '<div class="bk-send" id="bk-send"></div>' +
            '<button type="button" class="bk-more" id="bk-more" data-more aria-controls="bk-send"></button>' +
            '<div class="bk-prog" id="bk-prog" role="progressbar" aria-label="' + L('Progreso del envío', 'Sending progress') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><p class="bk-prog-txt" id="bk-prog-txt"></p><div class="bk-prog-track"><span id="bk-prog-bar"></span></div></div>' +
            '<p class="bk-status" id="bk-status" role="status" aria-live="polite"></p>' +
            '<details class="bk-preview"><summary>' + L('Ver el mensaje que se enviará', 'See the message that will be sent') + '</summary>' +
              '<textarea id="bk-msg" readonly aria-label="' + L('Mensaje de la solicitud', 'Request message') + '"></textarea></details>' +
            '<p class="bk-call">' + L('¿Prefieres hablar con nosotras? Llámanos al ', 'Prefer to talk? Call us at ') + '<a href="tel:+' + CFG.phone + '">' + CFG.phoneShow + '</a>.</p>' +
          '</fieldset>' +
        '</form>' +
        '<aside class="bk-summary" aria-label="' + L('Resumen de tu cita', 'Your appointment summary') + '">' + sumHead() + '<div data-sum></div></aside>' +
        '</div>';
      fillSelects();
      renderCats(); renderPanels(); renderCal(); renderTimes(); renderChannels(); renderSummary();
    }

    function fillSelects(){
      var p = $('#bk-people'), h = $('#bk-how'), i, o = '';
      for (i = 1; i <= 8; i++) o += '<option value="' + i + '"' + (i === peopleVal ? ' selected' : '') + '>' + i + '</option>';
      p.innerHTML = o;
      var ways = [['wa','WhatsApp','WhatsApp'], ['call','Llamada telefónica','Phone call'], ['mail','Correo electrónico','Email'], ['sms','SMS','SMS']];
      h.innerHTML = ways.map(function(w){ return '<option value="' + w[0] + '"' + (w[0] === howVal ? ' selected' : '') + '>' + L(w[1], w[2]) + '</option>'; }).join('');
    }
    var peopleVal = 1, howVal = 'wa';

    /* ---------- Categorías y servicios ---------- */
    function renderCats(){
      $('#bk-cats').innerHTML = CATS.map(function(c){
        var icon = c.ico ? '<img src="' + c.ico + '" alt="" width="66" height="68" loading="lazy">' : ico(c.svg);
        return '<button type="button" class="bk-cat" data-cat="' + c.id + '" aria-pressed="' + (!!sel.cats[c.id]) + '" style="--tone:' + c.tone + '">' + icon + '<span>' + esc(nm(c.chip || c)) + '</span></button>';
      }).join('');
    }
    function catDurText(c){
      if (c.optAll) return '';
      var m = 0; c.svcs.forEach(function(s){ if (s.dur > m) m = s.dur; });
      return L('Duración aprox. ', 'Approx. duration ') + fmtDur(m);
    }
    function renderPanels(){
      $('#bk-panels').innerHTML = CATS.filter(function(c){ return sel.cats[c.id]; }).map(function(c){
        var icon = c.ico ? '<img src="' + c.ico + '" alt="" width="66" height="68">' : ico(c.svg);
        var h = '<section class="bk-panel" data-panel="' + c.id + '" style="--tone:' + c.tone + '" aria-labelledby="bk-p-' + c.id + '">' +
          '<div class="bk-panel-h"><h4 id="bk-p-' + c.id + '">' + icon + esc(nm(c)) + '</h4>';
        var dt = catDurText(c);
        if (dt) h += '<span class="bk-dur">' + ico('clock') + dt + '</span>';
        h += '</div><div class="bk-opts">';
        c.svcs.forEach(function(s){
          var on = !!sel.svc[s.id];
          h += '<div><label class="bk-opt"><input type="checkbox" data-svc="' + s.id + '"' + (on ? ' checked' : '') + '><span class="bk-opt-n">' + esc(nm(s)) + '</span><span class="bk-opt-p">' + usd(s.price) + '</span></label>';
          if (s.opts){
            h += '<div class="bk-var"' + (on ? '' : ' hidden') + '><label>' + esc(nm(s.optLabel)) + ' <select data-opt="' + s.id + '">' +
              s.opts.map(function(o, i){ return '<option value="' + i + '"' + ((sel.svc[s.id] && sel.svc[s.id].opt === i) ? ' selected' : '') + '>' + esc(nm(o)) + '</option>'; }).join('') + '</select></label></div>';
          }
          h += '</div>';
        });
        h += '</div>';
        if (c.optAll){
          var anyOn = c.svcs.some(function(s){ return sel.svc[s.id]; });
          h += '<div class="bk-var" data-optall="' + c.id + '"' + (anyOn ? '' : ' hidden') + '><label>' + esc(nm(c.optAll.label)) + ' <select data-optall-sel="' + c.id + '">' +
            c.optAll.list.map(function(o, i){ return '<option value="' + i + '"' + ((sel.optAll[c.id] || 0) === i ? ' selected' : '') + '>' + esc(nm(o)) + ' (' + fmtDur(o.dur) + ')</option>'; }).join('') + '</select></label></div>';
        }
        if (c.extras.length){
          h += '<p class="bk-sub">' + L('Servicios adicionales (opcional)', 'Additional services (optional)') + '</p><div class="bk-opts">';
          c.extras.forEach(function(x){
            h += '<label class="bk-opt"><input type="checkbox" data-extra="' + x.id + '"' + (sel.extra[x.id] ? ' checked' : '') + '><span class="bk-opt-n">' + esc(nm(x)) + '</span><span class="bk-opt-p">+ ' + usd(x.price) + '</span></label>';
          });
          h += '</div>';
        }
        return h + '</section>';
      }).join('');
    }

    /* ---------- Calendario ---------- */
    function renderCal(){
      var y = cal.y, m = cal.m, first = Date.UTC(y, m, 1), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var h = '<div class="bk-cal-h"><button type="button" class="bk-cal-nav" data-nav="-1" aria-label="' + L('Mes anterior', 'Previous month') + '">' + ico('prev') + '</button>' +
        '<div class="bk-cal-m" aria-live="polite">' + cap(fmt(first, {month:'long', year:'numeric'})) + '</div>' +
        '<button type="button" class="bk-cal-nav" data-nav="1" aria-label="' + L('Mes siguiente', 'Next month') + '">' + ico('next') + '</button></div><div class="bk-grid">';
      var i;
      for (i = 0; i < 5; i++) h += '<div class="bk-wd" aria-hidden="true">' + fmt(Date.UTC(2024, 0, 1 + i), {weekday:'short'}).replace('.', '') + '</div>';
      var cells = 0, d, t, dow;
      for (d = 1; d <= dim; d++){
        t = Date.UTC(y, m, d); dow = new Date(t).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        if (!cells){ for (i = 0; i < (dow + 6) % 7; i++){ h += '<div></div>'; cells++; } }
        var off = t < MIN_T || t > MAX_T || !isOpenDay(t);
        h += '<button type="button" class="bk-day" data-date="' + iso(t) + '" aria-pressed="' + (sel.date === iso(t)) + '" aria-label="' + esc(fullDate(t)) + '"' + (off ? ' disabled' : '') + '>' + d + '</button>';
        cells++;
      }
      while (cells % 5){ h += '<div></div>'; cells++; }
      $('#bk-cal').innerHTML = h + '</div>';
      var prev = $('[data-nav="-1"]'), next = $('[data-nav="1"]');
      var minM = new Date(MIN_T), maxM = new Date(MAX_T);
      prev.disabled = (y === minM.getUTCFullYear() && m <= minM.getUTCMonth()) || y < minM.getUTCFullYear();
      next.disabled = (y === maxM.getUTCFullYear() && m >= maxM.getUTCMonth()) || y > maxM.getUTCFullYear();
    }

    /* ---------- Horas ---------- */
    function renderTimes(){
      var dur = totals().dur, closeMin = CFG.close * 60, list = [], t, fits = 0;
      for (t = CFG.open * 60; t < closeMin; t += CFG.step){
        var ok = !(CFG.blockOverflow && dur && t + dur > closeMin);
        if (ok) fits++;
        list.push({t:t, ok:ok});
      }
      var relax = !fits;                       // ninguna hora alcanza: se muestran todas y se avisa
      if (typeof sel.time === 'number'){
        var cur = list.filter(function(x){ return x.t === sel.time; })[0];
        if (cur && !cur.ok && !relax) sel.time = null;
      }
      $('#bk-times').innerHTML = list.map(function(x){
        var dis = !x.ok && !relax;
        return '<label class="bk-time"><input type="radio" name="hora" value="' + x.t + '"' + (sel.time === x.t ? ' checked' : '') + (dis ? ' disabled' : '') + '><span>' + hm(x.t) + '</span></label>';
      }).join('') +
        '<label class="bk-time any"><input type="radio" name="hora" value="any"' + (sel.time === 'any' ? ' checked' : '') + '><span>' + L('Cualquier hora', 'Any time') + '</span></label>';
      var note = '';
      if (relax) note = L('Con los servicios elegidos la duración (' + fmtDur(dur) + ') supera un día de atención. Elige la hora que prefieras y te proponemos cómo repartirla.',
        'The chosen services (' + fmtDur(dur) + ') are longer than one day. Pick the time you prefer and we\'ll suggest how to split it.');
      else if (dur) note = L('Duración aprox. de tu cita: ' + fmtDur(dur) + '. Solo mostramos horas en las que terminarías antes del cierre.',
        'Approx. length of your appointment: ' + fmtDur(dur) + '. We only show start times that end before closing.');
      else note = L('Elige tus servicios para ver las horas en las que puedes terminar antes del cierre.', 'Choose your services to see the start times that end before closing.');
      $('#bk-time-note').textContent = note;
    }

    /* ---------- Resumen ---------- */
    function renderSummary(){
      var T = totals(), h = '';
      if (!T.items.length){
        h = '<p class="bk-empty">' + L('Aún no has elegido servicios. Empieza por una categoría.', 'You haven\'t chosen any services yet. Start with a category.') + '</p>';
      } else {
        h = '<ul class="bk-lines">';
        T.items.forEach(function(it){
          h += '<li><span>' + esc(nm(it.s)) + (it.o && (it.s.opts || it.s.cat.optAll) ? '<small>' + esc(nm(it.o)) + '</small>' : '') + '</span><span class="p">' + usd(it.s.price) + '</span></li>';
        });
        T.extras.forEach(function(x){
          h += '<li><span>' + esc(nm(x)) + '<small>' + L('Adicional', 'Additional') + '</small></span><span class="p">+ ' + usd(x.price) + '</span></li>';
        });
        h += '</ul><dl class="bk-facts">';
        h += '<div><dt>' + L('Día', 'Day') + '</dt><dd>' + (sel.date ? esc(fmt(fromIso(sel.date), {weekday:'long', day:'numeric', month:'long'})) : L('Sin elegir', 'Not chosen')) + '</dd></div>';
        var tl = sel.time === 'any' ? L('Cualquier hora', 'Any time') : (typeof sel.time === 'number' ? hm(sel.time) : L('Sin elegir', 'Not chosen'));
        h += '<div><dt>' + L('Hora', 'Time') + '</dt><dd>' + tl + '</dd></div>';
        if (T.dur) h += '<div><dt>' + L('Duración aprox.', 'Approx. length') + '</dt><dd>' + fmtDur(T.dur) + '</dd></div>';
        if (peopleVal > 1) h += '<div><dt>' + L('Personas', 'People') + '</dt><dd>' + peopleVal + '</dd></div>';
        h += '</dl><p class="bk-total"><span>' + L('Total estimado', 'Estimated total') + '</span><b>' + usd(T.total) + '</b></p>' +
          '<p class="bk-fine">' + L(peopleVal > 1 ? 'El total es por persona. El precio final se confirma en el estudio.' : 'El precio final se confirma en el estudio.',
            peopleVal > 1 ? 'The total is per person. The final price is confirmed at the studio.' : 'The final price is confirmed at the studio.') + '</p>';
      }
      $$('[data-sum]').forEach(function(n){ n.innerHTML = h; });
      $$('[data-print],[data-pdf]').forEach(function(b){ b.disabled = !T.items.length; });
    }

    /* ---------- Mensaje ---------- */
    function data(){
      return {
        name: $('#bk-name').value.trim(), phone: $('#bk-phone').value.trim(), mail: $('#bk-mail').value.trim(),
        notes: $('#bk-notes').value.trim(), alt: $('#bk-alt').value.trim(), people: peopleVal, how: howVal
      };
    }
    function howLabel(v){ return {wa:'WhatsApp', call:L('Llamada telefónica', 'Phone call'), mail:L('Correo electrónico', 'Email'), sms:'SMS'}[v]; }
    function build(bold){
      var T = totals(), d = data(), b = function(s){ return bold ? '*' + s + '*' : s; }, out = [];
      out.push(L('Hola, quiero solicitar una cita en AM Luxury Beauty Studio.', 'Hello, I would like to request an appointment at AM Luxury Beauty Studio.'), '');
      out.push(b(L('Servicios', 'Services')) + ':');
      T.items.forEach(function(it){
        out.push('- ' + nm(it.s) + (it.o && (it.s.opts || it.s.cat.optAll) ? ' (' + nm(it.o) + ')' : '') + ' - ' + usd(it.s.price));
      });
      T.extras.forEach(function(x){ out.push('- ' + nm(x) + ' (' + L('adicional', 'additional') + ') - ' + usd(x.price)); });
      out.push('');
      out.push(b(L('Día', 'Day')) + ': ' + (sel.date ? cap(fullDate(fromIso(sel.date))) : '-'));
      var end = '';
      if (typeof sel.time === 'number' && T.dur) end = ' (' + L('termina sobre las ', 'ends around ') + hm(sel.time + T.dur) + ')';
      out.push(b(L('Hora', 'Time')) + ': ' + (sel.time === 'any' ? L('Cualquier hora (a coordinar)', 'Any time (to be arranged)') : hm(sel.time)) + end);
      if (T.dur) out.push(b(L('Duración aprox.', 'Approx. length')) + ': ' + fmtDur(T.dur));
      out.push(b(L('Personas', 'People')) + ': ' + d.people);
      if (d.alt) out.push(b(L('Otra opción que me sirve', 'Another option that works')) + ': ' + d.alt);
      out.push('', b(L('Nombre', 'Name')) + ': ' + d.name, b(L('Teléfono', 'Phone')) + ': ' + d.phone);
      if (d.mail) out.push(b(L('Correo', 'Email')) + ': ' + d.mail);
      out.push(b(L('Prefiero que me confirmen por', 'Please confirm by')) + ': ' + howLabel(d.how));
      if (d.notes) out.push(b(L('Comentarios', 'Comments')) + ': ' + d.notes);
      out.push('', b(L('Total estimado', 'Estimated total')) + ': ' + usd(T.total) + (d.people > 1 ? ' ' + L('por persona', 'per person') : ''));
      return out.join('\n');
    }
    function subject(){ return L('Solicitud de cita - ', 'Appointment request - ') + data().name; }
    function refreshPreview(){ var m = $('#bk-msg'); if (m) m.value = ready() ? build(false) : ''; }
    function ready(){ return totals().items.length && sel.date && sel.time !== null && data().name; }

    /* ---------- Validación ---------- */
    function setErr(id, msg, ctl){
      var e = $('#' + id); if (!e) return;
      e.textContent = msg || ''; e.hidden = !msg;
      if (ctl) { if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
    }
    function clearErr(id, ctl){ setErr(id, '', ctl); }
    function validate(){
      var bad = null, T = totals();
      function fail(el){ if (!bad) bad = el; }
      var lack = CATS.filter(function(c){ return sel.cats[c.id] && !c.svcs.some(function(s){ return sel.svc[s.id]; }); })[0];
      if (!T.items.length){ setErr('err-svc', L('Elige al menos un servicio.', 'Choose at least one service.')); fail($('.bk-cat')); }
      else if (lack){ setErr('err-svc', L('Marca un servicio en ' + lack.es + ' o quita esa categoría.', 'Tick a service in ' + lack.en + ' or remove that category.')); fail($('[data-panel="' + lack.id + '"] input')); }
      else clearErr('err-svc');
      if (!sel.date){ setErr('err-date', L('Elige un día.', 'Choose a day.')); fail($('.bk-day:not(:disabled)')); } else clearErr('err-date');
      if (sel.time === null){ setErr('err-time', L('Elige una hora.', 'Choose a time.')); fail($('input[name="hora"]:not(:disabled)')); } else clearErr('err-time');
      var n = $('#bk-name'), p = $('#bk-phone'), m = $('#bk-mail'), ok = $('#bk-ok'), digits = p.value.replace(/\D/g, '');
      if (n.value.trim().length < 2){ setErr('err-name', L('Escribe tu nombre.', 'Enter your name.'), n); fail(n); } else clearErr('err-name', n);
      if (digits.length < 7 || digits.length > 15){ setErr('err-phone', L('Escribe un teléfono válido, por ejemplo +53 5xxx xxxx.', 'Enter a valid phone number, e.g. +53 5xxx xxxx.'), p); fail(p); } else clearErr('err-phone', p);
      var mv = m.value.trim();
      if (mv && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mv)){ setErr('err-mail', L('Revisa el correo: parece incompleto.', 'Check the email: it looks incomplete.'), m); fail(m); }
      else if (howVal === 'mail' && !mv){ setErr('err-mail', L('Escribe tu correo para que te confirmemos por ahí.', 'Enter your email so we can confirm there.'), m); fail(m); }
      else clearErr('err-mail', m);
      if (!ok.checked){ setErr('err-ok', L('Acepta el uso de tus datos para continuar.', 'Please accept the use of your details to continue.'), ok); fail(ok); } else clearErr('err-ok', ok);
      if (bad){
        try { bad.focus({preventScroll:true}); bad.scrollIntoView({block:'center', behavior:reduce ? 'auto' : 'smooth'}); } catch(e){}
        status(L('Revisa los campos marcados para continuar.', 'Please check the highlighted fields to continue.'), true);
        return false;
      }
      status('');
      return true;
    }
    function status(msg, bad, extra){
      var s = $('#bk-status'); if (!s) return;
      s.className = 'bk-status' + (bad ? ' bad' : '');
      s.textContent = msg || '';
      if (extra) s.appendChild(extra);
    }
    /* Progreso del envío: la barra avanza mientras se procesa y llega al 100 % al terminar */
    var progT = null, progV = 0, progTok = 0, busy = false;
    function setBusy(v){ busy = v; Array.prototype.forEach.call($$('.bk-ch'), function(b){ b.disabled = v; }); }
    function progress(state, msg){
      clearInterval(progT);
      var p = $('#bk-prog'), bar = $('#bk-prog-bar'), tx = $('#bk-prog-txt');
      if (!p || !bar || !tx) return;
      if (state === 'off'){ p.hidden = true; p.classList.remove('is-done'); bar.style.width = '0'; return; }
      if (state === 'start'){
        status('');
        progV = 6; p.hidden = false; p.classList.remove('is-done');
        tx.textContent = msg || ''; bar.style.width = progV + '%'; p.setAttribute('aria-valuenow', progV);
        progT = setInterval(function(){
          progV += (92 - progV) * 0.07;
          bar.style.width = progV.toFixed(1) + '%'; p.setAttribute('aria-valuenow', Math.round(progV));
        }, 250);
        return;
      }
      if (msg) tx.textContent = msg;                        // 'done'
      p.classList.add('is-done'); bar.style.width = '100%'; p.setAttribute('aria-valuenow', 100);
    }

    /* ---------- Canales de envío ---------- */
    function channels(){
      var a = [];
      if (CFG.endpoint) a.push({id:'web', primary:true, ico:'send', t:L('Enviar desde esta página', 'Send from this page'), d:L('Sin abrir ninguna aplicación. Te respondemos para confirmar.', 'No app needed. We\'ll reply to confirm.')});
      a.push({id:'wa', ico:'wa', t:'WhatsApp', d:L('Abre la aplicación con el mensaje listo', 'Opens the app with the message ready')});
      a.push({id:'waweb', ico:'globe', t:'WhatsApp Web', d:L('Desde el navegador de tu computadora', 'From your computer\'s browser')});
      if (CFG.email){
        a.push({id:'gmail', ico:'mail', t:'Gmail', d:L('Abre un correo nuevo en Gmail', 'Opens a new email in Gmail')});
        a.push({id:'outlook', ico:'mail', t:'Outlook', d:L('Abre un correo nuevo en Outlook', 'Opens a new email in Outlook')});
        a.push({id:'mailto', ico:'mail', t:L('Otra app de correo', 'Other mail app'), d:L('Usa el programa de correo de tu equipo', 'Uses your device\'s mail program')});
      }
      a.push({id:'ig', ico:'ig', t:'Instagram', d:L('Copiamos tu mensaje y abrimos el chat', 'We copy your message and open the chat')});
      if (touch) a.push({id:'sms', ico:'sms', t:'SMS', d:L('Mensaje de texto desde tu móvil', 'Text message from your phone')});
      a.push({id:'copy', ico:'copy', t:L('Copiar el mensaje', 'Copy the message'), d:L('Pégalo donde prefieras', 'Paste it wherever you like')});
      var order = ['web', 'wa', 'gmail', 'ig', 'waweb', 'copy', 'outlook', 'mailto', 'sms'];
      a.sort(function(x, y){ return order.indexOf(x.id) - order.indexOf(y.id); });
      return a;
    }
    var chShown = 2;                      // opciones visibles: empiezan 2 y cada clic en "Ver más" muestra 2 más
    function renderChannels(){
      var list = channels(), n = Math.min(chShown, list.length);
      if (!CFG.endpoint && window.console && !renderChannels.warned){ renderChannels.warned = true; console.info('Reservas: no aparece "Enviar desde esta página" porque falta endpoint en reserva-config.js'); }
      $('#bk-send').innerHTML = list.slice(0, n).map(function(c){
        return '<button type="button" class="bk-ch' + (c.primary ? ' primary' : '') + '" data-ch="' + c.id + '"><span class="bk-ch-i">' + ico(c.ico) + '</span><span class="bk-ch-t"><b>' + esc(c.t) + '</b><small>' + esc(c.d) + '</small></span></button>';
      }).join('');
      if (!CFG.endpoint && AM.debug) $('#bk-send').insertAdjacentHTML('beforeend', '<p style="margin:.4rem 0 0;font-size:.85rem;color:#B4415A">[debug] "Enviar desde esta página" no aparece: falta <b>endpoint</b> en reserva-config.js</p>');
      var more = $('#bk-more');
      if (!more) return;
      more.hidden = list.length <= 2;
      var rest = list.length - n;
      more.textContent = rest > 0 ? L('Ver más opciones', 'See more options') + ' (' + rest + ')' : L('Ver menos opciones', 'See fewer options');
      more.setAttribute('aria-expanded', String(rest <= 0));
    }
    function copyText(txt){
      return new Promise(function(res){
        function legacy(){
          var t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
          document.body.appendChild(t); t.select();
          var ok = false; try { ok = document.execCommand('copy'); } catch(e){}
          document.body.removeChild(t); res(ok);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ res(true); }, legacy);
        else legacy();
      });
    }
    // Abre un enlace en otra pestaña. Si el navegador bloquea la ventana, ofrece un botón para abrirla (sin perder el formulario)
    function launch(u, okMsg){
      var w = null;
      try { w = window.open(u, '_blank'); } catch(e){}
      if (w){ try { w.opener = null; } catch(e2){} status(okMsg); return; }
      var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn btn-ghost'; a.textContent = L('Abrir ahora', 'Open now');
      status(L('Tu navegador bloqueó la ventana nueva. Pulsa el botón para abrirla.', 'Your browser blocked the new window. Press the button to open it.'), true, a);
    }
    function payload(){
      var T = totals(), d = data();
      return {
        tipo:'cita', idioma:lang(), nombre:d.name, telefono:d.phone, correo:d.mail, personas:d.people, confirmar:howLabel(d.how),
        servicios:T.items.map(function(it){ return it.s.es + (it.o && (it.s.opts || it.s.cat.optAll) ? ' (' + it.o.es + ')' : ''); }),
        adicionales:T.extras.map(function(x){ return x.es; }),
        fecha:sel.date, hora:sel.time === 'any' ? 'Cualquier hora' : hm(sel.time), duracion:T.dur ? fmtDur(T.dur) : '',
        alternativa:d.alt, comentarios:d.notes, total:T.total, mensaje:build(false)
      };
    }
    function reset(){
      sel = {cats:{}, svc:{}, extra:{}, optAll:{}, date:'', time:null}; peopleVal = 1; howVal = 'wa'; chShown = 2;
      shell(); status(''); progress('off'); setBusy(false);
      try { root.scrollIntoView({block:'start', behavior:reduce ? 'auto' : 'smooth'}); } catch(e){}
    }
    function act(id){
      if (busy) return;
      if (!validate()) return;
      if ($('#bk-web').value) { status(L('Solicitud enviada.', 'Request sent.')); return; }     // trampa para robots
      var d = data(), enc = encodeURIComponent, wa = build(true), plain = build(false), subj = subject(), url;
      refreshPreview();
      if (id !== 'web'){                                   // abrir WhatsApp, correo, etc.: progreso breve
        var tk = ++progTok;
        setBusy(true);
        progress('start', L('Preparando tu solicitud…', 'Preparing your request…'));
        setTimeout(function(){
          if (tk !== progTok) return;
          setBusy(false);
          progress('done', L('¡Listo!', 'Done!'));
          setTimeout(function(){ if (tk === progTok) progress('off'); }, 900);
        }, 1100);
      }
      if (id === 'wa') launch('https://wa.me/' + CFG.phone + '?text=' + enc(wa), L('Abrimos WhatsApp con tu mensaje. Pulsa Enviar allí para terminar. Si no se abrió, prueba otra opción o copia el mensaje.', 'We opened WhatsApp with your message. Press Send there to finish. If it didn\'t open, try another option or copy the message.'));
      else if (id === 'waweb') launch('https://web.whatsapp.com/send?phone=' + CFG.phone + '&text=' + enc(wa), L('Abrimos WhatsApp Web con tu mensaje. Si te pide el código QR, escanéalo con tu móvil y pulsa Enviar.', 'We opened WhatsApp Web with your message. If it asks for the QR code, scan it with your phone and press Send.'));
      else if (id === 'gmail') launch('https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(CFG.email) + '&su=' + enc(subj) + '&body=' + enc(plain), L('Abrimos Gmail con tu mensaje. Pulsa Enviar allí para terminar.', 'We opened Gmail with your message. Press Send there to finish.'));
      else if (id === 'outlook') launch('https://outlook.live.com/mail/0/deeplink/compose?to=' + enc(CFG.email) + '&subject=' + enc(subj) + '&body=' + enc(plain), L('Abrimos Outlook con tu mensaje. Pulsa Enviar allí para terminar.', 'We opened Outlook with your message. Press Send there to finish.'));
      else if (id === 'mailto'){ location.href = 'mailto:' + CFG.email + '?subject=' + enc(subj) + '&body=' + enc(plain); status(L('Si tu equipo tiene un programa de correo, se abrirá con tu mensaje. Si no pasa nada, usa otra opción o copia el mensaje.', 'If your device has a mail program, it will open with your message. If nothing happens, use another option or copy the message.')); }
      else if (id === 'sms'){ location.href = 'sms:+' + CFG.phone + '?&body=' + enc(plain); status(L('Abrimos tus mensajes con la solicitud lista para enviar.', 'We opened your messages with the request ready to send.')); }
      else if (id === 'ig'){
        copyText(plain);
        launch('https://ig.me/m/' + CFG.instagram, L('Copiamos tu mensaje. Pégalo en el chat de Instagram que se abrió y envíalo.', 'We copied your message. Paste it into the Instagram chat that just opened and send it.'));
      }
      else if (id === 'copy'){
        copyText(plain).then(function(ok){
          status(ok ? L('Mensaje copiado. Pégalo en WhatsApp, Instagram, correo o donde prefieras.', 'Message copied. Paste it into WhatsApp, Instagram, email or wherever you like.')
                    : L('No pudimos copiarlo solo. Abre "Ver el mensaje" y cópialo desde ahí.', 'We couldn\'t copy it automatically. Open "See the message" and copy it from there.'), !ok);
          if (!ok){ var dt = $('.bk-preview'); if (dt) dt.open = true; }
        });
      }
      else if (id === 'web'){
        var tk2 = ++progTok, btn = $('[data-ch="web"]');
        setBusy(true);
        progress('start', L('Enviando tu solicitud…', 'Sending your request…'));
        var ctl = window.AbortController ? new AbortController() : null;
        var to = setTimeout(function(){ if (ctl) ctl.abort(); }, 25000);
        fetch(CFG.endpoint, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload()), signal: ctl ? ctl.signal : undefined})
          .then(function(r){ if (!r.ok) throw new Error('http'); return r.json(); })
          .then(function(j){
            clearTimeout(to);
            if (j && j.error) throw new Error(j.error);
            progress('done', L('¡Solicitud enviada!', 'Request sent!'));
            setTimeout(function(){
              if (tk2 !== progTok) return;
              progress('off'); setBusy(false);
              var wb = $('[data-ch="web"]'); if (wb) wb.disabled = true;      // evita enviar la misma solicitud dos veces
              var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost'; b.textContent = L('Hacer otra solicitud', 'Make another request');
              b.addEventListener('click', reset);
              status(L('¡Solicitud enviada! Te responderemos por ' + howLabel(d.how) + ' para confirmar tu cita.', 'Request sent! We\'ll reply by ' + howLabel(d.how) + ' to confirm your appointment.'), false, b);
            }, 800);
          })
          .catch(function(){
            clearTimeout(to);
            if (tk2 !== progTok) return;
            progress('off'); setBusy(false);
            status(L('No se pudo enviar desde la página. Usa otra opción de la lista o copia el mensaje.', 'We couldn\'t send it from the page. Use another option in the list or copy the message.'), true);
          });
      }
    }

    /* ---------- Documento de la cita: imprimir y guardar en PDF ---------- */
    function docModel(){
      var T = totals(), d = data();
      var s1 = {h:L('Servicios', 'Services'), rows:[]};
      T.items.forEach(function(it){
        s1.rows.push([nm(it.s) + (it.o && (it.s.opts || it.s.cat.optAll) ? ' (' + nm(it.o) + ')' : ''), usd(it.s.price)]);
      });
      T.extras.forEach(function(x){ s1.rows.push([nm(x) + ' (' + L('adicional', 'additional') + ')', '+ ' + usd(x.price)]); });
      s1.total = [L('Total estimado', 'Estimated total'), usd(T.total)];
      var s2 = {h:L('Día y hora', 'Day and time'), rows:[], muted:true};
      s2.rows.push([L('Día', 'Day'), sel.date ? cap(fullDate(fromIso(sel.date))) : L('Por definir', 'To be decided')]);
      var tl = sel.time === 'any' ? L('Cualquier hora', 'Any time')
        : (typeof sel.time === 'number' ? hm(sel.time) + (T.dur ? ' (' + L('termina sobre las ', 'ends around ') + hm(sel.time + T.dur) + ')' : '') : L('Por definir', 'To be decided'));
      s2.rows.push([L('Hora', 'Time'), tl]);
      if (T.dur) s2.rows.push([L('Duración aprox.', 'Approx. length'), fmtDur(T.dur)]);
      s2.rows.push([L('Personas', 'People'), String(peopleVal)]);
      if (d.alt) s2.rows.push([L('Otra opción', 'Other option'), d.alt]);
      var secs = [s1, s2];
      if (d.name || d.phone){
        var s3 = {h:L('Tus datos', 'Your details'), rows:[], muted:true};
        if (d.name) s3.rows.push([L('Nombre', 'Name'), d.name]);
        if (d.phone) s3.rows.push([L('Teléfono', 'Phone'), d.phone]);
        secs.push(s3);
      }
      return {
        title:'AM Luxury Beauty Studio',
        sub:L('Resumen de tu cita · pendiente de confirmación', 'Appointment summary · pending confirmation'),
        sections:secs,
        note:L('Tu cita queda confirmada cuando te respondamos. El precio final se confirma en el estudio.', 'Your appointment is confirmed once we reply. The final price is confirmed at the studio.'),
        foot:['AM Luxury Beauty Studio', CFG.address, L('Lunes a viernes, 8:00 AM a 6:00 PM', 'Monday to Friday, 8:00 AM to 6:00 PM') + ' · ' + CFG.phoneShow]
      };
    }
    function printSummary(){
      if (!totals().items.length) return;
      var m = docModel();
      var h = '<div class="bkp-head"><img src="img/AM-logo.png" alt=""><div><h1>' + esc(m.title) + '</h1><p>' + esc(m.sub) + '</p></div></div>';
      m.sections.forEach(function(sec){
        h += '<h2>' + esc(sec.h) + '</h2><ul class="bkp-lines' + (sec.muted ? ' bkp-muted' : '') + '">';
        sec.rows.forEach(function(r){ h += '<li><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></li>'; });
        h += '</ul>';
        if (sec.total) h += '<p class="bkp-total"><span>' + esc(sec.total[0]) + '</span><b>' + esc(sec.total[1]) + '</b></p>';
      });
      h += '<p class="bkp-note">' + esc(m.note) + '</p><div class="bkp-foot"><p><b>' + esc(m.foot[0]) + '</b></p><p>' + esc(m.foot[1]) + '</p><p>' + esc(m.foot[2]) + '</p></div>';
      var old = document.getElementById('bk-print'); if (old && old.parentNode) old.parentNode.removeChild(old);
      var box = document.createElement('div'); box.id = 'bk-print'; box.innerHTML = h;
      document.body.appendChild(box);
      document.body.classList.add('bk-printing');
      function done(){
        document.body.classList.remove('bk-printing');
        window.removeEventListener('afterprint', done);
        if (box.parentNode) box.parentNode.removeChild(box);
      }
      window.addEventListener('afterprint', done);
      setTimeout(done, 60000);
      setTimeout(function(){ window.print(); }, 60);
    }

    /* PDF hecho a mano (sin librerías ni conexión): texto en Helvetica y, si se puede, el logo */
    var HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
              1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
              333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
    function pdfFold(s){
      s = String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/[\r\n\t]+/g, ' ');
      var o = '', i;
      for (i = 0; i < s.length; i++) o += s.charCodeAt(i) <= 255 ? s.charAt(i) : '?';
      return o;
    }
    function tw(s, size, bold){
      var w = 0, i, c, ch;
      for (i = 0; i < s.length; i++){
        ch = s.charAt(i); c = s.charCodeAt(i);
        if (c > 126){ try { ch = ch.normalize('NFD').charAt(0); } catch(e){} c = ch.charCodeAt(0); }
        w += (c >= 32 && c <= 126) ? HW[c - 32] : 556;
      }
      return w * size / 1000 * (bold ? 1.07 : 1);
    }
    function pdfStr(s){
      var o = '', i, c, ch;
      for (i = 0; i < s.length; i++){
        ch = s.charAt(i); c = s.charCodeAt(i);
        if (c === 40 || c === 41 || c === 92) o += '\\' + ch;
        else if (c < 32) o += ' ';
        else if (c < 127) o += ch;
        else o += '\\' + ('00' + c.toString(8)).slice(-3);
      }
      return o;
    }
    function wrapText(s, maxW, size, bold){
      var words = s.split(' '), lines = [], cur = '';
      words.forEach(function(w){
        var t = cur ? cur + ' ' + w : w;
        if (!cur || tw(t, size, bold) <= maxW) cur = t; else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      return lines;
    }
    function pdfBuild(m, logo){
      var W = 595.28, H = 841.89, M = 54, R = W - M, pages = [], ops, y;
      var INK = '0.13 0.13 0.13', GOLD = '0.525 0.376 0.165', GOLDL = '0.788 0.639 0.416', LINE = '0.8 0.8 0.8', GRAY = '0.38 0.38 0.38';
      function np(){ ops = []; pages.push(ops); y = H - M; }
      function need(h){ if (y - h < M) np(); }
      function T(s, x, yy, size, bold, rgb){ ops.push('BT /F' + (bold ? 2 : 1) + ' ' + size + ' Tf ' + rgb + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + pdfStr(s) + ') Tj ET'); }
      function TR(s, xr, yy, size, bold, rgb){ T(s, xr - tw(s, size, bold), yy, size, bold, rgb); }
      function LN(x1, y1, x2, y2, w, rgb){ ops.push(rgb + ' RG ' + w + ' w ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S'); }
      np();
      var tx = M;
      if (logo){
        var lh = 46, lw = logo.w * lh / logo.h;
        ops.push('q ' + lw.toFixed(2) + ' 0 0 ' + lh + ' ' + M + ' ' + (y - lh).toFixed(2) + ' cm /Im1 Do Q');
        tx = M + lw + 14;
      }
      T(pdfFold(m.title), tx, y - 22, 20, true, INK);
      T(pdfFold(m.sub), tx, y - 40, 10, false, GOLD);
      y -= 58; LN(M, y, R, y, 1.4, GOLDL); y -= 10;
      m.sections.forEach(function(sec){
        need(50); y -= 24; T(pdfFold(sec.h), M, y, 11, true, GOLD); y -= 6;
        sec.rows.forEach(function(r){
          var rl = wrapText(pdfFold(r[1]), 300, 11, true), rw = 0;
          rl.forEach(function(l){ var w = tw(l, 11, true); if (w > rw) rw = w; });
          var ll = wrapText(pdfFold(r[0]), R - M - rw - 16, 11, false), n = Math.max(ll.length, rl.length), i;
          need(n * 15 + 8);
          for (i = 0; i < n; i++){
            y -= 15;
            if (ll[i]) T(ll[i], M, y, 11, false, sec.muted ? GRAY : INK);
            if (rl[i]) TR(rl[i], R, y, 11, true, INK);
          }
          y -= 4; LN(M, y, R, y, 0.4, LINE);
        });
        if (sec.total){
          need(40); y -= 6; LN(M, y, R, y, 1.2, GOLDL); y -= 22;
          T(pdfFold(sec.total[0]), M, y, 13, false, INK); TR(pdfFold(sec.total[1]), R, y, 13, true, INK); y -= 4;
        }
      });
      var nl = wrapText(pdfFold(m.note), R - M - 28, 9.5, false), bh = nl.length * 13 + 16;
      need(bh + 40); y -= 22;
      ops.push('0.98 0.96 0.925 rg ' + M + ' ' + (y - bh).toFixed(2) + ' ' + (R - M).toFixed(2) + ' ' + bh + ' re f');
      ops.push(GOLDL + ' rg ' + M + ' ' + (y - bh).toFixed(2) + ' 3 ' + bh + ' re f');
      nl.forEach(function(l, i){ T(l, M + 14, y - 15 - i * 13, 9.5, false, INK); });
      y -= bh;
      need(70); y -= 26; LN(M, y + 12, R, y + 12, 0.5, LINE);
      T(pdfFold(m.foot[0]), M, y, 9.5, true, GRAY);
      wrapText(pdfFold(m.foot[1]), R - M, 9, false).concat(wrapText(pdfFold(m.foot[2]), R - M, 9, false)).forEach(function(l){ y -= 12; T(l, M, y, 9, false, GRAY); });

      var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [], first = logo ? 6 : 5, kids = [], n;
      function add(num, body){ offs[num] = out.length; out += num + ' 0 obj\n' + body + '\nendobj\n'; }
      pages.forEach(function(p, i){ kids.push((first + i * 2) + ' 0 R'); });
      add(1, '<< /Type /Catalog /Pages 2 0 R >>');
      add(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>');
      add(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      add(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      if (logo) add(5, '<< /Type /XObject /Subtype /Image /Width ' + logo.w + ' /Height ' + logo.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + logo.data.length + ' >>\nstream\n' + logo.data + '\nendstream');
      pages.forEach(function(p, i){
        var num = first + i * 2, stream = p.join('\n');
        add(num, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + (logo ? ' /XObject << /Im1 5 0 R >>' : '') + ' >> /Contents ' + (num + 1) + ' 0 R >>');
        add(num + 1, '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      });
      n = first + pages.length * 2;
      var xr = out.length;
      out += 'xref\n0 ' + n + '\n0000000000 65535 f \n';
      for (var k = 1; k < n; k++) out += ('0000000000' + offs[k]).slice(-10) + ' 00000 n \n';
      out += 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
      var u8 = new Uint8Array(out.length), j;
      for (j = 0; j < out.length; j++) u8[j] = out.charCodeAt(j) & 255;
      return u8;
    }
    var logoCache;
    function loadLogo(cb){
      if (logoCache !== undefined) return cb(logoCache);
      var img = new Image(), done = false;
      function fin(v){ if (done) return; done = true; logoCache = v; cb(v); }
      img.onload = function(){
        try {
          if (!img.naturalHeight) return fin(null);
          var h = Math.min(img.naturalHeight, 160), w = Math.round(img.naturalWidth * h / img.naturalHeight);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
          fin({w:w, h:h, data:atob(c.toDataURL('image/jpeg', 0.9).split(',')[1])});
        } catch(e){ fin(null); }
      };
      img.onerror = function(){ fin(null); };
      setTimeout(function(){ fin(null); }, 2500);
      img.src = 'img/AM-logo.png';
    }
    function savePdf(){
      if (!totals().items.length) return;
      loadLogo(function(logo){
        try {
          var bytes = pdfBuild(docModel(), logo), name = 'Cita-AM-Luxury-Beauty-Studio.pdf';
          var blob = new Blob([bytes], {type:'application/pdf'});
          if (navigator.msSaveOrOpenBlob){ navigator.msSaveOrOpenBlob(blob, name); return; }
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = name; a.style.display = 'none';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        } catch(e){
          status(L('No se pudo crear el PDF. Usa "Imprimir" y elige "Guardar como PDF".', 'We couldn\'t create the PDF. Use "Print" and choose "Save as PDF".'), true);
        }
      });
    }

    /* ---------- Eventos ---------- */
    function toggleCat(id, on){
      sel.cats[id] = on;
      var c = CAT[id];
      if (on){ if (c.svcs.length === 1) sel.svc[c.svcs[0].id] = {opt:0}; }
      else { c.svcs.forEach(function(s){ delete sel.svc[s.id]; }); c.extras.forEach(function(x){ delete sel.extra[x.id]; }); delete sel.optAll[id]; }
    }
    root.addEventListener('click', function(e){
      var t = e.target, el;
      if ((el = t.closest('[data-cat]'))){
        var id = el.getAttribute('data-cat'), on = !sel.cats[id];
        toggleCat(id, on); renderCats(); renderPanels(); renderTimes(); renderSummary(); clearErr('err-svc'); refreshPreview();
        var back = $('[data-cat="' + id + '"]'); if (back) back.focus({preventScroll:true});
        return;
      }
      if ((el = t.closest('[data-nav]'))){
        var n = +el.getAttribute('data-nav'), d0 = new Date(Date.UTC(cal.y, cal.m + n, 1));
        cal.y = d0.getUTCFullYear(); cal.m = d0.getUTCMonth(); renderCal();
        var again = $('[data-nav="' + n + '"]'); if (again && !again.disabled) again.focus({preventScroll:true});
        return;
      }
      if ((el = t.closest('.bk-day'))){
        sel.date = el.getAttribute('data-date'); clearErr('err-date');
        $$('.bk-day').forEach(function(b){ b.setAttribute('aria-pressed', String(b === el)); });
        renderSummary(); refreshPreview(); return;
      }
      if ((el = t.closest('[data-print]'))){ printSummary(); return; }
      if ((el = t.closest('[data-pdf]'))){ savePdf(); return; }
      if ((el = t.closest('[data-more]'))){
        var tot = channels().length, before = chShown;
        chShown = chShown >= tot ? 2 : chShown + 2;
        renderChannels();
        if (chShown > before){ var nb = $$('.bk-ch')[before]; if (nb) nb.focus(); }
        return;
      }
      if ((el = t.closest('[data-ch]'))){ act(el.getAttribute('data-ch')); }
    });
    root.addEventListener('change', function(e){
      var t = e.target, id;
      if (t.hasAttribute('data-svc')){
        id = t.getAttribute('data-svc');
        var s = SVC[id];
        if (t.checked){
          if (s.group) s.cat.svcs.forEach(function(o){
            if (o !== s && o.group === s.group && sel.svc[o.id]){
              delete sel.svc[o.id];
              var oc = $('[data-svc="' + o.id + '"]'); if (oc) oc.checked = false;
              var ov = oc && oc.closest('div').querySelector('.bk-var'); if (ov) ov.hidden = true;
            }
          });
          sel.svc[id] = {opt:0};
        } else delete sel.svc[id];
        var wrap = t.closest('div'), v = wrap && wrap.querySelector('.bk-var'); if (v) v.hidden = !t.checked;
        if (s.opts && v){ var sl = v.querySelector('select'); if (sl) sl.value = '0'; }
        var oa = $('[data-optall="' + s.cat.id + '"]');
        if (oa) oa.hidden = !s.cat.svcs.some(function(o){ return sel.svc[o.id]; });
        clearErr('err-svc'); renderTimes(); renderSummary(); refreshPreview();
      } else if (t.hasAttribute('data-extra')){
        id = t.getAttribute('data-extra'); if (t.checked) sel.extra[id] = true; else delete sel.extra[id];
        renderSummary(); refreshPreview();
      } else if (t.hasAttribute('data-opt')){
        sel.svc[t.getAttribute('data-opt')] = {opt:+t.value}; renderTimes(); renderSummary(); refreshPreview();
      } else if (t.hasAttribute('data-optall-sel')){
        sel.optAll[t.getAttribute('data-optall-sel')] = +t.value; renderTimes(); renderSummary(); refreshPreview();
      } else if (t.name === 'hora'){
        sel.time = t.value === 'any' ? 'any' : +t.value; clearErr('err-time'); renderSummary(); refreshPreview();
      } else if (t.id === 'bk-people'){ peopleVal = +t.value; renderSummary(); refreshPreview(); }
      else if (t.id === 'bk-how'){ howVal = t.value; if (howVal !== 'mail') clearErr('err-mail', $('#bk-mail')); refreshPreview(); }
      else if (t.id === 'bk-ok'){ clearErr('err-ok', t); }
    });
    root.addEventListener('input', function(e){
      var t = e.target;
      if (t.id === 'bk-name') clearErr('err-name', t);
      else if (t.id === 'bk-phone') clearErr('err-phone', t);
      else if (t.id === 'bk-mail') clearErr('err-mail', t);
      if (t.closest('.bk-form')) refreshPreview();
    });
    root.addEventListener('submit', function(e){
      e.preventDefault();
      if (validate()){ var f = $('.bk-ch'); status(L('Todo listo. Elige abajo cómo quieres enviar tu solicitud.', 'All set. Choose below how you want to send your request.')); if (f) f.focus(); }
    });

    /* El formulario está oculto hasta que se pulsa un botón "Reservar": lo muestra, elige la categoría y baja hasta él */
    function openForm(id){
      var first = root.hidden;
      root.hidden = false;
      if (id && CAT[id] && !sel.cats[id]){
        toggleCat(id, true); renderCats(); renderPanels(); renderTimes(); renderSummary();
      }
      if (first && !reduce) root.classList.add('bk-in');
      root.scrollIntoView({block:'start', behavior:reduce ? 'auto' : 'smooth'});
      var t = $('#bk-title'); if (t) try { t.focus({preventScroll:true}); } catch(e){}
      window.dispatchEvent(new Event('scroll'));
    }
    window.AMReserva = {open:openForm};
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('[data-reservar]');
      if (!a) return;
      e.preventDefault();
      openForm(a.getAttribute('data-reservar'));
    });
    if (location.hash === '#reservar-cita') openForm();

    /* Cambio de idioma de la web */
    AM.onLang(function(){
      var keep = {};
      ['bk-name','bk-phone','bk-mail','bk-notes','bk-alt'].forEach(function(i){ var n = $('#' + i); if (n) keep[i] = n.value; });
      var ok = $('#bk-ok') && $('#bk-ok').checked;
      shell();
      Object.keys(keep).forEach(function(i){ $('#' + i).value = keep[i]; });
      $('#bk-ok').checked = ok; refreshPreview();
    });

    /* Inicio */
    setRange();
    var first = new Date(MIN_T); cal.y = first.getUTCFullYear(); cal.m = first.getUTCMonth();
    shell();
  })();

/* ===== Margarita · asistente virtual de AM Luxury Beauty Studio =====
   - Funciona sola en el navegador: responde con la información de esta misma web (servicios, precios,
     horario, ubicación, pagos, café, reservas…), en español o inglés.
   - Opcional (IA real): define antes de este script
       window.MARGARITA_CONFIG = { endpoint: 'https://tu-servidor/margarita' };
     Cuando Margarita no encuentre respuesta, enviará un POST JSON {message, lang, history} a ese
     endpoint y mostrará el campo "reply" de la respuesta. Sin endpoint, ofrece WhatsApp.
*/
(function(){
  'use strict';
  var CFG = window.MARGARITA_CONFIG || {};
  var PHONE = CFG.phone || AM.PHONE;
  var ENDPOINT = CFG.endpoint || '';
  var root = document.getElementById('mg');
  if (!root) return;

  /* ---------- utilidades ---------- */
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(s){
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[^a-z0-9$\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var siteLang = AM.lang;
  function ix(L){ return L === 'en' ? 1 : 0; }
  var NS = 'http://www.w3.org/2000/svg';
  function icon(id){
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  }
  function phoneIcon(){
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z');
    s.appendChild(p); return s;
  }
  var reduce = AM.reduce;
  function isSmall(){ return !!(window.matchMedia && window.matchMedia('(max-width:860px)').matches); }

  /* ---------- textos de la interfaz ---------- */
  var UI = {
    es: { open:'Abrir chat con Margarita', close:'Cerrar chat con Margarita', sub:'Asistente virtual de AM Luxury Beauty Studio',
          ph:'Escribe tu pregunta…', send:'Enviar mensaje', inputLabel:'Tu pregunta para Margarita',
          note:'Asistente virtual · Para confirmar tu cita, escríbenos por WhatsApp',
          hint:'¡Hola! Soy Margarita. ¿Te ayudo?', hintClose:'Cerrar aviso', chips:'Preguntas sugeridas' },
    en: { open:'Open chat with Margarita', close:'Close chat with Margarita', sub:'Virtual assistant of AM Luxury Beauty Studio',
          ph:'Type your question…', send:'Send message', inputLabel:'Your question for Margarita',
          note:'Virtual assistant · To confirm your appointment, message us on WhatsApp',
          hint:'Hi! I\'m Margarita. Can I help?', hintClose:'Dismiss', chips:'Suggested questions' }
  };
  var CHIP = {
    servicios:{es:'Servicios', en:'Services'}, precios:{es:'Precios', en:'Prices'},
    horario:{es:'Horario', en:'Opening hours'}, ubicacion:{es:'Ubicación', en:'Location'},
    reservar:{es:'Cómo reservar', en:'How to book'}, paquete:{es:'Paquete Luxury', en:'Luxury Package'},
    pago:{es:'Formas de pago', en:'Payment methods'}, cafe:{es:'Café y bebidas', en:'Coffee & drinks'},
    duracion:{es:'Duración', en:'Duration'}, extras:{es:'Servicios adicionales', en:'Add-on services'},
    galeria:{es:'Ver trabajos', en:'See our work'}, contacto:{es:'Contacto', en:'Contact'},
    equipo:{es:'El equipo', en:'The team'}, resenas:{es:'Reseñas', en:'Reviews'},
    manicura:{es:'Manicura', en:'Manicure'}, 'manicura-spa':{es:'Manicura SPA', en:'Manicure SPA'},
    pedicura:{es:'Pedicura', en:'Pedicure'}, 'pedicura-spa':{es:'Pedicura SPA', en:'Pedicure SPA'},
    pestanas:{es:'Pestañas', en:'Lashes'}, cejas:{es:'Cejas', en:'Brows'}, spa:{es:'Tratamientos SPA', en:'SPA treatments'}
  };
  var DEFAULT_CHIPS = ['servicios','precios','horario','ubicacion','reservar','paquete','pago'];

  /* ---------- acciones (botones dentro de las respuestas) ---------- */
  var WA_BOOK = {k:'wa', l:['Reservar por WhatsApp','Book on WhatsApp'],
    m:['Hola, quiero reservar una cita en AM Luxury Beauty Studio.','Hello, I would like to book an appointment at AM Luxury Beauty Studio.']};
  var WA_ASK = {k:'wa', l:['Escribir por WhatsApp','Message us on WhatsApp'],
    m:['Hola, tengo una duda sobre los servicios de AM Luxury Beauty Studio.','Hello, I have a question about the services at AM Luxury Beauty Studio.']};
  var TEL = {k:'tel', l:['Llamar','Call']};
  function go(sel, es, en){ return {k:'go', s:sel, l:[es, en]}; }

  /* ---------- servicios ---------- */
  var SV = {
    'manicura': {
      n:['Manicura','Manicure'], wan:['Manicura','Manicure'], gal:'manicura', go:'#manicura',
      full:[
        '**Manicura**\n\nManicura Estándar .. $15 USD\nDual System .. $18 USD\nSoftgel .. $17 USD\n\nDentro de la estándar tienes: Reforzamiento con Builder Gel o Técnica Combinada.\n\nDuración aprox.: 2 h 15 min\n\nTodos los servicios de manicura incluyen:\n- Manicura macro para acabado impecable\n- Esmaltado profundo\n- Decoración hasta 2 uñas\n- Hidratación con ligero masaje\n- Masajeadores de pie y cuello opcionales\n\nCafé de cortesía incluido.',
        '**Manicure**\n\nStandard Manicure .. $15 USD\nDual System .. $18 USD\nSoftgel .. $17 USD\n\nThe standard one comes as: Builder Gel reinforcement or Combined Technique.\n\nApprox. duration: 2 h 15 min\n\nEvery manicure includes:\n- Macro manicure for a flawless finish\n- Deep polish application\n- Decoration on up to 2 nails\n- Hydration with a light massage\n- Optional foot and neck massagers\n\nComplimentary coffee included.'],
      dur:['La **Manicura** dura aproximadamente **2 h 15 min**.','The **Manicure** takes approximately **2 h 15 min**.']
    },
    'manicura-spa': {
      n:['Manicura SPA','Manicure SPA'], wan:['Manicura SPA','Manicure SPA'], gal:'manicura-spa', go:'#manicura-spa',
      full:[
        '**Manicura SPA** .. $14 USD\n\nDuración aprox.: 1 h\n\nIncluye:\n- Baño de manos con sales y perlas regeneradoras\n- Espuma limpiadora\n- Exfoliación profunda\n- Mascarilla con vaporizador de ozono\n- Velo-terapia relajante\n- Parafina para hidratación intensiva\n- Masaje relajante\n- Toque final con exquisita fragancia\n\nBebida premium incluida.',
        '**Manicure SPA** .. $14 USD\n\nApprox. duration: 1 h\n\nIncludes:\n- Hand bath with salts and regenerating pearls\n- Cleansing foam\n- Deep exfoliation\n- Mask with ozone steamer\n- Relaxing veil therapy\n- Paraffin for intensive hydration\n- Relaxing massage\n- Finishing touch with an exquisite fragrance\n\nPremium drink included.'],
      dur:['La **Manicura SPA** dura aproximadamente **1 h**.','The **Manicure SPA** takes approximately **1 h**.']
    },
    'pedicura': {
      n:['Pedicura','Pedicure'], wan:['Pedicura','Pedicure'], gal:'pedicura', go:'#pedicura',
      full:[
        '**Pedicura** .. $15 USD\n\nDuración aprox.: 1 h 30 min\n\nIncluye:\n- Limpieza profunda de cutículas\n- Molde perfecto de uñas\n- Eliminación de callos y durezas\n- 7 minutos en tina de hidromasaje\n- Hidratación con ligero masaje\n- Masajeador de cuello (opcional)\n\nCafé de cortesía incluido. También ofrecemos Pedicura para caballeros como servicio adicional ($10 USD).',
        '**Pedicure** .. $15 USD\n\nApprox. duration: 1 h 30 min\n\nIncludes:\n- Deep cuticle cleaning\n- Perfect nail shaping\n- Removal of calluses and hardened skin\n- 7 minutes in a hydromassage tub\n- Hydration with a light massage\n- Neck massager (optional)\n\nComplimentary coffee included. We also offer a Men\'s pedicure as an add-on service ($10 USD).'],
      dur:['La **Pedicura** dura aproximadamente **1 h 30 min**.','The **Pedicure** takes approximately **1 h 30 min**.']
    },
    'pedicura-spa': {
      n:['Pedicura SPA','Pedicure SPA'], wan:['Pedicura SPA','Pedicure SPA'], gal:'pedicura-spa', go:'#pedicura-spa',
      full:[
        '**Pedicura SPA** .. $18 USD\n\nDuración aprox.: 1 h 20 min\n\nIncluye:\n- Baño de pie en tina de hidromasaje con sales y perlas\n- Espuma limpiadora\n- Exfoliación profunda\n- Mascarilla con vaporizador de ozono\n- Termoterapia con toallas calientes\n- Velo-terapia nutritiva\n- Parafina ultra profunda\n- Pistola de masaje para fascia plantar\n- Masaje relajante\n- Masajeador ocular 4D\n\nBebida premium incluida.',
        '**Pedicure SPA** .. $18 USD\n\nApprox. duration: 1 h 20 min\n\nIncludes:\n- Foot bath in a hydromassage tub with salts and pearls\n- Cleansing foam\n- Deep exfoliation\n- Mask with ozone steamer\n- Thermotherapy with hot towels\n- Nourishing veil therapy\n- Ultra-deep paraffin\n- Massage gun for the plantar fascia\n- Relaxing massage\n- 4D eye massager\n\nPremium drink included.'],
      dur:['La **Pedicura SPA** dura aproximadamente **1 h 20 min**.','The **Pedicure SPA** takes approximately **1 h 20 min**.']
    },
    'pestanas': {
      n:['Extensiones de pestañas','Eyelash extensions'], wan:['Extensiones de pestañas','Eyelash Extensions'], gal:'pestanas', go:'#pestanas',
      full:[
        '**Extensiones de pestañas**\n\n2D YY .. $13 USD\n3D .. $15 USD\n4D .. $17 USD\n5D .. $20 USD\n6D .. $20 USD\n\nDuración aprox.: set nuevo 2 h 30 min · retoque 1 h 30 min\n\nCafé de cortesía incluido. El retiro de extensiones es un servicio adicional ($4 USD).',
        '**Eyelash extensions**\n\n2D YY .. $13 USD\n3D .. $15 USD\n4D .. $17 USD\n5D .. $20 USD\n6D .. $20 USD\n\nApprox. duration: new set 2 h 30 min · touch-up 1 h 30 min\n\nComplimentary coffee included. Extension removal is an add-on service ($4 USD).'],
      dur:['Las **extensiones de pestañas** duran aproximadamente **2 h 30 min** (set nuevo) y **1 h 30 min** (retoque).','**Eyelash extensions** take approximately **2 h 30 min** (new set) and **1 h 30 min** (touch-up).']
    },
    'cejas': {
      n:['Diseño de cejas','Brow design'], wan:['Diseño de cejas','Brow Design'], gal:'cejas', go:'#cejas',
      full:[
        '**Diseño de cejas**\n\nLaminado + Diseño + Depilación .. $10 USD\nHenna + Diseño + Depilación .. $10 USD\nDepilación de cejas + Diseño .. $5 USD\nDepilación de bozo .. $3 USD\nDepilación de barbilla .. $4 USD\n\nDuración aprox.: 1 h\n\n**Laminado Premium** .. $16 USD\n- Laminado + Depilación + Tinte\n- Parches hidratantes\n- Masaje relajante\n- Productos de alta calidad\n- Aceite de castor para el cuidado en casa\n\nCafé de cortesía incluido.',
        '**Brow design**\n\nLamination + Design + Waxing .. $10 USD\nHenna + Design + Waxing .. $10 USD\nBrow waxing + Design .. $5 USD\nUpper-lip waxing .. $3 USD\nChin waxing .. $4 USD\n\nApprox. duration: 1 h\n\n**Premium Lamination** .. $16 USD\n- Lamination + Waxing + Tint\n- Hydrating patches\n- Relaxing massage\n- High-quality products\n- Castor oil for at-home care\n\nComplimentary coffee included.'],
      dur:['El **diseño de cejas** dura aproximadamente **1 h**.','**Brow design** takes approximately **1 h**.']
    },
    'paquete': {
      n:['Paquete Luxury Full Service','Luxury Full Service Package'], wan:null, gal:null, go:'#paquete',
      full:[
        '**Paquete Luxury Full Service** .. $50 USD\n\nUna experiencia completa para consentir tus manos y pies. Incluye:\n- Manicura Estándar\n- Manicura SPA\n- Pedicura Estándar\n- Pedicura SPA\n\nNo incluye pestañas ni cejas. Café y bebida de cortesía incluidos.',
        '**Luxury Full Service Package** .. $50 USD\n\nA complete experience to pamper your hands and feet. Includes:\n- Standard Manicure\n- Manicure SPA\n- Standard Pedicure\n- Pedicure SPA\n\nDoes not include lashes or brows. Complimentary coffee and drink included.'],
      dur:['El **Paquete Luxury Full Service** dura aproximadamente **6 horas** (unos 365 min). No tiene una duración publicada, pero se estima sumando sus 4 servicios: Manicura Estándar 2 h 15 min + Manicura SPA 1 h + Pedicura 1 h 30 min + Pedicura SPA 1 h 20 min. Si empiezas a las 8:00 AM, terminarías hacia las 2:00 PM. Es una estimación: el tiempo exacto puede variar, confírmalo al reservar.',
      'The **Luxury Full Service Package** takes approximately **6 hours** (about 365 min). There is no published duration, but it can be estimated by adding its 4 services: Standard Manicure 2 h 15 min + SPA Manicure 1 h + Pedicure 1 h 30 min + SPA Pedicure 1 h 20 min. If you start at 8:00 AM, you would finish around 2:00 PM. This is an estimate: the exact time may vary, so please confirm it when booking.']
    }
  };
  var SVC_IDS = ['manicura','manicura-spa','pedicura','pedicura-spa','pestanas','cejas','paquete'];

  function bookAct(id){
    var s = SV[id];
    if (id === 'paquete') return {k:'wa', l:['Reservar Full Service','Book Full Service'],
      m:['Hola, quiero reservar el Paquete Luxury Full Service en AM Luxury Beauty Studio. ¿Qué horarios tienen disponibles?',
         'Hello, I would like to book the Luxury Full Service Package at AM Luxury Beauty Studio. What times do you have available?']};
    return {k:'wa', l:['Reservar ' + s.wan[0], 'Book ' + s.wan[1]],
      m:['Hola, quiero reservar cita para ' + s.wan[0] + ' en AM Luxury Beauty Studio. ¿Qué horarios tienen disponibles?',
         'Hello, I would like to book an appointment for ' + s.wan[1] + ' at AM Luxury Beauty Studio. What times do you have available?']};
  }

  /* ---------- estado del horario (misma lógica que el sitio: hora de Cuba) ---------- */
  var DIAS = {es:['domingo','lunes','martes','miércoles','jueves','viernes','sábado'], en:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']};
  function openNow(L){
    try{
      var p = new Intl.DateTimeFormat('en-US',{timeZone:'America/Havana',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date());
      var o = {}; p.forEach(function(x){ o[x.type] = x.value; });
      var d = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday];
      var m = (parseInt(o.hour,10) % 24) * 60 + parseInt(o.minute,10);
      var lab = (L === 'en');
      var weekday = d >= 1 && d <= 5;
      if (weekday && m >= 480 && m < 1080){
        return lab ? 'Right now we\'re open, until 6:00 PM (Cuba time).' : 'Ahora mismo estamos atendiendo, hasta las 6:00 PM (hora de Cuba).';
      }
      if (weekday && m < 480) return lab ? 'Right now we\'re closed; we open today at 8:00 AM (Cuba time).' : 'Ahora mismo estamos cerrados; abrimos hoy a las 8:00 AM (hora de Cuba).';
      for (var i = 1; i <= 7; i++){
        var n = (d + i) % 7;
        if (n >= 1 && n <= 5){
          if (lab) return 'Right now we\'re closed; we open ' + (i === 1 ? 'tomorrow' : 'on ' + DIAS.en[n]) + ' at 8:00 AM (Cuba time).';
          return 'Ahora mismo estamos cerrados; abrimos ' + (i === 1 ? 'mañana' : 'el ' + DIAS.es[n]) + ' a las 8:00 AM (hora de Cuba).';
        }
      }
    } catch(e){}
    return '';
  }

/* ----------------- respuestas ----------------- */
  var ctx = {svc:null};
  var R = {};
  function T(L, es, en){ return L === 'en' ? en : es; }
  function mapsHref(){
    var a = document.querySelector('a.map-thumb');
    return (a && a.href) || 'https://www.google.com/maps/search/?api=1&query=AM+Beauty+Studio+C%C3%A1rdenas';
  }
  function priceText(id, L){
    var full = SV[id].full[ix(L)];
    var rows = full.split('\n').filter(function(l){ return l.indexOf(' .. ') > -1; });
    var head = rows[0].indexOf('**') === 0 ? '' : '**' + SV[id].n[ix(L)] + '**\n\n';
    return head + rows.join('\n');
  }
  function serviceReply(id, L){
    ctx.svc = id;
    var acts = [bookAct(id)];
    if (SV[id].gal) acts.push({k:'gal', f:SV[id].gal, l:['Ver trabajos','See our work']});
    else acts.push(go('#paquete','Verlo en la web','See it on the site'));
    return {t:SV[id].full[ix(L)], acts:acts, chips:['duracion','extras','precios','reservar','servicios']};
  }
  function svcFor(n){
    var b = scoreAll(n, SVC_IDS);
    if (b.score >= 3) return b.id;
    if (ctx.svc && n.split(' ').length <= 4 && !/\b(servicios|services|todos|todas|all)\b/.test(n) && !/^(?:precios?|prices?|tarifas?|costos?|duracion|duration)$/.test(n)) return ctx.svc;
    return null;
  }
  R.saludo = function(L){ return {t:T(L,'¡Hola! Soy Margarita, la asistente virtual de AM Luxury Beauty Studio. ¿Qué te gustaría saber?','Hi! I\'m Margarita, the virtual assistant of AM Luxury Beauty Studio. What would you like to know?'), chips:DEFAULT_CHIPS}; };
  R.gracias = function(L){ return {t:T(L,'¡Con mucho gusto! Si necesitas algo más, aquí estoy.','You\'re very welcome! If you need anything else, I\'m here.'), chips:DEFAULT_CHIPS}; };
  R.adios = function(L){ return {t:T(L,'¡Hasta pronto! Te esperamos en AM Luxury Beauty Studio.','See you soon! We look forward to welcoming you at AM Luxury Beauty Studio.'), chips:[]}; };
  R.ofensa = function(L){ return {t:T(L,'¡Por favor no ofendas.','Please do not cause offense.'), chips:[]}; };
  R.yo = function(L){ return {t:T(L,
      'Soy **Margarita**, la asistente virtual de AM Luxury Beauty Studio (no soy una persona). Puedo contarte sobre servicios, precios, horario, ubicación y cómo reservar. Si necesitas algo más, te paso con el equipo por WhatsApp.',
      'I\'m **Margarita**, the virtual assistant of AM Luxury Beauty Studio (I\'m not a person). I can tell you about services, prices, hours, location and how to book. If you need anything else, you can reach the team on WhatsApp.'),
      acts:[WA_ASK], chips:DEFAULT_CHIPS}; };
  R.ayuda = function(L){ return {t:T(L,
      'Puedo ayudarte con:\n- Servicios, precios y duración\n- Horario y ubicación\n- Cómo reservar y formas de pago\n- Café y bebidas de cortesía\n- Fotos de nuestros trabajos y el equipo\n\nEscríbeme tu pregunta o elige una opción.',
      'I can help you with:\n- Services, prices and duration\n- Opening hours and location\n- How to book and payment methods\n- Complimentary coffee and drinks\n- Photos of our work and the team\n\nType your question or pick an option.'),
      chips:DEFAULT_CHIPS}; };
  R.acerca = function(L){ return {t:T(L,
      '**AM Luxury Beauty Studio** es un espacio creado para ti, donde la elegancia y el bienestar se encuentran, con cada detalle pensado para consentirte. Ofrecemos manicura, pedicura SPA, pestañas y cejas en Cárdenas, con café y bebida de cortesía.',
      '**AM Luxury Beauty Studio** is a space created for you, where elegance and wellbeing meet and every detail is designed to pamper you. We offer manicure, SPA pedicure, lashes and brows in Cárdenas, with complimentary coffee and drink.'),
      acts:[go('#servicios','Ver servicios','See services'), go('#equipo','Conocer al equipo','Meet the team')],
      chips:['servicios','equipo','ubicacion','reservar']}; };
  R.servicios = function(L){ ctx.svc = null; return {t:T(L,
      'Estos son nuestros servicios:\n- Manicura (Estándar, Dual System y Softgel)\n- Manicura SPA\n- Pedicura\n- Pedicura SPA\n- Extensiones de pestañas\n- Diseño de cejas\n- Paquete Luxury Full Service (manos y pies)\n\nTodos incluyen café de cortesía; los SPA y el Paquete Luxury suman una bebida premium. ¿Cuál te interesa?',
      'These are our services:\n- Manicure (Standard, Dual System and Softgel)\n- Manicure SPA\n- Pedicure\n- Pedicure SPA\n- Eyelash extensions\n- Brow design\n- Luxury Full Service Package (hands and feet)\n\nAll include complimentary coffee; the SPA services and the Luxury Package add a premium drink. Which one interests you?'),
      acts:[go('#servicios','Ver en la web','See on the site')],
      chips:['manicura','pedicura','spa','pestanas','cejas','paquete','precios']};
  };
  R.spa = function(L){ return {t:T(L,
      'Nuestros tratamientos SPA:\n\nManicura SPA .. $14 USD\nPedicura SPA .. $18 USD\n\nIncluyen baño con sales y perlas, exfoliación, mascarilla con vaporizador de ozono, parafina, masaje relajante y una bebida premium de cortesía. Y si quieres manos y pies, el Paquete Luxury Full Service cuesta $50 USD.',
      'Our SPA treatments:\n\nManicure SPA .. $14 USD\nPedicure SPA .. $18 USD\n\nThey include a bath with salts and pearls, exfoliation, a mask with ozone steamer, paraffin, a relaxing massage and a complimentary premium drink. And for hands and feet together, the Luxury Full Service Package is $50 USD.'),
      chips:['manicura-spa','pedicura-spa','paquete','reservar']};
  };
  R.manicura = function(L){ return serviceReply('manicura', L); };
  R['manicura-spa'] = function(L){ return serviceReply('manicura-spa', L); };
  R.pedicura = function(L){ return serviceReply('pedicura', L); };
  R['pedicura-spa'] = function(L){ return serviceReply('pedicura-spa', L); };
  R.pestanas = function(L){ return serviceReply('pestanas', L); };
  R.cejas = function(L){ return serviceReply('cejas', L); };
  R.paquete = function(L){ return serviceReply('paquete', L); };
  R.precios = function(L, n){
    var s = svcFor(n);
    if (s){
      ctx.svc = s;
      var a = [bookAct(s)];
      return {t:priceText(s, L), acts:a, chips:['duracion','extras','servicios','pago']};
    }
    return {t:T(L,
      '**Precios**\n\nManicura Estándar .. $15 USD\nDual System .. $18 USD\nSoftgel .. $17 USD\nManicura SPA .. $14 USD\nPedicura .. $15 USD\nPedicura SPA .. $18 USD\nPestañas .. desde $13 USD\nCejas .. desde $3 USD\nLaminado Premium .. $16 USD\nPaquete Luxury Full Service .. $50 USD\n\nPrecios en USD. También aceptamos EUR, CAD y CUP al cambio del día. Dime qué servicio te interesa y te doy el detalle.',
      '**Prices**\n\nStandard Manicure .. $15 USD\nDual System .. $18 USD\nSoftgel .. $17 USD\nManicure SPA .. $14 USD\nPedicure .. $15 USD\nPedicure SPA .. $18 USD\nLashes .. from $13 USD\nBrows .. from $3 USD\nPremium Lamination .. $16 USD\nLuxury Full Service Package .. $50 USD\n\nPrices in USD. We also accept EUR, CAD and CUP at the day\'s exchange rate. Tell me which service interests you and I\'ll give you the details.'),
      acts:[{k:'link', h:'doc/Catalogo_AM_BEAUTY_STUDIO.pdf', ext:true, l:['Catálogo en PDF','PDF catalog']}, go('#servicios','Ver en la web','See on the site')],
      chips:['manicura','pedicura','pestanas','cejas','extras','pago']};
  };
  R.duracion = function(L, n){
    var s = svcFor(n);
    if (s){
      ctx.svc = s;
      return {t:SV[s].dur[ix(L)], acts:[bookAct(s)], chips:['precios','extras','servicios']};
    }
    return {t:T(L,
      '**Duración aproximada**\n\nManicura .. 2 h 15 min\nManicura SPA .. 1 h\nPedicura .. 1 h 30 min\nPedicura SPA .. 1 h 20 min\nPestañas, set nuevo .. 2 h 30 min\nPestañas, retoque .. 1 h 30 min\nCejas .. 1 h\nPaquete Luxury Full Service .. aprox. 6 h (suma de sus 4 servicios)',
      '**Approximate duration**\n\nManicure .. 2 h 15 min\nManicure SPA .. 1 h\nPedicure .. 1 h 30 min\nPedicure SPA .. 1 h 20 min\nLashes, new set .. 2 h 30 min\nLashes, touch-up .. 1 h 30 min\nBrows .. 1 h\nLuxury Full Service Package .. approx. 6 h (sum of its 4 services)'),
      acts:[WA_BOOK], chips:['precios','servicios','reservar']};
  };
  /* ---------- Deducciones: respuestas calculadas con los datos del catálogo ----------
     Margarita no solo repite textos: si la pregunta combina servicios (o pide un total, un ahorro,
     si cabe en un día…) calcula la respuesta a partir de la duración y el precio de cada servicio. */
  var FACT = {   // dur en minutos · p = [precio mínimo, máximo] en USD (mismos datos que el formulario de reservas)
    'manicura':     {dur:135, p:[15,18], n:['Manicura (Estándar, Dual System o Softgel)','Manicure (Standard, Dual System or Softgel)']},
    'manicura-spa': {dur:60,  p:[14,14], n:['Manicura SPA','SPA Manicure']},
    'pedicura':     {dur:90,  p:[15,15], n:['Pedicura','Pedicure']},
    'pedicura-spa': {dur:80,  p:[18,18], n:['Pedicura SPA','SPA Pedicure']},
    'pestanas':     {dur:150, p:[13,20], n:['Pestañas (set nuevo)','Lashes (new set)']},
    'cejas':        {dur:60,  p:[3,16],  n:['Cejas','Brows']},
    'paquete':      {dur:365, p:[50,50], n:['Paquete Luxury Full Service','Luxury Full Service Package']}
  };
  var PKG_PARTS = ['manicura','manicura-spa','pedicura','pedicura-spa'];   // lo que incluye el paquete
  var PKG_SEPARATE = 15 + 14 + 15 + 18;                                     // precio de esos 4 por separado (manicura estándar)
  var OPEN_MIN = 8 * 60, CLOSE_MIN = 18 * 60;                               // horario: 8:00 AM – 6:00 PM
  function hm(m){ var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' h' : '') + (h && r ? ' ' : '') + (r ? r + ' min' : ''); }
  function clock(m, L){
    m = Math.round(m / 15) * 15;
    var h = Math.floor(m / 60) % 24, r = m % 60, ap = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + (r < 10 ? '0' : '') + r + ' ' + ap;
  }
  function usdRange(a, b){ return a === b ? '$' + a : '$' + a + '–' + b; }
  function mentioned(n){
    var out = [], t = n;
    var ms = /manicur\w*\s+spa|spa\s+(?:de\s+)?manicur\w*|manicure\s+spa|spa\s+manicure/;
    var ps = /pedicur\w*\s+spa|spa\s+(?:de\s+)?pedicur\w*|pedicure\s+spa|spa\s+pedicure/;
    if (ms.test(t)){ out.push('manicura-spa'); t = t.replace(ms, ' '); }
    if (ps.test(t)){ out.push('pedicura-spa'); t = t.replace(ps, ' '); }
    var feet = /\bmanos y pies\b|\bpies y manos\b|\bhands and feet\b|\bfeet and hands\b/.test(t);
    if (feet || /\b(?:manicur\w*|manicure|mani)\b/.test(t)) out.push('manicura');
    if (feet || /\b(?:pedicur\w*|pedicure|pedi)\b/.test(t)) out.push('pedicura');
    if (/pestan|lash/.test(t)) out.push('pestanas');
    if (/\bcejas?\b|\bbrows?\b/.test(t)) out.push('cejas');
    if (/\bpaquete\b|\bpackage\b|full service/.test(t)) out.push('paquete');
    return out;
  }
  var RE_COMBO = /\b(?:mismo dia|juntas?|juntos|total|ambos|ambas|a la vez|al mismo tiempo|en un dia|cabe|cabria|alcanza|same day|together|both|at once|combin\w*|sumar?|ahorr\w*|conviene|separad[oa]s?|vale la pena|worth|cheaper|save|saving|separately|diferencia)\b/;
  function deduceKey(n){
    var ms = mentioned(n);
    if (ms.length >= 2 && (scoreAll(n, ['duracion','precios']).score >= 3 || RE_COMBO.test(n))) return 'combo';
    if (ms.length === 1 && ms[0] === 'paquete' && /ahorr|conviene|separad|vale la pena|worth|cheaper|save|saving|separately|diferencia|compar/.test(n)) return 'combo';
    return null;
  }
  R.combo = function(L, n){
    var ids = mentioned(n), has = function(id){ return ids.indexOf(id) > -1; };
    ctx.svc = null;
    var hasAll4 = PKG_PARTS.every(has);
    var pkgOnly = ids.length === 1 && ids[0] === 'paquete';
    if (pkgOnly || (hasAll4 && !has('paquete'))){
      var save = PKG_SEPARATE - FACT.paquete.p[0];
      return {t:T(L,
        '**Paquete Luxury Full Service o por separado**\n\nPor separado (Manicura Estándar + Manicura SPA + Pedicura + Pedicura SPA): **$' + PKG_SEPARATE + ' USD**.\nPaquete Luxury Full Service: **$' + FACT.paquete.p[0] + ' USD**.\n\nCon el paquete ahorras aproximadamente **$' + save + ' USD** (calculado con la manicura estándar) y además incluye café y una bebida de cortesía. Duración estimada: ' + hm(FACT.paquete.dur) + '.',
        '**Luxury Full Service Package or separately**\n\nSeparately (Standard Manicure + SPA Manicure + Pedicure + SPA Pedicure): **$' + PKG_SEPARATE + ' USD**.\nLuxury Full Service Package: **$' + FACT.paquete.p[0] + ' USD**.\n\nWith the package you save about **$' + save + ' USD** (calculated with the standard manicure), and it also includes coffee and a complimentary drink. Estimated duration: ' + hm(FACT.paquete.dur) + '.'),
        acts:[bookAct('paquete'), go('#paquete','Ver el paquete','See the package')], chips:['duracion','precios','reservar','servicios']};
    }
    var min = 0, lo = 0, hi = 0, rows = [];
    ids.forEach(function(id){
      var f = FACT[id]; min += f.dur; lo += f.p[0]; hi += f.p[1];
      rows.push(f.n[ix(L)] + ' .. ' + hm(f.dur) + ' · ' + usdRange(f.p[0], f.p[1]) + ' USD');
    });
    var tail = '';
    var avail = CLOSE_MIN - OPEN_MIN;
    if (min > avail){
      tail = T(L,
        '\n\nNo cabe en un solo día (atendemos de 8:00 AM a 6:00 PM, unas ' + hm(avail) + '): conviene repartirlo en dos citas.',
        '\n\nIt does not fit in a single day (we are open 8:00 AM to 6:00 PM, about ' + hm(avail) + '): it is better to split it into two appointments.');
    } else {
      tail = T(L,
        '\n\nSi empiezas a las 8:00 AM, terminarías hacia las ' + clock(OPEN_MIN + min, L) + '.',
        '\n\nIf you start at 8:00 AM, you would finish around ' + clock(OPEN_MIN + min, L) + '.');
    }
    if (hasAll4 && has('paquete')) tail = '';
    var hint = (has('manicura') && has('pedicura') && !has('paquete') && !hasAll4) ? T(L,
        '\n\nSi quieres manos y pies completos, mira también el **Paquete Luxury Full Service**.',
        '\n\nIf you want complete hands and feet, also take a look at the **Luxury Full Service Package**.') : '';
    var note = has('paquete') && ids.length > 1 ? T(L,
        '\n\nEl paquete ya incluye manos y pies; no incluye pestañas ni cejas.',
        '\n\nThe package already covers hands and feet; it does not include lashes or brows.') : '';
    return {t:T(L,
        '**Servicios elegidos**\n\n' + rows.join('\n') + '\n\n**Total** .. ' + hm(min) + ' · ' + usdRange(lo, hi) + ' USD' + tail + hint + note + '\n\nEs una estimación sumando cada servicio uno tras otro; el tiempo y el precio finales pueden variar según el diseño y los extras.',
        '**Selected services**\n\n' + rows.join('\n') + '\n\n**Total** .. ' + hm(min) + ' · ' + usdRange(lo, hi) + ' USD' + tail + hint + note + '\n\nThis is an estimate adding each service one after the other; final time and price may vary with the design and extras.'),
      acts:[WA_BOOK, go('#reservar-cita','Reservar en línea','Book online')], chips:['precios','duracion','paquete','reservar']};
  };
  R.incluye = function(L, n){
    var s = svcFor(n);
    if (s) return serviceReply(s, L);
    return {t:T(L,'Cuéntame de qué servicio quieres saber qué incluye y te lo detallo.','Tell me which service you\'d like to know about and I\'ll give you the details.'),
      chips:['manicura','manicura-spa','pedicura','pedicura-spa','pestanas','cejas','paquete']};
  };
  R.extras = function(L){ return {t:T(L,
      '**Servicios adicionales**\n\n**Manicura**\nRetiro de sistema (no hecho en AM) .. $2 USD\nDecoración adicional (más de 2 uñas) .. $1 USD\nJelly, tratamiento nutritivo .. $4 USD\nParafina para hidratación intensiva .. $5 USD\n\n**Manicura SPA**\nJelly, tratamiento nutritivo .. $4 USD\n\n**Pedicura**\nParafina para hidratación intensiva .. $6 USD\nPedicura para caballeros .. $10 USD\n\n**Pestañas**\nRetiro de extensiones de pestañas .. $4 USD\n\nLos tratamientos SPA ya incluyen parafina.',
      '**Add-on services**\n\n**Manicure**\nRemoval of a system (not done at AM) .. $2 USD\nAdditional decoration (more than 2 nails) .. $1 USD\nJelly, nourishing treatment .. $4 USD\nParaffin for intensive hydration .. $5 USD\n\n**Manicure SPA**\nJelly, nourishing treatment .. $4 USD\n\n**Pedicure**\nParaffin for intensive hydration .. $6 USD\nMen\'s pedicure .. $10 USD\n\n**Lashes**\nEyelash extension removal .. $4 USD\n\nThe SPA treatments already include paraffin.'),
      acts:[WA_ASK], chips:['precios','servicios','reservar']}; };
  R.horario = function(L){
    var st = openNow(L);
    return {t:T(L,
      'Atendemos de **lunes a viernes, de 8:00 AM a 6:00 PM** (hora de Cuba).' + (st ? '\n\n' + st : '') + '\n\nAgendamos citas con al menos un día de antelación.',
      'We\'re open **Monday to Friday, 8:00 AM to 6:00 PM** (Cuba time).' + (st ? '\n\n' + st : '') + '\n\nWe schedule appointments at least one day in advance.'),
      acts:[WA_BOOK], chips:['reservar','ubicacion','servicios']};
  };
  R.ubicacion = function(L){ return {t:T(L,
      'Estamos en **Calle Coronel Verdugo, entre Ave. 47 y 51, Edif. 15, Esc. 1307, Apto. 7, Brisas del Mar, Cárdenas, Matanzas**.',
      'We\'re at **Calle Coronel Verdugo, between Ave. 47 and 51, Bldg. 15, Stair 1307, Apt. 7, Brisas del Mar, Cárdenas, Matanzas**.'),
      acts:[{k:'link', h:mapsHref(), ext:true, i:'i-globe', l:['Cómo llegar en Google Maps','Directions on Google Maps']}],
      chips:['horario','reservar','contacto']}; };
  R.reservar = function(L){ return {t:T(L,
      'Reservar es muy fácil: usa el formulario de reserva en línea de esta página, escríbenos por WhatsApp o llámanos y te ayudamos a elegir tu horario.\n\nAgendamos con al menos **un día de antelación**, porque trabajamos con planificación para ofrecerte la mejor experiencia. Atendemos de lunes a viernes, de 8:00 AM a 6:00 PM.',
      'Booking is easy: use the online booking form on this page, message us on WhatsApp or call us and we\'ll help you choose a time.\n\nWe book **at least one day in advance**, because we work with planning to offer you the best experience. We\'re open Monday to Friday, 8:00 AM to 6:00 PM.'),
      acts:[go('#reservar-cita','Reservar en línea','Book online'), WA_BOOK, TEL], chips:['servicios','precios','paquete','horario']}; };
  R.contacto = function(L){ return {t:T(L,
      'Puedes contactarnos por estos canales:\n- Teléfono y WhatsApp: +5354117337\n- Correo: amluxury.beautystudio@gmail.com\n- Instagram: @amluxury_beautystudio\n- Facebook: AM Luxury Beauty Studio',
      'You can reach us through:\n- Phone and WhatsApp: +5354117337\n- Email: amluxury.beautystudio@gmail.com\n- Instagram: @amluxury_beautystudio\n- Facebook: AM Luxury Beauty Studio'),
      acts:[WA_ASK, TEL,
        {k:'link', h:'https://www.instagram.com/amluxury_beautystudio?igsi=OGV6anptOGlkanB5', ext:true, l:['Instagram','Instagram']},
        {k:'link', h:'https://www.facebook.com/share/1DpVPgs7Vd/', ext:true, l:['Facebook','Facebook']},
        {k:'link', h:'https://chat.whatsapp.com/HD1x7FHQudJDOXpvvIqarD?s=cl&p=i&mlu=4&ilr=4', ext:true, l:['Grupo de WhatsApp','WhatsApp group']}],
      chips:['reservar','horario','ubicacion']}; };
  R.pago = function(L){ return {t:T(L,
      'Aceptamos **dólares estadounidenses (USD), euros (EUR), dólares canadienses (CAD) y moneda nacional (CUP)**, al cambio del día con respecto al USD.\n\nPara otras formas de pago, escríbenos por WhatsApp.',
      'We accept **US dollars (USD), euros (EUR), Canadian dollars (CAD) and the national currency (CUP)**, at the day\'s exchange rate against the USD.\n\nFor other payment methods, message us on WhatsApp.'),
      acts:[WA_ASK], chips:['precios','reservar','cafe']}; };
  R.cafe = function(L){ return {t:T(L,
      'El **café de cortesía** está incluido en todos nuestros servicios, y en los SPA y el Paquete Luxury lo acompañas con una **bebida premium**.\n\nPara consumo adicional:\n\n**Carta de café**\nExpreso .. 400 CUP\nCortado .. 500 CUP\nCapuchino .. 600 CUP\nBombón .. 700 CUP\nCarajillo (con Baileys) .. 1200 CUP\n\n**Carta de bebidas**\nCopa de vino tinto .. 900 CUP\nCopa de vino blanco .. 900 CUP\nCopa de vino rosado .. 900 CUP\nCopa de champagne .. 700 CUP\nCopa de crema de whisky .. 1200 CUP',
      'The **complimentary coffee** is included in all our services, and with the SPA services and the Luxury Package you also get a **premium drink**.\n\nFor additional consumption:\n\n**Coffee menu**\nEspresso .. 400 CUP\nCortado .. 500 CUP\nCappuccino .. 600 CUP\nBombón .. 700 CUP\nCarajillo (with Baileys) .. 1200 CUP\n\n**Drinks menu**\nGlass of red wine .. 900 CUP\nGlass of white wine .. 900 CUP\nGlass of rosé wine .. 900 CUP\nGlass of champagne .. 700 CUP\nGlass of whisky cream .. 1200 CUP'),
      acts:[go('#cafe','Ver en la web','See on the site')], chips:['servicios','paquete','reservar']}; };
  R.equipo = function(L){ return {t:T(L,
      'Nuestro equipo de especialistas:\n\n**Melissa Araujo** · Manicure & Pedicure Specialist. Especialista en técnicas de spa y tratamientos de lujo para manos y pies.\n\n**Dave Guillemi** · Lashes & Brows Specialist. Especialista en extensiones de pestañas y diseño de cejas personalizado.',
      'Our team of specialists:\n\n**Melissa Araujo** · Manicure & Pedicure Specialist. Specialist in spa techniques and luxury treatments for hands and feet.\n\n**Dave Guillemi** · Lashes & Brows Specialist. Specialist in eyelash extensions and personalized brow design.'),
      acts:[go('#equipo','Conocer al equipo','Meet the team')], chips:['servicios','reservar']}; };
  R.galeria = function(L){ return {t:T(L,
      'Puedes ver fotos de nuestros trabajos en la galería y filtrarlas por servicio.',
      'You can see photos of our work in the gallery and filter them by service.'),
      acts:[go('#galeria','Abrir la galería','Open the gallery'),
        {k:'link', h:'https://www.instagram.com/amluxury_beautystudio?igsi=OGV6anptOGlkanB5', ext:true, l:['Ver Instagram','See Instagram']}],
      chips:['manicura','pedicura','pestanas','cejas']}; };
  R.resenas = function(L){ return {t:T(L,
      'En la sección de reseñas puedes leer la experiencia de nuestros clientes. Y si ya nos visitaste, al final de la página puedes dejar tu evaluación de 1 a 5 estrellas.',
      'In the reviews section you can read our clients\' experiences. And if you\'ve already visited us, you can leave a 1 to 5 star rating at the bottom of the page.'),
      acts:[go('#resenas','Ver reseñas','Read reviews'), go('#eval-title','Evaluar el servicio','Rate our service')],
      chips:['servicios','reservar']}; };
  R.quejas = function(L){ return {t:T(L,
      'Tu opinión nos ayuda a mejorar. Puedes enviarnos una queja o sugerencia desde su página.',
      'Your feedback helps us improve. You can send us a complaint or suggestion from its page.'),
      acts:[{k:'link', h:'quejas-y-sugerencias.html', l:['Quejas y sugerencias','Complaints and suggestions']}, WA_ASK],
      chips:['contacto']}; };
  R.legal = function(L){ return {t:T(L,
      'Puedes consultar nuestra Política de Privacidad y los Términos y Condiciones en estas páginas.',
      'You can read our Privacy Policy and Terms and Conditions on these pages.'),
      acts:[{k:'link', h:'politica-de-privacidad.html', l:['Política de Privacidad','Privacy Policy']},
            {k:'link', h:'terminos-y-condiciones.html', l:['Términos y Condiciones','Terms and Conditions']}],
      chips:['contacto']}; };
  R.llevar = function(L){ return {t:T(L,
      'No necesitas llevar nada, nosotras tenemos todo listo. Si quieres un diseño en particular, puedes traer o enviarnos una foto de referencia.',
      'You don\'t need to bring anything, we have everything ready. If you want a particular design, you can bring or send us a reference photo.'),
      acts:[WA_ASK], chips:['reservar','servicios']}; };
  R.tarde = function(L){ return {t:T(L,
      'Te pedimos puntualidad para respetar el horario de las demás clientas. Si vas a retrasarte, avísanos por WhatsApp lo antes posible y vemos cómo ajustar tu cita.',
      'We kindly ask you to be on time, out of respect for our other clients\' schedules. If you\'re going to be late, let us know on WhatsApp as soon as possible and we\'ll see how to adjust your appointment.'),
      acts:[{k:'wa', l:['Avisar por WhatsApp','Let us know on WhatsApp'], m:['Hola, voy a llegar tarde a mi cita en AM Luxury Beauty Studio.','Hello, I\'m going to be late for my appointment at AM Luxury Beauty Studio.']}],
      chips:['reservar','horario']}; };
  R.cancelar = function(L){ return {t:T(L,
      'Sí. Escríbenos por WhatsApp con la mayor anticipación posible para reprogramar o cancelar, así podemos ofrecer ese horario a otra persona.',
      'Yes. Message us on WhatsApp as far in advance as possible to reschedule or cancel, so we can offer that time to someone else.'),
      acts:[{k:'wa', l:['Cambiar o cancelar mi cita','Change or cancel my appointment'], m:['Hola, necesito reprogramar o cancelar mi cita en AM Luxury Beauty Studio.','Hello, I need to reschedule or cancel my appointment at AM Luxury Beauty Studio.']}],
      chips:['reservar','horario']}; };
  R.catalogo = function(L){ return {t:T(L,
      'Tenemos un catálogo de servicios en PDF con todo el detalle.',
      'We have a PDF catalog of our services with all the details.'),
      acts:[{k:'link', h:'doc/Catalogo_AM_BEAUTY_STUDIO.pdf', ext:true, l:['Catálogo de Servicios PDF','Catalog of Service PDF']}], chips:['servicios','precios']}; };
  R.producto = function(L){ return {t:T(L,
      'Tenemos un catálogo de productos en PDF con todo el detalle.',
      'We have a PDF catalog of products for sale, complete with full details.'),
      acts:[{k:'link', h:'doc/Catalogo de Productos.pdf', ext:true, l:['Catálogo de Productos en Venta','Catalog of products for Sale']}], chips:['productos','precios']}; };
 
 R.colores = function(L){ return {t:T(L,
      '¡Tenemos una gran variedad de colores! Contamos con esmaltes en gel, acrílico y dual system en tonos nude, rojos, rosas, oscuros, brillantes y mates.\n\nComo los colores se ven mejor en persona, te invitamos a ver nuestro **muestrario físico** en el estudio al llegar a tu cita. Si quieres ver algunos de nuestros tonos favoritos, puedes revisar nuestras fotos en Instagram.',
      'We have a wide variety of colors! We have gel, acrylic and dual system polishes in nude, red, pink, dark, glitter and matte shades.\n\nSince colors look best in person, we invite you to see our **physical color chart** at the studio when you arrive for your appointment. If you want to see some of our favorite shades, you can check our photos on Instagram.'),
      acts: [
        go('#galeria', 'Ver fotos en la galería', 'See photos in the gallery'),
        {k:'link', h:'https://www.instagram.com/amluxury_beautystudio?igsi=OGV6anptOGlkanB5', ext:true, l:['Ver colores en Instagram', 'See colors on Instagram']},
        WA_ASK
      ],
      chips: ['manicura', 'precios', 'reservar', 'servicios']};};


  R.marcas = function(L){ return {t:T(L,
        'Trabajamos exclusivamente con **productos profesionales de alta gama**, libres de químicos agresivos para cuidar la salud de tu uña natural.\n\nUtilizamos marcas reconocidas del mercado y aplicamos las técnicas correctas para que tu uña respire y no se debilite. Si tienes algún tipo de alergia o piel sensible, avísanos al reservar para elegir el producto adecuado para ti.',
        'We work exclusively with **high-end professional products**, free of harsh chemicals to care for the health of your natural nail.\n\nWe use recognized market brands and apply the correct techniques so your nail breathes and doesn\'t weaken. If you have any allergies or sensitive skin, let us know when booking so we can choose the right product for you.'),
      acts: [WA_ASK],
      chips: ['alergias', 'servicios', 'reservar']
    };
  };

  R.estilos = function(L){
    return {
      t: T(L,
        '¡Podemos hacer volar tu imaginación! Contamos con especialistas en diseños como:\n\n- **Uñas:** French clásico, baby boomer, efecto ojo de gato, cromo (espejo), mármol, degradados y pedrería.\n- **Cejas:** Diseño según tu rostro, laminado (efecto pelo a pelo) y henna.\n\nSi tienes una idea en mente, puedes traer una **foto de referencia** a tu cita para que la especialista logre exactamente lo que buscas.',
        'We can let your imagination fly! We have specialists in designs like:\n\n- **Nails:** Classic French, baby boomer, cat eye effect, chrome (mirror), marble, ombre, and rhinestones.\n- **Brows:** Design according to your face, lamination (hair-by-hair effect), and henna.\n\nIf you have an idea in mind, you can bring a **reference photo** to your appointment so the specialist can achieve exactly what you are looking for.'),
      acts: [go('#galeria', 'Ver trabajos en la galería', 'See work in the gallery'), WA_ASK],
      chips: ['manicura', 'cejas', 'catalogo-colores', 'reservar']
    };
  };

    R.promociones = function(L){
    return {
      t: T(L,
        'actualmente no manejamos promociones fijas, pero sí te recomendamos seguirnos en **Instagram (@amluxury_beautystudio)** donde anunciamos ofertas especiales por fechas festivas (Día de las Madres, San Valentín, etc.).',
        'we currently do not have fixed promotions, but we recommend following us on **Instagram (@amluxury_beautystudio)** where we announce special offers for festive dates (Mother\'s Day, Valentine\'s Day, etc.).'),
      acts: [
        {k:'link', h:'https://www.instagram.com/amluxury_beautystudio?igsi=OGV6anptOGlkanB5', ext:true, l:['Ver Instagram', 'See Instagram']},
        WA_ASK
      ],
      chips: ['paquete', 'precios', 'reservar']
    };
  };

    R.idioma = function(L){
    var acts = [];
    if (document.querySelector('.lang-switch [data-lang]')){
      var to = siteLang() === 'en' ? 'es' : 'en';
      acts.push({k:'lang', to:to, l:['Cambiar la web a ' + (to === 'en' ? 'inglés' : 'español'), 'Switch the site to ' + (to === 'en' ? 'English' : 'Spanish')]});
    }
    acts.push(WA_ASK);
    return {t:T(L,
      'La web está disponible en **español e inglés**: puedes cambiar el idioma con el selector ES/EN de la cabecera. Yo te respondo en el idioma en que me escribas.',
      'The site is available in **Spanish and English**: you can switch the language with the ES/EN selector in the header. I\'ll reply in the language you write to me in.'),
      acts:acts, chips:DEFAULT_CHIPS};
  };

  function fallback(L, raw){
    var q = String(raw || '').replace(/\s+/g, ' ').slice(0, 160);
    return {t:T(L,
      'Todavía no tengo ese dato. Para darte la información correcta, escríbenos por WhatsApp y el equipo te responderá. Mientras tanto, puedo ayudarte con servicios, precios, horario, ubicación y reservas.',
      'I don\'t have that information yet. To give you the right answer, message us on WhatsApp and the team will reply. In the meantime, I can help with services, prices, hours, location and bookings.'),
      acts:[{k:'wa', l:['Preguntar por WhatsApp','Ask on WhatsApp'],
        m:['Hola, tengo una duda sobre AM Luxury Beauty Studio: "' + q + '"','Hello, I have a question about AM Luxury Beauty Studio: "' + q + '"']}],
      chips:DEFAULT_CHIPS};
  }

  /* ----------------- comprensión de la pregunta ----------------- */
  var ORDER = [], PAT = {};
  function def(id, list){
    ORDER.push(id);
    PAT[id] = list.map(function(p){
      var s = p[0];
      return [new RegExp(s.charAt(0) === '^' ? s : '\\b(?:' + s + ')'), p[1]];
    });
  }
  function scoreAll(n, ids){
    var list = ids || ORDER, best = null, bs = 0;
    for (var i = 0; i < list.length; i++){
      var s = 0, pl = PAT[list[i]];
      for (var j = 0; j < pl.length; j++){ if (pl[j][0].test(n)) s += pl[j][1]; }
      if (s > bs){ bs = s; best = list[i]; }
    }
    return {id:best, score:bs};
  }

  // --- LÉXICO AMPLIADO BASADO EN EL CATÁLOGO ---
  
  def('yo', [
    ['quien eres',4],['como te llamas',4],['tu nombre',3],
    ['eres (?:un |una )?(?:robot|bot|persona|humano|ia)\\b',4],
    ['who are you',4],['your name',3],
    ['are you (?:a |an )?(?:bot|robot|human|real|ai)\\b',4],
    ['inteligencia artificial',3],['margarita',2],
    ['asistente virtual',3],['bot\\b',2],['asistente\\b',2]
  ]);

  def('ayuda', [
    ['ayuda',2],['help',2],['que puedes',3],['what can you',3],
    ['en que (?:me )?(?:puedes|ayudas)',3],['como funcionas',3],
    ['opciones',2],['que puedo preguntar',3],['informacion',2]
  ]);

  def('precios', [
    ['precios?',3],['cuestan?',3],['cuanto (?:cuesta|cobran|vale|es|sale|cobras)',3],
    ['cuanto',1],['costos?',3],['tarifas?',3],['prices?',3],['costs?',3],
    ['how much',3],['valor',2],['cobran',3],['\\$',1],
    ['presupuesto',2],['cuanto sale',3],['cuanto es',3],['tarifa',3]
  ]);

    def('promociones', [
    ['tarjeta de regalo', 4], ['gift card', 4], ['vale de regalo', 4],
    ['descuento', 3], ['promocion', 3], ['promo', 3], ['oferta', 3],
    ['rebaja', 3], ['cupon', 3], ['precio especial', 3],
    ['regalar a alguien', 3], ['cumpleanos', 2], ['black friday', 3]
  ]);

  def('duracion', [
    ['dura',3],['duracion',3],['cuanto tiempo',3],['tarda',3],
    ['demora',3],['how long',3],['duration',3],['takes how',3],
    ['cuanto demora',3],['cuanto tarda',3],['minutos',1],['horas',1]
  ]);

  def('incluye', [
    ['incluy',3],['incluid',3],['includes?',3],['included',3],
    ['viene con',2],['trae',1],['que incluye',3],['que trae',3],
    ['que viene',2],['detalles',2],['que contiene',3]
  ]);

  def('extras', [
    ['adicional',3],['extras?',3],['parafina',3],['jelly',3],
    ['retiro',3],['remocion',3],['quitar',2],['remover',2],
    ['removal',3],['remove',3],['paraffin',3],['decoracion',2],
    ['add ?ons?',2],['agregar',2],['sumar',2],['retiro de sistema',4],
    ['servicios adicionales',3]
  ]);

  def('manicura', [
    ['manicur',3],['mani\\b',2],['nails?\\b',2],['unas',1],['uñas',1],
    ['esmalt',2],['gel\\b',2],['dual',2],['softgel',2],
    ['builder',2],['estandar',1],['standard',1],
    ['dual system',4],['builder gel',4],['tecnica combinada',4],
    ['acrilico',3],['polygel',3],['esculpidas',3],['tradicional',2],
    ['rusa',2],['francesa',2],['french',2],['postizas',2],['tips',2],
    ['catalogo de colores',4],
  ]);

  def('colores', [
    ['catalogo de colores', 4], ['carta de colores', 4], 
    ['paleta de colores', 4], ['muestrario de colores', 4],
    ['que colores (?:tienen|hay|manejan)', 4], 
    ['tienen colores', 3], ['opciones de color', 3],
    ['ver colores', 3], ['tonos de esmalte', 4], 
    ['tonos disponibles', 4], ['que esmaltes tienen', 4],
    ['colores de gel', 4], ['colores de unas', 3],
    ['que tonos hay', 3], ['me pueden mostrar los colores', 4],
    ['tienen muestra de colores', 4], ['color chart', 4],
    ['color catalog', 4], ['what colors do you have', 4],
    ['nail polish colors', 4], ['colors available', 4], 
    ['shade chart', 4], ['gel colors', 3], ['see colors', 3]
  ]);

    def('estilos', [
    ['frances', 4], ['french', 4], ['baby boomer', 4], ['chrome', 4],
    ['ojo de gato', 4], ['cat eye', 4], ['marmol', 3], ['marbling', 3],
    ['degradado', 3], ['ombre', 3], ['pedreria', 3], ['brillantes', 3],
    ['efecto espejo', 4], ['aurora', 4], ['decoracion', 3],
    ['puedo hacerme un diseno', 3], ['hacen nail art', 4]
  ]);

  def('manicura-spa', [
    ['manicur',3],['mani\\b',2],['spa\\b',2],['premium',1],
    ['velo',1],['ozono|ozone',1],['sales minerales',4],
    ['perlas',3],['bolas efervescentes',4],['mascarilla',2],['exfoliacion',2]
  ]);

  def('pedicura', [
    ['pedicur',3],['pedi\\b',2],['pies?\\b',2],['callos?',2],
    ['caballeros?',3],['hombres?',1],['men\\b',1],
    ['toes?\\b|feet\\b|foot\\b',2],['hidromasaje|hydromassage',2],
    ['estandar',1],['standard',1],['durezas',3],['tina',2],
    ['pedicura caballeros',4]
  ]);

  def('pedicura-spa', [
    ['pedicur',3],['pedi\\b',2],['spa\\b',2],['pies?\\b',1],
    ['fascia',2],['termoterapia|thermotherapy',2],['ocular|eye massag',1],
    ['toallas calientes',3],['pistola de masaje',4],['masajeador ocular',4]
  ]);

  def('pestanas', [
    ['pestan',3],['lash',3],['eyelash',3],['extension',3],
    ['[2-6]d\\b',3],['yy\\b',2],['volumen|volume',2],
    ['retoque|touch ?up',2],['set nuevo|new set',2],
    ['pelo a pelo',3],['efecto mojado',3],['rusas',2],['hibridas',2]
  ]);

  def('cejas', [
    ['cejas?',3],['brows?\\b',3],['laminad',3],['lamination',3],
    ['henna|jena',3],['depil',2],['waxing|wax\\b',2],['bozo',3],
    ['barbilla|chin\\b',3],['tinte|tint\\b',2],['castor',2],
    ['parches hidratantes',4],['perfilado',3],['microblading',3]
  ]);

  def('paquete', [
    ['paquete',3],['package',3],['full service',3],['luxury',1],
    ['combo',2],['completo',1],['todo incluido',2],['manos y pies',3],['ritual',2]
  ]);

  def('horario', [
    ['horarios?',3],['\\bhora',1],['abre',3],['abren',3],
    ['abiert',3],['cierr',3],['atienden',3],['atiende',2],
    ['atencion',2],['open',2],['opening',3],['hours',3],
    ['closing',3],['closed',2],['schedule',3],
    ['lunes|martes|miercoles|jueves|viernes|sabado|domingo',2],
    ['fin de semana',3],['weekend',3],
    ['monday|tuesday|wednesday|thursday|friday|saturday|sunday',2],
    ['feriados?|holidays?',2],['lunes a viernes',4],['8:00',3],['6:00',3],['hora cuba',3]
  ]);

  def('ubicacion', [
    ['donde',3],['direccion',3],['ubicacion',3],['ubicad',3],['escalera',3],['apartamento',3],['en que piso',3],
    ['llegar',2],['como llego',3],['mapa',3],['map\\b',3],
    ['location',3],['address',3],['where',3],['brisas',3],
    ['cardenas',3],['matanzas',3],['queda',2],['cerca',1],
    ['find you',3],['located',3],['directions?',3],
    ['coronel verdugo',4],['ave 47',4],['edif 15',4],['apto 7',4],
    ['punto de referencia',3],['al lado de',2],
    ['cerca de la motelera',3],['en la calle',2],['edificio',2]
  ]);

  def('reservar', [
    ['reserv',3],['citas?\\b',3],['agend',3],['turno',2],
    ['book',3],['appointments?',3],['apart(?:ar|o)',2],
    ['disponib',3],['available|availability',3],['booking',3],
    ['antelacion',2],['sacar cita',3],['agendar cita',3],['apartar cita',3],    
    ['hay cupo para hoy',4],['puedo ir hoy',4],['para manana',3],
    ['sin cita previa',4],['walk in',4],['pasar sin cita',4],
    ['cita urgente',4],['lo antes posible',3],['esta semana',3],
    ['el fin de semana',3],['proximo sabado',3]
  ]);

    def('marcas', [
    ['que marca (?:usan|tienen|es)', 4], ['marcas de', 3],['que marcas', 3],
    ['usan opi', 4], ['usan cnd', 4], ['usan gelish', 4],
    ['hema free', 4], ['libre de hema', 4], ['productos hipoalergenicos', 4],
    ['danan la una', 4], ['hace dano', 3], ['es malo para las unas', 3],
    ['calidad de los productos', 4], ['productos profesionales', 3]
  ]);

  def('cancelar', [
    ['cancel',4],['reprogram',4],['reagend',4],
    ['cambiar (?:mi |la |de )?(?:cita|hora|fecha|dia)',4],
    ['cambio de (?:cita|hora|fecha|dia)',4],
    ['mover (?:mi |la )?cita',4],['reschedule',4],
    ['postpone|posponer|aplazar',4],
    ['change (?:my )?(?:appointment|booking|date|time)',4],
    ['no puedo (?:ir|asistir|llegar)',3],['anular',4],['cancelar',4],
    ['me surgio un imprevisto',4],['tuve una emergencia',4],
    ['no voy a poder asistir',4],['no me queda tiempo',3],
    ['se me presento algo',4],['cancelar por enfermedad',4]
  ]);

  def('tarde', [
    ['llego tarde',4],['llegar tarde',4],['tarde\\b',1],['retras',3],
    ['atras',2],['late\\b',3],['delay',3],['puntual',3],['punctual',3],
    ['tardo',2],['puntualidad',3],['retraso',3]
  ]);

  def('llevar', [
    ['llevar',3],['llevo',3],['traer',3],['traigo',3],
    ['bring',3],['necesito (?:algo|llevar|traer)',2],
    ['foto de referencia',4],['referencia',3],['reference',3],
    ['antes de (?:la |mi )?(?:cita|visita)',2],['que necesito',2]
  ]);

  def('contacto', [
    ['contact',3],['telefono',3],['llamar',3],['llamada',2],
    ['numero',2],['whatsapp',2],['wasap|watsap|whats\\b',2],
    ['instagram|insta\\b',3],['facebook|face\\b',3],['redes',3],
    ['social',3],['phone',3],['call\\b',2],['email|correo|mail',3],
    ['grupo|group',2],['hablar',2],['humano|human\\b',3],
    ['agente|agent\\b',3],['alguien',2],['operador',3],
    ['persona real|real person',3],['\\+53',4],['54117337',4],['amluxury_beautystudio',4]
  ]);

  def('pago', [
    ['pago',3],['pagar',3],['pagan',3],['pague',3],
    ['efectivo',3],['tarjeta',3],['transferencia',3],
    ['dolar',3],['euro',2],['cup\\b',3],['usd\\b',2],
    ['eur\\b',2],['cad\\b',2],['moneda',3],['cambio',2],
    ['payment',3],['pay\\b',3],['cash',3],['card\\b',3],
    ['currency',3],['aceptan',2],['accept',2],['mlc',3],
    ['zelle|paypal',3],['moneda nacional',3],['divisas',2],
    ['transfermovil',4],['enzona',4],['pago movil',4],
    ['tarjeta de credito',4],['visa',4],['mastercard',4],
    ['se puede pagar con',4],['aceptan divisas',4]
  ]);

  def('cafe', [
    ['cafe',4],['coffee',4],['bebidas?',4],['drinks?',3],
    ['copa',4],['vino',4],['wine',4],['champ',4],
    ['whisk',4],['baileys',4],['carajillo',4],
    ['expreso|espresso',4],['cortado',3],['capuchino|cappuccino',3],
    ['bombon',4],['cortesia',2],['complimentary',2],['alcohol',2],
    ['vino tinto',4],['vino blanco',4],['rosado',3],['champagne',4]
  ]);

  def('equipo', [
    ['equipo',3],['especialista',3],['quien',2],['quienes',3],
    ['melissa',3],['dave',3],['team',3],['staff',3],
    ['specialist',3],['manicurista',3],['araujo',3],['guillemi',3],['lash & brows',4]
  ]);

  def('galeria', [
    ['fotos?',3],['galeria',3],['trabajos',3],['portfolio|portafolio',3],
    ['gallery',3],['photos?',3],['ejemplos?',2],['disenos?',2],
    ['resultados?',1],['antes y despues',3],['before and after',3],
    ['pictures?|pics?',3]
  ]);

  def('resenas', [
    ['resenas?',3],['opinion',3],['evalu',3],['estrella',3],
    ['reviews?',3],['rating',3],['valoracion',3],['testimon',3],
    ['calific',3],['comentarios?',2]
  ]);

  def('quejas', [
    ['queja',4],['sugerenc',4],['reclam',4],['complain',4],
    ['suggestion',4],['feedback',2],['disconform',3],['mala experiencia',3]
  ]);

  def('legal', [
    ['privacidad',4],['privacy',4],['datos personales',3],
    ['terminos',4],['condiciones',4],['terms',4],
    ['conditions',3],['politica',2]
  ]);

  def('catalogo', [
    ['catalog',3],['pdf',3],['brochure',3],['carta de servicios',3],['lista de precios',2],['catalogo',3]
  ]);

  def('producto', [
    ['catalog',3],['producto',3],['para vender',3],['carta de productos',3],['lista de precios',2]
  ]);

  def('idioma', [
    ['ingles',3],['english',3],['idioma',3],['language',3],
    ['espanol',3],['spanish',3],['traduc',3],['translate',3],['hablan',2]
  ]);

  def('acerca', [
    ['quienes son',3],['sobre (?:ustedes|el estudio|nosotros)',3],
    ['about (?:you|us|the studio)',3],['que es am',3],
    ['historia',2],['acerca',3],['de que trata',2],['am luxury',3]
  ]);

  def('spa', [
    ['spa\\b',3],['masajes?',2],['massages?',2],['relaj',1],['tratamiento spa',3]
  ]);

  def('servicios', [
    ['servicios?',3],['services?',3],['que (?:ofrecen|hacen|tienen|incluyen)',3],
    ['ofrec',3],['offer',3],['tratamientos?',3],['treatments?',3],
    ['menu',2],['opciones',1],['que servicios',3],
    ['que me recomiendan',3],['cual es el mas popular',4],
    ['el mas vendido',4],['el mas completo',4],['el mas economico',4],
    ['que servicio es mejor para mi',4],['necesito una asesoria',4]
  ]);

  def('saludo', [
    ['^(?:hola|holaa|ola|buenas|buenos|hello|hi|hey|saludos|buen dia|como estas)\\b',2]
  ]);

  def('gracias', [
    ['gracias',3],['thank',3],['thx',3],['genial',2],
    ['perfecto',2],['excelente',2],['awesome|great',2],['ok\\b',2],
    ['vale\\b',2],['entendido',2],['listo\\b',2],['muy bien',2],['es un placer',2],['que buena eres',2],['que mala eres',2]
  ]);

  def('adios', [
    ['adios',3],['chao',3],['hasta (?:luego|pronto|manana)',3],
    ['bye',3],['goodbye',3],['nos vemos',3]
  ]);

  def('ofensa', [
    ['puta',3],['pinga',3],['comemierda',3],['comepinga',3],
    ['estupida',3],['anormal',3],['guanaja',3],['boba',3],
    ['loca',3],['perra',3],['arrebatada',3],['mierda',3],
    ['prostituta',3],['idiota',3]
  ]);

  // --- DICCIONARIOS DE IDIOMA ACTUALIZADOS ---
  var ES_HINT = /\b(hola|que|como|cuanto|cuesta|donde|cual|cuales|quiero|quisiera|puedo|tienen|ustedes|gracias|buenas|buenos|precio|precios|horario|cita|servicios|abren|estan|esta|para|por|una|los|las|del|con|mi|su|se|me|manicura|pedicura|pestañas|cejas|spa|reserva|ubicacion)\b/g;
  var EN_HINT = /\b(the|what|how|much|where|when|which|hours|open|book|appointment|price|prices|do|does|you|your|can|could|would|hello|hi|thanks|thank|services|is|are|there|have|with|for|my|please|i|want|need|manicure|pedicure|lashes|brows|spa|booking|location)\b/g;

  function detect(n){
    var es = (n.match(ES_HINT) || []).length, en = (n.match(EN_HINT) || []).length;
    if (en > es && en >= 1) return 'en';
    if (es > en) return 'es';
    return siteLang();
  }



  /* ---------- interfaz ---------- */
  var launcher = $('mg-launcher'), panel = $('mg-panel'), log = $('mg-log'), chipsEl = $('mg-chips'),
      form = $('mg-form'), input = $('mg-input'), sendBtn = $('mg-send'), hint = $('mg-hint');
  var curLang = siteLang(), curChips = DEFAULT_CHIPS, busy = false, opened = false, started = false, hist = [];

  function ui(key){ return UI[siteLang()][key]; }
  function applyUI(){
    var L = siteLang();
    [].forEach.call(root.querySelectorAll('[data-mg]'), function(e){ e.textContent = UI[L][e.getAttribute('data-mg')]; });
    [].forEach.call(root.querySelectorAll('[data-mg-ph]'), function(e){ e.setAttribute('placeholder', UI[L][e.getAttribute('data-mg-ph')]); });
    [].forEach.call(root.querySelectorAll('[data-mg-aria]'), function(e){ e.setAttribute('aria-label', UI[L][e.getAttribute('data-mg-aria')]); });
    launcher.setAttribute('aria-label', opened ? UI[L].close : UI[L].open);
    launcher.title = opened ? UI[L].close : UI[L].open;
  }

  function inline(node, s){
    s.split(/\*\*(.+?)\*\*/).forEach(function(part, k){
      if (!part) return;
      if (k % 2) node.appendChild(el('b', null, part)); else node.appendChild(document.createTextNode(part));
    });
  }
  function renderText(str){
    var frag = document.createDocumentFragment();
    String(str).split(/\n\n+/).forEach(function(par){
      var lines = par.split('\n'), i = 0;
      while (i < lines.length){
        var ln = lines[i];
        if (/^- /.test(ln)){
          var ul = el('ul');
          while (i < lines.length && /^- /.test(lines[i])){ var li = el('li'); inline(li, lines[i].slice(2)); ul.appendChild(li); i++; }
          frag.appendChild(ul);
        } else if (ln.indexOf(' .. ') > -1){
          var rows = el('div', 'mg-rows');
          while (i < lines.length && lines[i].indexOf(' .. ') > -1){
            var parts = lines[i].split(' .. '), r = el('div', 'mg-row'), sp = el('span');
            inline(sp, parts[0]); r.appendChild(sp); r.appendChild(el('i')); r.appendChild(el('b', null, parts[1])); rows.appendChild(r); i++;
          }
          frag.appendChild(rows);
        } else {
          var p = el('p'), first = true;
          while (i < lines.length && !/^- /.test(lines[i]) && lines[i].indexOf(' .. ') < 0){
            if (!first) p.appendChild(document.createElement('br'));
            inline(p, lines[i]); first = false; i++;
          }
          frag.appendChild(p);
        }
      }
    });
    return frag;
  }

  function scrollLog(msg){
    var top = log.scrollHeight;
    if (msg && msg.offsetHeight > log.clientHeight * 0.7) top = Math.max(0, msg.offsetTop - 10);
    if (log.scrollTo && !reduce) log.scrollTo({top:top, behavior:'smooth'}); else log.scrollTop = top;
  }
  function botAvatar(){
    var pic = el('span', 'mg-pic'); pic.setAttribute('aria-hidden', 'true');
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 100 100');
    var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#mg-flor'); s.appendChild(u); pic.appendChild(s);
    return pic;
  }
  function closeIfSmall(){ if (isSmall()) setOpen(false); }
  function scrollToSel(sel){
    var t = document.querySelector(sel); if (!t) return;
    closeIfSmall();
    if (sel === '#reservar-cita' && window.AMReserva){ setTimeout(function(){ window.AMReserva.open(); }, isSmall() ? 260 : 0); return; }
    setTimeout(function(){ t.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'}); }, isSmall() ? 260 : 0);
  }
  function mkAct(a, L){
    var i = ix(L), label = a.l[i], n;
    if (a.k === 'wa'){
      n = el('a', 'mg-act mg-act--wa'); n.href = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(a.m[i]);
      n.target = '_blank'; n.rel = 'noopener'; n.appendChild(icon('i-msg'));
    } else if (a.k === 'tel'){
      n = el('a', 'mg-act'); n.href = 'tel:+' + PHONE; n.appendChild(phoneIcon());
    } else if (a.k === 'link'){
      n = el('a', 'mg-act'); n.href = a.h; if (a.ext){ n.target = '_blank'; n.rel = 'noopener'; }
      n.appendChild(icon(a.i || 'i-arrow-r'));
    } else {
      n = el('button', 'mg-act'); n.type = 'button';
      n.appendChild(icon(a.k === 'gal' ? 'i-photos' : a.k === 'lang' ? 'i-globe' : 'i-arrow-r'));
      n.addEventListener('click', function(){
        if (a.k === 'go') scrollToSel(a.s);
        else if (a.k === 'gal'){
          var g = document.querySelector('[data-gal-filter="' + a.f + '"]');
          closeIfSmall();
          if (g) setTimeout(function(){ g.click(); }, isSmall() ? 260 : 0); else scrollToSel('#galeria');
        } else if (a.k === 'lang'){
          var b = document.querySelector('.lang-switch [data-lang="' + a.to + '"]'); if (b) b.click();
        }
      });
    }
    n.appendChild(document.createTextNode(label));
    return n;
  }
  function renderChips(ids){
    curChips = ids || [];
    chipsEl.textContent = '';
    curChips.forEach(function(id){
      if (!CHIP[id]) return;
      var lbl = CHIP[id][curLang === 'en' ? 'en' : 'es'];
      var b = el('button', 'mg-chip', lbl); b.type = 'button';
      b.addEventListener('click', function(){ ask(id, lbl); });
      chipsEl.appendChild(b);
    });
    chipsEl.scrollLeft = 0;
  }
  function addUser(text){
    var m = el('div', 'mg-msg mg-msg--me'), c = el('div', 'mg-col'), b = el('div', 'mg-bub'); b.textContent = text;
    c.appendChild(b); m.appendChild(c); log.appendChild(m); scrollLog(m);
  }
  function addBot(r){
    var m = el('div', 'mg-msg mg-msg--bot'), c = el('div', 'mg-col'), b = el('div', 'mg-bub');
    b.appendChild(renderText(r.t)); c.appendChild(b);
    if (r.acts && r.acts.length){
      var ac = el('div', 'mg-acts');
      r.acts.forEach(function(a){ ac.appendChild(mkAct(a, curLang)); });
      c.appendChild(ac);
    }
    m.appendChild(botAvatar()); m.appendChild(c); log.appendChild(m);
    renderChips(r.chips || DEFAULT_CHIPS);
    scrollLog(m);
    hist.push({role:'assistant', content:r.t});
  }
  function typing(){
    var m = el('div', 'mg-msg mg-msg--bot'), c = el('div', 'mg-col'), b = el('div', 'mg-bub'), t = el('span', 'mg-typing');
    m.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) t.appendChild(el('span'));
    b.appendChild(t); c.appendChild(b); m.appendChild(botAvatar()); m.appendChild(c); log.appendChild(m); scrollLog(m);
    return m;
  }
  function setBusy(v){ busy = v; sendBtn.disabled = v; }
  function deliver(r, delayChars){
    setBusy(true);
    var t = typing();
    setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); addBot(r); setBusy(false); },
      reduce ? 120 : Math.min(1000, 350 + (delayChars || 120) * 2));
  }
  function serverAsk(text, L, cb){
    var done = false;
    var to = setTimeout(function(){ if (!done){ done = true; cb(null); } }, 12000);
    try {
      fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:text, lang:L, history:hist.slice(-8)})})
        .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
        .then(function(j){ if (done) return; done = true; clearTimeout(to); cb(j && j.reply ? {t:String(j.reply), chips:DEFAULT_CHIPS, acts:[WA_ASK]} : null); })
        .catch(function(){ if (done) return; done = true; clearTimeout(to); cb(null); });
    } catch(e){ clearTimeout(to); cb(null); }
  }

  /* Envío de una pregunta escrita (id = null) o de un botón sugerido (id = clave) */
  function ask(id, label){
    if (busy) return;
    var raw = label != null ? label : input.value;
    raw = String(raw || '').trim();
    if (!raw) return;
    var n = norm(raw);
    if (id == null) curLang = detect(n);
    addUser(raw); hist.push({role:'user', content:raw});
    if (id == null) input.value = '';
    var key = id, score = 99;
    if (key == null){
      var best = scoreAll(n);
      // "¿Cuánto dura el paquete?": si pregunta por duración o precio de un servicio, gana la pregunta, no el nombre del servicio
      if (SVC_IDS.indexOf(best.id) > -1){
        var attr = scoreAll(n, ['duracion','precios']);
        if (attr.score >= 3) best = attr;
      }
      key = best.id; score = best.score;
      var dk = deduceKey(n);        // combinaciones, totales, ahorro, si cabe en un día…
      if (dk){ key = dk; score = 99; }
    }
    if (key && score >= 2 && R[key]){
      var r = R[key](curLang, id == null ? n : '', raw);
      deliver(r, r.t.length / 2);
      return;
    }
    if (ENDPOINT){
      setBusy(true);
      var t = typing();
      serverAsk(raw, curLang, function(r){
        if (t.parentNode) t.parentNode.removeChild(t);
        addBot(r || fallback(curLang, raw)); setBusy(false);
      });
      return;
    }
    deliver(fallback(curLang, raw), 80);
  }

  /* Abrir / cerrar */
  function setOpen(v){
    opened = !!v;
    root.classList.toggle('is-open', opened);
    launcher.setAttribute('aria-expanded', String(opened));
    launcher.setAttribute('aria-label', opened ? ui('close') : ui('open'));
    launcher.title = opened ? ui('close') : ui('open');
    if (opened){
      hideHint(true);
      if (!started){
        started = true;
        var L = siteLang();
        curLang = L;
        addBot({t:T(L,
          '¡Hola! Soy **Margarita**, la asistente virtual de AM Luxury Beauty Studio.\n\nPuedo contarte sobre nuestros servicios, precios, horario y ubicación, o ayudarte a reservar tu cita. ¿Qué te gustaría saber?',
          'Hi! I\'m **Margarita**, the virtual assistant of AM Luxury Beauty Studio.\n\nI can tell you about our services, prices, hours and location, or help you book your appointment. What would you like to know?'),
          chips:DEFAULT_CHIPS});
        hist = [];
      }
      setTimeout(function(){
        var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
        try { (fine ? input : panel).focus({preventScroll:true}); } catch(e){}
        scrollLog();
      }, 80);
    }
  }
  launcher.addEventListener('click', function(){ setOpen(!opened); });
  $('mg-close').addEventListener('click', function(){ setOpen(false); launcher.focus(); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && opened && root.contains(document.activeElement)){ setOpen(false); launcher.focus(); }
  });
  form.addEventListener('submit', function(e){ e.preventDefault(); ask(null); });

  /* Aviso de bienvenida (una vez por sesión) */
  function seen(){ try { return sessionStorage.getItem('mg_hint') === '1'; } catch(e){ return false; } }
  function mark(){ try { sessionStorage.setItem('mg_hint', '1'); } catch(e){} }
  var hintTimer = null;
  function hideHint(m){ hint.classList.remove('is-on'); clearTimeout(hintTimer); if (m) mark(); }
  $('mg-hint-open').addEventListener('click', function(){ setOpen(true); });
  $('mg-hint-x').addEventListener('click', function(){ hideHint(true); });
  if (!seen()){
    setTimeout(function(){
      if (opened) return;
      hint.classList.add('is-on'); mark();
      hintTimer = setTimeout(function(){ hint.classList.remove('is-on'); }, 12000);
    }, 6000);
  }

  /* Cambio de idioma de la web (selector ES/EN) */
  AM.onLang(function(){
    curLang = siteLang(); applyUI();
    if (started) renderChips(curChips);
  });

  applyUI();
})();

/* Equipo: cada video se reproduce una sola vez al llegar a la sección,
   queda congelado en el último fotograma y solo se rearma al salir de la vista. */
(function(){
  var vids = document.querySelectorAll('.team-video');
  if (!vids.length) return;
  var reduce = AM.reduce;

  function showLast(v){ try{ v.currentTime = Math.max(0, (v.duration || 5) - 0.05); }catch(e){} }

  vids.forEach(function(v){
    v.loop = false;
    v._played = false;
    if (reduce) v.addEventListener('loadedmetadata', function(){ showLast(v); });
  });
  if (reduce || !('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var v = e.target;
      if (e.intersectionRatio >= 0.4 && !v._played){
        v._played = true;
        v.currentTime = 0;
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function(){ v._played = false; });
      } else if (e.intersectionRatio === 0 && v._played){
        v.pause();
        v.currentTime = 0;
        v._played = false;
      }
    });
  }, {threshold:[0, 0.4]});

  vids.forEach(function(v){ io.observe(v); });
})();
