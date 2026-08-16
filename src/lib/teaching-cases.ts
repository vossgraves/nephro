import type { ImagingModality } from "@/lib/imaging-recognition";

/**
 * Teaching-case model for the /learn educational workflow.
 *
 * Cases are text-structural teaching material: they describe imaging anatomy,
 * technique, and interpretation *reasoning*. They deliberately contain no
 * patient imagery, no patient-specific advice, and no diagnosis claims. Every
 * case carries a `disclaimer` that is rendered in the UI wherever the case is
 * shown.
 */

export type CaseDifficulty = "intro" | "intermediate" | "advanced";

export type GuidedChecklistStep = {
  /** What the learner should look for or do at this step. */
  prompt: string;
  /** What the finding means and how to reason about it. Revealed on demand. */
  explanation: string;
};

export type TeachingQuizQuestion = {
  question: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  answerIndex: number;
  /** Why the answer is right, and why the distractors are misleading. */
  explanation: string;
};

export type TeachingCase = {
  id: string;
  title: string;
  modality: ImagingModality;
  difficulty: CaseDifficulty;
  /** Educational disclaimer specific to this case, always rendered in the UI. */
  disclaimer: string;
  learningPoints: string[];
  guidedChecklist: GuidedChecklistStep[];
  quiz: TeachingQuizQuestion[];
};

