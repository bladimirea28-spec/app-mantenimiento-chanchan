/* ============ SINCRONIZACIÓN CON GOOGLE SHEETS ============ */
function guardarConfigUrl(){
  const url = document.getElementById("config-url").value.trim();
  if(!url.startsWith("https://script.google.com/")){
    mostrarToast("Esa URL no parece de Apps Script. Revísala.", false);
    return;
  }
  localStorage.setItem("sync_url", url);
  mostrarToast("Conexión guardada", true);
  irA("pantalla-menu");
}

async function contarPendientes(){
  const acts = await leerStore("actividades");
  const falls = await leerStore("fallas");
  const reqs = await leerStore("requerimientos");
  const chks = await leerStore("checklists");
  return [acts, falls, reqs, chks].reduce((n, lista) => n + lista.filter(r=>!r.sincronizado).length, 0);
}

async function actualizarTextoPendientes(){
  const els = [document.getElementById("txt-pendientes"), document.getElementById("txt-pendientes-perfil")].filter(Boolean);
  if(els.length===0) return;
  const n = await contarPendientes();
  const url = obtenerSyncUrl();
  const texto = !url ? "Falta configurar la conexión" : (n===0 ? "Todo sincronizado ✓" : `${n} registro(s) pendiente(s)`);
  els.forEach(el=>{ el.textContent = texto; });
}

async function sincronizarTodo(){
  const url = obtenerSyncUrl();
  if(!url){
    mostrarToast("Primero configura la conexión a Google Sheets", false);
    irA("pantalla-config");
    return;
  }
  if(!navigator.onLine){
    mostrarToast("Sin conexión a internet ahora mismo", false);
    return;
  }
  mostrarToast("Sincronizando...", true);

  const acts = (await leerStore("actividades")).filter(r=>!r.sincronizado);
  const falls = (await leerStore("fallas")).filter(r=>!r.sincronizado);
  const reqs = (await leerStore("requerimientos")).filter(r=>!r.sincronizado);
  let exitos = 0, fallos = 0;

  // El número definitivo de OT / falla lo asigna el servidor (es único para
  // todos los celulares); el del celular era solo provisional.
  for(const r of acts){
    const res = await enviarRegistro(url, "actividad", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; if(res.id_ot) r.id_ot = res.id_ot; await guardarEnStore("actividades", r); exitos++; } else fallos++;
  }
  for(const r of falls){
    const res = await enviarRegistro(url, "falla", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; if(res.id_falla) r.id_falla = res.id_falla; await guardarEnStore("fallas", r); exitos++; } else fallos++;
  }
  const correlativosNuevos = [];
  for(const r of reqs){
    const res = await enviarRegistro(url, "requerimiento", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){
      r.sincronizado = true;
      if(res.correlativo){ r.correlativo = res.correlativo; correlativosNuevos.push(res.correlativo); }
      await guardarEnStore("requerimientos", r);
      exitos++;
    } else fallos++;
  }

  const chks = (await leerStore("checklists")).filter(r=>!r.sincronizado);
  for(const r of chks){
    const res = await enviarRegistro(url, "checklist", r);
    if(res.sesion_invalida){ manejarSesionVencida(); return; }
    if(res.ok){ r.sincronizado = true; await guardarEnStore("checklists", r); exitos++; } else fallos++;
  }

  let mensajeFinal = fallos===0 ? `${exitos} registro(s) sincronizado(s)` : `${exitos} listo(s), ${fallos} con error`;
  if(correlativosNuevos.length){ mensajeFinal += ` (${correlativosNuevos.join(", ")})`; }
  mostrarToast(mensajeFinal, fallos===0);
  actualizarTextoPendientes();
}

async function enviarRegistro(url, tipo, registro){
  try{
    const resp = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"text/plain;charset=utf-8"}, // evita preflight CORS en Apps Script
      body: JSON.stringify({ tipo, registro, token: tokenSesion() })
    });
    const data = await resp.json();
    return data || { ok:false };
  }catch(err){
    console.error("Error sincronizando:", err);
    return { ok:false };
  }
}

