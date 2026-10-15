/* ============ NAVEGACIÓN ============ */
const TABS_POR_PANTALLA = {
  "pantalla-menu": "tab-inicio",
  "pantalla-registros-mtto": "tab-registrar",
  "pantalla-lista-mtto": "tab-registrar",
  "pantalla-form-mtto": "tab-registrar",
  "pantalla-lista-fallas": "tab-registrar",
  "pantalla-form-fallas": "tab-registrar",
  "pantalla-form-requerimiento": "tab-registrar",
  "pantalla-admin": "tab-panel-admin",
  "pantalla-admin-actividades": "tab-panel-admin",
  "pantalla-admin-fallas": "tab-panel-admin",
  "pantalla-admin-requerimientos": "tab-panel-admin",
  "pantalla-admin-solicitudes": "tab-panel-admin",
  "pantalla-admin-generar-solicitud": "tab-panel-admin",
  "pantalla-admin-dispositivos": "tab-panel-admin",
  "pantalla-fallas-abiertas": "tab-alertas",
  "pantalla-resolver-falla": "tab-alertas",
  "pantalla-perfil": "tab-perfil",
  "pantalla-config": "tab-perfil"
};
function irA(idPantalla){
  document.querySelectorAll(".pantalla").forEach(p=>p.classList.remove("activa"));
  document.getElementById(idPantalla).classList.add("activa");
  if(idPantalla === "pantalla-lista-mtto") renderListaMtto();
  if(idPantalla === "pantalla-lista-fallas") renderListaFallas();
  if(idPantalla === "pantalla-fallas-abiertas") cargarFallasAbiertas();
  if(idPantalla === "pantalla-admin-actividades") renderizarListadoActividadesAdmin();
  if(idPantalla === "pantalla-admin-fallas"){ renderizarListadoFallasAdmin(); actualizarAnalisisPeriodo(); }
  if(idPantalla === "pantalla-menu") actualizarTextoPendientes();
  if(idPantalla === "pantalla-form-mtto" || idPantalla === "pantalla-form-fallas") cargarTecnicosResponsables();
  if(idPantalla === "pantalla-config") document.getElementById("config-url").value = localStorage.getItem("sync_url")||"";
  if(idPantalla === "pantalla-perfil"){
    const tema = localStorage.getItem("tema_preferido");
    document.getElementById("switch-modo-oscuro").checked = tema === "oscuro";
  }

  document.querySelectorAll("#tabbar-principal .tab-item").forEach(t=>t.classList.remove("activo"));
  const tabActivo = TABS_POR_PANTALLA[idPantalla];
  if(tabActivo){
    const el = document.getElementById(tabActivo);
    if(el) el.classList.add("activo");
  }

  window.scrollTo(0,0);
}

/* ============ LOGIN ============ */
async function intentarLogin(){
  const usuario = document.getElementById("login-usuario").value.trim();
  const clave = document.getElementById("login-clave").value.trim();
  const errorEl = document.getElementById("login-error");
  const boton = document.getElementById("btn-login");

  const dniValido = /^\d{8}$/.test(usuario);
  if(!dniValido || usuario !== clave){
    errorEl.textContent = "Ingresa tu usuario (8 dígitos) igual en ambos campos.";
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");
  boton.disabled = true; boton.textContent = "Verificando...";

  const resp = await llamarServidor({ tipo:"login", dni:usuario, dispositivo_id: obtenerDispositivoId(), dispositivo_info: obtenerInfoDispositivo() });

  boton.disabled = false; boton.textContent = "Ingresar";

  if(!resp.ok){
    errorEl.textContent = resp.mensaje || "No se pudo iniciar sesión.";
    errorEl.classList.add("activo");
    return;
  }
  guardarSesionYEntrar(resp.usuario, resp.token);
}

function guardarSesionYEntrar(usuario, token){
  const sesion = {
    dni: usuario.dni,
    nombre: usuario.nombre,
    rol: usuario.rol,
    cargo: usuario.cargo,
    area: usuario.area || "",
    whatsapp: usuario.whatsapp || "",
    correo: usuario.correo || "",
    es_jefe_area: !!usuario.es_jefe_area,
    dispositivo_id: obtenerDispositivoId(),
    token: token || ""
  };
  localStorage.setItem("sesion_activa", JSON.stringify(sesion));
  entrarAMenu(sesion);
}

function entrarAMenu(usuario){
  const esAdmin = usuario.rol === "admin";
  const esOperador = usuario.rol === "operador";
  const esTecnicoOAdmin = !esOperador;
  document.getElementById("menu-nombre-usuario").textContent = esAdmin
    ? primerNombre(usuario.nombre)
    : `${primerNombre(usuario.nombre)} (${usuario.cargo})`;

  document.getElementById("franja-operador-info").style.display = esOperador ? "flex" : "none";
  document.getElementById("resumen-inicio").style.display = esTecnicoOAdmin ? "grid" : "none";
  document.getElementById("menu-tecnico-admin").style.display = esTecnicoOAdmin ? "block" : "none";
  document.getElementById("bloque-perfil-inline").style.display = esOperador ? "block" : "none";
  document.getElementById("btn-reportar-falla-operador").style.display = esOperador ? "flex" : "none";
  document.getElementById("btn-solicitar-actividad").style.display = (esOperador && usuario.es_jefe_area) ? "flex" : "none";
  document.getElementById("tarjeta-pedir-correo").style.display = (esAdmin && !usuario.correo) ? "block" : "none";

  const tabbar = document.getElementById("tabbar-principal");
  tabbar.classList.toggle("visible", esTecnicoOAdmin);
  document.getElementById("tab-panel-admin").style.display = esAdmin ? "flex" : "none";

  irA("pantalla-menu");

  if(esTecnicoOAdmin){
    actualizarResumenInicio();
  }
}

async function guardarCorreoAdmin(){
  const correo = document.getElementById("pedir-correo-input").value.trim();
  if(!correo){ mostrarToast("Ingresa un correo o toca \"Ahora no\"", false); return; }
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"actualizar_correo", dni: sesion.dni, correo });
  if(!resp || !resp.ok){
    mostrarToast((resp && resp.mensaje) || "No se pudo guardar el correo.", false);
    return;
  }
  sesion.correo = correo;
  localStorage.setItem("sesion_activa", JSON.stringify(sesion));
  document.getElementById("tarjeta-pedir-correo").style.display = "none";
  mostrarToast("Correo guardado", true);
}

