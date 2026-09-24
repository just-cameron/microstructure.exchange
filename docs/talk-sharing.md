# Talk sharing

The homepage's Open Graph and X metadata are selected at request time from the current schedule. A talk remains current until one hour after its start. When the season ends, the generic TME card is used. Social platforms may cache their own previews.

Each talk has a stable `/talks/YYYY-MM-DD` page with its own metadata and PNG. The homepage, schedule, and current-season past talks expose these through **Share this talk**. The talk page has a **Copy talk link** button.

`npm run stage:assets` builds these pages and images from the `seasonTalks` JSON in `index.html`. Keep that data synchronized with the visible schedule when editing talks. Dates include the appropriate New York UTC offset (11 a.m. is `-04:00` in summer and `-05:00` in winter).

The checked-in `talks/` folder preserves published pages across seasons. After changing talks, run `npm run stage:assets`, copy `.deploy/public/talks/` into `talks/`, and commit those generated files with the schedule changes. Deployment regenerates the current season and retains older pages. Keep old image files so previously cached posts can still load them.

Run `node --test scripts/talk-sharing.test.js` after staging to check rollover boundaries and generated links.
