/* ============ SINCRONIZACIÓN CON GOOGLE SHEETS ============ */
function guardarConfigUrl(){
  const url = document.getElementById("config-url").value.trim();
  if(!url.startsWith("https://script.google.com/")){
    mostrarToast("Esa URL no parece de Apps Script. Revísala.", false);
    return;
  }
  localStorage.setItem("sync_url", url);
  mostrarToast("Conexión guardada", true);
  irA("pantalla-menu");
}

async function contarPendientes(){
  const acts = await leerStore("actividades");
  const falls = await leerStore("fallas");
  const reqs = await leerStore("requerimientos");
  const chks = await leerStore("checklists");
  const mtos = await leerStore("mantenimientos");
  return [acts, falls, reqs, chks, mtos].reduce((n, lista) => n + lista.filter(r=>!r.sincronizado).length, 0);
}

async function actualizarTextoPendientes(){
  const els = [document.getElementById("txt-pendientes"), document.getElementById("txt-pendientes-perfil")].filter(Boolean);
  if(els.length===0) return;
  const n = await contarPendientes();
  const url = obtenerSyncUrl();
  const texto = !url ? "Falta configurar la conexión" : (n===0 ? "Todo sincronizado ✓" : `${n} registro(s) pendiente(s)`);
  els.forEach(el=>{ el.textContent = texto; });
}

/* Nunca dos sincronizaciones a la vez (manual, automática o al guardar). */
/* Si llega un pedido mientras ya se está sincronizando (por ejemplo, alguien
   guarda un checklist), se vuelve a sincronizar al terminar, para que lo
   recién guardado no quede esperando. */
let sincronizandoAhora = false;
let sincronizarOtraVez = false;
async function sincronizarTodo(opciones){
  if(sincronizandoAhora){ sincronizarOtraVez = true; return; }
  sincronizandoAhora = true;
  try{
    await sincronizarTodoUnaVez(opciones || {});
    while(sincronizarOtraVez){ sincronizarOtraVez = false; await sincronizarTodoUnaVez({ automatico:true }); }
  }finally{ sincronizandoAhora = false; }
}

async function sincronizarTodoUnaVez(opciones){
  const automatico = !!opciones.automatico;
  if(automatico && (await contarPendientes()) === 0) return;
  const url = obtenerSyncUrl();
  if(!url){
    mostrarToast("Primero configura la conexión a Google Sheets", false);
    irA("pantalla-config");
    return;
  }
  if(!navigator.onLine){
    if(!automatico) mostrarToast("Sin conexión a internet ahora mismo", false);
    return;
  }
  mostrarToast(automatico ? "Enviando registros pendientes..." : "Sincronizando...", true);

  const acts = (await leerStore("actividades")).filter(r=>!r.sincronizado);
  const falls = (await leerStore("fallas")).filter(r=>!r.sincronizado);
  const reqs = (await leerStore("requerimientos")).filter(r=>!r.sincronizado);
  let exitos = 0, fallos = 0;

  // El número definitivo de OT / falla lo asigna el servidor (es único para
  // todos los celulares); el del celular era solo provisional.
  for(const r of acts){
    const res = await enviarRegistro(url, "actividad", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; if(res.id_ot) r.id_ot = res.id_ot; await guardarEnStore("actividades", r); exitos++; } else fallos++;
  }
  for(const r of falls){
    const res = await enviarRegistro(url, "falla", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; if(res.id_falla) r.id_falla = res.id_falla; await guardarEnStore("fallas", r); exitos++; } else fallos++;
  }
  const correlativosNuevos = [];
  for(const r of reqs){
    const res = await enviarRegistro(url, "requerimiento", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){
      r.sincronizado = true;
      if(res.correlativo){ r.correlativo = res.correlativo; correlativosNuevos.push(res.correlativo); }
      await guardarEnStore("requerimientos", r);
      exitos++;
    } else fallos++;
  }

  const chks = (await leerStore("checklists")).filter(r=>!r.sincronizado);
  for(const r of chks){
    const res = await enviarRegistro(url, "checklist", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; await guardarEnStore("checklists", r); exitos++; } else fallos++;
  }
  const mtos = (await leerStore("mantenimientos")).filter(r=>!r.sincronizado);
  for(const r of mtos){
    const res = await enviarRegistro(url, "mantenimiento", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; if(res.id_ot) r.n_ot = res.id_ot; await guardarEnStore("mantenimientos", r); exitos++; } else fallos++;
  }

  let mensajeFinal = fallos===0 ? `${exitos} registro(s) sincronizado(s)${automatico ? " automáticamente" : ""}` : `${exitos} listo(s), ${fallos} con error`;
  if(correlativosNuevos.length){ mensajeFinal += ` (${correlativosNuevos.join(", ")})`; }
  mostrarToast(mensajeFinal, fallos===0);
  actualizarTextoPendientes();
  if(exitos > 0) actualizarAlertaMantenimiento(true);
  limpiarCopiasBorradas();
}

