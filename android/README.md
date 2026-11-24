# App Android (TWA)

App de Google Play que abre https://www.riftdeckapp.com como Trusted Web Activity, generada
con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). Lo que se ve es la web: un
deploy en Vercel actualiza la app sin subir una versión nueva. Solo hace falta compilar de
nuevo si cambia `twa-manifest.json` (ícono, colores, versión, permisos).

- Paquete: `com.riftdeckapp.app` (no se puede cambiar una vez publicado).
- Play Billing activado (`features.playBilling`): la web cobra con la Digital Goods API.
- `public/.well-known/assetlinks.json` vincula el dominio con la app: debe tener la huella
  SHA-256 de la clave de subida y la de Play App Signing (Play Console → Integridad de la app).
  Si falta, la app muestra la barra de URL de Chrome.

## Clave de firma

La clave de subida está FUERA del repo, en `../android-keys/riftdeck-upload.keystore`
(alias `upload`), con su contraseña en `LEEME-clave-de-subida.txt` al lado. Guardar ambos en
un gestor de contraseñas y con backup.

## Compilar una versión nueva

1. Subir `appVersionCode` (y `appVersionName`) en `twa-manifest.json`.
2. Desde esta carpeta:

   ```sh
   bubblewrap update --skipVersionUpgrade   # regenera el proyecto desde twa-manifest.json
   BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=... bubblewrap build --skipPwaValidation
   ```

3. Subir `app-release-bundle.aab` a Play Console. `app-release-signed.apk` sirve para
   instalar a mano en un celular (`adb install app-release-signed.apk`).

En Windows, si `bubblewrap build` no encuentra `gradlew.bat` o `jarsigner`, correrlo desde
una terminal normal (no desde una que tenga `NoDefaultCurrentDirectoryInExePath`) y con el
`bin` del JDK en el PATH.
