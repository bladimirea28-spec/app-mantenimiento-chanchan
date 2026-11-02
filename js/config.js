/* ============ USUARIOS REALES ============
   El roster de técnicos/admins (nombre, DNI, cargo) ya NO vive en este
   archivo: vive en la pestaña "USUARIOS" de tu Google Sheet, y el login
   se valida contra ella a través del Apps Script (acciones "login",
   "autoregistro" y "cupos"). Así puedes agregar o corregir usuarios sin
   tocar el código de la app. */

/* Identificador único de este dispositivo/instalación (se genera una sola
   vez y se guarda para siempre en este celular). Sirve para que el mismo
   usuario no pueda estar activo en dos dispositivos a la vez. */
function obtenerDispositivoId(){
  let id = localStorage.getItem("device_id");
  if(!id){
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "dev-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    localStorage.setItem("device_id", id);
  }
  return id;
}

/* Etiqueta legible del dispositivo/navegador actual (ej. "Chrome · Android"),
   armada a partir de navigator.userAgent. Solo es informativa (para que un
   admin identifique el dispositivo en el panel), no se usa para bloquear
   nada. */
function obtenerInfoDispositivo(){
  const ua = navigator.userAgent || "";
  let so = "Otro";
  if(/Android/i.test(ua)) so = "Android";
  else if(/iPhone|iPad|iPod/i.test(ua)) so = "iOS";
  else if(/Windows/i.test(ua)) so = "Windows";
  else if(/Macintosh|Mac OS/i.test(ua)) so = "Mac";
  else if(/Linux/i.test(ua)) so = "Linux";

  let navegador = "Navegador";
  if(/EdgA|Edge|Edg\//i.test(ua)) navegador = "Edge";
  else if(/SamsungBrowser/i.test(ua)) navegador = "Samsung Internet";
  else if(/CriOS|Chrome/i.test(ua)) navegador = "Chrome";
  else if(/FxiOS|Firefox/i.test(ua)) navegador = "Firefox";
  else if(/Safari/i.test(ua)) navegador = "Safari";

  return `${navegador} · ${so}`;
}

/* Indicador global de carga (tuerquita girando). Se muestra solo si la
   operación tarda más de un instante, para no parpadear en conexiones
   rápidas, y siempre se termina ocultando pase lo que pase. */
let _timerCargando = null;
let _cargandoVisible = false;
function mostrarCargando(){
  clearTimeout(_timerCargando);
  _timerCargando = setTimeout(()=>{
    document.getElementById("loader-global").classList.add("activo");
    _cargandoVisible = true;
  }, 200);
}
function ocultarCargando(){
  clearTimeout(_timerCargando);
  if(_cargandoVisible){
    document.getElementById("loader-global").classList.remove("activo");
    _cargandoVisible = false;
  }
}

/* URL de Apps Script que usa la app por defecto, sin que cada técnico tenga
   que configurarla a mano en su celular. La pantalla de ⚙️ Configuración
   sigue existiendo por si algún día hay que apuntar a otra hoja. */
const DEFAULT_SYNC_URL = "https://script.google.com/macros/s/AKfycbyCuzCH6WDjM2n_mu3VDZccHmZi4n3ZSGFCVQNCFqh1_2Z25Rrsp7UbUlTUk3YI424c-Q/exec";
function obtenerSyncUrl(){
  return localStorage.getItem("sync_url") || DEFAULT_SYNC_URL;
}

/* Llave de la sesión (token) que entregó el servidor al iniciar sesión.
   Va en cada pedido: el servidor saca de ahí quién es el usuario y qué rol
   tiene, en vez de creer lo que diga el celular. */
function tokenSesion(){
  try{ return (JSON.parse(localStorage.getItem("sesion_activa")||"{}")).token || ""; }
  catch(e){ return ""; }
}

/* Envía una acción al Apps Script (login, autoregistro, cupos, listado, etc.)
   Devuelve siempre un objeto con al menos {ok:boolean, mensaje}.
   Si el servidor dice que la sesión ya no vale, vuelve a la pantalla de
   ingreso (los registros sin sincronizar se quedan guardados en el celular).
   opciones.silencioso: consulta de fondo, sin la tuerquita que tapa la
   pantalla (el usuario sigue trabajando mientras Google responde). */
async function llamarServidor(payload, opciones){
  const silencioso = !!(opciones && opciones.silencioso);
  const url = obtenerSyncUrl();
  if(!url){
    return {ok:false, mensaje:"Falta configurar la conexión a Google Sheets (⚙️ en el menú)."};
  }
  if(!navigator.onLine){
    return {ok:false, mensaje:"Necesitas conexión a internet para esto."};
  }
  if(!silencioso) mostrarCargando();
  try{
    const resp = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify(Object.assign({ token: tokenSesion() }, payload))
    });
    const data = await resp.json();
    if(data && data.sesion_invalida) manejarSesionVencida();
    // Un cambio hecho por el usuario deja viejas las consultas guardadas.
    if(data && data.ok && payload && CONSULTAS_DE_LECTURA.indexOf(payload.tipo) === -1 && !silencioso) marcarDatosCambiados();
    return data;
  }catch(err){
    console.error("Error llamando al servidor:", err);
    return {ok:false, mensaje:"No se pudo conectar. Revisa tu internet e intenta de nuevo."};
  }finally{
    if(!silencioso) ocultarCargando();
  }
}

