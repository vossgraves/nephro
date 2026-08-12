# Nephro recognition product contract

## Recommended experience

Nephro should evolve from the current local image viewer into an **AI-assisted imaging review** workflow, not a simulated diagnostic tool. The user selects an exported de-identified image, confirms the modality, optionally adds a clinical question, and submits it to a server-side provider adapter. The result should be a structured review containing: observed visual features, image-quality limitations, model uncertainty, questions for clinician confirmation, and a clearly visible non-diagnostic boundary.

The UI can borrow the reference app’s useful shape—Patient/Study, Analysis, Report—but should remove unsupported claims such as “professional grade diagnostic tool,” fabricated versioned engines, hard-coded ROIs, random values, and definitive disease statements.

## Selected architecture

For the current public/static Nephro deployment, do not place a provider secret in browser code. The browser-only mode remains available for local review. A real inference mode should use a server-side adapter or a governed external integration. The first adapter can target a general vision API that accepts base64 image inputs, but it must be labeled **AI-assisted visual review** and must not claim radiology-grade diagnosis or regulatory clearance.

The application should use a provider interface with explicit states: `idle`, `ready`, `analyzing`, `complete`, `provider_not_configured`, `privacy_blocked`, and `error`. The UI should expose the provider name and model version only when configured, record no patient identifiers in logs, avoid permanent image storage by default, and show a consent/privacy notice before transmission.

## Required boundary

A general-purpose vision model can produce useful observations but can hallucinate, miss subtle findings, and is not validated here for kidney imaging. A trained specialist segmentation/detection model would be a separate ML deployment and would require modality-specific validation, governance, and clinical review. The public reference site does not demonstrate that it has such a model; its bundle uses pixel heuristics and templated report text.

## Decision required before implementation

The user must select the first target modality and provider path. Recommended starting point: **de-identified exported ultrasound or X-ray image + server-side general vision API for non-diagnostic visual review**. CT/MRI/DICOM studies should be a later phase because single-image input is insufficient for volumetric studies and would require a DICOM/DICOMweb workflow.

## Verification note — 12 August 2026

The OpenAI adapter was verified locally against the configured OpenAI-compatible service using `gpt-5-mini` and the Chat Completions endpoint. A 3.7 MB generated Nephro kidney/tablet illustration was submitted only after the de-identification confirmation was checked. The endpoint returned and the client rendered a structured report that correctly identified the input as an illustration rather than native ultrasound imagery, listed image-quality and evidentiary limitations, withheld diagnostic claims, and recommended review of original imaging by a qualified clinician. This verifies the hosted image-based review path and its non-diagnostic guardrails; it does not validate clinical performance.

## Sources

1. OpenAI Images and Vision API: https://developers.openai.com/api/docs/guides/images-vision
2. OpenAI for Healthcare: https://openai.com/index/openai-for-healthcare/
3. HHS de-identification guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html
4. Open Kidney Dataset: http://rsingla.ca/kidneyUS/
5. Reference audit: `research/reference-site-audit.md`
