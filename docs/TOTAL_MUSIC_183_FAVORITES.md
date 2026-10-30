# Canciones favoritas — 1.8.3

## Qué había

El corazón existe en toda la app desde antes: `SongActionsSheet`, `NowPlayingScreen`,
`LandscapePlayer`, el widget (`MediaWidgetPill`) y la barra del reproductor. Todos
llaman a `MainViewModel.toggleLike(videoId)`, que escribe un **rating de YouTube
Music** (`YtMusicRepository.rate`).

Ese rating es un hecho remoto:

- necesita una cuenta con sesión iniciada (`setLike` empieza por `requireSignIn()`);
- necesita red y una ida y vuelta;
- no existe para música local, que YouTube no conoce (`LocalMusicScreen`,
  `LocalMediaRepository`);
- no deja nada en el dispositivo: sin sesión, el corazón no hacía nada.

No había ninguna lista de favoritos en el dispositivo. Lo que la app llamaba
"Liked Music" es una playlist de la cuenta, y el propio `LibraryScreen` documenta
que se alcanza abriendo su tarjeta, no como sección.

## Qué se añadió

Una lista **del dispositivo**, independiente de la cuenta, que funciona para
canciones remotas y locales, y a la que escriben los mismos corazones.

| Archivo | Papel |
| --- | --- |
| `app/.../data/FavoritesPolicy.kt` | Reglas puras: orden, alta, baja, saneado, reconciliación. Sin Android ni JSON. |
| `app/.../data/SongFavorites.kt` | `SongFavoritesStore`: `AtomicFile` + `StateFlow`, guarda `Song` completos. |
| `app/.../ui/components/FavoriteSongsSection.kt` | La sección: filas `SongRow`, "Ver todo", estado vacío. |
| `app/.../ui/screens/LibraryScreen.kt` | Hueco `favorites` en Biblioteca (mismo patrón que el hueco `replay`). |
| `app/.../ui/MainViewModel.kt` | `favoriteSongs`, `likeStatuses` en capas, `toggleLike(song)`. |
| `app/.../MainActivity.kt` | Recolecta la lista y monta la sección en Biblioteca. |
| `res/values/strings.xml`, `values-es` | `favorite_songs`, `favorite_songs_empty`. |
| `app/src/test/.../FavoritesPolicyTest.kt` | 16 pruebas de las reglas. |

### Comportamiento

- **El corazón siempre escribe el favorito local**, con o sin cuenta. Después, y
  sólo si hay sesión, se envía el rating.
- **El orden es el más reciente primero**, que es donde el usuario está mirando.
- **La sección se dibuja siempre**, con una línea explicando cómo llenarla. Las
  estanterías existentes se ocultan cuando están vacías ("On device"), y está bien
  para ellas; una función nueva no se descubre por no dibujarse.
- **Se guardan `Song` completos, no sólo ids**, para que la sección dibuje sin
  red, sin la biblioteca cargada y para archivos locales.
- **El rating remoto manda sobre el favorito local** al pintar el corazón, así un
  pulgar abajo de la sesión no se convierte en corazón lleno.
- **Escritura atómica** con `AtomicFile`, igual que `DevicePlaylistStore`: una
  escritura interrumpida restaura la versión anterior en vez de perder la lista.

### Decisión que conviene revisar

Sin sesión, tocar el corazón **antes no hacía nada** (`setLike` salía en
`requireSignIn()`). Ahora marca el favorito local. Es el punto de la función,
pero cambia ese comportamiento: si prefieres que además siga pidiendo iniciar
sesión, es un cambio de dos líneas en `toggleLike`.

## Verificación

**Hecho y comprobado en este entorno**

- `FavoritesPolicy.kt` compila con `kotlinc` y sus reglas se ejecutaron: 21
  aserciones, 0 fallos (`OK 21 assertions passed`).
- Los cuatro archivos tocados (`MainViewModel.kt`, `MainActivity.kt`,
  `LibraryScreen.kt`, `FavoritesPolicyTest.kt`) se parsean sin errores de
  sintaxis con `kotlinc`.
- Los dos archivos nuevos (`SongFavorites.kt`, `FavoriteSongsSection.kt`) no
  tienen errores de sintaxis; todos los diagnósticos restantes son referencias
  no resueltas a `android`, `androidx` o `Song`, esperables sin el SDK.

**No comprobado — no hay que darlo por bueno**

- **No se compiló el proyecto Android ni se generó APK.** Este entorno no tiene
  SDK de Android, y Maven Central / Google Maven / Gradle están bloqueados, así
  que Gradle no puede resolver ni una dependencia. No es lentitud: es
  imposible aquí.
- **No se ejecutaron las pruebas del proyecto** (necesitan Gradle + Android).
  `FavoritesPolicyTest` está escrito en el estilo del repositorio (JUnit 4) pero
  no se ha ejecutado con Gradle; sus 16 casos replican las aserciones que sí se
  ejecutaron en el arnés.
- **No se probó en dispositivo ni emulador.**
- Los tipos de Compose/Android están revisados a mano, no por el compilador:
  cabe un error de firma que sólo aparecerá en el primer build.

## Para compilarlo

```bash
./gradlew :app:assembleDebug          # APK de prueba
./gradlew :app:testDebugUnitTest      # incluye FavoritesPolicyTest
```

En GitHub Actions, el flujo del proyecto es `total-music-android.yml`
(ver `AGENTS.md`); produce un APK debug de prueba y un ZIP release sin firmar.
La firma permanente requiere el keystore privado, que no está en este entorno:
por eso no hay APK firmado en esta entrega.
