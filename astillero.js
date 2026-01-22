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
            <div class="ship-img-container"><img src="${ship.img}" class="ship-img"></div>
            <div class="ship-info">
                <h3 style="color:var(--neon-blue); font-size:0.9rem;">${ship.name}</h3>
                <p style="font-size:0.7rem;">M: ${ship.metal} | S: ${ship.silicio} | T: ${ship.time}s</p>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <input type="number" id="qty-${ship.id}" class="forum-input" value="1" min="1" style="width:60px; background:black; border:1px solid #333; color:white;">
                    <button class="nav-btn" onclick="ordenarNave('${ship.id}')">CONSTRUIR</button>
                </div>
            </div>
        </div>`).join('');
}

async function ordenarNave(id) {
    const qtyInput = document.getElementById(`qty-${id}`);
    const qty = parseInt(qtyInput.value);
    
    if (isNaN(qty) || qty <= 0) return alert("Cantidad no válida");

    const ship = NAVES_DISPONIBLES.find(s => s.id === id);
    const costM = ship.metal * qty;
    const costS = ship.silicio * qty;

    // 1. Verificación usando las globales de game.js
    if (userResources.metal >= costM && userResources.silicio >= costS) {
        
        // 2. EFECTO VISUAL: Animamos la resta en los contadores
        if (typeof animarResta === 'function') {
            animarResta('res-metal', costM);
            animarResta('res-silice', costS);
        }

        // 3. Descuento inmediato en el objeto local (para que el motor visual lo vea)
        userResources.metal -= costM;
        userResources.silicio -= costS;

        const { data: { user } } = await supabaseClient.auth.getUser();
        
        // 4. Actualización en Supabase
        await supabaseClient.from('players').update({ 
            metal: userResources.metal, 
            silicio: userResources.silicio 
        }).eq('id', user.id);

        // 5. Gestión de Cola
        let baseTime = new Date();
        if (shipQueue.length > 0) baseTime = new Date(shipQueue[shipQueue.length - 1].finish_at);
        const finishAt = new Date(baseTime.getTime() + (ship.time * qty * 1000)).toISOString();

        await supabaseClient.from('ship_queue').insert([{ 
            user_id: user.id, 
            ship_id: ship.id, 
            quantity: qty, 
            finish_at: finishAt 
        }]);
        
        syncShipQueueFromDB();
    } else {
        alert("¡Recursos insuficientes para la flota!");
    }
}

// ... Las funciones syncShipQueueFromDB, processShipQueue y loadHangar se mantienen igual ...
// Solo asegúrate de llamar a renderAstillero() y syncShipQueueFromDB() al cargar la sección.
