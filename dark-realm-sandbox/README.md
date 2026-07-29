# 🏰 Dark Realm — Sandbox 3D Low-Poly de Fantasía Oscura

Un juego sandbox 3D estilo *voxel* (Minecraft-like) construido desde cero con **Three.js** y **JavaScript vanilla**, ambientado en un mundo medieval de fantasía oscura: reinos en guerra, ruinas antiguas, aldeas con NPCs, mazmorras procedimentales y castillos abandonados habitados por criaturas.

Todo el contenido — texturas, terreno, música y efectos de sonido — se genera **100% de forma procedural en el navegador**. No hay imágenes ni archivos de audio externos: el mundo entero nace de ruido Perlin, hashing determinista y síntesis con la Web Audio API.

Funciona tanto en **computadora** (teclado/ratón) como en **teléfono** (controles táctiles duales).

---

## 🎮 Cómo jugar

```bash
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`). Para una build de producción:

```bash
npm run build
npm run preview
```

### Controles — Escritorio

| Acción | Tecla |
|---|---|
| Moverse | `W A S D` |
| Mirar alrededor | Ratón (clic para capturar el puntero) |
| Atacar / Minar | Clic izquierdo (mantener) |
| Colocar bloque / Usar objeto | Clic derecho |
| Interactuar (hablar, montar, cofres, estaciones) | `E` |
| Bajar de montura | `R` |
| Seleccionar objeto de la barra rápida | `1`–`9` o rueda del ratón |
| Saltar | `Espacio` |
| Correr | `Shift` |
| Agacharse | `Ctrl` |
| Inventario | `I` |
| Mapa / Facciones | `M` |
| Menú de pausa | `Esc` |

### Controles — Móvil / Táctil

- **Joystick izquierdo**: moverse.
- **Panel de mirada (derecha)**: deslizar para rotar la cámara.
- **Botones de acción**: atacar/minar, colocar/usar, interactuar, saltar, inventario, mapa.
- Todo el HUD y los menús están adaptados a pantallas pequeñas.

---

## 🧭 Características implementadas

### Mundo y generación procedural
- Mapa infinito por *chunks* de `16×16×96` bloques, con streaming dinámico alrededor del jugador y descarga de chunks lejanos.
- Generación de terreno con ruido Perlin/FBM propio (`src/world/Noise.js`), sin dependencias externas.
- **11 biomas**: bosques densos, montañas nevadas, pantanos tóxicos, desiertos con oasis, tundras heladas, llanuras, playas, océano, entre otros — determinados por temperatura, humedad y altura.
- Cuevas 3D bajo tierra y **capas de minerales raros por profundidad** (carbón, hierro, plata, oro, mithril).
- Ríos y océanos navegables con agua animada (oleaje + reflejos + destellos, shader custom).
- **Sistema de clima dinámico**: tormentas, nevadas y niebla que varían según el bioma y afectan la iluminación/niebla atmosférica.
- Ciclo día/noche completo con cielo dinámico (sol/luna direccionales, gradientes de cielo, estrellas nocturnas) y niebla exponencial reactiva.
- Partículas de polvo suspendidas en el aire y vegetación (hierba, hojas, cultivos) que se mece con el viento vía shaders `onBeforeCompile`.

### Estructuras y lore
- Generación determinista de **aldeas** (con NPCs y rutinas diarias día/noche), **castillos abandonados** habitados por criaturas hostiles, y **mazmorras subterráneas procedimentales** con cofres de botín.
- **Sistema de facciones** (5 facciones con historia propia) con reputación dinámica y efecto "ripple" entre facciones aliadas/enemigas.

### Mecánicas de juego
- **Crafting profundo** por estaciones: a mano, carpintería (mesa de trabajo), forja (metalurgia) y alquimia (caldero) — árbol tecnológico medieval completo.
- **Minería** con progreso de excavación condicionado por el *tier* de herramienta.
- **Agricultura** con estaciones del año (primavera/verano/otoño/invierno) que modifican la velocidad de crecimiento de los cultivos (el invierno detiene el crecimiento).
- **Combate** cuerpo a cuerpo y a distancia (arcos/ballestas con proyectiles físicos).
- **Domesticación de monturas**: acércate, gana su confianza y móntalas para control directo de cámara y movimiento.
- **Construcción libre** con bloques de múltiples materiales (madera, piedra, ladrillo de castillo, hielo, etc.).
- Estadísticas de supervivencia: salud, resistencia, hambre y calor corporal (afectado por el bioma y la hoguera/antorchas).
- Guardado y carga de partida vía `localStorage`.

### Audio y atmósfera
- Música orquestal medieval generada proceduralmente (arpegios de laúd + *drone* de fondo) con la Web Audio API — sin archivos de audio externos.
- Ambiente reactivo: grillos nocturnos, viento en montañas, goteo en cuevas, truenos durante tormentas.
- Efectos de sonido sintetizados: golpes, roturas de bloque, colocación, disparo de arco, pasos, salpicaduras, etc.
- Interfaz (UI) con estética de **pergamino y madera envejecida**, totalmente responsive.

---

## 🛠️ Stack técnico

| Tecnología | Uso |
|---|---|
| [Three.js](https://threejs.org/) `0.185` | Motor de renderizado WebGL |
| [Vite](https://vitejs.dev/) `8` | Bundler y servidor de desarrollo |
| JavaScript ES Modules (vanilla) | Sin frameworks de UI |
| Web Audio API | Música y SFX 100% procedurales |
| Canvas 2D API | Generación del atlas de texturas pixel-art en tiempo de carga |

No se usan assets de imagen ni audio externos: todo el arte y el sonido se generan en tiempo de ejecución, lo que mantiene el proyecto ligero y funcional incluso sin conexión a redes de terceros.

---

## 📁 Estructura del proyecto

```
src/
  core/          Configuración global e input (teclado/ratón/táctil)
  world/         Bloques, biomas, ruido, terreno, chunks, materiales, estructuras
  entities/      Jugador y criaturas (mobs)
  systems/       Inventario, recetas, interacción, agricultura, facciones, monturas, botín
  audio/         Sistema de audio procedural
  ui/            HUD y gestor de menús (CSS incluido)
  main.js        Punto de entrada y bucle principal del juego
public/          Favicon y recursos estáticos mínimos
```

---

## 📱 Compatibilidad

- **Escritorio**: Chrome, Firefox, Edge (requiere WebGL).
- **Móvil**: controles táctiles duales, distancia de renderizado reducida automáticamente para mantener el rendimiento.
- Detección automática de dispositivo (`src/core/Config.js → isMobile()`) para ajustar calidad y controles.

---

## ⚠️ Notas de desarrollo

- El proyecto usa `vite.config.js` con `allowedHosts: true` para permitir que el servidor de desarrollo sea accesible desde dominios de sandbox/preview.
- Las fuentes de la interfaz usan tipografías de sistema (sin dependencias de Google Fonts) para que el juego funcione sin conexión a internet.
