# Guía de instalación (gratis) — UND VALORANT Team Hub

Esta guía pone la web en marcha con tres servicios gratuitos:

| Servicio | Para qué | Plan |
|---|---|---|
| **GitHub** | Guarda el código | Free |
| **Vercel** | Publica la web en internet | Hobby (gratis) |
| **Supabase** | Base de datos, cuentas de usuario e imágenes (se crea desde Vercel) | Free |

Tiempo aproximado: 20–30 minutos. No hace falta instalar nada en tu ordenador.

> Los nombres de los botones pueden cambiar un poco con el tiempo. Si no ves exactamente el mismo texto,
> busca la opción equivalente en el menú lateral.

La instalación de UND ya está hecha: <https://valorant-hub-nu.vercel.app> (código en
`github.com/francescguasch/valorant-hub`, base de datos Supabase `valorant-hub-db`). Esta guía sirve para
repetirla, por ejemplo para Hawaii UHE.

---

## 1. GitHub: el repositorio

1. Crea una cuenta en <https://github.com> (si no la tienes).
2. Arriba a la derecha: **+ → New repository**, ponle nombre y pulsa **Create repository**.
3. Sube el código (Claude puede hacerlo si le das el nombre `tu-usuario/tu-repositorio`).

El repositorio no contiene ninguna clave, así que puede ser público o privado.

## 2. Vercel: importar el proyecto

1. Entra en <https://vercel.com> → **Sign Up** → **Continue with GitHub**. Elige el plan **Hobby**.
2. **Add New… → Project** → busca tu repositorio → **Import** → **Deploy**.
   (Si no aparece, pulsa "Adjust GitHub App Permissions" y dale acceso a ese repositorio.)
3. El primer despliegue puede fallar o mostrar errores porque aún no hay base de datos. Es normal.

## 3. Supabase desde Vercel (las claves se ponen solas)

1. En el proyecto de Vercel: pestaña **Storage → Create Database → Supabase** (Marketplace).
2. Plan **Free**, región **Washington, D.C. (iad1)** (la misma que Vercel), nombre por ejemplo `valorant-hub-db`.
3. Acepta y conecta la base de datos al proyecto (entornos **Production**, **Preview** y **Development**).
   Vercel añade automáticamente las variables (`NEXT_PUBLIC_SUPABASE_URL`, `POSTGRES_URL`, claves…). La app las
   reconoce sin cambiar nada.
4. **Deployments → … → Redeploy** para que la web use las variables nuevas.

## 4. Crear la base de datos y el código del Owner

1. Desde Vercel: **Storage → tu base de datos → Open in Supabase**.
2. En Supabase: **SQL Editor → New query**.
3. Abre `supabase/setup.sql` en GitHub, pulsa **Copy raw file** y pégalo entero en el editor.
4. Pulsa **Run**. Si Supabase avisa de "Row Level Security", elige **Run without RLS**: el propio script ya activa
   la seguridad en todas las tablas.
5. El resultado final es una fila `owner_invitation_code`, por ejemplo `ABCD-EFGH-JKMN`. **Cópiala**: es el código
   para crear la cuenta del Owner. Caduca en 2 días.

Esto crea todas las tablas, la seguridad, los mapas, los agentes, la plantilla de Dakota y los datos DEMO.

### Desactivar el registro público

1. En Supabase: **Authentication → Sign In / Providers**.
2. Desactiva **Allow new users to sign up** y guarda.
   (Las cuentas solo se crean con un código de invitación desde la propia web.)

## 5. Crear la cuenta del Owner (solo una vez)

1. Abre `https://TU-DIRECCION.vercel.app/join`.
2. Escribe el código del paso 4, tu email, tu nombre y una contraseña.
3. Entras directamente como **Owner**.

¿Caducó el código antes de usarlo? En el SQL Editor ejecuta `select app.create_owner_invitation();` y te da otro
(solo funciona mientras no exista ningún Owner).

