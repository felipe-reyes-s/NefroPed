import { parseFecha, evaluarRango, performMedicalCalculations, obryckiLMS, zScoreToPercentile } from './math-engine.js';
import { PARAMETROS, SECCIONES, TAB_FIELDS, APP_VERSION, APP_YEAR } from './constants.js';
import { exportToPDF } from './pdf-export.js';
import { generateReport, exportToWord, printReport, copyToClipboard } from './report-generator.js';
import { getEl } from './utils.js';

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
    ecografiaReportText: "",
    reportPlainText: ""
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

    const checkMonoreno = getEl('check_monoreno');
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
    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_) {
        /* Silenciar error en navegadores con storage deshabilitado (Modo Privado Safari, etc.) */
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Aplicar tema inicial SIEMPRE con data-color-scheme
    document.documentElement.setAttribute('data-color-scheme', currentTheme);

    // Listener del header
    const headerBtn = getEl('theme-toggle-header');
    if (headerBtn) {
        headerBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-color-scheme', current);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, current);
            } catch (_) {
                /* Silenciar error en navegadores con storage deshabilitado */
            }
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
    getEl('fecha_analitica').value = `${dia}/${mes}/${año}`;
    calcularEdad();
}

function calcularEdad() {
    const strNac  = getEl('fecha_nacimiento').value;
    const strAnal = getEl('fecha_analitica').value;
    if (!strNac || !strAnal) return;

    const nacimiento = parseFecha(strNac);
    const analitica  = parseFecha(strAnal);

    if (!nacimiento) { getEl('edad_calculada').value = 'Fecha inexistente'; return; }
    if (!analitica)  { getEl('edad_calculada').value = 'Fecha inexistente'; return; }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (nacimiento > hoy || analitica > hoy) {
        getEl('edad_calculada').value = 'Fecha futura'; return;
    }
    if (nacimiento >= analitica) {
        getEl('edad_calculada').value = 'Fechas inválidas'; return;
    }

    const [diaNac, mesNac]            = strNac.split('/').map(Number);
    const [diaAnal, mesAnal, añoAnal] = strAnal.split('/').map(Number);
    const añoNac = nacimiento.getFullYear();

    let años  = añoAnal - añoNac;
    let meses = mesAnal - mesNac;
    if (diaAnal < diaNac) meses--;
    if (meses < 0) { años--; meses += 12; }

    getEl('edad_calculada').value = `${años} años ${meses} meses`;
    AppState.edadEnAños     = años;
    AppState.edadEnMeses    = meses;
    AppState.edadTotalMeses = años * 12 + meses;
}

function configurarEventosFechas() {
    ['fecha_nacimiento', 'fecha_analitica'].forEach(id => {
        const input = getEl(id);
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
    const NO_DECIMALES = ['fecha_nacimiento', 'fecha_analitica', 'rinon_izquierdo_mm', 'rinon_derecho_mm', 'sexo'];
    const camposDecimales = Object.values(TAB_FIELDS).flat()
        .filter(id => !NO_DECIMALES.includes(id));

    camposDecimales.forEach(fieldId => {
        const input = getEl(fieldId);
        if (input) {
            input.type = 'text';
            input.setAttribute('inputmode', 'text');
            input.setAttribute('pattern', '[0-9.,\\-<>]*');
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\./g, ',');
                value = (fieldId === 'exceso_bases_mmol_l') ? value.replace(/[^0-9,\-<>]/g, '') : value.replace(/[^0-9,<>]/g, '');

                const parts = value.split(',');
                if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
                if (parts.length === 2 && parts[1].length > 2) value = parts[0] + ',' + parts[1].substring(0, 2);

                if (fieldId !== 'exceso_bases_mmol_l' && value.includes('-')) value = value.replace('-', '');

                e.target.value = value;
            });
            input.addEventListener('blur', function(e) {
                let value = e.target.value;
                if (value) {
                    const numValue = parseFloat(value.replace(',', '.').replace(/[<>]/g, ''));
                    if (isNaN(numValue)) e.target.value = '';
                }
            });
        }
    });
}

