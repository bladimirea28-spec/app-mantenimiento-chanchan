/* ============ MÓDULO: HISTORIAL DE FALLAS ============ */
let contadorFalla = parseInt(localStorage.getItem("contador_falla")||"0",10);

function abrirFormFalla(){
  ["falla-equipo","falla-tipo","falla-descripcion","falla-hora-inicio"].forEach(id=>{
    document.getElementById(id).value="";
  });
  document.getElementById("falla-area").value="";
  document.getElementById("falla-area-otro").value="";
  document.getElementById("falla-area-otro").style.display="none";
  document.getElementById("falla-criticidad").value="";
  document.getElementById("falla-turno").value="";
  fotosTemp.falla = [];
  renderFotoPreviews("falla","falla-foto-previews");
  irA("pantalla-form-fallas");
}

function abrirFallasAbiertas(){
  irA("pantalla-fallas-abiertas");
}

/* Horario laboral: 06:00-12:00 y 14:00-16:00 = dentro de turno.
   12:00-14:00 (descanso) y después de 16:00 = fuera de turno / hora extra. */
function calcularTipoAtencion(horaStr){
  if(!horaStr) return "";
  const [h,m] = horaStr.split(":").map(Number);
  const minutos = h*60+m;
  const dentro1 = minutos >= (6*60) && minutos < (12*60);
  const dentro2 = minutos >= (14*60) && minutos < (16*60);
  return (dentro1 || dentro2) ? "Dentro de turno" : "Fuera de turno (hora extra)";
}

function calcularMinutosParada(inicio, fin){
  if(!inicio || !fin) return null;
  const [h1,m1] = inicio.split(":").map(Number);
  const [h2,m2] = fin.split(":").map(Number);
  let mins = (h2*60+m2) - (h1*60+m1);
  if(mins < 0) mins += 24*60; // cruce de medianoche
  return mins;
}

function claseCriticidad(c){
  const k = (c||"").toLowerCase();
  if(k==="alta") return "criticidad-alta";
  if(k==="media") return "criticidad-media";
  if(k==="baja") return "criticidad-baja";
  return "";
}
function claseEstadoFalla(e){
  const k = (e||"").toLowerCase();
  if(k==="en atención" || k==="en atencion") return "estado-atencion";
  if(k==="resuelta") return "estado-resuelta";
  return "estado-abierta";
}

