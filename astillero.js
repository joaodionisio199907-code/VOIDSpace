// astillero.js

const NAVES_DISPONIBLES = [
    { id: 'cazador_l', name: 'CAZADOR LIGERO', metal: 3000, silicio: 1000, time: 15, img: 'img/ships/interceptorarpía/interceptorarpía.png' },
    { id: 'carguero_p', name: 'CARGUERO PEQUEÑO', metal: 2000, silicio: 2000, time: 25, img: 'img/ships/interceptorarpía/johnscargo1.png' }
];

let shipQueue = [];
let shipTimerInterval = null;

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
                    <input type="number" id="qty-${ship.id}" class="forum-input" value="1" min="1" style="width:60px; padding:2px 5px; background:rgba(0,0,0,0.5); border:1px solid var(--neon-blue); color:white;">
                    <button class="nav-btn" onclick="ordenarNave('${ship.id}')" style="font-size:0.65rem; padding:5px;">CONSTRUIR</button>
                </div>
            </div>
        </div>`).join('');
}

async function ordenarNave(id) {
    // Usamos las variables globales de game.js
    const qtyInput = document.getElementById(`qty-${id}`);
    const qty = parseInt(qtyInput.value);
    
    if (isNaN(qty) || qty <= 0) return alert("Cantidad no válida");

    const ship = NAVES_DISPONIBLES.find(s => s.id === id);
    const costM = ship.metal * qty;
    const costS = ship.silicio * qty;

    // Validación contra el estado global unificado
    if (userResources.metal >= costM && userResources.silicio >= costS) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        // Descontar recursos en la tabla maestra 'players'
        const { error } = await supabaseClient.from('players').update({ 
            metal: userResources.metal - costM, 
            silicio: userResources.silicio - costS 
        }).eq('id', user.id);
        
        if (!error) {
            // Actualizar localmente para feedback inmediato
            userResources.metal -= costM;
            userResources.silicio -= costS;
            actualizarUI(); // Función de game.js

            // Lógica de cola
            let baseTime = new Date();
            if (shipQueue.length > 0) {
                const lastShip = shipQueue[shipQueue.length - 1];
                baseTime = new Date(lastShip.finish_at);
            }
            
            const finishAt = new Date(baseTime.getTime() + (ship.time * qty * 1000)).toISOString();

            await supabaseClient.from('ship_queue').insert([{ 
                user_id: user.id, 
                ship_id: ship.id, 
                quantity: qty, 
                finish_at: finishAt 
            }]);
            
            syncShipQueueFromDB();
        }
    } else { 
        alert(`Recursos insuficientes.`); 
    }
}

async function syncShipQueueFromDB() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data } = await supabaseClient.from('ship_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('finish_at', { ascending: true });
    
    shipQueue = data || [];
    updateShipQueueUI();
    
    if (shipQueue.length > 0 && !shipTimerInterval) {
        processShipQueue();
    }
}

function updateShipQueueUI() {
    const container = document.getElementById('ship-queue-list');
    if (!container) return;
    
    if (shipQueue.length === 0) {
        container.innerHTML = "<div class='empty-queue'>ASTILLERO INACTIVO</div>";
        return;
    }

    container.innerHTML = shipQueue.map((q, i) => {
        const ship = NAVES_DISPONIBLES.find(s => s.id === q.ship_id);
        const isFirst = i === 0;
        return `
        <div class="queue-item ${isFirst ? 'active' : ''}">
            <div class="queue-info">
                <span>${q.quantity}x ${ship.name}</span>
                <span id="timer-txt-${q.id}">${isFirst ? 'Procesando...' : 'En espera'}</span>
            </div>
            ${isFirst ? `<div class="ship-progress-bg"><div class="ship-progress-fill" id="fill-${q.id}"></div></div>` : ''}
        </div>`;
    }).join('');
}

function processShipQueue() {
    if (shipQueue.length === 0) return;

    shipTimerInterval = setInterval(async () => {
        const current = shipQueue[0];
        if (!current) {
            clearInterval(shipTimerInterval);
            shipTimerInterval = null;
            return;
        }

        const restante = Math.floor((new Date(current.finish_at) - new Date()) / 1000);
        const timerEl = document.getElementById(`timer-txt-${current.id}`);
        const fillEl = document.getElementById(`fill-${current.id}`);

        if (restante > 0) {
            if (timerEl) timerEl.innerText = `${restante}s`;
            if (fillEl) {
                const ship = NAVES_DISPONIBLES.find(s => s.id === current.ship_id);
                const totalSecs = ship.time * current.quantity;
                const porc = ((totalSecs - restante) / totalSecs) * 100;
                fillEl.style.width = `${Math.min(100, porc)}%`;
            }
        } else {
            clearInterval(shipTimerInterval);
            shipTimerInterval = null;
            
            // Finalizar nave
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
    
    container.innerHTML = (fleet || []).map(item => `
        <div class="hangar-item">
            <img src="${NAVES_DISPONIBLES.find(n => n.id === item.ship_id)?.img}" style="width:30px; height:30px; border-radius:4px;">
            <div class="hangar-info">
                <span class="ship-name">${item.ship_id.replace('_', ' ').toUpperCase()}</span>
                <span class="ship-qty">${item.quantity}</span>
            </div>
        </div>`).join('');
}

async function registrarNaveEnBD(shipId, quantity) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Intentar obtener si ya existe esa nave
    const { data: existing } = await supabaseClient.from('user_fleet')
        .select('*')
        .eq('user_id', user.id)
        .eq('ship_id', shipId)
        .single();

    if (existing) {
        await supabaseClient.from('user_fleet')
            .update({ quantity: existing.quantity + quantity })
            .eq('id', existing.id);
    } else {
        await supabaseClient.from('user_fleet')
            .insert([{ user_id: user.id, ship_id: shipId, quantity: quantity }]);
    }
}
