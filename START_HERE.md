# Publish the automatically updating explorer

1. Create a public repository named california-gas-price-explorer. Use main as its default branch.
2. Extract this package. Upload the CONTENTS of the repository folder to the root of your repository, preserving directories. GitHub Desktop is recommended: clone your repository, copy the files into that local folder, commit, then push. Do not upload this ZIP itself.
3. Make sure .github/workflows/update-and-publish.yml and .standalone are included. File Explorer may not display every special folder. GitHub Desktop will include them when the full folder contents are copied.
4. In the repository, open Settings → Pages. Under Build and deployment, choose GitHub Actions as the source.
5. Open Actions → Update data and publish explorer → Run workflow → main → Run workflow.
6. After the run turns green, open the website URL shown by the deploy job or Settings → Pages. Share that URL with your advisor.

No paid API keys or custom domain are needed. Standard runners in a public repository are the intended free configuration. Do not enable paid larger runners.

## What updates
The workflow checks official EIA and BLS downloads daily at approximately 15:23 UTC. Scheduler timing can be delayed. Weekly and monthly data only advance when the agencies publish them. The website is rebuilt from the verified snapshot; it is not a real-time station price feed. Reload an already-open page to see a new build.

All downloads, validation, calculation checks, typechecking and the build must succeed before deployment. A failed run leaves the previous published website available. Check Actions for failures and enable GitHub notifications for failed workflows. The page shows the last successful retrieval and warns when observations exceed its freshness thresholds; it does not claim a failed check succeeded.

Each successful refresh commits the dataset and raw source archive for traceability. GitHub's default token commits do not trigger a second push workflow. Branch rules that block this bot's push will block deployment; review the Actions error rather than bypassing protections.

GitHub may disable schedules in public repositories after 60 days without repository activity. Regular successful refresh commits normally keep activity current, but extended failures require checking and re-enabling the workflow. The tool needs occasional maintenance; automation does not guarantee uninterrupted service.

## Verification before forwarding
Confirm the footer says Revision 0.2.0; source links and CSV/PNG/manifest downloads work; select a point wide, then narrow to 320px and confirm the detail block stays under the chart without horizontal overflow. Confirm a successful workflow updates the retrieval date and uses the correct series. Keep the previous local Revision 0.1.2 as a separately verified offline copy.

## Status of this package
Prepared and locally tested. Not yet installed or deployed in your GitHub account. A GitHub-hosted workflow run and hosted browser checks remain necessary.

Official guidance:
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
https://docs.github.com/en/actions/how-tos/monitor-workflows/notifications-for-workflow-runs
