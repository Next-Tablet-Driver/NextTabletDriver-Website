# NextTabletDriver — Website

The landing page for [NextTabletDriver](https://github.com/Next-Tablet-Driver/NextTabletDriver), a Rust-native, low-latency tablet driver for Windows and Linux. Built with Astro, Tailwind CSS, and GSAP.

The download section and hero CTA always point at the latest GitHub release — the release data (version, assets, checksums) is fetched once at build time in [`src/lib/github.ts`](src/lib/github.ts), so there's no client-side API call and no rate-limit risk.

## Project structure

```text
/
├── public/                     favicon
├── src/
│   ├── components/             page sections (Header, Hero, ActiveAreaMapper, Features, ...)
│   ├── layouts/Layout.astro    document shell: meta tags, theme init, PostHog init
│   ├── lib/github.ts           build-time GitHub API fetch + asset classification
│   ├── lib/motion.ts           shared GSAP setup + reduced-motion check
│   ├── lib/tablets.ts          supported tablet brand list
│   ├── pages/index.astro       assembles the sections, wires up scroll-reveal motion
│   └── styles/global.css       color tokens (light/dark) + Tailwind v4 setup
└── .github/workflows/
    ├── deploy.yml                 builds + deploys to Vercel on push to main
    └── notify-vercel.yml          see "Auto-deploy on release" below
```

## Commands

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm run dev`       | Start the dev server at `localhost:4321`      |
| `npm run build`     | Build the static site to `./dist/`            |
| `npm run preview`   | Preview the production build locally          |

## Environment variables

For local dev, create a `.env` file (not committed) with any of the following — all are optional and the site builds fine without them:

```sh
# Raises the GitHub API rate limit for the build-time release fetch.
# A fine-grained PAT with no permissions (public read access) is enough.
GITHUB_TOKEN=

# Leave both unset to skip PostHog entirely — no analytics code ships.
PUBLIC_POSTHOG_KEY=
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

In production these are **not** set in the Vercel dashboard — [`deploy.yml`](.github/workflows/deploy.yml) injects them at build time from GitHub Secrets. See [Deployment](#deployment).

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys to Vercel on every push to `main` (and via manual dispatch), using the Vercel CLI directly rather than Vercel's own Git integration — this is what lets `PUBLIC_POSTHOG_KEY` live in GitHub Secrets instead of the Vercel dashboard.

**One-time setup:**

1. Run `npx vercel link` locally to link this directory to the Vercel project. This writes `.vercel/project.json`, containing the org and project IDs.
2. Create a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens).
3. In this repo's Settings → Secrets and variables → Actions, add:
   | Secret | Value |
   | :-- | :-- |
   | `VERCEL_TOKEN` | the token from step 2 |
   | `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
   | `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |
   | `POSTHOG_KEY` | PostHog project API key |
   | `POSTHOG_HOST` | optional, defaults to `https://us.i.posthog.com` |
4. In the Vercel dashboard, Project Settings → Git → disconnect (or pause) the GitHub integration's auto-deploy. Otherwise every push still triggers a **second**, parallel build on Vercel's own infra — one that has no PostHog key, since that's now only in GitHub Secrets.

`GITHUB_TOKEN` needs no setup: Actions provides it automatically, and the workflow passes it through to raise the release-fetch rate limit.

## Auto-deploy on release

[`.github/workflows/notify-vercel.yml`](.github/workflows/notify-vercel.yml) POSTs to a Vercel Deploy Hook whenever a release is published. It needs to live in the **driver repo** (`Next-Tablet-Driver/NextTabletDriver`), not here, since it's the driver's releases that should trigger a rebuild of this site. To wire it up:

1. In this project's Vercel dashboard: Settings → Git → Deploy Hooks → create one (any branch, e.g. `main`).
2. Copy `.github/workflows/notify-vercel.yml` into the driver repo's `.github/workflows/` directory.
3. In the driver repo: Settings → Secrets and variables → Actions → add `VERCEL_DEPLOY_HOOK_URL` with the hook URL from step 1.

A published release then triggers a rebuild that picks up the new version and assets automatically.

> **Caveat:** a deploy hook triggers a build on Vercel's own infrastructure, bypassing `deploy.yml` — so that rebuild runs **without** `PUBLIC_POSTHOG_KEY`, since it now lives only in GitHub Secrets, not the Vercel dashboard. Until this is bridged (e.g. having the driver repo dispatch a `workflow_dispatch` on this repo's `deploy.yml` instead of hitting the hook directly), release-triggered rebuilds ship without analytics. The simplest interim fix is mirroring `PUBLIC_POSTHOG_KEY`/`PUBLIC_POSTHOG_HOST` into the Vercel dashboard too, as a fallback for this path only.
