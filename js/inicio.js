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
    iniciarFotoInput("checklist","chk-foto-camara","chk-foto-previews");
    iniciarFotoInput("checklist","chk-foto-galeria","chk-foto-previews");
    iniciarFotoInput("mantenimiento","mto-foto-camara","mto-foto-previews");
    iniciarFotoInput("mantenimiento","mto-foto-galeria","mto-foto-previews");
    document.getElementById("resolver-hora-fin").addEventListener("change", actualizarDuracionResolver);
    document.getElementById("mtto-fechahora-inicio").addEventListener("change", actualizarDuracionMtto);
    document.getElementById("mtto-fechahora-fin").addEventListener("change", actualizarDuracionMtto);
    document.getElementById("mtto-total-horas").addEventListener("input", ()=>{ mttoHorasEditadoManual = true; });
    actualizarEstadoConexion();
    revisarSesionGuardada();
    cargarTecnicosResponsables();

    mostrarVersionApp();
    if("serviceWorker" in navigator){
      // Cuando se instala una versión nueva, la app se recarga una vez sola
      // para usarla de inmediato (solo si ya había una versión anterior).
      const habiaVersion = !!navigator.serviceWorker.controller;
      let recargado = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if(!habiaVersion || recargado) return;
        recargado = true;
        // Si está llenando un formulario, se espera a que vuelva al inicio.
        const activa = document.querySelector(".pantalla.activa");
        if(activa && esPantallaFormulario(activa.id)) window.__recargarAlVolver = true;
        else location.reload();
      });
      try{ await navigator.serviceWorker.register("sw.js"); }
      catch(e){ console.log("No se pudo registrar el service worker (normal si se abre como archivo local):", e); }
    }
  }finally{
    ocultarCargando();
  }
})();
