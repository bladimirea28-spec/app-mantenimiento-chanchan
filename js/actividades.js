/* ============ AUTOCOMPLETADO DE EQUIPOS ============ */
function iniciarAutocompleteEquipo(idInput, idLista){
  const input = document.getElementById(idInput);
  const lista = document.getElementById(idLista);

  input.addEventListener("input", ()=>{
    input.dataset.codigoSel = "";
    const q = input.value.trim().toLowerCase();
    if(q.length < 2){ lista.classList.remove("activa"); lista.innerHTML=""; return; }
    const resultados = EQUIPOS.filter(e =>
      e.desc.toLowerCase().includes(q) || e.codigo.includes(q)
    ).slice(0,8);
    if(resultados.length===0){ lista.classList.remove("activa"); lista.innerHTML=""; return; }
    lista.innerHTML = resultados.map(e=>{
      const descResaltada = resaltarCoincidencia(e.desc, q);
      return `<div class="autocomplete-item" data-valor="${e.codigo} - ${e.desc.replace(/"/g,'&quot;')}" data-codigo="${e.codigo}">${e.codigo} — ${descResaltada}</div>`;
    }).join("");
    lista.classList.add("activa");
    lista.querySelectorAll(".autocomplete-item").forEach(item=>{
      item.addEventListener("click", ()=>{
        input.value = item.getAttribute("data-valor");
        input.dataset.codigoSel = item.getAttribute("data-codigo") || "";
        lista.classList.remove("activa");
        if(idInput === "req-item-equipo") guardarBorradorRequerimiento();
      });
    });
  });

  document.addEventListener("click",(e)=>{
    if(!input.contains(e.target) && !lista.contains(e.target)){
      lista.classList.remove("activa");
    }
  });
}

function resaltarCoincidencia(texto,q){
  const idx = texto.toLowerCase().indexOf(q);
  if(idx===-1) return texto;
  return texto.slice(0,idx) + "<b>" + texto.slice(idx,idx+q.length) + "</b>" + texto.slice(idx+q.length);
}

/* ============ MÓDULO: ACTIVIDADES DE MANTENIMIENTO ============ */
let contadorOT = parseInt(localStorage.getItem("contador_ot")||"0",10);

function abrirFormMtto(){
  document.getElementById("mtto-equipo").value="";
  document.getElementById("mtto-area").value="";
  document.getElementById("mtto-area-otro").value="";
  document.getElementById("mtto-area-otro").style.display="none";
  document.getElementById("mtto-fechahora-inicio").value="";
  document.getElementById("mtto-fechahora-fin").value="";
  document.getElementById("mtto-total-horas").value="";
  document.getElementById("mtto-duracion-txt").textContent="";
  mttoHorasEditadoManual = false;
  document.getElementById("mtto-criticidad").value="";
  document.getElementById("mtto-tipo").value="";
  document.getElementById("mtto-especialidad").value="";
  document.getElementById("mtto-especialidad-otro").value="";
  document.getElementById("mtto-especialidad-otro").style.display="none";
  document.getElementById("mtto-horometro-km").value="";
  document.getElementById("mtto-detalle-solicitud").value="";
  document.getElementById("mtto-descripcion").value="";
  document.getElementById("mtto-comentarios").value="";
  integrantesMtto = [];
  renderIntegrantesMtto();
  fotosTemp.mtto = [];
  renderFotoPreviews("mtto","mtto-foto-previews");
  irA("pantalla-form-mtto");
}

function valorOtro(idSelect, idInput){
  const val = document.getElementById(idSelect).value;
  if(val==="Otros"){
    return document.getElementById(idInput).value.trim();
  }
  return val;
}

/* ============ DURACIÓN AUTOMÁTICA (editable) — NUEVA ACTIVIDAD ============ */
let mttoHorasEditadoManual = false;