/* ============ CONSULTAS AL INSTANTE ============
   Las pantallas no esperan a Google: muestran al instante la última
   respuesta guardada en el celular y piden la nueva por detrás. Cuando llega
   y trae cambios, la pantalla se vuelve a pintar sola (alActualizar).
   Si el usuario cambia algo (guardar, editar, eliminar…), lo guardado se da
   por viejo y la siguiente consulta espera la respuesta nueva. */
const CONSULTAS_DE_LECTURA = ["control_mantenimiento", "listado", "listado_requerimientos", "listado_solicitudes_actividad",
  "listado_checklists", "listado_fallas_abiertas", "lecturas_equipos", "listado_dispositivos", "cupos", "existen_registros"];
const _respuestasMemoria = {};
const _consultasEnCurso = {};
let _actualizandoFondo = 0;

function versionDatosLocal(){ return Number(localStorage.getItem("version_datos_local") || 0); }
function marcarDatosCambiados(){ localStorage.setItem("version_datos_local", String(versionDatosLocal() + 1)); }
function claveConsulta(payload){
  const s = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  return (s.dni || "") + "|" + JSON.stringify(payload);
}
function indicadorActualizando(delta){
  _actualizandoFondo = Math.max(0, _actualizandoFondo + delta);
  let el = document.getElementById("indicador-actualizando");
  if(!el){
    el = document.createElement("div");
    el.id = "indicador-actualizando";
    el.innerHTML = `<span class="punto-giro"></span>Actualizando…`;
    document.body.appendChild(el);
  }
  el.classList.toggle("visible", _actualizandoFondo > 0);
}

/* Pide al servidor una sola vez aunque varias pantallas lo pidan a la vez. */
function pedirYGuardar(payload, clave, silencioso){
  if(_consultasEnCurso[clave]) return _consultasEnCurso[clave];
  const version = versionDatosLocal();
  _consultasEnCurso[clave] = llamarServidor(payload, { silencioso }).then(resp => {
    if(resp && resp.ok){
      resp._recibido = Date.now();
      const obj = { k:clave, t:resp._recibido, v:version, resp };
      _respuestasMemoria[clave] = obj;
      if(typeof guardarRespuesta === "function") guardarRespuesta(obj);
    }
    return resp;
  }).finally(() => { delete _consultasEnCurso[clave]; });
  return _consultasEnCurso[clave];
}

