/**
 * wizard.js — Controlador del Wizard de Pautas de Corte
 * Versión simplificada: 4 pasos (Tipo → Subtipo → Datos/Medidas → Resultado)
 */

const Wizard = (() => {
  let history = [];
  let cfg = {};
  let preciosData = [];

  // ── Árbol de menús ──
  const MENU = {
    'ventana-corr': {
      label: 'Ventanas Correderas',
      subs: [
        { id: 'AL15',  label: 'AL/15 — Ventana Corredera Línea AL/15' },
        { id: 'AL20',  label: 'AL/20 — Ventana Corredera Línea AL/20' },
        { id: 'AL25',  label: 'AL/25 — Ventana Corredera Línea AL/25' },
        { id: 'L5000', label: 'L-5000 — Ventana Corredera Línea 5000' },
      ],
      opciones: 'ventana-corr',
    },
    'ventana-doble': {
      label: 'Ventanas Doble Contacto',
      subs: [
        { id: 'AL32_ABATIR',   label: 'Proyectante / Abatir Simple — Línea AL/32' },
        { id: 'AL32_ABATIR_D', label: 'Abatir Doble — Línea AL/32' },
        { id: 'AL42_ABATIR',   label: 'Proyectante / Abatir Simple — Línea AL/42' },
        { id: 'AL42_ABATIR_D', label: 'Abatir Doble — Línea AL/42' },
      ],
      opciones: 'ventana-doble',
    },
    'shower': {
      label: 'Shower Doors',
      subs: [
        { id: 'AM12_RECEP', label: 'Shower Doors Receptáculo (AM-12)' },
        { id: 'AM12_TINAS', label: 'Shower Doors Tinas (AM-12)' },
      ],
      opciones: 'shower',
    },
    'puerta': {
      label: 'Puertas',
      subs: [
        { id: 'AM35_ABATIR_90',       label: 'Puerta Abatir AM/35 — Corte 90°' },
        { id: 'AM35_ABATIR_45',       label: 'Puerta Abatir AM/35 — Corte 45°' },
        { id: 'AM35_VAIVEN',          label: 'Puerta Vaivén AM/35 — Corte 45°' },
        { id: 'PUERTA_ABATIR_TUBOS',  label: 'Puerta Abatir Tubos 4040/4080' },
        { id: 'PUERTA_VAIVEN_TUBULAR',label: 'Puerta Vaivén Tubular 4080' },
        { id: 'MARCO_5034',           label: 'Marco Puerta 5034' },
        { id: 'MARCO_7095',           label: 'Marco Puerta 7095' },
        { id: 'MARCO_3060',           label: 'Marco Puerta 3060' },
        { id: 'MARCO_2575',           label: 'Marco Puerta 2575' },
        { id: 'MARCO_2066',           label: 'Marco Puerta 2066' },
      ],
      opciones: 'puerta',
    },
    'pano-fijo': {
      label: 'Paños Fijos',
      subs: [
        { id: 'AL32_PANO', label: 'Paño Fijo Línea AL/32' },
        { id: 'AL42_PANO', label: 'Paño Fijo Línea AL/42' },
        { id: 'FIJO_TUBOS',label: 'Paño Fijo Tubos Cuadrados / Rectangulares' },
      ],
      opciones: 'pano-fijo',
    },
  };

  // ── Opciones extras por tipo ──
  const OPCIONES_FORMS = {
    'ventana-corr': [
      { id: 'hoja', label: 'Número de Hojas', type: 'select',
        opts: ['2 hojas','1 Corredera + 1 Fija','3 Hojas','4 Hojas'], vals: [2,21,3,4] },
      { id: 'pal', label: 'Palillo horizontal', type: 'yn' },
      { id: 'car', label: 'Caracol / cierre especial', type: 'yn' },
    ],
    'ventana-doble': [
      { id: 'pave', label: 'Palillos verticales (cant.)',   type: 'number', default: 0 },
      { id: 'pala', label: 'Palillos horizontales (cant.)', type: 'number', default: 0 },
      { id: 'cam',  label: 'Cámara de Agua',               type: 'yn' },
    ],
    'shower': [
      { id: 'fondo', label: 'Fondo del receptáculo (m, 0=sin fondo)', type: 'number', default: 0 },
    ],
    'puerta': [
      { id: 'pave', label: 'Nº Hojas (0=1 hoja, 2=2 hojas)', type: 'number', default: 0 },
      { id: 'pala', label: 'Palillo (0=No, 1=Sí)',            type: 'number', default: 0 },
      // Las puertas vaivén no llevan bisagras: giran sobre un quicio
      { id: 'bisa', label: 'Nº Bisagras',                     type: 'number', default: 3, excepto: 'VAIVEN' },
      { id: 'quicio', label: 'Tipo de Quicio', type: 'select',
        opts: ['Hidráulico', 'Mecánico'], vals: ['HD', 'ME'], solo: 'VAIVEN' },
    ],
    'pano-fijo': [
      { id: 'pave', label: 'Palillos verticales (cant.)',   type: 'number', default: 0 },
      { id: 'pala', label: 'Palillos horizontales (cant.)', type: 'number', default: 0 },
      { id: 'cam',  label: 'Cámara de Agua (solo AL/42)',   type: 'yn' },
    ],
  };

  const linMap = {
    'AL15': 'AL15', 'AL20': 'AL20', 'AL25': 'AL25', 'L5000': 'L5000',
    'AL32_ABATIR': 'AL32_ABATIR', 'AL32_ABATIR_D': 'AL32_ABATIR',
    'AL42_ABATIR': 'AL42_ABATIR', 'AL42_ABATIR_D': 'AL42_ABATIR',
    'AM12_RECEP': 'AM12', 'AM12_TINAS': 'AM12',
    'AM35_ABATIR_90': 'AM35_ABATIR', 'AM35_ABATIR_45': 'AM35_ABATIR',
    'AM35_VAIVEN': 'AM35_VAIVEN',
    'PUERTA_ABATIR_TUBOS': 'PUERTA_ABATIR_TUBOS',
    'PUERTA_VAIVEN_TUBULAR': 'PUERTA_VAIVEN_TUBULAR',
    'MARCO_5034': 'MARCO_5034', 'MARCO_7095': 'MARCO_7095',
    'MARCO_3060': 'MARCO_3060', 'MARCO_2575': 'MARCO_2575', 'MARCO_2066': 'MARCO_2066',
    'AL32_PANO': 'AL32_PANO', 'AL42_PANO': 'AL42_PANO', 'FIJO_TUBOS': 'FIJO_TUBOS',
  };

  function getSubtipoSVG(id) {
    if (['AL15', 'AL20', 'AL25', 'L5000'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="84" height="60" rx="3" stroke="currentColor" stroke-width="2.5"/>
        <rect x="12" y="14" width="38" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <rect x="50" y="14" width="38" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <rect x="16" y="32" width="2" height="16" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="82" y="32" width="2" height="16" rx="1" fill="currentColor" opacity="0.6"/>
        <path d="M22 40h16m0 0l-4-4m4 4l-4 4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="28" y="33" fill="#10b981" font-size="8" font-weight="bold" font-family="monospace">2</text>
        <path d="M78 40h-16m0 0l4-4m-4 4l4 4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="66" y="33" fill="#10b981" font-size="8" font-weight="bold" font-family="monospace">1</text>
      </svg>`;
    }
    if (['AL32_ABATIR', 'AL42_ABATIR'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="10" width="70" height="60" rx="3" stroke="currentColor" stroke-width="2.5"/>
        <rect x="19" y="14" width="62" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <path d="M19 14l12 30h38l12-30" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="4,3"/>
        <rect x="46" y="58" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.6"/>
      </svg>`;
    }
    if (['AL32_ABATIR_D', 'AL42_ABATIR_D'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="80" height="60" rx="3" stroke="currentColor" stroke-width="2.5"/>
        <rect x="14" y="14" width="35" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <path d="M14 14l35 26M14 66l35-26" stroke="#eab308" stroke-width="1.5" stroke-dasharray="3,2"/>
        <rect x="49" y="14" width="37" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <path d="M86 14L49 40M86 66L49 40" stroke="#eab308" stroke-width="1.5" stroke-dasharray="3,2"/>
      </svg>`;
    }
    if (['AM12_RECEP', 'AM12_TINAS'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="10" width="64" height="60" rx="2" stroke="currentColor" stroke-width="2.5"/>
        <rect x="22" y="14" width="27" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <rect x="49" y="14" width="27" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.04)"/>
        <circle cx="50" cy="24" r="3" fill="currentColor"/>
        <path d="M47 30l-2 6M50 31v6M53 30l2 6" stroke="#14b8a6" stroke-width="1.5"/>
      </svg>`;
    }
    if (['AM35_ABATIR_90', 'AM35_ABATIR_45', 'PUERTA_ABATIR_TUBOS'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="10" width="50" height="60" stroke="currentColor" stroke-width="2.5"/>
        <rect x="29" y="14" width="42" height="52" stroke="currentColor" stroke-width="1.5" fill="rgba(20, 184, 166, 0.02)"/>
        <rect x="63" y="36" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.6"/>
        <path d="M71 60a42 42 0 0 0-42-42" stroke="#10b981" stroke-width="1.8" stroke-dasharray="3,2"/>
      </svg>`;
    }
    if (['AM35_VAIVEN', 'PUERTA_VAIVEN_TUBULAR'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="10" width="50" height="60" stroke="currentColor" stroke-width="2.5"/>
        <rect x="29" y="14" width="42" height="52" stroke="currentColor" stroke-width="1.5"/>
        <path d="M38 40l-5-5m5 5l-5 5m5-5h24m0 0l-5-5m5 5l-5 5" stroke="#10b981" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    }
    if (id.startsWith('MARCO_')) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 70V15h40v55" stroke="currentColor" stroke-width="4" fill="none"/>
        <path d="M26 70V11h48v59" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.5"/>
      </svg>`;
    }
    if (['AL32_PANO', 'AL42_PANO'].includes(id)) {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="15" width="70" height="50" rx="2" stroke="currentColor" stroke-width="3"/>
        <rect x="20" y="20" width="60" height="40" stroke="currentColor" stroke-width="1" fill="rgba(20, 184, 166, 0.04)"/>
        <path d="M60 26l8 8M64 26l4 4" stroke="currentColor" stroke-width="1" opacity="0.3"/>
      </svg>`;
    }
    if (id === 'FIJO_TUBOS') {
      return `
      <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="15" width="60" height="50" stroke="currentColor" stroke-width="3"/>
        <line x1="50" y1="15" x2="50" y2="65" stroke="currentColor" stroke-width="2"/>
        <line x1="20" y1="40" x2="80" y2="40" stroke="currentColor" stroke-width="1.5"/>
      </svg>`;
    }
    return `
    <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="15" width="70" height="50" rx="2" stroke="currentColor" stroke-width="2"/>
    </svg>`;
  }

  function showStep(id) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'step-medidas') actualizarBarraEnVivo();
    else if (id === 'step-tipo') Cotizacion.setActual(null);
  }

  // Recalcula la ventana en edición y la refleja en la barra de metraje
  let barraTimer = null;
  function actualizarBarraEnVivo() {
    clearTimeout(barraTimer);
    barraTimer = setTimeout(async () => {
      const ok = await syncCurrentConfig(false);
      Cotizacion.setActual(ok ? window._lastCfg : null, ok ? window._lastTotales : null);
    }, 250);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const paso = document.getElementById('step-medidas');
    if (!paso) return;
    ['input', 'change', 'pointerup'].forEach(ev => paso.addEventListener(ev, actualizarBarraEnVivo));
  });

  function selectTipo(tipo) {
    cfg.tipo = tipo;
    history = ['step-tipo'];
    const menu = MENU[tipo];
    document.getElementById('subtipo-title').textContent = menu.label;
    const container = document.getElementById('subtipo-options');
    container.innerHTML = '';
    menu.subs.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'option-card';
      card.onclick = () => selectSubtipo(tipo, sub.id, sub.label);
      
      const preview = document.createElement('div');
      preview.className = 'option-card-preview';
      preview.innerHTML = getSubtipoSVG(sub.id);
      
      const label = document.createElement('div');
      label.className = 'option-card-label';
      label.textContent = sub.label;
      
      card.appendChild(preview);
      card.appendChild(label);
      container.appendChild(card);
    });
    history.push('step-subtipo');
    showStep('step-subtipo');
  }

  function selectSubtipo(tipo, subId, label) {
    cfg.subtipo = subId;
    cfg.rotu = label;
    cfg.lin = linMap[subId] || subId;

    // Título del paso 3
    document.getElementById('medidas-title').textContent = label;

    // Rellenar opciones extra dentro del paso de medidas
    const fields = camposOpciones();
    const form = document.getElementById('opciones-form');
    const secTitle = document.getElementById('opciones-dinamicas');
    form.innerHTML = '';

    if (fields.length > 0) {
      secTitle.style.display = 'block';
      fields.forEach(f => {
        const grp = document.createElement('div');
        grp.className = 'form-group';
        const lbl = document.createElement('label');
        lbl.textContent = f.label;
        grp.appendChild(lbl);

        if (f.type === 'yn') {
          const sel = document.createElement('select');
          sel.id = 'opt-' + f.id;
          sel.innerHTML = '<option value="N">No</option><option value="S">Sí</option>';
          grp.appendChild(sel);
        } else if (f.type === 'select') {
          const sel = document.createElement('select');
          sel.id = 'opt-' + f.id;
          f.opts.forEach((o, i) => {
            const op = document.createElement('option');
            op.value = f.vals[i]; op.textContent = o;
            sel.appendChild(op);
          });
          grp.appendChild(sel);
        } else {
          const inp = document.createElement('input');
          inp.type = 'number'; inp.id = 'opt-' + f.id;
          inp.value = f.default !== undefined ? f.default : 0; inp.min = 0;
          grp.appendChild(inp);
        }
        form.appendChild(grp);
      });
    } else {
      secTitle.style.display = 'none';
    }

    // Conectar preview al canvas cuando cambien las medidas
    ['inp-ancho','inp-alto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => CanvasDraw.drawPreview(cfg);
    });
    // Conectar radio de color → redibuja perfiles en tiempo real
    document.querySelectorAll('input[name="color"]').forEach(radio => {
      radio.onchange = () => CanvasDraw.drawPreview(cfg);
    });
    
    // Conectar opciones dinámicas para redibujar en tiempo real al cambiar valores
    form.oninput = () => {
      _readOpciones();
      CanvasDraw.drawPreview(cfg);
    };
    form.onchange = () => {
      _readOpciones();
      CanvasDraw.drawPreview(cfg);
    };

    // Leer opciones iniciales para sincronizar la vista previa desde el inicio
    _readOpciones();
    CanvasDraw.drawPreview(cfg);

    history.push('step-medidas');
    showStep('step-medidas');
  }

  // Campos de opciones que aplican a la línea elegida (solo / excepto filtran por cfg.lin)
  function camposOpciones() {
    const opKey = MENU[cfg.tipo]?.opciones;
    const lin = cfg.lin || '';
    return (OPCIONES_FORMS[opKey] || []).filter(f =>
      (!f.solo || lin.includes(f.solo)) && (!f.excepto || !lin.includes(f.excepto))
    );
  }

  function _readOpciones() {
    camposOpciones().forEach(f => {
      const el = document.getElementById('opt-' + f.id);
      if (!el) return;
      if (f.type === 'select') {
        const numVal = parseInt(el.value);
        if (f.id === 'hoja') {
          if (numVal === 21) { cfg.hoja = 2; cfg.fija = 1; }
          else if (numVal === 3) { cfg.hoja = 3; cfg.fija = 1; }
          else if (numVal === 4) { cfg.hoja = 4; cfg.fija = 2; }
          else { cfg.hoja = numVal; cfg.fija = 0; }
        } else { cfg[f.id] = el.value; }
      } else { cfg[f.id] = el.value; }
    });
  }

  // IVA del formulario; vacío = 19, pero 0 (exento) es válido
  function leerIva() {
    const v = parseFloat(document.getElementById('inp-iva')?.value);
    return isNaN(v) ? 19 : v;
  }

  async function calcular() {
    const obra    = document.getElementById('inp-obra').value.trim();
    if (!obra) {
      App.toast('El Nombre de Obra / Cliente es obligatorio', 'error');
      document.getElementById('inp-obra').focus();
      return;
    }
    const anchoMm = parseFloat(document.getElementById('inp-ancho').value);
    const altoMm  = parseFloat(document.getElementById('inp-alto').value);
    const cant    = parseInt(document.getElementById('inp-cant').value) || 1;
    const porce   = parseFloat(document.getElementById('inp-porce').value) || 100;
    const iva     = leerIva();
    const vidi    = document.getElementById('sel-vidrio').value;
    const coloal  = document.querySelector('input[name="color"]:checked')?.value || 'M';

    if (!anchoMm || !altoMm || anchoMm < 100 || altoMm < 100) {
      App.toast('Ingrese medidas válidas (mínimo 100 mm)', 'error');
      return;
    }

    // Convertir mm → metros para los cálculos internos
    const ancho = anchoMm / 1000;
    const alto  = altoMm  / 1000;

    // Mapear colores nuevos a sufijos compatibles con los precios
    // BL (Blanco) → usa base M (Mate) ya que no hay precios BL
    // RO (Roble)  → usa base M
    // T  (Titanio)→ usa base M
    // B  (Bronce) → B
    // M  (Mate)   → M
    const colorSufijo = { 'BL': 'M', 'B': 'B', 'M': 'M', 'RO': 'M', 'T': 'M' };
    const coloalCalc  = colorSufijo[coloal] || 'M';

    _readOpciones();

    cfg = {
      ...cfg, obra, ancho, alto, anchoMm, altoMm, cant, porce, iva, vidi,
      coloal: coloalCalc,  // sufijo para cálculos
      coloalLabel: coloal, // nombre real para mostrar
      hoja:  cfg.hoja  || 2,
      fija:  cfg.fija  || 0,
      pal:   cfg.pal   || 'N',
      pala:  parseFloat(cfg.pala)  || 0,
      pave:  parseFloat(cfg.pave)  || 0,
      car:   cfg.car   || 'N',
      cam:   cfg.cam   || 'N',
      fondo: parseFloat(cfg.fondo) || 0,
      bisa:  parseFloat(cfg.bisa)  || 3,
      jun:   'ALCO5051',
    };

    try {
      preciosData = await Precios.getData();
      cfg.valorM2 = await Precios.getValorM2(cfg.lin);
      const resultado = Calculos.calcular(cfg, preciosData);
      // Guardar para módulo de cotización
      window._lastCfg     = { ...cfg };
      window._lastTotales = { ...resultado.totales };
      mostrarResultado(resultado);
    } catch (e) {
      App.toast('Error al calcular: ' + e.message, 'error');
      console.error(e);
    }
  }

  // ── Calcula y abre directamente el modal de cotización ──
  async function calcularYCotizar() {
    const obra    = document.getElementById('inp-obra').value.trim();
    if (!obra) {
      App.toast('El Nombre de Obra / Cliente es obligatorio', 'error');
      document.getElementById('inp-obra').focus();
      return;
    }
    const anchoMm = parseFloat(document.getElementById('inp-ancho').value);
    const altoMm  = parseFloat(document.getElementById('inp-alto').value);
    if (!anchoMm || !altoMm || anchoMm < 100 || altoMm < 100) {
      App.toast('Ingrese medidas válidas (mínimo 100 mm)', 'error');
      return;
    }
    // Reutiliza la lógica de calcular() pero en vez de ir a resultado, abre el modal
    const cant    = parseInt(document.getElementById('inp-cant').value) || 1;
    const porce   = parseFloat(document.getElementById('inp-porce').value) || 100;
    const iva     = leerIva();
    const vidi    = document.getElementById('sel-vidrio').value;
    const coloal  = document.querySelector('input[name="color"]:checked')?.value || 'M';
    const ancho   = anchoMm / 1000;
    const alto    = altoMm  / 1000;
    const colorSufijo = { 'BL': 'M', 'B': 'B', 'M': 'M', 'RO': 'M', 'T': 'M' };
    const coloalCalc  = colorSufijo[coloal] || 'M';
    _readOpciones();
    cfg = {
      ...cfg, obra, ancho, alto, anchoMm, altoMm, cant, porce, iva, vidi,
      coloal: coloalCalc, coloalLabel: coloal,
      hoja:  cfg.hoja  || 2, fija:  cfg.fija  || 0,
      pal:   cfg.pal   || 'N', pala:  parseFloat(cfg.pala)  || 0,
      pave:  parseFloat(cfg.pave)  || 0, car:   cfg.car   || 'N',
      cam:   cfg.cam   || 'N', fondo: parseFloat(cfg.fondo) || 0,
      bisa:  parseFloat(cfg.bisa)  || 3, jun:   'ALCO5051',
    };
    try {
      preciosData = await Precios.getData();
      cfg.valorM2 = await Precios.getValorM2(cfg.lin);
      const resultado = Calculos.calcular(cfg, preciosData);
      window._lastCfg     = { ...cfg };
      window._lastTotales = { ...resultado.totales };
      // Capturar canvas de preview como imagen
      const canvas = document.getElementById('preview-canvas');
      const canvasDataUrl = canvas ? canvas.toDataURL('image/png') : null;
      Cotizacion.abrirModal({ cfg: { ...cfg }, totales: { ...resultado.totales }, canvasDataUrl });
    } catch (e) {
      App.toast('Error al calcular: ' + e.message, 'error');
      console.error(e);
    }
  }

  // Etiquetas de colores
  const COLOR_LABEL = { 'BL': 'Blanco', 'B': 'Bronce', 'M': 'Mate', 'RO': 'Roble', 'T': 'Titanio' };

  function mostrarResultado(resultado) {
    const { items, totales, cfg: c } = resultado;
    document.getElementById('resultado-title').textContent = cfg.rotu || 'Pauta de Corte';

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const anchoMm = cfg.anchoMm || (c.ancho * 1000);
    const altoMm  = cfg.altoMm  || (c.alto  * 1000);
    const colorNombre = COLOR_LABEL[cfg.coloalLabel] || cfg.coloalLabel || 'Mate';

    // Chips de info
    const chips = [
      { val: `${Math.round(anchoMm)} × ${Math.round(altoMm)} mm`, lbl: 'Medida' },
      { val: c.cant, lbl: 'Cantidad' },
      { val: colorNombre, lbl: 'Color' },
      { val: totales.kilos.toFixed(2) + ' kg', lbl: 'Aluminio (kg)' },
      { val: totales.metros.toFixed(2) + ' m²', lbl: 'Cristal (m²)' },
      { val: fmt(totales.aluminio),   lbl: 'Aluminio' },
      { val: fmt(totales.accesorios), lbl: 'Quincallería' },
      { val: totales.cristal > 0 ? fmt(totales.cristal) : 'S/V', lbl: 'Cristal' },
      ...(totales.porM2 ? [{ val: `${totales.m2Producto.toFixed(2)} m² × ${fmt(totales.valorM2)}`, lbl: 'Precio por m²' }] : []),
      { val: fmt(totales.neto),   lbl: 'Total Neto' },
      { val: fmt(totales.conIva), lbl: `Total c/ IVA (${c.iva}%)` },
    ];
    document.getElementById('resultado-info').innerHTML = chips.map(ch => `
      <div class="info-chip">
        <div class="chip-val">${ch.val}</div>
        <div class="chip-lbl">${ch.lbl}</div>
      </div>
    `).join('');

    // Tabla
    const tbody = document.getElementById('resultado-body');
    tbody.innerHTML = '';
    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = 'row-' + item.tipo;
      tr.innerHTML = `
        <td><code style="font-size:0.76rem;color:var(--accent);font-family:'JetBrains Mono',monospace">${item.codigo}</code></td>
        <td>${item.descripcion}</td>
        <td class="num">${item.alto  > 0 ? item.alto.toFixed(3)  : '—'}</td>
        <td class="num">${item.ancho > 0 ? item.ancho.toFixed(3) : '—'}</td>
        <td class="num">${item.cantidad.toFixed(2)}</td>
        <td class="num">${item.unidad}</td>
        <td class="num">${fmt(item.precio)}</td>
        <td class="num" style="font-weight:600">${fmt(item.total)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Footer
    document.getElementById('resultado-foot').innerHTML = `
      <tr><td colspan="6">Total Aluminio</td><td colspan="2" class="num">${fmt(totales.aluminio)}</td></tr>
      <tr><td colspan="6">Total Quincallería</td><td colspan="2" class="num">${fmt(totales.accesorios)}</td></tr>
      <tr><td colspan="6">Total Cristal / Vidrio</td><td colspan="2" class="num">${fmt(totales.cristal)}</td></tr>
      ${totales.porM2 ? `<tr><td colspan="6">Precio por m² (${totales.m2Producto.toFixed(2)} m² × ${fmt(totales.valorM2)})</td><td colspan="2" class="num">${fmt(totales.neto)}</td></tr>` : ''}
      <tr><td colspan="6" style="font-weight:700;color:var(--accent)">TOTAL NETO</td>
          <td colspan="2" class="num" style="font-weight:700;color:var(--accent)">${fmt(totales.neto)}</td></tr>
      <tr><td colspan="6">IVA (${c.iva}%)</td><td colspan="2" class="num">${fmt(totales.iva)}</td></tr>
      <tr><td colspan="6" style="font-weight:700;color:var(--success)">TOTAL CON IVA</td>
          <td colspan="2" class="num" style="font-weight:700;color:var(--success)">${fmt(totales.conIva)}</td></tr>
    `;

    CanvasDraw.drawResult(cfg, resultado);
    history.push('step-resultado');
    showStep('step-resultado');
  }

  function nuevaMedida() {
    showStep('step-medidas');
    history.push('step-medidas');
    CanvasDraw.drawPreview(cfg);
  }

  function back() {
    history.pop();
    const prev = history[history.length - 1] || 'step-tipo';
    if (prev === 'step-tipo') { cfg = {}; history = []; }
    showStep(prev);
  }

  // ── Actualiza el badge del botón cotizar en paso 3 ──
  function actualizarBadgePaso3(n) {
    const badge = document.getElementById('cot-badge-paso3');
    if (!badge) return;
    if (n > 0) {
      badge.textContent = n;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  async function syncCurrentConfig(requireObra = true) {
    const obra    = document.getElementById('inp-obra')?.value.trim() || '';
    if (requireObra && !obra) {
      App.toast('El Nombre de Obra / Cliente es obligatorio', 'error');
      document.getElementById('inp-obra')?.focus();
      return false;
    }
    const anchoMm = parseFloat(document.getElementById('inp-ancho')?.value);
    const altoMm  = parseFloat(document.getElementById('inp-alto')?.value);
    const cant    = parseInt(document.getElementById('inp-cant')?.value) || 1;
    const porce   = parseFloat(document.getElementById('inp-porce')?.value) || 100;
    const iva     = leerIva();
    const vidi    = document.getElementById('sel-vidrio')?.value || 'VD4MM';
    const coloal  = document.querySelector('input[name="color"]:checked')?.value || 'M';

    if (!anchoMm || !altoMm || anchoMm < 100 || altoMm < 100) {
      return false;
    }

    const ancho = anchoMm / 1000;
    const alto  = altoMm  / 1000;
    const colorSufijo = { 'BL': 'M', 'B': 'B', 'M': 'M', 'RO': 'M', 'T': 'M' };
    const coloalCalc  = colorSufijo[coloal] || 'M';

    _readOpciones();

    cfg = {
      ...cfg, obra, ancho, alto, anchoMm, altoMm, cant, porce, iva, vidi,
      coloal: coloalCalc,
      coloalLabel: coloal,
      hoja:  cfg.hoja  || 2,
      fija:  cfg.fija  || 0,
      pal:   cfg.pal   || 'N',
      pala:  parseFloat(cfg.pala)  || 0,
      pave:  parseFloat(cfg.pave)  || 0,
      car:   cfg.car   || 'N',
      cam:   cfg.cam   || 'N',
      fondo: parseFloat(cfg.fondo) || 0,
      bisa:  parseFloat(cfg.bisa)  || 3,
      jun:   'ALCO5051',
    };

    try {
      preciosData = await Precios.getData();
      cfg.valorM2 = await Precios.getValorM2(cfg.lin);
      const resultado = Calculos.calcular(cfg, preciosData);
      window._lastCfg     = { ...cfg };
      window._lastTotales = { ...resultado.totales };
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function agregarNuevaVentana() {
    const synced = await syncCurrentConfig();
    if (synced && window._lastCfg && window._lastTotales) {
      const items = Cotizacion.getItems();
      const yaAgregado = items.some(item => 
        item.cfg.anchoMm === window._lastCfg.anchoMm &&
        item.cfg.altoMm === window._lastCfg.altoMm &&
        item.cfg.tipo === window._lastCfg.tipo &&
        item.cfg.subtipo === window._lastCfg.subtipo &&
        item.cfg.cant === window._lastCfg.cant
      );
      if (!yaAgregado) {
        const canvas = document.getElementById('preview-canvas') || document.getElementById('resultado-canvas');
        const canvasDataUrl = canvas ? canvas.toDataURL('image/png') : null;
        Cotizacion.agregarItemDirecto(window._lastCfg, window._lastTotales, canvasDataUrl);
      }
    } else {
      App.toast('Ingrese medidas válidas antes de agregar', 'error');
      return;
    }
    cfg = {};
    history = [];
    showStep('step-tipo');
    document.querySelectorAll('.product-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
    App.toast('Iniciando nueva ventana para el presupuesto', '');
  }

  async function guardarPresupuesto() {
    const synced = await syncCurrentConfig();
    if (synced && window._lastCfg && window._lastTotales) {
      const items = Cotizacion.getItems();
      const yaAgregado = items.some(item => 
        item.cfg.anchoMm === window._lastCfg.anchoMm &&
        item.cfg.altoMm === window._lastCfg.altoMm &&
        item.cfg.tipo === window._lastCfg.tipo &&
        item.cfg.subtipo === window._lastCfg.subtipo &&
        item.cfg.cant === window._lastCfg.cant
      );
      if (!yaAgregado) {
        const canvas = document.getElementById('preview-canvas') || document.getElementById('resultado-canvas');
        const canvasDataUrl = canvas ? canvas.toDataURL('image/png') : null;
        Cotizacion.agregarItemDirecto(window._lastCfg, window._lastTotales, canvasDataUrl);
      }
    }
    
    if (Cotizacion.getItems().length === 0) {
      App.toast('No hay ventanas agregadas al presupuesto', 'error');
      return;
    }
    Cotizacion.abrirModalPresupuesto();
  }

  function duplicarVentana() {
    if (!window._lastCfg || !window._lastTotales) {
      App.toast('No hay ninguna ventana seleccionada para duplicar', 'error');
      return;
    }
    const canvas = document.getElementById('resultado-canvas') || document.getElementById('preview-canvas');
    const canvasDataUrl = canvas ? canvas.toDataURL('image/png') : null;
    const duplicado = Cotizacion.agregarItemDirecto(window._lastCfg, window._lastTotales, canvasDataUrl);
    if (duplicado) {
      App.toast(`✅ Ventana "${duplicado.descripcion}" duplicada en la cotización`, 'success');
    }
  }

  async function eliminarVentana() {
    await syncCurrentConfig(false);
    if (!window._lastCfg) {
      App.toast('No hay ninguna ventana seleccionada', 'error');
      return;
    }
    const items = Cotizacion.getItems();
    const itemCoincidente = [...items].reverse().find(item => 
      item.cfg.anchoMm === window._lastCfg.anchoMm &&
      item.cfg.altoMm === window._lastCfg.altoMm &&
      item.cfg.tipo === window._lastCfg.tipo &&
      item.cfg.subtipo === window._lastCfg.subtipo
    );
    if (itemCoincidente) {
      Cotizacion.eliminarItem(itemCoincidente.id);
      App.toast(`🗑️ Ventana "${itemCoincidente.descripcion}" eliminada del presupuesto`, 'warning');
    } else {
      App.toast('Esta ventana no estaba agregada al presupuesto', 'info');
    }
  }

  return { 
    selectTipo, 
    selectSubtipo, 
    calcular, 
    calcularYCotizar, 
    nuevaMedida, 
    back, 
    actualizarBadgePaso3, 
    getCfg: () => cfg,
    agregarNuevaVentana,
    guardarPresupuesto,
    duplicarVentana,
    eliminarVentana
  };
})();
