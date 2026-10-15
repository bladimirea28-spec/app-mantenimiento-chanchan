/* ============ SOLICITUD DE ACTIVIDAD (solo jefes/supervisores de área) ============
   A diferencia de las fallas, esta se envía directo al servidor (no se
   guarda offline primero) porque el servidor valida ahí mismo que quien
   la pide sea realmente jefe/supervisor de área con correo registrado. */
function abrirFormSolicitud(){
  ["solicitud-equipo","solicitud-detalle","solicitud-comentarios","solicitud-fecha-tentativa"].forEach(id=>{
    document.getElementById(id).value="";
  });
  document.getElementById("solicitud-area").value="";
  document.getElementById("solicitud-area-otro").value="";
  document.getElementById("solicitud-area-otro").style.display="none";
  document.getElementById("solicitud-prioridad").value="";
  fotosTemp.solicitud = [];
  renderFotoPreviews("solicitud","solicitud-foto-previews");
  irA("pantalla-form-solicitud");
}

async function guardarSolicitud(){
  const equipo = document.getElementById("solicitud-equipo").value.trim();
  const area = valorOtro("solicitud-area","solicitud-area-otro");
  const prioridad = document.getElementById("solicitud-prioridad").value;
  const fechaTentativa = document.getElementById("solicitud-fecha-tentativa").value;
  const detalle = document.getElementById("solicitud-detalle").value.trim();
  const comentarios = document.getElementById("solicitud-comentarios").value.trim();

  if(!equipo || !area || !prioridad || !fechaTentativa || !detalle){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({
    tipo: "solicitar_actividad",
    dni: sesion.dni,
    registro: {
      area, equipo, prioridad,
      fecha_tentativa: fechaTentativa,
      detalle, comentarios,
      fotos: [...fotosTemp.solicitud]
    }
  });
  if(!resp || !resp.ok){
    mostrarToast((resp && resp.mensaje) || "No se pudo enviar la solicitud.", false);
    return;
  }
  mostrarToast("Solicitud enviada", true);
  irA("pantalla-menu");
}

/* ============ ADMIN: GENERAR SOLICITUD DE TRABAJO A NOMBRE DE UN JEFE DE ÁREA ============
   Pantalla nueva del Panel de Administración: la usa el admin cuando un jefe
   de área le pide generar la solicitud por él (por ejemplo, por teléfono).
   Reusa el mismo endpoint "solicitar_actividad" (el servidor ya autoriza al
   rol admin) pero envía el nombre real del solicitante en vez del nombre del
   admin, y el servidor la etiqueta como generada por Admin. */
function abrirFormSolicitudAdmin(){
  ["admsol-nombre","admsol-equipo","admsol-detalle","admsol-comentarios","admsol-fecha-tentativa"].forEach(id=>{
    document.getElementById(id).value="";
  });
  document.getElementById("admsol-area").value="";
  document.getElementById("admsol-area-otro").value="";
  document.getElementById("admsol-area-otro").style.display="none";
  document.getElementById("admsol-prioridad").value="";
  fotosTemp.solicitud_admin = [];
  renderFotoPreviews("solicitud_admin","admsol-foto-previews");
  irA("pantalla-admin-generar-solicitud");
}

async function guardarSolicitudAdmin(){
  const nombreSolicitante = document.getElementById("admsol-nombre").value.trim();
  const equipo = document.getElementById("admsol-equipo").value.trim();
  const area = valorOtro("admsol-area","admsol-area-otro");
  const prioridad = document.getElementById("admsol-prioridad").value;
  const fechaTentativa = document.getElementById("admsol-fecha-tentativa").value;
  const detalle = document.getElementById("admsol-detalle").value.trim();
  const comentarios = document.getElementById("admsol-comentarios").value.trim();

  if(!nombreSolicitante || !equipo || !area || !prioridad || !fechaTentativa || !detalle){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({
    tipo: "solicitar_actividad",
    dni: sesion.dni,
    registro: {
      nombre_solicitante: nombreSolicitante,
      area, equipo, prioridad,
      fecha_tentativa: fechaTentativa,
      detalle, comentarios,
      fotos: [...fotosTemp.solicitud_admin]
    }
  });
  if(!resp || !resp.ok){
    mostrarToast((resp && resp.mensaje) || "No se pudo enviar la solicitud.", false);
    return;
  }
  mostrarToast("Solicitud generada correctamente", true);
  irA("pantalla-admin-solicitudes");
  cargarSolicitudesAdmin(sesion);
}

