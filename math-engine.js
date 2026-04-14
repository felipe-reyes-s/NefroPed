export function parseFecha(str) {
    if (!str || !str.includes('/')) return null;
    const [dia, mes, anio] = str.split('/').map(Number);
    if (!dia || !mes || !anio || anio < 1900) return null;
    const fecha = new Date(anio, mes - 1, dia);
    if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1 || fecha.getFullYear() !== anio) return null;
    return fecha;
}

export function evaluarRango(parametro, valor, edad, edadMeses) {
    if (valor === null || valor === undefined || valor === 0) return { enRango: true };
    const edadTotalMeses = (edad * 12) + edadMeses;
    let rangoMin, rangoMax, rangoTexto = '', esRangoValido = true;
    
    switch (parametro) {
        case 'vpercent': if (edad >= 1) { rangoMax = 0.81; rangoTexto = '<0.81%'; return { enRango: valor <= rangoMax, tipo: valor > rangoMax ? 'alto' : 'normal', rangoTexto }; } break;
        
        // Fórmulas para > 2 años (KDIGO normal)
        case 'ckid_u25_cr': case 'ckid_u25_cistc': case 'ckid_u25_combinado': 
        case 'schwartz_bedside': case 'ekfc_cr': case 'ekfc_cistc':
            rangoMin = 90; rangoTexto = '>90ml/min/1.73m²'; return { enRango: valor >= rangoMin, tipo: valor < rangoMin ? 'bajo' : 'normal', rangoTexto };
            
        // Fórmulas para Lactantes y Neonatos (Ajuste dinámico por mes)
        case 'schwartz_neo': case 'schwartz_lact': case 'bokenkamp':{
            const limites_minimos = {
                1: 35, 2: 40, 3: 45, 4: 50, 5: 55, 6: 60, 7: 63, 8: 65, 9: 68, 10: 70, 
                11: 73, 12: 75, 13: 76, 14: 77, 15: 78, 16: 79, 17: 81, 18: 82, 19: 83, 
                20: 84, 21: 85, 22: 87, 23: 88, 24: 90
            };
            const mesUsado = edadTotalMeses <= 0 ? 1 : (edadTotalMeses > 24 ? 24 : Math.floor(edadTotalMeses));
            rangoMin = limites_minimos[mesUsado] || 90;
            rangoTexto = `>${rangoMin}ml/min/1.73m² (Normal para ${mesUsado} meses)`;
            return { enRango: valor >= rangoMin, tipo: valor < rangoMin ? 'bajo' : 'normal', rangoTexto };
        }
        case 'efau': if (edad >= 1 && edad < 5) { rangoMin = 11; rangoMax = 17; rangoTexto = '11–17'; } else if (edad >= 5) { rangoMin = 4.45; rangoMax = 9.99; rangoTexto = '4.45–9.99'; } else esRangoValido = false; break;
        case 'efna': rangoMin = 0.42; rangoMax = 0.84; rangoTexto = '0.42–0.84'; break;
        case 'efk': rangoMin = 5.19; rangoMax = 11.67; rangoTexto = '5.19–11.67'; break;
        case 'efcl': rangoMin = 0.57; rangoMax = 1.11; rangoTexto = '0.57–1.11'; break;
        case 'cacr': if (edadTotalMeses < 6) { rangoMax = 0.8; rangoTexto = '<0.8mg/mg'; } else if (edadTotalMeses < 12) { rangoMax = 0.6; rangoTexto = '<0.6mg/mg'; } else if (edad >= 1 && edad < 2) { rangoMax = 0.5; rangoTexto = '<0.5mg/mg'; } else if (edad >= 2 && edad < 4) { rangoMax = 0.28; rangoTexto = '<0.28mg/mg'; } else if (edad >= 4) { rangoMax = 0.20; rangoTexto = '<0.20mg/mg'; } return { enRango: valor <= rangoMax, tipo: valor > rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'rtp': if (edad >= 1 && edad < 3) { rangoMin = 81.18; rangoMax = 90.08; rangoTexto = '81.18–90.08%'; } else if (edad >= 3 && edad < 5) { rangoMin = 86.43; rangoMax = 95.76; rangoTexto = '86.43–95.76%'; } else if (edad >= 5) { rangoMin = 90.26; rangoMax = 94.86; rangoTexto = '90.26–94.86%'; } else esRangoValido = false; break;
        case 'mgcr': if (edad >= 1 && edad < 2) { rangoMin = 0.09; rangoMax = 0.37; rangoTexto = '0.09–0.37mg/mg'; } else if (edad >= 2 && edad < 3) { rangoMin = 0.07; rangoMax = 0.34; rangoTexto = '0.07–0.34mg/mg'; } else if (edad >= 3 && edad < 5) { rangoMin = 0.07; rangoMax = 0.29; rangoTexto = '0.07–0.29mg/mg'; } else if (edad >= 5 && edad < 7) { rangoMin = 0.06; rangoMax = 0.21; rangoTexto = '0.06–0.21mg/mg'; } else if (edad >= 7 && edad < 10) { rangoMin = 0.05; rangoMax = 0.18; rangoTexto = '0.05–0.18mg/mg'; } else if (edad >= 10 && edad < 14) { rangoMin = 0.05; rangoMax = 0.15; rangoTexto = '0.05–0.15mg/mg'; } else esRangoValido = false; break;
        case 'pcr': if (edad >= 0 && edad < 3) { rangoMin = 0.8; rangoMax = 2; rangoTexto = '0.8–2mg/mg'; } else if (edad >= 3 && edad < 5) { rangoMin = 0.33; rangoMax = 2.17; rangoTexto = '0.33–2.17mg/mg'; } else if (edad >= 5 && edad < 7) { rangoMin = 0.33; rangoMax = 1.49; rangoTexto = '0.33–1.49mg/mg'; } else if (edad >= 7 && edad < 10) { rangoMin = 0.32; rangoMax = 0.97; rangoTexto = '0.32–0.97mg/mg'; } else if (edad >= 10 && edad < 14) { rangoMin = 0.22; rangoMax = 0.86; rangoTexto = '0.22–0.86mg/mg'; } else esRangoValido = false; break;
        case 'aucr': if (edad >= 3 && edad < 5) { rangoMin = 0.66; rangoMax = 1.1; rangoTexto = '0.66–1.1mg/mg'; } else if (edad >= 5 && edad < 7) { rangoMin = 0.5; rangoMax = 0.92; rangoTexto = '0.5–0.92mg/mg'; } else if (edad >= 7 && edad < 9) { rangoMin = 0.44; rangoMax = 0.8; rangoTexto = '0.44–0.8mg/mg'; } else if (edad >= 9 && edad < 11) { rangoMin = 0.4; rangoMax = 0.72; rangoTexto = '0.4–0.72mg/mg'; } else if (edad >= 11 && edad < 13) { rangoMin = 0.35; rangoMax = 0.61; rangoTexto = '0.35–0.61mg/mg'; } else if (edad >= 13 && edad < 14) { rangoMin = 0.28; rangoMax = 0.5; rangoTexto = '0.28–0.5mg/mg'; } else esRangoValido = false; break;
        case 'citratocr': rangoMin = 0.4; rangoTexto = '>0.4mg/mg'; return { enRango: valor > rangoMin, tipo: valor <= rangoMin ? 'bajo' : 'normal', rangoTexto };
        case 'cacitrato': rangoMax = 0.3; rangoTexto = '<0.3'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'oxalatocr': if (edadTotalMeses < 6) { rangoMax = 0.29; rangoTexto = '<0.29mg/mg'; } else if (edadTotalMeses >= 6 && edad < 2) { rangoMax = 0.20; rangoTexto = '<0.20mg/mg'; } else if (edad >= 2 && edad < 6) { rangoMax = 0.22; rangoTexto = '<0.22mg/mg'; } else if (edad >= 6 && edad < 13) { rangoMax = 0.06; rangoTexto = '<0.06mg/mg'; } else if (edad >= 13) { rangoMax = 0.03; rangoTexto = '<0.03mg/mg'; } return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'albcr': rangoMax = 30; rangoTexto = '<30mg/g'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'protcr': if (edad < 2) { rangoMax = 500; rangoTexto = '<500mg/g'; } else { rangoMax = 200; rangoTexto = '<200mg/g'; } return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'nak': rangoMax = 2.5; rangoTexto = '<2.5'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'uricosuria': rangoMin = 373; rangoMax = 667; rangoTexto = '373–667mg/1.73m²/día'; break;
        case 'calciuria': rangoMax = 4; rangoTexto = '<4mg/kg/día'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'citraturia': rangoMin = 5.57; rangoMax = 13.67; rangoTexto = '5.57–13.67mg/kg/día'; break;
        case 'fosfaturia': rangoMin = 7.8; rangoMax = 17; rangoTexto = '7.8–17mg/kg/día'; break;
        case 'oxaluria': rangoMin = 23.2; rangoMax = 50.6; rangoTexto = '23.2–50.6mg/1.73m²/día'; break;
        case 'magnesuria': rangoMin = 1; rangoMax = 3.3; rangoTexto = '1–3.3mg/kg/día'; break;
        case 'albuminuria': rangoMax = 30; rangoTexto = '<30mg/1.73m²/día'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        case 'proteinuria': case 'proteinuriaestimada': rangoMax = 100; rangoTexto = '<100mg/m²/día'; return { enRango: valor < rangoMax, tipo: valor >= rangoMax ? 'alto' : 'normal', rangoTexto };
        default: return { enRango: true };
    }
    
    if (!esRangoValido) return { enRango: true };
    let tipo = 'normal'; let enRango = true;
    if (rangoMin !== undefined && valor < rangoMin) { enRango = false; tipo = 'bajo'; } 
    else if (rangoMax !== undefined && valor > rangoMax) { enRango = false; tipo = 'alto'; }
    return { enRango, tipo, rangoTexto };
}

/**
 * Motor principal de cálculos médicos de NefroPed.
 * 📚 REFERENCIAS CLÍNICAS Y DOIs:
 * - Schwartz Bedside (2009): eGFR = 0.413 * (Talla / Cr). DOI: 10.2215/CJN.02300408
 * - CKiD U25 (Pierce et al., 2021): Función combinada Cr y Cistatina para <25 años. DOI: 10.1053/j.ajkd.2020.10.016
 * - EKFC (Pottel et al., 2021): European Kidney Function Consortium. DOI: 10.7326/M20-4366
 * - Bökenkamp (1998): Estimación basada en Cistatina C. DOI: 10.1007/s004670050419
 * 
 * @param {Object} data - Diccionario con los inputs crudos del paciente.
 * @param {number} edadAnos - Edad en años cronológicos.
 * @param {number} edadMeses - Restante de meses.
 */
export function performMedicalCalculations(data, edadAnos, edadMeses) {
    const superficieCorporal = Math.sqrt(data.peso_kg * data.talla_cm / 3600);
    const imc = data.peso_kg > 0 && data.talla_cm > 0 ? data.peso_kg / Math.pow(data.talla_cm / 100, 2) : 0;
    const edadExacta = edadAnos + (edadMeses / 12);
    const talla_m = data.talla_cm / 100;

    const talla = data.talla_cm;
    const cr = data.creatinina_enz_mg_dl;
    const cistC = data.cistatina_c_mg_l;
    const sexo = data.sexo;

    let diasVida = 0;
    const fechaNacObj  = parseFecha(data.fecha_nacimiento);
    const fechaAnalObj = parseFecha(data.fecha_analitica);
    if (fechaNacObj && fechaAnalObj) {
        diasVida = Math.floor((fechaAnalObj.getTime() - fechaNacObj.getTime()) / (1000 * 3600 * 24));
    }

    let schwartz_neo = 0, schwartz_lact = 0, schwartz_bedside = 0, bokenkamp = 0, ekfc_cr = 0, ekfc_cistc = 0;
    let ckid_u25_cr = 0, ckid_u25_cistc = 0, ckid_u25_combinado = 0;

    if (diasVida >= 0 && diasVida <= 28) {
        if (cr > 0 && talla > 0) schwartz_neo = 0.31 * (talla / cr);
        if (cistC > 0) bokenkamp = 100 * (0.83 / cistC);
    } else if (diasVida >= 29 && diasVida < 365) {
        if (cr > 0 && talla > 0) schwartz_lact = 0.34 * (talla / cr);
        if (cistC > 0) bokenkamp = 100 * (0.83 / cistC);
        let k_cr_lactante = (sexo === 'M') ? 39.0 * Math.pow(1.008, 1 - 12) : 36.1 * Math.pow(1.008, 1 - 12);
        if (cr > 0 && talla_m > 0) ckid_u25_cr = k_cr_lactante * (talla_m / cr);
        let k_cist_lactante = (sexo === 'M') ? 87.2 * Math.pow(1.011, 1 - 15) : 79.9 * Math.pow(1.004, 1 - 12);
        if (cistC > 0) ckid_u25_cistc = k_cist_lactante * (1 / cistC);
        if (ckid_u25_cr > 0 && ckid_u25_cistc > 0) ckid_u25_combinado = (ckid_u25_cr + ckid_u25_cistc) / 2;
    } else if (diasVida >= 365 && edadExacta <= 25) {
        if (cr > 0 && talla > 0 && edadExacta < 16) schwartz_bedside = 0.413 * (talla / cr);
        let k_cr = 0;
        if (edadExacta >= 1 && edadExacta < 12) k_cr = (sexo === 'M') ? 39.0 * Math.pow(1.008, edadExacta - 12) : 36.1 * Math.pow(1.008, edadExacta - 12);
        else if (edadExacta >= 12 && edadExacta < 18) k_cr = (sexo === 'M') ? 39.0 * Math.pow(1.045, edadExacta - 12) : 36.1 * Math.pow(1.023, edadExacta - 12);
        else if (edadExacta >= 18) k_cr = (sexo === 'M') ? 50.8 : 41.4;
        if (k_cr > 0 && cr > 0 && talla_m > 0) ckid_u25_cr = k_cr * (talla_m / cr);

        let k_cist = 0;
        if (edadExacta >= 1 && edadExacta < 12) k_cist = (sexo === 'M') ? 87.2 * Math.pow(1.011, edadExacta - 15) : 79.9 * Math.pow(1.004, edadExacta - 12);
        else if (edadExacta >= 12 && edadExacta < 15) k_cist = (sexo === 'M') ? 87.2 * Math.pow(1.011, edadExacta - 15) : 79.9 * Math.pow(0.974, edadExacta - 12);
        else if (edadExacta >= 15 && edadExacta < 18) k_cist = (sexo === 'M') ? 87.2 * Math.pow(0.960, edadExacta - 15) : 79.9 * Math.pow(0.974, edadExacta - 12);
        else if (edadExacta >= 18) k_cist = (sexo === 'M') ? 77.1 : 68.3;
        if (k_cist > 0 && cistC > 0) ckid_u25_cistc = k_cist * (1 / cistC);
        if (ckid_u25_cr > 0 && ckid_u25_cistc > 0) ckid_u25_combinado = (ckid_u25_cr + ckid_u25_cistc) / 2;

        if (cr > 0 && edadExacta >= 2) {
            let Q_cr = 0;
            if (edadExacta <= 25) {
                let lnQ_umol = (sexo === 'M' || sexo === 'Hombre') ? 3.200 + (0.259 * edadExacta) - (0.543 * Math.log(edadExacta)) - (0.00763 * Math.pow(edadExacta, 2)) + (0.0000790 * Math.pow(edadExacta, 3)) : 3.080 + (0.177 * edadExacta) - (0.223 * Math.log(edadExacta)) - (0.00596 * Math.pow(edadExacta, 2)) + (0.0000686 * Math.pow(edadExacta, 3));
                Q_cr = Math.exp(lnQ_umol) / 88.4;
            } else {
                Q_cr = (sexo === 'M' || sexo === 'Hombre') ? 0.90 : 0.70;
            }
            const ratioCr = cr / Q_cr;
            const alphaCr = ratioCr <= 1 ? -0.322 : -1.132;
            ekfc_cr = 107.3 * Math.pow(ratioCr, alphaCr) * Math.pow(0.990, (edadExacta > 40 ? edadExacta - 40 : 0));
        }
        if (cistC > 0 && edadExacta >= 2) {
            const Q_cistC = 0.83;
            const ratioCistC = cistC / Q_cistC;
            const alphaCistC = ratioCistC <= 1 ? -0.322 : -1.132;
            ekfc_cistc = 107.3 * Math.pow(ratioCistC, alphaCistC) * Math.pow(0.990, (edadExacta > 50 ? edadExacta - 50 : 0));
        }
    }

    const efNa = (data.na_plasma_meq_l > 0 && data.creatinina_orina_mg_dl > 0 && data.na_orina_meq_l > 0 && data.creatinina_enz_mg_dl > 0) ? (data.na_orina_meq_l * data.creatinina_enz_mg_dl) / (data.na_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efK = (data.k_plasma_meq_l > 0 && data.creatinina_orina_mg_dl > 0 && data.k_orina_meq_l > 0 && data.creatinina_enz_mg_dl > 0) ? (data.k_orina_meq_l * data.creatinina_enz_mg_dl) / (data.k_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efCl = (data.cl_plasma_meq_l > 0 && data.creatinina_orina_mg_dl > 0 && data.cl_orina_meq_l > 0 && data.creatinina_enz_mg_dl > 0) ? (data.cl_orina_meq_l * data.creatinina_enz_mg_dl) / (data.cl_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efAU = (data.au_plasma_mg_dl > 0 && data.creatinina_orina_mg_dl > 0 && data.au_orina_mg_dl > 0 && data.creatinina_enz_mg_dl > 0) ? (data.au_orina_mg_dl * data.creatinina_enz_mg_dl) / (data.au_plasma_mg_dl * data.creatinina_orina_mg_dl) * 100 : 0;
    const cacr = data.creatinina_orina_mg_dl > 0 ? data.ca_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const mgcr = data.creatinina_orina_mg_dl > 0 ? data.magnesio_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const pcr = data.creatinina_orina_mg_dl > 0 ? data.fosforo_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const aucr = data.creatinina_orina_mg_dl > 0 ? data.au_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const albcr = data.creatinina_orina_mg_dl > 0 ? (data.albumina_orina_mg_dl / data.creatinina_orina_mg_dl) * 1000 : 0;
    const protcr = data.creatinina_orina_mg_dl > 0 ? (data.proteinas_orina_mg_dl / data.creatinina_orina_mg_dl) * 1000 : 0;
    const citratocr = data.creatinina_orina_mg_dl > 0 ? data.citrato_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const oxalatocr = data.creatinina_orina_mg_dl > 0 ? data.oxalato_orina_mg_dl / data.creatinina_orina_mg_dl : 0;
    const nak = data.k_orina_meq_l > 0 ? data.na_orina_meq_l / data.k_orina_meq_l : 0;
    const cacitrato = data.citrato_orina_mg_dl > 0 ? data.ca_orina_mg_dl / data.citrato_orina_mg_dl : 0;
    const rtp = (data.p_plasma_mg_dl > 0 && data.fosforo_orina_mg_dl > 0 && data.creatinina_orina_mg_dl > 0 && data.creatinina_enz_mg_dl > 0) ? 100 - ((data.fosforo_orina_mg_dl * data.creatinina_enz_mg_dl) / (data.p_plasma_mg_dl * data.creatinina_orina_mg_dl)) * 100 : 0;
    const uricosuria = superficieCorporal > 0 ? (data.au_24h_mg / superficieCorporal) * 1.73 : 0;
    const calciuria = data.peso_kg > 0 ? data.ca_24h_mg / data.peso_kg : 0;
    const citraturia = data.peso_kg > 0 ? data.citrato_24h_mg / data.peso_kg : 0;
    const fosfaturia = data.peso_kg > 0 ? data.p_24h_mg / data.peso_kg : 0;
    const magnesuria = data.peso_kg > 0 ? data.mg_24h_mg / data.peso_kg : 0;
    const oxaluria = superficieCorporal > 0 ? (data.oxalato_24h_mg / superficieCorporal) * 1.73 : 0;
    const albuminuria = superficieCorporal > 0 ? (data.albumina_24h_mg / superficieCorporal) * 1.73 : 0;
    const proteinuria = superficieCorporal > 0 ? data.proteinas_24h_mg / superficieCorporal : 0;
    const proteinuriaEstimada = protcr * 0.63;
    const vpercent = (data.creatinina_enz_mg_dl > 0 && data.creatinina_orina_mg_dl > 0) ? (data.creatinina_enz_mg_dl / data.creatinina_orina_mg_dl) * 100 : 0;

    // Agrupamos los resultados para el saneamiento final
    const resultadosFinales = {
        superficiecorporal: superficieCorporal, imc: imc, vpercent: vpercent, 
        schwartz_neo, schwartz_lact, schwartz_bedside, bokenkamp, ekfc_cr, ekfc_cistc,
        ckid_u25_cr: ckid_u25_cr, ckid_u25_cistc: ckid_u25_cistc, ckid_u25_combinado: ckid_u25_combinado, 
        efau: efAU, efna: efNa, efk: efK, efcl: efCl, cacr: cacr, rtp: rtp, mgcr: mgcr, pcr: pcr, aucr: aucr, 
        citratocr: citratocr, cacitrato: cacitrato, oxalatocr: oxalatocr, albcr: albcr, protcr: protcr, nak: nak, 
        uricosuria: uricosuria, calciuria: calciuria, citraturia: citraturia, fosfaturia: fosfaturia, oxaluria: oxaluria, 
        magnesuria: magnesuria, albuminuria: albuminuria, proteinuria: proteinuria, proteinuriaestimada: proteinuriaEstimada
    };

    // Saneamiento de seguridad (Auditoría): Convertir posibles NaN o Infinity a 0
    Object.keys(resultadosFinales).forEach(key => {
        const val = resultadosFinales[key];
        if (typeof val === 'number' && (!Number.isFinite(val) || isNaN(val))) {
            resultadosFinales[key] = 0;
        }
    });

    return resultadosFinales;
}

/**
 * Tablas L, M, S de Obrycki para percentiles de longitud renal ecográfica.
 * Implementa la transformación matemática Box-Cox para distribuciones asimétricas.
 * 📚 Fuente: Obrycki et al. (2017) - DOI: 10.1007/s00467-016-3507-6
 */
export const obryckiLMS = [
    { min: 0, max: 54.9, L: 0.567, M: 50.4, S: 0.0844 }, { min: 55, max: 59.9, L: 0.532, M: 52.9, S: 0.0836 },
    { min: 60, max: 64.9, L: 0.498, M: 55.4, S: 0.0828 }, { min: 65, max: 69.9, L: 0.458, M: 58.3, S: 0.0820 },
    { min: 70, max: 74.9, L: 0.423, M: 60.8, S: 0.0812 }, { min: 75, max: 79.9, L: 0.387, M: 63.3, S: 0.0804 },
    { min: 80, max: 84.9, L: 0.352, M: 65.7, S: 0.0797 }, { min: 85, max: 89.9, L: 0.312, M: 68.3, S: 0.0788 },
    { min: 90, max: 94.9, L: 0.276, M: 70.6, S: 0.0781 }, { min: 95, max: 99.9, L: 0.237, M: 73.0, S: 0.0773 },
    { min: 100, max: 104.9, L: 0.200, M: 75.2, S: 0.0765 }, { min: 105, max: 109.9, L: 0.165, M: 77.2, S: 0.0758 },
    { min: 110, max: 114.9, L: 0.131, M: 79.1, S: 0.0751 }, { min: 115, max: 119.9, L: 0.090, M: 81.4, S: 0.0743 },
    { min: 120, max: 124.9, L: 0.052, M: 83.5, S: 0.0735 }, { min: 125, max: 129.9, L: 0.015, M: 85.6, S: 0.0728 },
    { min: 130, max: 134.9, L: -0.022, M: 87.8, S: 0.0721 }, { min: 135, max: 139.9, L: -0.058, M: 89.9, S: 0.0714 },
    { min: 140, max: 144.9, L: -0.093, M: 92.1, S: 0.0707 }, { min: 145, max: 149.9, L: -0.131, M: 94.5, S: 0.0700 },
    { min: 150, max: 154.9, L: -0.168, M: 97.0, S: 0.0693 }, { min: 155, max: 159.9, L: -0.207, M: 99.6, S: 0.0686 },
    { min: 160, max: 164.9, L: -0.243, M: 102.1, S: 0.0680 }, { min: 165, max: 169.9, L: -0.279, M: 104.5, S: 0.0673 },
    { min: 170, max: 174.9, L: -0.315, M: 106.9, S: 0.0667 }, { min: 175, max: 179.9, L: -0.353, M: 109.5, S: 0.0660 },
    { min: 180, max: 184.9, L: -0.389, M: 111.9, S: 0.0654 }, { min: 185, max: 189.9, L: -0.427, M: 114.5, S: 0.0647 },
    { min: 190, max: 194.9, L: -0.461, M: 116.8, S: 0.0641 }, { min: 195, max: 199.9, L: -0.486, M: 118.5, S: 0.0637 },
    { min: 200, max: 300.0, L: -0.538, M: 122.0, S: 0.0628 }
];

export function zScoreToPercentile(z) {
    if (z === 0.0) return 50;
    let b1 = 0.31938153, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
    let p = 0.2316419, c = 0.39894228;
    let t = 1.0 / (1.0 + p * Math.abs(z));
    let cdf = 1.0 - c * Math.exp(-z * z / 2.0) * t * (t *(t *(t *(t * b5 + b4) + b3) + b2) + b1);
    if (z < 0) cdf = 1.0 - cdf;
    return Math.round(cdf * 100);
}