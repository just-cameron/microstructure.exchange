# The Microstructure Exchange

This repository contains the redesigned TME website and the Cloudflare Worker used for paper submission/review routes.

The previous Jekyll site and its paper/slide materials have been preserved in `old-website/`.

## Local Preview

Serve this repository root with any simple static web server and open `index.html`.

For example:

```sh
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

The public pages, schedule, past talks, downloadable calendar, and submission-page layout can be previewed this way. The actual paper upload endpoint requires the Cloudflare Worker backend and will not submit papers from a plain static preview.

## Deployment

GitHub Actions deploys the live Cloudflare site after every push to `master`, once this repository secret is set:

- `CLOUDFLARE_API_TOKEN`

The deploy action gathers the live top-level website files into `.deploy/public/`, then runs `npm run deploy`. Submitted papers and submission records remain in Cloudflare R2/D1; they are not stored in GitHub.
