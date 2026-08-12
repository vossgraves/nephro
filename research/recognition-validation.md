# Dual-provider recognition validation

## Initial local interface check

The local `/imaging` route rendered successfully after adding the server-bound recognition adapter. The page presents a visible local-review canvas, OpenAI/Gemini provider selector, modality selector, de-identification confirmation, explicit non-diagnostic language, and a structured result area that is not shown until a provider response exists.

At this local development environment, the OpenAI adapter is reported as configured because a sandbox-only server environment key is available. No API key is rendered into the browser. The live deployment will require its own Vercel server-side environment variable configuration.

The file input was exposed only inside the temporary local validation session to test the regular browser selection path with a non-identifiable generated asset.
## Local image and consent flow

A generated, non-identifiable landing-page poster was selected in the browser. The client-side canvas decoded it successfully and exposed the expected deterministic file facts: PNG format, 2,560 × 1,440 pixels, 3.7 MB, and local luminance metadata. The provider action remained behind the explicit de-identification confirmation checkbox. This test asset contains no patient data.
The initial checkbox click did not change the test browser state, which was verified through the DOM. A subsequent regular click activated the confirmation checkbox. The request action is therefore gated behind the user-facing de-identification/consent acknowledgment as intended.
## Provider adapter check

The first OpenAI test returned a 401 because the sandbox uses an OpenAI-compatible proxy base rather than the public OpenAI endpoint. The adapter was corrected to use the optional server-side `OPENAI_API_BASE` value and was changed to suppress provider response bodies from application logs. The local test was then re-submitted with the same generated non-patient asset; the interface showed the explicit in-progress state.
