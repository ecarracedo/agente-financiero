# Despliegue: dominio público y TLS con Coolify

Este documento describe cómo publicar la aplicación detrás de un dominio real
con HTTPS en Coolify. Los nombres de dominio de los ejemplos (`app.example.com`)
son genéricos: reemplazalos por el dominio propio del despliegue.

## 1. Arquitectura: un solo origen, sin CORS

La aplicación es **single-origin por diseño**. El contenedor `frontend` sirve la
SPA con Nginx y proxea `/api/`, `/health` y `/ready` al servicio `backend` por la
red interna de Compose (`frontend/nginx.conf`). El navegador nunca hace una
llamada cross-origin, así que el backend **no** habilita CORS.

No agregues `CORSMiddleware`: la cookie de sesión es `HttpOnly` con
`SameSite=lax` (`backend/app/api/auth.py`), y un XHR cross-origin exigiría
`SameSite=None; Secure`, debilitando la seguridad. El test
`backend/tests/test_deployment_config.py::test_dev_flow_avoids_cross_origin_calls_without_adding_cors`
verifica que no se agregue.

La API y PostgreSQL **no** publican puerto al host:

| Servicio | Red | Puerto interno |
|---|---|---|
| `frontend` | publicada | `80` (Nginx) |
| `backend` | solo Compose | `8000` |
| `postgres` | solo Compose | `5432` |

## 2. Variables de entorno en Coolify

Configurá estas variables en el servicio correspondiente **antes** de desplegar:

| Variable | Valor de ejemplo | Servicio | Efecto |
|---|---|---|---|
| `VITE_API_BASE_URL` | `https://app.example.com` | `frontend` | Origen que el navegador llama. Vite la embebe en el bundle **en tiempo de build**. |
| `COOKIE_SECURE` | `1` | `backend` | Marca la cookie de sesión como `Secure`, para que solo viaje por HTTPS. |
| `POSTGRES_*` | — | `backend` / `postgres` | Credenciales obligatorias; Compose aborta si falta una. |
| `AUTH_*` | — | `backend` | Usuario, email, contraseña, `AUTH_SECRET`. |
| `WEB_PORT` | puerto libre del host | `frontend` | Solo influye en el mapeo `ports` local; en Coolify el proxy no lo usa. |
| `SMTP_HOST` | `smtp.resend.com` | `backend` | Habilita el correo de alertas. Vacío desactiva el envío; los toasts siguen funcionando. |
| `SMTP_PORT` | `587` | `backend` | Puerto SMTP; con `SMTP_USE_TLS=1` usa STARTTLS. |
| `SMTP_USER` / `SMTP_PASSWORD` | — | `backend` | Credenciales del proveedor (en Resend, usuario `resend` y la API key como password). |
| `SMTP_USE_TLS` / `SMTP_TIMEOUT` | `1` / `10` | `backend` | STARTTLS y timeout de conexión en segundos. |
| `ALERT_EMAIL_TO` | `tu@gmail.com` | `backend` | Destinatario; si falta, se usa `AUTH_EMAIL`. |

El correo se envía con `AUTH_EMAIL` como remitente, así que ese valor debe ser un
dominio verificado en el proveedor (por ejemplo `alertas@tudominio.com.ar`). Un
`AUTH_EMAIL` de Gmail es rechazado por Resend aunque el password sea correcto:
los cruces quedan encolados y se reintentan cada 300 s hasta que el envío
funciona. Si querés seguir recibiendo en Gmail, configurá `ALERT_EMAIL_TO` con
esa dirección. `AUTH_EMAIL` también siembra el email de la única cuenta cuando
se crea; el login es por `AUTH_USERNAME`.

`VITE_API_BASE_URL` es la única que exige **rebuild**. El valor queda grabado en
el JavaScript compilado: un simple restart no alcanza. Las variables SMTP se
leen al iniciar el backend, así que después de cambiarlas alcanza con un
redeploy.

Si la variable falta, `frontend/src/api/http.ts` cae al valor por defecto
`http://localhost:8000` y la aplicación queda inutilizable en producción.

## 3. Dominio en Coolify

En el servicio `frontend`, en **Domains**, agregá el dominio y dejá el puerto
**80**:

```
https://app.example.com     → puerto 80
```

Reglas que importan:

- **El puerto es el del contenedor, no el del host.** Coolify rutea a la IP del
  contenedor; ahí Nginx escucha en `80`. Poner el puerto de `WEB_PORT` (por
  ejemplo `3000`) apunta a un puerto que no existe dentro del contenedor y
  devuelve **Bad Gateway**.
- **No configures dominio para `backend` ni para `postgres`.** No publican
  puerto y el frontend ya los alcanza por la red interna.
- Después de guardar el dominio, hacé **redeploy**. Coolify regenera las labels
  de Traefik al desplegar; el cambio de campo por sí solo no siempre alcanza.

El redirect HTTP → HTTPS se puede habilitar después de confirmar que el dominio
responde por HTTPS. No es la causa de un Bad Gateway.

## 4. DNS y certificado

Cada dominio listado en Coolify debe tener un registro DNS que resuelva a la IP
del servidor, o Let's Encrypt no puede emitir el certificado:

```bash
dig +short app.example.com
```

Si listás varios nombres (por ejemplo un `www`), todos deben resolver. Un nombre
sin registro hace fallar la emisión del certificado y el sitio no queda servido.
Un comodín requiere su propio registro (`*.example.com`).

## 5. Verificación

Con el deploy en verde y el dominio respondiendo:

```bash
# La SPA y la API comparten origen: ambos caminos deben responder 200.
curl -I https://app.example.com/
curl -I https://app.example.com/health

# El bundle tiene que apuntar al dominio público, no a localhost.
docker exec <frontend> sh -c "grep -ro 'localhost:3000' /usr/share/nginx/html/assets | head"
```

La segunda búsqueda debe devolver vacío. Si encuentra `localhost:3000`, el build
arg no llegó: corregí `VITE_API_BASE_URL` y reconstruí la imagen.

En el navegador, la cookie de sesión debe mostrar el flag `Secure`.

## 6. Problemas comunes

**Bad Gateway (texto plano de Traefik).** El proxy no alcanza el contenedor:
puerto del dominio distinto de `80`, contenedor detenido o deploy abortado.
Revisá los logs del deploy y el estado de `frontend` y `backend` en Coolify.

**Bad Gateway intermitente con el frontend sano.** El `frontend` depende de
`backend: service_healthy`; si el backend está `unhealthy`, el frontend no
arranca. Causas típicas: credenciales de PostgreSQL que no coinciden con las del
volumen `postgres_data` ya creado, o una variable obligatoria faltante que
aborta el `docker compose up`.

**La página carga pero las llamadas a `/api` fallan.** `VITE_API_BASE_URL` quedó
con un origen viejo o con `localhost`. Requiere rebuild, no restart.

**El contenedor `frontend` no arranca.** El mapeo `"${WEB_PORT:-3000}:80"` de
`compose.yaml` choca con un puerto ya ocupado en el host. En Coolify, definí
`WEB_PORT` con un puerto libre o quité ese mapeo: el proxy llega por la red
interna y no lo necesita.

**502 solo después de cambiar `nginx.conf`.** El upstream se resuelve por
variable a través del DNS embebido de Docker; si Nginx arrancó antes que el
backend, un restart del `frontend` lo re-resuelve.
