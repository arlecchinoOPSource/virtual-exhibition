# Cloudflare Workers deployment

The production Worker `adt12b-exhibition-virtual` serves the Vite build as static assets using `wrangler.jsonc`. It has no application Worker script or SPA fallback. Cloudflare's default HTML routing serves `/` and redirects `/directory.html` to `/directory`.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Node | 24.x |
| Build | `npm run build` |
| Deploy | `npx wrangler@4.168.0 deploy` |
| Assets directory | `dist` |
| Branch preview builds | Disabled for beta |

## Updates and rollback

1. Make changes on a feature branch and open a pull request. Run `npm ci`, `npm run build`, and `npm test`; run browser tests for interaction changes.
2. Review and merge to `main`. Workers Builds automatically builds and deploys that commit. Branch previews are disabled; use a local preview unless the owner has arranged protection for previews.
3. In Cloudflare, open Workers & Pages → `adt12b-exhibition-virtual` → Deployments. Open the build to inspect installation, build and deploy logs, and verify the production site after the deployment succeeds. Failed builds do not deploy a replacement version.
4. To roll back, open Deployments and use the available rollback action for a previously working version. Verify the site afterward. A later successful Git build can deploy again; fix or revert the source on `main` as well.

## Access and limitations

The gallery password check runs in browser JavaScript. It is a visitor interface gate, not server-side access control: the directory and static files can be fetched directly, and the password digest is included in client code. The GitHub repository is public. Do not treat the password or a preview URL as protection for confidential content.

For actual restricted access, configure Cloudflare Zero Trust Access with an identity policy covering the production hostname and all asset paths before publishing sensitive content; separately protect or disable all preview and version URLs and ensure no alternate unprotected route remains. Do not change access policies without owner approval.

## Known follow-ups

The 2026-11-26 Cloudflare clean install reported one high-severity npm vulnerability; run `npm audit` with registry access to identify the advisory and fix it without an unreviewed breaking upgrade. Vite warned that the main JavaScript chunk exceeds 500 kB (about 643 kB minified, 164 kB gzip); evaluate code splitting separately. Verify gallery interaction, basement navigation, audio and browser console on the deployed site after future changes.
