# TôHiệuQuiz AI Gateway

Cloudflare Worker for the OpenAI-compatible endpoint at `https://ai.thtohieu.com/v1`.

The Worker validates the public Bearer token and forwards `/v1/*` requests to the private A2 upstream at `https://ai.thitong.site`. The two credentials are separate Worker secrets:

- `AI_GATEWAY_TOKEN`: token accepted from callers.
- `UPSTREAM_API_TOKEN`: token sent to the A2 upstream.

Neither secret is stored in Git. The Worker has no `workers.dev` or preview URL and is attached only to the proxied `ai.thtohieu.com/*` zone route.