async function leerConsultaGuardada(clave){
  let g = _respuestasMemoria[clave];
  if(!g && typeof leerRespuestaGuardada === "function" && typeof db !== "undefined" && db) g = await leerRespuestaGuardada(clave);
  if(g) _respuestasMemoria[clave] = g;
  return g && g.v === versionDatosLocal() ? g : null;
}

/* opciones.frescura: ms en que lo guardado se usa sin volver a preguntar.
   opciones.alActualizar(resp): se llama si la respuesta nueva cambió algo. */
async function consultaRapida(payload, opciones){
  opciones = opciones || {};
  const clave = claveConsulta(payload);
  const guardado = await leerConsultaGuardada(clave);
  if(guardado){
    const viejo = Date.now() - guardado.t > (opciones.frescura || 20000);
    if(viejo && navigator.onLine && tokenSesion()){
      indicadorActualizando(1);
      pedirYGuardar(payload, clave, true).then(resp => {
        const sinHora = o => JSON.stringify(Object.assign({}, o, { _recibido:0 }));
        if(resp && resp.ok && opciones.alActualizar && sinHora(resp) !== sinHora(guardado.resp)) opciones.alActualizar(resp);
      }).finally(() => indicadorActualizando(-1));
    }
    return guardado.resp;
  }
  return pedirYGuardar(payload, clave, !!opciones.silencioso);
}

/* Al entrar: trae por detrás lo que se va a usar, para que todo abra al instante. */
function precargarDatos(){
  const s = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  if(!s.token || !navigator.onLine) return;
  const enReposo = window.requestIdleCallback ? (f => requestIdleCallback(f, { timeout:1000 })) : (f => setTimeout(f, 300));
  enReposo(() => {
    asegurarPlanesMtto().catch(() => {});
    asegurarMateriales().catch(() => {});
    const pedir = p => pedirYGuardar(p, claveConsulta(p), true).catch(() => {});
    if(s.rol === "admin"){
      if(typeof cargarControlMantenimiento === "function") cargarControlMantenimiento(true).catch(() => {});
      pedir({ tipo:"listado", dni_admin:s.dni });
      pedir({ tipo:"listado_requerimientos", dni_admin:s.dni });
      pedir({ tipo:"listado_solicitudes_actividad", dni_admin:s.dni });
      pedir({ tipo:"listado_checklists" });
    }
    if(s.rol === "admin" || s.rol === "tecnico") pedir({ tipo:"listado_fallas_abiertas", dni:s.dni, nombre:s.nombre, rol:s.rol });
    pedir({ tipo:"listado_requerimientos", dni:s.dni });
  });
}

/* ============ LIMPIEZA DE TEXTOS PARA MOSTRAR EN PANTALLA ============
   Todo lo que escribe un usuario (descripciones, nombres, comentarios...) y
   luego se pinta con innerHTML debe pasar por esc(). Así, si alguien escribe
   algo como <script> o <img onerror=...>, se ve como texto y no se ejecuta
   en el celular de otra persona (por ejemplo, en el panel del admin). */
