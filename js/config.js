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

/* Envía una acción al Apps Script (login, autoregistro, cupos, listado, etc.)
   Devuelve siempre un objeto con al menos {ok:boolean, mensaje}. */
async function llamarServidor(payload){
  const url = obtenerSyncUrl();
  if(!url){
    return {ok:false, mensaje:"Falta configurar la conexión a Google Sheets (⚙️ en el menú)."};
  }
  if(!navigator.onLine){
    return {ok:false, mensaje:"Necesitas conexión a internet para esto."};
  }
  mostrarCargando();
  try{
    const resp = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify(payload)
    });
    return await resp.json();
  }catch(err){
    console.error("Error llamando al servidor:", err);
    return {ok:false, mensaje:"No se pudo conectar. Revisa tu internet e intenta de nuevo."};
  }finally{
    ocultarCargando();
  }
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

