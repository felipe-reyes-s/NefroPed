import { PDF_PALETTE, PARAMETROS, SECCIONES } from './constants.js';
import { evaluarRango } from './math-engine.js';

export function exportToPDF(AppState, rawData = {}) {
    if (!AppState.calculatedResults || Object.keys(AppState.calculatedResults).length === 0) {
        return Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.' });
    }

    Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            
            // Construimos R con todos los datos puros y calculados
            const R = Object.assign({}, rawData, AppState.calculatedResults);
            
            const edad = AppState.edadEnAños || 0;
            const edadM = AppState.edadEnMeses || 0;
            
            const margin = 14, pageW = 210, pageH = 297;
            const maxW = pageW - margin * 2;
            let y = 0;

            const newPage = () => { doc.addPage(); y = margin; };
            const checkSpace = (requiredHeight = 7) => { if (y + requiredHeight > pageH - 12) newPage(); };

            // ══ CABECERA ══════════════════════════════════
            doc.setFillColor(...PDF_PALETTE.TEAL);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(...PDF_PALETTE.WHITE);
            doc.setFont('helvetica','bold'); doc.setFontSize(15);
            doc.text('NefroPed', margin, 13);
            doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
            doc.text('Informe de Pruebas Complementarias Pediátricas', margin + 36, 13);
            doc.setFontSize(8);
            doc.text(new Date().toLocaleDateString('es-ES'), pageW - margin, 13, { align:'right' });
            y = 26;

            // ══ DATOS DEL PACIENTE ═════════════════════════
            const get = id => (rawData[id] && rawData[id] !== '') ? rawData[id] : '—';
            const sexoStr = rawData.sexo === 'M' ? 'Masculino' : (rawData.sexo === 'F' ? 'Femenino' : '—');

            doc.setFillColor(...PDF_PALETTE.LGREY2);
            doc.roundedRect(margin, y, maxW, 20, 2, 2, 'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...PDF_PALETTE.TEAL);
            doc.text('DATOS DEL PACIENTE', margin+3, y+5.5);
            doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_PALETTE.DARK);
            doc.text(`F. Nacimiento: ${get('fecha_nacimiento')}   F. Analítica: ${get('fecha_analitica')}   Edad: ${edad} años ${edadM} meses`, margin+3, y+12);
            doc.text(`Sexo: ${sexoStr}   Peso: ${get('peso_kg')} kg   Talla: ${get('talla_cm')} cm`, margin+3, y+18);
            y += 25;

            // ══ CONFIG COLUMNAS ════════════════════════════
            const PDF_CONFIG = {
                rowHeight: 6.5,           // Altura estándar de una fila de tabla
                textPadding: 4.5,         // Offset vertical del texto dentro de la celda
                textLineHeight: 5.5,      // Espaciado vertical entre líneas (multilínea)
                colValOffset: 75,         // Distancia X de la columna VALOR
                colRangOffset: 130        // Distancia X de la columna RANGO NORMAL
            };

            const COL_VAL  = margin + PDF_CONFIG.colValOffset;  
            const COL_RANG = margin + PDF_CONFIG.colRangOffset; 

            // ══ FUNCIÓN DIBUJAR TABLAS ═════════════════════
            const drawTable = (sec) => {
                if (!sec) return;
                
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
                if (!filas.length && !extraRows.length) return;

                checkSpace(15);

                doc.setFillColor(...PDF_PALETTE.TEAL);
                doc.rect(margin, y, maxW, 7, 'F');
                doc.setFont('helvetica','bold'); doc.setFontSize(8);
                doc.setTextColor(...PDF_PALETTE.WHITE);
                doc.text(sec.titulo, margin+3, y+5);
                y += 7;

                const drawHeader = () => {
                    doc.setFillColor(...PDF_PALETTE.LGREY);
                    doc.rect(margin, y, maxW, 5.5, 'F');
                    doc.setFont('helvetica','bold'); doc.setFontSize(7);
                    doc.setTextColor(...PDF_PALETTE.GREY);
                    doc.text('PARÁMETRO', margin+3, y+4);
                    doc.text('VALOR', COL_VAL, y+4);
                    doc.text('RANGO NORMAL', COL_RANG, y+4);
                    y += 5.5;
                };
                
                drawHeader();

                let alt = false;
                filas.forEach(key => {
                    if (y + PDF_CONFIG.rowHeight > pageH - 12) {
                        newPage();
                        drawHeader();
                    }
                    const val  = R[key];
                    const ev   = (key !== 'superficiecorporal' && key !== 'imc') ? evaluarRango(key, val, edad, edadM) : { enRango: true, rangoTexto: '' };
                    const p = PARAMETROS[key];
                    let valorTexto = (key === 'densidad' ? parseFloat(val).toFixed(0) : parseFloat(val).toFixed(2));
                    if (!ev.enRango) valorTexto = '*' + valorTexto;
                    valorTexto += (p?.unit ? ' ' + p.unit : '');
                    if (alt) { doc.setFillColor(...PDF_PALETTE.LGREY3); doc.rect(margin, y, maxW, PDF_CONFIG.rowHeight, 'F'); }
                    alt = !alt;

                    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_PALETTE.DARK);
                    const isGFR = (p?.label || '').includes('eGFR');
                    if (isGFR) doc.setFont('helvetica', 'italic');
                    doc.text(p?.label || key, margin+3, y+PDF_CONFIG.textPadding);
                    if (isGFR) doc.setFont('helvetica', 'normal');

                    doc.setFont('helvetica','bold');
                    doc.setTextColor(...(ev.enRango ? PDF_PALETTE.TEAL : PDF_PALETTE.RED));
                    doc.text(valorTexto, COL_VAL, y+PDF_CONFIG.textPadding);

                    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_PALETTE.GREY);
                    doc.text(ev.rangoTexto || '—', COL_RANG, y+PDF_CONFIG.textPadding);

                    doc.setDrawColor(...PDF_PALETTE.LGREY); doc.setLineWidth(0.1);
                    doc.line(margin, y+PDF_CONFIG.rowHeight, pageW-margin, y+PDF_CONFIG.rowHeight);
                    y += PDF_CONFIG.rowHeight;
                });

                // Imprimir las filas extra (Sedimento, etc.) SIN negrita y bien alineadas
                extraRows.forEach(row => {
                    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                    const textWidthLimit = COL_RANG - COL_VAL - 2; 
                    const lineas = doc.splitTextToSize(row.value, textWidthLimit);
                    const rowH = Math.max(PDF_CONFIG.rowHeight, (lineas.length * PDF_CONFIG.textLineHeight) + 2);
                    
                    if (y + rowH > pageH - 12) {
                        newPage();
                        drawHeader();
                    }

                    if (alt) { doc.setFillColor(...PDF_PALETTE.LGREY3); doc.rect(margin, y, maxW, rowH, 'F'); }
                    alt = !alt;

                    doc.setFont('helvetica','normal'); doc.setTextColor(...PDF_PALETTE.DARK);
                    doc.text(row.label, margin+3, y+PDF_CONFIG.textPadding);
                    
                    doc.setFont('helvetica','bold'); doc.setTextColor(...PDF_PALETTE.TEAL);
                    let tempY = y + PDF_CONFIG.textPadding;
                    lineas.forEach(l => {
                        doc.text(l, COL_VAL, tempY); // Empieza exactamente en la columna "VALOR"
                        tempY += PDF_CONFIG.textLineHeight;
                    });
                    
                    doc.setFontSize(7.5); doc.setTextColor(...PDF_PALETTE.GREY);
                    doc.text('—', COL_RANG, y+PDF_CONFIG.textPadding);

                    doc.setDrawColor(...PDF_PALETTE.LGREY); doc.setLineWidth(0.1);
                    doc.line(margin, y+rowH, pageW-margin, y+rowH);
                    y += rowH;
                });

                y += 4;
            };

            const drawTextBlock = (titulo, texto) => {
                let textValue = (texto && typeof texto === 'string') ? texto.trim() : '';
                if (!textValue || textValue === '—') return;
                
                doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                const lineas = doc.splitTextToSize(textValue, maxW-4);
                checkSpace(10 + (lineas.length * PDF_CONFIG.textLineHeight) + 5);
                
                doc.setFillColor(...PDF_PALETTE.TEAL);
                doc.rect(margin, y, maxW, 7, 'F');
                doc.setFont('helvetica','bold'); doc.setFontSize(8);
                doc.setTextColor(...PDF_PALETTE.WHITE);
                doc.text(titulo, margin+3, y+5);
                y += 11;
                
                doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
                doc.setTextColor(...PDF_PALETTE.TEAL);
                lineas.forEach(l => { checkSpace(6); doc.text(l, margin+2, y); y += PDF_CONFIG.textLineHeight; });
                y += 3;
            };

            // ── ORDEN INTERCALADO ════════════════════════════
            SECCIONES.forEach(sec => drawTable(sec));
            
            drawTextBlock('Otros', get('comentario_nutricional'));
            
            if (AppState.ecografiaReportText) {
                drawTextBlock('Ecografía renal', '· ' + AppState.ecografiaReportText.replace(/^-/, '').trim());
            }
            
            // ══ ESTADIFICACIÓN KDIGO ═══════════════════════
            if (AppState.estadificacionKDIGO) {
                doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                const bH = 10 + AppState.estadificacionKDIGO.items.length * PDF_CONFIG.textLineHeight;
                checkSpace(bH + 5);

                doc.setFillColor(240, 249, 255); 
                doc.roundedRect(margin, y, maxW, bH, 2, 2, 'F');
                doc.setDrawColor(...PDF_PALETTE.TEAL); doc.setLineWidth(0.4); doc.roundedRect(margin, y, maxW, bH, 2, 2, 'S');
                
                doc.setFont('helvetica','bold'); doc.setTextColor(...PDF_PALETTE.TEAL);
                doc.text(AppState.estadificacionKDIGO.titulo.toUpperCase(), margin+4, y+6.5);
                y += 12;
                
                doc.setTextColor(...PDF_PALETTE.DARK);
                AppState.estadificacionKDIGO.items.forEach(item => {
                    checkSpace(6); 
                    const parts = item.split(':');
                    const title = '• ' + parts[0] + ': ';
                    const rest = parts.slice(1).join(':').trim();
                    doc.setFont('helvetica','bold');
                    const titleWidth = doc.getTextWidth(title);
                    doc.text(title, margin+4, y);
                    doc.setFont('helvetica','normal');
                    doc.text(rest, margin+4 + titleWidth, y);
                    y += PDF_CONFIG.textLineHeight; 
                });
                y += 4;
            }

            // ══ RESUMEN ALERTAS ════════════════════════════
            if (AppState.valoresFueraRango?.length > 0) {
                doc.setFont('helvetica','normal'); doc.setFontSize(8);
                let totalLines = 0;
                const processedAlerts = AppState.valoresFueraRango.map(v => {
                    const parts = v.split(':');
                    const title = '• ' + parts[0] + ': ';
                    const rest = parts.slice(1).join(':').trim();
                    
                    doc.setFont('helvetica', 'bold');
                    const titleW = doc.getTextWidth(title);
                    doc.setFont('helvetica', 'normal');
                    const restLines = doc.splitTextToSize(rest, maxW - 8 - titleW);
                    
                    totalLines += restLines.length;
                    return { title, titleW, restLines };
                });
                
                const bH = 10 + totalLines * PDF_CONFIG.textLineHeight;
                checkSpace(bH + 5);
                
                doc.setFillColor(...PDF_PALETTE.RED_BG); doc.roundedRect(margin, y, maxW, bH, 2, 2, 'F');
                doc.setDrawColor(...PDF_PALETTE.RED); doc.setLineWidth(0.4); doc.roundedRect(margin, y, maxW, bH, 2, 2, 'S');
                doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...PDF_PALETTE.RED);
                doc.text('RESULTADOS FUERA DE RANGO', margin+4, y+6.5);
                y += 12;
                
                doc.setFontSize(8); doc.setTextColor(...PDF_PALETTE.DARK);
                processedAlerts.forEach(item => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(item.title, margin + 4, y);
                    
                    doc.setFont('helvetica', 'normal');
                    item.restLines.forEach(line => {
                        doc.text(line, margin + 4 + item.titleW, y);
                        y += PDF_CONFIG.textLineHeight;
                    });
                });
                y += 4;
            }

            // ══ AVISO LEGAL ════════════════════════════════
            doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...PDF_PALETTE.GREY);
            const avisoText = 'Los rangos de normalidad sólo están establecidos para los resultados obtenidos por la calculadora pediátrica, no para los datos introducidos.';
            const lineasAviso = doc.splitTextToSize(avisoText, maxW);
            checkSpace(lineasAviso.length * PDF_CONFIG.textLineHeight + 6);
            y += 4;
            lineasAviso.forEach(l => {
                doc.text(l, margin, y);
                y += PDF_CONFIG.textLineHeight;
            });
            doc.setFont('helvetica', 'normal');

            // ══ PIE DE PÁGINA ══════════════════════════════
            const total = doc.internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setDrawColor(...PDF_PALETTE.LGREY); doc.setLineWidth(0.3);
                doc.line(margin, pageH-10, pageW-margin, pageH-10);
                doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
                doc.setTextColor(...PDF_PALETTE.GREY);
                doc.text('NefroPed — Calculadora de Función Renal Pediátrica', margin, pageH-6);
                doc.text(`Página ${i} de ${total}`, pageW-margin, pageH-6, { align:'right' });
            }

            doc.save('informe-nefroped.pdf');
            Swal.fire({ icon:'success', title:'¡PDF descargado!', timer:1500, showConfirmButton:false });

        } catch(e) {
            console.error(e);
            Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF: '+e.message });
        }
    }, 100);
}
