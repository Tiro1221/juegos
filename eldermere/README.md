# ⚔ ELDERMERE — Reinos de Ceniza

Sandbox 3D **low-poly estilo voxel/Minecraft** de **fantasía oscura medieval**, construido con **Three.js** (motor gráfico WebGL). 100% local, sin dependencias externas en tiempo de ejecución.

## ▶ Cómo jugar

```bash
cd eldermere
python3 -m http.server 8899
# Abre http://localhost:8899
```

## 🎮 Controles

| Tecla | Acción |
|---|---|
| WASD / Ratón | Moverse / mirar |
| Clic izq. | Minar / atacar (arco y ballesta disparan) |
| Clic der. | Colocar bloque / comer / beber poción / sembrar |
| Espacio / Shift | Saltar / correr |
| E · C · J | Inventario · Crafteo · Crónicas (lore/facciones/hazañas) |
| F | Interactuar: hablar con NPCs, cofres, domar/montar caballos |
| 1–9 | Barra rápida |

## 🌍 Características

- **Mundo procedural**: 6 biomas (praderas, bosque umbrío, picos nevados, pantano ponzoñoso, desierto de ceniza, tundra helada), ríos navegables, cuevas tipo "spaghetti" con lava, vetas de carbón/hierro/oro/mithril/cristal por profundidad.
- **Estructuras generadas**: aldeas con casas y pozos, ruinas con piedra rúnica, castillos abandonados con **jefe (Guardián de las Ruinas)** y mazmorras procedurales subterráneas con salas del tesoro.
- **Ciclo día/noche** con amaneceres/atardeceres, sol/luna/estrellas, **sombras suaves** (PCF), **niebla atmosférica** por bioma/estación, **partículas de polvo** en rayos de luz, nubes low-poly, agua translúcida animada.
- **Clima dinámico**: lluvia, tormentas con truenos, nevadas, niebla densa. **4 estaciones del año** que afectan a la agricultura y la paleta del mundo.
- **Sistemas profundos**: crafting con 4 árboles (básico, **forja**, **alquimia**, construcción), minería por capas, agricultura estacional, **doma y montura de caballos**, combate melee + arco/ballesta con proyectiles.
- **NPCs con rutinas diarias** (trabajan de día, duermen de noche), diálogos, comercio y **4 facciones** con reputación e historias interconectadas (lore en el diario).
- **Criaturas**: esqueletos arqueros, arañas, espectros, lobos nocturnos, ciervos, jefes.
- **Audio 100% procedural** (WebAudio): laúd Karplus-Strong, flautas, bordones modales medievales, grillos nocturnos, búhos, pájaros, gotas de cueva, viento en montañas, truenos y SFX de juego.
- **UI estilo pergamino/madera envejecida**, hazañas (mini-quests), HUD con hambre/estamina/vida.

## 🗂 Estructura

```
eldermere/
├── index.html          # shell + UI
├── css/style.css       # estética pergamino
├── vendor/three.module.js
└── js/
    ├── main.js         # bucle principal / orquestador
    ├── config.js       # bloques, items, recetas, biomas, facciones
    ├── worldgen.js     # terreno, biomas, cuevas, estructuras, mazmorras
    ├── world.js        # chunks + mesher voxel + raycast DDA
    ├── sky.js          # día/noche, clima, niebla, partículas ambientales
    ├── player.js       # física, minería, construcción
    ├── entities.js     # NPCs, criaturas, monturas, proyectiles
    ├── systems.js      # inventario, crafteo, agricultura, facciones, hazañas, lore
    ├── ui.js           # HUD, paneles, diálogos
    ├── audio.js        # música y ambiente procedural
    ├── textures.js     # atlas de texturas pixeladas procedurales
    ├── particles.js    # partículas de bloques
    └── rng.js          # RNG determinista + ruido fBm 2D/3D
```
