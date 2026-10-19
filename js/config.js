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
    return data;
  }catch(err){
    console.error("Error llamando al servidor:", err);
    return {ok:false, mensaje:"No se pudo conectar. Revisa tu internet e intenta de nuevo."};
  }finally{
    if(!silencioso) ocultarCargando();
  }
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