async function guardarFalla(){
  const tecnicoResponsable = document.getElementById("falla-tecnico-responsable").value;
  const equipo = document.getElementById("falla-equipo").value.trim();
  const area = valorOtro("falla-area","falla-area-otro");
  const tipo = document.getElementById("falla-tipo").value.trim();
  const criticidad = document.getElementById("falla-criticidad").value;
  const descripcion = document.getElementById("falla-descripcion").value.trim();
  const horaInicio = document.getElementById("falla-hora-inicio").value;
  const turno = document.getElementById("falla-turno").value;

  if(!tecnicoResponsable || !equipo || !area || !tipo || !criticidad || !descripcion || !horaInicio || !turno){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  contadorFalla++;
  localStorage.setItem("contador_falla", contadorFalla);
  const idFalla = "F-" + String(contadorFalla).padStart(4,"0");
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const ahora = new Date();

  const registro = {
    id: idFalla + "_" + Date.now(),
    id_falla: idFalla,
    fecha: ahora.toLocaleDateString("es-PE"),
    tecnico: sesion.nombre || "—",
    dni: sesion.dni || "—",
    tecnico_responsable: tecnicoResponsable,
    equipo, area, tipo, criticidad,
    descripcion, causa:"", accion:"",
    hora_inicio: horaInicio, hora_fin:"",
    minutos_parada: null,
    operarios:"", turno,
    tipo_atencion:"",
    estado: "Abierta",
    fotos: [...fotosTemp.falla],
    creado: ahora.getTime(),
    sincronizado: false
  };

  await guardarEnStore("fallas", registro);
  mostrarToast("Falla reportada" + (navigator.onLine ? "" : " (pendiente de sincronizar)"), true);
  irA("pantalla-lista-fallas");
}

/* Pantalla simplificada para que cualquier operador (campo, packing, etc.)
   reporte una falla. Se guarda en el MISMO almacén local "fallas" que usa
   el técnico, así que reutiliza tal cual la sincronización con el servidor.
   Queda sin Técnico Responsable (se asigna solo/a cuando un técnico la
   toma desde "Fallas abiertas"), y sin hora de inicio/turno manual. */
function abrirFormFallaOperador(){
  ["oper-falla-equipo","oper-falla-tipo","oper-falla-descripcion"].forEach(id=>{
    document.getElementById(id).value="";
  });
  document.getElementById("oper-falla-area").value="";
  document.getElementById("oper-falla-area-otro").value="";
  document.getElementById("oper-falla-area-otro").style.display="none";
  document.getElementById("oper-falla-criticidad").value="";
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  document.getElementById("oper-falla-nombre").value = sesion.nombre || "";
  fotosTemp.falla_operador = [];
  renderFotoPreviews("falla_operador","oper-falla-foto-previews");
  irA("pantalla-form-falla-operador");
}

async function guardarFallaOperador(){
  const equipo = document.getElementById("oper-falla-equipo").value.trim();
  const area = valorOtro("oper-falla-area","oper-falla-area-otro");
  const tipo = document.getElementById("oper-falla-tipo").value.trim();
  const criticidad = document.getElementById("oper-falla-criticidad").value;
  const descripcion = document.getElementById("oper-falla-descripcion").value.trim();

  if(!area || !equipo || !tipo || !criticidad || !descripcion){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  contadorFalla++;
  localStorage.setItem("contador_falla", contadorFalla);
  const idFalla = "F-" + String(contadorFalla).padStart(4,"0");
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const ahora = new Date();

  const registro = {
    id: idFalla + "_" + Date.now(),
    id_falla: idFalla,
    fecha: ahora.toLocaleDateString("es-PE"),
    tecnico: sesion.nombre || "—",
    dni: sesion.dni || "—",
    tecnico_responsable: "",
    equipo, area, tipo, criticidad,
    descripcion, causa:"", accion:"",
    hora_inicio:"", hora_fin:"",
    minutos_parada: null,
    operarios:"", turno:"",
    tipo_atencion:"",
    estado: "Abierta",
    fotos: [...fotosTemp.falla_operador],
    creado: ahora.getTime(),
    sincronizado: false
  };

  await guardarEnStore("fallas", registro);
  mostrarToast("Falla reportada" + (navigator.onLine ? "" : " (pendiente de sincronizar)"), true);
  irA("pantalla-menu");
}

async function renderListaFallas(){
  const cont = document.getElementById("lista-fallas");
  const registros = await leerStore("fallas");
  if(registros.length===0){
    cont.innerHTML = `<div class="vacio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17a1.8 1.8 0 0 0 1.5 2.7h16a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z"/></svg>
      <div style="font-weight:700;color:var(--tinta-900);margin-bottom:4px;">Todavía no hay fallas registradas</div>
      <div class="subtexto">Toca "Nueva falla" para empezar.</div>
    </div>`;
    return;
  }
  cont.innerHTML = registros.map(r=>`
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(r.equipo)}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(r.tipo)}${r.minutos_parada!=null?' · '+esc(r.minutos_parada)+" min parada":""}</div>
        </div>
        <span class="badge ${r.sincronizado?'':'pendiente'}">${r.sincronizado?'Sincronizado':'Pendiente'}</span>
      </div>
      <div class="badge-fila" style="margin-top:8px;">
        ${r.criticidad?`<span class="badge ${claseCriticidad(r.criticidad)}">${esc(r.criticidad)}</span>`:''}
        <span class="badge ${claseEstadoFalla(r.estado)}">${esc(r.estado||'Abierta')}</span>
      </div>
      <div class="desc">${esc(r.descripcion)}</div>
      <div class="meta">${esc(r.id_falla)} · ${esc(r.area)} · ${esc(r.turno)}${r.tipo_atencion?' · '+esc(r.tipo_atencion):''} · ${esc(r.fecha)}${r.fotos&&r.fotos.length?' · 📷 '+r.fotos.length:''}</div>
    </div>
  `).join("");
}

/* ============ FALLAS ABIERTAS (ver / resolver) ============ */
let fallasAbiertasCache = [];
let fallaEnResolucion = null;

async function cargarFallasAbiertas(){
  const cont = document.getElementById("fallas-abiertas-lista");
  cont.innerHTML = Array.from({length:3}).map(()=>`
    <div class="skeleton-item">
      <div class="skeleton skeleton-linea" style="width:40%;"></div>
      <div class="skeleton skeleton-linea corta"></div>
    </div>
  `).join("");

  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"listado_fallas_abiertas", dni: sesion.dni, nombre: sesion.nombre, rol: sesion.rol });
  if(!resp || !resp.ok){
    cont.innerHTML = `<div class="vacio"><div class="subtexto">${esc((resp && resp.mensaje) || "No se pudo cargar. Revisa tu conexión.")}</div></div>`;
    return;
  }
  fallasAbiertasCache = resp.fallas || [];
  renderFallasAbiertas();
  actualizarBadgeAlertas();
}

