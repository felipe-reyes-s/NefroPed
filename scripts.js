import { parseFecha, evaluarRango, performMedicalCalculations, obryckiLMS, zScoreToPercentile } from './math-engine.js';
import { PARAMETROS, SECCIONES, TAB_FIELDS } from './constants.js';
import { exportToPDF } from './pdf-export.js';

// ======================================================================================
// 1. REGISTRO DEL SERVICE WORKER CON GESTIÓN AVANZADA DE ACTUALIZACIONES (PWA)
// ======================================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(registration => {
            console.log('SW registrado correctamente');

            if (registration.waiting) {
                mostrarAvisoActualizacion(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        mostrarAvisoActualizacion(newWorker);
                    }
                });
            });

            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000); 

        });

        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    });
}

function mostrarAvisoActualizacion(worker) {
    const isDark = document.documentElement.getAttribute('data-color-scheme') === 'dark';
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: true,
        confirmButtonText: '🔄 Actualizar ahora',
        showCancelButton: true,
        cancelButtonText: 'Más tarde',
        timer: null,
        background: isDark ? '#1e293b' : '#ffffff',
        color:      isDark ? '#f1f5f9' : '#0f172a',
        confirmButtonColor: 'var(--color-primary)'
    });
    Toast.fire({
        icon: 'info',
        title: 'Nueva versión disponible'
    }).then((result) => {
        if (result.isConfirmed) {
            worker.postMessage({ type: 'SKIP_WAITING' });
        }
    });
}
// ===============================================
// 2. VARIABLES GLOBALES Y CONFIGURACIÓN
// ===============================================
let fieldIds = [];
let camposParaContador = [];
let debounceTimer = null;

const AppState = {
    calculatedResults: {},
    primeraValidacion: false,
    edadEnAños: 0,
    edadEnMeses: 0,
    edadTotalMeses: 0,
    valoresFueraRango: [],
    ecografiaReportText: ""
};

const SESSION_STORAGE_KEY = 'calcRenalDataTemporales';
const THEME_STORAGE_KEY = 'themePref';
// ────────────────────────────────────────────────────────────────────────────


document.addEventListener('DOMContentLoaded', function() {
    if (location.hostname === 'localhost') console.log('🚀 Dev mode');
    setupAutoSave();
        fieldIds = Array.from(document.querySelectorAll('#clinicalForm input[id], #clinicalForm select[id]'))
        .filter(input => input.id !== 'edad_calculada' && input.type !== 'checkbox' && input.type !== 'radio')
        .map(input => input.id);    
    camposParaContador = [...fieldIds, 'sedimento_urinario', 'comentario_nutricional', 'serie_blanca', 'serie_plaquetaria', 'coagulacion'];
    configureNumericValidation();
    configurarEventosFechas();
    verifyFieldsExist();
    setupTabNavigation();
    setupFormEvents();
    setupButtons();
    updateFieldCounter();
    inyectarUnidadesEnInputs();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modo') === 'test') {
        activarModoTest();
    }

    setupSecretTap();
    setupThemeToggle(); 
    posicionarDropdownExport(); 

    const checkMonoreno = document.getElementById('check_monoreno');
    if (checkMonoreno) {
        checkMonoreno.addEventListener('change', function() {
            toggleMonoreno(this.checked);
        });
    }

    const radiosRinon = document.querySelectorAll('input[name="radio_rinon_unico"]');
    radiosRinon.forEach(radio => {
        radio.addEventListener('change', function() {
            seleccionarRinonUnico(this.value);
        });
    });

    // Accesibilidad: Ocultar todos los iconos decorativos a los lectores de pantalla
    document.querySelectorAll('i.fas, i.far').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
});

// ===============================================
// DROPDOWN EXPORTAR — posicionamiento inteligente
// ===============================================
function posicionarDropdownExport() {
    const details = document.querySelector('.export-details');
    const dropdown = document.querySelector('.export-dropdown');
    if (!details || !dropdown) return;

    const summary = details.querySelector('.export-summary');

    // Ocultar ANTES de que el navegador lo pinte en posición por defecto
    summary.addEventListener('click', () => {
        if (!details.open) {
            dropdown.style.visibility = 'hidden';
        }
    });

    details.addEventListener('toggle', () => {
        if (!details.open) return;

        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.left = '';
        dropdown.style.right = '';

        const summaryRect = summary.getBoundingClientRect();
        const detailsRect = details.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth <= 768;

        const summaryOffsetLeft  = summaryRect.left  - detailsRect.left;
        const summaryOffsetRight = detailsRect.right - summaryRect.right;
        const summaryOffsetTop   = summaryRect.top   - detailsRect.top;

        if (isMobile) {
            dropdown.style.left = summaryOffsetLeft + 'px';
            dropdown.style.right = 'auto';

            if (summaryRect.bottom + dropdownRect.height > viewportHeight) {
                dropdown.style.bottom = (detailsRect.bottom - summaryRect.top) + 'px';
                dropdown.style.top = 'auto';
            } else {
                dropdown.style.top = (summaryRect.bottom - detailsRect.top) + 'px';
                dropdown.style.bottom = 'auto';
            }
        } else {
            if (summaryRect.right + dropdownRect.width > viewportWidth) {
                dropdown.style.right = summaryOffsetRight + 'px';
                dropdown.style.left = 'auto';
            } else {
                dropdown.style.left = (summaryRect.right - detailsRect.left) + 'px';
                dropdown.style.right = 'auto';
            }
            dropdown.style.top = summaryOffsetTop + 'px';
            dropdown.style.bottom = 'auto';
        }

        // Mostrar ya en su posición final, sin parpadeo
        dropdown.style.visibility = 'visible';
    });
    // Cerrar el dropdown al pulsar cualquier opción
dropdown.querySelectorAll('a, button').forEach(item => {
    item.addEventListener('click', () => {
        details.open = false;
    });
});

}

// ===============================================
// 4. FUNCIONES DE MODO TEST
// ===============================================
function activarModoTest() {
    document.body.classList.add('modo-test');
    const botonTest = document.getElementById('btn-cargar-datos-test');
    if (botonTest) botonTest.style.display = 'inline-block';
    document.getElementById('test-mode-banner')?.classList.add('visible');
    Swal.fire({ icon: 'success', title: '¡Modo TEST activado!', timer: 1200, showConfirmButton: false });
}

function desactivarModoTest() {
    document.body.classList.remove('modo-test');
    const botonTest = document.getElementById('btn-cargar-datos-test');
    if (botonTest) botonTest.style.display = 'none';
    document.getElementById('test-mode-banner')?.classList.remove('visible');
    Swal.fire({ icon: 'info', title: 'Modo TEST desactivado', timer: 1200, showConfirmButton: false });
}


function setupSecretTap() {
    let testTapCount = 0;
    let tapTimer = null;
    const logo = document.querySelector('.app-title');

    function handleTap(e) {
        if (e) e.preventDefault();
        testTapCount++;
        if (testTapCount >= 5) {
            if (document.body.classList.contains('modo-test')) {
                desactivarModoTest();
            } else {
                activarModoTest();
            }
            testTapCount = 0;
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = null;
            return;
        }
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { testTapCount = 0; }, 2000);
    }

    if (logo) {
        logo.addEventListener('click', handleTap, { passive: false });
        logo.addEventListener('touchstart', handleTap, { passive: false });
        logo.addEventListener('touchend', e => e.preventDefault(), { passive: false });
    }
}