function actualizarDuracionMtto(){
  const inicio = document.getElementById("mtto-fechahora-inicio").value;
  const fin = document.getElementById("mtto-fechahora-fin").value;
  const txt = document.getElementById("mtto-duracion-txt");
  const campoHoras = document.getElementById("mtto-total-horas");
  if(!inicio || !fin){
    if(txt) txt.textContent = "";
    return;
  }
  const ms = new Date(fin) - new Date(inicio);
  if(isNaN(ms) || ms < 0){
    if(txt) txt.textContent = "";
    return;
  }
  const horas = Math.round((ms / 3600000) * 100) / 100;
  if(txt) txt.textContent = `Duración calculada: ${horas} h (puedes ajustar el total si usaste menos u otras horas)`;
  if(campoHoras && !mttoHorasEditadoManual){
    campoHoras.value = horas;
  }
}

/* ============ INTEGRANTES — NUEVA ACTIVIDAD ============ */
let integrantesMtto = [];

function agregarIntegranteMtto(){
  integrantesMtto.push({ nombre:"", horas:"" });
  renderIntegrantesMtto();
}

function quitarIntegranteMtto(idx){
  integrantesMtto.splice(idx,1);
  renderIntegrantesMtto();
}

function actualizarIntegranteMtto(idx, campo, valor){
  if(!integrantesMtto[idx]) return;
  integrantesMtto[idx][campo] = valor;
}

function renderIntegrantesMtto(){
  const cont = document.getElementById("mtto-integrantes-lista");
  if(!cont) return;
  cont.innerHTML = integrantesMtto.map((it,i)=>`
    <div class="fila-2" style="align-items:flex-end;margin-bottom:8px;">
      <div class="campo" style="margin-bottom:0;">
        <label>Nombre</label>
        <select onchange="actualizarIntegranteMtto(${i},'nombre',this.value)">
          <option value="">Selecciona un técnico</option>
          ${listaTecnicosResponsables.map(n=>`<option${n===it.nombre?" selected":""}>${esc(n)}</option>`).join("")}
        </select>
      </div>
      <div class="campo" style="margin-bottom:0;display:flex;gap:6px;align-items:flex-end;">
        <div style="flex:1;">
          <label>Horas</label>
          <input type="number" step="0.1" min="0" value="${esc(it.horas)}" placeholder="Horas" oninput="actualizarIntegranteMtto(${i},'horas',this.value)">
        </div>
        <button type="button" class="btn btn-secundario" style="padding:10px 12px;" onclick="quitarIntegranteMtto(${i})">✕</button>
      </div>
    </div>
  `).join("");
}

async function guardarMtto(){
  const tecnicoResponsable = document.getElementById("mtto-tecnico-responsable").value;
  const equipo = document.getElementById("mtto-equipo").value.trim();
  const area = valorOtro("mtto-area","mtto-area-otro");
  const fechaHoraInicio = document.getElementById("mtto-fechahora-inicio").value;
  const fechaHoraFin = document.getElementById("mtto-fechahora-fin").value;
  const totalHoras = document.getElementById("mtto-total-horas").value;
  const criticidad = document.getElementById("mtto-criticidad").value;
  const tipo = document.getElementById("mtto-tipo").value;
  const especialidad = valorOtro("mtto-especialidad","mtto-especialidad-otro");
  const horometroKm = document.getElementById("mtto-horometro-km").value.trim();
  const detalleSolicitud = document.getElementById("mtto-detalle-solicitud").value.trim();
  const descripcion = document.getElementById("mtto-descripcion").value.trim();
  const comentarios = document.getElementById("mtto-comentarios").value.trim();
  const integrantes = integrantesMtto.filter(it => it.nombre);

  if(!tecnicoResponsable || !equipo || !area || !fechaHoraInicio || !fechaHoraFin || !totalHoras || !criticidad || !tipo || !especialidad){
    mostrarToast("Completa los campos obligatorios (*)", false);
    return;
  }

  contadorOT++;
  localStorage.setItem("contador_ot", contadorOT);
  const idOT = "OTM-" + String(contadorOT).padStart(6,"0");
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const ahora = new Date();

  const registro = {
    id: idOT + "_" + Date.now(),
    id_ot: idOT,
    fecha: fechaPE(ahora),
    anio: ahora.getFullYear(),
    usuario: sesion.nombre || "—",
    dni: sesion.dni || "—",
    tecnico_responsable: tecnicoResponsable,
    equipo, area, criticidad, tipo, especialidad, descripcion,
    fecha_hora_inicio: fechaHoraInicio,
    fecha_hora_fin: fechaHoraFin,
    total_horas: totalHoras,
    horometro_km: horometroKm,
    detalle_solicitud: detalleSolicitud,
    comentarios: comentarios,
    integrantes: integrantes,
    fotos: [...fotosTemp.mtto],
    creado: ahora.getTime(),
    sincronizado: false
  };

  await guardarEnStore("actividades", registro);
  mostrarToast("Registro guardado" + (navigator.onLine ? "" : " (pendiente de sincronizar)"), true);
  irA("pantalla-lista-mtto");
}

