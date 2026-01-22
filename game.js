// --- VARIABLES GLOBALES ---
let userResources = { metal: 0, silicio: 0, deuterio: 0 };
let userBuildings = { mina_metal: 0, mina_silicio: 0, mina_deuterio: 0, laboratorio: 0 };
let upgradeActive = { type: null, finish_at: null };
let timerInterval = null; 

// Nuevas variables para el motor de fluidez
let prodPorSegundo = { metal: 0, silicio: 0, deuterio: 0 };
let lastUpdate = Date.now();

// --- CONFIGURACIÓN ---
const DATA_VISUAL_EDIFICIOS = [
    { id: 'minaFe', section: 'resources', name: 'Mina de Ferrum', db: 'mina_metal', lore: 'Extractor de mineral ferroso.', img: 'img/minaferrum/lv1/lv1.png' },
    { id: 'minaSi', section: 'resources', name: 'Sintetizador de Sílice', db: 'mina_silicio', lore: 'Procesa arena estelar.', img: 'img/SILICE/sintesili.png' },
    { id: 'minaH3', section: 'resources', name: 'Colector de Isótopo-H3', db: 'mina_deuterio', lore: 'Extrae Deuterio atmosférico.', img: 'img/isotopoh3/ih3recolector.png' },
    { id: 'labInvestigacion', section: 'research', name: 'Laboratorio Alfa', db: 'laboratorio', lore: 'Desbloquea nuevas tecnologías.', img: 'img/lab.png' }
];

// --- 1. CARGA INICIAL ---
async function iniciarJuego() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();
    
    if (player) {
        userBuildings = {
            mina_metal: player.lvl_mina_metal || 0,
            mina_silicio: player.lvl_mina_silicio || 0,
            mina_deuterio: player.lvl_mina_deuterio || 0,
            laboratorio: player.lvl_laboratorio || 0
        };
        userResources = { metal: player.metal, silicio: player.silicio, deuterio: player.deuterio };
        upgradeActive = { type: player.building_upgrading, finish_at: player.finish_at };

        // Calcular producción por segundo real
        prodPorSegundo.metal = (userBuildings.mina_metal * 10) / 10;
        prodPorSegundo.silicio = (userBuildings.mina_silicio * 5) / 10;
        prodPorSegundo.deuterio = (userBuildings.mina_deuterio * 2) / 10;

        actualizarUI();
        if (upgradeActive.finish_at) iniciarRelojConstruccion();
        
        // Lanzar el motor de fluidez
        requestAnimationFrame(motorRecursosVisuales);
    }
}

// --- 2. MOTOR DE RECURSOS FLUIDO (Sin Lag) ---
function motorRecursosVisuales() {
    const ahora = Date.now();
    const dt = (ahora - lastUpdate) / 1000; // Segundos transcurridos
    lastUpdate = ahora;

    // Sumar producción al estado local (solo si no estamos "congelados" por una mejora)
    userResources.metal += prodPorSegundo.metal * dt;
    userResources.silicio += prodPorSegundo.silicio * dt;
    userResources.deuterio += prodPorSegundo.deuterio * dt;

    // Actualizar números en pantalla (sin decimales para el usuario)
    document.getElementById('res-metal').innerText = Math.floor(userResources.metal);
    document.getElementById('res-silice').innerText = Math.floor(userResources.silicio);
    document.getElementById('res-deuterio').innerText = Math.floor(userResources.deuterio);

    requestAnimationFrame(motorRecursosVisuales);
}

// --- 3. ANIMACIONES DE GASTO ---
function animarResta(idElemento, cantidad) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    
    const flotante = document.createElement('div');
    flotante.innerText = `-${Math.floor(cantidad)}`;
    flotante.className = "recurso-anim-negativa";
    flotante.style.left = `${rect.left + 10}px`;
    flotante.style.top = `${rect.top}px`;
    
    document.body.appendChild(flotante);
    setTimeout(() => flotante.remove(), 1000);
}