function actualizarBadgeAlertas(){
  const badge = document.getElementById("tab-alertas-badge");
  if(!badge) return;
  const criticas = fallasAbiertasCache.filter(f=>f.CRITICIDAD==="Alta").length;
  if(criticas>0){
    badge.textContent = criticas>9 ? "9+" : String(criticas);
    badge.style.display = "flex";
  }else{
    badge.style.display = "none";
  }
}

async function actualizarResumenInicio(){
  if(!document.getElementById("resumen-fallas-abiertas")) return;
  await cargarFallasAbiertas();
  document.getElementById("resumen-fallas-abiertas").textContent = fallasAbiertasCache.length;
  document.getElementById("resumen-criticas").textContent = fallasAbiertasCache.filter(f=>f.CRITICIDAD==="Alta").length;

  const pendientes = await contarPendientes();
  document.getElementById("resumen-pendientes-sync").textContent = pendientes;

  const acts = await leerStore("actividades");
  const haceUnaSemana = Date.now() - 7*24*60*60*1000;
  const actsSemana = acts.filter(r=>(r.creado||0) >= haceUnaSemana).length;
  document.getElementById("resumen-actividades-semana").textContent = actsSemana;
}

function renderFallasAbiertas(){
  const cont = document.getElementById("fallas-abiertas-lista");
  if(fallasAbiertasCache.length===0){
    cont.innerHTML = `<div class="vacio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg>
      <div style="font-weight:700;color:var(--tinta-900);margin-bottom:4px;">No hay fallas abiertas</div>
      <div class="subtexto">Todo al día por ahora.</div>
    </div>`;
    return;
  }
  cont.innerHTML = fallasAbiertasCache.map(r=>`
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(r.EQUIPO)}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(r.TIPO_FALLA)} · ${esc(r.TECNICO_RESPONSABLE)}</div>
        </div>
      </div>
      <div class="badge-fila" style="margin-top:8px;">
        ${r.CRITICIDAD?`<span class="badge ${claseCriticidad(r.CRITICIDAD)}">${esc(r.CRITICIDAD)}</span>`:''}
        <span class="badge ${claseEstadoFalla(r.ESTADO)}">${esc(r.ESTADO||'Abierta')}</span>
      </div>
      <div class="desc">${esc(r.DESCRIPCION)}</div>
      <div class="meta">${esc(r.ID_FALLA)} · ${esc(r.AREA)} · ${esc(r.FECHA)} · desde ${esc(r.HORA_INICIO||'—')}</div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${String(r.ESTADO||'Abierta').toLowerCase()!=='en atención' ? `<button class="btn btn-secundario" style="margin-top:0;flex:1;" onclick="marcarEnAtencionFalla(${jsArg(r.ID_FALLA)})">En atención</button>` : ''}
        <button class="btn btn-primario" style="margin-top:0;flex:1;" onclick="abrirResolverFalla(${jsArg(r.ID_FALLA)})">Resolver</button>
      </div>
    </div>
  `).join("");
}