async function renderListaMtto(){
  const cont = document.getElementById("lista-mtto");
  const registros = await leerStore("actividades");
  if(registros.length===0){
    cont.innerHTML = `<div class="vacio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 1 1 5.4-5.4l3.6-3.6-3-3-3.6 3.6z"/></svg>
      <div style="font-weight:700;color:var(--tinta-900);margin-bottom:4px;">Todavía no hay registros</div>
      <div class="subtexto">Toca "Nuevo registro" para empezar.</div>
    </div>`;
    return;
  }
  cont.innerHTML = registros.map(r=>`
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(r.equipo)}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(r.tipo)} · ${esc(r.especialidad)}</div>
        </div>
        <span class="badge ${r.sincronizado?'':'pendiente'}">${r.sincronizado?'Sincronizado':'Pendiente'}</span>
      </div>
      ${r.descripcion?`<div class="desc">${esc(r.descripcion)}</div>`:""}
      <div class="meta">${esc(r.id_ot)} · ${esc(r.area)} · Criticidad ${esc(r.criticidad)} · ${esc(r.fecha)}${r.fotos&&r.fotos.length?' · 📷 '+r.fotos.length:''}</div>
    </div>
  `).join("");
}

/* ============ EVIDENCIA FOTOGRÁFICA (reutilizable) ============ */
const fotosTemp = { mtto: [], falla: [], falla_operador: [], solicitud: [], solicitud_admin: [] };

function iniciarFotoInput(modulo, idInput, idPreviews){
  const input = document.getElementById(idInput);
  input.addEventListener("change", async ()=>{
    for(const file of input.files){
      const b64 = await archivoABase64(file);
      fotosTemp[modulo].push(b64);
    }
    input.value = "";
    renderFotoPreviews(modulo, idPreviews);
  });
}

/* Convierte la foto a texto (base64) para guardarla en el celular y
   subirla. Antes la reduce: lado mayor de 1600 px y JPEG al 75 %. Una foto
   de celular pasa de 3-5 MB a ~200-400 KB, así se guarda y sincroniza mucho
   más rápido con poca señal. Si algo falla, se guarda la foto original. */
const FOTO_LADO_MAXIMO = 1600;
const FOTO_CALIDAD = 0.75;

function leerArchivoComoDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function archivoABase64(file){
  const original = await leerArchivoComoDataUrl(file);
  try{
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = original;
    });
    const escala = Math.min(1, FOTO_LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const reducida = canvas.toDataURL("image/jpeg", FOTO_CALIDAD);
    return reducida.length < original.length ? reducida : original;
  }catch(e){
    return original;
  }
}

function renderFotoPreviews(modulo, idPreviews){
  const cont = document.getElementById(idPreviews);
  cont.innerHTML = fotosTemp[modulo].map((foto,i)=>`
    <div class="foto-thumb">
      <img src="${urlSegura(foto)}">
      <button class="quitar" onclick="quitarFoto('${modulo}','${idPreviews}',${i})">×</button>
    </div>
  `).join("");
}

function quitarFoto(modulo, idPreviews, idx){
  fotosTemp[modulo].splice(idx,1);
  renderFotoPreviews(modulo, idPreviews);
}

