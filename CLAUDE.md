# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Custom Azure DevOps pipeline extension that wraps Trivy security scanning. It has two components:

1. **UI extension** — a React app (`ui/`) that renders as a tab in ADO build results, reading Trivy scan output from build attachments
2. **Extension packaging** — `vss-extension.json` / `vss-extension.dev.json` manifests that bundle the UI into a `.vsix` for the ADO Marketplace

There is no separate "task" script in this repo — the ADO task itself runs Trivy and uploads JSON attachments; this repo is the UI that visualises those results.

## Commands

```bash
make build        # Build UI (React → ui/build/) — runs make clean first
make lint         # Lint TypeScript/TSX in ui/src/ via ESLint
make package      # Build + create .vsix (requires tfx-cli globally)
make package-dev  # Build + create .vsix from vss-extension.dev.json
make install-deps # Install tfx-cli globally (npm install -g tfx-cli)
```

No unit tests exist — `ui/package.json` has no test implementation.

**Local UI dev server** (points at localhost:44300, used with the dev extension):
```bash
cd ui && npm start
```

## Architecture

### How the UI Reads Scan Results

`App.tsx` initialises the ADO Extension SDK, gets the current build ID and project ID, then polls the build timeline for records named `trivy` or `trivy_*`. Once complete, it fetches three attachment types from the ADO Build API:

- `JSON_SUMMARY` — summary across all scans (`Summary` type in `trivy.tsx`)
- `JSON_RESULT` — full report per scan (`Report` type in `trivy.tsx`); lazy-loaded per repository selection
- `ASSURANCE_RESULT` — policy/assurance results (`AssuranceReport` type in `trivy.tsx`)

The data model for all Trivy output types is in `ui/src/trivy.tsx`. Component tree: `App` → `ReportsPane` → `ImageReport` / `FilesystemReport` → `VulnerabilitiesTable` / `MisconfigurationsTable` / `SecretsTable` / `AssuranceTable`.

### Extension Manifests

Two manifests exist:

- `vss-extension.json` (prod) — publisher `InfoTrack`, id `trivy-infotrack`, `public: false`
- `vss-extension.dev.json` (dev) — publisher `InfoTrack`, id `trivy-official-dev`, has `baseUri: https://localhost:44300` to serve UI from local dev server

`VERSION_PLACEHOLDER` in both manifests is replaced by `scripts/release.sh` / `scripts/dev.sh` before packaging.

### CI / Publishing

| Trigger | Workflow | Action |
|---|---|---|
| Pull request | `lint.yml` + `package.yml` | Lint and verify `.vsix` builds |
| Push tag `dev*` | `publish-dev.yml` | Run `scripts/dev.sh` → publish dev extension |
| Push tag `v*` | `publish.yml` | Run `scripts/release.sh` → publish prod extension |

Publishing uses `tfx extension publish` with `PUBLISHER_TOKEN` secret (ADO Personal Access Token with Marketplace publish scope).

## Key Conventions

- Task version is semver (`major.minor.patch`) — `VERSION_PLACEHOLDER` in manifests is replaced at publish time
- Breaking changes to task inputs require a new major version to preserve backward compatibility in existing pipelines
- The extension is referenced by `azure.devops.templates/trivy/` — coordinate version bumps across both repos
- Extension publisher ID is `InfoTrack` — do not change without updating all pipeline references
- The UI must work on both Linux and Windows ADO agents (the build runs on `ubuntu-latest`)
