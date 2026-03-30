# Elastic Calculator

React + TypeScript capacity planning UI for Elasticsearch-style clusters. Uses [Baklava Design System](https://baklava.design/).

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — Typecheck and production bundle
- `npm run preview` — Preview production build

## Features

- Cluster inputs: master/data counts, memory, CPU, total disk
- Multiple indices: documents, primary size, shards, replicas, read/write rates
- Optional mapping JSON to estimate index size
- Per-node write/read/storage breakdown (uniform split across data nodes)
- Warnings for shard, heap, disk, and load heuristics
- Underscale / overscale / shard / node recommendations
- CSV export and localStorage persistence

## Stack

- Vite 5, React 18, TypeScript
- `@trendyol/baklava` web components with `@lit/react` wrappers
# Es-Cluster-Designer
