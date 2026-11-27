# Shell releases

Make map and serving Worker changes in your public KiMap checkout. The PowerShell examples below start in its repository root and use Node 24.22.2.

## 1. Test a change locally

Choose a descriptive branch name in place of `my-map-change`.

```powershell
git switch main
git pull --ff-only
git switch -c my-map-change
npm ci
npm run dev
```

Open the loopback URL printed by the dev server. Search for **Survey Station** to try the sample map. Restart the server after source edits. When you're ready to check the change, press **Ctrl+C**.

## 2. Run checks and open a pull request

```powershell
npm run check
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm run test:browser
```

These commands use Microsoft Edge for the desktop and phone checks. To use Playwright's Chromium instead, leave `PLAYWRIGHT_CHANNEL` unset and run `npm exec -- playwright install chromium`. The browser setting lasts for the current PowerShell session.

Review your diff, stage and commit the intended files, then push your branch:

```powershell
git push -u origin HEAD
```

Open a pull request against `main`. The **Build, test and preview** check also builds and validates the Cloudflare package. Merge when the required check passes.

## 3. Check the exact Vanilla preview

After a map change merges, GitHub builds the merged commit and uploads an inactive version of `kim-data-store`. It verifies the shell bytes, Vanilla bootstrap, a representative dataset and an artwork response. Open the run for your commit in [Preview and publish map](https://github.com/mattresspad/kimap/actions/workflows/release.yml).

```powershell
git switch main
git pull --ff-only
git rev-parse HEAD
```

Compare the printed SHA with the commit in the run summary. If another change has merged, use the release run for the new head of `main`. From the matching checkout, run:

```powershell
npm ci
$env:PLAYWRIGHT_CHANNEL = "msedge"
$previewUrl = Read-Host "Paste the exact version URL from the GitHub run summary"
node checks/published.mjs $previewUrl
```

You can also copy the complete `node checks/published.mjs` command from the summary. This checks the full Vanilla map, including the three landmark files, desktop interactions and phone search. Open the same version URL to try your change. If the command fails, leave approval pending while you investigate.

## 4. Approve production

Once the local checks pass and the preview looks right, Prd (`mattresspad`) selects **Review deployments → production → Approve and deploy** in that run. GitHub rechecks the commit, package annotation, previous deployment and Vanilla publication, promotes the reviewed version, and confirms through Cloudflare that it receives 100% of traffic. A changed branch, changed publication or intervening deployment requires a fresh preview.

## 5. Check the live map

Download the **map-live-…** artifact from the same run and extract it. In your checkout, run:

```powershell
$receiptPath = Read-Host "Paste the full path to the extracted production.json"
node checks/release.mjs verify-live "$receiptPath"
```

The command compares the live shell and Vanilla publication with the approved receipt, then runs the desktop and phone checks against [the live map](https://map.kenshi.wiki/).

## Release configuration

The repository uses the Actions secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`. The production environment requires a protected branch and review by `mattresspad`.

To recheck traffic without deploying, manually run the release workflow on `main` with the deployed commit SHA and its production run ID. Changes limited to the README, this guide, the release workflow or its release script run CI without starting a shell release.

## Recovery

Download the preview and live receipts from the run's artifacts. They contain the commit, package SHA-256, candidate version, previous version and deployment ID. If live verification fails, inspect the actual active version first. When it is serving the newly promoted version, an authorized maintainer can restore the recorded previousVersion to 100% using Cloudflare's deployment history. Verify the public bootstrap and map shell afterward.

Worker rollback restores shell code and static assets. The data publisher owns revisions of the R2 bootstrap, and the artwork publisher owns artwork releases. This workflow has no upload step for either bucket.
