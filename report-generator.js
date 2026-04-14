import { PARAMETROS, SECCIONES } from './constants.js';
import { evaluarRango } from './math-engine.js';
import { escapeHTML, getEl } from './utils.js';

export function generateReport(AppState, data) {
    const results = AppState.calculatedResults;
    if (!results || Object.keys(results).length === 0) return;

    function isValid(value) { return value != null && !isNaN(value) && value !== 0; }
    function fmt(value, decimals = 2) { return !isValid(value) ? null : parseFloat(value).toFixed(decimals); }
    function fmtParam(key, value, decimals = 2) {
        if (!isValid(value)) return null;
        const p = PARAMETROS[key];
        let valText = key === 'densidad' ? fmt(value, 0) : fmt(value, decimals);
        const ev = (key !== 'superficiecorporal' && key !== 'imc') ? evaluarRango(key, value, AppState.edadEnAños, AppState.edadEnMeses) : { enRango: true };
        if (!ev.enRango) valText = '*' + valText;
        return `${p?.label ?? key}: ${valText}${p?.unit ?? ''}`;
    }

    let report = [];

    // ── DATOS DEL PACIENTE Y GENERALES ───────────────────────────
    const get = id => (data[id] && data[id] !== '') ? data[id] : '—';
    const sexoStr = data.sexo === 'M' ? 'Masculino' : (data.sexo === 'F' ? 'Femenino' : '—');

    report.push("DATOS DEL PACIENTE");
    report.push(`F. Nacimiento: ${get('fecha_nacimiento')} | F. Analítica: ${get('fecha_analitica')} | Edad: ${AppState.edadEnAños || 0} años ${AppState.edadEnMeses || 0} meses`);
    report.push(`Sexo: ${sexoStr} | Peso: ${get('peso_kg')} kg | Talla: ${get('talla_cm')} cm\n`);

    let datosGenerales = [];
    if (isValid(results.superficiecorporal)) datosGenerales.push(`Superficie Corporal: ${fmt(results.superficiecorporal)}m²`);
    if (isValid(results.imc)) datosGenerales.push(`IMC: ${fmt(results.imc)}kg/m²`);
    if (datosGenerales.length > 0) {
        report.push("DATOS GENERALES");
        report.push('· ' + datosGenerales.join(' | ') + '\n');
    }

    // ── HIDROSALINO ──────────────────────────────────────────────
    let hidrosalino = [];
    if (isValid(data.urea_mg_dl)) hidrosalino.push(`Urea: ${fmt(data.urea_mg_dl)}mg/dL`);

    if (isValid(data.creatinina_enz_mg_dl)) {
        let cr = `Cr: ${fmt(data.creatinina_enz_mg_dl)}mg/dL`;
        [
            fmtParam('schwartz_neo',     results.schwartz_neo),
            fmtParam('schwartz_lact',    results.schwartz_lact),
            fmtParam('schwartz_bedside', results.schwartz_bedside),
            fmtParam('ckid_u25_cr',       results.ckid_u25_cr),
            fmtParam('ekfc_cr',          results.ekfc_cr),
        ].filter(Boolean).forEach(l => cr += ` (${l})`);
        hidrosalino.push(cr);
    }

    if (isValid(data.cistatina_c_mg_l)) {
        let cist = `Cistatina C: ${fmt(data.cistatina_c_mg_l)}mg/L`;
        [
            fmtParam('bokenkamp',    results.bokenkamp),
            fmtParam('ckid_u25_cistc', results.ckid_u25_cistc),
            fmtParam('ekfc_cistc',    results.ekfc_cistc),
        ].filter(Boolean).forEach(l => cist += ` (${l})`);
        hidrosalino.push(cist);
    }

    const combinadoLine = fmtParam('ckid_u25_combinado', results.ckid_u25_combinado);
    if (combinadoLine) hidrosalino.push(`(${combinadoLine})`);

    const vpLine = fmtParam('vpercent', results.vpercent);
    if (vpLine) hidrosalino.push(vpLine);

    if (isValid(data.na_plasma_meq_l)) hidrosalino.push(`Na: ${fmt(data.na_plasma_meq_l)}mEq/L`);
    const efnaLine = fmtParam('efna', results.efna);
    if (efnaLine) hidrosalino.push(efnaLine);

    if (isValid(data.k_plasma_meq_l)) hidrosalino.push(`K: ${fmt(data.k_plasma_meq_l)}mEq/L`);
    const efkLine = fmtParam('efk', results.efk);
    if (efkLine) hidrosalino.push(efkLine);

    if (isValid(data.cl_plasma_meq_l)) hidrosalino.push(`Cl: ${fmt(data.cl_plasma_meq_l)}mEq/L`);
    const efclLine = fmtParam('efcl', results.efcl);
    if (efclLine) hidrosalino.push(efclLine);

    if (isValid(data.au_plasma_mg_dl)) hidrosalino.push(`AU: ${fmt(data.au_plasma_mg_dl)}mg/dL`);
    const efauLine = fmtParam('efau', results.efau);
    if (efauLine) hidrosalino.push(efauLine);

    // ── FOSFOCÁLCICO ─────────────────────────────────────────────
    let fosfocalcico = [];
    if (isValid(data.ca_plasma_mg_dl)) fosfocalcico.push(`Ca: ${fmt(data.ca_plasma_mg_dl)}mg/dL`);
    const cacrLine = fmtParam('cacr', results.cacr);
    if (cacrLine) fosfocalcico.push(cacrLine);

    if (isValid(data.p_plasma_mg_dl)) fosfocalcico.push(`P: ${fmt(data.p_plasma_mg_dl)}mg/dL`);
    const rtpLine = fmtParam('rtp', results.rtp);
    if (rtpLine) fosfocalcico.push(rtpLine);

    if (isValid(data.mg_plasma_mg_dl)) fosfocalcico.push(`Mg: ${fmt(data.mg_plasma_mg_dl)}mg/dL`);
    const mgcrLine = fmtParam('mgcr', results.mgcr);
    if (mgcrLine) fosfocalcico.push(mgcrLine);

    const pcrLine = fmtParam('pcr', results.pcr);
    if (pcrLine) fosfocalcico.push(pcrLine);

    if (isValid(data.pth_pg_ml))             fosfocalcico.push(`PTH: ${fmt(data.pth_pg_ml)}pg/mL`);
    if (isValid(data.vitamina_d_ng_ml))      fosfocalcico.push(`Vitamina D: ${fmt(data.vitamina_d_ng_ml)}ng/mL`);
    if (isValid(data.fosfatasa_alcalina_u_l)) fosfocalcico.push(`Fosfatasa alcalina: ${fmt(data.fosfatasa_alcalina_u_l)}U/L`);

    // ── HEMATOLÓGICO ─────────────────────────────────────────────
    let hematologico = [];
    if (isValid(data.hb_g_l))          hematologico.push(`Hemoglobina: ${fmt(data.hb_g_l)}g/L`);
    if (isValid(data.ferritina_ng_ml)) hematologico.push(`Ferritina: ${fmt(data.ferritina_ng_ml)}ng/mL`);
    if (isValid(data.ist_percent))     hematologico.push(`IST: ${fmt(data.ist_percent)}%`);
    const serieBlanca      = escapeHTML(data.serie_blanca || '');
    const seriePlaquetaria = escapeHTML(data.serie_plaquetaria || '');
    const coagulacion      = escapeHTML(data.coagulacion || '');
    if (serieBlanca)      hematologico.push(`Serie blanca: ${serieBlanca}`);
    if (seriePlaquetaria) hematologico.push(`Serie plaquetaria: ${seriePlaquetaria}`);
    if (coagulacion)      hematologico.push(`Coagulación: ${coagulacion}`);

    // ── GASOMETRÍA ───────────────────────────────────────────────
    let gasometria = [];
    if (isValid(data.ph_plasma))             gasometria.push(`pH: ${fmt(data.ph_plasma)}`);
    if (isValid(data.pco2_mmhg))             gasometria.push(`pCO2: ${fmt(data.pco2_mmhg)}mmHg`);
    if (isValid(data.hco3_mmol_l))           gasometria.push(`HCO3: ${fmt(data.hco3_mmol_l)}mmol/L`);
    if (isValid(data.exceso_bases_mmol_l))   gasometria.push(`Exceso de bases: ${fmt(data.exceso_bases_mmol_l)}mmol/L`);

    // ── ORINA PUNTUAL ────────────────────────────────────────────
    let orina = [];
    const sedimentoUrinario    = escapeHTML(data.sedimento_urinario || '');
    const comentarioNutricional = escapeHTML(data.comentario_nutricional || '');
    if (isValid(data.densidad))  orina.push(`Densidad: ${fmt(data.densidad, 0)}`);
    if (isValid(data.ph_orina))  orina.push(`pH: ${fmt(data.ph_orina)}`);

    if (sedimentoUrinario) orina.push(`Sedimento: ${sedimentoUrinario}`);

    ['protcr', 'proteinuriaestimada', 'albcr'].forEach(key => {
        const line = fmtParam(key, results[key]);
        if (line) orina.push(line);
    });

    if (isValid(data.osmolalidad_orina_mosm_kg)) orina.push(`Osmolalidad urinaria: ${fmt(data.osmolalidad_orina_mosm_kg)}mOsm/kg`);

    ['aucr', 'nak', 'cacr', 'citratocr', 'cacitrato', 'oxalatocr'].forEach(key => {
        const line = fmtParam(key, results[key]);
        if (line) orina.push(line);
    });

    // ── ORINA 24H ────────────────────────────────────────────────
    let orina24h = [];
    ['uricosuria', 'calciuria', 'citraturia', 'fosfaturia', 'oxaluria', 'magnesuria', 'proteinuria', 'albuminuria'].forEach(key => {
        const line = fmtParam(key, results[key]);
        if (line) orina24h.push(line);
    });

    // ── RESTO DE LA FUNCIÓN (sin cambios) ────────────────────────
    let hayDatosAnalitica = (hidrosalino.length + fosfocalcico.length + hematologico.length + gasometria.length + orina.length + orina24h.length + (comentarioNutricional ? 1 : 0)) > 0;

    if (hayDatosAnalitica) {
        report.push("ANALÍTICA");
        if (hidrosalino.length > 0)  report.push(`· Hidrosalino: ${hidrosalino.join(' | ')}`);
        if (fosfocalcico.length > 0) report.push(`· Metabolismo fosfocálcico: ${fosfocalcico.join(' | ')}`);
        if (hematologico.length > 0) report.push(`· Hematológico: ${hematologico.join(' | ')}`);
        if (gasometria.length > 0)   report.push(`· Gasometría: ${gasometria.join(' | ')}`);
        if (orina.length > 0)        report.push(`· Orina puntual: ${orina.join(' | ')}`);
        if (orina24h.length > 0)     report.push(`· Orina de 24h: ${orina24h.join(' | ')}`);
        if (comentarioNutricional)   report.push(`· Otros: ${comentarioNutricional}`);
    }
    if (AppState.ecografiaReportText) {
        report.push(`\nECOGRAFÍA RENAL`);
        report.push('· ' + AppState.ecografiaReportText.replace(/^-/, '').trim());
    }

    function evaluarGradoG(egfr) {
        if (!isValid(egfr)) return null;
        if (egfr >= 90) return "Estadio G1 (Normal o elevado)";
        if (egfr >= 60) return "Estadio G2 (Levemente disminuido)";
        if (egfr >= 45) return "Estadio G3a (Leve o moderadamente disminuido)";
        if (egfr >= 30) return "Estadio G3b (Moderado o muy disminuido)";
        if (egfr >= 15) return "Estadio G4 (Muy disminuido)";
        return "Estadio G5 (Fallo renal)";
    }

    function evaluarERC_Lactante(egfr, meses) {
        if (!isValid(egfr)) return null;
        const limites = {
            1: [35,24,12,5], 2: [40,27,13,6], 3: [45,30,15,7], 4: [50,33,17,8],
            5: [55,37,18,9], 6: [60,40,20,10], 7: [63,42,21,10], 8: [65,44,22,11],
            9: [68,45,23,11], 10: [70,47,24,11], 11: [73,49,24,12], 12: [75,50,25,12],
            13: [76,51,25,12], 14: [77,52,26,13], 15: [78,53,26,13], 16: [79,54,27,13],
            17: [81,54,27,14], 18: [82,55,28,14], 19: [83,56,28,14], 20: [84,57,29,14],
            21: [85,58,29,14], 22: [87,59,29,15], 23: [88,59,30,15], 24: [90,60,30,15]
        };
        const m = meses <= 0 ? 1 : (meses > 24 ? 24 : Math.floor(meses));
        const [g1, g2, g3, g4] = limites[m];
        if (egfr >= g1) return "ERC 1 (Normal o elevado)";
        if (egfr >= g2) return "ERC 2 (Levemente disminuido)";
        if (egfr >= g3) return "ERC 3 (Moderadamente disminuido)";
        if (egfr >= g4) return "ERC 4 (Muy disminuido)";
        return "ERC 5 (Fallo renal)";
    }

    function evaluarGradoA(albcr) {
        if (albcr === null || isNaN(albcr) || albcr === undefined) return null;
        if (albcr < 30) return "Estadio A1 (Normal o levemente elevada)";
        if (albcr <= 300) return "Estadio A2 (Moderadamente elevada)";
        return "Estadio A3 (Muy elevada)";
    }

    const mesesTotales = AppState.edadTotalMeses || 0;
    let htmlEstadificacion = "";
    AppState.estadificacionKDIGO = null;

    if (AppState.edadEnAños >= 2) {
        let grados_kdigo = [];
        if (isValid(results.schwartz_bedside))   grados_kdigo.push(`- eGFR Schwartz Bedside: ${evaluarGradoG(results.schwartz_bedside)}`);
        if (isValid(results.ckid_u25_cr))        grados_kdigo.push(`- eGFR CKiD U25 Cr: ${evaluarGradoG(results.ckid_u25_cr)}`);
        if (isValid(results.ekfc_cr))            grados_kdigo.push(`- eGFR EKFC Cr: ${evaluarGradoG(results.ekfc_cr)}`);
        if (isValid(results.ckid_u25_cistc))     grados_kdigo.push(`- eGFR CKiD U25 CistC: ${evaluarGradoG(results.ckid_u25_cistc)}`);
        if (isValid(results.ekfc_cistc))         grados_kdigo.push(`- eGFR EKFCCystC: ${evaluarGradoG(results.ekfc_cistc)}`);
        if (isValid(results.ckid_u25_combinado)) grados_kdigo.push(`- eGFR Combinado (CKiD U25): ${evaluarGradoG(results.ckid_u25_combinado)}`);
        let gradoAlb = (results.albcr !== undefined && results.albcr > 0) ? evaluarGradoA(results.albcr) : null;
        if (gradoAlb) grados_kdigo.push(`- Albuminuria: ${gradoAlb}`);

        if (grados_kdigo.length > 0) {
            AppState.estadificacionKDIGO = { titulo: 'Estadificación según guías KDIGO 2024', items: grados_kdigo.map(g => g.replace('- ', '')) };
            report.push('\n\nESTADIFICACIÓN SEGÚN GUÍAS KDIGO 2024\n');
            report = report.concat(grados_kdigo);
            htmlEstadificacion = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">ESTADIFICACIÓN SEGÚN GUÍAS KDIGO 2024</h4><ul style="margin-top: 0; padding-left: 20px;">`;
            grados_kdigo.forEach(g => {
                let parts = g.replace('- ', '').split(':');
                htmlEstadificacion += `<li style="margin-bottom: 4px;"><strong>${parts[0]}:</strong> ${parts.slice(1).join(':').trim()}</li>`;
            });
            htmlEstadificacion += `</ul>`;
        }
    } else {
        let grados_lactante = [];
        if (isValid(results.schwartz_neo))       grados_lactante.push(`- eGFR-Smeets: ${evaluarERC_Lactante(results.schwartz_neo, mesesTotales)}`);
        if (isValid(results.schwartz_lact))      grados_lactante.push(`- eGFR Schwartz lactante: ${evaluarERC_Lactante(results.schwartz_lact, mesesTotales)}`);
        if (isValid(results.schwartz_bedside))   grados_lactante.push(`- eGFR Schwartz Bedside: ${evaluarERC_Lactante(results.schwartz_bedside, mesesTotales)}`);
        if (isValid(results.ckid_u25_cr))        grados_lactante.push(`- eGFR CKiD U25 Cr: ${evaluarERC_Lactante(results.ckid_u25_cr, mesesTotales)}`);
        if (isValid(results.ekfc_cr))            grados_lactante.push(`- eGFR EKFC Cr: ${evaluarERC_Lactante(results.ekfc_cr, mesesTotales)}`);
        if (isValid(results.bokenkamp))          grados_lactante.push(`- eGFR Bökenkamp (CistC): ${evaluarERC_Lactante(results.bokenkamp, mesesTotales)}`);
        if (isValid(results.ckid_u25_cistc))     grados_lactante.push(`- eGFR CKiD U25 CistC: ${evaluarERC_Lactante(results.ckid_u25_cistc, mesesTotales)}`);
        if (isValid(results.ekfc_cistc))         grados_lactante.push(`- eGFR EKFCCystC: ${evaluarERC_Lactante(results.ekfc_cistc, mesesTotales)}`);
        if (isValid(results.ckid_u25_combinado)) grados_lactante.push(`- eGFR Combinado (CKiD U25): ${evaluarERC_Lactante(results.ckid_u25_combinado, mesesTotales)}`);

        if (grados_lactante.length > 0) {
            AppState.estadificacionKDIGO = { titulo: 'Estadificación ERC (Ajustada a < 2 años)', items: grados_lactante.map(g => g.replace('- ', '')) };
            report.push('\n\nESTADIFICACIÓN ERC (AJUSTADA A EDAD < 2 AÑOS)\n');
            report = report.concat(grados_lactante);
            htmlEstadificacion = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">ESTADIFICACIÓN ERC (AJUSTADA A &lt; 2 AÑOS)</h4><ul style="margin-top: 0; padding-left: 20px;">`;
            grados_lactante.forEach(g => {
                let parts = g.replace('- ', '').split(':');
                htmlEstadificacion += `<li style="margin-bottom: 4px;"><strong>${parts[0]}:</strong> ${parts.slice(1).join(':').trim()}</li>`;
            });
            htmlEstadificacion += `</ul>`;
        }
    }

    let htmlFueraRango = "";
    if (AppState.valoresFueraRango && AppState.valoresFueraRango.length > 0) {
        report.push('\n\nRESULTADOS FUERA DE RANGO\n');
        AppState.valoresFueraRango.map(v => `-${v}`).forEach(v => report.push(v));
        htmlFueraRango = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">⚠️ Resultados fuera de rango</h4><ul style="margin-top: 0; padding-left: 20px;">`;
        AppState.valoresFueraRango.forEach(v => {
            let part = v.split(':');
            htmlFueraRango += `<li style="margin-bottom: 4px; color: #dc2626;"><strong>${part[0]}:</strong> ${part.slice(1).join(':')}</li>`;
        });
        htmlFueraRango += `</ul>`;
    }

    AppState.reportPlainText = report.join('\n');

    const boldify = (str) => {
        let split = str.split(': ');
        if (split.length > 1) {
            let label = split[0];
            let prefix = '';
            if (label.startsWith('(')) {
                prefix = '(';
                label = label.substring(1);
            }
            if (label.includes('eGFR')) {
                return `${prefix}<em style="font-weight: normal;">${label}</em>: ${split.slice(1).join(': ')}`;
            }
            let result = `${prefix}<strong>${label}:</strong> ${split.slice(1).join(': ')}`;
            return result.replace(/(eGFR[^:]+)(?=:)/g, '<em style="font-weight: normal;">$1</em>');
        }
        return str.replace(/(eGFR[^:]+)(?=:)/g, '<em style="font-weight: normal;">$1</em>');
    };

    let html = `<div class="report-body">`;

    html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Datos del Paciente</h4>`;
    html += `<ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">`;
    html += `<li style="margin-bottom: 4px;"><strong>F. Nacimiento:</strong> ${get('fecha_nacimiento')} | <strong>F. Analítica:</strong> ${get('fecha_analitica')} | <strong>Edad:</strong> ${AppState.edadEnAños || 0} años ${AppState.edadEnMeses || 0} meses</li>`;
    html += `<li style="margin-bottom: 4px;"><strong>Sexo:</strong> ${sexoStr} | <strong>Peso:</strong> ${get('peso_kg')} kg | <strong>Talla:</strong> ${get('talla_cm')} cm</li>`;
    html += `</ul>`;

    if (datosGenerales.length > 0) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Datos Generales</h4>`;
        html += `<ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">`;
        html += `<li style="margin-bottom: 4px;">${datosGenerales.map(boldify).join(' | ')}</li>`;
        html += `</ul>`;
    }

    if (hayDatosAnalitica) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Analítica</h4>`;
        html += `<ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">`;
        if (hidrosalino.length > 0)  html += `<li style="margin-bottom: 4px;"><strong><u>Hidrosalino:</u></strong> ${hidrosalino.map(boldify).join(' | ')}</li>`;
        if (fosfocalcico.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Metabolismo fosfocálcico:</u></strong> ${fosfocalcico.map(boldify).join(' | ')}</li>`;
        if (hematologico.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Hematológico:</u></strong> ${hematologico.map(escapeHTML).map(boldify).join(' | ')}</li>`;
        if (gasometria.length > 0)   html += `<li style="margin-bottom: 4px;"><strong><u>Gasometría:</u></strong> ${gasometria.map(boldify).join(' | ')}</li>`;
        if (orina.length > 0)        html += `<li style="margin-bottom: 4px;"><strong><u>Orina puntual:</u></strong> ${orina.map(escapeHTML).map(boldify).join(' | ')}</li>`;
        if (orina24h.length > 0)     html += `<li style="margin-bottom: 4px;"><strong><u>Orina de 24h:</u></strong> ${orina24h.map(boldify).join(' | ')}</li>`;
        if (comentarioNutricional)   html += `<li style="margin-bottom: 4px;"><strong><u>Otros:</u></strong> ${escapeHTML(comentarioNutricional)}</li>`;
        html += `</ul>`;
    }
    if (AppState.ecografiaReportText) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 15px;">Ecografía Renal</h4>`;
        html += `<ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">`;
        html += `<li style="margin-bottom: 4px;">${escapeHTML(AppState.ecografiaReportText.replace(/^-/, '').trim()).replace('Longitud renal ecográfica:', '<strong><u>Longitud renal ecográfica:</u></strong>')}</li>`;
        html += `</ul>`;
    }
    html += htmlEstadificacion;
    html += htmlFueraRango;
    html += `</div>`;

    const reportContentDiv = getEl('reportContent');
    reportContentDiv.innerHTML = window.DOMPurify.sanitize(html);
    getEl('reportSection').classList.remove('hidden');
    setTimeout(() => { getEl('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
}

function buildReportHTML(AppState, rawData = {}) {
    const R     = Object.assign({}, rawData, AppState.calculatedResults);
    const edad  = AppState.edadEnAños  || 0;
    const edadM = AppState.edadEnMeses || 0;
    const get   = id => (rawData[id] && rawData[id] !== '') ? rawData[id] : '—';
    const sexoStr = rawData.sexo === 'M' ? 'Masculino' : (rawData.sexo === 'F' ? 'Femenino' : '—');

    let html = '';

    html += `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#0891b2;padding:12px 16px;">
          <span style="color:#fff;font-size:17px;font-weight:bold;font-family:Arial,sans-serif;">NefroPed</span>
          <span style="color:#e0f7fa;font-size:11px;font-family:Arial,sans-serif;margin-left:10px;">Informe de Pruebas Complementarias Pediátricas</span>
        </td>
        <td style="background:#0891b2;padding:12px 16px;text-align:right;white-space:nowrap;">
          <span style="color:#fff;font-size:11px;font-family:Arial,sans-serif;">${new Date().toLocaleDateString('es-ES')}</span>
        </td>
      </tr>
    </table>
    <div style="line-height:14px;font-size:1px;">&nbsp;</div>`;

    html += `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;background:#f8fafc;">
      <tr>
        <td style="padding:10px 14px;">
          <div style="font-size:10px;font-weight:bold;color:#0891b2;font-family:Arial,sans-serif;margin-bottom:5px;letter-spacing:0.5px;">DATOS DEL PACIENTE</div>
          <div style="font-size:12px;color:#1e293b;font-family:Arial,sans-serif;margin-bottom:3px;">
            <b>F. Nacimiento:</b> ${get('fecha_nacimiento')} &nbsp;&nbsp;
            <b>F. Analítica:</b> ${get('fecha_analitica')} &nbsp;&nbsp;
            <b>Edad:</b> ${edad} años ${edadM} meses
          </div>
          <div style="font-size:12px;color:#1e293b;font-family:Arial,sans-serif;">
            <b>Sexo:</b> ${sexoStr} &nbsp;&nbsp;
            <b>Peso:</b> ${get('peso_kg')} kg &nbsp;&nbsp;
            <b>Talla:</b> ${get('talla_cm')} cm
          </div>
        </td>
      </tr>
    </table>
    <div style="line-height:14px;font-size:1px;">&nbsp;</div>`;

    const drawTable = (sec) => {
        if (!sec) return '';
        
        let extraRows = [];
        const tituloLower = sec.titulo.toLowerCase();
        
        if (tituloLower.includes('hematol')) { 
            const serieBlanca = rawData.serie_blanca;
            const seriePlaquetaria = rawData.serie_plaquetaria;
            const coagulacion = rawData.coagulacion;
            if (serieBlanca)      extraRows.push({ label: 'Serie blanca',      value: serieBlanca });
            if (seriePlaquetaria) extraRows.push({ label: 'Serie plaquetaria', value: seriePlaquetaria });
            if (coagulacion)      extraRows.push({ label: 'Coagulación',       value: coagulacion });
        }
        if (tituloLower.includes('orina puntual')) { 
            const sedimento = rawData.sedimento_urinario;
            if (sedimento) extraRows.push({ label: 'Sedimento', value: sedimento });
        }

        const filas = sec.keys.filter(k => R[k] !== undefined && R[k] !== null && R[k] !== 0 && !isNaN(R[k]) && R[k] !== '');
        if (!filas.length && !extraRows.length) return '';

        let t = `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${sec.titulo}</span>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#e2e8f0;">
              <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:40%;">PARÁMETRO</td>
              <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:30%;">VALOR</td>
              <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:30%;">RANGO NORMAL</td>
            </tr>
          </thead>
          <tbody>`;

        let i = 0;
        filas.forEach((key) => {
            const val = R[key];
            const ev  = (key !== 'superficiecorporal' && key !== 'imc')
                        ? evaluarRango(key, val, edad, edadM)
                        : { enRango: true, rangoTexto: '' };

            const p = PARAMETROS[key];
            let valorTexto = key === 'densidad' ? parseFloat(val).toFixed(0) : parseFloat(val).toFixed(2);
            if (!ev.enRango) valorTexto = '*' + valorTexto;
            if (p?.unit) valorTexto += ' ' + p.unit;

            const bg    = i % 2 === 0 ? '#ffffff' : '#f8fafc';
            const color = ev.enRango ? '#0891b2' : '#dc2626';
            const isGFR = (p?.label || '').includes('eGFR');
            const labelHTML = isGFR ? `<i style="font-weight: normal;">${p?.label || key}</i>` : (p?.label || key);

            t += `
          <tr style="background:${bg};">
            <td style="padding:5px 10px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${labelHTML}</td>
            <td style="padding:5px 10px;font-size:12px;font-weight:bold;color:${color};font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${valorTexto}</td>
            <td style="padding:5px 10px;font-size:11px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${(ev.rangoTexto || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>`;
            i++;
        });

        extraRows.forEach(row => {
            const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
            t += `
          <tr style="background:${bg};">
            <td style="padding:5px 10px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${escapeHTML(row.label)}</td>
            <td style="padding:5px 10px;font-size:12px;color:#0891b2;font-weight:bold;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;">${escapeHTML(row.value)}</td>
            <td style="padding:5px 10px;font-size:11px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">—</td>
          </tr>`;
            i++;
        });

        t += `</tbody></table>
        <div style="line-height:12px;font-size:1px;">&nbsp;</div>`;
        return t;
    };

    const drawTextBlock = (titulo, texto) => {
        let textValue = (texto && typeof texto === 'string') ? texto.trim() : '';
        if (!textValue || textValue === '—') return '';
        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${titulo}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-size:12px;color:#0891b2;font-weight:bold;font-family:Arial,sans-serif;line-height:1.6;border:1px solid #e2e8f0;border-top:none;white-space:pre-wrap;">${escapeHTML(textValue)}</td>
          </tr>
        </table>
        <div style="line-height:12px;font-size:1px;">&nbsp;</div>`;
    };

    SECCIONES.forEach(sec => { html += drawTable(sec); });
    html += drawTextBlock('Otros', get('comentario_nutricional'));
    if (AppState.ecografiaReportText) html += drawTextBlock('Ecografía renal', '· ' + AppState.ecografiaReportText.replace(/^-/, '').trim());

    if (AppState.estadificacionKDIGO) {
        const items = AppState.estadificacionKDIGO.items.map(v => {
            const parts = v.split(':');
            return `<li style="margin-bottom:3px;"><strong>${parts[0]}:</strong> ${parts.slice(1).join(':').trim()}</li>`;
        }).join('');
        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background:#f0f9ff;border:2px solid #0891b2;padding:12px 16px;">
              <div style="font-size:12px;font-weight:bold;color:#0891b2;font-family:Arial,sans-serif;margin-bottom:6px;">${AppState.estadificacionKDIGO.titulo.toUpperCase()}</div>
              <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;font-family:Arial,sans-serif;">${items}</ul>
            </td>
          </tr>
        </table>
        <div style="line-height:12px;font-size:1px;">&nbsp;</div>`;
    }

    if (AppState.valoresFueraRango?.length > 0) {
        const items = AppState.valoresFueraRango
            .map(v => {
                const parts = v.split(':');
                const title = parts[0];
                const rest = parts.slice(1).join(':').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<li style="margin-bottom:3px;"><strong>${title}: </strong>${rest}</li>`;
            }).join('');
        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background:#fee2e2;border:2px solid #dc2626;padding:12px 16px;">
              <div style="font-size:12px;font-weight:bold;color:#dc2626;font-family:Arial,sans-serif;margin-bottom:6px;">RESULTADOS FUERA DE RANGO</div>
              <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;font-family:Arial,sans-serif;">${items}</ul>
            </td>
          </tr>
        </table>
        <div style="line-height:12px;font-size:1px;">&nbsp;</div>`;
    }

    html += `
    <div style="margin-top:8px;font-size:11px;color:#64748b;font-family:Arial,sans-serif;font-style:italic;text-align:justify;">
        Los rangos de normalidad sólo están establecidos para los resultados obtenidos por la calculadora pediátrica, no para los datos introducidos.
    </div>
    <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;font-family:Arial,sans-serif;text-align:center;">
        NefroPed — Calculadora de Función Renal Pediátrica
    </div>`;

    return html;
}

export function exportToWord(AppState, rawData) {
    if (!AppState.calculatedResults || Object.keys(AppState.calculatedResults).length === 0) {
        return window.Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.' });
    }
    try {
        const body = buildReportHTML(AppState, rawData);
        const fullHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>Informe NefroPed</title>
                <style>
                    @page { mso-page-orientation: portrait; margin: 20mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    table { border-collapse: collapse; }
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>${body}</body>
        </html>`;
        const blob = new Blob(['\ufeff', fullHTML], { type: 'application/msword' });
        window.saveAs(blob, 'informe-nefroped.doc');
        window.Swal.fire({ icon: 'success', title: 'Word descargado', text: 'En iPhone/iPad, ábrelo desde "Archivos" con la app de Word.', timer: 3500, showConfirmButton: false });
    } catch(e) {
        window.Swal.fire({ icon: 'error', title: 'Error', text: 'Error exportando.' });
    }
}

export function printReport(AppState, rawData) {
    if (!AppState.reportPlainText) {
        window.Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Primero calcula los resultados.' });
        return;
    }
    const body = buildReportHTML(AppState, rawData);
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>NefroPed — Informe</title>
        <style>
            @page { margin: 15mm; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            table { border-collapse: collapse; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
    </head><body>${body}</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    setTimeout(() => {
        pw.print();
        URL.revokeObjectURL(url);
    }, 400);
}

export function copyToClipboard(AppState) {
    if (!AppState.reportPlainText) {
        return window.Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.'});
    }
    
    navigator.clipboard.writeText(AppState.reportPlainText).then(() => {
        window.Swal.fire({
            icon: 'success', title: '¡Texto copiado!', text: 'Formato texto plano listo para pegar en la Historia Clínica (Ctrl+V).',
            timer: 2000, showConfirmButton: false
        });
    }).catch(err => {
        window.Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar automáticamente.' });
    });
}