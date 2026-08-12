# Reference site audit: kidney-analysis.vercel.app

**Source URL:** https://kidney-analysis.vercel.app/
**Inspected:** 2026-08-12

## Visible workflow

The public site presents itself as **NephroScan AI** with a three-step workflow: Patient, Analysis, and Report. The first step requests patient name, age, gender, patient ID/MRN, referring physician, examination date, modality (Ultrasound, CT Scan, or MRI), clinical symptoms, and relevant medical history. The site labels itself “Professional Grade Diagnostic Tool,” “Clinical Decision Support System,” and “v2.4.0 Engine.” The initial page does not visibly explain the model provider, training data, validation cohort, regulatory status, or upload destination.

## Bundle inspection

The page loads a single Vite-style JavaScript asset: `/assets/index-BrtRTp4Q.js`. Passive inspection found a browser `FileReader` flow that reads the selected image as a data URL and passes it to an internal function named `DA`. No visible external inference URL, OpenAI/Gemini/Claude/Replicate/Hugging Face provider, or hosted model endpoint was present in the inspected bundle. The only obvious `fetch()` match was from bundled framework/runtime code rather than an application endpoint.

The image analysis logic is not a trained recognition model. It loads the image into a browser `Image` element, draws it to a canvas, samples pixels, estimates mean intensity and variance, assigns heuristic echogenicity labels such as “Hypoechoic” or “Hyperechoic,” and toggles an `isPathological` flag using intensity thresholds and the text of the clinical history. The code also creates derived canvas images using blur, contrast, inversion, and color overlays. It draws a fixed red rectangle labeled “AI-derived Region of Interest (ROI)” rather than detecting a learned region.

The report generator contains hard-coded narrative templates such as “No radiological evidence of nephrolithiasis or hydronephrosis” and “Possible small non-obstructive calculus in the lower pole (3mm),” with some values generated using `Math.random()`. That means the experience can look like genuine AI recognition while lacking evidence of clinically validated inference. The site should not be used as proof that a public AI model is running.

## Implication for Nephro

Nephro should not copy the reference site’s “Professional Grade Diagnostic Tool” claim or its unvalidated AI/ROI language. To provide a genuinely stronger experience, the product needs one of two honest paths: integrate a documented, externally hosted medical-imaging model with clear provider, modality, validation, privacy, and regulatory disclosures; or build a real local model runtime, which conflicts with the current no-ML-hosting constraint. A browser-only DICOM viewer and pixel tools are not recognition, but they are safe foundations while a governed inference provider is selected.

## Direct source evidence

The relevant strings and logic were extracted from the public JavaScript bundle without executing or modifying it. Local evidence is stored in `research/reference-markers.txt` and `research/kidney-analysis-reference.js` for auditability. The bundle source itself is third-party content and is retained only as an inspection artifact.

## Hosted vision and kidney-model research

OpenAI’s official Images and Vision documentation states that the Responses API can accept images as URLs, base64 data URLs, or file IDs and return text analysis. Source: https://developers.openai.com/api/docs/guides/images-vision. This is technically suitable for a server-side, image-in/image-out structured review workflow, but a general vision model should not be presented as a validated radiology model or diagnostic device.

OpenAI’s 2026 healthcare announcement describes enterprise healthcare offerings, API access, governance, and an eligible-customer BAA path. Source: https://openai.com/index/openai-for-healthcare/. The existence of a BAA path does not by itself make a small public Vercel demo compliant; deployment, storage, access control, logging, retention, and user consent would still need to be designed and configured.

Research results also surfaced the Open Kidney Dataset, which contains more than 500 2D B-mode abdominal ultrasound images with polygon annotations: http://rsingla.ca/kidneyUS/ and https://github.com/rsingla92/kidneyUS. This supports a credible segmentation research direction, but it is not a hosted production inference API. Research sources on kidney segmentation, renal ultrasound AI, and renal imaging review include https://pmc.ncbi.nlm.nih.gov/articles/PMC6892163/, https://pmc.ncbi.nlm.nih.gov/articles/PMC12568832/, and https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2023.1252630/full.

The practical architecture options are therefore: (1) use a governed, server-side hosted model provider for a clearly labeled AI-assisted visual review; (2) deploy a specialist kidney model behind a controlled inference service, which is more clinically appropriate but requires ML operations and validation; or (3) keep a viewer-only mode for public demos. The reference site is not evidence that option 2 has been achieved; its bundle uses client-side heuristics and canned report templates.