export const caseDifficultyLabel: Record<CaseDifficulty, string> = {
  intro: "Intro",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const teachingCases: TeachingCase[] = [
  /* ------------------------------------------------------------------ */
  /* Case 1 — Normal renal ultrasound anatomy walkthrough                */
  /* ------------------------------------------------------------------ */
  {
    id: "renal-ultrasound-anatomy",
    title: "Normal renal ultrasound anatomy walkthrough",
    modality: "ultrasound",
    difficulty: "intro",
    disclaimer:
      "Teaching case: normal anatomy in a generic, non-patient model. It does not describe any real study and is not a diagnosis.",
    learningPoints: [
      "How a longitudinal and transverse renal sweep are oriented",
      "Cortex, medulla, and the central echogenic sinus",
      "Echogenicity comparison with the adjacent liver or spleen",
      "What a normal adult kidney size roughly measures",
    ],
    guidedChecklist: [
      {
        prompt: "Orient the frame: which plane is this, and which kidney are you sweeping?",
        explanation:
          "A longitudinal (sagittal) scan shows the kidney's long axis, like a kidney-shaped oval; a transverse scan cuts across the short axis and shows a rounded section with the hilum pointing medially. The right kidney is usually imaged through a liver window with the patient lying on the left side; the left kidney is often imaged from the flank or posteriorly. Knowing which kidney and plane you are in is the foundation of every sweep, because it tells you which normal landmarks should be visible.",
      },
      {
        prompt: "Trace the capsule and the corticomedullary junction.",
        explanation:
          "The renal capsule is the thin, smooth, echogenic line that outlines the kidney. Just beneath it, the cortex forms a continuous rim of medium-level echoes. Deep to the cortex, the medullary pyramids appear as slightly hypoechoic, fan-shaped structures pointing toward the sinus. The boundary between the cortex and the pyramids (the corticomedullary junction) should be visible but subtle; losing it is something you notice only after you have practiced seeing it on a normal kidney.",
      },
      {
        prompt: "Compare the cortex with the adjacent liver or spleen parenchyma.",
        explanation:
          "A standard teaching reference is renal cortex versus the adjacent organ: the normal renal cortex is isoechoic or slightly hypoechoic compared with the liver (right) or spleen (left). When the kidney is viewed through its own organ window it looks brighter and smaller (the 'big spleen' effect), so the comparison is only meaningful when liver or spleen is actually visible in the same frame. Doing this comparison every time trains your eye for echogenicity, which matters later when you are trying to decide whether a kidney looks abnormal.",
      },
      {
        prompt: "Identify the central echogenic complex (the renal sinus).",
        explanation:
          "The bright, linear echoes in the middle of the kidney are the renal sinus: hilar fat, the collecting system (calyces and pelvis), and the renal vessels all contribute to the high-level echoes. In a normal kidney the sinus is clearly brighter than the cortex. Recognizing it stops you from mistaking sinus fat or a normal pelvis for a stone: echogenic sinus tissue has a smooth, organized distribution, whereas a stone casts a shadow and sits inside a fluid-filled calyx or pelvis.",
      },
      {
        prompt: "Measure the kidney: what is the typical adult range you expect?",
        explanation:
          "The maximum pole-to-pole length is the measurement that is routinely reported. In a normal adult it roughly falls in the 9–12 cm range (close to the 10–12 cm band often quoted in textbooks), and the two kidneys are usually within about 1–1.5 cm of each other. Teaching numbers like this are ranges, not diagnoses: any single kidney can fall outside them and still be normal, so size is a clue to reason about in context, not a verdict.",
      },
      {
        prompt: "Finally, note what the walkthrough has not done.",
        explanation:
          "This checklist described structure and technique only. It did not evaluate a real patient, interpret a real set of images, or reach a conclusion about any individual. Ultrasound interpretation is operator-dependent and always happens in the context of clinical examination and the patient's history — something a teaching exercise never replaces.",
      },
    ],
    quiz: [
      {
        question:
          "In a longitudinal view of the right kidney obtained through a liver window, what is the normal echogenicity of the renal cortex compared with the liver?",
        options: [
          "Always much brighter than the liver",
          "Isoechoic or slightly hypoechoic",
          "Always much darker than the liver",
          "Echo-free (anechoic) like fluid",
        ],
        answerIndex: 1,
        explanation:
          "The standard teaching reference is that normal renal cortex is isoechoic or slightly hypoechoic compared with liver (right side) or spleen (left side). A cortex that is clearly brighter than the adjacent organ is the observation you would flag as a candidate abnormality; an anechoic cortex is not a normal appearance.",
      },
      {
        question: "What forms the central echogenic complex (bright echoes) inside a normal kidney?",
        options: [
          "Medullary pyramids",
          "The renal capsule",
          "Hilar fat, collecting system, and renal vessels",
          "Perinephric fat outside the kidney",
        ],
        answerIndex: 2,
        explanation:
          "The central bright echoes come from the renal sinus: hilar fat, the calyceal/pelvicalyceal collecting system, and the renal vasculature. Medullary pyramids are the relatively dark fan-shaped structures between cortex and sinus. The capsule is the thin bright line at the kidney's edge, and perinephric fat lies outside the capsule.",
      },
      {
        question:
          "A learner describes a smooth, organized bright region near the renal hilum and wonders if it could be a stone. What is the most useful structural check?",
        options: [
          "Rely on the bright region's color alone",
          "Confirm whether there is shadowing and whether the echo sits within the fluid-filled collecting system",
          "Increase the gain until the bright region disappears",
          "Ignore it, because sinus tissue can never be mistaken for a stone",
        ],
        answerIndex: 1,
        explanation:
          "The reasoning habit is structural: sinus fat is organized and does not shadow, while a stone inside the collecting system typically shows acoustic shadowing and sits in a fluid context. This is a technique for looking, not a diagnosis — a real stone is confirmed in the context of a full clinical and imaging review.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Case 2 — Reading a CT KUB for stone context                        */
  /* ------------------------------------------------------------------ */
  {
    id: "ct-kub-stone-context",
    title: "Reading a CT KUB for stone context",
    modality: "ct-kub",
    difficulty: "intermediate",
    disclaimer:
      "Teaching case: a structural walkthrough of how a CT KUB (kidneys, ureters, bladder) study is read. It is not about a real patient and is not a diagnosis.",
    learningPoints: [
      "Why stone-protocol CT is acquired without contrast",
      "Where stones appear along the collecting system and ureter",
      "The three classic ureteric crossing points",
      "Secondary signs and the phlebolith-vs-stone distinction",
    ],
    guidedChecklist: [
      {
        prompt: "Confirm the technique before looking for findings.",
        explanation:
          "A CT KUB for stone context is a non-contrast acquisition: stones are high-attenuation (calcific) and can be invisible or drowned out after contrast. Check that the series is truly non-contrast, and consider slice thickness — thin slices catch small stones that thick slices can smear out. Technique first, findings second: a study read under the wrong assumptions is how normal structures get mislabeled.",
      },
      {
        prompt: "Walk through the kidneys: collecting system, then ureters.",
        explanation:
          "Start inside each kidney: look for high-attenuation foci in the calyces, renal pelvis, and at the ureteropelvic junction, and check for dilatation of the collecting system upstream of any focus. Then follow each ureter in its expected course. A systematic sweep from renal pelvis to bladder is more reliable than hunting for a single bright dot, because it builds the spatial map that makes secondary signs meaningful.",
      },
      {
        prompt: "Track the ureter through its three classic crossing points.",
        explanation:
          "The ureter is most likely to obstruct where the lumen is anatomically narrowest: at the ureteropelvic junction, where the ureter crosses the iliac vessels at the pelvic brim, and at the ureterovesical junction (UVJ) where it enters the bladder wall. When you are tracing a ureter, these are the spots to slow down and examine with care — but a stone can lodge anywhere along the tract, so the full course still gets reviewed.",
      },
      {
        prompt: "Look for secondary signs, not just the stone itself.",
        explanation:
          "Secondary signs are context: ipsilateral hydronephrosis, a dilated ureter down to the level of the stone, and perinephric or periureteric stranding (soft-tissue haziness from local inflammation). Their presence or absence changes how the finding reads in context — a small stone with no upstream dilatation reads differently from the same stone with marked hydronephrosis. These signs are observations to communicate, not a diagnosis in themselves.",
      },
      {
        prompt: "Distinguish ureteric stones from pelvic phleboliths.",
        explanation:
          "Phleboliths are calcified venous structures in the pelvis that can look deceptively like stones in the distal ureter. The classic discriminating observations: a stone in the ureter often shows a soft-tissue 'rim' around it (the ureteric wall), sits in the expected ureteric line rather than a venous distribution, and has dilated ureter above it. A phlebolith typically has a lucent center and does not follow the ureteric course on contiguous slices. When the ureter cannot be confidently traced, a 'possibly a stone' read with the uncertainty stated is the honest one.",
      },
      {
        prompt: "Finish at the bladder and report structure, not verdicts.",
        explanation:
          "Check the bladder lumen and the UVJ region, where stones can sit at the very end of the ureter. A completed read states what was seen (attenuation, location, size, secondary signs, limitations such as non-dilated ureter segments) and leaves interpretation to the clinical context. This walkthrough teaches the reading sequence; it does not produce a patient conclusion.",
      },
    ],
    quiz: [
      {
        question: "Why is stone-protocol CT KUB performed without intravenous contrast?",
        options: [
          "Contrast makes stones appear larger than they are",
          "Contrast can obscure or mask calcific stones in the collecting system",
          "Contrast is only avoided to save cost",
          "Non-contrast imaging has better soft-tissue contrast for the renal cortex",
        ],
        answerIndex: 1,
        explanation:
          "The reason is negative contrast between the dense (high-attenuation) stone and the surrounding fluid/soft tissue: once contrast opacifies the collecting system, it partially fills that gap and can mask or obscure the stone. The primary job of a KUB is stone detection, so it is acquired non-contrast. The cortex-comparison point is not the purpose of a stone-protocol study.",
      },
      {
        question: "Which list gives the three classic ureteric narrow points a reader slows down at?",
        options: [
          "Renal hilum, liver edge, bladder dome",
          "UPJ, crossing the iliac vessels, UVJ",
          "Aortic bifurcation, psoas border, pubic symphysis",
          "Pelvicalyceal junction, renal pole, membranous urethra",
        ],
        answerIndex: 1,
        explanation:
          "The three classic narrow points along the ureter are the ureteropelvic junction (UPJ), the point where the ureter crosses the iliac vessels at the pelvic brim, and the ureterovesical junction (UVJ) entering the bladder wall. The other lists mix in structures that are not ureteric narrow points.",
      },
      {
        question: "What combination of observations most suggests a pelvic focus is a ureteric stone rather than a phlebolith?",
        options: [
          "Lucent center and location off the ureteric line",
          "Soft-tissue rim, position along the ureteric course, and upstream ureteric dilatation",
          "Brightness on a single axial slice alone",
          "Location in the bladder wall itself",
        ],
        answerIndex: 1,
        explanation:
          "A soft-tissue rim (ureteric wall around the stone), an in-line position along the traced ureter, and dilatation above the level all point toward a stone in the ureter. A lucent center and a non-ureteric, venous distribution are the classic phlebolith hints. Deciding on a single slice is exactly the error the checklist tries to prevent, since the ureteric course must be followed across contiguous slices.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Case 3 — Cystic vs solid: applying Bosniak thinking                */
  /* ------------------------------------------------------------------ */
  {
    id: "cystic-vs-solid-bosniak",
    title: "Cystic vs solid: applying Bosniak thinking",
    modality: "ct-abdomen",
    difficulty: "advanced",
    disclaimer:
      "Teaching case: a reasoning framework for describing renal masses on CT. The Bosniak framework is presented for learning, not for clinical application; always consult the current classification and a qualified clinician.",
    learningPoints: [
      "The structural criteria of a Bosniak category I (simple) cyst",
      "Wall, septa, calcification, and enhancement as the descriptors that matter",
      "Measurable vs perceived enhancement",
      "Why the framework is a describing tool, not a diagnosis",
    ],
    guidedChecklist: [
      {
        prompt: "Start with density: is the lesion water-density or soft tissue?",
        explanation:
          "On CT, characterize the lesion's internal attenuation first. A simple cyst is homogeneous and water-density (roughly 0–20 HU) with a hairline-thin wall. A lesion measuring soft-tissue density is a completely different structural question. Measure in the center of the lesion with a generous region of interest, and check homogeneity — a lesion that is water-density in one slice but mixed elsewhere is not 'simple' yet.",
      },
      {
        prompt: "Describe the wall and septa: thin, thick, or nodular?",
        explanation:
          "The Bosniak framework's descriptors are wall and septa. A hairline-thin wall with no septa is the signature of a simple (category I) cyst. Hairline-thin septa (few) and fine or chitinous calcification belong to 'minimally complex' territory; many septa, smooth thickening, or thick nodular calcification push the description toward the follow-up or indeterminate categories. Each descriptor is an observation about structure — you are training the habit of naming what you actually see.",
      },
      {
        prompt: "Assess enhancement: measurable vs perceived.",
        explanation:
          "Enhancement is the key discriminator between a cyst and a solid component. The classic teaching threshold: an increase of roughly 15–20 HU between the unenhanced and a contrast-enhanced phase counts as measurable enhancement for a renal lesion — but thresholds vary with technique and vendor, and perceived enhancement means visible change below the measurable threshold. Measure in the same location on the same slice in both phases. In practice, exact numbers are the job of a qualified reader in a controlled setting; here, the habit to learn is *that* enhancement is measured, and how.",
      },
      {
        prompt: "Look for calcification and where it sits.",
        explanation:
          "Calcification matters mainly by pattern and location. Fine, peripheral, or chitinous (thin curvilinear) calcification in an otherwise simple architecture is a low-complexity feature, while thick, nodular, or central calcification pushes a lesion toward the higher-complexity descriptions. Note that even category I/II-type calcification can appear in benign lesions — calcification alone is never a diagnosis by itself.",
      },
      {
        prompt: "Fit the description into the Bosniak framework (v2019-style categories).",
        explanation:
          "The framework orders descriptions from category I (simple cyst) through II (minimally complex), IIF (more complex but typically followed), III (indeterminate), and IV (lesions with an enhancing soft-tissue component). Category names describe the imaging features and the usual management posture (nothing, follow, or further evaluation) — they are a communication shorthand for radiologic structure, not a pathological diagnosis, and the version in use must be stated.",
      },
      {
        prompt: "Check for prior imaging and close with uncertainty, not a verdict.",
        explanation:
          "Stability on prior imaging is one of the most powerful observations available — but only if the prior study is comparable (same modality, same phase, similar slices). A complete description states the features above, notes limitations (e.g., no true unenhanced phase to measure enhancement), and hands interpretation to clinical context. This walkthrough teaches the describing discipline; it is expressly not a diagnosis for any patient.",
      },
    ],
    quiz: [
      {
        question: "Which feature set is the classic description of a Bosniak category I (simple) cyst on CT?",
        options: [
          "Thick enhancing wall with internal soft tissue",
          "Homogeneous water density, hairline-thin wall, no septa, no measurable enhancement",
          "Many hairline-thin septa with perceived enhancement",
          "Thick nodular calcification with smooth wall thickening",
        ],
        answerIndex: 1,
        explanation:
          "Category I is the simple cyst: homogeneous near-water attenuation (roughly 0–20 HU), a hairline-thin wall, no septa, no calcification (or trivial), and no measurable enhancement of anything solid. Many hairline septa with perceived enhancement is the IIF-style description; thick walls, nodular calcification, or enhancing soft tissue are the descriptors of the more complex categories.",
      },
      {
        question: "What is the classic teaching definition of measurable enhancement of a renal lesion?",
        options: [
          "Any visible brightening regardless of measured change",
          "An increase of roughly 15–20 HU between unenhanced and enhanced phases, measured in the same location",
          "A decrease in attenuation after contrast",
          "Uniform water density on every phase",
        ],
        answerIndex: 1,
        explanation:
          "Measurable enhancement is classically a change on the order of 15–20 HU between the unenhanced and contrast-enhanced phases, measured at the same site on the same slice. Visible brightening below that threshold is described as perceived enhancement — still an observation worth reporting. The threshold depends on technique, which is why the clinical rule is 'measure it in a controlled setting,' not 'apply a magic number to a screenshot.'",
      },
      {
        question: "Why does the Bosniak framework use descriptions instead of tumor diagnoses?",
        options: [
          "Descriptions map imaging structure to communication and management posture, not to pathology",
          "CT cannot see kidneys",
          "The framework only applies to ultrasound",
          "Category names are insurance codes",
        ],
        answerIndex: 0,
        explanation:
          "The Bosniak categories communicate the imaging architecture (wall, septa, calcification, enhancement) and the usual management posture (no action, follow-up, or further evaluation). They are not a pathological diagnosis of any specific tumor type, and imaging features overlap between benign and malignant pathology. That separation is exactly the safety property this teaching page preserves: structure and reasoning are taught; the diagnosis belongs to the clinical setting.",
      },
    ],
  },
];