function verifyFieldsExist() {
    if (location.hostname !== 'localhost') return;
    let missingFields = [];
    fieldIds.forEach(fieldId => { if (!getEl(fieldId)) missingFields.push(fieldId); });
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
    
    const targetTab = getEl(tabId);
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

    // 1. Validar dinámicamente usando la lista real de campos extraída del formulario
    fieldIds.forEach(campoId => {
        const campo = getEl(campoId);
        if (campo && !campo.disabled) {
            if (!campo.value || campo.value.trim() === '') {
                campo.classList.add('campo-error');
            } else {
                campo.classList.remove('campo-error');
            }
        } else if (campo && campo.disabled) {
            campo.classList.remove('campo-error');
        }
    });

    // 2. Colorear pestañas automáticamente si contienen algún campo con error en su interior
    document.querySelectorAll('.tab-content').forEach(tabContent => {
        const tieneError = tabContent.querySelectorAll('.campo-error').length > 0;
        const tabId = tabContent.id + '-tab';
        const tabButton = getEl(tabId);
        if (tabButton) {
            tabButton.classList.toggle('tab-error', tieneError);
        }
    });
}

function setupFormEvents() {
    camposParaContador.forEach(fieldId => {
        const input = getEl(fieldId);
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
    const calculateButton = getEl('calculateButton');
    if (calculateButton) calculateButton.addEventListener('click', () => { AppState.primeraValidacion = true; actualizarMarcadoresEnTiempoReal(); calculateResults(); });
    
    const copyClipboardButton = getEl('copyClipboardButton');
    if (copyClipboardButton) copyClipboardButton.addEventListener('click', () => copyToClipboard(AppState));

    const exportWordButton = getEl('exportWordButton');
    if (exportWordButton) exportWordButton.addEventListener('click', () => exportToWord(AppState, getFormData()));
    
    const exportPDFButton = getEl('exportPDFButton');
    if (exportPDFButton) exportPDFButton.addEventListener('click', () => exportToPDF(AppState, getFormData()));
    
    const printButton = getEl('printButton');
    if (printButton) printButton.addEventListener('click', () => printReport(AppState, getFormData()));

    const btnHoy = getEl('btn-hoy');
    if (btnHoy) btnHoy.addEventListener('click', rellenarFechaHoy);
    
    const btnLimpiar = getEl('btn-limpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', confirmarLimpiarFormulario);
    
    const btnTest = getEl('btn-cargar-datos-test');
    if (btnTest) btnTest.addEventListener('click', loadSampleData);

    const btnAcercaDe = getEl('btn-acerca-de');
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
                        v${APP_VERSION} · ${APP_YEAR} · Uso exclusivo para profesionales sanitarios
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
        const input = getEl(id);
        if (input) input.value = '';
    });

    ['sedimento_urinario', 'comentario_nutricional', 'serie_blanca', 'serie_plaquetaria', 'coagulacion', 'edad_calculada'].forEach(id => {
        const el = getEl(id);
        if (el) el.value = '';
    });
    
    limpiarColoresValidacion();
    
    getEl('results')?.classList.remove('hidden');
    getEl('reportSection')?.classList.add('hidden');
    
    const resultsGrid = getEl('resultsGrid'); 
    if(resultsGrid) {
        resultsGrid.innerHTML = '';
        resultsGrid.classList.add('hidden'); 
    }
    
    const emptyState = getEl('empty-state-results');
    if(emptyState) emptyState.classList.remove('hidden'); 
    
    const reportContent = getEl('reportContent'); 
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
    const checkMonoreno = getEl('check_monoreno');
    if (checkMonoreno) {
        checkMonoreno.checked = false;
        toggleMonoreno(false);
    }
    
    Object.keys(sampleData).forEach(key => {
        const input = getEl(key);
        if (input) { 
            input.value = sampleData[key]; 
            input.classList.add('campo-valido'); 
        }
    });
    
    getEl('fecha_nacimiento').dispatchEvent(new Event('input'));
    updateFieldCounter();
    actualizarMarcadoresEnTiempoReal();
    
    Swal.fire({
        icon: 'success', title: 'Datos cargados',
        text: 'Se han cargado datos ficticios de prueba para todas las fórmulas.',
        timer: 1500, showConfirmButton: false
    });
}

