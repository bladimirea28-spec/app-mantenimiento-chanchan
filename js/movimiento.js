/* ============ MOVIMIENTO (transiciones elegantes y rápidas) ============
   - Cambio de pantalla: adelante entra desde la derecha, al volver desde la
     izquierda; las pantallas principales (inicio, pestañas) solo aparecen.
   - Cascada: al entrar, las tarjetas aparecen una tras otra (solo en ese
     momento; lo que llega después del servidor se pinta sin repetirlo).
   - Números que cuentan en el inicio y el dashboard.
   Todo dura ~0.25 s y usa solo transform/opacity: no frena la app. */

const SIN_MOVIMIENTO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PANTALLAS_PRINCIPALES = ["pantalla-login", "pantalla-menu", "pantalla-admin", "pantalla-fallas-abiertas", "pantalla-perfil"];
let historialPantallas = [];
let _timerCascada = null;
const _scrollPorPantalla = {};

/* Se llama desde irA() con la pantalla nueva y la que estaba antes. */
function animarEntradaPantalla(id, anterior){
  const el = document.getElementById(id);
  if(!el || id === anterior) return;
  if(anterior) _scrollPorPantalla[anterior] = window.scrollY;
  let clase;
  const i = historialPantallas.lastIndexOf(id);
  if(PANTALLAS_PRINCIPALES.indexOf(id) !== -1){
    historialPantallas = [id];
    clase = "entra-suave";
  }else if(i !== -1){
    historialPantallas = historialPantallas.slice(0, i + 1);
    clase = "entra-atras";
  }else{
    historialPantallas.push(id);
    clase = "entra-adelante";
  }
  // Al volver se regresa a donde estaba; al avanzar, arriba.
  window.scrollTo(0, 0);
  if(clase === "entra-atras" && _scrollPorPantalla[id]){
    const y = _scrollPorPantalla[id];
    setTimeout(() => window.scrollTo(0, y), 40);   // cuando la lista ya se pintó
  }
  if(SIN_MOVIMIENTO) return;
  el.classList.remove("entra-adelante", "entra-atras", "entra-suave");
  void el.offsetWidth;   // reinicia la animación aunque sea la misma clase
  el.classList.add(clase, "cascada");
  el.addEventListener("animationend", function fin(e){
    if(e.target !== el) return;
    el.classList.remove(clase);
    el.removeEventListener("animationend", fin);
  });
  // La cascada vale solo al entrar: lo que se pinte después ya no se anima.
  clearTimeout(_timerCascada);
  _timerCascada = setTimeout(() => el.classList.remove("cascada"), 650);
}

/* ¿La pantalla acaba de entrar? (para animar números solo en ese momento) */
function recienEntrada(el){ return !!el && !SIN_MOVIMIENTO && !!el.closest(".cascada"); }

/* Los números enteros (ej. "12") suben contando desde 0. */
function animarNumeros(raiz){
  if(!raiz || !recienEntrada(raiz)) return;
  raiz.querySelectorAll(".kpi-valor, .resumen-tile .num, .mtto-chip b").forEach(el => {
    const texto = el.textContent.trim();
    if(!/^\d{1,5}$/.test(texto)) return;
    const meta = Number(texto);
    if(meta < 2) return;
    const t0 = performance.now(), dur = 520;
    const paso = ahora => {
      const p = Math.min(1, (ahora - t0) / dur);
      if(el.textContent.trim() !== texto && p > 0 && el.dataset.contando !== "1") return;   // alguien lo cambió
      el.dataset.contando = "1";
      el.textContent = String(Math.round(meta * (1 - Math.pow(1 - p, 3))));
      if(p < 1) requestAnimationFrame(paso); else { el.textContent = texto; delete el.dataset.contando; }
    };
    requestAnimationFrame(paso);
  });
}

/* ============ ENTRADA "CHISPA DE SOLDADURA" ============
   Sale cada vez que se abre la app: una chispa ámbar dibuja un engranaje de
   neón soltando chispas de soldadura, se llena de metal, gira, y de su
   centro sale el logo con un destello. Mientras tanto la app carga por
   detrás; al terminar se va al inicio (con sesión) o al ingreso (nuevo).
   Tocar la pantalla la salta. */
let _entradaTerminada = false, _appLista = false, _entradaCerrada = false;

function rutaEngranaje(cx, cy, dientes, rExt, rInt, rAgujero){
  let d = "";
  const w = Math.PI * 2 / dientes;
  for(let i = 0; i < dientes; i++){
    const a = i * w - Math.PI / 2;
    [[rInt, a], [rExt, a + w * .18], [rExt, a + w * .44], [rInt, a + w * .62]].forEach(([r, ang], j) => {
      d += (i === 0 && j === 0 ? "M" : "L") + (cx + r * Math.cos(ang)).toFixed(2) + " " + (cy + r * Math.sin(ang)).toFixed(2) + " ";
    });
  }
  return d + `Z M ${cx + rAgujero} ${cy} A ${rAgujero} ${rAgujero} 0 1 0 ${cx - rAgujero} ${cy} A ${rAgujero} ${rAgujero} 0 1 0 ${cx + rAgujero} ${cy} Z`;
}

