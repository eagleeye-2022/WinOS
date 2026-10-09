# Location data (countries, states, cities, flags)

Static reference data for the All Projects table's **Client Location** columns and country
flags. The app reads these files directly — there is **no location library at runtime and
nothing is stored in the database** (projects only store the chosen name/code).

| File | Shape | Used by |
| --- | --- | --- |
| `countries.json` | `[{ "code": "IN", "name": "India" }]` (ISO 3166-1 alpha-2, sorted) | Country dropdown + filter |
| `states.json` | `{ "IN": [{ "code": "MP", "name": "Madhya Pradesh" }] }` | State dropdown |
| `cities.json` | `{ "IN": { "MP": ["Agar", "Indore", …] } }` | City dropdown (loaded only when a City dropdown opens) |
| `flags/XX.svg` | 3:2 SVG flag per ISO code | `GET /api/flags/[code]` |

Read by `src/features/projects/actions/location-actions.ts` and
`src/app/api/flags/[code]/route.ts`. `next.config.ts` includes `flags/` in the server trace so
the SVGs ship with the deployment.

## Sources and licences

- Countries / states / cities: [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database),
  licensed under the **Open Database License (ODbL-1.0)** — attribution required. Exported via the
  `countries-states-cities-service` npm package (MIT).
- Flags: [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) (**MIT**).

## Refreshing the data

`scripts/export-location-data.mjs` regenerates every file here (files only, never the database):

```bash
npm install --no-save countries-states-cities-service@1.5.1 country-flag-icons@1.6.20
node scripts/export-location-data.mjs
```
