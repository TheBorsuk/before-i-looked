# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Preview

The digest preview is published by the `preview` workflow to https://theborsuk.github.io/before-i-looked/. Run it with `gh workflow run preview.yml`; a human approves the deploy.
The lane marker on the page comes from the repo secret `LANE_MARKER`.
Clean-up (ADR 0003): `gh secret delete LANE_MARKER`, then run the workflow again; the banner then reads "no marker set".
