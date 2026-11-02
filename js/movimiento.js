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

/* Inicio animado: se va apenas la app está lista (como mínimo deja ver el
   logo un instante para que no parpadee). */
function ocultarSplash(){
  const s = document.getElementById("splash");
  if(!s) return;
  const espera = SIN_MOVIMIENTO ? 0 : Math.max(0, 420 - performance.now());
  setTimeout(() => {
    s.classList.add("fuera");
    setTimeout(() => s.remove(), 320);
  }, espera);
}
