# TôHiệuQuiz AI Gateway

Cloudflare Worker for the OpenAI-compatible endpoint at `https://ai.thtohieu.com/v1`.

The Worker validates the public Bearer token and forwards `/v1/*` requests through the `AI_ORIGIN` Workers VPC Service binding. The binding reaches AIClient2API at `127.0.0.1:3000` over the dedicated `tohieuquiz-ai-origin` Cloudflare Tunnel, so the gateway does not depend on a public upstream hostname. The request URL keeps the legacy host only for A2 host-scoped token compatibility. The two credentials are separate Worker secrets:

- `AI_GATEWAY_TOKEN`: token accepted from callers.
- `UPSTREAM_API_TOKEN`: token sent to the A2 upstream.

Neither secret is stored in Git. The Worker has no `workers.dev` or preview URL and is attached only to the proxied `ai.thtohieu.com/*` zone route. The VPC binding is pinned to service ID `019fa1e4-5f22-7ba1-87ac-4bfba673e261`; there is no fallback to public `fetch()`.
