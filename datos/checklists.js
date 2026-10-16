/* ============ FORMATOS DE CHECKLIST DIARIO ============
   Copiados de "chek list PRE OPERACIONAL EQUIPOS CHAN CHAN.xlsx".
   Para agregar otro checklist: copia un bloque completo, cambia el id (sin
   espacios ni tildes), el código del formato, los equipos y los puntos.
   No hace falta tocar nada más de la app.

   - marcas: las opciones de cada punto (C = Conforme, NC = No conforme,
     O = Observado, NA = No aplica).
   - filtroEquipos: qué equipos del catálogo (datos/equipos.js) aparecen en
     la lista; se compara con el texto del equipo. Si ninguno coincide, el
     operador puede escribir el equipo a mano.
   - lectura: el horómetro o kilometraje que se anota cada día.
   - pideTurno / pideTractor: campos extra del encabezado. */

const NOMBRES_MARCAS = { C:"Conforme", NC:"No conforme", O:"Observado", NA:"No aplica" };

const CHECKLISTS = [
  {
    id: "trimoto",
    codigo: "MTTO 024 6 02",
    nombre: "Trimotos",
    titulo: "Check list de vehículos / equipos menores para usuario",
    filtroEquipos: /TRIMOTO/i,
    lectura: { tipo: "km", etiqueta: "Kilometraje", unidad: "km" },
    marcas: ["C", "NC", "O", "NA"],
    pideTurno: false,
    pideTractor: false,
    secciones: [
      { nombre: "", items: [
        { texto: "Nivel de aceite" },
        { texto: "Líquido de frenos (si aplica)" },
        { texto: "Verificación de claxon (si aplica)" },
        { texto: "Revisión fugas de aceite" },
        { texto: "Verificación velocímetro (si aplica)" },
        { texto: "Verificación luces delanteras (si aplica)" },
        { texto: "Verificación direccionales (si aplica)" },
        { texto: "Verificación luz de frenado (si aplica)" },
        { texto: "Verificación de espejos (si aplica)" },
        { texto: "Nivel tanque de combustible" },
        { texto: "Verificación de asiento (si aplica)" },
        { texto: "Estado de neumáticos (si aplica)" },
        { texto: "Estado de estructura chasis" },
        { texto: "Limpieza de unidad / equipo" },
        { texto: "Funcionamiento general de equipo" },
        { texto: "Estado de mangueras y abrazaderas" },
        { texto: "Estado de pernos y fijaciones" }
      ]}
    ]
  },
  {
    id: "tractor",
    codigo: "MTTO 026 9 01",
    nombre: "Tractor agrícola",
    titulo: "Check list pre-operacional tractor agrícola",
    // "(^|[^X])TRACTOR" evita que entren los EXTRACTORES de secado.
    filtroEquipos: /(^|[^X])TRACTOR/i,
    lectura: { tipo: "horometro", etiqueta: "Horómetro", unidad: "h" },
    marcas: ["C", "NC", "O"],
    pideTurno: true,
    pideTractor: false,
    secciones: [
      { nombre: "", items: [
        { texto: "Nivel de aceites", detalle: "Verificar el nivel de aceite de motor y aceite hidráulico" },
        { texto: "Nivel de agua / refrigerante", detalle: "Verificar el nivel de agua o refrigerante del radiador" },
        { texto: "Nivel de combustible", detalle: "Verificar el nivel de combustible" },
        { texto: "Fugas", detalle: "Verificar presencia de fugas de aceite, combustible o refrigerante" },
        { texto: "Motor", detalle: "Verificar arranque y funcionamiento normal del motor" },
        { texto: "Neumáticos", detalle: "Verificar estado y presión de los neumáticos (visual)" },
        { texto: "Dirección", detalle: "Verificar funcionamiento y respuesta de la dirección" },
        { texto: "Frenos", detalle: "Verificar funcionamiento de los frenos" },
        { texto: "Embrague", detalle: "Verificar funcionamiento del embrague" },
        { texto: "Toma de fuerza (TDF)", detalle: "Verificar funcionamiento de la toma de fuerza" },
        { texto: "Enganche de tres puntos", detalle: "Verificar estado y funcionamiento del enganche" },
        { texto: "Luces y tablero", detalle: "Verificar funcionamiento de luces, indicadores y testigos" }
      ]}
    ]
  },
  {
    id: "jacto",
    codigo: "MTTO 026 8 02",
    nombre: "Implemento Jacto",
    titulo: "Check list pre-operacional implemento de aplicación Jacto",
    filtroEquipos: /JACTO/i,
    lectura: { tipo: "horometro", etiqueta: "Horómetro", unidad: "h" },
    marcas: ["C", "NC", "O"],
    pideTurno: true,
    pideTractor: true,
    secciones: [
      { nombre: "Tanque de aplicación", items: [
        { texto: "Tanque sin fisuras, grietas o daños visibles" },
        { texto: "Tanque correctamente fijado y sin fugas" }
      ]},
      { nombre: "Bomba Jacto", items: [
        { texto: "Funcionamiento y estado general de la bomba Jacto JP 150" },
        { texto: "Inspección de nivel de aceite de la bomba" }
      ]},
      { nombre: "Mangueras", items: [
        { texto: "Mangueras de succión de agua en buen estado" },
        { texto: "Conexiones de succión correctamente fijadas y sin fugas" }
      ]},
      { nombre: "Estructura y puntos de enganche", items: [
        { texto: "Cardán, crucetas y protector en buen estado" },
        { texto: "Estructura del implemento sin fisuras o deformaciones" },
        { texto: "Aguilones en buen estado y sin deformaciones" }
      ]},
      { nombre: "Filtros y agitador", items: [
        { texto: "Sistema de agitación funcionando correctamente" },
        { texto: "Buen estado de faja de agitación" },
        { texto: "Filtros limpios y en buen estado" }
      ]},
      { nombre: "Mandobar", items: [
        { texto: "Manómetro en buen estado y con lectura visible" },
        { texto: "Válvulas y comandos funcionando correctamente" }
      ]}
    ]
  }
];