function validarTodosCampos() {
    let camposVacios = [];
    AppState.primeraValidacion = true; // Activa el chequeo "en directo"
    
    fieldIds.forEach(campoId => {
        const campo = getEl(campoId);
        // Omitir validación de campos bloqueados
        if (campo && !campo.disabled && (!campo.value || campo.value.trim() === '')) { 
            camposVacios.push(campoId); 
        }
    });
    
    // Dispara el pintado rojo general (cajas y pestañas)
    actualizarMarcadoresEnTiempoReal();
    
    return camposVacios; // Devolvemos la lista para la alerta
}

function updateFieldCounter() {
    const filledCount = camposParaContador.filter(id => getEl(id)?.value.trim() !== '').length;
    const counter = getEl('fieldCount');
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
        const input = getEl(fieldId);
        if (input) {
            let value = input.value;
            if (['fecha_nacimiento', 'fecha_analitica', 'sexo'].includes(fieldId)) { data[fieldId] = value; return; }
            if (value) value = value.replace(/,/g, '.').replace(/[<>]/g, ''); // ✅ Reemplaza comas por puntos y limpia los símbolos
            const numValue = parseFloat(value);
            data[fieldId] = isNaN(numValue) ? 0 : numValue;
        }
    });
    
    // Campos de texto libre y textareas (se añaden al paquete unificado de datos)
    data.serie_blanca           = getEl('serie_blanca')?.value.trim() ?? '';
    data.serie_plaquetaria      = getEl('serie_plaquetaria')?.value.trim() ?? '';
    data.coagulacion            = getEl('coagulacion')?.value.trim() ?? '';
    data.sedimento_urinario     = getEl('sedimento_urinario')?.value.trim() ?? '';
    data.comentario_nutricional = getEl('comentario_nutricional')?.value.trim() ?? '';
    
    data.edad = AppState.edadEnAños || 0;
    return data;
}