function cerrarSesion(){
  // Avisa al servidor para que esa llave deje de servir (si no hay
  // internet no pasa nada: igual se cierra la sesión en el celular).
  if(tokenSesion() && navigator.onLine){
    fetch(obtenerSyncUrl(), {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ tipo:"cerrar_sesion", token: tokenSesion() })
    }).catch(()=>{});
  }
  limpiarSesionLocal();
}

/* El servidor avisó que la sesión ya no vale (venció, la cerró un admin o
   es una sesión de antes de esta versión). Se vuelve a pedir el DNI. */
function manejarSesionVencida(){
  if(!localStorage.getItem("sesion_activa")) return;
  limpiarSesionLocal();
  mostrarToast("Por seguridad, vuelve a ingresar con tu DNI", false);
}

function limpiarSesionLocal(){
  localStorage.removeItem("sesion_activa");
  document.getElementById("login-usuario").value="";
  document.getElementById("login-clave").value="";
  document.getElementById("tabbar-principal").classList.remove("visible");
  irA("pantalla-login");
}

function revisarSesionGuardada(){
  const guardada = localStorage.getItem("sesion_activa");
  if(guardada){
    entrarAMenu(JSON.parse(guardada));
  }
}

/* ============ TÉCNICO RESPONSABLE (lista de personas activas) ============
   Reusa el mismo endpoint "cupos" que ya existe para el autoregistro: trae
   a todos los usuarios de la hoja USUARIOS y nos quedamos solo con los que
   ya tienen DNI cargado (o sea, cuentas activas de verdad, sin los cupos
   "pendientes" que todavía no le pertenecen a nadie). Así el desplegable
   siempre refleja quién está realmente en el equipo, sin tocar código. */
let listaTecnicosResponsables = [];

async function cargarTecnicosResponsables(){
  const resp = await llamarServidor({ tipo:"cupos" });
  if(resp && resp.ok && Array.isArray(resp.cupos)){
    listaTecnicosResponsables = resp.cupos
      .filter(u => !u.disponible && u.nombre)
      .map(u => u.nombre)
      .sort((a,b)=>a.localeCompare(b,"es"));
    localStorage.setItem("cache_tecnicos", JSON.stringify(listaTecnicosResponsables));
  } else {
    const cache = localStorage.getItem("cache_tecnicos");
    listaTecnicosResponsables = cache ? JSON.parse(cache) : [];
  }
  poblarSelectTecnico("mtto-tecnico-responsable");
  poblarSelectTecnico("falla-tecnico-responsable");
}

function poblarSelectTecnico(idSelect){
  const sel = document.getElementById(idSelect);
  if(!sel) return;
  const valorPrevio = sel.value;
  sel.innerHTML = '<option value="">Selecciona un técnico</option>' +
    listaTecnicosResponsables.map(n => `<option${n===valorPrevio?" selected":""}>${esc(n)}</option>`).join("");
  if(!sel.value){
    const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
    if(sesion.nombre && listaTecnicosResponsables.includes(sesion.nombre)) sel.value = sesion.nombre;
  }
}

/* ============ AUTOREGISTRO (usuarios sin DNI cargado todavía) ============ */
let cupoElegido = null;

