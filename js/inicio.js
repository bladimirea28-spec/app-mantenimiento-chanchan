/* ============ TOAST ============ */
let toastTimeout;
function mostrarToast(msg, exito){
  const t = document.getElementById("toast");
  document.getElementById("toast-txt").textContent = msg;
  t.querySelector("svg").style.color = exito ? "#6FCF97" : "#E8A93B";
  t.classList.add("mostrar");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=> t.classList.remove("mostrar"), 2600);
}

/* ============ CONEXIÓN ============ */
function actualizarEstadoConexion(){
  const el = document.getElementById("indicador-conexion");
  const txt = document.getElementById("txt-conexion");
  if(!el) return;
  if(navigator.onLine){
    el.classList.remove("offline");
    txt.textContent = "En línea";
  }else{
    el.classList.add("offline");
    txt.textContent = "Sin conexión";
  }
}
window.addEventListener("online", actualizarEstadoConexion);
window.addEventListener("offline", actualizarEstadoConexion);

/* ============ INICIO ============ */
(async function iniciar(){
  mostrarCargando();
  try{
    await abrirDB();
    iniciarAutocompleteEquipo("mtto-equipo","mtto-equipo-lista");
    iniciarAutocompleteEquipo("falla-equipo","falla-equipo-lista");
    iniciarAutocompleteEquipo("oper-falla-equipo","oper-falla-equipo-lista");
    iniciarAutocompleteEquipo("solicitud-equipo","solicitud-equipo-lista");
    iniciarAutocompleteMaterial();
    iniciarAutocompleteEquipo("req-item-equipo","req-item-equipo-lista");
    iniciarFotoItemRequerimiento();
    iniciarFotoInput("mtto","mtto-foto-camara","mtto-foto-previews");
    iniciarFotoInput("mtto","mtto-foto-galeria","mtto-foto-previews");
    iniciarFotoInput("falla","falla-foto-camara","falla-foto-previews");
    iniciarFotoInput("falla","falla-foto-galeria","falla-foto-previews");
    iniciarFotoInput("falla_operador","oper-falla-foto-camara","oper-falla-foto-previews");
    iniciarFotoInput("falla_operador","oper-falla-foto-galeria","oper-falla-foto-previews");
    iniciarFotoInput("solicitud","solicitud-foto-camara","solicitud-foto-previews");
    iniciarFotoInput("solicitud","solicitud-foto-galeria","solicitud-foto-previews");
    iniciarFotoInput("solicitud_admin","admsol-foto-camara","admsol-foto-previews");
    iniciarFotoInput("solicitud_admin","admsol-foto-galeria","admsol-foto-previews");
    iniciarAutocompleteEquipo("admsol-equipo","admsol-equipo-lista");
    document.getElementById("resolver-hora-fin").addEventListener("change", actualizarDuracionResolver);
    document.getElementById("mtto-fechahora-inicio").addEventListener("change", actualizarDuracionMtto);
    document.getElementById("mtto-fechahora-fin").addEventListener("change", actualizarDuracionMtto);
    document.getElementById("mtto-total-horas").addEventListener("input", ()=>{ mttoHorasEditadoManual = true; });
    actualizarEstadoConexion();
    revisarSesionGuardada();
    cargarTecnicosResponsables();

    if("serviceWorker" in navigator){
      try{ await navigator.serviceWorker.register("sw.js"); }
      catch(e){ console.log("No se pudo registrar el service worker (normal si se abre como archivo local):", e); }
    }
  }finally{
    ocultarCargando();
  }
})();
