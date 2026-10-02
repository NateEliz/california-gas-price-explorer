# California Gas Price Explorer — automatic updates

Start with [START_HERE.md](START_HERE.md) for GitHub upload, activation and operating instructions. Revision 0.2.0 preserves the verified 0.1.2 layout and adds daily scheduled refresh and GitHub Pages publishing. It is prepared locally; deployment remains pending.

# Historical development notes

Local research prototype, version 0.1, October 1, 2026. Independent project for advisor feedback; no official affiliation is assumed.

## Open the dashboard today

Download `California_Gas_Price_Explorer.html` and open it in a current desktop browser. It is a single file with the code, styles and dated data embedded. No installation, account or API key is required. Internet access is needed to open official-source hyperlinks. Browser interaction and mobile acceptance testing remain pending: see `docs/VALIDATION.md`.

The dashboard starts with monthly nominal prices and a one-year comparison. Change the historical baseline, switch to weekly observations, use one/five/ten-year presets, or choose monthly inflation adjustment. The three result cards show California's change, the California–U.S. gap and a gallons illustration. The data table provides the history behind the chart.

Design chosen by Nathan: a focused comparison view with white surfaces, navy headings, teal California and amber U.S. lines. The U.S. line is dashed to provide a second visual distinction. This is the first aesthetic review draft, not a final design approval.

Every displayed price has a nearby official-source hyperlink. Derived results link to their input sources and calculation. The methods panel opens when a calculation link is selected. The tool describes observed comparisons; it does not assign cents per gallon to a policy or administration.

## Data in this version

- Snapshot: `eia-bls-512f94779b431ee3`.
- Weekly CA/U.S. shared endpoint: September 28, 2026; history starts May 22, 2000.
- Nominal monthly shared endpoint: September 2026; history starts June 2000, excluding the initial partial month.
- Inflation-adjusted shared endpoint: August 2026, using that month's CPI-U as the reference.
- October 2025 CPI is missing in the downloaded BLS file. It stays unavailable, with no interpolation.
- Data is fixed until manually refreshed and the HTML rebuilt. This is not a live station-price feed.

Official series: EIA `EMM_EPMR_PTE_SCA_DPG` and `EMM_EPMR_PTE_NUS_DPG` (regular gasoline, all formulations, including taxes); BLS `CUUR0000SA0` (CPI-U, all items, U.S. city average, unadjusted). Exact URLs, retrieval time and hashes are in `data/snapshot.json`. Original downloaded files are preserved in `data/raw/<snapshot-id>/`. Ten imported observations were independently checked against EIA's official HTML tables: `data/source-checks.json`.

## Build and modify the source

Requirements: Node 22.13 or newer and pnpm 11.25.0. Install the locked dependencies with `pnpm install --frozen-lockfile`. Use the included lockfile; do not substitute an unrelated dependency version set.

```sh
pnpm typecheck
pnpm test
pnpm build:local
```

`build:local` writes the self-contained file to `deliverables/California_Gas_Price_Explorer.html`. The same React component is used in the portable HTML and the Vinext app. For code review during development, `pnpm dev` starts the framework development server. The original Sites-compatible framework build remains available as `pnpm build`; the project has not been registered or deployed.

On Windows, these commands can be run in PowerShell after installing Node and pnpm. Opening the delivered HTML does not require any developer tools.

Key files:

| File | Responsibility |
|---|---|
| `components/explorer.tsx` | Controls, source links, results, chart, table and methods |
| `app/explorer.css` | Chosen appearance and responsive layouts |
| `lib/prices.ts` | Validation, comparisons, CPI conversion, presets and CSV |
| `lib/export-png.ts` | Image export with dates, sources and context |
| `scripts/refresh-data.py` | Validated official-data refresh and raw archives |
| `scripts/verify-source-observations.py` | Ten independent official-table cross-checks |
| `.standalone/` and `scripts/build-standalone.mjs` | Single-file HTML build |
| `docs/` | Build brief, research dossier and validation record |

## Manual data refresh

Python 3 and the pinned dependency in `requirements-data.txt` are needed only for the EIA `.xls` import. Install it with `python -m pip install -r requirements-data.txt`.

```sh
python scripts/refresh-data.py
python scripts/verify-source-observations.py
python tests/refresh.test.py
pnpm test
pnpm typecheck
pnpm build:local
```

Refresh validates series identifiers, dates, units, duplicates and positive finite values before atomically replacing the snapshot. It preserves the previous snapshot on failure and rejects a rollback in coverage. Null observations remain gaps. Raw downloads and SHA-256 hashes preserve provenance. This is a manual process; no background job has been installed. Rebuild and redistribute the HTML after every successful refresh.

The snapshot-specific endpoint test in `tests/prices.test.mjs` intentionally records the delivered October 1 snapshot. After a refresh, review and update its expected dates/missing month assertions using official source records before rerunning acceptance checks. Do not simply delete a failing audit assertion. Check that the source-check report identifies the new snapshot.

## Method and limitations

Dollar change = latest CA − baseline CA. Percentage change = 100 × (latest CA / baseline CA − 1). Gap = CA − U.S.; gap change = latest gap − baseline gap. Fill-up illustration = gallons × CA change, with constant gallons. Inflation-adjusted price = nominal price × endpoint CPI / period CPI, using the same monthly CPI for both geographies.

Calculations retain full precision before rounding. Weekly presets choose the last valid observation on/before the anniversary, within seven days; actual dates remain visible. Monthly presets require the exact matching month. Weekly inflation adjustment is disabled. The U.S. average includes California. EIA's May 14, 2018 methodology change is shown because estimates across the transition are not directly comparable.

CSV exports include all displayed history, result summaries, formulas, dates, units, source URLs and snapshot metadata. PNG includes the chart, comparison, URLs and context. Browser downloads and clipboard behavior need real-browser testing. Local-file share links are disabled; a hosted version would be needed for shareable comparison URLs.

Research into taxes, refineries, California/Texas regulation, special fuel blends, COVID, federal policy, conflict and vehicle transitions is retained in the dossier. Those modules are deferred and are not quantitative causal claims in this build. Public release follows aesthetic feedback, browser/mobile/accessibility checks and any new source review. No hosting action has been taken.


## October 1 external audit update

See `docs/California_Gas_Price_Explorer_Audit_Record_2026-10-01.md`. The supplied reviewer report describes exact matching of all retained EIA history and all four workbook hashes. A direct live BLS check matched its archived hash and all 314 embedded CPI observations. The external reviewer did not execute the interface or review the build brief/source ZIP. Browser acceptance remains pending. This update changes documentation and audit evidence only; the HTML and data snapshot are unchanged.


## Mobile tooltip patch

A subsequent external browser pass confirmed the main controls and downloads and reported sideways overflow from a selected tooltip at 390 px. The tooltip now wraps and stays anchored inside the chart on narrow screens. The rebuilt HTML and typecheck pass; a browser regression check of the patch at 390/320 px is still needed. Data and calculations were not changed. Details and remaining keyboard/share-link checks are in the audit record.


## Revision 0.1.2

The latest automated Chromium report passed 320 px edge clicks and keyboard checks on its tested artifact but failed wide-to-narrow tooltip positioning. This revision renders selected observations and source links below the chart in normal document flow and adds a visible footer revision. Typecheck and standalone build passed; the new revision's resize behavior still requires a browser retest. See the latest audit section.