// ===============================================
// GESTIÓN DEL MODO OSCURO (FOOTER)
// ===============================================
function setupThemeToggle() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Aplicar tema inicial SIEMPRE con data-color-scheme
    document.documentElement.setAttribute('data-color-scheme', currentTheme);

    // Listener del header
    const headerBtn = document.getElementById('theme-toggle-header');
    if (headerBtn) {
        headerBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-color-scheme', current);
            localStorage.setItem(THEME_STORAGE_KEY, current);
        });
    }
}

function setupAutoSave() {
    // --- Restaurar datos al cargar la página ---
    const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const input = document.getElementById(key);
                // Restaura el valor si el input existe y el dato no es nulo/vacío
                if (input && data[key] !== null && data[key] !== '') {
                    input.value = data[key];
                }
            });
            calcularEdad(); // Vuelve a calcular la edad con las fechas restauradas
        } catch (e) {
            console.error('Error al parsear o restaurar los datos de la sesión.', e);
            sessionStorage.removeItem(SESSION_STORAGE_KEY); // Limpia datos corruptos
        }
    }

    // --- Guardar datos en cada cambio dentro del formulario ---
    const form = document.getElementById('clinicalForm');
    if (form) {
        form.addEventListener('input', () => {
            const data = getFormData(); // Usa la función existente para recoger datos numéricos
            
            // Añade manualmente los campos de texto largo que no están en getFormData
            data.sedimento_urinario = document.getElementById('sedimento_urinario')?.value || '';
            data.comentario_nutricional = document.getElementById('comentario_nutricional')?.value || '';
            data.serie_blanca = document.getElementById('serie_blanca')?.value || '';
            data.serie_plaquetaria = document.getElementById('serie_plaquetaria')?.value || '';
            data.coagulacion = document.getElementById('coagulacion')?.value || '';
            
            // 🛡️ Privacidad (RGPD/HIPAA): Bloqueo proactivo de datos identificativos futuros
            const SENSITIVE_FIELDS = ['nombre', 'paciente', 'apellidos', 'nhc', 'historia', 'dni', 'identificador'];
            SENSITIVE_FIELDS.forEach(field => delete data[field]);

            // Guarda todo en sessionStorage usando la constante
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        });
    }
}


// ===============================================
// 5. FUNCIONES DE UI, FECHAS Y EVENTOS
// ===============================================
function rellenarFechaHoy() {
    const hoy = new Date();
    const dia = hoy.getDate().toString().padStart(2, '0');
    const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const año = hoy.getFullYear();
    document.getElementById('fecha_analitica').value = `${dia}/${mes}/${año}`;
    calcularEdad();
}
function escapeHTML(str) {
if (!str) return '';
return String(str)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');
}

function calcularEdad() {
    const strNac  = document.getElementById('fecha_nacimiento').value;
    const strAnal = document.getElementById('fecha_analitica').value;
    if (!strNac || !strAnal) return;

    const nacimiento = parseFecha(strNac);
    const analitica  = parseFecha(strAnal);

    if (!nacimiento) { document.getElementById('edad_calculada').value = 'Fecha inexistente'; return; }
    if (!analitica)  { document.getElementById('edad_calculada').value = 'Fecha inexistente'; return; }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (nacimiento > hoy || analitica > hoy) {
        document.getElementById('edad_calculada').value = 'Fecha futura'; return;
    }
    if (nacimiento >= analitica) {
        document.getElementById('edad_calculada').value = 'Fechas inválidas'; return;
    }

    const [diaNac, mesNac]            = strNac.split('/').map(Number);
    const [diaAnal, mesAnal, añoAnal] = strAnal.split('/').map(Number);
    const añoNac = nacimiento.getFullYear();

    let años  = añoAnal - añoNac;
    let meses = mesAnal - mesNac;
    if (diaAnal < diaNac) meses--;
    if (meses < 0) { años--; meses += 12; }

    document.getElementById('edad_calculada').value = `${años} años ${meses} meses`;
    AppState.edadEnAños     = años;
    AppState.edadEnMeses    = meses;
    AppState.edadTotalMeses = años * 12 + meses;
}

function configurarEventosFechas() {
    ['fecha_nacimiento', 'fecha_analitica'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function(e) {
                let cursor = this.selectionStart;
                
                // Extraemos solo los números
                let numerico = this.value.replace(/[^0-9]/g, '').substring(0, 8);
                let nuevoTexto = '';
                
                // Construimos la fecha con las barras naturales
                for (let i = 0; i < numerico.length; i++) {
                    if (i === 2 || i === 4) {
                        nuevoTexto += '/';
                    }
                    nuevoTexto += numerico[i];
                }

                // Autocompletar barra al final SOLO si estamos escribiendo (no borrando)
                if (e.inputType && !e.inputType.includes('delete')) {
                    if (numerico.length === 2 || numerico.length === 4) {
                        nuevoTexto += '/';
                    }
                }
                
                this.value = nuevoTexto;
                
                // Ajustar el cursor inteligentemente para que no salte al final
                if (e.inputType && !e.inputType.includes('delete')) {
                    if (nuevoTexto.length === 3 || nuevoTexto.length === 6) {
                        if (cursor === 2 || cursor === 5) cursor++;
                    }
                }
                this.setSelectionRange(cursor, cursor);
                
                calcularEdad();
            });
        }
    });
}



function configureNumericValidation() {
    // Campos excluidos: fechas y ecografía tienen su propio manejo
    const NO_DECIMALES = ['fecha_nacimiento', 'fecha_analitica', 'rinon_izquierdo_mm', 'rinon_derecho_mm'];
    const camposDecimales = Object.values(TAB_FIELDS).flat()
        .filter(id => !NO_DECIMALES.includes(id));

    camposDecimales.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.type = 'text';
            input.setAttribute('inputmode', 'decimal');
            input.setAttribute('pattern', '[0-9.,\\-]*');
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\./g, ',');
                value = (fieldId === 'exceso_bases_mmol_l') ? value.replace(/[^0-9,-]/g, '') : value.replace(/[^0-9,]/g, '');

                const parts = value.split(',');
                if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
                if (parts.length === 2 && parts[1].length > 2) value = parts[0] + ',' + parts[1].substring(0, 2);

                if (fieldId !== 'exceso_bases_mmol_l' && value.includes('-')) value = value.replace('-', '');

                e.target.value = value;
            });
            input.addEventListener('blur', function(e) {
                let value = e.target.value;
                if (value) {
                    const numValue = parseFloat(value.replace(',', '.'));
                    if (isNaN(numValue)) e.target.value = '';
                }
            });
        }
    });
}

function verifyFieldsExist() {
    if (location.hostname !== 'localhost') return;
    let missingFields = [];
    fieldIds.forEach(fieldId => { if (!document.getElementById(fieldId)) missingFields.push(fieldId); });
    if (missingFields.length > 0) console.error('❌ Campos faltantes:', missingFields);
}

function setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach((btn, i, allBtns) => {
        btn.addEventListener('click', function() { 
            // 1. Cambiamos de pestaña
            switchTab(this.getAttribute('data-tab'), this); 
            
            // 2. Comprobamos si necesitamos hacer scroll (para móviles)
            const container = btn.closest('.tabs') || btn.closest('.nav-tabs');
            if (container && (container.scrollWidth > container.clientWidth)) {
                const btnRect = btn.getBoundingClientRect();
                const contRect = container.getBoundingClientRect();
                if ((btnRect.right >= contRect.right - 8) && (i < allBtns.length - 1)) {
                    container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
                }
                if ((btnRect.left <= contRect.left + 8) && (i > 0)) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                }
            }
        });

        // Evento para accesibilidad por teclado (Flechas) según WCAG
        btn.addEventListener('keydown', function(e) {
            let nextIndex = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                nextIndex = (i + 1) % allBtns.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                nextIndex = (i - 1 + allBtns.length) % allBtns.length;
            }
            if (nextIndex !== null) {
                e.preventDefault();
                allBtns[nextIndex].focus();
                allBtns[nextIndex].click();
            }
        });
    });
}

function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    // Apagamos todas las pestañas visualmente y para los lectores de pantalla
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false'); // NUEVO: Apagar ARIA
        btn.setAttribute('tabindex', '-1'); // NUEVO: Roving tabindex (inactivas)
    });
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    // Encendemos la pestaña clickeada visualmente y para los lectores de pantalla
    if (buttonElement) {
        buttonElement.classList.add('active');
        buttonElement.setAttribute('aria-selected', 'true'); // NUEVO: Encender ARIA
        buttonElement.setAttribute('tabindex', '0'); // NUEVO: Roving tabindex (activa)
    }
}

function actualizarMarcadoresEnTiempoReal() {
    if (!AppState.primeraValidacion) return;

    Object.keys(TAB_FIELDS).forEach(tabId => {
        let tieneError = false;
        TAB_FIELDS[tabId].forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo && !campo.disabled) {
                if (!campo.value || campo.value.trim() === '') {
                    tieneError = true;
                    campo.classList.add('campo-error');
                } else {
                    campo.classList.remove('campo-error');
                }
            } else if (campo && campo.disabled) {
                campo.classList.remove('campo-error');
            }
        });
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.toggle('tab-error', tieneError);
    });
}

function setupFormEvents() {
    camposParaContador.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', (e) => { 
                updateFieldCounter(); 
                
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    actualizarMarcadoresEnTiempoReal();
                }, 300);
                
                if(e.target.value.trim() !== '') {
                    e.target.classList.add('campo-valido');
                    e.target.classList.remove('campo-error');
                } else {
                    e.target.classList.remove('campo-valido');
                }
            });
            input.addEventListener('change', () => { updateFieldCounter(); actualizarMarcadoresEnTiempoReal(); });
        }
    });
}

function setupButtons() {
    const calculateButton = document.getElementById('calculateButton');
    if (calculateButton) calculateButton.addEventListener('click', () => { AppState.primeraValidacion = true; actualizarMarcadoresEnTiempoReal(); calculateResults(); });
    
    const copyClipboardButton = document.getElementById('copyClipboardButton');
    if (copyClipboardButton) copyClipboardButton.addEventListener('click', copyToClipboard);

    const exportWordButton = document.getElementById('exportWordButton');
    if (exportWordButton) exportWordButton.addEventListener('click', exportToWord);
    
    const exportPDFButton = document.getElementById('exportPDFButton');
    if (exportPDFButton) exportPDFButton.addEventListener('click', () => exportToPDF(AppState, getFormData()));
    
    const printButton = document.getElementById('printButton');
    if (printButton) printButton.addEventListener('click', printReport);

    const btnHoy = document.getElementById('btn-hoy');
    if (btnHoy) btnHoy.addEventListener('click', rellenarFechaHoy);
    
    const btnLimpiar = document.getElementById('btn-limpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', confirmarLimpiarFormulario);
    
    const btnTest = document.getElementById('btn-cargar-datos-test');
    if (btnTest) btnTest.addEventListener('click', loadSampleData);

    const btnAcercaDe = document.getElementById('btn-acerca-de');
    if (btnAcercaDe) {
        btnAcercaDe.addEventListener('click', () => {
            Swal.fire({
                title: '<strong>Acerca de NefroPed</strong>',
                icon: 'info',
                html: `
                    <p style="text-align:left; font-size:14px; line-height:1.7; color:var(--color-text-secondary)">
                        <strong style="color:var(--color-primary)">NefroPed</strong> nace de la necesidad clínica 
                        de agilizar y estandarizar los cálculos nefrológicos en la práctica pediátrica diaria, 
                        poniendo a disposición del profesional sanitario fórmulas validadas y valores de referencia 
                        actualizados en una herramienta accesible y segura.
                    </p>
                    <hr style="border-color:var(--color-border); margin:12px 0">
                    <p style="text-align:left; font-size:13px; line-height:1.8">
                        <i class="fas fa-stethoscope" style="color:var(--color-primary)"></i>
                        <strong> Idea y validación médica</strong><br>
                        Dra. Ana María Ortega Morales<br>
                        <span style="color:var(--color-text-secondary)">FEA Pediatría · Hospital Universitario San Cecilio (HUSC), Granada</span>
                    </p>
                    <p style="text-align:left; font-size:13px; line-height:1.8; margin-top:8px">
                        <i class="fas fa-code" style="color:var(--color-primary)"></i>
                        <strong> Desarrollo y arquitectura de software</strong><br>
                        Felipe Reyes
                    </p>
                    <hr style="border-color:var(--color-border); margin:12px 0">
                    <p style="text-align:center; font-size:11px; color:var(--color-text-secondary)">
                        v1.0 · 2026 · Uso exclusivo para profesionales sanitarios
                    </p>
                `,
                confirmButtonText: 'Cerrar',
                confirmButtonColor: 'var(--color-primary)',
                showCloseButton: true,
            });
        });
    }
}

function confirmarLimpiarFormulario() {
    Swal.fire({
        icon: 'question', title: '¿Borrar todos los campos?', text: 'Se borrarán todos los datos introducidos y no se podrá deshacer.',
        showCancelButton: true, confirmButtonText: 'Sí, borrar todo', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', backdrop: true, allowOutsideClick: false
    }).then(result => { if (result.isConfirmed) clearFormSilent(); });
}

