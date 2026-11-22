# Deployment plan

Deploy the finished static site to Cloudflare Pages through GitHub integration after release approval.

| Setting         | Value                              |
| --------------- | ---------------------------------- |
| Git branch      | `main`                             |
| Repository root | Repository root                    |
| Build command   | `npm run build`                    |
| Build output    | `dist`                             |
| Node runtime    | 24.x, matched to CI                |
| Hosting         | Static Cloudflare Pages over HTTPS |

Enable automatic production builds after pushes to `main`. Preview builds can be enabled for release verification. Confirm that a fresh npm install is reproducible from the lockfile and that the site serves all model, image, and PDF assets from the expected paths and MIME types. Confirm HTTPS over the generated Pages URL and any approved custom domain.

Track the full compressed initial request set against the approximate 10–20 MB engineering target. Defer basement files and PDFs to visitor interaction. Keep individual site assets below the [Cloudflare Pages per-file limit](https://developers.cloudflare.com/pages/platform/limits/). Use the [Pages build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/) to configure the Node version. The site uses static hosting with no runtime secrets, database, or Pages Functions.
