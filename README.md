# The Microstructure Exchange

This repository contains a static preview copy of the redesigned TME website.

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
