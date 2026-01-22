// --- VARIABLES GLOBALES ---
let userResources = { metal: 0, silicio: 0, deuterio: 0 };
let userBuildings = { mina_metal: 0, mina_silicio: 0, mina_deuterio: 0, laboratorio: 0 };
let upgradeActive = { type: null, finish_at: null };
let timerInterval = null; // Para controlar el reloj de construcción

// --- CONFIGURACIÓN (Mantenemos tus stats) ---
const DATA_VISUAL_EDIFICIOS = [
    { id: 'minaFe', section: 'resources', name: 'Mina de Ferrum', db: 'mina_metal' },
    { id: 'minaSi', section: 'resources', name: 'Sintetizador de Sílice', db: 'mina_silicio' },
    { id: 'minaH3', section: 'resources', name: 'Colector de Isótopo-H3', db: 'mina_deuterio' },
    { id: 'labInvestigacion', section: 'research', name: 'Laboratorio Alfa', db: 'laboratorio' }
];

// --- 1. CARGA INICIAL (Solo una vez al abrir) ---
async function iniciarJuego() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();
    
    if (player) {
        // Mapear datos de la nueva tabla players
        userBuildings = {
            mina_metal: player.lvl_mina_metal || 0,
            mina_silicio: player.lvl_mina_silicio || 0,
            mina_deuterio: player.lvl_mina_deuterio || 0,
            laboratorio: player.lvl_laboratorio || 0
        };
        userResources = { metal: player.metal, silicio: player.silicio, deuterio: player.deuterio };
        upgradeActive = { type: player.building_upgrading, finish_at: player.finish_at };

        renderList('resources');
        renderList('research');
        actualizarUI();

        // Si hay una mejora pendiente, arrancar el reloj
        if (upgradeActive.finish_at) iniciarRelojConstruccion();
    }
}

// --- 2. PRODUCCIÓN PASIVA (Cada 10s sin recargar toda la UI) ---
setInterval(async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user || upgradeActive.type) return; // Si está mejorando, no sumamos aquí para evitar conflictos

    // Calculamos según niveles actuales
    let prodM = (userBuildings.mina_metal * 10); 
    let prodS = (userBuildings.mina_silicio * 5);
    let prodD = (userBuildings.mina_deuterio * 2);

    userResources.metal += prodM;
    userResources.silicio += prodS;
    userResources.deuterio += prodD;

    // Guardar en BD silenciosamente
    await supabaseClient.from('players').update({
        metal: userResources.metal,
        silicio: userResources.silicio,
        deuterio: userResources.deuterio
    }).eq('id', user.id);

    actualizarUI();
}, 10000);

// --- 3. GESTIÓN DE CONSTRUCCIÓN ---
async function mejorarEdificio(gameId) {
    if (upgradeActive.type) return;

    const bInfo = DATA_VISUAL_EDIFICIOS.find(x => x.id === gameId);
    const dbType = bInfo.db;
    const nivelActual = userBuildings[dbType];
    const costo = Math.floor(100 * Math.pow(1.5, nivelActual));
    const tiempo = (nivelActual + 1) * 10;

    const esIsotopo = (dbType === "mina_deuterio");
    const recurso = esIsotopo ? 'silicio' : 'metal';

    if (userResources[recurso] < costo) return alert("Faltan recursos");

    const finishAt = new Date(Date.now() + tiempo * 1000).toISOString();

    // Actualizar BD: Restar recurso y poner en cola
    const updates = { 
        [recurso]: userResources[recurso] - costo,
        building_upgrading: dbType,
        finish_at: finishAt
    };

    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from('players').update(updates).eq('id', user.id);

    // Actualizar estado local y arrancar
    userResources[recurso] -= costo;
    upgradeActive = { type: dbType, finish_at: finishAt };
    
    renderList('resources');
    renderList('research');
    iniciarRelojConstruccion();
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
    const columnaLvl = `lvl_${dbType}`;

    await supabaseClient.from('players').update({
        [columnaLvl]: nuevoNivel,
        building_upgrading: null,
        finish_at: null
    }).eq('id', user.id);

    // Resetear estado y refrescar todo
    upgradeActive = { type: null, finish_at: null };
    iniciarJuego(); 
}

function actualizarUI() {
    document.getElementById('res-metal').innerText = Math.floor(userResources.metal);
    document.getElementById('res-silice').innerText = Math.floor(userResources.silicio);
    document.getElementById('res-deuterio').innerText = Math.floor(userResources.deuterio);
}

// Arrancar
iniciarJuego();
