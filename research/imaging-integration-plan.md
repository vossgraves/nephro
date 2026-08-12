# Nephro imaging integration plan

## Decision

Nephro will add an **Imaging Lab** as a browser-only, non-diagnostic image review workspace. The first implementation will accept common X-ray/image formats through a local file picker and will perform deterministic client-side operations: rendering, zoom, pan, contrast, brightness, inversion, grid overlay, image dimensions, file metadata, global luminance statistics, and a point-sample pixel readout. The original file will not be uploaded or persisted.

This is the safest useful feature that fits the request without setting up or hosting a machine-learning algorithm. It helps a user inspect an image and prepare it for clinician review, but it does not identify pneumonia, stones, masses, fractures, kidney disease, or any other pathology.

## Why this path

| Option | Decision | Reason |
| --- | --- | --- |
| Browser-only viewer and deterministic image tools | **Build now** | No API key, no model, no upload, no patient-data transfer, and useful for PNG/JPEG teaching images or exported X-rays. |
| OHIF/Cornerstone3D DICOM viewer | **Phase two** | Strong open-source foundation for full DICOM stacks, window/level, measurements, and annotations, but it adds a substantial dependency/runtime and still does not provide diagnostic AI. |
| Hosted medical-imaging AI API | **Do not enable by default** | Requires vendor review, data-processing agreement/privacy controls, server-side secrets, validation, and a clear clinical/regulatory boundary. A generic vision model should not be presented as a radiology reader. |
| Public datasets | **Link and attribute** | TCIA and the NIH Chest X-ray dataset provide de-identified teaching/research resources; Nephro should link to them rather than silently redistribute large datasets. |

## Product copy boundary

The workspace will state that it is an image review aid, not a medical device or diagnostic service. It will advise users not to upload identifiable patient studies. Results such as mean luminance and point intensity will be labeled as **image properties**, never as findings.

## Future DICOM path

If a later phase needs DICOM, the preferred architecture is a client-side Cornerstone3D/OHIF viewer for authorized local studies or a server-side DICOMweb boundary using QIDO-RS/WADO-RS/STOW-RS with authenticated access. The public landing page should not accept identifiable studies or expose archive credentials.

## References

[1]: https://docs.ohif.org/ "OHIF Viewer documentation"
[2]: https://www.dicomstandard.org/using/dicomweb "DICOMweb official overview"
[3]: https://www.cornerstonejs.org/docs/getting-started/overview/ "Cornerstone3D official overview"
[4]: https://www.cancerimagingarchive.net/access-data/ "The Cancer Imaging Archive access page"
[5]: https://docs.cloud.google.com/healthcare-api/docs/resources/public-datasets/nih-chest "Google Cloud documentation for the NIH Chest X-ray dataset"
[6]: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html "HHS de-identification guidance"