function esc(valor){
  return String(valor == null ? "" : valor).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

/* Para pasar un valor como argumento dentro de onclick="...": lo convierte
   en un texto de JavaScript entre comillas y luego lo limpia para HTML.
   Uso: onclick="abrirResolverFalla(${jsArg(r.ID_FALLA)})" (sin comillas). */
function jsArg(valor){
  return esc(JSON.stringify(String(valor == null ? "" : valor)));
}

/* Solo deja pasar links de fotos seguros (https o imagen en base64). */
function urlSegura(url){
  const u = String(url || "").trim();
  return /^(https:\/\/|data:image\/)/i.test(u) ? esc(u) : "";
}

/* ============ CARGA BAJO DEMANDA ============
   Para que la app abra rápido, lo pesado no se carga al inicio:
   - Librería de Excel (861 KB) y lector de plantillas: solo al exportar.
   - Catálogo de materiales (1748) y planes de mantenimiento: solo al usar
     requerimientos o el control de mantenimiento.
   Cada archivo se pide una sola vez; después queda en memoria y en el
   celular (service worker), así que funciona también sin señal. */
const _scriptsCargados = {};
function cargarScript(src){
  if(!_scriptsCargados[src]){
    _scriptsCargados[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { delete _scriptsCargados[src]; reject(new Error("No se pudo cargar " + src.split("/").pop() + ". Revisa tu internet.")); };
      document.head.appendChild(s);
    });
  }
  return _scriptsCargados[src];
}
function asegurarXLSX(){ return typeof XLSX !== "undefined" ? Promise.resolve() : cargarScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); }
function asegurarJSZip(){ return typeof JSZip !== "undefined" ? Promise.resolve() : cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"); }
function asegurarMateriales(){ return typeof CATALOGO_MATERIALES !== "undefined" ? Promise.resolve() : cargarScript("datos/materiales.js"); }
function asegurarPlanesMtto(){ return typeof EQUIPOS_MTTO !== "undefined" ? Promise.resolve() : cargarScript("datos/planes-mantenimiento.js"); }

/* Fecha como "01/09/2026" (siempre con dos dígitos). Así coincide con lo que
   devuelve el servidor (dd/MM/yyyy). toLocaleDateString("es-PE") da
   "1/9/2026" en los días y meses de un dígito, por eso no se usa directo. */
function fechaPE(fecha){
  const d = fecha || new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* Compara dos fechas en texto aunque una venga "1/9/2026" y otra "01/09/2026". */
function mismaFechaPE(a, b){
  const norm = t => String(t || "").split(" ")[0].split("/").map(n => String(+n)).join("/");
  return norm(a) === norm(b);
}

function primerNombre(nombreCompleto){
  return (nombreCompleto||"").trim().split(/\s+/)[0] || nombreCompleto;
}

/* ============ ROLES ============
   Solo los admin ven, corrigen y quitan datos de otros. Operadores,
   supervisores de área y técnicos solo llenan y ven lo suyo. */
function esAdminSesion(){
  try{ return JSON.parse(localStorage.getItem("sesion_activa") || "{}").rol === "admin"; }catch(e){ return false; }
}
/* De una lista del celular, deja solo los registros de quien inició sesión
   (el admin ve todos). */
function soloMisRegistros(lista){
  const s = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  if(s.rol === "admin") return lista;
  return lista.filter(r => String(r.dni || "") === String(s.dni || ""));
}

/* ============ VERSIÓN Y ACTUALIZACIÓN DE LA APP ============
   VERSION_APP debe ser igual al número de CACHE_NAME en sw.js. */
const VERSION_APP = "v23";

function mostrarVersionApp(){
  document.querySelectorAll(".txt-version-app").forEach(el => { el.textContent = "(versión " + VERSION_APP + ")"; });
}

/* Borra lo guardado de la app (no los registros ni la sesión) y la vuelve a
   bajar de internet. Sirve si un celular se quedó con una versión antigua. */
async function actualizarApp(){
  if(!navigator.onLine){ mostrarToast("Necesitas internet para actualizar la app", false); return; }
  mostrarToast("Actualizando la app...", true);
  try{
    if("serviceWorker" in navigator){
      for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    }
    if(window.caches){
      for(const k of await caches.keys()) await caches.delete(k);
    }
  }catch(e){ console.log("No se pudo limpiar la app:", e); }
  location.reload();
}

/* ============ MODO OSCURO (manual) ============ */
function aplicarTemaGuardado(){
  const tema = localStorage.getItem("tema_preferido");
  if(tema === "oscuro" || tema === "claro"){
    document.documentElement.setAttribute("data-tema", tema);
  }
}
function alternarModoOscuro(){
  const activado = document.getElementById("switch-modo-oscuro").checked;
  const tema = activado ? "oscuro" : "claro";
  document.documentElement.setAttribute("data-tema", tema);
  localStorage.setItem("tema_preferido", tema);
}

