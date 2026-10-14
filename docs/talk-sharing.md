# Talk sharing

Every scheduled talk must have a nonempty `abstract` in its schedule data before publication. Announcement pages display the complete abstract by default. The homepage advances the presenter and abstract together after each one-hour webinar, including when left open. Deployment checks every announcement and simulates all season transitions; missing abstracts or failed checks stop publication. These rules use stored abstracts and do not automatically retrieve revisions from SSRN. Social platforms control how much text appears in their link previews.

The homepage's Open Graph and X metadata are selected at request time from the current schedule. A talk remains current until one hour after its start. When the season ends, the generic TME card is used. Social platforms may cache their own previews.

Each talk has a stable `/talks/YYYY-MM-DD` page with its own metadata and PNG. The homepage, schedule, and current-season past talks expose these through **Share this talk**. The talk page has a **Copy talk link** button.

`npm run stage:assets` builds these pages and images from the `seasonTalks` JSON in `index.html`. Keep that data synchronized with the visible schedule when editing talks. Dates include the appropriate New York UTC offset (11 a.m. is `-04:00` in summer and `-05:00` in winter).

The checked-in `talks/` folder preserves published pages across seasons. After changing talks, run `npm run stage:assets`, copy `.deploy/public/talks/` into `talks/`, and commit those generated files with the schedule changes. Deployment regenerates the current season and retains older pages. Keep old image files so previously cached posts can still load them.

Run `node --test scripts/talk-sharing.test.js` after staging to check rollover boundaries and generated links.
# Scheduled YouTube Broadcasts

Store only the public watch URL in `youtubeUrl` in the season data in both
`index.html` and `past-talks.html`. Older videos can continue to use `recordingUrl`.
The talk-page build embeds that video with no autoplay. The same player shows
the waiting screen, broadcast, and archived replay; no date-based video swap is
needed. Keep embedding enabled and the replay public in YouTube Studio.

The schedule and current-season archive YouTube buttons link to the permanent
talk page's `#webinar-video` section. Update the schedule action when adding a
new broadcast. Abstracts remain visible below the player.

Fall 2026 broadcasts scheduled in YouTube Studio, all at 11 a.m. Eastern:

| Date | Presenter | Public URL |
| --- | --- | --- |
| October 27 | Vincent Grégoire | https://youtu.be/x3-Ow556ALU |
| November 10 | Thierry Foucault | https://youtu.be/Kq1pDjO13No |
| November 24 | Albert Menkveld | https://youtu.be/ItLD1fOLFeI |
| December 8 | Chaojun Wang | https://youtu.be/5q3a9wjXNNA |

These are streaming-software broadcasts. The host must connect Zoom to the
matching scheduled broadcast and start it. Auto-start and auto-stop are off;
scheduling does not start Zoom or transmit video. Stream keys must stay out of
GitHub and public pages. No Zoom configuration was changed during scheduling.
