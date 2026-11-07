/* ============ NAVEGACIÓN ============ */
const TABS_POR_PANTALLA = {
  "pantalla-menu": "tab-inicio",
  "pantalla-registros-mtto": "tab-registrar",
  "pantalla-lista-mtto": "tab-registrar",
  "pantalla-form-mtto": "tab-registrar",
  "pantalla-lista-fallas": "tab-registrar",
  "pantalla-form-fallas": "tab-registrar",
  "pantalla-form-requerimiento": "tab-registrar",
  "pantalla-checklists": "tab-inicio",
  "pantalla-form-checklist": "tab-inicio",
  "pantalla-checklist-semanal": "tab-inicio",
  "pantalla-control-unidades": "tab-inicio",
  "pantalla-form-mantenimiento": "tab-registrar",
  "pantalla-punto-partida": "tab-inicio",
  "pantalla-admin": "tab-panel-admin",
  "pantalla-admin-actividades": "tab-panel-admin",
  "pantalla-admin-fallas": "tab-panel-admin",
  "pantalla-admin-requerimientos": "tab-panel-admin",
  "pantalla-admin-checklists": "tab-panel-admin",
  "pantalla-admin-dashboard-control": "tab-panel-admin",
  "pantalla-admin-dispositivos": "tab-panel-admin",
  "pantalla-fallas-abiertas": "tab-alertas",
  "pantalla-resolver-falla": "tab-alertas",
  "pantalla-perfil": "tab-perfil",
  "pantalla-config": "tab-perfil"
};
/* Pantallas donde la persona está escribiendo (no se recargan solas). */
function esPantallaFormulario(id){
  return id.startsWith("pantalla-form") || ["pantalla-resolver-falla", "pantalla-autoregistro", "pantalla-registro-operador"].includes(id);
}