## 6. Invitar al equipo

1. **Settings → Members → Invite someone**.
2. Elige el rol (Player, Coach u Owner). Para jugadores, elige su perfil del roster (Zach, JaxaPixel…) para que
   puedan editar su propio perfil. Solo aparecen los jugadores que aún no tienen cuenta.
3. Pulsa **Create invitation code** y envía el código o el enlace por privado (Discord, WhatsApp…).
   El código funciona una sola vez y caduca en los días que elijas.
4. La persona abre el enlace, escribe su email y contraseña, y entra.

**¿Alguien olvidó su contraseña?** En **Settings → Members**, pulsa **Reset code** en su fila y envíale el código.
Lo usa en la página "Forgot your password?" del login. Dura 24 horas.

**Modo solo lectura:** por defecto, quien tenga el enlace puede ver Overview, Match Center, Team Analytics y Roster
sin cuenta, sin poder editar. Cámbialo en **Settings → Visitor access**.

**Antes de meter resultados reales:** borra los datos DEMO en **Settings → Data → Remove demo data**.

**Notificaciones:** la campana (abajo a la izquierda en ordenador, arriba en el móvil) avisa de entrenamientos en las
próximas 48 horas, sesiones sin resultados y revisiones de VOD abiertas más de una semana. Se van solas
cuando el asunto queda resuelto.

**Map Playbook:** cada mapa abre en **Gameplan**: el plan de ataque y de defensa, cómo lee el equipo el mapa, las
pizarras del mapa y los puntos fuertes y débiles. Se edita con **Edit**. En las pestañas T side y CT side están las
estrategias; cada una tiene su propia pizarra (arriba, en grande), su texto y sus puntos fuertes y débiles. Al crear
una estrategia, guarda y pulsa **Draw the board**.

**Pizarras tácticas:** en cada estrategia, mapa, rival, VOD, entrenamiento y partido hay un bloque **Tactics boards**.
El staff pulsa **New board** y dibuja sobre el minimapa: agentes y habilidades (aliados o enemigos), flechas, trazos,
zonas, texto, marcadores y pasos numerados. Al guardar se crea también la imagen, que los jugadores ven y pueden
descargar (**Download image**). Si preferís dibujar en ValoPlant, pegad su imagen exportada con Ctrl+V dentro del
editor (o en **Board → Image**) y el enlace en **Details**. Todas las pizarras están en **Map Playbook → Tactics boards**.

**Perfiles:** cada persona cambia su nombre y su foto en **Settings → Your account**. Para los jugadores, esa foto es
también la del roster. Los jugadores vinculados editan ahí también su nickname, nombre real y agentes.

**Ficha de jugador (Roster):** todos los partidos jugados con sus estadísticas, con filtros por mapa y agente y el
botón Practice (scrims) / Officials; rendimiento por agente, por mapa y agente × mapa; y una comparación de dos
selecciones (mapa + agente) con gráfico radar. Los datos salen del scoreboard de cada partido en Match Center.

## 7. Actualizaciones

Cada vez que se sube código nuevo a la rama `main` de GitHub, Vercel publica la web otra vez en 1–2 minutos.
Si la actualización trae cambios en la base de datos, **la web los aplica sola** la primera vez que alguien la abre
(quedan apuntados en `app.schema_migrations`). No hace falta pegar SQL en Supabase.

## 8. Copias de seguridad (gratis)

El plan Free de Supabase no guarda copias descargables. El repositorio incluye una tarea automática de GitHub que
copia toda la base de datos los lunes y jueves y guarda el archivo 90 días. Además, al usar la base de datos dos
veces por semana, evita que Supabase pause el proyecto por inactividad.

Para activarla:

1. En Supabase: **Connect** → copia la cadena **Session pooler** (puerto **5432**) con la contraseña de la base de
   datos. Si no la sabes: **Project Settings → Database → Reset database password** (después, en Vercel, vuelve a
   conectar la base de datos para que tenga la nueva).
