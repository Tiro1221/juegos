# Singularity

**Un agujero negro de Schwarzschild trazado fotón a fotón, en tiempo real, en tu navegador.**
WebGL2 puro, sin dependencias, sin assets: ~1.200 líneas de código.

## Qué hace

Cada píxel lanza un rayo de luz *hacia atrás* desde la cámara y lo integra por la geodésica nula
del espacio-tiempo de Schwarzschild (forma de Binet: `a = −3/2 · h² · r / |r|⁵`, unidades `Rₛ = 1`).
Así aparecen solos, sin trucos, todos los fenómenos reales:

| Fenómeno | Cómo se ve |
|---|---|
| **Lente gravitacional** | La parte trasera del disco se curva por encima y por debajo de la sombra |
| **Sombra** | ≈ 2,6 Rₛ de radio aparente: 3√3/2 Rₛ, el parámetro de impacto crítico |
| **Anillo de fotones** | Imágenes de orden superior de luz que dio vueltas completas |
| **Beaming relativista** | El lado que se acerca brilla ∝ D³ y se azula; el que se aleja se apaga |
| **Corrimiento gravitacional** | `√(1 − Rₛ/r)` aplicado a la temperatura del cuerpo negro |
| **ISCO** | El disco empieza a 3 Rₛ; más cerca no hay órbitas estables |
| **Rotación kepleriana diferencial** | `ω ∝ r^-3/2`: el plasma interior gira más rápido |
| **Dilatación temporal** | En la caída, la simulación, el audio y tu reloj se ralentizan |

El color del disco sigue un perfil de temperatura Novikov-Thorne convertido a RGB lineal mediante
un espectro de cuerpo negro. El cielo (estrellas con color por temperatura, banda galáctica,
nebulosas) es procedural y también sufre la lente.

## Pipeline de render

1. **Ray-march relativista** en HDR (RGBA16F) a resolución adaptativa
2. **Bloom físico**: prefiltro con rodilla suave → cadena de 6 downsamples de 13 taps (Jimenez / CoD) → upsample tienda aditivo
3. **Composición**: destello anamórfico, aberración cromática radial, tonemapping ACES, viñeta y grano de película
4. **Calidad automática**: ajusta la escala de render para mantener ~60 fps

## Experiencia

- **Cinemático**: tour de cámara con 7 planos e interpolación quíntica (se activa solo tras 45 s de inactividad)
- **Órbita libre**: arrastra, rueda o pellizca
- **Caer ↓**: caída en espiral hacia el horizonte. La cámara gira para seguir el borde de la sombra
  mientras esta llena el cielo, y la sesión termina al cruzar el horizonte de sucesos
- **Telemetría real** para 4 masas (10 M☉ … TON 618): distancia física, dilatación temporal,
  velocidad orbital, fuerza de marea sobre un cuerpo de 2 m (espaguetización) y relojes propio vs. lejano
- **Audio generativo** (Web Audio): drone con reverb por convolución sintética; tono y filtro reaccionan a la curvatura
- Estilos: *Físico · Interstellar (sin Doppler, como en la película) · Cuásar · Sin relatividad* (para comparar)
- Captura PNG, pantalla completa, modo limpio. Funciona en móvil

**Atajos:** `C` cinemático · `D` caer · `Espacio` pausa · `H` ocultar UI · `P` captura · `F` pantalla completa · `M` sonido · `Tab` panel

## Ejecutar

Son módulos ES estáticos; cualquier servidor sirve:

```bash
cd singularity
python3 -m http.server 5174     # o: npm run dev
```

Parámetros de URL para depurar: `?q=low|med|high|ultra` y `?cam=yaw,pitch,dist[,look]`.

## Archivos

```
index.html   estructura + UI
style.css    diseño (glassmorphism, tipografía Instrument Serif / JetBrains Mono)
shaders.js   ray tracer GR, bloom, composición ACES
gl.js        mini-wrapper WebGL2 (programas, uniforms con reflexión, render targets)
main.js      cámara, modos, bucle, HUD físico, UI
audio.js     drone generativo
```