function irA(idPantalla){
  // Llegó una versión nueva mientras llenaba un formulario: se usa al salir.
  if(window.__recargarAlVolver && !esPantallaFormulario(idPantalla)){ location.reload(); return; }
  const anterior = (document.querySelector(".pantalla.activa") || {}).id;
  document.querySelectorAll(".pantalla").forEach(p=>p.classList.remove("activa"));
  document.getElementById(idPantalla).classList.add("activa");
  animarEntradaPantalla(idPantalla, anterior);
  if(idPantalla === "pantalla-lista-mtto") renderListaMtto();
  if(idPantalla === "pantalla-lista-fallas") renderListaFallas();
  if(idPantalla === "pantalla-fallas-abiertas") cargarFallasAbiertas();
  if(idPantalla === "pantalla-admin-actividades") renderizarListadoActividadesAdmin();
  if(idPantalla === "pantalla-admin-checklists") renderizarChecklistsAdmin();
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

/* ============ PIN PERSONAL ============
   Mismas reglas que el servidor (Codigo.gs > errorPin): 4 a 6 números, ni
   el mismo número repetido ni una secuencia. Devuelve "" si está bien. */
function errorPin(pin){
  if(!/^\d{4,6}$/.test(pin)) return "El PIN debe tener de 4 a 6 números.";
  if(/^(\d)\1+$/.test(pin)) return "El PIN no puede ser el mismo número repetido (como 0000).";
  if("0123456789".includes(pin) || "9876543210".includes(pin)) return "El PIN no puede ser una secuencia (como 1234). Elige otro.";
  return "";
}

/* Revisa los dos campos "Crea tu PIN" / "Repite tu PIN". */
function errorPinNuevo(pin, pin2){
  return errorPin(pin) || (pin !== pin2 ? "Los dos PIN no coinciden. Escríbelos otra vez." : "");
}

/* La persona todavía no tiene PIN: se lo pedimos crear en una ventana y
   volvemos a intentar el ingreso con ese PIN nuevo. */
function pedirCrearPin(mensaje){
  abrirModal(`
    <div class="modal-titulo"><span>Crea tu PIN personal</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <p class="subtexto" style="margin-bottom:12px;">Desde ahora entrarás con tu DNI y este PIN. Elige de 4 a 6 números fáciles de recordar para ti y no lo compartas.</p>
    <div class="campo"><label>Nuevo PIN</label><input type="password" inputmode="numeric" maxlength="6" id="crear-pin-1" placeholder="4 a 6 números"></div>
    <div class="campo"><label>Repite tu PIN</label><input type="password" inputmode="numeric" maxlength="6" id="crear-pin-2" placeholder="Escríbelo otra vez" onkeydown="if(event.key==='Enter') confirmarCrearPin()"></div>
    <div class="error-msg ${mensaje ? "activo" : ""}" id="crear-pin-error">${esc(mensaje)}</div>
    <button type="button" class="btn btn-primario" id="btn-crear-pin" onclick="confirmarCrearPin()">Guardar PIN y entrar</button>
  `);
  setTimeout(()=>{ const el = document.getElementById("crear-pin-1"); if(el) el.focus(); }, 100);
}

async function confirmarCrearPin(){
  const pin = document.getElementById("crear-pin-1").value.trim();
  const pin2 = document.getElementById("crear-pin-2").value.trim();
  const errorEl = document.getElementById("crear-pin-error");
  const error = errorPinNuevo(pin, pin2);
  if(error){ errorEl.textContent = error; errorEl.classList.add("activo"); return; }
  const boton = document.getElementById("btn-crear-pin");
  boton.disabled = true; boton.textContent = "Guardando...";
  await intentarLogin(pin);
  const botonAun = document.getElementById("btn-crear-pin");
  if(botonAun){ botonAun.disabled = false; botonAun.textContent = "Guardar PIN y entrar"; }
}

/* ============ LOGIN ============
   pinNuevo: solo se pasa desde la ventana "Crea tu PIN personal". */
async function intentarLogin(pinNuevo){
  const usuario = document.getElementById("login-usuario").value.trim();
  const pin = document.getElementById("login-clave").value.trim();
  const errorEl = document.getElementById("login-error");
  const boton = document.getElementById("btn-login");

  if(!/^\d{8}$/.test(usuario)){
    errorEl.textContent = "Ingresa tu DNI (8 dígitos).";
    errorEl.classList.add("activo");
    return;
  }
  if(pin && !/^\d{4,6}$/.test(pin)){
    errorEl.textContent = "El PIN tiene de 4 a 6 números.";
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");
  boton.disabled = true; boton.textContent = "Verificando...";

  const datos = { tipo:"login", dni:usuario, pin, dispositivo_id: obtenerDispositivoId(), dispositivo_info: obtenerInfoDispositivo() };
  if(typeof pinNuevo === "string") datos.pin_nuevo = pinNuevo;
  const resp = await llamarServidor(datos);

  boton.disabled = false; boton.textContent = "Ingresar";

  if(resp && resp.crear_pin){
    // Si ya estaba abierta la ventana, el mensaje explica por qué no sirvió el PIN.
    pedirCrearPin(typeof pinNuevo === "string" ? resp.mensaje : "");
    return;
  }
  if(!resp.ok){
    cerrarModal();
    errorEl.textContent = resp.mensaje || "No se pudo iniciar sesión.";
    errorEl.classList.add("activo");
    document.getElementById("login-clave").value = "";
    return;
  }
  cerrarModal();
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
  recordarCuenta(sesion);
  entrarAMenu(sesion);
}

/* ============ CUENTAS GUARDADAS EN ESTE CELULAR ============
   Siempre: intro → pantalla de ingreso → inicio. Si alguien ya entró antes
   en este celular, aparece en "¿Quién ingresa?" y entra con un toque (usa
   su sesión guardada: no se guarda el PIN y funciona sin señal). Hasta 3
   cuentas por celular (en riego o sanidad lo comparten varias personas). */
const MAX_CUENTAS_CELULAR = 3;
let cuentaElegidaDni = null;

function leerCuentas(){
  try{ const l = JSON.parse(localStorage.getItem("cuentas_guardadas") || "[]"); return Array.isArray(l) ? l.filter(c => c && c.dni) : []; }
  catch(e){ return []; }
}
function guardarCuentas(lista){ localStorage.setItem("cuentas_guardadas", JSON.stringify(lista.slice(0, MAX_CUENTAS_CELULAR))); }
function cerrarSesionEnServidor(token){
  if(!token || !navigator.onLine) return;
  fetch(obtenerSyncUrl(), { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body:JSON.stringify({ tipo:"cerrar_sesion", token }) }).catch(() => {});
}
function recordarCuenta(sesion){
  if(!sesion || !sesion.dni) return;
  const lista = leerCuentas().filter(c => c.dni !== sesion.dni);
  lista.unshift(Object.assign({}, sesion, { ultimo:Date.now() }));
  // La más antigua sale de la lista y deja libre su cupo de celular.
  lista.slice(MAX_CUENTAS_CELULAR).forEach(c => cerrarSesionEnServidor(c.token));
  guardarCuentas(lista);
  cuentaElegidaDni = sesion.dni;
}
function actualizarCuentaGuardada(sesion){
  const lista = leerCuentas();
  const i = lista.findIndex(c => c.dni === sesion.dni);
  if(i !== -1){ lista[i] = Object.assign({}, lista[i], sesion); guardarCuentas(lista); }
}

/* Arranque y vuelta al ingreso: muestra las cuentas guardadas o el formulario. */
function prepararIngreso(){
  // Quien venía de una versión anterior (sesión abierta) queda como cuenta guardada.
  const anterior = localStorage.getItem("sesion_activa");
  if(anterior){
    try{ const s = JSON.parse(anterior); if(s && s.dni && !leerCuentas().some(c => c.dni === s.dni)) recordarCuenta(s); }catch(e){}
    localStorage.removeItem("sesion_activa");
  }
  if(leerCuentas().length) mostrarCuentasGuardadas();
  else mostrarFormularioIngreso();
}

function inicialesDe(nombre){
  return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
}
function mostrarCuentasGuardadas(){
  const lista = leerCuentas();
  if(!lista.length){ mostrarFormularioIngreso(); return; }
  if(!lista.some(c => c.dni === cuentaElegidaDni)) cuentaElegidaDni = lista[0].dni;
  document.getElementById("login-lista-cuentas").innerHTML = lista.map(c => `
    <div class="cuenta-guardada ${c.dni === cuentaElegidaDni ? "elegida" : ""}" role="button" tabindex="0"
      onclick="elegirCuentaGuardada(${jsArg(c.dni)})" onkeydown="if(event.key==='Enter') elegirCuentaGuardada(${jsArg(c.dni)})">
      <span class="cuenta-av">${esc(inicialesDe(c.nombre))}</span>
      <span class="cuenta-tx"><b>${esc(c.nombre || "—")}</b><span>${esc(c.cargo || c.rol || "")} · DNI ••••${esc(String(c.dni).slice(-4))}</span></span>
      <span class="cuenta-chk"></span>
      <button type="button" class="cuenta-olvidar" aria-label="Olvidar esta cuenta en este celular" title="Olvidar en este celular"
        onclick="event.stopPropagation(); pedirOlvidarCuenta(${jsArg(c.dni)})">×</button>
    </div>`).join("");
  document.getElementById("login-vista-cuentas").style.display = "block";
  document.getElementById("login-vista-form").style.display = "none";
  const btn = document.getElementById("btn-ingresar-cuenta");
  btn.disabled = false; btn.textContent = "Ingresar";
}
function elegirCuentaGuardada(dni){ cuentaElegidaDni = dni; mostrarCuentasGuardadas(); }

function mostrarFormularioIngreso(dni, mensaje){
  document.getElementById("login-vista-cuentas").style.display = "none";
  document.getElementById("login-vista-form").style.display = "block";
  document.getElementById("btn-volver-cuentas").style.display = leerCuentas().length ? "flex" : "none";
  document.getElementById("login-usuario").value = dni || "";
  document.getElementById("login-clave").value = "";
  const err = document.getElementById("login-error");
  if(mensaje){ err.textContent = mensaje; err.classList.add("activo"); } else err.classList.remove("activo");
  setTimeout(() => { const el = document.getElementById(dni ? "login-clave" : "login-usuario"); if(el && pantallaVisible("pantalla-login")) el.focus(); }, 60);
}

function ingresarConCuentaGuardada(){
  const c = leerCuentas().find(x => x.dni === cuentaElegidaDni);
  if(!c){ mostrarFormularioIngreso(); return; }
  if(!c.token){
    // La sesión venció o un admin la cerró: pide el PIN una vez más.
    mostrarFormularioIngreso(c.dni, "Por seguridad, vuelve a escribir tu PIN.");
    return;
  }
  const sesion = Object.assign({}, c);
  delete sesion.ultimo;
  sesion.dispositivo_id = obtenerDispositivoId();
  localStorage.setItem("sesion_activa", JSON.stringify(sesion));
  recordarCuenta(sesion);
  entrarAMenu(sesion);
}

function pedirOlvidarCuenta(dni){
  const c = leerCuentas().find(x => x.dni === dni);
  if(!c) return;
  abrirModal(`
    <div class="modal-titulo"><span>Olvidar cuenta</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <p class="subtexto">¿Quitar a <b>${esc(c.nombre)}</b> de este celular? La próxima vez tendrá que escribir su DNI y PIN. Sus registros no se borran.</p>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-secundario" style="flex:1;" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" style="flex:1;" onclick="olvidarCuenta(${jsArg(dni)}); cerrarModal(); prepararIngreso();">Sí, olvidar</button>
    </div>`);
}
function olvidarCuenta(dni){
  const lista = leerCuentas();
  const c = lista.find(x => x.dni === dni);
  if(c) cerrarSesionEnServidor(c.token);   // libera su cupo de celular
  guardarCuentas(lista.filter(x => x.dni !== dni));
}

/* Perfil → "Cambiar de cuenta": vuelve al ingreso sin olvidar a nadie. */
function cambiarDeCuenta(){ limpiarSesionLocal(); }

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
  document.getElementById("btn-checklist-operador").style.display = esOperador ? "flex" : "none";
  document.getElementById("tarjeta-pedir-correo").style.display = (esAdmin && !usuario.correo) ? "block" : "none";

  const tabbar = document.getElementById("tabbar-principal");
  tabbar.classList.toggle("visible", esTecnicoOAdmin);
  document.getElementById("tab-panel-admin").style.display = esAdmin ? "flex" : "none";

  // El técnico solo registra mantenimientos (no ve el control de todas las
  // unidades ni sus alertas): el botón lo lleva directo a registrar.
  const btnControl = document.getElementById("btn-control-mtto");
  if(btnControl){
    btnControl.onclick = esAdmin ? abrirControlUnidades : () => abrirFormMantenimiento();
    document.getElementById("menu-titulo-control").textContent = esAdmin ? "Control de mantenimiento" : "Registrar mantenimiento";
    document.getElementById("menu-subtexto-control").textContent = esAdmin ? "Preventivos por horómetro / km y correctivos" : "Preventivo o correctivo de una unidad";
  }
  const alerta = document.getElementById("alerta-mantenimiento");
  if(alerta && !esAdmin) alerta.style.display = "none";

  irA("pantalla-menu");

  if(esTecnicoOAdmin){
    actualizarResumenInicio();
  }
  actualizarAlertaMantenimiento(true);
  abrirEquipoDelEnlace(usuario);   // si se entró escaneando el QR de un equipo
  limpiarCopiasBorradas();         // por detrás: quita copias de registros borrados
  precargarDatos();                // por detrás: deja listo lo que se va a abrir
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
  actualizarCuentaGuardada(sesion);
  document.getElementById("tarjeta-pedir-correo").style.display = "none";
  mostrarToast("Correo guardado", true);
}

/* Perfil → "Cerrar sesión": cierra la llave en el servidor (libera el cupo
   de celular) y olvida la cuenta en este celular. */
function cerrarSesion(){
  const s = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  if(s.dni) olvidarCuenta(s.dni);
  else cerrarSesionEnServidor(tokenSesion());
  limpiarSesionLocal();
}

/* El servidor avisó que la sesión ya no vale (venció o la cerró un admin).
   La cuenta sigue en la lista, pero al tocarla pedirá el PIN otra vez. */
function manejarSesionVencida(){
  const guardada = localStorage.getItem("sesion_activa");
  if(!guardada) return;
  let dni = "";
  try{ dni = JSON.parse(guardada).dni || ""; }catch(e){}
  const lista = leerCuentas();
  const c = lista.find(x => x.dni === dni);
  if(c){ c.token = ""; guardarCuentas(lista); }
  limpiarSesionLocal();
  mostrarFormularioIngreso(dni, "Por seguridad, vuelve a escribir tu PIN.");
  mostrarToast("Por seguridad, vuelve a ingresar con tu PIN", false);
}

function limpiarSesionLocal(){
  localStorage.removeItem("sesion_activa");
  // Lo guardado para abrir al instante es de esta persona: se borra al salir.
  for(const k in _respuestasMemoria) delete _respuestasMemoria[k];
  borrarRespuestasGuardadas();
  localStorage.removeItem("cache_control_mtto");
  if(typeof controlDatos !== "undefined") controlDatos = { parametros:[], mantenimientos:[], lecturas:{}, fallas:[], checklists:[], actualizado:null };
  if(typeof adminDatosCache !== "undefined") adminDatosCache = { actividades:[], fallas:[], requerimientos:[] };
  if(typeof fallasAbiertasCache !== "undefined") fallasAbiertasCache = [];
  document.getElementById("login-usuario").value="";
  document.getElementById("login-clave").value="";
  cerrarModal();
  document.getElementById("tabbar-principal").classList.remove("visible");
  irA("pantalla-login");
  prepararIngreso();
}

/* ============ TÉCNICO RESPONSABLE (lista de personas activas) ============
   Reusa el mismo endpoint "cupos" que ya existe para el autoregistro: trae
   a todos los usuarios de la hoja USUARIOS y nos quedamos solo con los que
   ya tienen DNI cargado (o sea, cuentas activas de verdad, sin los cupos
   "pendientes" que todavía no le pertenecen a nadie). Así el desplegable
   siempre refleja quién está realmente en el equipo, sin tocar código. */
let listaTecnicosResponsables = [];

async function cargarTecnicosResponsables(){
  const resp = await llamarServidor({ tipo:"cupos" }, { silencioso:true });
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
  document.getElementById("autoregistro-pin").value = "";
  document.getElementById("autoregistro-pin2").value = "";
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
  const pin = document.getElementById("autoregistro-pin").value.trim();
  const errorDelPin = errorPinNuevo(pin, document.getElementById("autoregistro-pin2").value.trim());
  if(errorDelPin){
    errorEl.textContent = errorDelPin;
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");

  const resp = await llamarServidor({
    tipo:"autoregistro",
    slot_id: cupoElegido.slot_id,
    dni,
    pin_nuevo: pin,
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
  ["oper-reg-dni","oper-reg-nombre","oper-reg-whatsapp","oper-reg-correo","oper-reg-pin","oper-reg-pin2"].forEach(id=>{
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
  const pin = document.getElementById("oper-reg-pin").value.trim();
  const errorDelPin = errorPinNuevo(pin, document.getElementById("oper-reg-pin2").value.trim());
  if(errorDelPin){
    errorEl.textContent = errorDelPin;
    errorEl.classList.add("activo");
    return;
  }
  errorEl.classList.remove("activo");

  const resp = await llamarServidor({
    tipo: "registrar_operador",
    dni, nombre, area, whatsapp,
    pin_nuevo: pin,
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

