# Imaging integration research

## Official OHIF documentation

Source: https://docs.ohif.org/

OHIF describes itself as an open-source, web-based medical imaging platform for building complex imaging applications. Its documented capabilities include loading large radiology studies by retrieving metadata ahead of pixel data, using Cornerstone3D for decoding/rendering/annotations, connecting to image archives that support DICOMweb, using a Data Source API for proprietary archive formats, and extending workflows through plugins. The documentation also lists support areas such as measurement tracking, labelmap segmentation, fusion/hanging protocols, volume rendering, PDF, RT STRUCT, 4D, video, and slide microscopy.

This suggests OHIF is a strong viewer foundation, but it assumes a DICOMweb/archive boundary or a separate deployment. It is not itself a ready-made diagnostic AI service. For Nephro, it is safer to use OHIF or Cornerstone as a future viewer layer, while initially keeping uploaded images in-browser and positioning the feature as visualization/measurement support rather than diagnosis.

## Initial product boundary

The website can support image upload, a browser-side viewer, window/level or contrast controls, invert, zoom/pan, image metadata, pixel/ROI measurement, and links to public de-identified teaching datasets. It should not claim to detect disease, interpret an X-ray, or produce a clinical conclusion without a validated model, clinical evaluation, privacy controls, and regulatory review.

## Public datasets

### The Cancer Imaging Archive (TCIA)

Source: https://www.cancerimagingarchive.net/access-data/

TCIA states that it de-identifies and hosts a large archive of cancer medical images for public download. Radiology data is primarily DICOM, collections are organized by disease, modality, or research focus, and the archive provides a public API for software developers to query resources and retrieve information. Access requires agreement to TCIA’s data usage policies. This makes TCIA a useful source for linked, de-identified teaching cases, but not a source for uploading private patient studies.

### NIH Chest X-ray dataset

Source: https://docs.cloud.google.com/healthcare-api/docs/resources/public-datasets/nih-chest

Google’s official documentation describes the NIH Chest X-ray dataset as 100,000 de-identified PNG chest X-rays from the NIH Clinical Center. It lists no restrictions on use of the images but requires attribution: link to the NIH download site, cite the 2017 CVPR ChestX-ray8 paper, and acknowledge the NIH Clinical Center. The data is available through NIH and Google Cloud Storage; this is a suitable public demo source if Nephro links to it rather than silently copying large files into the app.

## Standards and browser-side rendering

### DICOMweb

Source: https://www.dicomstandard.org/using/dicomweb

The DICOM Standard defines DICOMweb as the web-based imaging layer built from RESTful services. The documented services are Query (QIDO-RS), Retrieve (WADO-RS/WADO-URI), Store (STOW-RS), Worklist (UPS-RS), and Capabilities discovery. This is the correct long-term boundary for connecting Nephro to an authorized imaging archive; a public browser app should not expose archive credentials or upload identifiable studies directly from the client.

### Cornerstone3D

Source: https://www.cornerstonejs.org/docs/getting-started/overview/

Cornerstone3D is documented as a lightweight JavaScript library for medical-image visualization in modern browsers. Its capabilities include compressed transfer syntax rendering, stack/volume viewports, slice streaming, multiplanar orientations, window-level manipulation, zoom/pan, measurement annotations, ROI statistics, crosshairs, and segmentation overlays. This is a technically credible path for real X-ray/DICOM review without creating an ML algorithm. It is substantially more appropriate than asking a general-purpose language model to interpret a clinical scan.

## Recommended direction

The first release should implement an in-browser imaging workspace: accept PNG/JPEG for common X-rays and DICOM files where supported, show a non-diagnostic viewer, expose contrast/window-level/invert/zoom controls, surface non-identifying file metadata, and provide a clear “not for diagnosis” boundary. A future DICOMweb connection can be added behind server-side authentication. Public links should point to TCIA or NIH samples with attribution; user uploads should remain local until a privacy-reviewed storage path exists.

## Privacy and regulatory boundary

### HHS de-identification guidance

Source: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html

HHS OCR explains that its guidance covers methods for de-identifying protected health information under the HIPAA Privacy Rule, including two recognized methods: Expert Determination and Safe Harbor. This is a reminder that “de-identified” is not something the front-end should claim casually, and that a public upload-to-third-party flow needs a documented privacy process. For the initial Nephro feature, image files should be processed locally in the browser and never uploaded by default. The UI should tell users not to upload identifiable patient studies and should avoid persistent storage.