// --- 4. GESTIÓN DE CONSTRUCCIÓN ---
async function mejorarEdificio(gameId) {
    if (upgradeActive.type) return;

    const bInfo = DATA_VISUAL_EDIFICIOS.find(x => x.id === gameId);
    const dbType = bInfo.db;
    const nivelActual = userBuildings[dbType];
    const costo = Math.floor(100 * Math.pow(1.5, nivelActual));
    const tiempo = (nivelActual + 1) * 10;

    const esIsotopo = (dbType === "mina_deuterio");
    const idRes = esIsotopo ? 'res-silice' : 'res-metal';
    const recurso = esIsotopo ? 'silicio' : 'metal';

    if (userResources[recurso] < costo) return alert("Recursos insuficientes");

    // ANIMACIÓN Y DESCUENTO
    animarResta(idRes, costo);
    userResources[recurso] -= costo;

    const finishAt = new Date(Date.now() + tiempo * 1000).toISOString();
    const { data: { user } } = await supabaseClient.auth.getUser();

    await supabaseClient.from('players').update({ 
        [recurso]: userResources[recurso],
        building_upgrading: dbType,
        finish_at: finishAt
    }).eq('id', user.id);

    upgradeActive = { type: dbType, finish_at: finishAt };
    actualizarUI();
    iniciarRelojConstruccion();
}

// --- 5. SINCRONIZACIÓN DE SEGURIDAD (Cada 30s guarda en BD) ---
setInterval(async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    
    await supabaseClient.from('players').update({
        metal: userResources.metal,
        silicio: userResources.silicio,
        deuterio: userResources.deuterio
    }).eq('id', user.id);
    console.log("Reserva sincronizada con el Comando Central.");
}, 30000);

// --- RESTO DE FUNCIONES (renderList, iniciarReloj, etc.) ---
function renderList(section) {
    const container = document.getElementById(section + '-list');
    if (!container) return;
    let htmlContent = '';
    DATA_VISUAL_EDIFICIOS.filter(b => b.section === section).forEach(b => {
        const dbType = b.db;
        const nivel = userBuildings[dbType];
        const costo = Math.floor(100 * Math.pow(1.5, nivel));
        const simbolo = (dbType === "mina_deuterio") ? "Si" : "Fe";
        const estaMejorando = upgradeActive.type === dbType;
        htmlContent += `
            <div class="building-card">
                <img src="${b.img}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://placehold.co/300x160?text=${b.name}'">
                <div class="building-info">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <h3 style="color:var(--neon-blue); font-size:1rem;">${b.name}</h3>
                        <span style="background:rgba(0,242,255,0.1); padding:2px 8px; border-radius:4px; font-size:0.8rem;">LVL ${nivel}</span>
                    </div>
                    <button class="nav-btn" id="btn-upgrade-${dbType}" onclick="mejorarEdificio('${b.id}')" ${upgradeActive.type ? 'disabled' : ''} style="width:100%; margin-top:10px;">
                        ${estaMejorando ? 'CONSTRUYENDO...' : `MEJORAR (${costo} ${simbolo})`}
                    </button>
                </div>
            </div>`;
    });
    container.innerHTML = htmlContent;
}

function iniciarRelojConstruccion() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const restante = Math.floor((new Date(upgradeActive.finish_at) - new Date()) / 1000);
        const btn = document.getElementById(`btn-upgrade-${upgradeActive.type}`);
        if (restante > 0) {
            if (btn) btn.innerHTML = `<i class="fas fa-hourglass-half"></i> ${restante}s`;
        } else {
            clearInterval(timerInterval);
            finalizarConstruccion();
        }
    }, 1000);
}

async function finalizarConstruccion() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const dbType = upgradeActive.type;
    const nuevoNivel = userBuildings[dbType] + 1;
    await supabaseClient.from('players').update({
        [`lvl_${dbType}`]: nuevoNivel,
        building_upgrading: null,
        finish_at: null
    }).eq('id', user.id);
    upgradeActive = { type: null, finish_at: null };
    iniciarJuego(); 
}

function actualizarUI() {
    renderList('resources');
    renderList('research');
}

iniciarJuego();