async function marcarEnAtencionFalla(idFalla){
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"cambiar_estado_falla", registro:{ id_falla:idFalla, estado:"En atención" }, nombre: sesion.nombre, rol: sesion.rol });
  if(!resp || !resp.ok){
    mostrarToast((resp && resp.mensaje) || "No se pudo actualizar.", false);
    return;
  }
  mostrarToast("Falla marcada en atención", true);
  cargarFallasAbiertas();
}

function abrirResolverFalla(idFalla){
  const falla = fallasAbiertasCache.find(f=>f.ID_FALLA===idFalla);
  if(!falla) return;
  fallaEnResolucion = falla;
  document.getElementById("resolver-resumen").innerHTML = `
    <div style="font-weight:700;font-size:14px;">${esc(falla.EQUIPO)}</div>
    <div class="subtexto" style="margin-top:2px;">${esc(falla.TIPO_FALLA)} · ${esc(falla.AREA)}</div>
    <div class="desc" style="margin-top:8px;">${esc(falla.DESCRIPCION)}</div>
    <div class="meta">${esc(falla.ID_FALLA)} · inicio ${esc(falla.HORA_INICIO||'—')} · ${esc(falla.TURNO)}</div>
  `;
  document.getElementById("resolver-causa").value = "";
  document.getElementById("resolver-accion").value = "";
  document.getElementById("resolver-hora-fin").value = "";
  document.getElementById("resolver-operarios").value = "";
  document.getElementById("resolver-duracion-txt").textContent = "";
  irA("pantalla-resolver-falla");
}

function actualizarDuracionResolver(){
  if(!fallaEnResolucion) return;
  const inicio = fallaEnResolucion.HORA_INICIO;
  const fin = document.getElementById("resolver-hora-fin").value;
  const el = document.getElementById("resolver-duracion-txt");
  const mins = calcularMinutosParada(inicio, fin);
  if(mins===null){ el.textContent=""; return; }
  el.textContent = `Parada: ${mins} min · ${calcularTipoAtencion(inicio)}`;
}

async function guardarResolucionFalla(){
  if(!fallaEnResolucion) return;
  const causa = document.getElementById("resolver-causa").value.trim();
  const accion = document.getElementById("resolver-accion").value.trim();
  const horaFin = document.getElementById("resolver-hora-fin").value;
  const operarios = document.getElementById("resolver-operarios").value;

  if(!causa || !accion || !horaFin || !operarios){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const registro = {
    id_falla: fallaEnResolucion.ID_FALLA,
    causa, accion,
    hora_fin: horaFin,
    minutos_parada: calcularMinutosParada(fallaEnResolucion.HORA_INICIO, horaFin),
    tipo_atencion: calcularTipoAtencion(fallaEnResolucion.HORA_INICIO),
    operarios,
    estado: "Resuelta",
    resuelto_por: sesion.nombre || "—"
  };

  const resp = await llamarServidor({ tipo:"resolver_falla", registro, nombre: sesion.nombre, rol: sesion.rol });
  if(!resp || !resp.ok){
    mostrarToast((resp && resp.mensaje) || "No se pudo guardar la resolución.", false);
    return;
  }
  mostrarToast("Falla marcada como resuelta", true);
  fallaEnResolucion = null;
  irA("pantalla-fallas-abiertas");
}

