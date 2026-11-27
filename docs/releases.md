# Shell releases

Open a pull request against main. **Build, test and preview** runs the local survey on desktop and phone, exercises the app, and checks the Cloudflare package. That job needs no account credentials.

After merge, [Preview and publish map](https://github.com/mattresspad/kimap/actions/workflows/release.yml) builds the final commit, records the current deployment and recovery version, uploads the prebuilt package as an inactive version of kim-data-store, and verifies its shell bytes, Vanilla bootstrap, representative dataset and artwork response. GitHub runs the survey fixture on desktop and phone. The run summary links to the exact inactive version and gives the local Vanilla check command.

Before approval, use a local checkout at the commit shown in the summary. Run `npm ci` and install Chromium with `npm exec -- playwright install chromium`, or select an installed browser with `PLAYWRIGHT_CHANNEL`. Run the summary’s `node checks/published.mjs <version-url>` command. It checks the real Vanilla map, landmark files, and desktop and phone interactions. A nonzero exit leaves the candidate pending investigation.

After the local check exits successfully for that exact candidate, Prd can select **Review deployments**, choose **production**, and approve. Promotion checks main, the package annotation, the previous deployment and the Vanilla publication again. It assigns traffic to the tested version and verifies HTML, JS, CSS, the decoder, the favicon, Vanilla data and artwork at map.kenshi.wiki. A changed branch, changed publication or intervening deployment requires a new preview.

The repository uses the Actions secret CLOUDFLARE_API_TOKEN for Worker version and deployment operations and the variable CLOUDFLARE_ACCOUNT_ID for account selection. The production environment is restricted to protected branches and requires mattresspad. The generic workers.dev address serves the active map. Only the version-specific URL in the receipt identifies the tested candidate.

## Recovery

Download the preview and live receipts from the run's artifacts. They contain the commit, package SHA-256, candidate version, previous version and deployment ID. If live verification fails, inspect the actual active version first. When it is serving the newly promoted version, an authorized maintainer can restore the recorded previousVersion to 100% using Cloudflare's deployment history. Verify the public bootstrap and map shell afterward.

Worker rollback restores shell code and static assets. The data publisher owns revisions of the R2 bootstrap, and the artwork publisher owns artwork releases. This workflow has no upload step for either bucket.
