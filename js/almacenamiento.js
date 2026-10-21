/* ============ ALMACENAMIENTO LOCAL (IndexedDB) ============ */
let db;
const DB_NAME = "mantenimiento_chanchan";
const DB_VERSION = 4;

function abrirDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const d = e.target.result;
      if(!d.objectStoreNames.contains("actividades")){
        d.createObjectStore("actividades",{keyPath:"id"});
      }
      if(!d.objectStoreNames.contains("fallas")){
        d.createObjectStore("fallas",{keyPath:"id"});
      }
      if(!d.objectStoreNames.contains("requerimientos")){
        d.createObjectStore("requerimientos",{keyPath:"id"});
      }
      if(!d.objectStoreNames.contains("checklists")){
        d.createObjectStore("checklists",{keyPath:"id"});
      }
      if(!d.objectStoreNames.contains("mantenimientos")){
        d.createObjectStore("mantenimientos",{keyPath:"id"});
      }
    };
    req.onsuccess = (e)=>{ db = e.target.result; resolve(db); };
    req.onerror = (e)=> reject(e);
  });
}

function guardarEnStore(store, obj){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = ()=>resolve();
    tx.onerror = (e)=>reject(e);
  });
}

function borrarDeStore(store, id){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = ()=>resolve();
    tx.onerror = (e)=>reject(e);
  });
}

function leerStore(store){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=>resolve(req.result.sort((a,b)=>b.creado-a.creado));
    req.onerror = (e)=>reject(e);
  });
}

