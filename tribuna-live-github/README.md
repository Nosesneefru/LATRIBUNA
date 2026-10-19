# Tribuna Live

Sitio estático para publicar en Netlify, con autenticación, control manual de membresías y señales almacenadas en Supabase.

## Archivos

- `index.html` — interfaz y reproductor HLS.
- `supabase-app.js` — acceso de usuarios, comprobación de membresía y administración de señales.
- `supabase-schema.sql` — tablas y políticas Row Level Security.
- `netlify.toml` — carpeta de publicación (`.`).

## Configuración de Supabase

1. En **SQL Editor → New query**, pegá el archivo completo `supabase-schema.sql` y tocá **Run**. Si ejecutaste la versión anterior, volvé a ejecutar esta versión para crear también la tabla `streams` y sus políticas.
2. En **Authentication → Users**, creá una cuenta con tu correo y contraseña.
3. Volvé al SQL Editor y ejecutá esta consulta, reemplazando el correo por el de tu cuenta:

   ```sql
   insert into public.content_admins (user_id)
   select id from auth.users where email = 'TU_CORREO'
   on conflict do nothing;
   ```

4. Iniciá sesión en el sitio. Si la cuenta es administradora, aparecerá **Administrar** y podrás importar una playlist M3U autorizada.
5. Para activar manualmente un miembro después de verificar su transferencia, ejecutá en SQL Editor (reemplazá el correo):

   ```sql
   insert into public.subscriptions (user_id, status, current_period_end)
   select id, 'active', now() + interval '30 days'
   from auth.users where email = 'CORREO_DEL_MIEMBRO'
   on conflict (user_id) do update
   set status = 'active', current_period_end = excluded.current_period_end;
   ```

   Cada activación dura 30 días desde ese momento. Renovala al confirmar el siguiente pago. La cuenta de servicio y la clave secreta de Supabase nunca van en el navegador; el sitio usa la clave **publishable**.

La cuenta tiene que existir primero en **Authentication → Users** para poder hacerla administradora. Si el registro no inicia sesión automáticamente, revisá el correo de confirmación o las opciones de confirmación de correo en Supabase Auth.

## Publicación

Subí el contenido de esta carpeta a la raíz del repositorio de GitHub conectado a Netlify. Netlify publica el sitio automáticamente; `netlify.toml` ya indica la carpeta `.`.

## Límites actuales

La membresía se habilita a mano luego de revisar la transferencia. La interfaz no procesa pagos. La importación M3U depende de que la fuente permita CORS y de que las señales sean reproducibles por HLS. Usá solo streams y listas que tengas autorización para publicar. Una página estática no puede ocultar completamente las URLs de stream frente a un miembro con acceso.
