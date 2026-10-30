# Total Music 1.8.3 — APK release firmado; aceptación de actualización pendiente

El APK se recuperó de la compilación de Arena y se firmó localmente con la clave permanente original. No se reconstruyó la aplicación ni se modificó main. No se publica como release oficial ni se certifica todavía como entrega definitiva.

## Identidad y procedencia

- Archivo: Total-Music-1.8.3-release-signed.apk
- Paquete: org.nexlibre.totalmusic
- versionName: 1.8.3
- versionCode: 21
- Fuente: Spaceapk/Total-Music, arena/18b4adc9-total-music, commit 2f29b8f15e407a10c465607e8cde80736c4c1932.
- PR funcional: https://github.com/Spaceapk/Total-Music/pull/10 (abierto, sin fusionar).
- Compilación: https://github.com/Spaceapk/Total-Music/actions/runs/40993723052
- Artefacto release sin firmar: 12950462942. El nombre heredado contiene 182, pero el manifiesto del APK confirma 1.8.3/21.
- La rama nexlibre/Total-Music arena/ebc154ea-total-music termina en 0d6b62d7 y es una línea anterior divergente. Se preservó; la continuación de Spaceapk incluye el estudio EQ y las correcciones posteriores de favoritos.

SHA-256 del ZIP de CI, comprobado contra el digest de GitHub:
a0807a0cbb73549877be67e1cce18a0c00f942c07509a2cbd3ab406c36e5e75a

SHA-256 del APK sin firmar, comprobado contra SHA256SUMS del artefacto:
6ad24400d4f1875250edcdb4fb3c551520441260570b36d80efb2fe207a3021b

SHA-256 del APK firmado:
41b7404aa82274de55cc2d5de306d50e4908bb38e221092fab2f12fed41332ae

## Firma verificada en esta ejecución

Se recuperaron los archivos privados originales mediante la conexión autorizada de archivos. La búsqueda de Drive no devolvió el almacén; la copia privada conservada sí estuvo disponible. Se validó la integridad criptográfica del PKCS12 con su contraseña original y se confirmó que contiene clave privada. Se usó entrada de contraseña por archivo, fuera del checkout. No se generó otra clave ni se enviaron las credenciales a CI.

Firmante: CN=Total Music, O=NexLibre. RSA 3072 bits.
Certificado SHA-256:
9ae145a703a85902fe6d6ab3d886f6801873d717929deaa3e3d0b0a81de829fa

apksigner verify --verbose --print-certs: Verifies; v2=true, v3=true; un firmante. Alineación zipalign -c -P 16 -v 4: correcta. El firmador del repositorio rechazaba por diseño APK debug, versión incorrecta y certificado previo distinto; estas comprobaciones pasaron.

Referencia anterior recuperada: Total-Music-1.8.1-universal(2).apk, versionCode 19, mismo paquete y certificado permanente verificados mediante aapt y apksigner. SHA-256:
99fef481051d8ac585bf960cd6419165797511e3c19a0c08903891a53ce4b7e0

Esto demuestra continuidad de firma y aumento de versión respecto de esa APK anterior. No se ha extraído la APK del teléfono del propietario; no se afirma haber verificado directamente su instalación actual.

## Verificación funcional y pruebas

Se consultaron los trabajos y registros originales de Actions en esta ejecución. Estos son resultados de la compilación anterior exacta, no pruebas JVM/Android vueltas a ejecutar localmente:

- Compilación completa, debug/measurement/release: success.
- Unitarias: 1091 aprobadas, 108 clases; el código de pruebas incluye respuesta DSP medida para bandas 10/31 a varias frecuencias de muestreo, filtros, bypass, limitador y controles estéreo.
- UI Android 13: 24 aprobadas, cero fallos/errores, comprobadas además leyendo los XML del artefacto 12951125459.
- Persistencia separada por muerte de proceso: dos fases OK (1 test cada una), y cola grande aislada OK (1 test), según registros de UI.
- Lint: 0 errores sin filtrar, 664 advertencias y 6 hints; 166 errores heredados excluidos por lint-baseline.xml. No equivale a ausencia total de errores en la base de código.
- Se ejecutaron localmente scripts/release/check_release.py y scripts/verify/rebirth_check.py con origin/main disponible: aprobados. La primera invocación estática sin esa referencia produjo falsos positivos de importaciones heredadas; la ejecución correctamente contextualizada pasó. El parser opcional tree-sitter no estaba instalado.

Los XML conservados incluyen favoritas desde Biblioteca, orden/remoción, corazones, reproducción de colección, retorno de Ajustes, temas, playlists y A/B del EQ. No constituyen una validación exhaustiva de widgets físicos, todos los formatos, todos los tamaños de fuente o todas las rutas de audio.

## Funciones y límites reales

Favoritos usa LikeState con DeviceFavoriteStore; conserva claves antiguas y añade snapshot con metadatos/fecha. El servicio observa el mismo estado para notificación y widget. Hay colección, reproducción individual/completa/aleatoria, orden y retirada del corazón. No se añadió otro almacén duplicado.

El EQ procesa muestras Float32 en la cadena real: 10/31 bandas y filtros paramétricos, preamp, graves/agudos, balance, anchura, crossfeed, perfiles y A/B. El limitador tiene lookahead de 2 ms y techo de pico de muestra de -1 dBFS; no es true-peak. La respuesta combina filtros digitales reales. El modo original A/B omite la etapa EQ, no todos los otros efectos posibles de la aplicación.

El DSP requiere audio decodificado a PCM; passthrough/offload comprimido y reproducción remota/Cast no permiten prometer esta transformación local. Un EQ OEM puede apilarse después. Las bandas superiores se omiten por Nyquist con frecuencias de muestreo bajas. Los favoritos cloud solo pueden completar metadatos de contenido cargado. No se ha probado audio audible en el teléfono físico.

## Actualización y bloqueo restante

La identidad, firma y versión son aptas para sustituir la APK 1.8.1/19 recuperada. La instalación real con adb install -r y conservación de datos aún requiere completar una prueba Android; no se confirma aquí como realizada.

Se preparó un emulador Android 13 local y una prueba con datos sintéticos de favoritos, playlist, tema y archivo de audio. El entorno no dispone de /dev/kvm; el arranque por software no produjo un sistema listo durante el periodo de prueba. La prueba de instalación no llegó a ejecutarse.

GitHub devolvió 403 al crear una rama en Spaceapk/Total-Music. Se pudo crear nexlibre/Total-Music:work/1.8.3-signed-delivery y guardar el arnés. La revisión automática rechazó subir los datos binarios derivados del APK necesarios para reproducir los binarios exactos en Actions, por riesgo de exposición de contenido de la aplicación sin aprobación específica. No se subieron esos datos ni se activó un workflow incompleto. Los datos de reconstrucción contienen firmas y metadatos públicos del APK, pero no se asumió permiso adicional tras ese rechazo.

Para terminar sin repetir lo completado: autorizar esa transferencia específica a la rama de verificación, o ejecutar el arnés sobre las dos APK en un emulador/dispositivo autorizado. No se necesita otra contraseña ni otra clave. No hay que desinstalar la app del propietario.