function clearFormSilent() {
    fieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });

    ['sedimento_urinario', 'comentario_nutricional', 'serie_blanca', 'serie_plaquetaria', 'coagulacion', 'edad_calculada'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    limpiarColoresValidacion();
    
    document.getElementById('results')?.classList.remove('hidden');
    document.getElementById('reportSection')?.classList.add('hidden');
    
    const resultsGrid = document.getElementById('resultsGrid'); 
    if(resultsGrid) {
        resultsGrid.innerHTML = '';
        resultsGrid.classList.add('hidden'); 
    }
    
    const emptyState = document.getElementById('empty-state-results');
    if(emptyState) emptyState.classList.remove('hidden'); 
    
    const reportContent = document.getElementById('reportContent'); 
    if(reportContent) reportContent.textContent = '';
     
    AppState.calculatedResults = {}; 
    AppState.primeraValidacion = false;
    AppState.reportPlainText = '';
    AppState.ecografiaReportText = '';
    
    document.querySelectorAll('.tab-error').forEach(tab => tab.classList.remove('tab-error'));
    
    updateFieldCounter();
    switchTab('datos-basicos', document.querySelector('[data-tab="datos-basicos"]'));
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function loadSampleData() {
    // 1. Fechas dinámicas (Paciente siempre tiene 12 años exactos hoy)
    const hoy = new Date();
    const diaHoy = hoy.getDate().toString().padStart(2, '0');
    const mesHoy = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const anioHoy = hoy.getFullYear();
    const anioNac = anioHoy - 12;

    const sampleData = {
        fecha_nacimiento: `${diaHoy}/${mesHoy}/${anioNac}`, 
        fecha_analitica: `${diaHoy}/${mesHoy}/${anioHoy}`, 
        peso_kg: 35.5, talla_cm: 140.0, sexo: 'M',
        urea_mg_dl: 28, creatinina_enz_mg_dl: 0.65, au_plasma_mg_dl: 4.2, na_plasma_meq_l: 138.5, k_plasma_meq_l: 4.1, cl_plasma_meq_l: 105.2, fosfatasa_alcalina_u_l: 180, ca_plasma_mg_dl: 9.8, p_plasma_mg_dl: 4.5, mg_plasma_mg_dl: 1.9, pth_pg_ml: 35.2, vitamina_d_ng_ml: 28.5, comentario_nutricional: "Paciente normopeso. Dieta equilibrada con buena tolerancia oral. Sin incidencias", cistatina_c_mg_l: 0.92,
        ph_plasma: 7.38, pco2_mmhg: 42.1, hco3_mmol_l: 22.8, exceso_bases_mmol_l: -1.2,
        densidad: 1018, ph_orina: 6.2, sedimento_urinario: "Hematíes 3-5/campo. Leucocitos aislados. Ausencia de cilindros.", au_orina_mg_dl: 45.8, na_orina_meq_l: 85.2, k_orina_meq_l: 55.1, cl_orina_meq_l: 98.5, osmolalidad_orina_mosm_kg: 320, ca_orina_mg_dl: 12.5, fosforo_orina_mg_dl: 18.2, magnesio_orina_mg_dl: 8.5, albumina_orina_mg_dl: 3.2, creatinina_orina_mg_dl: 68.5, proteinas_orina_mg_dl: 8.1, citrato_orina_mg_dl: 85.2, oxalato_orina_mg_dl: 15.8,
        au_24h_mg: 420, ca_24h_mg: 85, p_24h_mg: 520, mg_24h_mg: 65, albumina_24h_mg: 25, proteinas_24h_mg: 95, citrato_24h_mg: 485, oxalato_24h_mg: 28,
        hb_g_l: 125, ferritina_ng_ml: 45.8, ist_percent: 22.5,serie_blanca: 'Leucocitos 6.200/µL. Fórmula normal. Sin blastos ni atipias.',
        serie_plaquetaria: 'Plaquetas 285.000/µL. Morfología normal.',
        coagulacion: 'TP 12.1s (100%). TTPA 31.2s. Fibrinógeno 2.8 g/L.',
        rinon_izquierdo_mm: 98, rinon_derecho_mm: 95 
    };
    
    // Desmarcar monoreno al cargar los datos de test
    const checkMonoreno = document.getElementById('check_monoreno');
    if (checkMonoreno) {
        checkMonoreno.checked = false;
        toggleMonoreno(false);
    }
    
    Object.keys(sampleData).forEach(key => {
        const input = document.getElementById(key);
        if (input) { 
            input.value = sampleData[key]; 
            input.classList.add('campo-valido'); 
        }
    });
    
    document.getElementById('fecha_nacimiento').dispatchEvent(new Event('input'));
    updateFieldCounter();
    actualizarMarcadoresEnTiempoReal();
    
    Swal.fire({
        icon: 'success', title: 'Datos cargados',
        text: 'Se han cargado datos ficticios de prueba para todas las fórmulas.',
        timer: 1500, showConfirmButton: false
    });
}

function marcarError(campoId, tieneError) {
    const campo = document.getElementById(campoId);
    if (campo) campo.classList.toggle('campo-error', tieneError);
}

function validarTodosCampos() {
    let camposVacios = [];
    AppState.primeraValidacion = true; // Activa el chequeo "en directo"
    
    fieldIds.forEach(campoId => {
        const campo = document.getElementById(campoId);
        // Omitir validación de campos bloqueados
        if (campo && campo.disabled) {
            marcarError(campoId, false);
        } else if (!campo || !campo.value || campo.value.trim() === '') { 
            camposVacios.push(campoId); 
            marcarError(campoId, true); 
        } else { 
            marcarError(campoId, false); 
        }
    });
    
    // Dispara el pintado rojo de las pestañas
    actualizarMarcadoresEnTiempoReal();
    
    return camposVacios; // Devolvemos la lista para la alerta
}

function updateFieldCounter() {
    const filledCount = camposParaContador.filter(id => document.getElementById(id)?.value.trim() !== '').length;
    const counter = document.getElementById('fieldCount');
    if (counter) {
        counter.textContent = `${filledCount}/${camposParaContador.length}`;
        
        // Magia UX: Si hay 1 o más campos, quitamos la clase hidden. Si está en 0, la ponemos.
        if (filledCount > 0) {
            counter.classList.remove('hidden');
        } else {
            counter.classList.add('hidden');
        }
    }
}

// ===============================================
// 6. LÓGICA DE CÁLCULO Y EVALUACIÓN
// ===============================================

function getFormData() {
    const data = {};
    fieldIds.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            let value = input.value;
            if (['fecha_nacimiento', 'fecha_analitica', 'sexo'].includes(fieldId)) { data[fieldId] = value; return; }
            if (value) value = value.replace(/,/g, '.'); // ✅ flag global: reemplaza todas las comas
            const numValue = parseFloat(value);
            data[fieldId] = isNaN(numValue) ? 0 : numValue;
        }
    });
    data.edad = AppState.edadEnAños || 0;
    return data;
}


