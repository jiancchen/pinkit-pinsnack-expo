# Sample Apps Catalog

Droplets seeds bundled sample apps from `assets/sample-apps`.

## Supported layouts

1. Legacy flat file:
   - `assets/sample-apps/my-app.html`
2. Preferred directory layout:
   - `assets/sample-apps/my-app/app.html`
   - `assets/sample-apps/my-app/meta.json` (optional, but recommended)

`meta.json` can come from an exported debug bundle and should contain fields like:
- `title`
- `description` or `prompt`
- `category`
- `style`

## Refreshing the catalog

Whenever you add/remove sample apps, run:

```bash
yarn samples:refresh
```

This regenerates `src/constants/SampleAppCatalog.generated.ts`, which SeedService uses at app startup.

The npm scripts (`start`, `start:dev`, `ios`, `android`, `web`) run this step automatically.
On startup, seeding checks both sample IDs and a content signature, so replacing a sample with the same slug still updates the seeded app.