/* Chispas: rayitas que caen con gravedad y se apagan (canvas). */
function crearChispas(cv){
  const ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const lista = [];
  let vivo = true;
  // Brasas que flotan lento en el fondo (ambiente de taller).
  const brasas = Array.from({ length:26 }, () => ({ x:Math.random() * innerWidth, y:Math.random() * innerHeight,
    v:.15 + Math.random() * .35, r:.6 + Math.random() * 1.4, f:Math.random() * 6 }));
  function emitir(x, y, n, o){
    o = o || {};
    for(let k = 0; k < n; k++){
      const ang = (o.angulo ?? -Math.PI / 2) + (Math.random() - .5) * (o.abanico ?? Math.PI * 1.4);
      const v = (o.vel ?? 2.4) * (.4 + Math.random());
      lista.push({ x, y, px:x, py:y, vx:Math.cos(ang) * v, vy:Math.sin(ang) * v, vida:0, max:24 + Math.random() * 30,
        color:Math.random() < .35 ? "#FFFFFF" : (Math.random() < .5 ? "#FFD27A" : "#E8A93B") });
    }
  }
  function cuadro(t){
    if(!vivo) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    brasas.forEach(b => {
      b.y -= b.v; if(b.y < -5){ b.y = innerHeight + 5; b.x = Math.random() * innerWidth; }
      ctx.globalAlpha = .25 + .2 * Math.sin(t / 400 + b.f);
      ctx.fillStyle = "#E8A93B";
      ctx.beginPath(); ctx.arc(b.x + Math.sin(t / 900 + b.f) * 6, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });
    for(let i = lista.length - 1; i >= 0; i--){
      const p = lista[i];
      p.px = p.x; p.py = p.y;
      p.vy += .09; p.vx *= .985;
      p.x += p.vx; p.y += p.vy; p.vida++;
      const a = 1 - p.vida / p.max;
      if(a <= 0){ lista.splice(i, 1); continue; }
      ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  return { emitir, parar:() => { vivo = false; } };
}

function iniciarEntrada(){
  const s = document.getElementById("splash");
  if(!s) return;
  const d = rutaEngranaje(100, 100, 10, 86, 68, 30);
  s.querySelector(".splash-borde").setAttribute("d", d);
  s.querySelector(".splash-relleno").setAttribute("d", d);
  s.querySelector(".splash-nombre").innerHTML = [..."CHAN CHAN AMARYL"]
    .map((c, i) => `<span style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("");
  s.addEventListener("click", () => { _entradaTerminada = true; cerrarEntrada(true); });
  if(SIN_MOVIMIENTO){ s.classList.add("lleno", "logo", "texto"); _entradaTerminada = true; return; }

  const borde = s.querySelector(".splash-borde");
  const svg = s.querySelector(".splash-eng");
  const largo = borde.getTotalLength();
  borde.style.strokeDasharray = largo;
  borde.style.strokeDashoffset = largo;
  s.classList.add("dibujando");
  const chispas = crearChispas(s.querySelector(".splash-chispas"));
  s._chispas = chispas;
  const DUR = 1100;
  let inicio = null, dibujando = true;
  function dibujar(t){
    if(!dibujando) return;
    if(inicio === null) inicio = t;
    const p = Math.min(1, (t - inicio) / DUR);
    const e = 1 - Math.pow(1 - p, 2.2);
    borde.style.strokeDashoffset = largo * (1 - e);
    // La punta del trazo es la chispa de soldadura.
    const pt = borde.getPointAtLength(largo * e);
    const r = svg.getBoundingClientRect();
    chispas.emitir(r.left + pt.x / 200 * r.width, r.top + pt.y / 200 * r.height, 4, { vel:2.7 });
    if(p < 1) requestAnimationFrame(dibujar);
  }
  requestAnimationFrame(dibujar);
  const paso = (ms, f) => setTimeout(() => { if(!_entradaCerrada) f(); }, ms);
  paso(1150, () => { dibujando = false; s.classList.add("lleno"); });
  paso(1600, () => {
    s.classList.add("logo");
    chispas.emitir(innerWidth / 2, innerHeight * .42, 80, { vel:4.2, abanico:Math.PI * 2 });
  });
  paso(1950, () => s.classList.add("brillo"));
  paso(2050, () => s.classList.add("texto"));
  paso(2900, () => { _entradaTerminada = true; cerrarEntrada(); });
}

/* La app avisa que ya cargó; la entrada se va cuando ambas cosas terminaron. */
function ocultarSplash(){ _appLista = true; cerrarEntrada(); }

function cerrarEntrada(saltar){
  const s = document.getElementById("splash");
  if(!s || _entradaCerrada) return;
  if(!_appLista || (!_entradaTerminada && !saltar)) return;
  _entradaCerrada = true;
  s.classList.add("fuera");
  setTimeout(() => { if(s._chispas) s._chispas.parar(); s.remove(); }, 320);
}

iniciarEntrada();
