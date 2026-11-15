---
name: deployment
description: Production deployment guide for Tactical Board Next on GitHub Pages with automated CI/CD, privacy-friendly GoatCounter visitor analytics (user counts + country demographics), and SPA routing fallback.
---

# Deploying Tactical Board Next

This guide outlines the production deployment architecture for Tactical Board Next: 100% free hosting, non-Google infrastructure, zero ads, automated HTTPS/SSL, and privacy-first visitor analytics.

---

## 1. Architecture Overview

- **Hosting Platform:** GitHub Pages (served via Fastly global edge CDN with automated Let's Encrypt SSL/TLS certificates).
- **CI/CD Automation:** GitHub Actions (`.github/workflows/deploy.yml`) running on push to `main` (and manual `workflow_dispatch`).
- **Target URL:** `https://ahmostafa.github.io/tactical-board-next/`
- **Cost:** \$0 / month forever.
- **Privacy & Non-Google Policy:**
  - Strictly **no** Google Cloud, Firebase, Google Analytics (GA4), or Google Tag Manager.
  - Strictly **no** ad networks, tracking cookies, or monetization scripts.
  - Zero GDPR cookie banner requirement.
- **Video Export Compatibility:** Uses `@ffmpeg/core` single-threaded WASM (`wasmBinary` buffer via UMD). Runs smoothly in all modern browsers without requiring high-privilege `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` server headers.

---

## 2. Hosting & Analytics Limits (Guaranteed $0.00 Cost)

| Platform | Bandwidth Limit | Build / CI Limit | Storage / Asset Limit | Behavior When Limits Exceeded | Risk of Charge |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GitHub Pages + Actions** *(Primary)* | **100 GB / month** (~700,000 site visits) | **UNLIMITED** free minutes for public repos | **1 GB** total (Our app is ~0.6 MB = 0.06%) | Email alert & temporary throttling (`HTTP 429`). Never auto-bills. | **0.00%** |
| **Cloudflare Pages** *(Alternative)* | **UNLIMITED** free bandwidth | **500 builds / month** (~16 builds/day) | 25 MB per file | New builds pause until next month; live site stays up. Never bills. | **0.00%** |
| **GoatCounter** *(Analytics)* | **100,000 views / month** | Serverless | Unlimited dashboards | Polite dashboard banner asking to sponsor/self-host. Never cuts service or charges. | **0.00%** |
| **Netlify / Vercel** *(Not Recommended)* | 100 GB / month | 300 mins / month | 100 MB | **Danger:** Auto-bills \$55 / 100 GB overages if a payment method is attached. | **High Risk** |

### Mandatory Setup Instructions to Guarantee You Never Pay Anything:
1. **Do NOT enter a credit card or payment method** anywhere on GitHub or GoatCounter.
2. **Verify your GitHub Hard Spending Limit is `$0.00 USD`:**
   - Open GitHub **Settings** (top-right profile menu) > **Billing and plans** > **Plans and usage**.
   - Scroll down to **Spending limits**.
   - Confirm that the monthly spending limit for **Actions, Packages, and Codespaces** is set to **`$0.00`** (this is the default on all free GitHub accounts).
   - With no card on file and a `$0.00` limit, it is impossible to be charged even if traffic spikes or limits are exceeded.

---

## 3. Enabling GitHub Pages (One-Time Repository Setup)

Before the first deployment workflow can publish, GitHub Pages must be configured to use GitHub Actions:

1. Open the repository on GitHub: `https://github.com/ahmostafa/tactical-board-next`
2. Navigate to **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**:
   - Change from *Deploy from a branch* to **GitHub Actions**.
4. That's it! Every future push to `main` will trigger `.github/workflows/deploy.yml` and publish live in approximately 60 seconds.

---

## 4. Pre-Deployment Quality Gate, About Modal & 404/500 Resilience

1. **Automated Unit Test Gate:**
   - `.github/workflows/deploy.yml` executes `npx tsc --noEmit -p tsconfig.app.json` and `npm test -- --watch=false` **before** building or deploying.
   - If any unit test fails, deployment aborts immediately and nothing is published.
2. **About Dialog & Live Version Display:**
   - Version metadata is centralized in `src/environments/version.ts` (`APP_VERSION = 'v1.0.1'`).
   - Clicking `ℹ About (v1.0.1)` in the top toolbar opens `AboutModalComponent`, displaying the exact version, release date, license (`ISC`), author, and zero-cookie privacy statement.
3. **404 Page Not Available & 500 Server/Runtime Error Recovery:**
   - **Static Edge Fallback (`404.html`):** `scripts/copy-404.mjs` copies `index.html` to `404.html` so shared `#scheme=` URLs and sub-routes never dead-end on GitHub's default 404 page.
   - **In-App 404 View (`NotFoundComponent`):** Unknown paths render a tactical `404 — Page Not Available / Out of Bounds` screen with an instant `⚽ Return to Tactical Board` button.
   - **500 / Runtime Error Boundary (`GlobalErrorHandler` + `ServerErrorBannerComponent`):** Uncaught JavaScript or resource failures trigger an accessible recovery dialog offering `🔄 Reload Board` and `💾 Reset to Clean Default` (clearing potentially corrupted localStorage data).

---

## 5. Privacy-First Visitor Analytics (GoatCounter)

To monitor how many users visit the board and where they come from (country and region breakdown) without violating user privacy or using Google services, Tactical Board Next integrates **GoatCounter**:

### Why GoatCounter?
- **100% Free** for personal and open-source projects.
- **Non-Google & Independent:** Built by open-source maintainers.
- **No Cookies / GDPR Compliant:** Does not track personal data, IP addresses, or cross-site identities. Complies with GDPR, CCPA, and PECR without needing a cookie consent banner.
- **Key Metrics Available in Dashboard:**
  - Total visits & daily unique active users.
  - **Geographic breakdown: Country and region distribution.**
  - Referring websites and social platforms.
  - Device type (desktop vs mobile) and browser family.

### Setting Up Your Free Analytics Dashboard:
1. Go to [https://www.goatcounter.com/signup](https://www.goatcounter.com/signup).
2. Enter your desired site code (`ammohamed`).
3. Enter your email and choose a password (no credit card required).
4. Verify that `src/index.html` has your matching code:
   ```html
   <script
     data-goatcounter="https://ammohamed.goatcounter.com/count"
     async
     src="//gc.zgo.at/count.js"
     data-goatcounter-settings='{"allow_local": false}'
   ></script>
   ```
   *Note: `allow_local: false` ensures local development runs on `localhost:4200` do not inflate your production metrics.*
5. Log into `https://ammohamed.goatcounter.com` anytime to view real-time visitor statistics and geographic charts.

---

## 6. SPA Routing & Deep Links (`404.html`)

Tactical Board Next is a Single Page Application (SPA). To support shareable tactical links (such as `#scheme=<base64url>`) and prevent HTTP 404 errors when visitors refresh a nested URL on GitHub Pages:
- The build script `npm run build:gh-pages` automatically executes `scripts/copy-404.mjs`.
- This duplicates `dist/tactical-board-next/browser/index.html` into `dist/tactical-board-next/browser/404.html`.
- When GitHub Pages encounters any direct route, it serves `404.html`, allowing Angular to bootstrap and immediately restore the tactical board scheme from the URL hash.

---

## 7. Build & Deployment Commands

### Local Verification
```powershell
# Fast TypeScript check
npx tsc --noEmit -p tsconfig.app.json

# Run unit tests
npm test -- --watch=false

# Test the GitHub Pages production build locally
npm run build:gh-pages
```

The output bundle is generated at `dist/tactical-board-next/browser/`:
- `index.html` & `404.html`
- Optimized JS/CSS bundles with cache-busting hashes
- Pre-bundled equipment SVG assets and favicon

### Deploying a Release
Deployments are completely automated:
```powershell
# 1. Commit and push to main
git push origin main

# 2. Or trigger a release tag
git tag -a v1.0.1 -m "Release v1.0.1: deployment automation"
git push origin v1.0.1
```

You can monitor the live deployment under the repository's **Actions** tab.

---

## 8. Custom Domain (Optional)

If you ever wish to connect a custom domain (e.g., `tactical-board.com` or `board.mydomain.com`):
1. In repository **Settings** > **Pages** > **Custom domain**, enter your domain name.
2. Check **Enforce HTTPS** (GitHub provisions a free Let's Encrypt certificate automatically).
3. If hosting at the root of a custom domain (`https://board.mydomain.com/`), change `--base-href /` in the build script instead of `--base-href /tactical-board-next/`.

---

## 9. Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Blank white screen / 404 on JS bundles** | Base href mismatch | Verify `--base-href /tactical-board-next/` was passed during build |
| **Deep links or refreshes show GitHub 404** | Missing `404.html` | Ensure `scripts/copy-404.mjs` runs after build |
| **Workflow fails with 403 Pages permission** | GitHub Pages permissions not enabled | Set Settings -> Pages -> Source to "GitHub Actions" |
| **GoatCounter shows 0 visits** | Localhost visits filtered or wrong code | Verify the site code in `src/index.html` matches your GoatCounter account name |
| **MP4 export fails on live site** | WASM asset path resolution | FFmpeg core is loaded from CDN/local bundle with correct UMD paths |
