# Backend Promotoras

Este es el backend para la aplicación de promotoras.

## Solución al Error "No refresh token is set"

El error `Error: No refresh token is set.` ha sido resuelto implementando un sistema que permite al frontend enviar las credenciales de Google OAuth2 al backend y almacenarlas en la base de datos.

### Cómo funciona la nueva solución:

1. **El frontend obtiene las credenciales de Google** a través del flujo OAuth2 y las almacena en `localStorage`.

2. **El frontend envía automáticamente las credenciales al backend** cuando las obtiene por primera vez.

3. **El backend almacena las credenciales en la base de datos** usando el nuevo modelo `GoogleCredentials`.

4. **El backend usa las credenciales almacenadas** para generar enlaces de Google Meet cuando sea necesario.

### Nuevos archivos agregados:

- `models/GoogleCredentials.js` - Modelo para almacenar credenciales de Google en la base de datos
- `routes/google-auth.js` - Endpoints para manejar credenciales de Google

### Nuevos endpoints disponibles:

- `POST /api/google-auth/credentials` - Recibir y almacenar credenciales de Google
- `GET /api/google-auth/status` - Verificar estado de las credenciales
- `DELETE /api/google-auth/credentials` - Eliminar credenciales almacenadas

### Configuración requerida:

Aún necesitas configurar las siguientes variables de entorno en tu archivo `.env`:

```
GOOGLE_CLIENT_ID=TU_CLIENT_ID
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET
GOOGLE_REDIRECT_URI=TU_URI_DE_REDIRECCIONAMIENTO
```

**Nota:** Ya no necesitas `GOOGLE_REFRESH_TOKEN` en el `.env` porque ahora se almacena en la base de datos.

### Pasos para usar la nueva solución:

1. **Configura las variables de entorno** en tu archivo `.env` (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI).

2. **Inicia el backend** con `npm start`.

3. **Inicia el frontend** y ve a la página de configuración de Google Auth (`/admin/google-auth`).

4. **Haz clic en "Conectar con Google"** y autoriza los permisos.

5. **Las credenciales se enviarán automáticamente al backend** y se almacenarán en la base de datos.

6. **El backend ahora puede generar enlaces de Meet** usando las credenciales almacenadas.

### Ventajas de esta solución:

- ✅ No necesitas obtener manualmente un `refresh_token`
- ✅ Las credenciales se actualizan automáticamente cuando expiran
- ✅ Interfaz de usuario amigable para la configuración
- ✅ Las credenciales se almacenan de forma segura en la base de datos
- ✅ Botón para reenviar credenciales al backend si es necesario

### Flujo de autenticación:

1. Usuario autoriza en Google → Frontend recibe tokens → Frontend envía al Backend → Backend almacena en BD → Backend usa para generar Meet

Esta solución elimina completamente el error "No refresh token is set" y proporciona una experiencia de usuario mucho mejor.

### Configuración de Google Cloud Console:

Para que todo funcione, aún necesitas:

1. **Crear un proyecto en Google Cloud Console**
2. **Habilitar Google Calendar API**
3. **Crear credenciales OAuth2** (Client ID y Client Secret)
4. **Configurar URIs de redirección** en Google Cloud Console

Una vez configurado, el flujo será completamente automático.