function calculateResults() {
    // 1. Comprobación de seguridad: Si todo está vacío, no hacemos absolutamente nada.
    const camposLlenos = camposParaContador.filter(id => document.getElementById(id)?.value.trim() !== '').length;
    const ecoIzq = document.getElementById('rinon_izquierdo_mm')?.value.trim();
    const ecoDer = document.getElementById('rinon_derecho_mm')?.value.trim();
    
    if (camposLlenos === 0 && !ecoIzq && !ecoDer) {
        return; // Fin de la función, la página no se altera
    }

    // 2. BLINDAJE DE FECHAS
    const strNac  = document.getElementById('fecha_nacimiento')?.value;
    const strAnal = document.getElementById('fecha_analitica')?.value;

    if (strNac && strAnal) {
        const fechaNacimiento = parseFecha(strNac);
        const fechaAnalitica  = parseFecha(strAnal);

        if (!fechaNacimiento || !fechaAnalitica) {
            Swal.fire({ icon: 'error', title: 'Fecha inexistente',
                text: 'Has introducido una fecha que no existe en el calendario (revisa los días 31 y los años bisiestos).',
                confirmButtonColor: '#ef4444' });
            return;
        }
        if (fechaAnalitica < fechaNacimiento) {
            Swal.fire({ icon: 'error', title: 'Fechas incongruentes',
                text: 'La fecha de la analítica no puede ser anterior a la fecha de nacimiento.',
                confirmButtonColor: '#ef4444' });
            return;
        }
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        if (fechaNacimiento > hoy || fechaAnalitica > hoy) {
            Swal.fire({ icon: 'error', title: 'Fechas incongruentes',
                text: 'Las fechas no pueden ser posteriores a hoy.',
                confirmButtonColor: '#ef4444' });
            return;
        }
    }
    // 3. Si hay datos y las fechas tienen sentido lógico, validamos qué falta
    const camposVacios = validarTodosCampos();

    // Si faltan datos, lanzamos la alerta interactiva
    if (camposVacios.length > 0) {
        let listaHTML = '<ul style="text-align: left; max-height: 180px; overflow-y: auto; margin-top: 15px; margin-bottom: 15px; font-size: 14px; color: var(--color-text-secondary); background: var(--color-bg-1); padding: 15px 15px 15px 35px; border-radius: 8px;">';
        
        camposVacios.forEach(id => {
            const label = document.querySelector(`label[for="${id}"]`);
            const nombreCampo = label ? label.textContent.split(' (')[0] : id;
            listaHTML += `<li style="margin-bottom: 5px;"><strong>${nombreCampo}</strong></li>`;
        });
        listaHTML += '</ul>';

        Swal.fire({
            icon: 'warning',
            title: 'Faltan datos por rellenar',
            html: `Se han detectado campos en blanco que limitarán los cálculos:<br>${listaHTML}¿Desea continuar y calcular lo que sea posible con los datos actuales?`,
            showCancelButton: true,
            confirmButtonColor: '#0891b2', 
            cancelButtonColor: '#ef4444', 
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'No, rellenar antes',
            reverseButtons: true 
        }).then((result) => {
            if (result.isConfirmed) {
                executeCalculations();
            }
        });
    } else {
        // Si no falta nada, calculamos directamente
        executeCalculations();
    }
}

// =========================================================
// EL MATEMÁTICO: Función "pura" con las nuevas fórmulas eFG integradas
// =========================================================

// =========================================================
// EL PINTOR (ORQUESTADOR): Interfaz de Usuario
// =========================================================
function executeCalculations() {
    const data = getFormData();
    AppState.valoresFueraRango = [];

    const calcButton = document.querySelector('.btn-calcular');
    
    calcButton.classList.add('loading');
    calcButton.innerHTML = 'Calculando... <i class="fas fa-spinner fa-spin" style="margin-left: 8px;"></i>';

    try {
            AppState.calculatedResults = performMedicalCalculations(data, AppState.edadEnAños, AppState.edadEnMeses);

        setTimeout(() => {
            displayResults();
            setTimeout(() => { generateReport(data); }, 100);
            
            calcButton.classList.remove('loading');
            calcButton.innerHTML = 'Calcular Resultados <i class="fas fa-calculator" style="margin-left: 8px;"></i>';
        }, 800);

    } catch (error) {
        console.error('Error en los cálculos:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Se produjo un error al realizar los cálculos.', confirmButtonColor: '#dc3545' });
        
        calcButton.classList.remove('loading'); 
        calcButton.innerHTML = 'Calcular Resultados <i class="fas fa-calculator" style="margin-left: 8px;"></i>';
    }
}

function displayResults() {
    const results = AppState.calculatedResults;
    if (!results) return;
    const edad = AppState.edadEnAños || 0;
    const edadMeses = AppState.edadEnMeses || 0;

 
    
    const resultsGrid = document.getElementById('resultsGrid');
    resultsGrid.innerHTML = '';
    resultsGrid.className = ''; 
    resultsGrid.classList.remove('hidden');
    
    const emptyState = document.getElementById('empty-state-results');
    if(emptyState) emptyState.classList.add('hidden');
 
    AppState.valoresFueraRango = []; 
    

   Object.entries(PARAMETROS).forEach(([key, param]) => {
    const valor = results[key];
    if (valor && valor !== 0) {
        const evaluacion = evaluarRango(key, valor, edad, edadMeses);
        if (!evaluacion.enRango) {
            const tipoFuera = evaluacion.tipo === 'alto' ? 'por encima de rango' : 'por debajo de rango';
            AppState.valoresFueraRango.push(
    `${param.label}${param.unit ? ` (${param.unit})` : ''}: ${valor.toFixed(2)}${param.unit || ''} ${tipoFuera} (VN ${evaluacion.rangoTexto})`);

        }
    }
});

    
    let htmlFinal = "";

    SECCIONES.forEach(cat => {
    let itemsHTML = '';
    cat.keys.forEach(key => {
        const valor = results[key];
        if (valor && valor !== 0) {
            const p = PARAMETROS[key];
            const label = p ? `${p.label}${p.unit ? ' (' + p.unit + ')' : ''}` : key;

                const numValue = typeof valor === 'number' ? valor.toFixed(2) : '0.00';
                
                let colorStyle = 'color: var(--color-primary) !important; font-weight: bold;';
                if (key !== "superficiecorporal" && key !== "imc") {
                    const evaluacion = evaluarRango(key, valor, edad, edadMeses);
                    if (!evaluacion.enRango) {
                        colorStyle = 'color: #dc2626 !important; font-weight: bold;';
                    }
                }
                
                itemsHTML += `
                    <div class="result-item" id="resultado-${key}">
                        <div class="result-label">${label}</div>
                        <div class="result-value" style="${colorStyle}">${numValue}</div>
                    </div>`;
            }
        });
        
        if (itemsHTML !== "") {
            htmlFinal += `
                <div style="margin-top: 24px;">
                    <h4 style="margin-bottom: 12px; color: var(--color-primary); border-bottom: 2px solid var(--color-bg-1); padding-bottom: 6px; font-size: 15px; font-weight: 600;">
                        ${cat.titulo}
                    </h4>
                    <div class="results-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                        ${itemsHTML}
                    </div>
                </div>
            `;
        }
    });

    let tarjetaEcografia = generarResultadoEcografia();
    if (tarjetaEcografia !== "") {
        htmlFinal += `
            <div style="margin-top: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--color-primary); border-bottom: 2px solid var(--color-bg-1); padding-bottom: 6px; font-size: 15px; font-weight: 600;">
                    Ecografía Renal
                </h4>
                <div class="results-grid" style="display: grid; grid-template-columns: 1fr; gap: 16px;">
                    ${tarjetaEcografia}
                </div>
            </div>
        `;
    }

    resultsGrid.innerHTML = DOMPurify.sanitize(htmlFinal);
    document.getElementById('results').classList.remove('hidden');
}

