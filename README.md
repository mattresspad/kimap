# Kenshi Interactive Map

[Open the live map](https://map.kenshi.wiki/) to explore Kenshi 1.0.68, inspect towns and factions, simulate world-state changes, and exchange scenarios, marker sets and paint plans as JSON files.

## Run a local map

Use Node 24.22.2 and run:

```sh
npm ci
npm run dev
```

Open the loopback URL printed in the terminal (normally http://127.0.0.1:8797). Search for **Survey Station**. In Simulate, change Alpha's status and use Undo to restore the scenario. Restart the command after source changes. Set PORT and KIM_ASSET_PORT to change the two loopback ports.

The preview is a small original survey map. The application reads the same v3 contract and uses the same serving Worker as production. Its datasets, two colored regions, landmarks and artwork are local. Its scenario baseline is unique. The live site has the full game world.

## Check a change

```sh
npm run check
npm exec -- playwright install chromium
npm run test:browser
npm run package:build
npm run package:check
```

On Linux CI installs Chromium with --with-deps. PLAYWRIGHT_CHANNEL can select an installed browser such as msedge. Formatting drift is reported separately by npm run format:check. Open pull requests against main. Include the checks you ran and, for interaction changes, the desktop or phone behavior you observed.

To inspect published artwork, use `npm run check:worker-assets -- icons/caravan-save-simple.svg`. Exit code `2` means the result is inconclusive. This command reads the live asset service. Political, discovery and Context audit commands also accept a local publication with --bundle. Their remote Caravan manifest mode belongs to the previous server integration.

## Delivery

KiMap bundles Alpine, Pico, Leaflet, D3, the TGA reader and the Exo 2 font into its static shell. The kim-data-store Worker serves that shell and /map-data/vanilla.json, then reads revision-qualified data from its MAP_DATA R2 binding. Shared artwork comes from [the asset Worker](https://kim-assets.kenshi.wiki/). The private publisher owns the Vanilla ZIP and data publication, and kim-worker owns shared artwork delivery.

Maintainers can also run the private full-data rehearsal from kim-data-store with npm run seed and npm run preview. Set KIMAP_DIR to this checkout, KIM_ART_SOURCE_DIR to the artwork mirror and VANILLA_ZIP to the pinned archive. That workflow also needs the private kim-worker checkout. Only the public repository owns the serving Worker and shell release.

## Licensing

Independent KiMap software and original preview material use MIT. See [licensing and third-party notices](LICENSING.md) for the scope, maintained dependencies and game material.
