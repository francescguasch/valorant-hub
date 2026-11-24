# Guía de instalación (gratis) — UND VALORANT Team Hub

Esta guía pone la web en marcha con tres servicios gratuitos:

| Servicio | Para qué | Plan |
|---|---|---|
| **GitHub** | Guarda el código | Free |
| **Supabase** | Base de datos, cuentas de usuario e imágenes | Free |
| **Vercel** | Publica la web en internet | Hobby (gratis) |

Tiempo aproximado: 30–40 minutos. No hace falta instalar nada en tu ordenador.

> Los nombres de los botones pueden cambiar un poco con el tiempo. Si no ves exactamente el mismo texto,
> busca la opción equivalente en el menú lateral.

---

## 1. GitHub: el repositorio

1. Crea una cuenta en <https://github.com> (si no la tienes).
2. Arriba a la derecha: **+ → New repository**.
3. Nombre: `und-valorant-hub`. Marca **Private**. No añadas README ni nada más.
4. Pulsa **Create repository** y pásale a Claude el nombre (`tu-usuario/und-valorant-hub`). Claude sube el código.

## 2. Supabase: el proyecto

1. Entra en <https://supabase.com> → **Start your project** → inicia sesión con GitHub.
2. **New project**:
   - Name: `und-valorant-hub`
   - Database password: pulsa **Generate a password** y **guárdala** en un sitio seguro (la necesitarás en el paso 4).
   - Region: **East US (North Virginia)**. Es la más cercana a los servidores de Vercel.
   - Plan: **Free**.
3. Espera 1–2 minutos a que el proyecto esté listo.

## 3. Crear la base de datos

1. En el menú izquierdo de Supabase: **SQL Editor → New query**.
2. Abre el archivo `supabase/setup.sql` del repositorio en GitHub, pulsa el botón **Copy raw file**
   y pégalo entero en el editor.
3. Pulsa **Run**. Debe terminar con "Success". Esto crea todas las tablas, la seguridad, los mapas, los agentes,
   la plantilla de Dakota y los datos DEMO.

### Desactivar el registro público

1. Menú izquierdo: **Authentication → Sign In / Providers**.
2. Desactiva **Allow new users to sign up** y guarda.
   (Las cuentas solo se crean con un código de invitación desde la propia web.)

## 4. Copiar las claves

Necesitas 4 valores. Pégalos de momento en una nota privada.

| Variable | Dónde está en Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API**: "Project URL" (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API Keys**: la **Publishable key** (`sb_publishable_…`). Si solo ves claves "legacy", usa la **anon** |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma página: la **Secret key** (`sb_secret_…`) o la legacy **service_role**. **Es secreta**: no la compartas |
| `DATABASE_URL` | Botón **Connect** (arriba) → pestaña de cadenas de conexión → **Transaction pooler** (puerto **6543**). Sustituye `[YOUR-PASSWORD]` por la contraseña del paso 2 |

Y un quinto valor que inventas tú:

| Variable | Valor |
|---|---|
| `SETUP_TOKEN` | Una frase larga y aleatoria (mínimo 16 caracteres), por ejemplo `pizarra-roja-ascent-2026-xk9`. Sirve una sola vez para crear la cuenta del Owner |

## 5. Vercel: publicar la web

1. Entra en <https://vercel.com> → **Sign Up** → **Continue with GitHub**. Elige el plan **Hobby**.
2. **Add New… → Project** → busca `und-valorant-hub` → **Import**.
   (Si no aparece, pulsa "Adjust GitHub App Permissions" y dale acceso a ese repositorio.)
3. Abre **Environment Variables** y añade las 5 variables del paso 4 (nombre exacto + valor).
4. Pulsa **Deploy**. En 1–2 minutos tendrás una dirección tipo `https://und-valorant-hub.vercel.app`.

## 6. Crear la cuenta del Owner (solo una vez)

1. Abre `https://TU-DIRECCION.vercel.app/setup`.
2. Escribe el `SETUP_TOKEN`, tu email, tu nombre y una contraseña.
3. Entras directamente como **Owner**. La página `/setup` queda bloqueada para siempre.

## 7. Invitar al equipo

1. **Settings → Members → Invite someone**.
2. Elige el rol (Player, Coach o Owner). Para jugadores, elige su perfil del roster (Zach, JaxaPixel…) para que vean
   su propio feedback.
3. Pulsa **Create invitation code** y envía el código o el enlace por privado (Discord, WhatsApp…).
   El código funciona una sola vez y caduca en los días que elijas.
4. La persona abre el enlace, escribe su email y contraseña, y entra.

**¿Alguien olvidó su contraseña?** En **Settings → Members**, pulsa **Reset code** en su fila y envíale el código.
Lo usa en la página "Forgot your password?" del login. Dura 24 horas.

**Modo solo lectura:** por defecto, quien tenga el enlace puede ver Overview, Match Center, Team Analytics y Roster
sin cuenta, sin poder editar. Cámbialo en **Settings → Visitor access**.

**Antes de meter resultados reales:** borra los datos DEMO en **Settings → Data → Remove demo data**.

## 8. Copias de seguridad (gratis)

El plan Free de Supabase no guarda copias descargables. El repositorio incluye una tarea automática de GitHub que
copia toda la base de datos los lunes y jueves y guarda el archivo 90 días. Además, al usar la base de datos dos
veces por semana, evita que Supabase pause el proyecto por inactividad.

Para activarla:

1. En Supabase: **Connect** → copia la cadena **Session pooler** (puerto **5432**) y pon tu contraseña.
2. En GitHub, en tu repositorio: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `BACKUP_DATABASE_URL`
   - Secret: la cadena del punto anterior.
3. Pestaña **Actions → Database backup → Run workflow** para probarla. Cuando termine, la copia aparece como
   archivo descargable ("Artifacts") dentro de esa ejecución.

**Restaurar** (solo si algo sale muy mal): crea un proyecto Supabase nuevo, ejecuta `supabase/setup.sql` vacío de
datos o pide ayuda técnica para cargar el archivo `.sql` de la copia con `psql`.

## 9. Cosas a saber del plan gratuito

- **Supabase Free** pausa el proyecto tras 7 días sin actividad. La copia automática del paso 8 lo evita. Si se
  pausa, entra en Supabase y pulsa **Restore project**.
- Límites Free: 500 MB de base de datos y 1 GB de imágenes: de sobra para un equipo.
- **Vercel Hobby** es para uso no comercial: un equipo universitario encaja.

## 10. Cambiar fotos, colores o nombres

Todo está en **Settings → Team & branding**: nombre de la universidad, nombre del equipo, textos del inicio, temporada,
zona horaria (por defecto **America/Chicago**, la hora Central de Grand Forks), foto del campus, logo y colores.
La foto original del campus siempre se puede recuperar con **Use original photo**.
