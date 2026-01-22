// astillero.js

// 1. Configuración de naves
const NAVES_DISPONIBLES = [
    { id: 'cazador_l', name: 'CAZADOR LIGERO', metal: 3000, silicio: 1000, time: 15, img: 'img/ships/interceptorarpía/interceptorarpía.png' },
    { id: 'carguero_p', name: 'CARGUERO PEQUEÑO', metal: 2000, silicio: 2000, time: 25, img: 'img/ships/interceptorarpía/johnscargo1.png' }
];

let shipQueue = [];
let shipTimerInterval = null;

// 2. Renderizado del Astillero
function renderAstillero() {
    const container = document.getElementById('fleet-list-container');
    if (!container) return;
    container.innerHTML = NAVES_DISPONIBLES.map(ship => `
        <div class="ship-card">
            <div class="ship-img-container"><div class="scan-effect"></div><img src="${ship.img}" class="ship-img"></div>
            <div class="ship-info">
                <h3 style="color:var(--neon-blue); font-size:0.9rem;">${ship.name}</h3>
                <p style="font-size:0.7rem;">M: ${ship.metal} | S: ${ship.silicio} | T: ${ship.time}s</p>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <input type="number" id="qty-${ship.id}" class="forum-input" value="1" min="1" style="width:60px; padding:2px 5px;">
                    <button class="nav-btn" onclick="ordenarNave('${ship.id}')" style="font-size:0.65rem; padding:5px;">CONSTRUIR</button>
                </div>
            </div>
        </div>`).join('');
}

// 3. Lógica de construcción
async function ordenarNave(id) {
    const qty = parseInt(document.getElementById(`qty-${id}`).value);
    if (!typeof AntiCheat === 'undefined' && !AntiCheat.isValidAmount(qty) || qty <= 0) return alert("Cantidad no válida");

    const ship = NAVES_DISPONIBLES.find(s => s.id === id);
    const costM = ship.metal * qty;
    const costS = ship.silicio * qty;

    if (userResources.metal >= costM && userResources.silicio >= costS) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { error } = await supabaseClient.from('players').update({ 
            metal: userResources.metal - costM, 
            silicio: userResources.silicio - costS 
        }).eq('id', user.id);
        
        if (!error) {
            if(typeof animarResta === 'function') {
                animarResta('res-metal', costM);
                animarResta('res-silice', costS);
            }
            userResources.metal -= costM;
            userResources.silicio -= costS;
            actualizarInterfazRecursos();

            let baseTime = new Date();
            if (shipQueue.length > 0) baseTime = new Date(shipQueue[shipQueue.length-1].finish_at);
            const finishAt = new Date(baseTime.getTime() + (ship.time * qty * 1000)).toISOString();

            await supabaseClient.from('ship_queue').insert([{ user_id: user.id, ship_id: ship.id, quantity: qty, finish_at: finishAt }]);
            syncShipQueueFromDB();
        }
    } else { alert("Recursos insuficientes"); }
}

// 4. Gestión de Cola y Base de Datos
async function syncShipQueueFromDB() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data } = await supabaseClient.from('ship_queue').select('*').eq('user_id', user.id).order('finish_at', { ascending: true });
    shipQueue = data || [];
    updateShipQueueUI();
    if (shipQueue.length > 0 && !shipTimerInterval) processShipQueue();
}

function updateShipQueueUI() {
    const container = document.getElementById('ship-queue-list');
    if (!container) return;
    if (shipQueue.length === 0) {
        container.innerHTML = "<p style='text-align:center; opacity:0.4; font-size:0.8rem; padding:20px;'>ASTILLERO INACTIVO</p>";
        return;
    }
    container.innerHTML = shipQueue.map((q, i) => {
        const ship = NAVES_DISPONIBLES.find(s => s.id === q.ship_id) || { name: q.ship_id };
        return `
        <div class="queue-item">
            <div style="font-size:0.8rem;">${q.quantity}x ${ship.name}</div>
            ${i === 0 
                ? `<div id="timer-txt-${q.id}" style="font-size:0.6rem; color:var(--neon-blue)">Iniciando...</div>
                   <div class="ship-progress-bg"><div class="ship-progress-fill" id="fill-${q.id}" style="width:0%"></div></div>` 
                : '<div style="font-size:0.6rem; color:gray">En espera...</div>'}
        </div>`;
    }).join('');
}

function processShipQueue() {
    if (shipQueue.length === 0) return;
    shipTimerInterval = setInterval(async () => {
        const current = shipQueue[0];
        if (!current) { clearInterval(shipTimerInterval); shipTimerInterval = null; return; }

        const restante = Math.floor((new Date(current.finish_at) - new Date()) / 1000);
        const timerEl = document.getElementById(`timer-txt-${current.id}`);
        const fillEl = document.getElementById(`fill-${current.id}`);

        if (timerEl) timerEl.innerText = `${restante}s restantes`;
        if (fillEl) {
            const ship = NAVES_DISPONIBLES.find(s => s.id === current.ship_id);
            const totalSecs = ship.time * current.quantity;
            const porc = ((totalSecs - restante) / totalSecs) * 100;
            fillEl.style.width = `${Math.min(100, porc)}%`;
        }

        if (restante <= 0) {
            clearInterval(shipTimerInterval);
            shipTimerInterval = null;
            await registrarNaveEnBD(current.ship_id, current.quantity);
            await supabaseClient.from('ship_queue').delete().eq('id', current.id);
            syncShipQueueFromDB();
            loadHangar();
        }
    }, 1000);
}

async function loadHangar() {
    const container = document.getElementById('hangar-grid');
    if(!container) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: fleet } = await supabaseClient.from('user_fleet').select('*').eq('user_id', user.id);
    container.innerHTML = (fleet || []).map(item => `<div class="hangar-item"><b>${item.ship_id.toUpperCase()}</b><span>${item.quantity}</span></div>`).join('');
}

async function registrarNaveEnBD(shipId, quantity) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: existing } = await supabaseClient.from('user_fleet').select('*').eq('user_id', user.id).eq('ship_id', shipId).single();
    if (existing) {
        await supabaseClient.from('user_fleet').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    } else {
        await supabaseClient.from('user_fleet').insert([{ user_id: user.id, ship_id: shipId, quantity: quantity }]);
    }
}