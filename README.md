# Total Music 1.8.3

Reproductor de música web con **favoritos funcionales** y un **ecualizador gráfico
profesional de 10 bandas** inspirado en Poweramp.

Todo el audio se sintetiza en el navegador con Web Audio: el repositorio no
contiene archivos de audio ni depende de ningún servidor de streaming.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 165 pruebas
npm run build    # dist/ verificado con tsc
```

---

## Estado del repositorio

Este proyecto se implementó desde cero: el repositorio solo contenía un README
de 14 bytes y un commit inicial. No había código previo de la versión 1.8.3 que
continuar, ni especificación ni video adjuntos en la conversación, así que se
construyó la aplicación completa descrita arriba. Cada función declarada aquí
está cubierta por pruebas que se ejecutan en CI local (`npm test`).

---

## Favoritos

| Comportamiento | Implementación |
| --- | --- |
| Marcar / desmarcar | `src/state/favorites.ts` → `toggleFavorite` (función pura) |
| Estado compartido | store observable con `useSyncExternalStore` |
| Persistencia | `localStorage["tm.favorites.v1"]`, orden *más reciente primero* |
| Sincronía entre pestañas | evento `storage` en `src/state/store.ts` |
| Vistas | pestaña **Favoritos** y contador en la barra lateral |
| Entradas de UI | corazón en cada fila, en la barra del reproductor y en pantalla completa |
| Datos corruptos | `sanitizeFavorites` descarta basura, duplicados y valores no-string |
| Estado vacío | mensaje + CTA para volver a la biblioteca |

Los corazones de todos los lugares comparten el mismo store: marcar en la barra
de reproducción actualiza la fila y el contador al instante (probado en
`tests/ui.test.tsx`).

## Ecualizador

Inspirado en la página de tono de Poweramp:

- **10 bandas** de octava: 31 · 62 · 125 · 250 · 500 Hz · 1 · 2 · 4 · 8 · 16 kHz,
  cada una como `BiquadFilterNode` tipo `peaking` con Q = 1.41.
- **Preamp** de −12 a +12 dB, aplicado antes de la cadena, y **Auto-headroom**
  que calcula la atenuación necesaria para no saturar.
- **Limitador** conmutable (compresor aguas abajo de la cadena).
- **Graves / Agudos** como shelves de tono.
- **13 presets** (Flat, Rock, Pop, Jazz, Classical, Dance, Hip-Hop, Metal, Vocal,
  Bass Boost, Treble Boost, V-Shape, Lo-Fi) y detección automática de
  «Personalizado» al mover una banda.
- **Curva de respuesta en vivo** calculada con las mismas ecuaciones RBJ
  (cookbook) que usa el navegador para filtrar: lo que se dibuja es lo que suena.
- **Bypass** real y **Aplanar**.
- Controles: arrastre vertical, rueda, flechas (↑↓ ←→), `PageUp/PageDown`,
  `Home/End`, `0` para volver a 0 dB y doble clic para restablecer.
- Persistencia completa en `localStorage["tm.eq.v1"]` con validación estricta.

### Cadena de audio

```
buffer → preamp → shelf graves → shelf agudos → 10 × peaking → limitador → volumen → analizador → salida
```

Los filtros se crean una sola vez y se re-afinan en sitio: mover una banda no
reconstruye el grafo ni corta la reproducción.

## Cómo se verifica el ecualizador

`tests/dsp.test.ts` no confía en la curva: filtra muestras reales con una
implementación **independiente** de biquad en forma directa II y mide la ganancia
obtenida con señales sinusoidales.

- Curva analítica vs. audio medido: **≤ 0.35 dB** de diferencia en las 10 bandas
  para 8 estados distintos, y ≤ 0.4 dB para los 13 presets.
- Un filtro de 0 dB es transparente muestra a muestra.
- El bypass conserva el preamp y elimina toda ganancia de banda (diferencia > 6 dB).
- Auto-headroom baja el pico medido de positivo a < 0.5 dB.

## Pruebas

```
tests/eq.test.ts         32  matemática de bandas, presets, validación, headroom
tests/dsp.test.ts        15  filtrado real de muestras vs. curva dibujada
tests/engine.test.ts     18  grafo de audio, afinado de filtros, transporte, fin de pista
tests/favorites.test.ts  19  toggles, orden, sanitización, persistencia
tests/queue.test.ts      17  siguiente/anterior, repetición, aleatorio, preferencias
tests/tracks.test.ts     45  generador musical determinista, metadatos, formato
tests/ui.test.tsx        19  flujos completos de React (corazones, EQ, transporte)
```

165 pruebas, 7 archivos. Ninguna función de este README se declara terminada sin
una prueba que la ejercite; el estado de audio real (no simulado) se valida
midiendo muestras en `dsp.test.ts`.

## Estructura

```
src/
  audio/
    synth.ts     sintetizador offline: eventos → AudioBuffer
    tracks.ts    biblioteca, teoría musical y generación determinista de eventos
    eq.ts        modelo del EQ, presets y matemática de biquads
    engine.ts    grafo de Web Audio en vivo (filtros, limitador, analizador)
  state/
    store.ts     store observable + localStorage + sincronía entre pestañas
    favorites.ts favoritos
    eqStore.ts   persistencia del EQ
    playerPrefs.ts volumen, aleatorio, repetición, última pista
    queue.ts     lógica pura de cola
  player/
    PlayerProvider.tsx  orquesta motor, cola, favoritos y EQ
  components/    UI (biblioteca, barra, pantalla completa, EQ, visualizador)
tests/           suite completa
```

## Atajos

| Tecla | Acción |
| --- | --- |
| `Espacio` | Reproducir / pausar |
| `E` | Abrir / cerrar el ecualizador |
| `Esc` | Cerrar el panel abierto |
| `↑` `↓` `←` `→` | Ajustar la banda enfocada (con `Shift`, ±0.5 dB) |

## Compatibilidad

Requiere Web Audio API y `OfflineAudioContext` (Chrome, Edge, Firefox, Safari 14+).
El audio arranca tras el primer gesto del usuario, como exigen las políticas de
reproducción automática de los navegadores.

---

## Limitaciones conocidas

- La **biblioteca de demostración es sintetizada**: no hay importación de
  archivos locales ni streaming todavía. El motor de audio sí es genérico
  (`play(track)` sobre un `AudioBuffer`), así que conectar un `<input type=file>`
  o un backend es un cambio acotado.
- El análisis con un navegador real no fue posible en el entorno de desarrollo
  (sin ALSA/Chromium). La lógica de audio se validó midiendo muestras contra una
  implementación de biquad independiente, y el grafo de Web Audio con una
  implementación de la API instrumentada en las pruebas.
- Sin listas de reproducción propias, letras ni descarga offline.
