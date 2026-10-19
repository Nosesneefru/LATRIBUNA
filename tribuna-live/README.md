# Tribuna Live

Starter web page for the Tribuna sports-site prototype.

## What's included

- `index.html` — responsive landing page, manual membership payment instructions, local M3U importer and HLS player.
- `supabase-schema.sql` — initial database tables and row-level security policies for matches, admins, and manually approved memberships.
- `netlify.toml` — static-site publishing settings for Netlify.

## Important before publishing

This is a prototype, not a finished paid-membership service. The page is not yet connected to Supabase Auth or its database, and it does not yet enforce the subscription gate in the user interface. The M3U import is saved only in the current browser. Do not advertise or accept paid memberships as if access were already automated.

Playback also depends on the playlist and its video streams allowing browser access (CORS), and on the stream being compatible HLS. The page loads Hls.js from jsDelivr.

The payment alias and WhatsApp contact are included in `index.html` as public membership instructions. Anyone who visits the published page can see them.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**, paste all of `supabase-schema.sql`, and run it.
3. Create your owner user under **Authentication → Users**.
4. In SQL Editor, replace the email below with that user's email and run it:

   ```sql
   insert into public.content_admins (user_id)
   select id from auth.users where email = 'TU_CORREO'
   on conflict do nothing;
   ```

5. Keep your database password and secret/service-role keys private. The browser integration will use the project URL and publishable key after the app is connected.

## Publish with GitHub and Netlify

1. Create a **private** GitHub repository and upload the files from this folder.
2. In Netlify, choose **Add new project → Import an existing project**, connect GitHub, and select the repository.
3. Leave the build command empty and use `.` as the publish directory. `netlify.toml` already sets the publish directory.
4. Netlify gives the site a public URL. Any later push to the connected branch triggers a new deploy.

GitHub stores the source code; Netlify hosts the public site; Supabase provides the database and authentication. Uploading this prototype alone does not complete the Supabase connection or membership gate.
