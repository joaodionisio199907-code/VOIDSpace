// --- VARIABLES GLOBALES ---
let userResources = { metal: 0, silicio: 0, deuterio: 0 };
let userBuildings = { mina_metal: 0, mina_silicio: 0, mina_deuterio: 0, laboratorio: 0 };
let upgradeActive = { type: null, finish_at: null };
let timerInterval = null; 

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

        actualizarUI();
        if (upgradeActive.finish_at) iniciarRelojConstruccion();
    }
}

// --- 2. RENDERIZADO DE LISTAS (La función que faltaba) ---
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
                    <p style="font-size:0.8rem; opacity:0.7; margin: 10px 0;">${b.lore || ''}</p>
                    <button class="nav-btn" id="btn-upgrade-${dbType}" 
                            onclick="mejorarEdificio('${b.id}')" 
                            ${upgradeActive.type ? 'disabled' : ''} 
                            style="width:100%; text-align:center;">
                        ${estaMejorando ? 'CONSTRUYENDO...' : `MEJORAR (${costo} ${simbolo})`}
                    </button>
                </div>
            </div>`;
    });
    container.innerHTML = htmlContent;
}

// --- 3. PRODUCCIÓN PASIVA ---
setInterval(async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user || upgradeActive.type) return; 

    let prodM = (userBuildings.mina_metal * 10);  
    let prodS = (userBuildings.mina_silicio * 5);
    let prodD = (userBuildings.mina_deuterio * 2);

    userResources.metal += prodM;
    userResources.silicio += prodS;
    userResources.deuterio += prodD;

    await supabaseClient.from('players').update({
        metal: userResources.metal,
        silicio: userResources.silicio,
        deuterio: userResources.deuterio
    }).eq('id', user.id);

    actualizarUI();
}, 10000);

// --- 4. GESTIÓN DE CONSTRUCCIÓN ---
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
    const { data: { user } } = await supabaseClient.auth.getUser();

    const updates = { 
        [recurso]: userResources[recurso] - costo,
        building_upgrading: dbType,
        finish_at: finishAt
    };

    await supabaseClient.from('players').update(updates).eq('id', user.id);

    userResources[recurso] -= costo;
    upgradeActive = { type: dbType, finish_at: finishAt };
    
    actualizarUI();
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

    upgradeActive = { type: null, finish_at: null };
    iniciarJuego(); 
}

function actualizarUI() {
    document.getElementById('res-metal').innerText = Math.floor(userResources.metal);
    document.getElementById('res-silice').innerText = Math.floor(userResources.silicio);
    document.getElementById('res-deuterio').innerText = Math.floor(userResources.deuterio);
    
    renderList('resources');
    renderList('research');
}

iniciarJuego();
