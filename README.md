# RPS Arena — Beamable sample

A small session-based web game (Rock–Paper–Scissors, first to 2 round wins) built on the
[Beamable Web SDK](https://help.beamable.com/WebSDK-Latest/), backed by a C# Beamable microservice that
records every match in a Beamable microstorage (MongoDB).

- **Org / CID:** `hiro-demo` (`1468242222494837`)
- **Realm / PID:** `ClaudeSandbox-dev` (`DE_101047196461231105`)

## Layout

| Path | What it is |
| --- | --- |
| `services/MatchService` | Microservice. Server-authoritative game logic: `StartMatch`, `PlayRound`, `Forfeit`, `GetMyHistory`. The CPU's move is picked on the server, so clients can't fake results. |
| `services/MatchStorage` | Microstorage. `MatchRecord` documents in the `matches` collection: player id, every round, final status (`won` / `lost` / `draw` / `forfeit`), start/end time. |
| `web/` | Vite + TypeScript game. `Beam.init` signs the browser in as a guest; `src/beamable/clients` is the typed client generated from the microservice. |
| `.beamable/` | Beamable CLI workspace config (CID/PID). |
| `.mcp.json` | Beamable MCP server config (from `beam mcp setup`), so AI clients can run `beam` commands as tools. |

## Match flow

1. `StartMatch()` creates an `in_progress` record. If the player left an unfinished match behind, it is recorded as a forfeit.
2. `PlayRound(matchId, move)`: the server picks the CPU's move, scores the round and saves it. The match ends when either side reaches 2 round wins, or at 9 rounds (then the leader wins, or it's a draw).
3. `Forfeit(matchId)` ends the match as a forfeit.
4. `GetMyHistory(limit)` returns the player's W/L/D/F totals and most recent finished matches.

## Prerequisites

- .NET 10 SDK
- Docker (needed to build the microservice image when deploying)
- Node.js 22+
- The Beamable CLI, pinned in `.config/dotnet-tools.json`: run `dotnet tool restore`, then `dotnet beam …`

```bash
dotnet tool restore
dotnet beam login          # or: dotnet beam init --cid hiro-demo --email <you>
dotnet beam config set pid DE_101047196461231105   # ClaudeSandbox-dev
```

## Run the web game

```bash
cd web
npm install
npm run dev        # http://localhost:5173 — talks to the services deployed on ClaudeSandbox-dev
npm run build      # static site in web/dist, deployable to any static host
```

CID/PID come from `web/.env` (`VITE_BEAM_CID`, `VITE_BEAM_PID`).

### Hosting on GitHub Pages

`.github/workflows/pages.yml` builds `web/` and publishes it to GitHub Pages on every push to `main` that
touches `web/`, or when run manually from the Actions tab. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan.

## Change the microservice

```bash
dotnet beam project run --ids MatchService     # run it locally (storage runs in Docker)
cd web && npm run generate-client              # regenerate the TS client after changing endpoints
dotnet beam deploy release --merge -c "..."    # build, upload and release to the realm
```

`generate-client` runs `scripts/dedupe-generated-types.mjs` afterwards. The generator in CLI 7.2.3
writes a shared type (e.g. `MatchView`) once per endpoint that uses it, and TypeScript rejects the
duplicates. Build the service first (`dotnet build services/MatchService`): the generator reads the
compiled assembly.

## Realm setup that was needed

These have already been applied to `ClaudeSandbox-dev`:

- Realm config `notification|publisher = beamable`, which the Web SDK's realtime connection requires:
  `dotnet beam config realm set --key-values 'notification|publisher::beamable'`
- A published (empty) `global` content manifest. `Beam.init` fails with a 404 without one:
  `dotnet beam content publish`