2. En GitHub, en tu repositorio: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `BACKUP_DATABASE_URL`
   - Secret: la cadena del punto anterior.
3. Pestaña **Actions → Database backup → Run workflow** para probarla. Cuando termine, la copia aparece como
   archivo descargable ("Artifacts") dentro de esa ejecución.

Las exportaciones de **Settings → Data** (Excel con todo, o CSV por tabla) son otra copia sencilla de los datos.

**Restaurar** (solo si algo sale muy mal): crea un proyecto Supabase nuevo y pide ayuda técnica para cargar el
archivo `.sql` de la copia con `psql`.

## 9. Cosas a saber del plan gratuito

- **Supabase Free** pausa el proyecto tras 7 días sin actividad. La copia automática del paso 8 lo evita. Si se
  pausa, entra en Supabase y pulsa **Restore project**.
- Límites Free: 500 MB de base de datos y 1 GB de imágenes: de sobra para un equipo.
- **Vercel Hobby** es para uso no comercial: un equipo universitario encaja.

## 10. Cambiar fotos, colores o nombres

Todo está en **Settings → Team & branding**: nombre de la universidad, nombre del equipo, textos del inicio, temporada,
zona horaria (por defecto **America/Chicago**, la hora Central de Grand Forks), foto del campus, logo y colores.
La foto original del campus siempre se puede recuperar con **Use original photo**.

Mapas en rotación, agentes y roles de jugador: **Settings → Maps / Agents / Roles**.

## 11. Otra web con el mismo código (Hawaii y portfolio)

El mismo repositorio sirve para varias webs. Cada una es un **proyecto de Vercel distinto** con su propia base de datos y
una variable `TEAM_PRESET` que dice qué web es:

| `TEAM_PRESET` | Web | Base de datos |
|---|---|---|
| `und` (o sin poner) | University of North Dakota | Supabase |
| `hawaii` | University of Hawaiʻi, con la foto del campus, la foto del equipo en Roster y los 7 jugadores con su cara | Supabase (el segundo proyecto gratis) |
| `showcase` | Portfolio: un equipo pro ficticio con una temporada completa, sin inicio de sesión | Neon (gratis) |

Pasos para cada web nueva:

1. En Vercel, **Add New → Project** e importa el mismo repositorio.
2. Antes de desplegar, en **Environment Variables** añade `TEAM_PRESET` con `hawaii` o `showcase`.
3. Base de datos:
   - **Hawaii:** pestaña **Storage → Supabase**, igual que en el paso 3. Supabase Free deja 2 proyectos activos en
     total, contando todas las organizaciones de las que eres Owner o Admin: UND y Hawaii ocupan los dos.
   - **Portfolio:** pestaña **Storage → Neon** (Postgres gratis). No añadas Supabase: sin Supabase la web es de solo
     lectura para todo el mundo y la pizarra funciona en modo prueba (se dibuja y se descarga, no se guarda).
4. Despliega. La primera visita crea las tablas y aplica la plantilla: nombres, fotos, jugadores y, en el portfolio,
   los datos de la temporada. Solo pasa una vez y solo con la base de datos vacía; después todo se cambia desde
   **Settings** y **Roster** como en UND.
5. En Hawaii, saca el código del Owner como en el paso 4 (`select app.create_owner_invitation();` en el SQL Editor de
   ese proyecto) y crea la cuenta en `/join`.

## Alternativa: claves a mano (sin la integración de Vercel)

Si creas el proyecto directamente en <https://supabase.com>, copia estas variables en
**Vercel → Settings → Environment Variables** y vuelve a desplegar:

| Variable | Dónde está en Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API**: "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API Keys**: la **Publishable key** (o la legacy **anon**) |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma página: la **Secret key** (o la legacy **service_role**). **Es secreta** |
| `DATABASE_URL` | **Connect** → **Transaction pooler** (puerto **6543**), con tu contraseña en `[YOUR-PASSWORD]` |