async function mostrarAutoregistro(){
  irA("pantalla-autoregistro");
  document.getElementById("autoregistro-form").style.display = "none";
  cupoElegido = null;
  const cont = document.getElementById("autoregistro-cupos");
  cont.innerHTML = `<div class="subtexto">Cargando usuarios pendientes...</div>`;

  const resp = await llamarServidor({ tipo:"cupos" });
  if(!resp.ok){
    cont.innerHTML = `<div class="error-msg activo">${esc(resp.mensaje || "No se pudo cargar la lista.")}</div>`;
    return;
  }
  const pendientes = resp.cupos.filter(c=>c.disponible);
  if(pendientes.length===0){
    cont.innerHTML = `<div class="subtexto">Ya no hay usuarios pendientes por registrar.</div>`;
    return;
  }
  cont.innerHTML = pendientes.map(c=>`
    <button class="modulo-btn" style="margin-bottom:10px;" onclick="elegirCupo(${esc(JSON.stringify(c))})">
      <div class="modulo-txt">
        <div class="titulo-lg">${esc(c.nombre)}</div>
        <div class="subtexto">${esc(c.cargo)}</div>
      </div>
      <div class="modulo-flecha"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
  `).join("");
}

function elegirCupo(cupo){
  cupoElegido = cupo;
  document.getElementById("autoregistro-nombre-elegido").textContent = cupo.nombre;
  document.getElementById("autoregistro-cargo-elegido").textContent = cupo.cargo;
  document.getElementById("autoregistro-dni").value = "";
  document.getElementById("autoregistro-error").classList.remove("activo");
  document.getElementById("autoregistro-form").style.display = "block";
}

async function confirmarAutoregistro(){
  const dni = document.getElementById("autoregistro-dni").value.trim();
  const errorEl = document.getElementById("autoregistro-error");
  if(!cupoElegido){ return; }
  if(!/^\d{8}$/.test(dni)){
    errorEl.textContent = "Ingresa un DNI válido de 8 dígitos.";
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");

  const resp = await llamarServidor({
    tipo:"autoregistro",
    slot_id: cupoElegido.slot_id,
    dni,
    dispositivo_id: obtenerDispositivoId()
  });
  if(!resp.ok){
    errorEl.textContent = resp.mensaje || "No se pudo completar el registro.";
    errorEl.classList.add("activo");
    return;
  }
  mostrarToast("¡Usuario activado!", true);
  guardarSesionYEntrar(resp.usuario, resp.token);
}

/* ============ REGISTRO DE OPERADOR (campo, packing, etc.) ============ */
function mostrarRegistroOperador(){
  ["oper-reg-dni","oper-reg-nombre","oper-reg-whatsapp","oper-reg-correo"].forEach(id=>{
    document.getElementById(id).value = "";
  });
  document.getElementById("oper-reg-area").value = "";
  document.getElementById("oper-reg-area-otro").value = "";
  document.getElementById("oper-reg-area-otro").style.display = "none";
  document.getElementById("oper-reg-jefe").checked = false;
  document.getElementById("oper-reg-correo-campo").style.display = "none";
  document.getElementById("oper-reg-error").classList.remove("activo");
  irA("pantalla-registro-operador");
}

function toggleCorreoJefeArea(){
  const esJefe = document.getElementById("oper-reg-jefe").checked;
  document.getElementById("oper-reg-correo-campo").style.display = esJefe ? "block" : "none";
}

async function confirmarRegistroOperador(){
  const dni = document.getElementById("oper-reg-dni").value.trim();
  const nombre = document.getElementById("oper-reg-nombre").value.trim();
  const area = valorOtro("oper-reg-area","oper-reg-area-otro");
  const whatsapp = document.getElementById("oper-reg-whatsapp").value.trim();
  const esJefeArea = document.getElementById("oper-reg-jefe").checked;
  const correo = document.getElementById("oper-reg-correo").value.trim();
  const errorEl = document.getElementById("oper-reg-error");

  if(!/^\d{8}$/.test(dni) || !nombre || !area || !/^\d{9}$/.test(whatsapp) || (esJefeArea && !correo)){
    errorEl.textContent = esJefeArea && !correo
      ? "Como jefe/supervisor de área, el correo corporativo es obligatorio."
      : "Completa todos los campos obligatorios (DNI de 8 dígitos, WhatsApp de 9 dígitos).";
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");

  const resp = await llamarServidor({
    tipo: "registrar_operador",
    dni, nombre, area, whatsapp,
    correo: correo || "",
    es_jefe_area: esJefeArea,
    dispositivo_id: obtenerDispositivoId()
  });
  if(!resp.ok){
    errorEl.textContent = resp.mensaje || "No se pudo completar el registro.";
    errorEl.classList.add("activo");
    return;
  }
  mostrarToast("¡Registro completado!", true);
  guardarSesionYEntrar(resp.usuario, resp.token);
}

/* ============ CAMPOS "OTROS (ESPECIFICAR)" ============ */
function mostrarOtro(idSelect, idInput){
  const val = document.getElementById(idSelect).value;
  document.getElementById(idInput).style.display = (val==="Otros") ? "block" : "none";
}

