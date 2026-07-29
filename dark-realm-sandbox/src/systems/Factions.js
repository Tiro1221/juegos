// ============================================================================
// Faction system: interconnected lore factions with reputation tracking.
// Reputation shifts based on player actions (killing faction mobs, helping
// villages, clearing dungeons) and unlocks/blocks dialogue & trades.
// ============================================================================

export const FactionId = {
  KINGDOM_OF_EMBERFALL: 'kingdom_emberfall',
  ASHVEIL_CULT: 'ashveil_cult',
  FREE_VILLAGES: 'free_villages',
  UNDEAD_LEGION: 'undead_legion',
  WILDKIN_TRIBES: 'wildkin_tribes',
};

export const Factions = {
  [FactionId.KINGDOM_OF_EMBERFALL]: {
    name: 'Reino de Emberfall',
    description: 'Un reino en decadencia que aún defiende sus últimas fortalezas contra la Legión de los Muertos. Sus caballeros patrullan las ruinas en busca del antiguo tesoro real.',
    color: 0xb0303a,
    relations: { [FactionId.ASHVEIL_CULT]: -60, [FactionId.UNDEAD_LEGION]: -90, [FactionId.FREE_VILLAGES]: 40 },
  },
  [FactionId.ASHVEIL_CULT]: {
    name: 'Culto de Ashveil',
    description: 'Hechiceros oscuros que veneran a un dios olvidado bajo las mazmorras. Buscan mithril para forjar un ritual de resurrección.',
    color: 0x6a2ea3,
    relations: { [FactionId.KINGDOM_OF_EMBERFALL]: -60, [FactionId.UNDEAD_LEGION]: 30, [FactionId.FREE_VILLAGES]: -40 },
  },
  [FactionId.FREE_VILLAGES]: {
    name: 'Aldeas Libres',
    description: 'Comunidades independientes de granjeros y artesanos que sobreviven lejos del control real, comerciando con quien les traiga suministros.',
    color: 0x3a8f4a,
    relations: { [FactionId.KINGDOM_OF_EMBERFALL]: 40, [FactionId.ASHVEIL_CULT]: -40, [FactionId.WILDKIN_TRIBES]: 20 },
  },
  [FactionId.UNDEAD_LEGION]: {
    name: 'Legión de los Muertos',
    description: 'Los caídos de guerras antiguas, reanimados por una maldición que emana de las ruinas. Vagan de noche buscando carne viva.',
    color: 0x40503a,
    relations: { [FactionId.KINGDOM_OF_EMBERFALL]: -90, [FactionId.ASHVEIL_CULT]: 30 },
  },
  [FactionId.WILDKIN_TRIBES]: {
    name: 'Tribus Wildkin',
    description: 'Cazadores nómadas que domestican monturas salvajes y respetan a quienes demuestran fuerza y honor en el combate.',
    color: 0xd6923a,
    relations: { [FactionId.FREE_VILLAGES]: 20 },
  },
};

export class FactionSystem {
  constructor() {
    this.reputation = {};
    for (const id of Object.keys(Factions)) this.reputation[id] = 0;
  }

  adjust(factionId, amount) {
    this.reputation[factionId] = Math.max(-100, Math.min(100, (this.reputation[factionId] || 0) + amount));
    // ripple to allied/enemy factions slightly
    const rel = Factions[factionId]?.relations || {};
    for (const [other, relScore] of Object.entries(rel)) {
      const ripple = amount * (relScore / 200);
      this.reputation[other] = Math.max(-100, Math.min(100, (this.reputation[other] || 0) + ripple));
    }
  }

  get(factionId) { return this.reputation[factionId] || 0; }

  standingLabel(factionId) {
    const v = this.get(factionId);
    if (v >= 60) return 'Aliado';
    if (v >= 20) return 'Amistoso';
    if (v > -20) return 'Neutral';
    if (v > -60) return 'Hostil';
    return 'Enemigo Mortal';
  }
}
