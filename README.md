# Vidhi Patel — portfolio

Source for [2025-website-portfolio.vercel.app](https://2025-website-portfolio.vercel.app): a bright one-room gallery of Vidhi's work, kept by Ping, a lilac plush bunny whose eyes follow your cursor.

Built with Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, GSAP + Lenis, and a hand-rolled WebGL2 dot stage.

## Develop

Requires Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

| Script | What it does |
|---|---|
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` and ESLint |
| `pnpm budget` | Byte budgets against the last build |
| `pnpm test:e2e` | Playwright (Chromium + WebKit) against a QA build |
| `pnpm lhci` | Lighthouse CI against `next start` |

The contact form posts to Formspree from a Server Action, and only sends in Vercel production. Everywhere else it returns a mock success.

All copy lives in `content/`. Only entries marked `verified: true` render.

## Credits

Fonts: Instrument Serif, Instrument Sans and Departure Mono, all under the SIL Open Font License 1.1.
