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
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: true,
        confirmButtonText: '🔄 Actualizar ahora',
        showCancelButton: true,
        cancelButtonText: 'Más tarde',
        timer: null,
        background: '#333',
        color: '#fff',
        confirmButtonColor: '#21808d'
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

const AppState = {
    calculatedResults: {},
    primeraValidacion: false,
    edadEnAños: 0,
    edadEnMeses: 0,
    edadTotalMeses: 0,
    valoresFueraRango: [],
    ecografiaReportText: ""
};

// ===============================================
// 3. INICIALIZACIÓN PRINCIPAL (DOMContentLoaded Maestro)
// ===============================================
document.addEventListener('DOMContentLoaded', function() {
    if (location.hostname === 'localhost') console.log('🚀 Dev mode');
    
    // 1. Primero leemos todos los IDs del HTML
// 1. Leemos los IDs, pero EXCLUIMOS la edad calculada, los checkboxes y los radios
    fieldIds = Array.from(document.querySelectorAll('#clinicalForm input[id], #clinicalForm select[id]'))
        .filter(input => input.id !== 'edad_calculada' && input.type !== 'checkbox' && input.type !== 'radio')
        .map(input => input.id);    
    // 2. Luego montamos el contador sumando los de texto
    camposParaContador = [...fieldIds, 'sedimento_urinario', 'comentario_nutricional', 'serie_blanca', 'serie_plaquetaria', 'coagulacion'];
    // 3. Lanzamos el resto de funciones
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
    setupAutoSave();
});

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
                Swal.fire({ icon: 'info', title: 'Modo TEST desactivado', timer: 1200, showConfirmButton: false });
            } else {
                activarModoTest();
                Swal.fire({ icon: 'success', title: '¡Modo TEST activado!', timer: 1200, showConfirmButton: false });
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
    const toggleBtn = document.getElementById('theme-toggle-footer');
    const themeText = document.getElementById('theme-text');
    const themeIcon = toggleBtn ? toggleBtn.querySelector('i') : null;

    function updateUI(theme) {
        if (theme === 'dark') {
            if (themeIcon) themeIcon.className = 'fas fa-sun';
            if (themeText) themeText.textContent = 'Modo Claro';
        } else {
            if (themeIcon) themeIcon.className = 'fas fa-moon';
            if (themeText) themeText.textContent = 'Modo Oscuro';
        }
    }

    const savedTheme = localStorage.getItem('themePref');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Aplicar tema inicial SIEMPRE con data-color-scheme
    document.documentElement.setAttribute('data-color-scheme', currentTheme);
    updateUI(currentTheme);

    // Listener footer
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-color-scheme', current);
            localStorage.setItem('themePref', current);
            updateUI(current);
        });
    }

    // ✅ Listener header — dentro de setupThemeToggle para acceder a updateUI
    const headerBtn = document.getElementById('theme-toggle-header');
    if (headerBtn) {
        headerBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-color-scheme', current);
            localStorage.setItem('themePref', current);
            updateUI(current);
        });
    }
}


function setupAutoSave() {
    const savedData = sessionStorage.getItem('calcRenalDataTemporales');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const input = document.getElementById(key);
                if (input && data[key] !== null && data[key] !== '') input.value = data[key];
            });
            calcularEdad();
        } catch (e) {
            console.error('Error al recuperar datos temporales');
        }
    }

    document.getElementById('clinicalForm').addEventListener('input', () => {
        const data = getFormData();
        data.sedimento_urinario = document.getElementById('sedimento_urinario')?.value || '';
        data.comentario_nutricional = document.getElementById('comentario_nutricional')?.value || '';
        data.serie_blanca = document.getElementById('serie_blanca')?.value || '';
        data.serie_plaquetaria = document.getElementById('serie_plaquetaria')?.value || '';
        data.coagulacion = document.getElementById('coagulacion')?.value || '';
        sessionStorage.setItem('calcRenalDataTemporales', JSON.stringify(data));
    });
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
    const fechaNac = document.getElementById('fecha_nacimiento').value;
    const fechaAnal = document.getElementById('fecha_analitica').value;
    if (!fechaNac || !fechaAnal) return;
    
    const [diaNac, mesNac, añoNac] = fechaNac.split('/').map(Number);
    const [diaAnal, mesAnal, añoAnal] = fechaAnal.split('/').map(Number);
    if (!diaNac || !mesNac || !añoNac || !diaAnal || !mesAnal || !añoAnal) return;
    
    const nacimiento = new Date(añoNac, mesNac - 1, diaNac);
    const analitica = new Date(añoAnal, mesAnal - 1, diaAnal);

    // Validación fechas imposibles (ej. 31/02/2020)
    if (
        nacimiento.getDate() !== diaNac || nacimiento.getMonth() !== mesNac - 1 || nacimiento.getFullYear() !== añoNac ||
        analitica.getDate() !== diaAnal || analitica.getMonth() !== mesAnal - 1 || analitica.getFullYear() !== añoAnal
    ) {
        document.getElementById('edad_calculada').value = 'Fecha inexistente';
        return;
    }

    if (nacimiento >= analitica) {
        document.getElementById('edad_calculada').value = 'Fechas inválidas';
        return;
    }

    // ── NUEVO: bloqueo fechas futuras ──────────────────────────
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (nacimiento > hoy || analitica > hoy) {
        document.getElementById('edad_calculada').value = 'Fecha futura';
        return;
    }
    // ──────────────────────────────────────────────────────────

    let años = añoAnal - añoNac;
    let meses = mesAnal - mesNac;
    if (diaAnal < diaNac) meses--;
    if (meses < 0) { años--; meses += 12; }
    
    document.getElementById('edad_calculada').value = `${años} años ${meses} meses`;
    
    AppState.edadEnAños = años;
    AppState.edadEnMeses = meses;
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
    const camposDecimales = [
        'peso_kg', 'talla_cm', 'urea_mg_dl', 'creatinina_enz_mg_dl', 'cistatina_c_mg_l', 'au_plasma_mg_dl', 
        'na_plasma_meq_l', 'k_plasma_meq_l', 'cl_plasma_meq_l', 'fosfatasa_alcalina_u_l', 
        'ca_plasma_mg_dl', 'p_plasma_mg_dl', 'mg_plasma_mg_dl', 'pth_pg_ml', 'vitamina_d_ng_ml',
        'ph_plasma', 'pco2_mmhg', 'hco3_mmol_l', 'exceso_bases_mmol_l',
        'densidad', 'ph_orina', 'au_orina_mg_dl', 'na_orina_meq_l', 'k_orina_meq_l', 
        'cl_orina_meq_l', 'osmolalidad_orina_mosm_kg', 'ca_orina_mg_dl', 'fosforo_orina_mg_dl', 
        'magnesio_orina_mg_dl', 'albumina_orina_mg_dl', 'creatinina_orina_mg_dl', 
        'proteinas_orina_mg_dl', 'citrato_orina_mg_dl', 'oxalato_orina_mg_dl',
        'au_24h_mg', 'ca_24h_mg', 'mg_24h_mg', 'p_24h_mg', 'citrato_24h_mg', 
        'oxalato_24h_mg', 'albumina_24h_mg', 'proteinas_24h_mg',
        'hb_g_l', 'ferritina_ng_ml', 'ist_percent'
    ];

    camposDecimales.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.type = 'text';  // ✅ Mantener para validación personalizada
            input.setAttribute('inputmode', 'decimal');  // ✅ OK
            input.setAttribute('pattern', '[0-9,.-]*');  // ✅ Añadir patrón para iOS
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
    });
}

function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    // Apagamos todas las pestañas visualmente y para los lectores de pantalla
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false'); // NUEVO: Apagar ARIA
    });
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    // Encendemos la pestaña clickeada visualmente y para los lectores de pantalla
    if (buttonElement) {
        buttonElement.classList.add('active');
        buttonElement.setAttribute('aria-selected', 'true'); // NUEVO: Encender ARIA
    }
}