function calculateResults() {
    // 1. Comprobación de seguridad: Si todo está vacío, no hacemos absolutamente nada.
    const camposLlenos = camposParaContador.filter(id => getEl(id)?.value.trim() !== '').length;
    const ecoIzq = getEl('rinon_izquierdo_mm')?.value.trim();
    const ecoDer = getEl('rinon_derecho_mm')?.value.trim();
    
    if (camposLlenos === 0 && !ecoIzq && !ecoDer) {
        // Coloreamos todo de rojo y lanzamos el aviso en lugar de abortar en silencio
        AppState.primeraValidacion = true;
        actualizarMarcadoresEnTiempoReal();
        Swal.fire({
            icon: 'error',
            title: 'Faltan datos',
            text: 'No se ha introducido ningún dato. Rellena al menos un parámetro clínico para poder calcular los resultados.',
            confirmButtonColor: '#ef4444'
        });
        return; // Fin de la función, la página no se altera
    }

    // 2. BLINDAJE DE FECHAS
    const strNac  = getEl('fecha_nacimiento')?.value;
    const strAnal = getEl('fecha_analitica')?.value;

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

    // NUEVO: Verificamos si hay símbolos < o >
    const camposConSimbolos = fieldIds.filter(id => {
        const el = getEl(id);
        return el && !el.disabled && el.value && (el.value.includes('<') || el.value.includes('>'));
    });

    // Si faltan datos o hay símbolos, lanzamos la alerta interactiva
    if (camposVacios.length > 0 || camposConSimbolos.length > 0) {
        let htmlMsg = '';
        
        if (camposVacios.length > 0) {
            let listaVaciosHTML = '<ul style="text-align: left; max-height: 120px; overflow-y: auto; margin-top: 10px; margin-bottom: 15px; font-size: 14px; color: var(--color-text-secondary); background: var(--color-bg-1); padding: 10px 15px 10px 35px; border-radius: 8px;">';
            camposVacios.forEach(id => {
                const label = document.querySelector(`label[for="${id}"]`);
                const nombreCampo = label ? label.textContent.split(' (')[0] : id;
                listaVaciosHTML += `<li style="margin-bottom: 5px;"><strong>${nombreCampo}</strong></li>`;
            });
            listaVaciosHTML += '</ul>';
            htmlMsg += `Se han detectado <strong>campos en blanco</strong> que limitarán los cálculos:<br>${listaVaciosHTML}`;
        }

        if (camposConSimbolos.length > 0) {
            let listaSimbolosHTML = '<ul style="text-align: left; max-height: 120px; overflow-y: auto; margin-top: 10px; margin-bottom: 15px; font-size: 14px; color: #854d0e; background: #fef3c7; padding: 10px 15px 10px 35px; border-radius: 8px;">';
            camposConSimbolos.forEach(id => {
                const label = document.querySelector(`label[for="${id}"]`);
                const nombreCampo = label ? label.textContent.split(' (')[0] : id;
                const valor = getEl(id).value;
                let valEscaped = valor.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                listaSimbolosHTML += `<li style="margin-bottom: 5px;"><strong>${nombreCampo}</strong>: ${valEscaped}</li>`;
            });
            listaSimbolosHTML += '</ul>';
            let marginStr = camposVacios.length > 0 ? 'margin-top: 20px;' : '';
            htmlMsg += `<div style="${marginStr}">Se han detectado <strong>valores con &lt; o &gt;</strong>. Los cálculos se realizarán extrayendo únicamente su valor numérico:<br>${listaSimbolosHTML}</div>`;
        }

        htmlMsg += '<div style="margin-top: 15px;">¿Desea continuar con los cálculos?</div>';

        Swal.fire({
            icon: 'warning',
            title: 'Aviso de datos',
            html: htmlMsg,
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
            setTimeout(() => { generateReport(AppState, data); }, 100);
            
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
    if (!AppState.calculatedResults || Object.keys(AppState.calculatedResults).length === 0) return;
    const results = AppState.calculatedResults;
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
            const labelConUnidad = param.unit && !param.label.includes(param.unit) ? ` (${param.unit})` : '';
            AppState.valoresFueraRango.push(
    `${param.label}${labelConUnidad}: ${valor.toFixed(2)}${param.unit || ''} ${tipoFuera} (VN ${evaluacion.rangoTexto})`);

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
            const labelConUnidad = p && p.unit && !p.label.includes(p.unit) ? ` (${p.unit})` : '';
            const label = p ? `${p.label}${labelConUnidad}` : key;

                let numValue = key === 'densidad' ? parseFloat(valor).toFixed(0) : (typeof valor === 'number' ? valor.toFixed(2) : '0.00');
                
                let colorStyle = 'color: var(--color-primary) !important; font-weight: bold;';
                if (key !== "superficiecorporal" && key !== "imc") {
                    const evaluacion = evaluarRango(key, valor, edad, edadMeses);
                    if (!evaluacion.enRango) {
                        colorStyle = 'color: #dc2626 !important; font-weight: bold;';
                        numValue = '*' + numValue;
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
                    <h4 style="margin-bottom: 12px; color: var(--color-primary); border-bottom: 2px solid var(--color-bg-1); padding-bottom: 6px; font-size: 15px; font-weight: 600; text-decoration: underline;">
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
                <h4 style="margin-bottom: 12px; color: var(--color-primary); border-bottom: 2px solid var(--color-bg-1); padding-bottom: 6px; font-size: 15px; font-weight: 600; text-decoration: underline;">
                    Ecografía Renal
                </h4>
                <div class="results-grid" style="display: grid; grid-template-columns: 1fr; gap: 16px;">
                    ${tarjetaEcografia}
                </div>
            </div>
        `;
    }

    resultsGrid.innerHTML = DOMPurify.sanitize(htmlFinal);
    getEl('results').classList.remove('hidden');
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
    const installBtn = getEl('btn-install-pwa');
    if (installBtn && !isIOS()) {
        installBtn.classList.remove('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const installBtn = getEl('btn-install-pwa');
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
    const installBtn = getEl('btn-install-pwa');
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
    const opcionesDiv = getEl('opciones_monoreno');
    
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
    const input = getEl(id);
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
    const input = getEl(id);
    if (!input) return;
    input.disabled = false;
    input.classList.remove('input-bloqueado'); // Le quitamos el diseño de bloqueo
}// ==========================================
// MOTOR MATEMÁTICO: ECOGRAFÍA RENAL (OBRYCKI & KRILL)
// ==========================================

function generarResultadoEcografia() {
    let checkMonoreno = getEl('check_monoreno');
    let isMonoreno = checkMonoreno ? checkMonoreno.checked : false;
    let valIzq = parseFloat(getEl('rinon_izquierdo_mm').value);
    let valDer = parseFloat(getEl('rinon_derecho_mm').value);
    let talla = parseFloat(getEl('talla_cm').value);
    
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
