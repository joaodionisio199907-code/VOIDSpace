<?php
class Ship {
    public $name;
    public $baseAttack;
    public $level;
    public $pilotsNeeded;

    public function __construct($name, $baseAttack, $level, $pilotsNeeded) {
        $this->name = $name;
        $this->baseAttack = $baseAttack;
        $this->level = $level;
        $this->pilotsNeeded = $pilotsNeeded;
    }

    // Calcula el ataque actual basado en el nivel (1.5% por nivel)
    public function getCurrentAttack() {
        return $this->baseAttack * pow(1.015, $this->level);
    }
}

// Lógica de validación de flota
function canBuildShips($requestedShips, $availablePilots, $pilotsPerShip) {
    $totalNeeded = $requestedShips * $pilotsPerShip;
    if ($totalNeeded <= $availablePilots) {
        return true;
    }
    return false;
}

// Ejemplo de uso:
$cazadorLiger = new Ship("Cazador Ligero", 100, 5, 1);
echo "Ataque nivel 5: " . round($cazadorLiger->getCurrentAttack(), 2);
?>