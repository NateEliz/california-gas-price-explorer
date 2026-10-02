# California Gas Price Explorer

Historical California and U.S. regular gasoline prices, with nominal and inflation-adjusted comparisons, linked official sources, and CSV/PNG/source-manifest exports.

## Publish and activate

Follow [START_HERE.md](START_HERE.md). In Settings → Pages, choose GitHub Actions. Then run Update data and publish explorer from the Actions tab. The workflow checks EIA and BLS daily, validates downloads and calculations, builds the site, retains the verified dataset in Git history, and publishes through GitHub Pages. Failed runs retain the last published website.

Revision 0.2.0 preserves the externally verified Revision 0.1.2 chart-detail layout. Local verification: seven calculation tests, three refresh tests, dynamic dataset checks, standalone build and TypeScript checks passed. GitHub runner installation, live downloads, Pages deployment and hosted browser checks must still pass.

## Develop

Node 22.13+, pnpm 11.25.0 and Python 3.10+. Install with `pnpm install --frozen-lockfile` and `python -m pip install -r requirements-data.txt`.

Run `pnpm test`, `python tests/refresh.test.py`, `pnpm run build:local`, and `pnpm exec tsc --noEmit --incremental false`.

## Data and interpretation

EIA regular gasoline, all formulations, dollars per gallon including taxes: California EMM_EPMR_PTE_SCA_DPG and U.S. EMM_EPMR_PTE_NUS_DPG. Inflation uses BLS CPI-U CUUR0000SA0. Source URLs, hashes and retrieval dates are embedded in data/snapshot.json. Raw source files are retained under data/raw/<snapshot-id>.

The national average includes California. The displayed gap is descriptive and does not establish the causal effect of a policy. Missing CPI observations remain unavailable. Comparisons crossing May 2018 flag the EIA methodology change. This is a dated official-data explorer, not a real-time station price feed.

## Operation

Check Actions for failed runs and enable workflow failure notifications. Schedules may be delayed and may be disabled after 60 days without repository activity. A successful refresh normally commits updated retrieval metadata. Reload open pages after publication to see the new dataset.

Independent research project; no official affiliation is implied.