function generateReport(data) {
    const results = AppState.calculatedResults;
    if (!results || Object.keys(results).length === 0) return;

    function isValid(value) { return value != null && !isNaN(value) && value !== 0; }
    function fmt(value, decimals = 2) { return !isValid(value) ? null : parseFloat(value).toFixed(decimals); }
    function fmtParam(key, value, decimals = 2) {
        if (!isValid(value)) return null;
        const p = PARAMETROS[key];
        return `${p?.label ?? key}: ${fmt(value, decimals)}${p?.unit ?? ''}`;
    }

    let report = [];

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
    const serieBlanca      = escapeHTML(document.getElementById('serie_blanca')?.value.trim() ?? '');
    const seriePlaquetaria = escapeHTML(document.getElementById('serie_plaquetaria')?.value.trim() ?? '');
    const coagulacion      = escapeHTML(document.getElementById('coagulacion')?.value.trim() ?? '');
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
    const sedimentoUrinario    = escapeHTML(document.getElementById('sedimento_urinario')?.value.trim() ?? '');
    const comentarioNutricional = escapeHTML(document.getElementById('comentario_nutricional')?.value.trim() ?? '');
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
        report.push("1) Analítica");
        if (hidrosalino.length > 0)  report.push(`Hidrosalino: ${hidrosalino.join(' | ')}`);
        if (fosfocalcico.length > 0) report.push(`Metabolismo fosfocálcico: ${fosfocalcico.join(' | ')}`);
        if (hematologico.length > 0) report.push(`Hematológico: ${hematologico.join(' | ')}`);
        if (gasometria.length > 0)   report.push(`Gasometría: ${gasometria.join(' | ')}`);
        if (orina.length > 0)        report.push(`Orina puntual: ${orina.join(' | ')}`);
        if (orina24h.length > 0)     report.push(`Orina de 24h: ${orina24h.join(' | ')}`);
        if (comentarioNutricional)   report.push(`Otros: ${comentarioNutricional}`);
    }
    if (AppState.ecografiaReportText) {
        report.push(`\n2) Ecografía Renal`);
        report.push(AppState.ecografiaReportText.replace(/^-/, '').trim());
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
            htmlEstadificacion = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">Estadificación según guías KDIGO 2024</h4><ul style="margin-top: 0; padding-left: 20px;">`;
            grados_kdigo.forEach(g => {
                let part = g.replace('- ', '').split(': ');
                htmlEstadificacion += `<li style="margin-bottom: 4px;"><strong>${part[0]}:</strong> ${part.slice(1).join(': ')}</li>`;
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
            htmlEstadificacion = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">Estadificación ERC (Ajustada a &lt; 2 años)</h4><ul style="margin-top: 0; padding-left: 20px;">`;
            grados_lactante.forEach(g => {
                let part = g.replace('- ', '').split(': ');
                htmlEstadificacion += `<li style="margin-bottom: 4px;"><strong>${part[0]}:</strong> ${part.slice(1).join(': ')}</li>`;
            });
            htmlEstadificacion += `</ul>`;
        }
    }

    let htmlFueraRango = "";
    if (AppState.valoresFueraRango && AppState.valoresFueraRango.length > 0) {
        report.push('\n\nVALORES FUERA DE RANGO\n');
        AppState.valoresFueraRango.map(v => `-${v}`).forEach(v => report.push(v));
        htmlFueraRango = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">⚠️ Valores fuera de rango</h4><ul style="margin-top: 0; padding-left: 20px;">`;
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
    if (hayDatosAnalitica) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1) Analítica</h4>`;
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
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 15px;">2) Ecografía Renal</h4>`;
        html += `<p style="margin-top: 0; padding-left: 20px;">${escapeHTML(AppState.ecografiaReportText.replace(/^-/, '').trim()).replace('Longitud renal ecográfica: ', '<strong>Longitud renal ecográfica:</strong> ')}</p>`;
    }
    html += htmlEstadificacion;
    html += htmlFueraRango;
    html += `</div>`;

    const reportContentDiv = document.getElementById('reportContent');
    reportContentDiv.innerHTML = DOMPurify.sanitize(html);
    document.getElementById('reportSection').classList.remove('hidden');
    setTimeout(() => { document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
}

// ===============================================
// 7. FUNCIONES DE EXPORTACIÓN Y COPIADO genera HTML estructurado del informe
// Usada por exportToWord, printReport (y podría usarse en PDF)
// ===============================================

function buildReportHTML() {
    const rawData = typeof getFormData === 'function' ? getFormData() : {};
    const R     = Object.assign({}, rawData, AppState.calculatedResults);
    const edad  = AppState.edadEnAños  || 0;
    const edadM = AppState.edadEnMeses || 0;
    const get   = id => document.getElementById(id)?.value || '—';
    const sexoStr = get('sexo') === 'M' ? 'Masculino' : (get('sexo') === 'F' ? 'Femenino' : '—');

    let html = '';

    // ── Cabecera ──────────────────────────────────────
    html += `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#0891b2;padding:12px 16px;">
          <span style="color:#fff;font-size:17px;font-weight:bold;font-family:Arial,sans-serif;">NefroPed</span>
          <span style="color:#e0f7fa;font-size:11px;font-family:Arial,sans-serif;margin-left:10px;">Informe de Pruebas Complementarias Pediátricas</span>
        </td>
        <td style="background:#0891b2;padding:12px 16px;text-align:right;white-space:nowrap;">
          <span style="color:#fff;font-size:11px;font-family:Arial,sans-serif;">${new Date().toLocaleDateString('es-ES')}</span>
        </td>
      </tr>
    </table>`;

    // ── Datos paciente ────────────────────────────────
    html += `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-collapse:collapse;border:1px solid #e2e8f0;background:#f8fafc;">
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
    </table>`;

    // Función auxiliar para dibujar tablas
    const drawTable = (sec) => {
        if (!sec) return '';
        
        let extraRows = [];
        const tituloLower = sec.titulo.toLowerCase();
        
        if (tituloLower.includes('hematolog')) { 
            const serieBlanca = document.getElementById('serie_blanca')?.value?.trim();
            const seriePlaquetaria = document.getElementById('serie_plaquetaria')?.value?.trim();
            const coagulacion = document.getElementById('coagulacion')?.value?.trim();
            if (serieBlanca)      extraRows.push({ label: 'Serie blanca',      value: serieBlanca });
            if (seriePlaquetaria) extraRows.push({ label: 'Serie plaquetaria', value: seriePlaquetaria });
            if (coagulacion)      extraRows.push({ label: 'Coagulación',       value: coagulacion });
        }
        if (tituloLower.includes('orina puntual')) { 
            const sedimento = document.getElementById('sedimento_urinario')?.value?.trim();
            if (sedimento) extraRows.push({ label: 'Sedimento', value: sedimento });
        }

        const filas = sec.keys.filter(k => R[k] !== undefined && R[k] !== null && R[k] !== 0 && !isNaN(R[k]) && R[k] !== '');
        if (!filas.length && !extraRows.length) return '';

        let t = `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td colspan="3" style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${sec.titulo}</span>
            </td>
          </tr>
          <tr style="background:#e2e8f0;">
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:40%;">PARÁMETRO</td>
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:30%;">VALOR</td>
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:30%;">RANGO NORMAL</td>
          </tr>`;

        let i = 0;
        filas.forEach((key) => {
            const val = R[key];
            const ev  = (key !== 'superficiecorporal' && key !== 'imc')
                        ? evaluarRango(key, val, edad, edadM)
                        : { enRango: true, rangoTexto: '' };

            const p = PARAMETROS[key];
            let valorTexto = parseFloat(val).toFixed(2);
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

        // Filas extra, alineadas perfectamente con la columna valor y SIN negrita
        extraRows.forEach(row => {
            const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
            t += `
          <tr style="background:${bg};">
            <td style="padding:5px 10px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${escapeHTML(row.label)}</td>
            <td colspan="2" style="padding:5px 10px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;">${escapeHTML(row.value)}</td>
          </tr>`;
            i++;
        });

        t += `</table>`;
        return t;
    };

    const drawTextBlock = (titulo, texto) => {
        let textValue = (texto && typeof texto === 'string') ? texto.trim() : '';
        if (!textValue || textValue === '—') return '';
        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${titulo}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;line-height:1.6;border:1px solid #e2e8f0;border-top:none;white-space:pre-wrap;">${escapeHTML(textValue)}</td>
          </tr>
        </table>`;
    };

    SECCIONES.forEach(sec => { html += drawTable(sec); });
    
    // OTROS como bloque de texto limpio
    html += drawTextBlock('Otros', get('comentario_nutricional'));
    
    if (AppState.ecografiaReportText) {
        html += drawTextBlock('Ecografía renal', AppState.ecografiaReportText.replace(/^-/, '').trim());
    }

    if (AppState.valoresFueraRango?.length > 0) {
        const items = AppState.valoresFueraRango
            .map(v => `<li style="margin-bottom:3px;">${v.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('');
        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td style="background:#fee2e2;border:2px solid #dc2626;padding:12px 16px;">
              <div style="font-size:12px;font-weight:bold;color:#dc2626;font-family:Arial,sans-serif;margin-bottom:6px;">VALORES FUERA DE RANGO</div>
              <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;font-family:Arial,sans-serif;">${items}</ul>
            </td>
          </tr>
        </table>`;
    }

    if (AppState.estadificacionKDIGO) {
        const items = AppState.estadificacionKDIGO.items.map(v => {
            const parts = v.split(':');
            return `<li style="margin-bottom:3px;"><strong>${parts[0]}:</strong> ${parts.slice(1).join(':')}</li>`;
        }).join('');
        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td style="background:#f0f9ff;border:2px solid #0891b2;padding:12px 16px;">
              <div style="font-size:12px;font-weight:bold;color:#0891b2;font-family:Arial,sans-serif;margin-bottom:6px;">${AppState.estadificacionKDIGO.titulo}</div>
              <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;font-family:Arial,sans-serif;">${items}</ul>
            </td>
          </tr>
        </table>`;
    }

    html += `
    <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;font-family:Arial,sans-serif;text-align:center;">
        NefroPed — Calculadora de Función Renal Pediátrica
    </div>`;

    return html;
}

// ══════════════════════════════════════════════════════
// EXPORTAR A WORD
// ══════════════════════════════════════════════════════
function exportToWord() {
    if (!AppState.calculatedResults || Object.keys(AppState.calculatedResults).length === 0) {
        return Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.' });
    }
    try {
        const body = buildReportHTML();
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
                </style>
            </head>
            <body>${body}</body>
        </html>`;
        const blob = new Blob(['\ufeff', fullHTML], { type: 'application/msword' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'informe-nefroped.doc';
        link.click(); URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'Word descargado', timer: 2000, showConfirmButton: false });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error exportando.' });
    }
}

function printReport() {
    if (!AppState.reportPlainText) {
        Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Primero calcula los resultados.' });
        return;
    }
    const body = buildReportHTML();

    // ✅ Sin document.write — CodeQL no puede rastrear DOM→HTML
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>NefroPed — Informe</title>
        <style>
            @page { margin: 15mm; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            table { border-collapse: collapse; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
    </head><body>${body}</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    setTimeout(() => {
        pw.print();
        URL.revokeObjectURL(url); // limpia la URL temporal
    }, 400);
}

function copyToClipboard() {
    // A la hora de copiar, NO copiamos la pantalla, copiamos la variable secreta en Texto Plano
    if (!AppState.reportPlainText) {
        return Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.'});
    }
    
    navigator.clipboard.writeText(AppState.reportPlainText).then(() => {
        Swal.fire({
            icon: 'success', title: '¡Texto copiado!', text: 'Formato texto plano listo para pegar en la Historia Clínica (Ctrl+V).',
            timer: 2000, showConfirmButton: false
        });
    }).catch(err => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar automáticamente.' });
    });
}
// ===============================================
// 8. LÓGICA DE INSTALACIÓN PWA (Android, PC y Apple)
// ===============================================
let deferredPrompt;

const isIOS = () => {
    return [
      'iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'
    ].includes(navigator.platform)
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn && !isIOS()) {
        installBtn.classList.remove('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('btn-install-pwa');
    if (!installBtn) return;

    if (isIOS()) {
        // Detectar si el iPhone ya lo está ejecutando como App (Standalone)
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        // Si NO estamos dentro de la app instalada, mostramos el botón
        if (!isStandalone) {
            installBtn.classList.remove('hidden');
        }
    }

    installBtn.addEventListener('click', async () => {
        if (isIOS()) {
            Swal.fire({
                title: 'Instalar en iPhone',
                html: '<div style="font-size: 15px; text-align: left; line-height: 1.6;">Para añadir esta calculadora a tu móvil:<br><br><b>1.</b> Toca el botón <b>Compartir</b> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin: 0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> en la barra inferior de Safari.<br><b>2.</b> Selecciona <b>"Añadir a la pantalla de inicio"</b> <i class="fas fa-plus-square" style="font-size: 18px; color: #0891b2; vertical-align: text-bottom; margin: 0 2px;"></i>.</div>',                confirmButtonColor: '#0891b2',
                background: document.documentElement.getAttribute('data-color-scheme') === 'dark' ? '#1e293b' : '#fff',
                color: document.documentElement.getAttribute('data-color-scheme') === 'dark' ? '#f1f5f9' : '#0f172a'
            });
        } else if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
            }
        }
    });
});

window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.classList.add('hidden');
});
// ===============================================
// 9. TRUCO NINJA BLINDADO: UNIDADES UX NATIVA
// ===============================================
function inyectarUnidadesEnInputs() {
    document.querySelectorAll('.form-label').forEach(label => {
        label.style.userSelect = 'none';
        label.style.cursor = 'default';

        for (let i = 0; i < label.childNodes.length; i++) {
            const node = label.childNodes[i];
            if (node.nodeType === 3) {
                const match = node.nodeValue.match(/\((.+?)\)\s*$/);
                if (match) {
                    const unidad = match[1].trim();
                    const inputId = label.getAttribute('for');
                    if (!inputId || inputId === 'edad_calculada') continue;

                    const input = document.getElementById(inputId);
                    if (!input) continue;

                    // ✅ Usamos clase CSS en vez de style.*
                    const wrapper = document.createElement('div');
                    wrapper.className = 'input-unit-wrapper';
                    if (unidad.length > 9) wrapper.classList.add('unit-long');

                    wrapper.addEventListener('click', () => input.focus());
                    input.parentNode.insertBefore(wrapper, input);
                    wrapper.appendChild(input);

                    // ✅ Quitamos todos los style.* del input
                    input.style.width = '';
                    input.style.flex = '';
                    input.style.paddingRight = '';
                    input.style.boxSizing = '';

                    // ✅ El span de unidad también usa clase CSS
                    const unitSpan = document.createElement('span');
                    unitSpan.className = 'unit-label';
                    unitSpan.textContent = unidad;
                    wrapper.appendChild(unitSpan);
                    break;
                }
            }
        }
    });
}

// ==========================================
// FUNCIÓN AUXILIAR: LIMPIEZA DE COLORES
// ==========================================
function limpiarColoresValidacion() {
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('campo-valido', 'campo-error');
    });

}
// ==========================================
// CONTROL DE UI: ECOGRAFÍA Y MONORENO
// ==========================================
function toggleMonoreno(isMonoreno) {
    const opcionesDiv = document.getElementById('opciones_monoreno');
    
    if (isMonoreno) {
        opcionesDiv.style.display = 'flex';
        const seleccionado = document.querySelector('input[name="radio_rinon_unico"]:checked').value;
        seleccionarRinonUnico(seleccionado);
    } else {
        opcionesDiv.style.display = 'none';
        reactivarCaja('rinon_izquierdo_mm');
        reactivarCaja('rinon_derecho_mm');
    }
}

function seleccionarRinonUnico(lateralidadPresente) {
    if (lateralidadPresente === 'izquierdo') {
        reactivarCaja('rinon_izquierdo_mm');
        bloquearCaja('rinon_derecho_mm');
    } else {
        reactivarCaja('rinon_derecho_mm');
        bloquearCaja('rinon_izquierdo_mm');
    }
}

function bloquearCaja(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = ''; // Limpiamos el valor para que no contamine
    input.disabled = true;
    
    // Quitamos los estilos manuales antiguos por si se habían quedado
    input.style.opacity = ''; 
    input.style.cursor = '';
    
    // Le aplicamos el diseño oficial de "Edad calculada"
    input.classList.add('input-bloqueado');
    input.classList.remove('campo-valido', 'campo-error'); 
    
    updateFieldCounter(); // Actualizamos contador
}

function reactivarCaja(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.disabled = false;
    input.classList.remove('input-bloqueado'); // Le quitamos el diseño de bloqueo
}// ==========================================
// MOTOR MATEMÁTICO: ECOGRAFÍA RENAL (OBRYCKI & KRILL)
// ==========================================

function generarResultadoEcografia() {
    let checkMonoreno = document.getElementById('check_monoreno');
    let isMonoreno = checkMonoreno ? checkMonoreno.checked : false;
    let valIzq = parseFloat(document.getElementById('rinon_izquierdo_mm').value);
    let valDer = parseFloat(document.getElementById('rinon_derecho_mm').value);
    let talla = parseFloat(document.getElementById('talla_cm').value);
    
    AppState.ecografiaReportText = ""; 

    if (isNaN(valIzq) && isNaN(valDer)) return "";

    let htmlOut = `<div class="result-item" style="grid-column: 1 / -1;">
        <span class="result-label"><i class="fas fa-wave-square"></i> Longitud renal ecográfica</span>
        <span class="result-value" style="font-size: 15px; font-weight: 500; line-height: 1.5; display: block; margin-top: 8px;">`;

    if (isMonoreno) {
        let radioUnico = document.querySelector('input[name="radio_rinon_unico"]:checked');
        let rinonUnicoTipo = (radioUnico && radioUnico.value === 'derecho') ? 'derecho' : 'izquierdo';
        let medido = (rinonUnicoTipo === 'izquierdo') ? valIzq : valDer;
        let edadDec = AppState.edadEnAños; 
        
        if (!isNaN(medido) && typeof edadDec === 'number') {
            let mediaEsperadaMm = Math.round(((0.4 * edadDec) + 7) * 10);
            
            let comparador = "igual a";
            if (medido > mediaEsperadaMm) comparador = "por encima de";
            if (medido < mediaEsperadaMm) comparador = "por debajo de";

            // Modificado el formato también para el monoreno para mantener coherencia
            let txtPantalla = `Riñón ${rinonUnicoTipo} ${medido}mm (${comparador} la media esperada de hipertrofia compensadora, fórmula Krill).`;
            let txtInforme = `-Longitud renal ecográfica: Riñón ${rinonUnicoTipo} ${medido}mm (${comparador} la media esperada de hipertrofia compensadora, fórmula Krill).`;
            
            htmlOut += `<div style="color: var(--color-primary); font-weight: bold;">${txtPantalla}</div>`;
            AppState.ecografiaReportText = txtInforme; 
        } else {
            htmlOut += `<span style="color: var(--color-text-secondary); font-size: 13px;">Introduzca la fecha de nacimiento y la medida del riñón para calcular.</span>`;
        }
    } else {
        if (isNaN(talla)) {
            htmlOut += `<span style="color: var(--color-text-secondary); font-size: 13px;">Se requiere la Talla del paciente para calcular los percentiles.</span>`;
        } else {
            let param = obryckiLMS.find(r => talla >= r.min && talla <= r.max);
            let lineasReporte = [];
            
            let calcularP = (val, ladoTexto) => {
                if (isNaN(val)) return "";
                if (!param) return `<div style="color: var(--color-error); font-weight: bold;">Riñón ${ladoTexto} ${val}mm: Talla fuera de rango</div>`;
                
                let z = (Math.pow((val / param.M), param.L) - 1) / (param.L * param.S);
                let p = zScoreToPercentile(z);
                
                let pText = (p < 1) ? "<1" : (p > 99) ? ">99" : p;
                let isWarning = (p < 3 || p > 97);
                let colorStyle = isWarning ? `color: var(--color-error); font-weight: bold;` : `color: var(--color-primary); font-weight: bold;`;
                let warningIcon = isWarning ? ` <i class="fas fa-exclamation-triangle" style="font-size:12px;"></i>` : ``;
                
                // AQUÍ ESTÁ EL CAMBIO DE FORMATO EXACTO QUE PEDÍAS
                let textoPlano = `Riñón ${ladoTexto} ${val}mm (P${pText})`;
                lineasReporte.push(textoPlano);

                return `<div style="${colorStyle}">${textoPlano}${warningIcon}</div>`;
            };

            htmlOut += calcularP(valIzq, "izquierdo");
            htmlOut += calcularP(valDer, "derecho");
            
            AppState.ecografiaReportText = `-Longitud renal ecográfica: ${lineasReporte.join("; ")}`; 
        }
    }

    htmlOut += `</span></div>`;
    return htmlOut;

}
