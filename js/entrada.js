/* ============ ENTRADA "DIAGNÓSTICO" (verde claro) ============
   Sale cada vez que se abre la app. Un escáner revisa un engranaje como si
   fuera un checklist (Motor, Frenos, Aceite, Llantas, Luces → 100 % OK) y
   aparece el logo. Se queda 1,5 s con el logo y "Sistema de Mantenimiento"
   completos y luego pasa a la pantalla de ingreso. Tocarla la salta.

   Por qué corre fluida (aunque la app esté cargando por detrás):
   - Se carga antes que el resto de la app (está justo después del #splash).
   - Todo lo que se mueve es transform/opacity con CSS: lo anima la tarjeta
     de video, no el procesador principal.
   - Las chispas se dibujan en un hilo aparte (OffscreenCanvas + Worker) y su
     velocidad no depende de si la pantalla es de 60 o 120 Hz.
   - Nada de desenfoques en vivo: el brillo de neón son trazos superpuestos.
   - Un solo reloj para todo (no hay pasos encadenados que se atrasen). */
(function(){
  const splash = document.getElementById("splash");
  const SIN_MOV = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FIN_MS = 4750;           // 3,25 s de animación + 1,5 s con el final quieto
  const estado = { terminada:false, appLista:false, saltar:false, cerrada:false, hilo:null, detener:null };
  let avisarCerrada;
  window.entradaCerrada = new Promise(r => { avisarCerrada = r; });

  function cerrar(){
    if(estado.cerrada) return;
    estado.cerrada = true;
    if(!splash){ avisarCerrada(); return; }
    splash.classList.add("fuera");
    setTimeout(() => {
      if(estado.hilo) estado.hilo.terminate();
      if(estado.detener) estado.detener.si = true;
      splash.remove();
      avisarCerrada();
    }, 380);
  }
  function intentarCerrar(){
    if(estado.cerrada || !estado.appLista) return;
    if(estado.terminada || estado.saltar) cerrar();
  }
  // La app avisa cuando ya cargó (js/inicio.js); la entrada se va cuando ambas cosas terminaron.
  window.ocultarSplash = function(){ estado.appLista = true; intentarCerrar(); };
  if(!splash){ estado.cerrada = true; avisarCerrada(); return; }
  splash.addEventListener("click", () => { estado.saltar = true; intentarCerrar(); });

  /* ---------- Dibujo ---------- */
  const rad = g => g * Math.PI / 180;
  function arco(cx, cy, r, a0, a1){
    const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))], p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
    return `M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
  }
  function rutaEngranaje(cx, cy, dientes, rExt, rInt, rAgujero){
    let d = ""; const w = Math.PI * 2 / dientes;
    for(let i = 0; i < dientes; i++){
      const a = i * w - Math.PI / 2;
      [[rInt, a], [rExt, a + w * .18], [rExt, a + w * .44], [rInt, a + w * .62]].forEach(([r, ang], j) => {
        d += (i === 0 && j === 0 ? "M" : "L") + (cx + r * Math.cos(ang)).toFixed(2) + " " + (cy + r * Math.sin(ang)).toFixed(2) + " ";
      });
    }
    return d + `Z M ${cx + rAgujero} ${cy} A ${rAgujero} ${rAgujero} 0 1 0 ${cx - rAgujero} ${cy} A ${rAgujero} ${rAgujero} 0 1 0 ${cx + rAgujero} ${cy} Z`;
  }
  const ENGRANAJE = rutaEngranaje(100, 100, 8, 56, 45, 18);
  const TRAMOS = [0, 1, 2, 3, 4].map(i => { const a0 = -90 + i * 72 + 4; return arco(100, 100, 90, a0, a0 + 64); });
  const PUNTOS = ["MOTOR", "FRENOS", "ACEITE", "LLANTAS", "LUCES"];
  const T_TRAMO = i => .6 + i * .24;

  let rejilla = "";
  for(let v = 20; v <= 180; v += 16) rejilla += `<line x1="${v}" y1="20" x2="${v}" y2="180"/><line x1="20" y1="${v}" x2="180" y2="${v}"/>`;
  const tramosLuz = TRAMOS.map((d, i) => `<g class="tramo" style="--i:${i}"><path d="${d}" class="c-neon" stroke-width="12" opacity=".16"/><path d="${d}" class="c-neon" stroke-width="5"/><path d="${d}" class="c-neon2" stroke-width="1.6"/></g>`).join("");
  const marcas = [.15, ...PUNTOS.map((_, i) => T_TRAMO(i) + .12), 1.8];
  const pct = marcas.slice(0, -1).map((t, k) => `<span style="--del:${t.toFixed(2)}s;--dur:${(marcas[k + 1] - t).toFixed(2)}s">${k * 20}%</span>`).join("") + `<span class="fin">OK</span>`;
  splash.innerHTML = `
    <svg class="pieza" viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <linearGradient id="splash-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ECFFF5"/><stop offset=".45" stop-color="#4CE39A"/><stop offset=".55" stop-color="#1D8656"/><stop offset="1" stop-color="#B5F2D2"/></linearGradient>
        <clipPath id="splash-recorte"><circle cx="100" cy="100" r="80"/></clipPath>
      </defs>
      <g class="plano c-grid" stroke-width=".8" clip-path="url(#splash-recorte)">${rejilla}</g>
      <g class="c-tenue" stroke-width="5">${TRAMOS.map(d => `<path d="${d}"/>`).join("")}</g>
      ${tramosLuz}
      <circle cx="100" cy="100" r="90" class="anillo-flash" stroke="#FFFFFF" stroke-width="6"/>
      <circle cx="100" cy="100" r="30" class="c-neon" stroke-width=".8" stroke-dasharray="3 3" opacity=".4"/>
      <path class="relleno" d="${ENGRANAJE}" fill="url(#splash-metal)" fill-rule="evenodd" stroke="none"/>
      <path class="dib c-neon" d="${ENGRANAJE}" pathLength="1" stroke-width="7" opacity=".16"/>
      <path class="dib c-neon" d="${ENGRANAJE}" pathLength="1" stroke-width="3.6" opacity=".45"/>
      <path class="dib c-neon2" d="${ENGRANAJE}" pathLength="1" stroke-width="1.6"/>
      <path class="muestreo" d="${ENGRANAJE}" stroke="none"/>
    </svg>
    <div class="escaner"><div class="barra"></div></div>
    <div class="pct">${pct}</div>
    <canvas class="chispas"></canvas>
    <div class="lista">${PUNTOS.map((p, i) => `<div class="item" style="--i:${i}"><span>${p}</span><span class="ok">C ✓</span></div>`).join("")}</div>
    <div class="halo"></div>
    <div class="logo-card"><img src="img/logo.png" alt="" decoding="sync"></div>
    <div class="marca"><div class="nombre">${[..."CHAN CHAN AMARYL"].map((c, i) => `<span style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("")}</div><div class="sub">Sistema de Mantenimiento</div></div>`;

  if(SIN_MOV){
    splash.classList.add("quieta");
    setTimeout(() => { estado.terminada = true; intentarCerrar(); }, 1500);
    return;
  }

  /* ---------- Chispas en hilo aparte ---------- */
  function bez(x1, y1, x2, y2){
    function cx(t){ return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; }
    function cy(t){ return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; }
    return function(x){
      if(x <= 0) return 0; if(x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for(var i = 0; i < 24; i++){ t = (lo + hi) / 2; if(cx(t) < x) lo = t; else hi = t; }
      return cy(t);
    };
  }
  function Motor(cv, cfg){
    var ctx = cv.getContext("2d");
    var W = cfg.w, H = cfg.h, dpr = cfg.dpr;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var esc = cfg.escala, col = cfg.colores;
    var raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame.bind(self)
      : function(f){ return setTimeout(function(){ f(performance.now()); }, 8); };
    var origen = cfg.inicio - performance.timeOrigin;
    var P = [], ultimo = null, brasas = [];
    for(var i = 0; i < 24; i++) brasas.push({ x:Math.random() * W, y:Math.random() * H, v:(.15 + Math.random() * .35) * esc, r:(.6 + Math.random() * 1.4) * esc, f:Math.random() * 6 });
    var ev = cfg.guion.map(function(e){ var c = Object.assign({ hecho:false }, e); if(c.ease) c.f = bez.apply(null, c.ease); return c; });
    function emitir(x, y, n, o){
      for(var k = 0; k < n; k++){
        var ang = (o.angulo != null ? o.angulo : -Math.PI / 2) + (Math.random() - .5) * (o.abanico != null ? o.abanico : Math.PI * 1.4);
        var v = (o.vel || 2.4) * (.4 + Math.random()) * esc, r = Math.random();
        P.push({ x:x, y:y, vx:Math.cos(ang) * v, vy:Math.sin(ang) * v, vida:0, max:24 + Math.random() * 30, c:r < .35 ? 0 : (r < .67 ? 1 : 2) });
      }
    }
    var cubos = []; for(var q = 0; q < 12; q++) cubos.push([]);
    function cuadro(ahora){
      if(cfg.detener && cfg.detener.si) return;
      var t = (ahora - origen) / 1000;
      var dt = ultimo === null ? 1 : Math.min(3, (ahora - ultimo) / 16.667);
      ultimo = ahora;
      for(var a = 0; a < ev.length; a++){
        var e = ev[a];
        if(e.hecho || t < e.t) continue;
        if(e.tipo === "trazo"){
          var p = Math.min(1, (t - e.t) / e.dur), idx = Math.round(e.f(p) * (e.pts.length - 1));
          emitir(e.pts[idx][0], e.pts[idx][1], Math.max(1, Math.round(e.n * dt)), e);
          if(p >= 1) e.hecho = true;
        } else { e.hecho = true; emitir(e.x, e.y, e.n, e); }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = col[2];
      for(var b = 0; b < 3; b++){
        ctx.globalAlpha = .14 + b * .12; ctx.beginPath();
        for(var j = 0; j < brasas.length; j++){
          var br = brasas[j]; if(j % 3 !== b) continue;
          br.y -= br.v * dt; if(br.y < -5){ br.y = H + 5; br.x = Math.random() * W; }
          var bx = br.x + Math.sin(ahora / 900 + br.f) * 6 * esc;
          ctx.moveTo(bx + br.r, br.y); ctx.arc(bx, br.y, br.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      for(var c = 0; c < 12; c++) cubos[c].length = 0;
      var g = .09 * esc * dt, roce = Math.pow(.985, dt);
      for(var s = P.length - 1; s >= 0; s--){
        var pt = P[s];
        pt.vy += g; pt.vx *= roce; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vida += dt;
        var al = 1 - pt.vida / pt.max;
        if(al <= 0){ P[s] = P[P.length - 1]; P.pop(); continue; }
        cubos[pt.c * 4 + Math.min(3, Math.floor(al * 4))].push(pt);
      }
      ctx.lineWidth = 1.6 * Math.max(1, esc * .9); ctx.lineCap = "round";
      for(var k = 0; k < 12; k++){
        var lista = cubos[k]; if(!lista.length) continue;
        ctx.strokeStyle = col[Math.floor(k / 4)]; ctx.globalAlpha = (k % 4 + 1) / 4; ctx.beginPath();
        for(var m = 0; m < lista.length; m++){ var z = lista[m]; ctx.moveTo(z.x - z.vx * 2.2, z.y - z.vy * 2.2); ctx.lineTo(z.x, z.y); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf(cuadro);
    }
    return { start:function(){ raf(cuadro); } };
  }

  /* ---------- Arranque ---------- */
  const W = window.innerWidth, H = window.innerHeight;
  const ancho = Math.min(W * .74, 330), s = ancho / 200;     // mismo tamaño que .pieza en CSS
  const cx = W / 2, cy = H * .42;
  const aPantalla = (x, y) => [cx + (x - 100) * s, cy + (y - 100) * s];
  splash.style.setProperty("--s", (ancho / 250).toFixed(3));
  const escaner = splash.querySelector(".escaner");
  escaner.style.width = escaner.style.height = (160 * s) + "px";
  const ruta = splash.querySelector(".muestreo"), largo = ruta.getTotalLength(), pts = [];
  for(let i = 0; i <= 160; i++){ const p = ruta.getPointAtLength(largo * i / 160); pts.push(aPantalla(p.x, p.y)); }
  const guion = [{ tipo:"trazo", t:0, dur:.6, pts, n:2, vel:2, ease:[.25, .8, .4, 1] }];
  PUNTOS.forEach((_, i) => {
    const m = rad(-90 + i * 72 + 36), [x, y] = aPantalla(100 + 90 * Math.cos(m), 100 + 90 * Math.sin(m));
    guion.push({ tipo:"rafaga", t:T_TRAMO(i), x, y, n:16, vel:2.4, abanico:Math.PI * 2 });
    guion.push({ tipo:"rafaga", t:1.8, x, y, n:8, vel:1.8, abanico:Math.PI * 2 });
  });
  guion.push({ tipo:"rafaga", t:2.0, x:cx, y:cy, n:90, vel:4.4, abanico:Math.PI * 2 });
  // Nítido (hasta 3×) pero sin pasarse de ~4 millones de píxeles en pantallas grandes.
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1, Math.sqrt(4e6 / (W * H))));
  const cfg = { w:W, h:H, dpr, escala:ancho / 250, colores:["#FFFFFF", "#C9FBE0", "#4CE39A"], guion, inicio:performance.timeOrigin + performance.now() };
  const cv = splash.querySelector(".chispas");
  try{
    if(typeof OffscreenCanvas !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype && typeof Worker !== "undefined"){
      const fuente = URL.createObjectURL(new Blob([bez.toString() + "\n" + Motor.toString() + "\nonmessage=function(e){Motor(e.data.canvas,e.data.cfg).start();};"], { type:"text/javascript" }));
      const off = cv.transferControlToOffscreen();
      estado.hilo = new Worker(fuente);
      estado.hilo.postMessage({ canvas:off, cfg }, [off]);
    }else{
      estado.detener = { si:false }; cfg.detener = estado.detener;
      Motor(cv, cfg).start();
    }
  }catch(e){ /* sin chispas no pasa nada: el resto de la entrada sigue igual */ }
  void splash.offsetWidth;
  splash.classList.add("corre");
  setTimeout(() => { estado.terminada = true; intentarCerrar(); }, FIN_MS);
})();
