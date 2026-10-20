/**
 * calculos.js — Módulo de Cálculo de Pautas de Corte
 * Traducción directa de CALCULA.PRG (Clipper/dBASE → JavaScript)
 * Sistema de Aluminio - Versión Web
 */

const Calculos = (() => {

  // ── Estado global de cálculo ──
  let state = {};
  let resultItems = [];
  let precios = [];

  function init(cfg, preciosData) {
    precios = preciosData || [];
    state = {
      ancho:  parseFloat(cfg.ancho)  || 0,
      alto:   parseFloat(cfg.alto)   || 0,
      cant:   parseInt(cfg.cant)     || 1,
      porce:  parseFloat(cfg.porce)  || 100,
      iva:    isNaN(parseFloat(cfg.iva)) ? 19 : parseFloat(cfg.iva), // 0 = exento
      coloal: cfg.coloal  || 'M',
      vidi:   cfg.vidi    || 'VD4MM',
      hoja:   cfg.hoja    || 2,
      fija:   cfg.fija    || 0,
      pal:    cfg.pal     || 'N',
      pala:   cfg.pala    || 0,
      pave:   cfg.pave    || 0,
      car:    cfg.car     || 'N',
      ter:    cfg.ter     || 'N',
      ref:    cfg.ref     || 'N',
      cam:    cfg.cam     || 'N',
      xi:     cfg.xi      || 'N',
      fondo:  cfg.fondo   || 0,
      jun:    cfg.jun     || 'ALCO5051',
      bisa:   cfg.bisa    || 3,
      quicio: cfg.quicio  || 'HD',
      demas:  cfg.demas   || '',
      lin:    cfg.lin     || 'AL15',
      rotu:   cfg.rotu    || '',
      valorM2: parseFloat(cfg.valorM2) || 0,
    };
    resultItems = [];
  }

  function roundUp1(v) {
    let r = Math.round(v * 10) / 10;
    if (r < v) { v += 0.1; r = Math.round(v * 10) / 10; }
    return r;
  }

  function precio(cod) {
    const full = precios.find(p => p.codigo === cod);
    return full || { codigo: cod, descripcion: cod, precio: 0, medida: 'U', peso: 1 };
  }

  function addItem(cod, altM, anchM, override) {
    // Build final code with color suffix for aluminium profiles
    // La silicona (ALSILICOM / ALSILICOB) ya viene con el color en el código
    let c = cod;
    if (c.startsWith('AL') && !c.startsWith('ALSI')) {
      c = (c + state.coloal).substring(0, 10);
    }
    const p = precio(c);
    let cantidad = altM + anchM;
    let unidadLabel = '?';
    let pKg = p.peso || 1;
    let tot = 0;
    const cant = state.cant;
    const porce = state.porce / 100;
    const pr = p.precio || 0;
    const medida = override && override.medida ? override.medida : p.medida;

    if (medida === 'P') {
      unidadLabel = 'Mts';
      tot = cantidad * cant * pr * porce;
    } else if (medida === 'U') {
      unidadLabel = 'Und';
      pKg = 1;
      tot = cantidad * cant * pr;
    } else if (medida === 'A') {
      unidadLabel = 'M²';
      pKg = 1;
      tot = cantidad * cant * pr;
    }

    resultItems.push({
      codigo: c,
      descripcion: p.descripcion || c,
      alto: altM,
      ancho: anchM,
      cantidad: cantidad,
      cantTotal: cantidad * cant,
      unidad: unidadLabel,
      precio: pr,
      total: tot,
      peso: pKg,
      medida: medida,
      tipo: c.startsWith('AL') && !c.startsWith('ALS') ? 'aluminio' : (medida === 'A' ? 'vidrio' : 'accesorio'),
    });
  }

  // ─────────────────────────────────────────
  //  VENTANAS CORREDERAS - L5000
  // ─────────────────────────────────────────
  function l5000() {
    const { ancho, alto, hoja, fija, pal, car, coloal, vidi } = state;
    // Marco
    addItem('ALC57091', 0, ancho);           // 5001 Riel Superior
    addItem('ALC57090', 0, ancho);           // 5002 Riel Inferior
    addItem('ALC57092', alto * 2, 0);        // 5003 Jamba
    addItem('ALC57094', 0, ancho);           // 5004 Cabezal
    addItem('ALC57093', 0, pal === 'S' ? ancho * 2 : ancho);  // 5005 Hoja corredera
    // Hojas
    const altHoja = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 4 : alto * hoja);
    const altHoja2 = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 2 : alto * hoja);
    addItem('ALC58044', altHoja, 0);         // 5006 Larguero hoja
    addItem('ALC58045', altHoja2, 0);        // 5007 Travesaño hoja
    addItem('SOBU1003', (alto * 2 * hoja) + (ancho * 2), 0);  // Burletes
    addItem('SOVAFEL5', (alto * 6) + (ancho * 4), 0);          // Felpa
    addItem(coloal === 'M' ? 'SOTB83/4MB' : 'SOTB83/4BB', hoja * 4, 0); // Roscalata hojas
    addItem(coloal === 'M' ? 'SOTB81/2MB' : 'SOTB81/2BB', 2, 0);         // Roscalata marco inf
    addItem(coloal === 'M' ? 'SOTP81/2MP' : 'SOTB81/2BP', 2, 0);         // Roscalata marco sup
    addItem(coloal === 'M' ? 'SOTB61/4MB' : 'SOTB61/4BB', (hoja - fija) * 4 + fija * 2, 0); // Roscalata pestillo
    addItem('SOCRL-5000', (hoja - fija) * 2, 0);               // Carros
    addItem(coloal === 'M' ? 'SOPS5000M' : 'SOPS5000B', hoja - fija, 0); // Pestillos
    if (car === 'S') addItem(coloal === 'M' ? 'SOPSCARAM' : 'SOPSCARAC', hoja - fija, 0); // Caracol
    const tarugos = Math.round((alto * 2 + ancho * 2) * 2 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);       // Tarugos
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0); // Tornillos
    addItem('SOGUL-5000', (hoja - fija) * 2, 0); // Guías
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4) / 10, 0); // Silicona
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  VENTANAS CORREDERAS - AL-15
  // ─────────────────────────────────────────
  function l6000() {
    const { ancho, alto, hoja, fija, pal, car, coloal, vidi } = state;
    addItem('AL151501', 0, ancho);
    addItem('AL151502', 0, ancho);
    addItem('AL151503', alto * 2, 0);
    addItem('AL151504', 0, ancho);
    addItem('AL151505', 0, pal === 'S' ? ancho * 2 : ancho);
    const altHoja  = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 2 : alto * hoja);
    const altHoja2 = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 4 : alto * hoja);
    addItem('AL151507', altHoja, 0);
    addItem('AL151508', altHoja2, 0);
    addItem('SOBU1003', (alto * 2 * hoja) + (ancho * 2), 0);
    addItem('SOVAFEL5', (alto * 6) + (ancho * 4), 0);
    addItem(coloal === 'M' ? 'SOTB85/8MB' : 'SOTB85/8BB', hoja * 4, 0);
    addItem(coloal === 'M' ? 'SOTB81/2MB' : 'SOTB81/2BB', 4, 0);
    addItem(coloal === 'M' ? 'SOTB61/2MB' : 'SOTB61/2BB', (hoja - fija) * 4 + fija * 2, 0);
    addItem('SOCRAL-15', (hoja - fija) * 2, 0);
    addItem(coloal === 'M' ? 'SOPSAL15M' : 'SOPSAL15B', hoja - fija, 0);
    if (car === 'S') addItem(coloal === 'M' ? 'SOPSCARAM' : 'SOPSCARAC', hoja - fija, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 2 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem('SOGUAL-15', (hoja - fija) * 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  VENTANAS CORREDERAS - AL-20
  // ─────────────────────────────────────────
  function l7000() {
    const { ancho, alto, hoja, fija, pal, car, coloal, vidi, cam } = state;
    addItem(cam === 'S' ? 'AL202029' : 'AL202012', 0, ancho); // 2012
    addItem('AL202013', 0, ancho);
    addItem('AL202027', alto * 2, 0);
    addItem('AL202021', 0, ancho);
    addItem('AL202016', 0, ancho);
    const altHoja  = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 4 : alto * hoja);
    const altHoja2 = hoja === 2 ? alto * hoja : (hoja === 3 && fija === 1 ? alto * 2 : alto * hoja);
    addItem('AL202026', altHoja, 0);
    addItem('AL202028', altHoja2, 0);
    if (pal === 'S') addItem('AL202022', 0, ancho);
    addItem(state.espesor < 4 ? 'SOBU1003' : 'SOBU302', (alto * 2 * hoja) + (ancho * 2), 0);
    addItem('SOVAFEL5', (alto * 6) + (ancho * 4), 0);
    addItem(coloal === 'M' ? 'SOTB83/4MB' : 'SOTB83/4BB', hoja * 4, 0);
    addItem(coloal === 'M' ? 'SOTB81/2MB' : 'SOTB81/2BB', fija > 0 ? 8 + fija * 2 : 8, 0);
    addItem(coloal === 'M' ? 'SOTB61/4MB' : 'SOTB61/4BB', (hoja - fija) * 4 + fija * 2, 0);
    addItem('SOCRAL-15', (hoja - fija) * 2, 0);
    const pestCod = coloal === 'C' ? 'SOOPDOB-B' : ('SOOPDOB-' + coloal);
    let pestCant = hoja - fija;
    if (hoja === 4 && fija < 2) pestCant -= 1;
    addItem(pestCod, pestCant, 0);
    if (car === 'S') addItem(coloal === 'M' ? 'SOPSCARAM' : 'SOPSCARAC', hoja - fija, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 2 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem('SOGUAL-15', (hoja - fija) * 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  VENTANAS CORREDERAS - AL-25
  // ─────────────────────────────────────────
  function l8000() {
    const { ancho, alto, hoja, fija, pal, car, coloal, vidi, ter, ref, pab } = state;
    addItem('AL252521', 0, ancho);
    addItem('AL252524', 0, ancho);
    addItem('AL252522', alto * 2, 0);
    addItem('AL252507', 0, ancho);
    addItem('AL252506', 0, ancho);
    if (pal === 'S') addItem('AL252516', 0, ancho);
    let altHoja, altHoja2;
    if (hoja === 2) { altHoja = alto * hoja; altHoja2 = alto * hoja; }
    else if ((hoja === 3 && fija === 1) || (hoja === 3 && fija === 2)) { altHoja = alto * 4; altHoja2 = alto * 2; }
    else if (hoja === 4) { altHoja = alto * 4; altHoja2 = alto * 4; }
    else { altHoja = alto * hoja; altHoja2 = alto * hoja; }
    addItem(ter === 'S' ? 'AL252508' : (ref === 'S' ? 'AL252508' : 'AL252504'), altHoja, 0);
    addItem(ter === 'S' ? 'AL252518' : (ref === 'S' ? 'AL252518' : 'AL252523'), altHoja2, 0);
    if (hoja === 4) addItem('AL252512', alto, 0); // cuarta hoja
    addItem('SOBU305', (alto * 2 * hoja) + (ancho * 2), 0);
    addItem('SOVAFEL7', (alto * 6) + (ancho * 4), 0);
    addItem(coloal === 'M' ? 'SOTB8X1-MB' : 'SOTB8X1-BB', hoja * 4, 0);
    addItem(coloal === 'M' ? 'SOTB81/2MB' : 'SOTB81/2BB', fija > 0 ? 8 + fija * 2 : 8, 0);
    addItem(coloal === 'M' ? 'SOTB61/2MB' : 'SOTB61/2BB', fija * 2, 0);
    addItem(pab === 'S' ? 'SOCRPABOSE' : 'SOCRAL-25', (hoja - fija) * 2, 0);
    const pestCod2 = coloal === 'C' ? 'SOOPDOB-B' : ('SOOPDOB-' + coloal);
    addItem(pestCod2, hoja - fija, 0);
    if (car === 'S') addItem(coloal === 'M' ? 'SOPSCARAM' : 'SOPSCARAC', hoja - fija, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 2 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem('SOGUAL-25', (hoja - fija) * 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PAÑO FIJO AL-32
  // ─────────────────────────────────────────
  function al32() {
    const { ancho, alto, pala, pave, coloal, vidi, cam } = state;
    if (cam === 'N') {
      addItem('AL323201', alto * 2, ancho * 2);
    } else {
      addItem('AL323201', alto * 2, ancho);
    }
    addItem('AL323203', (alto * 2) + (pave * alto * 2), (ancho * 2) + (pala * ancho * 2));
    if (pala > 0) addItem('AL323205', 0, ancho);
    if (pave > 0) addItem('AL323204', alto * pave, ancho * pala);
    addItem('SOBUB-132', (alto * 2) + (pave * alto), (ancho * 2) + (pala * ancho));
    addItem('SOBUDC-132', (alto * 4) + (pave * alto * 2), (ancho * 4) + (pala * ancho * 2));
    addItem('SOESCAL-42', 8 + pave * 4, 0);
    addItem('SOESEAL-32', 4 + pave * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'SOMA625DM' : 'SOMA625DB', 1, 0);
    addItem(pala === 1 ? 'SOEXNB30B' : (coloal === 'M' ? 'SOBSAL32M' : 'SOBSAL32B'), pala || 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 2 + ancho * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PAÑO FIJO AL-42
  // ─────────────────────────────────────────
  function al42() {
    const { ancho, alto, pala, pave, coloal, vidi, cam, jun } = state;
    if (cam === 'S') addItem('AL424214', 0, ancho);
    if (cam === 'N') addItem('AL424201', (alto * 2) + (alto * pave), ancho * 2);
    else addItem('AL424201', (alto * 2) + (alto * pave), ancho);
    addItem('AL424202', (alto * 2) + (alto * pave), ancho * 2);
    addItem(jun || 'ALCO5051', (alto * 2) + (alto * pave), ancho * 2);
    addItem('SOBUB-AL42', (alto * 2) + (alto * pave), (ancho * 2));
    addItem('SOBUC-600', (alto * 2) + (alto * pave), (ancho * 2));
    addItem('SOBUDC142', (alto * 4) + (alto * pave * 2), (ancho * 4));
    addItem('SOESCAL-42', 8 + pave * 4, 0);
    addItem('SOESEAL-32', 4 + pave * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'SOMA635DM' : 'SOMA635DB', 1, 0);
    let bisQty = pala || 2;
    if (alto > 1 && pala !== 1) bisQty = 3;
    addItem(pala === 1 ? 'SOEXDA35B1' : (coloal === 'M' ? 'SOBSAL32M' : 'SOBSAL32B'), bisQty, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 2 + ancho * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  SHOWER DOORS AM-12
  // ─────────────────────────────────────────
  function am12() {
    const { ancho, alto, fondo, coloal, vidi } = state;
    const hasFondo = fondo > 0;
    addItem('AL121202', alto * 2, 0);        // Jamba
    addItem('AL121203', 0, ancho);           // Riel superior
    addItem('AL121204', hasFondo ? alto * 8 : alto * 4, hasFondo ? ancho * 2 : ancho * 2); // Hoja
    addItem('AL121207', 0, ancho);           // Travesaño
    if (alto > 1) addItem('ALTA5000', alto, 0); // Tubo intermedio
    if (hasFondo) addItem('AL121512', 0, ancho); // Intermedio
    addItem('SOCRAM-12', hasFondo ? 8 : 4, 0);
    addItem('SOGU12INTE', hasFondo ? 4 : 2, 0);
    addItem('SOGU12EXTE', hasFondo ? 4 : 2, 0);
    addItem('SOVATOPEGO', hasFondo ? 16 : 6, 0);
    addItem(coloal === 'M' ? 'SOTB61/2MB' : 'SOTB61/2BB', hasFondo ? 8 : 2, 0);
    addItem('SOESEAM-12', hasFondo ? 16 : 8, 0);
    addItem('SOESCAM-12', hasFondo ? 32 : 16, 0);
    addItem(coloal === 'M' ? 'SOTB63/8MB' : 'SOTB63/8BB', hasFondo ? 36 : 10, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem('SOBU302', hasFondo ? (alto * 8) + (ancho * 4) : (alto * 4) + (ancho * 2), 0);
    addItem('SOTIAM-12', hasFondo ? 4 : 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4) / 10, 0);
    if (vidi !== 'SV') {
      const total = (ancho + fondo) / 2;
      const paneles = (total <= 0.84 && alto <= 1.75) ? 2 : 3;
      addItem(vidi, paneles, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PUERTA ABATIR AM-35
  // ─────────────────────────────────────────
  function am35a() {
    const { ancho, alto, pala, pave, coloal, vidi, bisa, hoja } = state;
    // Marco principal AM-35
    addItem('AL353501', (alto * 2) + (alto * pave), (ancho * 2) + (ancho * pala));
    addItem('AL353510', ((alto * 2) * 2) + (alto * 2) + (pave * alto * 2), ((ancho * 2) * 2) + (ancho * pala * 4) + ancho);
    addItem('AL353502', alto * 2, ancho);   // Marco puerta
    addItem('AL353506', alto + (alto * pave), 0); // Tapa
    if (pave > 0) addItem('AL353509', alto, 0); // Post. intermedio
    addItem(coloal === 'M' ? 'SOBSAM35M' : 'SOBSAM35B', bisa || 3, 0); // Bisagras
    if (pave > 0) addItem(coloal === 'M' ? 'SOBSAM35M' : 'SOBSAM35B', bisa || 3, 0);
    addItem(coloal === 'M' ? 'SOCE1080MM' : 'SOCE1080BM', 1, 0); // Chapa
    addItem('SOESEAM-35', (pala * 2) + (pave * 4) + 4, 0);
    addItem('SOTB8X1-MB', (4 + pala * 2 + pave * 4) * 2, 0);
    addItem('SORM4X10MM', (4 + pala * 2 + pave * 4) * 2, 0);
    addItem('SOBUB-AL42', (alto * 2 + ancho * 2) + (alto * 2 * pave), 0);
    addItem('SOBUC-600', (alto * 2 + ancho * 2) + (alto * 2 * pave), 0);
    addItem('SOVAFEL5', (alto * 2) + (alto * 2 * pave), ancho);
    const tarugos = Math.round((alto * 2 + ancho * 2 + pave * alto * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 6 + ancho * 4 + pala * ancho * 2 + pave * alto * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PUERTA VAIVÉN AM-35
  // ─────────────────────────────────────────
  function am35v() {
    const { ancho, alto, pala, pave, coloal, vidi, bisa, hoja } = state;
    addItem('AL353501', (alto * 2) + (alto * pave), (ancho * 2) + (ancho * pala));
    addItem('AL353510', ((alto * 2) * 2) + (alto * 2) + (pave * alto * 2), ((ancho * 2) * 2) + (ancho * pala * 4) + ancho);
    addItem('ALTR8016', alto * 2, ancho);   // Marco vaivén 4080
    addItem('AL353507', pave > 0 ? 6.05 * 2 : 6.05, 0); // Tapa porta felpa
    addItem('AL455031', 6.05, 0);           // Talonera
    addItem(state.quicio === 'ME' ? 'SOVAQUI/ME' : 'SOVAQUI/HD', pave > 0 ? 2 : 1, 0); // Quicio
    addItem(coloal === 'M' ? 'SOTIAM35M' : 'SOTIAM35B', pave > 0 ? 4 : 2, 0); // Tiradores
    addItem(coloal === 'M' ? 'SOCE1080MC' : 'SOCE1080BC', pave > 0 ? 2 : 1, 0); // Chapa
    addItem('SOESEAM-35', (pala * 2) + (pave * 4) + 4, 0);
    addItem('SOTB8X1-MB', (4 + pala * 2 + pave * 4) * 2, 0);
    addItem('SORM4X10MM', (4 + pala * 2 + pave * 4) * 2, 0);
    addItem('SOBUB-AL42', (alto * 2 + ancho * 2) + (alto * 2 * pave), 0);
    addItem('SOBUC-600', (alto * 2 + ancho * 2) + (alto * 2 * pave), 0);
    addItem('SOVAFEL5', (alto * 2) + (alto * 2 * pave), ancho);
    const tarugos = Math.round((alto * 2 + ancho * 2 + pave * alto * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 6 + ancho * 4 + pala * ancho * 2 + pave * alto * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PUERTA ABATIR TUBOS 4040/4080
  // ─────────────────────────────────────────
  function puertab() {
    const { ancho, alto, pala, pave, coloal, vidi, bisa, jun } = state;
    const cod = state.lin === ' (4040/4080)' ? 'ALTC8003' : 'ALTR8016';
    addItem(cod, (alto * 2) + (alto * pave), ancho); // Marco
    addItem('ALTR8016', 0, ancho + (ancho * pala));  // 4080
    addItem(jun || 'ALCO5051', ((alto * 2) * 2) + (alto * 2) + (pave * alto * 2), ((ancho * 2) * 2) + (ancho * pala * 4) + ancho); // Junquillo
    addItem('ALTR8024', alto * 2, ancho);             // Marco puerta
    addItem(coloal === 'M' ? 'SOBSP-45M' : 'SOBSP-45B', bisa || 3, 0);
    addItem(coloal === 'M' ? 'SOCE1080MM' : 'SOCE1080BM', 1, 0);
    addItem('SOES5050M', 12 + (pala * 4) + (pave * 4), 0);
    addItem('SOTB8X1-MB', (12 + pala * 4 + pave * 4) * 2, 0);
    addItem('SORM4X10MM', (12 + pala * 4 + pave * 4) * 2, 0);
    addItem('SOTBESPECI', Math.round(((alto * 3 * 2) + (ancho * 3 * 2) + (ancho * pala * 4) + (pave * alto * 2)) * 3 / 2) * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2 + pave * alto * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 6 + ancho * 4 + pala * ancho * 2 + pave * alto * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  PUERTA VAIVÉN TUBULAR 4080
  // ─────────────────────────────────────────
  function puertav() {
    const { ancho, alto, pala, pave, coloal, vidi, hoja } = state;
    addItem('ALTR8016', (alto * 2) + (alto * pave), ancho); // Marco 4080
    addItem(state.quicio === 'ME' ? 'SOVAQUI/ME' : 'SOVAQUI/HD', pave > 0 ? 2 : 1, 0);
    addItem(coloal === 'M' ? 'SOCE1080MC' : 'SOCE1080BC', pave > 0 ? 2 : 1, 0);
    addItem('SOES5050M', 12 + (pala * 4) + (pave * 4), 0);
    addItem('SOTB8X1-MB', (12 + pala * 4 + pave * 4) * 2, 0);
    addItem('SORM4X10MM', (12 + pala * 4 + pave * 4) * 2, 0);
    addItem('SOTBESPECI', Math.round(((alto * 3 * 2) + (ancho * 3 * 2) + (ancho * pala * 4) + (pave * alto * 2)) * 3 / 2) * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2 + pave * alto * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem('SOVAFEL5', alto * 2 + pave * 2, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 6 + ancho * 4 + pala * ancho * 2 + pave * alto * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  MARCO PUERTA 5034 / 7095
  // ─────────────────────────────────────────
  function marcopta() {
    const { ancho, alto, coloal, lin } = state;
    const cod = lin.includes('5034') ? 'AL455034' : 'AL457095';
    addItem(cod, alto * 2, ancho);
    addItem('SOES5050M', 4, 0);
    addItem('SOTB8X1-MB', 8, 0);
    addItem('SORM4X10MM', 8, 0);
    const tarugos = Math.round((alto * 2 + ancho) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'SOBSP-45M' : 'SOBSP-45B', 3, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 2) / 10, 0);
  }

  // ─────────────────────────────────────────
  //  MARCO PUERTA TUBOS (3060/2575/2066)
  // ─────────────────────────────────────────
  function marcotub() {
    const { ancho, alto, coloal, lin, jun } = state;
    let cod;
    if (lin.includes('3060')) cod = 'ALTR8024';
    else if (lin.includes('2575') || lin.includes('2576')) cod = 'ALTR8006';
    else cod = 'ALTR8014';
    addItem(cod, alto * 2, ancho);
    addItem(jun || 'ALCO5051', alto * 2, ancho);
    addItem('SOES5050M', 4, 0);
    addItem('SOTB8X1-MB', 8, 0);
    addItem('SORM4X10MM', 8, 0);
    addItem('SOTBESPECI', Math.round(((alto * 2 * 2) + (ancho * 2)) * 3 / 2) * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'SOBSP-45M' : 'SOBSP-45B', 3, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 2) / 10, 0);
  }

  // ─────────────────────────────────────────
  //  PAÑO FIJO TUBOS (fijos) con junquillo
  // ─────────────────────────────────────────
  function fijos() {
    const { ancho, alto, pala, pave, coloal, vidi, jun } = state;
    const cod = state.cod || 'ALTC8003';
    addItem(cod, alto * 2, ancho * 2);         // Marco tubo
    if (pala + pave > 0) {
      addItem(cod, alto * pave, ancho * pala); // Palillos
    }
    addItem(jun || 'ALCO5051', ((alto * 2) * 2) + (alto * pave * 4), ((ancho * 2) * 2) + (ancho * pala * 4)); // Junquillo
    addItem('SOES5050M', 8 + (pave * 4) + (pala * 4) + (pave * pala * 4), 0);
    addItem('SOTB8X1-MB', (8 + pave * 4 + pala * 4 + pave * pala * 4) * 2, 0);
    addItem('SORM4X10MM', (8 + pave * 4 + pala * 4 + pave * pala * 4) * 2, 0);
    addItem('SOTBESPECI', Math.round(((alto * 2 * 2 + alto * pave * 4) + (ancho * 2 * 2 + ancho * pala * 4)) * 3 / 2) * 2, 0);
    const tarugos = Math.round((alto * 2 + ancho * 2) * 3 / 2) * 2;
    addItem('SOVATARUS6', tarugos, 0);
    addItem(coloal === 'M' ? 'SOTB1112MB' : 'SOTB1112BB', tarugos, 0);
    addItem(coloal === 'M' ? 'ALSILICOM' : 'ALSILICOB', (alto * 4 + ancho * 4 + pave * alto * 2 + pala * ancho * 2) / 10, 0);
    if (vidi !== 'SV') {
      const aR = roundUp1(alto), anR = roundUp1(ancho);
      addItem(vidi, aR * anR, 0, { medida: 'A' });
    }
  }

  // ─────────────────────────────────────────
  //  DISPATCHER PRINCIPAL
  // ─────────────────────────────────────────
  function calcular(cfg, preciosData) {
    init(cfg, preciosData);
    const lin = state.lin;

    if (lin === 'L5000' || lin === 'L7000_old') l5000();
    else if (lin === 'AL15') l6000();
    else if (lin === 'AL20') l7000();
    else if (lin === 'AL25') l8000();
    else if (lin === 'AL32_PANO') al32();
    else if (lin === 'AL42_PANO') al42();
    else if (lin === 'AL32_ABATIR') al32();
    else if (lin === 'AL42_ABATIR') al42();
    else if (lin === 'AM12') am12();
    else if (lin === 'AM35_ABATIR') am35a();
    else if (lin === 'AM35_VAIVEN') am35v();
    else if (lin === 'PUERTA_ABATIR_TUBOS') puertab();
    else if (lin === 'PUERTA_VAIVEN_TUBULAR') puertav();
    else if (lin === 'MARCO_5034' || lin === 'MARCO_7095') marcopta();
    else if (lin === 'MARCO_3060' || lin === 'MARCO_2575' || lin === 'MARCO_2066') marcotub();
    else if (lin === 'FIJO_TUBOS') fijos();

    return getResultado();
  }

  function getResultado() {
    const cant = state.cant;
    const porce = state.porce / 100;
    const iva = state.iva / 100;

    let totalAluminio = 0;
    let totalAcc = 0;
    let totalCristal = 0;
    let kilos = 0;
    let metros = 0;

    resultItems.forEach(item => {
      if (item.tipo === 'aluminio' && item.medida === 'P') {
        totalAluminio += item.total;
        kilos += item.cantTotal * (item.peso || 0);
      } else if (item.tipo === 'vidrio' || item.medida === 'A') {
        totalCristal += item.total;
        metros += item.cantTotal;
      } else {
        totalAcc += item.total;
      }
    });

    // Si la línea tiene valor m² configurado, el neto se cobra por superficie
    const m2Producto = state.ancho * state.alto * cant;
    const porM2 = state.valorM2 > 0;
    const totalNeto = porM2
      ? m2Producto * state.valorM2
      : totalAluminio + totalAcc + totalCristal;
    const totalIva = totalNeto * iva;
    const totalConIva = totalNeto + totalIva;

    return {
      items: [...resultItems],
      totales: {
        aluminio: totalAluminio,
        accesorios: totalAcc,
        cristal: totalCristal,
        neto: totalNeto,
        iva: totalIva,
        conIva: totalConIva,
        kilos: kilos,
        metros: metros,
        porM2: porM2,
        valorM2: state.valorM2,
        m2Producto: m2Producto,
      },
      cfg: { ...state },
    };
  }

  return { calcular };
})();