function actualizarMarcadoresEnTiempoReal() {
    if (!AppState.primeraValidacion) return;
    
    // Lista de todas las pestañas y sus campos asociados
    const secciones = {
        'datos-basicos-tab': ['fecha_nacimiento', 'fecha_analitica', 'peso_kg', 'talla_cm'],
        'bioquimica-tab': ['urea_mg_dl', 'creatinina_enz_mg_dl', 'au_plasma_mg_dl', 'na_plasma_meq_l', 'k_plasma_meq_l', 'cl_plasma_meq_l', 'fosfatasa_alcalina_u_l', 'ca_plasma_mg_dl', 'p_plasma_mg_dl', 'mg_plasma_mg_dl', 'pth_pg_ml', 'vitamina_d_ng_ml', 'cistatina_c_mg_l'],
        'gasometria-tab': ['ph_plasma', 'pco2_mmhg', 'hco3_mmol_l', 'exceso_bases_mmol_l'],
        'orina-puntual-tab': ['densidad', 'ph_orina', 'au_orina_mg_dl', 'na_orina_meq_l', 'k_orina_meq_l', 'cl_orina_meq_l', 'osmolalidad_orina_mosm_kg', 'ca_orina_mg_dl', 'fosforo_orina_mg_dl', 'magnesio_orina_mg_dl', 'albumina_orina_mg_dl', 'creatinina_orina_mg_dl', 'proteinas_orina_mg_dl', 'citrato_orina_mg_dl', 'oxalato_orina_mg_dl'],
        'hematologia-tab': ['hb_g_l', 'ferritina_ng_ml', 'ist_percent'],
        'orina-24h-tab': ['au_24h_mg', 'ca_24h_mg', 'p_24h_mg', 'mg_24h_mg', 'albumina_24h_mg', 'proteinas_24h_mg', 'citrato_24h_mg', 'oxalato_24h_mg'],
        'ecografia-tab': ['rinon_izquierdo_mm', 'rinon_derecho_mm']
    };

    Object.keys(secciones).forEach(tabId => {
        let tieneError = false;
        secciones[tabId].forEach(campoId => {
            const campo = document.getElementById(campoId);
            
            // Si el campo está bloqueado (ej. monoreno), NO cuenta como error
            if (campo && !campo.disabled) {
                if (!campo.value || campo.value.trim() === '') {
                    tieneError = true;
                    campo.classList.add('campo-error');
                } else {
                    campo.classList.remove('campo-error');
                }
            } else if (campo && campo.disabled) {
                // Limpiar error si se acaba de bloquear
                campo.classList.remove('campo-error');
            }
        });
        
        // Aplicar o quitar la clase tab-error a la pestaña
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
                actualizarMarcadoresEnTiempoReal(); 
                
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
    if (exportPDFButton) exportPDFButton.addEventListener('click', exportToPDF);
    
    const printButton = document.getElementById('printButton');
    if (printButton) printButton.addEventListener('click', printReport);
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
    reportText = ''; 
    AppState.primeraValidacion = false;
    AppState.reportPlainText = '';
    AppState.ecografiaReportText = '';
    
    document.querySelectorAll('.tab-error').forEach(tab => tab.classList.remove('tab-error'));
    
    updateFieldCounter();
    switchTab('datos-basicos', document.querySelector('[data-tab="datos-basicos"]'));
    sessionStorage.removeItem('calcRenalDataTemporales');
}

function clearForm() { confirmarLimpiarFormulario(); }

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
function evaluarRango(parametro, valor, edad, edadMeses) {
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

// 2. BLINDAJE DE FECHAS: Evitar viajes en el tiempo y fechas inventadas
    const inputFechaNac = document.getElementById('fecha_nacimiento')?.value;
    const inputFechaAnal = document.getElementById('fecha_analitica')?.value;
    
    if (inputFechaNac && inputFechaAnal) {
        const [diaNac, mesNac, añoNac] = inputFechaNac.split('/').map(Number);
        const [diaAnal, mesAnal, añoAnal] = inputFechaAnal.split('/').map(Number);
        const fechaNacimiento = new Date(añoNac, mesNac - 1, diaNac);
        const fechaAnalitica = new Date(añoAnal, mesAnal - 1, diaAnal);
        
        // BLOQUEO A: Fechas inexistentes (ej. 31 de febrero o 29 feb en año NO bisiesto)
        if (
            fechaNacimiento.getDate() !== diaNac || fechaNacimiento.getMonth() !== mesNac - 1 || fechaNacimiento.getFullYear() !== añoNac ||
            fechaAnalitica.getDate() !== diaAnal || fechaAnalitica.getMonth() !== mesAnal - 1 || fechaAnalitica.getFullYear() !== añoAnal
        ) {
            Swal.fire({
                icon: 'error',
                title: 'Fecha inexistente',
                text: 'Has introducido una fecha que no existe en el calendario (revise los días 31 y los años bisiestos).',
                confirmButtonColor: '#ef4444'
            });
            return; // Cortamos la ejecución, no se calcula nada
        }

        // BLOQUEO B: Viajes en el tiempo (analítica antes de nacer)
        if (fechaAnalitica < fechaNacimiento) {
            Swal.fire({
                icon: 'error',
                title: 'Fechas incongruentes',
                text: 'La fecha de la analítica no puede ser anterior a la fecha de nacimiento. Por favor, corríjalas para continuar.',
                confirmButtonColor: '#ef4444' 
            });
            return; // Cortamos la ejecución, no se calcula nada
        }
        // BLOQUEO C: fechas futuras
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            if (fechaNacimiento > hoy || fechaAnalitica > hoy) {
                Swal.fire({
                    icon: 'error',
                    title: 'Fechas incongruentes',
                    text: 'Las fechas no pueden ser posteriores a hoy.',
                    confirmButtonColor: '#ef4444'
                });
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
function performMedicalCalculations(data) {
    const superficieCorporal = Math.sqrt(data.peso_kg * data.talla_cm / 3600);
    const imc = data.peso_kg > 0 && data.talla_cm > 0 ? data.peso_kg / Math.pow(data.talla_cm / 100, 2) : 0;
    const edadExacta = AppState.edadEnAños + (AppState.edadEnMeses / 12);
    const talla_m = data.talla_cm / 100;

    // --- 1. NUEVO MOTOR DE FILTRADO GLOMERULAR (eFG) PEDIÁTRICO ---
    const talla = data.talla_cm;
    const cr = data.creatinina_enz_mg_dl;
    const cistC = data.cistatina_c_mg_l;
    const sexo = data.sexo;

    let diasVida = 0;
    const inputFechaNac = document.getElementById('fecha_nacimiento');
    const inputFechaAnal = document.getElementById('fecha_analitica');
    if (inputFechaNac && inputFechaAnal && inputFechaNac.value && inputFechaAnal.value) {
        const [diaNac, mesNac, añoNac] = inputFechaNac.value.split('/').map(Number);
        const [diaAnal, mesAnal, añoAnal] = inputFechaAnal.value.split('/').map(Number);
        const fechaNacimiento = new Date(añoNac, mesNac - 1, diaNac);
        const fechaAnalitica = new Date(añoAnal, mesAnal - 1, diaAnal);
        diasVida = Math.floor((fechaAnalitica.getTime() - fechaNacimiento.getTime()) / (1000 * 3600 * 24));
    }

    let schwartz_neo = 0, schwartz_lact = 0, schwartz_bedside = 0, bokenkamp = 0, ekfc_cr = 0, ekfc_cistc = 0;
    let ckid_u25_cr = 0, ckid_u25_cistc = 0, ckid_u25_combinado = 0;

    // GRUPO 1: NEONATOS (0 a 28 días)
    if (diasVida >= 0 && diasVida <= 28) {
        if (cr && talla) schwartz_neo = 0.31 * (talla / cr);
        if (cistC) bokenkamp = 100 * (0.83 / cistC);
    }
   // GRUPO 2: LACTANTES (29 a 364 días)
    else if (diasVida >= 29 && diasVida < 365) {
        if (cr && talla) schwartz_lact = 0.34 * (talla / cr);
        if (cistC) bokenkamp = 100 * (0.83 / cistC);
        
        // --- Aplicación de CKiD U25 en >1 mes (Usando la K fijada a 1 año de edad) ---
        let k_cr_lactante = (sexo === 'M') ? 39.0 * Math.pow(1.008, 1 - 12) : 36.1 * Math.pow(1.008, 1 - 12);
        if (cr > 0 && talla_m > 0) ckid_u25_cr = k_cr_lactante * (talla_m / cr);

        let k_cist_lactante = (sexo === 'M') ? 87.2 * Math.pow(1.011, 1 - 15) : 79.9 * Math.pow(1.004, 1 - 12);
        if (cistC > 0) ckid_u25_cistc = k_cist_lactante * (1 / cistC);

        if (ckid_u25_cr > 0 && ckid_u25_cistc > 0) ckid_u25_combinado = (ckid_u25_cr + ckid_u25_cistc) / 2;
    }
    // GRUPO 3 y 4: MAYORES DE 1 AÑO (Hasta 25 años)
    else if (diasVida >= 365 && edadExacta <= 25) {
        // A. Schwartz Bedside
        if (cr && talla && edadExacta < 16) schwartz_bedside = 0.413 * (talla / cr);

        // B. CKiD U25
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

        // C. EKFC (European Kidney Function Consortium)
        if (cr && edadExacta >= 2) {
            let Q_cr = 0;
            if (edadExacta <= 25) {
                let lnQ_umol = 0;
                if (sexo === 'M' || sexo === 'Hombre') {
                    // Polinomio de crecimiento para Hombres (2 a 25 años)
                    lnQ_umol = 3.200 + (0.259 * edadExacta) - (0.543 * Math.log(edadExacta)) - (0.00763 * Math.pow(edadExacta, 2)) + (0.0000790 * Math.pow(edadExacta, 3));
                } else {
                    // Polinomio de crecimiento para Mujeres (2 a 25 años)
                    lnQ_umol = 3.080 + (0.177 * edadExacta) - (0.223 * Math.log(edadExacta)) - (0.00596 * Math.pow(edadExacta, 2)) + (0.0000686 * Math.pow(edadExacta, 3));
                }
                Q_cr = Math.exp(lnQ_umol) / 88.4;
            } else {
                // Constantes fijas para mayores de 25 años
                Q_cr = (sexo === 'M' || sexo === 'Hombre') ? 0.90 : 0.70;
            }
            const ratioCr = cr / Q_cr;
            const alphaCr = ratioCr <= 1 ? -0.322 : -1.132;
            ekfc_cr = 107.3 * Math.pow(ratioCr, alphaCr) * Math.pow(0.990, (edadExacta > 40 ? edadExacta - 40 : 0));
        }

        if (cistC && edadExacta >= 2) {
            // Factor Q para Cistatina C es 0.83 fijo independiente del sexo
            const Q_cistC = 0.83;
            const ratioCistC = cistC / Q_cistC;
            const alphaCistC = ratioCistC <= 1 ? -0.322 : -1.132;
            ekfc_cistc = 107.3 * Math.pow(ratioCistC, alphaCistC) * Math.pow(0.990, (edadExacta > 50 ? edadExacta - 50 : 0));
        }
    }

    // --- 2. RESTO DE CÁLCULOS (Excreción Fraccional, etc.) ---
    const efNa = (data.na_plasma_meq_l && data.creatinina_orina_mg_dl && data.na_orina_meq_l && data.creatinina_enz_mg_dl) ? (data.na_orina_meq_l * data.creatinina_enz_mg_dl) / (data.na_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efK = (data.k_plasma_meq_l && data.creatinina_orina_mg_dl && data.k_orina_meq_l && data.creatinina_enz_mg_dl) ? (data.k_orina_meq_l * data.creatinina_enz_mg_dl) / (data.k_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efCl = (data.cl_plasma_meq_l && data.creatinina_orina_mg_dl && data.cl_orina_meq_l && data.creatinina_enz_mg_dl) ? (data.cl_orina_meq_l * data.creatinina_enz_mg_dl) / (data.cl_plasma_meq_l * data.creatinina_orina_mg_dl) * 100 : 0;
    const efAU = (data.au_plasma_mg_dl && data.creatinina_orina_mg_dl && data.au_orina_mg_dl && data.creatinina_enz_mg_dl) ? (data.au_orina_mg_dl * data.creatinina_enz_mg_dl) / (data.au_plasma_mg_dl * data.creatinina_orina_mg_dl) * 100 : 0;

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

    const rtp = (data.p_plasma_mg_dl && data.fosforo_orina_mg_dl && data.creatinina_orina_mg_dl && data.creatinina_enz_mg_dl) ? 100 - ((data.fosforo_orina_mg_dl * data.creatinina_enz_mg_dl) / (data.p_plasma_mg_dl * data.creatinina_orina_mg_dl)) * 100 : 0;

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

    return {
        superficiecorporal: superficieCorporal, imc: imc, vpercent: vpercent, 
        schwartz_neo, schwartz_lact, schwartz_bedside, bokenkamp, ekfc_cr, ekfc_cistc,
        ckid_u25_cr: ckid_u25_cr, ckid_u25_cistc: ckid_u25_cistc, ckid_u25_combinado: ckid_u25_combinado, 
        efau: efAU, efna: efNa, efk: efK, efcl: efCl, cacr: cacr, rtp: rtp, mgcr: mgcr, pcr: pcr, aucr: aucr, 
        citratocr: citratocr, cacitrato: cacitrato, oxalatocr: oxalatocr, albcr: albcr, protcr: protcr, nak: nak, 
        uricosuria: uricosuria, calciuria: calciuria, citraturia: citraturia, fosfaturia: fosfaturia, oxaluria: oxaluria, 
        magnesuria: magnesuria, albuminuria: albuminuria, proteinuria: proteinuria, proteinuriaestimada: proteinuriaEstimada
    };
}

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
        AppState.calculatedResults = performMedicalCalculations(data);

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
    
    const parametros = [
        { key: 'vpercent', nombre: 'V%', unidad: '%' }, 
        { key: 'schwartz_neo', nombre: 'eGFR Schwartz neonatal', unidad: 'ml/min/1.73m²' },
        { key: 'schwartz_lact', nombre: 'eGFR Schwartz lactante', unidad: 'ml/min/1.73m²' },
        { key: 'bokenkamp', nombre: 'eGFR Bökenkamp', unidad: 'ml/min/1.73m²' },
        { key: 'schwartz_bedside', nombre: 'eGFR Schwartz Bedside', unidad: 'ml/min/1.73m²' },
        { key: 'ckid_u25_cr', nombre: 'eGFR CKiD U25 Cr', unidad: 'ml/min/1.73m²' }, 
        { key: 'ckid_u25_cistc', nombre: 'eGFR CKiD U25 CistC', unidad: 'ml/min/1.73m²' }, 
        { key: 'ckid_u25_combinado', nombre: 'eGFR Combinado', unidad: 'ml/min/1.73m²' }, 
        { key: 'ekfc_cr', nombre: 'eGFR EKFC Cr', unidad: 'ml/min/1.73m²' },
        { key: 'ekfc_cistc', nombre: 'eGFR EKFCCystC', unidad: 'ml/min/1.73m²' }, // Corregido aquí
        { key: 'efau', nombre: 'EF AU', unidad: '' }, { key: 'efna', nombre: 'EF Na', unidad: '' }, { key: 'efk', nombre: 'EF K', unidad: '' }, { key: 'efcl', nombre: 'EF Cl', unidad: '' }, { key: 'cacr', nombre: 'Ca/Cr', unidad: 'mg/mg' }, { key: 'rtp', nombre: 'RTP', unidad: '%' }, { key: 'mgcr', nombre: 'Mg/Cr', unidad: 'mg/mg' }, { key: 'pcr', nombre: 'P/Cr', unidad: 'mg/mg' }, { key: 'aucr', nombre: 'AU/Cr', unidad: 'mg/mg' }, { key: 'citratocr', nombre: 'Citrato/Cr', unidad: 'mg/mg' }, { key: 'cacitrato', nombre: 'Ca/Citrato', unidad: '' }, { key: 'oxalatocr', nombre: 'Oxalato/Cr', unidad: 'mg/mg' }, { key: 'albcr', nombre: 'Alb/Cr', unidad: 'mg/g' }, { key: 'protcr', nombre: 'Prot/Cr', unidad: 'mg/g' }, { key: 'nak', nombre: 'Na/K orina', unidad: '' }, { key: 'uricosuria', nombre: 'Uricosuria', unidad: 'mg/1.73m²/día' }, { key: 'calciuria', nombre: 'Calciuria', unidad: 'mg/kg/día' }, { key: 'citraturia', nombre: 'Citraturia', unidad: 'mg/kg/día' }, { key: 'fosfaturia', nombre: 'Fosfaturia', unidad: 'mg/kg/día' }, { key: 'oxaluria', nombre: 'Oxaluria', unidad: 'mg/1.73m²/día' }, { key: 'magnesuria', nombre: 'Magnesuria', unidad: 'mg/kg/día' }, { key: 'albuminuria', nombre: 'Albuminuria', unidad: 'mg/1.73m²/día' }, { key: 'proteinuria', nombre: 'Proteinuria', unidad: 'mg/m²/día' }, { key: 'proteinuriaestimada', nombre: 'Proteinuria estimada', unidad: 'mg/m²/día' }
    ];
    
    const resultLabels = {
        superficiecorporal: 'Superficie Corporal (m²)', imc: 'IMC (kg/m²)', vpercent: 'V% (creat enz/orina)', 
        schwartz_neo: 'eGFR Schwartz neonatal', schwartz_lact: 'eGFR Schwartz lactante',
        schwartz_bedside: 'eGFR Schwartz Bedside', bokenkamp: 'eGFR Bökenkamp',
        ekfc_cr: 'eGFR EKFC Cr', ekfc_cistc: 'eGFR EKFCCystC', // Corregido aquí
        ckid_u25_cr: 'eGFR CKiD U25 Cr', ckid_u25_cistc: 'eGFR CKiD U25 CistC', ckid_u25_combinado: 'eGFR Combinado', 
        efna: 'EF Na (%)', efk: 'EF K (%)', efcl: 'EF Cl (%)', efau: 'EF AU (%)', cacr: 'Ca/Cr (mg/mg)', mgcr: 'Mg/Cr (mg/mg)', pcr: 'P/Cr (mg/mg)', aucr: 'AU/Cr (mg/mg)', albcr: 'Alb/Cr (mg/g)', protcr: 'Prot/Cr (mg/g)', citratocr: 'Citrato/Cr (mg/mg)', oxalatocr: 'Oxalato/Cr (mg/mg)', nak: 'Na/K orina', cacitrato: 'Ca/Citrato', rtp: 'RTP (%)', uricosuria: 'Uricosuria (mg/1.73m²/día)', calciuria: 'Calciuria (mg/kg/día)', citraturia: 'Citraturia (mg/kg/día)', fosfaturia: 'Fosfaturia (mg/kg/día)', magnesuria: 'Magnesuria (mg/kg/día)', oxaluria: 'Oxaluria (mg/1.73m²/día)', albuminuria: 'Albuminuria (mg/1.73m²/día)', proteinuria: 'Proteinuria (mg/m²/día)', proteinuriaestimada: 'Proteinuria estimada (mg/m²/día)'
    };

   const categorias = [
        { titulo: "Datos Generales", keys: ['superficiecorporal', 'imc'] },
        { titulo: "Filtrado Glomerular (eGFR en ml/min/1.73m²)", keys: ['vpercent', 'schwartz_neo', 'schwartz_lact', 'schwartz_bedside', 'bokenkamp', 'ckid_u25_cr', 'ekfc_cr', 'ckid_u25_cistc', 'ekfc_cistc', 'ckid_u25_combinado'] },
        { titulo: "Excreción Fraccional", keys: ['efna', 'efk', 'efcl', 'efau'] },
        { titulo: "Índices Urinarios (Orina Puntual)", keys: ['cacr', 'mgcr', 'pcr', 'aucr', 'albcr', 'protcr', 'citratocr', 'oxalatocr', 'nak', 'cacitrato', 'rtp'] },
        { titulo: "Excreción en 24h", keys: ['uricosuria', 'calciuria', 'citraturia', 'fosfaturia', 'magnesuria', 'oxaluria', 'albuminuria', 'proteinuria', 'proteinuriaestimada'] }
    ];
    
    const resultsGrid = document.getElementById('resultsGrid');
    resultsGrid.innerHTML = '';
    resultsGrid.className = ''; 
    resultsGrid.classList.remove('hidden');
    
    const emptyState = document.getElementById('empty-state-results');
    if(emptyState) emptyState.classList.add('hidden');
 
    AppState.valoresFueraRango = []; 

    parametros.forEach(param => {
        const valor = results[param.key];
        if (valor && valor !== 0) {
            const evaluacion = evaluarRango(param.key, valor, edad, edadMeses);
            if (!evaluacion.enRango) {
                const tipoFuera = evaluacion.tipo === 'alto' ? 'por encima de rango' : 'por debajo de rango';
                AppState.valoresFueraRango.push(`${param.nombre} ${param.unidad ? `(${param.unidad})` : ''}: ${valor.toFixed(2)}${param.unidad} ${tipoFuera} (VN ${evaluacion.rangoTexto})`);
            }
        }
    });
    
    let htmlFinal = "";

    categorias.forEach(cat => {
        let itemsHTML = "";
        cat.keys.forEach(key => {
            const valor = results[key];
            if (valor && valor !== 0) {
                const label = resultLabels[key];
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

    let report = [];
        
    let hidrosalino = [];
    if (isValid(data.urea_mg_dl)) hidrosalino.push(`Urea: ${fmt(data.urea_mg_dl)}mg/dL`);
    
    if (isValid(data.creatinina_enz_mg_dl)) {
        let cr = `Cr: ${fmt(data.creatinina_enz_mg_dl)}mg/dL`;
        if (isValid(results.schwartz_neo)) cr += ` (eGFR Schwartz neonatal: ${fmt(results.schwartz_neo)}ml/min/1.73m²)`;
        if (isValid(results.schwartz_lact)) cr += ` (eGFR Schwartz lactante: ${fmt(results.schwartz_lact)}ml/min/1.73m²)`;
        if (isValid(results.schwartz_bedside)) cr += ` (eGFR Schwartz Bedside: ${fmt(results.schwartz_bedside)}ml/min/1.73m²)`;
        if (isValid(results.ckid_u25_cr)) cr += ` (eGFR CKiD U25 Cr: ${fmt(results.ckid_u25_cr)}ml/min/1.73m²)`;
        if (isValid(results.ekfc_cr)) cr += ` (eGFR EKFC Cr: ${fmt(results.ekfc_cr)}ml/min/1.73m²)`;
        hidrosalino.push(cr);
    }
    
    if (isValid(data.cistatina_c_mg_l)) {
        let cist = `Cistatina C: ${fmt(data.cistatina_c_mg_l)}mg/L`;
        if (isValid(results.bokenkamp)) cist += ` (eGFR Bökenkamp: ${fmt(results.bokenkamp)}ml/min/1.73m²)`;
        if (isValid(results.ckid_u25_cistc)) cist += ` (eGFR CKiD U25 CistC: ${fmt(results.ckid_u25_cistc)}ml/min/1.73m²)`;
        if (isValid(results.ekfc_cistc)) cist += ` (EKFCCystC: ${fmt(results.ekfc_cistc)}ml/min/1.73m²)`; 
        hidrosalino.push(cist);
    }
    
    if (isValid(results.ckid_u25_combinado)) hidrosalino.push(`(eGFR Combinado CKiD U25: ${fmt(results.ckid_u25_combinado)}ml/min/1.73m²)`);
    if (isValid(results.vpercent)) hidrosalino.push(`V%: ${fmt(results.vpercent)}%`);
    if (isValid(data.na_plasma_meq_l)) hidrosalino.push(`Na: ${fmt(data.na_plasma_meq_l)}mEq/L`);
    if (isValid(results.efna)) hidrosalino.push(`EFNa: ${fmt(results.efna)}`);
    if (isValid(data.k_plasma_meq_l)) hidrosalino.push(`K: ${fmt(data.k_plasma_meq_l)}mEq/L`);
    if (isValid(results.efk)) hidrosalino.push(`EFK: ${fmt(results.efk)}`);
    if (isValid(data.cl_plasma_meq_l)) hidrosalino.push(`Cl: ${fmt(data.cl_plasma_meq_l)}mEq/L`);
    if (isValid(results.efcl)) hidrosalino.push(`EFCl: ${fmt(results.efcl)}`);
    if (isValid(data.au_plasma_mg_dl)) hidrosalino.push(`AU: ${fmt(data.au_plasma_mg_dl)}mg/dL`);
    if (isValid(results.efau)) hidrosalino.push(`EFAU: ${fmt(results.efau)}`);

    let fosfocalcico = [];
    if (isValid(data.ca_plasma_mg_dl)) fosfocalcico.push(`Ca: ${fmt(data.ca_plasma_mg_dl)}mg/dL`);
    if (isValid(results.cacr)) fosfocalcico.push(`Ca/Cr: ${fmt(results.cacr)}mg/mg`);
    if (isValid(data.p_plasma_mg_dl)) fosfocalcico.push(`P: ${fmt(data.p_plasma_mg_dl)}mg/dL`);
    if (isValid(results.rtp)) fosfocalcico.push(`RTP: ${fmt(results.rtp)}%`);
    if (isValid(data.mg_plasma_mg_dl)) fosfocalcico.push(`Mg: ${fmt(data.mg_plasma_mg_dl)}mg/dL`);
    if (isValid(results.mgcr)) fosfocalcico.push(`Mg/Cr: ${fmt(results.mgcr)}mg/mg`);
    if (isValid(results.pcr)) fosfocalcico.push(`P/Cr: ${fmt(results.pcr)}mg/mg`);
    if (isValid(data.pth_pg_ml)) fosfocalcico.push(`PTH: ${fmt(data.pth_pg_ml)}pg/mL`);
    if (isValid(data.vitamina_d_ng_ml)) fosfocalcico.push(`Vitamina D: ${fmt(data.vitamina_d_ng_ml)}ng/mL`);
    if (isValid(data.fosfatasa_alcalina_u_l)) fosfocalcico.push(`Fosfatasa alcalina: ${fmt(data.fosfatasa_alcalina_u_l)}U/L`);

    let hematologico = [];
    if (isValid(data.hb_g_l)) hematologico.push(`Hemoglobina: ${fmt(data.hb_g_l)}g/L`);
    if (isValid(data.ferritina_ng_ml)) hematologico.push(`Ferritina: ${fmt(data.ferritina_ng_ml)}ng/mL`);
    if (isValid(data.ist_percent)) hematologico.push(`IST: ${fmt(data.ist_percent)}%`);
    const serieBlanca = escapeHTML(document.getElementById('serie_blanca')?.value.trim() ?? '');
    const seriePlaquetaria = escapeHTML(document.getElementById('serie_plaquetaria')?.value.trim() ?? '');
    const coagulacion = escapeHTML(document.getElementById('coagulacion')?.value.trim() ?? '');
    if (serieBlanca) hematologico.push(`Serie blanca: ${serieBlanca}`);
    if (seriePlaquetaria) hematologico.push(`Serie plaquetaria: ${seriePlaquetaria}`);
    if (coagulacion) hematologico.push(`Coagulación: ${coagulacion}`);

    let gasometria = [];
    if (isValid(data.ph_plasma)) gasometria.push(`pH: ${fmt(data.ph_plasma)}`);
    if (isValid(data.pco2_mmhg)) gasometria.push(`pCO2: ${fmt(data.pco2_mmhg)}mmHg`);
    if (isValid(data.hco3_mmol_l)) gasometria.push(`HCO3: ${fmt(data.hco3_mmol_l)}mmol/L`);
    if (isValid(data.exceso_bases_mmol_l)) gasometria.push(`Exceso de bases: ${fmt(data.exceso_bases_mmol_l)}mmol/L`);

    let orina = [];
    const sedimentoUrinario = escapeHTML(document.getElementById('sedimento_urinario')?.value.trim() ?? '');
    const comentarioNutricional = escapeHTML(document.getElementById('comentario_nutricional')?.value.trim() ?? '');
    if (isValid(data.densidad)) orina.push(`Densidad: ${fmt(data.densidad, 0)}`);
    if (isValid(data.ph_orina)) orina.push(`pH: ${fmt(data.ph_orina)}`);
    
    let sedimentoParts = [];
    if (isValid(results.protcr)) sedimentoParts.push(`Prot/Cr: ${fmt(results.protcr)}mg/g`);
    if (isValid(results.proteinuriaestimada)) sedimentoParts.push(`Proteinuria estimada: ${fmt(results.proteinuriaestimada)}mg/m²/día`);
    if (isValid(results.albcr)) sedimentoParts.push(`Alb/Cr: ${fmt(results.albcr)}mg/g`);
    
    if (sedimentoUrinario) {
        orina.push(`Sedimento: ${sedimentoUrinario}`);
        if (sedimentoParts.length > 0) orina.push(sedimentoParts.join('   '));
    } else if (sedimentoParts.length > 0) {
        orina.push(`Sedimento: ${sedimentoParts.join('   ')}`);
    }
    
    if (isValid(data.osmolalidad_orina_mosm_kg)) orina.push(`Osmolalidad urinaria: ${fmt(data.osmolalidad_orina_mosm_kg)}mOsm/kg`);

    let cocientes = [];
    if (isValid(results.aucr)) cocientes.push(`AU/Cr: ${fmt(results.aucr)}mg/mg`);
    if (isValid(results.nak)) cocientes.push(`Na/K: ${fmt(results.nak)}`);
    if (isValid(results.cacr)) cocientes.push(`Ca/Cr: ${fmt(results.cacr)}mg/mg`);
    if (isValid(results.citratocr)) cocientes.push(`Citrato/Cr: ${fmt(results.citratocr)}mg/mg`);
    if (isValid(results.cacitrato)) cocientes.push(`Ca/Citrato: ${fmt(results.cacitrato)}`);
    if (isValid(results.oxalatocr)) cocientes.push(`Oxalato/Cr: ${fmt(results.oxalatocr)}mg/mg`);

    let orina24h = [];
    if (isValid(results.uricosuria)) orina24h.push(`Uricosuria: ${fmt(results.uricosuria)}mg/1.73m²`);
    if (isValid(results.calciuria)) orina24h.push(`Calciuria: ${fmt(results.calciuria)}mg/kg/día`);
    if (isValid(results.citraturia)) orina24h.push(`Citraturia: ${fmt(results.citraturia)}mg/kg/día`);
    if (isValid(results.fosfaturia)) orina24h.push(`Fosfaturia: ${fmt(results.fosfaturia)}mg/kg/día`);
    if (isValid(results.oxaluria)) orina24h.push(`Oxaluria: ${fmt(results.oxaluria)}mg/1.73m²`);
    if (isValid(results.magnesuria)) orina24h.push(`Magnesuria: ${fmt(results.magnesuria)}mg/kg/día`);
    if (isValid(results.proteinuria)) orina24h.push(`Proteinuria: ${fmt(results.proteinuria)}mg/m²/día`);
    if (isValid(results.albuminuria)) orina24h.push(`Albuminuria: ${fmt(results.albuminuria)}mg/1.73m²/día`);

    let hayDatosAnalitica = (hidrosalino.length + fosfocalcico.length + hematologico.length + gasometria.length + orina.length + cocientes.length + orina24h.length) > 0;

    if (hayDatosAnalitica) {
        report.push("1) Analítica:");
        if (hidrosalino.length > 0) report.push(`- Hidrosalino: ${hidrosalino.join('   ')}`);
        if (fosfocalcico.length > 0) report.push(`- Metabolismo fosfocálcico: ${fosfocalcico.join('   ')}`);
        if (hematologico.length > 0) report.push(`- Hematológico: ${hematologico.join('   ')}`);
        if (gasometria.length > 0) report.push(`- Gasometría: ${gasometria.join('   ')}`);
        if (orina.length > 0) report.push(`- Orina puntual: ${orina.join('   ')}`);
        if (cocientes.length > 0) report.push(`- Cocientes urinarios: ${cocientes.join('   ')}`);
        if (orina24h.length > 0) report.push(`- Orina de 24h: ${orina24h.join(' | ')}`);
        
    }
    if (AppState.ecografiaReportText) {
        report.push(`2) Ecografía renal`);
        report.push(AppState.ecografiaReportText);
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
            1: [35, 24, 12, 5], 2: [40, 27, 13, 6], 3: [45, 30, 15, 7], 4: [50, 33, 17, 8],
            5: [55, 37, 18, 9], 6: [60, 40, 20, 10], 7: [63, 42, 21, 10], 8: [65, 44, 22, 11],
            9: [68, 45, 23, 11], 10: [70, 47, 24, 11], 11: [73, 49, 24, 12], 12: [75, 50, 25, 12],
            13: [76, 51, 25, 12], 14: [77, 52, 26, 13], 15: [78, 53, 26, 13], 16: [79, 54, 27, 13],
            17: [81, 54, 27, 14], 18: [82, 55, 28, 14], 19: [83, 56, 28, 14], 20: [84, 57, 29, 14],
            21: [85, 58, 29, 14], 22: [87, 59, 29, 15], 23: [88, 59, 30, 15], 24: [90, 60, 30, 15]
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

    if (AppState.edadEnAños >= 2) {
        let grados_kdigo = [];
        if (isValid(results.schwartz_bedside)) grados_kdigo.push(`- eGFR Schwartz Bedside: ${evaluarGradoG(results.schwartz_bedside)}`);
        if (isValid(results.ckid_u25_cr)) grados_kdigo.push(`- eGFR CKiD U25 Cr: ${evaluarGradoG(results.ckid_u25_cr)}`);
        if (isValid(results.ekfc_cr)) grados_kdigo.push(`- eGFR EKFC Cr: ${evaluarGradoG(results.ekfc_cr)}`);
        if (isValid(results.ckid_u25_cistc)) grados_kdigo.push(`- eGFR CKiD U25 CistC: ${evaluarGradoG(results.ckid_u25_cistc)}`);
        if (isValid(results.ekfc_cistc)) grados_kdigo.push(`- eGFR EKFCCystC: ${evaluarGradoG(results.ekfc_cistc)}`);
        if (isValid(results.ckid_u25_combinado)) grados_kdigo.push(`- eGFR Combinado (CKiD U25): ${evaluarGradoG(results.ckid_u25_combinado)}`);
        let gradoAlb = (results.albcr !== undefined && results.albcr > 0) ? evaluarGradoA(results.albcr) : null;
        if (gradoAlb) grados_kdigo.push(`- Albuminuria: ${gradoAlb}`);

        if (grados_kdigo.length > 0) {
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
        if (isValid(results.schwartz_neo)) grados_lactante.push(`- eGFR Schwartz neonatal: ${evaluarERC_Lactante(results.schwartz_neo, mesesTotales)}`);
        if (isValid(results.schwartz_lact)) grados_lactante.push(`- eGFR Schwartz lactante: ${evaluarERC_Lactante(results.schwartz_lact, mesesTotales)}`);
        if (isValid(results.schwartz_bedside)) grados_lactante.push(`- eGFR Schwartz Bedside: ${evaluarERC_Lactante(results.schwartz_bedside, mesesTotales)}`);
        if (isValid(results.ckid_u25_cr)) grados_lactante.push(`- eGFR CKiD U25 Cr: ${evaluarERC_Lactante(results.ckid_u25_cr, mesesTotales)}`);
        if (isValid(results.ekfc_cr)) grados_lactante.push(`- eGFR EKFC Cr: ${evaluarERC_Lactante(results.ekfc_cr, mesesTotales)}`);
        if (isValid(results.bokenkamp)) grados_lactante.push(`- eGFR Bökenkamp (CistC): ${evaluarERC_Lactante(results.bokenkamp, mesesTotales)}`);
        if (isValid(results.ckid_u25_cistc)) grados_lactante.push(`- eGFR CKiD U25 CistC: ${evaluarERC_Lactante(results.ckid_u25_cistc, mesesTotales)}`);
        if (isValid(results.ekfc_cistc)) grados_lactante.push(`- eGFR EKFCCystC: ${evaluarERC_Lactante(results.ekfc_cistc, mesesTotales)}`);
        if (isValid(results.ckid_u25_combinado)) grados_lactante.push(`- eGFR Combinado (CKiD U25): ${evaluarERC_Lactante(results.ckid_u25_combinado, mesesTotales)}`);

        if (grados_lactante.length > 0) {
            report.push('\n\nESTADIFICACIÓN ERC (AJUSTADA A EDAD < 2 AÑOS)\n');
            report = report.concat(grados_lactante);
            htmlEstadificacion = `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">Estadificación ERC (Ajustada a < 2 años)</h4><ul style="margin-top: 0; padding-left: 20px;">`;
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
        let fueraRangoEditado = AppState.valoresFueraRango.map(v => `-${v}`);
        fueraRangoEditado.forEach(v => report.push(v));

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
        return split.length > 1 ? `<strong>${split[0]}:</strong> ${split.slice(1).join(': ')}` : str;
    };

let html = `<div class="report-body">`;
    if (hayDatosAnalitica) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1) Analítica</h4>`;
        html += `<ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">`;
        if (hidrosalino.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Hidrosalino:</u></strong> ${hidrosalino.map(boldify).join(' | ')}</li>`;
        if (fosfocalcico.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Metabolismo fosfocálcico:</u></strong> ${fosfocalcico.map(boldify).join(' | ')}</li>`;
        if (hematologico.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Hematológico:</u></strong> ${hematologico.map(boldify).join(' | ')}</li>`;
        if (gasometria.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Gasometría:</u></strong> ${gasometria.map(boldify).join(' | ')}</li>`;
        if (orina.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Orina puntual:</u></strong> ${orina.map(boldify).join(' | ')}</li>`;
        if (cocientes.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Cocientes urinarios:</u></strong> ${cocientes.map(boldify).join(' | ')}</li>`;
        if (orina24h.length > 0) html += `<li style="margin-bottom: 4px;"><strong><u>Orina de 24h:</u></strong> ${orina24h.map(boldify).join(' | ')}</li>`;
        if (comentarioNutricional) html += `<li style="margin-bottom: 4px;"><strong><u>Otros:</u></strong> ${comentarioNutricional}</li>`;
        html += `</ul>`;
    }
    if (AppState.ecografiaReportText) {
        html += `<h4 style="color: #0891b2; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">2) Ecografía Renal</h4>`;
        html += `<p style="margin-top: 0; padding-left: 20px;">${AppState.ecografiaReportText.replace('-Longitud renal ecográfica: ', '<strong>Longitud renal ecográfica:</strong> ')}</p>`;
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
    const R     = AppState.calculatedResults;
    const edad  = AppState.edadEnAños  || 0;
    const edadM = AppState.edadEnMeses || 0;
    const get   = id => document.getElementById(id)?.value || '—';
    const sexoStr = get('sexo') === 'M' ? 'Masculino' : 'Femenino';

    const labels = {
        superficiecorporal:'Superficie Corporal', imc:'IMC',
        vpercent:'V% creatinina enz/orina',
        schwartzneo:'Schwartz neonatal', schwartzlact:'Schwartz lactante',
        schwartzbedside:'Schwartz Bedside', bokenkamp:'Bökenkamp',
        ekfccr:'EKFC Cr', ekfccistc:'EKFC CistC',
        ckidu25cr:'CKiD U25 Cr', ckidu25cistc:'CKiD U25 CistC',
        ckidu25combinado:'CKiD U25 Combinado',
        efna:'EF Na', efk:'EF K', efcl:'EF Cl', efau:'EF AU',
        cacr:'Ca/Cr', mgcr:'Mg/Cr', pcr:'P/Cr', aucr:'AU/Cr',
        albcr:'Alb/Cr', protcr:'Prot/Cr', citratocr:'Citrato/Cr',
        oxalatocr:'Oxalato/Cr', nak:'Na/K orina', cacitrato:'Ca/Citrato', rtp:'RTP',
        uricosuria:'Uricosuria', calciuria:'Calciuria', citraturia:'Citraturia',
        fosfaturia:'Fosfaturia', magnesuria:'Magnesuria', oxaluria:'Oxaluria',
        albuminuria:'Albuminuria', proteinuria:'Proteinuria',
        proteinuriaestimada:'Proteinuria estimada'
    };
    const units = {
        superficiecorporal:'m2', imc:'kg/m2', vpercent:'%',
        schwartzneo:'ml/min/1.73m2', schwartzlact:'ml/min/1.73m2',
        schwartzbedside:'ml/min/1.73m2', bokenkamp:'ml/min/1.73m2',
        ekfccr:'ml/min/1.73m2', ekfccistc:'ml/min/1.73m2',
        ckidu25cr:'ml/min/1.73m2', ckidu25cistc:'ml/min/1.73m2',
        ckidu25combinado:'ml/min/1.73m2',
        efna:'%', efk:'%', efcl:'%', efau:'%',
        cacr:'mg/mg', mgcr:'mg/mg', pcr:'mg/mg', aucr:'mg/mg',
        albcr:'mg/g', protcr:'mg/g', citratocr:'mg/mg', oxalatocr:'mg/mg',
        nak:'', cacitrato:'', rtp:'%',
        uricosuria:'mg/1.73m2/dia', calciuria:'mg/kg/dia', citraturia:'mg/kg/dia',
        fosfaturia:'mg/kg/dia', magnesuria:'mg/kg/dia', oxaluria:'mg/1.73m2/dia',
        albuminuria:'mg/1.73m2/dia', proteinuria:'mg/m2/dia',
        proteinuriaestimada:'mg/m2/dia'
    };
    const secciones = [
        { titulo:'DATOS GENERALES',
          keys:['superficiecorporal','imc'] },
        { titulo:'FILTRADO GLOMERULAR — eGFR (ml/min/1.73m2)',
          keys:['vpercent','schwartzneo','schwartzlact','schwartzbedside','bokenkamp',
                'ckidu25cr','ekfccr','ckidu25cistc','ekfccistc','ckidu25combinado'] },
        { titulo:'EXCRECIÓN FRACCIONAL',
          keys:['efna','efk','efcl','efau'] },
        { titulo:'ÍNDICES URINARIOS — ORINA PUNTUAL',
          keys:['cacr','mgcr','pcr','aucr','albcr','protcr',
                'citratocr','oxalatocr','nak','cacitrato','rtp'] },
        { titulo:'EXCRECIÓN EN 24 HORAS',
          keys:['uricosuria','calciuria','citraturia','fosfaturia',
                'magnesuria','oxaluria','albuminuria','proteinuria','proteinuriaestimada'] }
    ];

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
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-collapse:collapse;">
      <tr>
        <td style="background:#f1f5f9;border-left:4px solid #0891b2;padding:10px 14px;">
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

    // ── Secciones de resultados ───────────────────────
    secciones.forEach(sec => {
        const filas = sec.keys.filter(k => R[k] && R[k] !== 0 && !isNaN(R[k]));
        if (!filas.length) return;

        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td colspan="3" style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${sec.titulo}</span>
            </td>
          </tr>
          <tr style="background:#e2e8f0;">
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:50%;">PARÁMETRO</td>
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:25%;">VALOR</td>
            <td style="padding:4px 10px;font-size:10px;font-weight:bold;color:#64748b;font-family:Arial,sans-serif;width:25%;">RANGO NORMAL</td>
          </tr>`;

        filas.forEach((key, i) => {
            const val = R[key];
            const ev  = (key !== 'superficiecorporal' && key !== 'imc')
                        ? evaluarRango(key, val, edad, edadM)
                        : { enRango: true, rangoTexto: '' };

            let valorTexto = parseFloat(val).toFixed(2);
            if (units[key]) valorTexto += ' ' + units[key];

            const bg    = i % 2 === 0 ? '#ffffff' : '#f8fafc';
            const color = ev.enRango ? '#0891b2' : '#dc2626';

            html += `
          <tr style="background:${bg};">
            <td style="padding:5px 10px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${labels[key]||key}</td>
            <td style="padding:5px 10px;font-size:12px;font-weight:bold;color:${color};font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${valorTexto}</td>
            <td style="padding:5px 10px;font-size:11px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${(ev.rangoTexto || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>          </tr>`;
        });

        html += `</table>`;
    });

    // ── Bloques de texto libre ────────────────────────
    const bloques = [
        { titulo:'SEDIMENTO URINARIO',     texto: get('sedimento_urinario') },
        { titulo:'OTROS',                  texto: get('comentarionutricional') },
        { titulo:'ECOGRAFÍA RENAL',        texto: AppState.ecografiaReportText }
    ];
    bloques.forEach(({ titulo, texto }) => {
        if (!texto || texto === '—') return;
        html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse;">
          <tr>
            <td style="background:#0891b2;padding:6px 10px;">
              <span style="color:#fff;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">${titulo}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;line-height:1.6;border:1px solid #e2e8f0;border-top:none;">${texto}</td>
          </tr>
        </table>`;
    });

    // ── Alertas fuera de rango ────────────────────────
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

    // ── Pie ───────────────────────────────────────────
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

function exportToPDF() {
    if (!AppState.calculatedResults || Object.keys(AppState.calculatedResults).length === 0) {
        return Swal.fire({ icon: 'warning', title: 'Sin informe', text: 'Calcule primero los resultados.' });
    }

    Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const R    = AppState.calculatedResults;
            const edad = AppState.edadEnAños || 0;
            const edadM = AppState.edadEnMeses || 0;

            // ── Paleta ──
            const TEAL  = [8,145,178], RED   = [220,38,38],
                  DARK  = [30,41,59],  GREY  = [100,116,139],
                  LGREY = [226,232,240], WHITE = [255,255,255];

            const margin = 14, pageW = 210, pageH = 297;
            const maxW = pageW - margin * 2;
            let y = 0;

            const newPage = () => { doc.addPage(); y = margin; };
            const check   = (h = 7) => { if (y + h > pageH - 12) newPage(); };

            // ══ CABECERA ══════════════════════════════════
            doc.setFillColor(...TEAL);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(...WHITE);
            doc.setFont('helvetica','bold'); doc.setFontSize(15);
            doc.text('NefroPed', margin, 13);
            doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
            doc.text('Informe de Pruebas Complementarias Pediátricas', margin + 36, 13);
            doc.setFontSize(8);
            doc.text(new Date().toLocaleDateString('es-ES'), pageW - margin, 13, { align:'right' });
            y = 26;

            // ══ DATOS DEL PACIENTE ═════════════════════════
            const get = id => document.getElementById(id)?.value || '—';
            const sexoStr = get('sexo') === 'M' ? 'Masculino' : 'Femenino';

            doc.setFillColor(241,245,249);
            doc.roundedRect(margin, y, maxW, 20, 2, 2, 'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...TEAL);
            doc.text('DATOS DEL PACIENTE', margin+3, y+5.5);
            doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
            doc.text(
                `F. Nacimiento: ${get('fecha_nacimiento')}   F. Analítica: ${get('fecha_analitica')}   Edad: ${edad} años ${edadM} meses`,
                margin+3, y+12
            );
            doc.text(
                `Sexo: ${sexoStr}   Peso: ${get('peso_kg')} kg   Talla: ${get('talla_cm')} cm`,
                margin+3, y+18
            );
            y += 25;

            // ══ DEFINICIÓN DE SECCIONES ═══════════════════
            const labels = {
                superficiecorporal:'Superficie Corporal', imc:'IMC',
                vpercent:'V% creatinina enz/orina',
                schwartzneo:'Schwartz neonatal', schwartzlact:'Schwartz lactante',
                schwartzbedside:'Schwartz Bedside', bokenkamp:'Bökenkamp',
                ekfccr:'EKFC Cr', ekfccistc:'EKFC CistC',
                ckidu25cr:'CKiD U25 Cr', ckidu25cistc:'CKiD U25 CistC',
                ckidu25combinado:'CKiD U25 Combinado',
                efna:'EF Na', efk:'EF K', efcl:'EF Cl', efau:'EF AU',
                cacr:'Ca/Cr', mgcr:'Mg/Cr', pcr:'P/Cr', aucr:'AU/Cr',
                albcr:'Alb/Cr', protcr:'Prot/Cr', citratocr:'Citrato/Cr',
                oxalatocr:'Oxalato/Cr', nak:'Na/K orina', cacitrato:'Ca/Citrato', rtp:'RTP',
                uricosuria:'Uricosuria', calciuria:'Calciuria', citraturia:'Citraturia',
                fosfaturia:'Fosfaturia', magnesuria:'Magnesuria', oxaluria:'Oxaluria',
                albuminuria:'Albuminuria', proteinuria:'Proteinuria',
                proteinuriaestimada:'Proteinuria estimada'
            };
            const units = {
                superficiecorporal:'m2', imc:'kg/m2', vpercent:'%',
                schwartzneo:'ml/min/1.73m2', schwartzlact:'ml/min/1.73m2',
                schwartzbedside:'ml/min/1.73m2', bokenkamp:'ml/min/1.73m2',
                ekfccr:'ml/min/1.73m2', ekfccistc:'ml/min/1.73m2',
                ckidu25cr:'ml/min/1.73m2', ckidu25cistc:'ml/min/1.73m2',
                ckidu25combinado:'ml/min/1.73m2',
                efna:'%', efk:'%', efcl:'%', efau:'%',
                cacr:'mg/mg', mgcr:'mg/mg', pcr:'mg/mg', aucr:'mg/mg',
                albcr:'mg/g', protcr:'mg/g', citratocr:'mg/mg', oxalatocr:'mg/mg',
                nak:'', cacitrato:'', rtp:'%',
                uricosuria:'mg/1.73m2/dia', calciuria:'mg/kg/dia', citraturia:'mg/kg/dia',
                fosfaturia:'mg/kg/dia', magnesuria:'mg/kg/dia', oxaluria:'mg/1.73m2/dia',
                albuminuria:'mg/1.73m2/dia', proteinuria:'mg/m2/dia',
                proteinuriaestimada:'mg/m2/dia'
            };
            const secciones = [
                { titulo:'DATOS GENERALES',
                  keys:['superficiecorporal','imc'] },
                { titulo:'FILTRADO GLOMERULAR — eGFR (ml/min/1.73m2)',
                  keys:['vpercent','schwartzneo','schwartzlact','schwartzbedside','bokenkamp',
                        'ckidu25cr','ekfccr','ckidu25cistc','ekfccistc','ckidu25combinado'] },
                { titulo:'EXCRECIÓN FRACCIONAL',
                  keys:['efna','efk','efcl','efau'] },
                { titulo:'ÍNDICES URINARIOS — ORINA PUNTUAL',
                  keys:['cacr','mgcr','pcr','aucr','albcr','protcr',
                        'citratocr','oxalatocr','nak','cacitrato','rtp'] },
                { titulo:'EXCRECIÓN EN 24 HORAS',
                  keys:['uricosuria','calciuria','citraturia','fosfaturia',
                        'magnesuria','oxaluria','albuminuria','proteinuria','proteinuriaestimada'] }
            ];

            // ══ FILAS DE RESULTADOS ════════════════════════
            const COL_VAL  = margin + 95;
            const COL_RANG = margin + 135;
            let alt = false;

            secciones.forEach(sec => {
                const filas = sec.keys.filter(k => R[k] && R[k] !== 0 && !isNaN(R[k]));
                if (!filas.length) return;

                check(10 + filas.length * 7);

                // Título sección
                doc.setFillColor(...TEAL);
                doc.rect(margin, y, maxW, 7, 'F');
                doc.setFont('helvetica','bold'); doc.setFontSize(8);
                doc.setTextColor(...WHITE);
                doc.text(sec.titulo, margin+3, y+5);
                y += 7;

                // Cabecera columnas
                doc.setFillColor(...LGREY);
                doc.rect(margin, y, maxW, 5.5, 'F');
                doc.setFont('helvetica','bold'); doc.setFontSize(7);
                doc.setTextColor(...GREY);
                doc.text('PARÁMETRO', margin+3, y+4);
                doc.text('VALOR', COL_VAL, y+4);
                doc.text('RANGO NORMAL', COL_RANG, y+4);
                y += 5.5;

                alt = false;
                filas.forEach(key => {
                    check(7);
                    const val  = R[key];
                    const ev   = (key!=='superficiecorporal' && key!=='imc')
                                  ? evaluarRango(key, val, edad, edadM)
                                  : { enRango:true, rangoTexto:'' };
                    // Construir valorTexto sin caracteres Unicode problemáticos
                    let valorTexto = parseFloat(val).toFixed(2);
                    if (units[key]) valorTexto += ' ' + units[key];
                    // Sin ▲▼: el color rojo ya indica fuera de rango

                    const rangStr = ev.rangoTexto || '—';

                    if (alt) { doc.setFillColor(248,250,252); doc.rect(margin,y,maxW,6.5,'F'); }
                    alt = !alt;

                    // Nombre
                    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                    doc.setTextColor(...DARK);
                    doc.text(labels[key]||key, margin+3, y+4.5);

                    // Valor (✅ ahora en un solo bloque de texto)
                    doc.setFont('helvetica','bold');
                    if (ev.enRango) {
                        doc.setTextColor(...TEAL);
                    } else {
                        doc.setTextColor(...RED);
                    }
                    doc.text(valorTexto, COL_VAL, y+4.5);

                    // Rango
                    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
                    doc.setTextColor(...GREY);
                    doc.text(rangStr, COL_RANG, y+4.5);

                    // Separador
                    doc.setDrawColor(...LGREY); doc.setLineWidth(0.1);
                    doc.line(margin, y+6.5, pageW-margin, y+6.5);
                    y += 6.5;
                });
                y += 4;
            });

            // ══ BLOQUE DE TEXTO LIBRE ══════════════════════
            const bloques = [
                { titulo:'SEDIMENTO URINARIO',     texto: get('sedimento_urinario') },
                { titulo:'OTROS',                  texto: get('comentarionutricional') },
                { titulo:'ECOGRAFÍA RENAL',        texto: AppState.ecografiaReportText }
            ];
            bloques.forEach(({ titulo, texto }) => {
                if (!texto || texto === '—') return;
                check(18);
                doc.setFillColor(...TEAL);
                doc.rect(margin, y, maxW, 7, 'F');
                doc.setFont('helvetica','bold'); doc.setFontSize(8);
                doc.setTextColor(...WHITE);
                doc.text(titulo, margin+3, y+5);
                y += 13; // ← antes era 9, insuficiente para la línea base tipográfica
                doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                doc.setTextColor(...DARK);
                const lineas = doc.splitTextToSize(texto, maxW-4);
                lineas.forEach(l => {
                    check(6);
                    doc.text(l, margin+2, y);
                    y += 5.5;
                });
                y += 3;
         });
            // ══ RESUMEN ALERTAS ════════════════════════════
            if (AppState.valoresFueraRango?.length > 0) {
                const bH = 10 + AppState.valoresFueraRango.length * 5.5;
                check(bH);
                doc.setFillColor(254,242,242);
                doc.roundedRect(margin, y, maxW, bH, 2, 2, 'F');
                doc.setDrawColor(...RED); doc.setLineWidth(0.4);
                doc.roundedRect(margin, y, maxW, bH, 2, 2, 'S');
                doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
                doc.setTextColor(...RED);
                doc.text('⚠  VALORES FUERA DE RANGO', margin+4, y+6.5);
                y += 10;
                doc.setFont('helvetica','normal'); doc.setFontSize(8);
                AppState.valoresFueraRango.forEach(v => {
                    doc.text('• '+v, margin+6, y); y += 5.5;
                });
            }

            // ══ PIE DE PÁGINA ══════════════════════════════
            const total = doc.internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setDrawColor(...LGREY); doc.setLineWidth(0.3);
                doc.line(margin, pageH-10, pageW-margin, pageH-10);
                doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
                doc.setTextColor(...GREY);
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
                html: '<div style="font-size: 15px; text-align: left; line-height: 1.6;">Para añadir esta calculadora a tu móvil:<br><br><b>1.</b> Toca el botón <b>Compartir</b> <i class="fas fa-share-square" style="font-size: 18px; color: #0891b2;"></i> en la barra inferior de Safari.<br><b>2.</b> Selecciona <b>"Añadir a la pantalla de inicio"</b> <i class="fas fa-plus-square" style="font-size: 18px; color: #0891b2;"></i>.</div>',                icon: 'info',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#0891b2',
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

const obryckiLMS = [
    { min: 0, max: 54.9, L: 0.567, M: 50.4, S: 0.0844 },
    { min: 55, max: 59.9, L: 0.532, M: 52.9, S: 0.0836 },
    { min: 60, max: 64.9, L: 0.498, M: 55.4, S: 0.0828 },
    { min: 65, max: 69.9, L: 0.458, M: 58.3, S: 0.0820 },
    { min: 70, max: 74.9, L: 0.423, M: 60.8, S: 0.0812 },
    { min: 75, max: 79.9, L: 0.387, M: 63.3, S: 0.0804 },
    { min: 80, max: 84.9, L: 0.352, M: 65.7, S: 0.0797 },
    { min: 85, max: 89.9, L: 0.312, M: 68.3, S: 0.0788 },
    { min: 90, max: 94.9, L: 0.276, M: 70.6, S: 0.0781 },
    { min: 95, max: 99.9, L: 0.237, M: 73.0, S: 0.0773 },
    { min: 100, max: 104.9, L: 0.200, M: 75.2, S: 0.0765 },
    { min: 105, max: 109.9, L: 0.165, M: 77.2, S: 0.0758 },
    { min: 110, max: 114.9, L: 0.131, M: 79.1, S: 0.0751 },
    { min: 115, max: 119.9, L: 0.090, M: 81.4, S: 0.0743 },
    { min: 120, max: 124.9, L: 0.052, M: 83.5, S: 0.0735 },
    { min: 125, max: 129.9, L: 0.015, M: 85.6, S: 0.0728 },
    { min: 130, max: 134.9, L: -0.022, M: 87.8, S: 0.0721 },
    { min: 135, max: 139.9, L: -0.058, M: 89.9, S: 0.0714 },
    { min: 140, max: 144.9, L: -0.093, M: 92.1, S: 0.0707 },
    { min: 145, max: 149.9, L: -0.131, M: 94.5, S: 0.0700 },
    { min: 150, max: 154.9, L: -0.168, M: 97.0, S: 0.0693 },
    { min: 155, max: 159.9, L: -0.207, M: 99.6, S: 0.0686 },
    { min: 160, max: 164.9, L: -0.243, M: 102.1, S: 0.0680 },
    { min: 165, max: 169.9, L: -0.279, M: 104.5, S: 0.0673 },
    { min: 170, max: 174.9, L: -0.315, M: 106.9, S: 0.0667 },
    { min: 175, max: 179.9, L: -0.353, M: 109.5, S: 0.0660 },
    { min: 180, max: 184.9, L: -0.389, M: 111.9, S: 0.0654 },
    { min: 185, max: 189.9, L: -0.427, M: 114.5, S: 0.0647 },
    { min: 190, max: 194.9, L: -0.461, M: 116.8, S: 0.0641 },
    { min: 195, max: 199.9, L: -0.486, M: 118.5, S: 0.0637 },
    { min: 200, max: 300.0, L: -0.538, M: 122.0, S: 0.0628 }
];

function zScoreToPercentile(z) {
    if (z === 0.0) return 50;
    let b1 = 0.31938153, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
    let p = 0.2316419, c = 0.39894228;
    let t = 1.0 / (1.0 + p * Math.abs(z));
    let cdf = 1.0 - c * Math.exp(-z * z / 2.0) * t * (t *(t *(t *(t * b5 + b4) + b3) + b2) + b1);
    if (z < 0) cdf = 1.0 - cdf;
    return Math.round(cdf * 100);
}

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