/* ============ BOTÓN "ACTUALIZAR" (único medio de actualizar) ============
   Envía lo pendiente y trae lo último del servidor SIN recargar la página,
   así nunca se pierde nada de lo que se esté llenando. */
async function actualizarDatos(){
  if(!navigator.onLine){ mostrarToast("Sin conexión: lo llenado queda guardado en el celular.", false); return; }
  const btn = document.getElementById("btn-actualizar");
  if(btn) btn.classList.add("girando");
  try{
    await sincronizarTodo();
    await limpiarCopiasBorradas(true);
    const s = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
    if(s.rol && s.rol !== "operador") actualizarResumenInicio();
    await actualizarAlertaMantenimiento(true);
    localStorage.removeItem("cache_lecturas_ts");
    actualizarCacheLecturas();
    actualizarTextoPendientes();
    mostrarToast("Datos actualizados ✓", true);
  }finally{
    if(btn) btn.classList.remove("girando");
  }
}

/* ============ SINCRONIZACIÓN AUTOMÁTICA ============
   Si algo lleva 30 minutos o más como "Pendiente" (se llenó sin señal o se
   olvidaron de sincronizar), apenas haya internet se envía solo. Se revisa
   cada minuto, al volver la señal y al volver a abrir la app. */
const MINUTOS_AUTO_SINCRONIZAR = 30;
async function pendientesAntiguos(){
  const limite = Date.now() - MINUTOS_AUTO_SINCRONIZAR * 60 * 1000;
  let n = 0;
  for(const store of ["actividades", "fallas", "requerimientos", "checklists", "mantenimientos"]){
    n += (await leerStore(store)).filter(r => !r.sincronizado && (r.creado || 0) <= limite).length;
  }
  return n;
}
async function revisarSincronizacionAutomatica(){
  try{
    if(!db || !navigator.onLine || !tokenSesion() || sincronizandoAhora) return;
    if(await pendientesAntiguos()) await sincronizarTodo({ automatico:true });
  }catch(e){ console.log("Sincronización automática:", e); }
}
setInterval(revisarSincronizacionAutomatica, 60 * 1000);
window.addEventListener("online", () => setTimeout(revisarSincronizacionAutomatica, 3000));
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") revisarSincronizacionAutomatica(); });

/* Si se intenta cerrar o recargar la página en medio de un formulario, el
   navegador pregunta antes (para no perder lo que se está llenando). */
window.addEventListener("beforeunload", (e) => {
  const activa = document.querySelector(".pantalla.activa");
  if(activa && typeof esPantallaFormulario === "function" && esPantallaFormulario(activa.id)){
    e.preventDefault();
    e.returnValue = "";
  }
});

/* ============ COPIAS DEL CELULAR AL DÍA ============
   Lo ya enviado queda guardado en el celular para mostrarlo en "Mis
   registros". Si un admin lo borra del servidor, aquí se borra también su
   copia (si no, seguiría apareciendo, por ejemplo un checklist de prueba).
   Solo se revisan registros desde el 15/10/2026: desde ahí todos tienen su
   código único en la hoja. Lo pendiente de enviar nunca se toca. */
const COPIAS_REVISABLES_DESDE = new Date(2026, 9, 15).getTime();
async function limpiarCopiasBorradas(forzar){
  if(!navigator.onLine || !tokenSesion()) return 0;
  const ultima = Number(localStorage.getItem("copias_revisadas_ts") || 0);
  if(!forzar && Date.now() - ultima < 10 * 60 * 1000) return 0;
  localStorage.setItem("copias_revisadas_ts", String(Date.now()));
  let borradas = 0;
  for(const coleccion of ["checklists", "fallas", "actividades", "mantenimientos", "requerimientos"]){
    try{
      const locales = (await leerStore(coleccion)).filter(r => r.sincronizado && (r.creado || 0) >= COPIAS_REVISABLES_DESDE);
      if(!locales.length) continue;
      const resp = await llamarServidor({ tipo:"existen_registros", coleccion, ids:locales.map(r => r.id).slice(0, 500) }, { silencioso:true });
      if(!resp || !resp.ok || !Array.isArray(resp.existen)) continue;
      const existen = new Set(resp.existen);
      for(const r of locales.slice(0, 500)){
        if(!existen.has(String(r.id))){ await borrarDeStore(coleccion, r.id); borradas++; }
      }
    }catch(e){ console.log("No se pudo revisar " + coleccion, e); }
  }
  return borradas;
}

async function enviarRegistro(url, tipo, registro){
  try{
    const resp = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"text/plain;charset=utf-8"}, // evita preflight CORS en Apps Script
      body: JSON.stringify({ tipo, registro, token: tokenSesion() })
    });
    const data = await resp.json();
    return data || { ok:false };
  }catch(err){
    console.error("Error sincronizando:", err);
    return { ok:false };
  }
}

