// --- VOID ECHOS ANTI-CHEAT SYSTEM ---

const AntiCheat = {
    // 1. Validar que ninguna cantidad sea negativa
    isValidAmount: function(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) return false;
        if (amount < 0) {
            console.error("Detección Anti-Cheat: Intento de valor negativo.");
            return false;
        }
        return true;
    },

    // 2. Ofuscar ligeramente las variables en memoria para que no sea tan fácil cambiarlas por consola
    init: function() {
        console.log("🛡️ Sistema Anti-Cheat activado.");
        
        // Bloquear clic derecho (opcional, para dificultar inspección)
        /*
        document.addEventListener('contextmenu', event => event.preventDefault());
        */

        // Detectar si la consola está abierta (truco de depuración)
        let checkStatus = false;
        const devtools = /./;
        devtools.toString = function() {
            checkStatus = true;
        };
        console.log('%c', devtools);
    }
};

// Ejecutar al cargar
AntiCheat.init();