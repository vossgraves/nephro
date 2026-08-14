# Nephro Imaging Lab - Deployment & Setup Guide

## ✅ Code Status
- **Commits pushed to GitHub** (2 new commits with fallback logic)
- **Vercel auto-build triggered** once push completes
- **No API keys in repo** — stored only in Vercel environment variables

## 🔧 Setup Steps

### Step 1: Add API Keys to Vercel
Visit: https://vercel.com/dashboard → Select **nephro** project → **Settings** → **Environment Variables**

Add these two variables:

```
OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```
GEMINI_API_KEY = AQ.Abxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Replace the placeholder values with your actual API keys** (found in your email or provided separately).

**Important:** These keys are server-side only. They will NOT appear in client-side code or browser requests.

### Step 2: Verify Deployment
- Go to https://nephro-delta.vercel.app (or your production domain)
- Navigate to `/imaging` page
- Status indicator should show: **"Ready to analyze"** (green)

If it shows "Providers unavailable" or "Checking providers...":
- Keys may not have deployed yet (Vercel needs 30-60 seconds after adding env vars)
- Refresh the page
- Check Vercel Deployments tab for build status

### Step 3: Test the System

#### Test 1: Scan Image (Expected: Analysis succeeds)
1. Select modality: **CT KUB** (Kidney, Ureters, Bladder)
2. Upload a real CT scan (or use a sample kidney ultrasound from TCIA: https://www.cancerimagingarchive.net/)
3. Add optional question: "Note any visible artifacts or anatomic landmarks"
4. Check de-identification box ✓
5. Click **"Request AI review"**

**Expected output:**
```json
{
  "provider": "gemini",  // or "openai" if Gemini failed
  "model": "gemini-2.5-flash",  // or "gpt-5-mini"
  "reviewStatus": "reviewable",
  "summary": "Technical quality assessment without diagnosis...",
  "imageQuality": {
    "assessment": "Good contrast, minimal motion artifact",
    "limitations": ["Single slice view", "No volumetric data"]
  },
  "observedVisualFeatures": [
    "Bilateral kidneys visible",
    "Normal parenchymal echogenicity pattern"
  ],
  "notAssessableFromThisImage": [
    "Renal function",
    "Degree of hydronephrosis"
  ],
  "clinicianQuestions": [
    "Any history of stone disease?",
    "Are ureteric jets visible on ultrasound?"
  ],
  "uncertainty": "Single image cannot determine clinical significance...",
  "safetyNote": "AI-assisted visual review only..."
}
```

#### Test 2: Chest X-ray (Expected: Analysis succeeds)
1. Select modality: **Chest X-ray**
2. Upload a chest radiograph
3. Check **"Chest X-ray, technical quality"** → Should focus on exposure, positioning, artifacts
4. Should NOT diagnose pneumonia, pneumothorax, or other pathology

#### Test 3: MRI Brain (Expected: Analysis succeeds)
1. Select modality: **MRI Brain**
2. Upload a brain MRI slice
3. Expected focus: sequence quality, ventricles, gray/white matter boundaries
4. Should NOT interpret neurologic findings

#### Test 4: Non-Scan Image (Expected: Graceful failure)
1. Upload a screenshot, photo, or unrelated image
2. Click analyze
3. **Gemini tries first, fails** → **OpenAI fallback attempts**
4. Expected error response:
```json
{
  "error": "This image does not appear to be medical imaging. Cannot provide review.",
  "provider": "openai",
  "model": "gpt-5-mini"
}
```

**System correctly identifies non-medical images and rejects them** (no fake analysis)

#### Test 5: Provider Fallback
1. Disable Gemini key temporarily in Vercel (set to empty or remove)
2. Upload a scan
3. Gemini should fail silently → **OpenAI fallback kicks in**
4. Analysis succeeds with OpenAI, report shows `"provider": "openai"`
5. Re-enable Gemini key → Next request uses Gemini first again

## 🛡️ Safety Checks (All Should Pass)

- [ ] No provider choice in UI (automatic Gemini → OpenAI fallback)
- [ ] De-identification checkbox gates the send button (can't submit without checking)
- [ ] API keys NOT visible in browser network tab (server-side only)
- [ ] API keys NOT in GitHub repo (only in Vercel env vars)
- [ ] Report shows safety disclaimer: "AI-assisted visual review only..."
- [ ] Modality-specific prompts prevent disease diagnosis
  - CT KUB: anatomic landmarks only
  - Chest X-ray: technical quality only
  - MRI Brain: sequence quality only
  - etc.
- [ ] Non-scan images rejected gracefully (no hallucinated analysis)
- [ ] Gemini failures silently trigger OpenAI fallback

## 📊 Performance Expectations

| Metric | Expected |
|--------|----------|
| Image upload | <1 sec (local, no upload) |
| Gemini analysis | 3-8 seconds |
| OpenAI fallback | 3-8 seconds |
| Report rendering | <1 second |
| Total wall-clock time | 4-10 seconds |

If analysis takes >15s, check Vercel function logs for timeout or provider errors.

## 🐛 Troubleshooting

### "Providers unavailable" status
- Env vars not deployed yet (wait 60s, refresh)
- Both API keys invalid or expired
- Check Vercel logs: `Deployments` → latest build → `Function Logs`

### "Analysis failed" error on submit
- Image too large (>4 MB for provider review; local review only)
- Provider API outage
- Network timeout (retry)
- Check Vercel function logs for specific error code

### Gemini not responding but OpenAI works
- Normal — fallback is working as intended
- Check Gemini API quota or regional availability
- Fallback ensures the user always gets analysis via OpenAI

### Both providers fail
- Both API keys may be invalid or revoked
- Both services may be down (rare)
- Check logs for error codes and retry

## 🔐 API Key Security

**What we do:**
- Keys stored in Vercel's encrypted environment variables
- Never logged, exposed in browser, or committed to Git
- Each API call is server-side only (`/api/imaging/analyze`)
- Images sent only after user confirms de-identification

**What we don't do:**
- Never hardcode keys
- Never send keys to client-side JavaScript
- Never store images after analysis
- Never log full API responses (only error codes)

## 📈 Monitoring

### Vercel Dashboard
- **Deployments:** Watch for build success/failure
- **Function Logs:** Real-time errors, fallback attempts, API response times
- **Analytics:** Request volume, error rate, response times

### Recommended Alerts
Set up Vercel alerts for:
- Build failures
- Function errors (5XX status codes)
- High response times (>10s)

## 🚀 Next Steps

1. **Add API keys to Vercel** (if not done yet)
2. **Wait 60 seconds** for env vars to propagate
3. **Test each modality** (CT KUB, Chest X-ray, MRI Brain, etc.)
4. **Test fallback** (upload non-scan image, verify graceful error)
5. **Monitor Vercel logs** for the first 24 hours

## 📝 Modalities Supported

| Modality | Focus Area | Safety Rule |
|----------|-----------|------------|
| CT KUB | Kidney, ureters, bladder | Anatomic landmarks only, no disease |
| Chest X-ray | Lungs, mediastinum, technical quality | Quality assessment only, no diagnosis |
| MRI Brain | Brain anatomy, sequence quality | Technical review only, no neuro findings |
| CT Abdomen | Organ boundaries, slice quality | Structural assessment only |
| CT Chest | Mediastinal anatomy, motion artifact | Technical review only |
| Ultrasound | Tissue characteristics, probe technique | No echogenicity diagnosis |
| X-ray | General radiographs | Technique and positioning only |
| Other | Generic medical images | Technical review only |

---

**Last updated:** August 14, 2026
**Status:** Ready for production
**API Keys:** Stored in Vercel environment (not in repo)
