# Ecualizador — auditoría antes de tocar nada (1.8.3)

Encargo: "integra un ecualizador avanzado en el reproductor Android real, inspirado
funcional y visualmente en Poweramp" y "reutiliza los algoritmos sólo después de
verificar que pueden integrarse en el motor de audio Android".

Conclusión de la auditoría: **el ecualizador ya está integrado y es más avanzado
que el que había preparado**. Duplicarlo habría sido un retroceso. Esto es lo que
hay, con la evidencia.

## Lo que ya existe

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Procesador | `playback/EqualizerProcessor.kt` (429 líneas) | 10 secciones, preamp, balance, *gliding* |
| Motor TotalEq | `playback/TotalEqEngine.kt` | Cadena del modo "Total" |
| Layout | `shared/.../EqualizerCurve.kt` | `EqLayout`: 7 bandas manuales + 3 de tono |
| Presets | `shared/.../EqualizerPreset.kt` | 17 presets, `CUSTOM` con detección automática |
| Pantalla | `ui/screens/EqualizerScreen.kt` (939 líneas) | Curva en `Canvas`, hoja de presets, pestañas |
| Controles Tone | `ui/screens/TotalEqControls.kt` | Pad de tono (tilt, contorno, ancho) |
| Ajustes | `data/settings/TotalMusicSettings.kt` | Persistencia |
| Pipeline | `ui/components/AudioPipelineDialog.kt` | Vista de la cadena en vivo |
| Pruebas | `EqualizerProcessorTest`, `TotalEqEngineTest`, `TotalEqIntegrationTest`, `FloatDspChainTest` | Ya cubierto |

Detalles concretos, leídos del código:

- **Filtros**: secciones de variable de estado de dos integradores, transformada
  bilineal con pre-warping. El comentario del propio archivo explica por qué: Q y
  frecuencia quedan desacopladas y los estados internos no se disparan al modular.
  Es una implementación **mejor** que los biquads RBJ directos del prototipo para
  el caso de arrastrar un deslizador en vivo.
- **Sin transitorios al cambiar**: cada cambio de deslizador es un objetivo que se
  persigue cada `GLIDE_FRAMES`, así un cambio de preset es un deslizamiento corto
  y no un chasquido.
- **Formas**: 60 Hz y 14 kHz son shelves, el resto campanas, con Q = 1.0 — no una
  tabla copiada, tal como documenta `EqualizerPreset`.
- **Preamp**: `EqCurve.preampDb`, aplicado como ganancia lineal con glide
  (`EqualizerProcessor`, líneas ~267–361).
- **Limitador**: `playback/LoudnessProcessor.kt` — limitador de picos explícito,
  descrito como red de seguridad para los picos sueltos, también frente a
  crossfades.
- **Balance** de salida, sin ejecutarse en mono.
- **Modos**: `DYNAMIC` (pad de tono) / `MANUAL` (7 deslizadores + presets) /
  `TOTAL`, uno a la vez y sobre los mismos 10 huecos, para que cambiar de pestaña
  sea un cambio de ganancia y no una reconstrucción de la cascada.

## Qué se hizo con el prototipo web

Se conserva en la etiqueta `prototype/web-1.8.3`. Su DSP **no se portó**, y esa es
la decisión correcta, no un atajo:

- sus biquads RBJ *peaking* por banda son un subconjunto de lo que ya hace el SVF
  nativo, y peores para modular en vivo;
- su "limitador" era un compresor de dinámica de Web Audio, más tosco que
  `LoudnessProcessor`;
- sus 13 presets son menos que los 17 existentes, y sobre 10 bandas que no son las
  que este ecualizador usa (7 + shelves): transcribirlos habría producido curvas
  que no corresponden a lo que dicen.

Lo que **sí** se transfiere es el método de verificación, y está anotado como
recomendación más abajo: comprobar la curva dibujada midiendo muestras reales en
vez de confiar en la fórmula.

## Diferencias con Poweramp que sí existen

Sin inventar carencias, contrastando con lo que el código muestra:

1. **La pestaña manual tiene 7 bandas, no 10.** Es una decisión razonada (los
   centros están a ~1.3 octavas y Q = 1.0 evita valles), no un olvido. Poweramp
   ofrece 10; añadir 3 más es posible pero cambia el diseño acordado.
2. **No hay un 10-bandas gráfico al estilo clásico** junto al paramétrico. Existe
   el modo "Total", que conviene revisar antes de proponer nada.
3. **No hay presets por salida** (auriculares/Bluetooth/altavoz), que Poweramp sí
   tiene. Sería la carencia más clara y es aditiva.

Nada de esto se ha implementado: son observaciones para decidir, no cambios.

## Recomendación

1. Ejecutar `./gradlew :app:testDebugUnitTest` en un entorno con SDK y confirmar
   que la suite existente del ecualizador sigue verde.
2. Si se quiere el 10-bandas gráfico, hacerlo como **cuarta pestaña** sobre los
   mismos huecos de `EqLayout` — el diseño ya contempla que una pestaña inactiva
   mantenga sus secciones a 0 dB sin reconstruir la cascada.
3. Antes de añadir presets, portar la prueba de medición del prototipo: filtrar
   una sinusoide por banda y comparar la ganancia medida con
   `EqualizerCurve`/`EqualizerProcessorTest`. Detecta curvas que se dibujan bien y
   suenan mal.
