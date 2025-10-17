# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

MedDRA 28.1 Korean Auto-Coding System: A medical terminology lookup and automation platform for adverse event reporting. The system enables searching MedDRA (Medical Dictionary for Regulatory Activities) Korean terminology, extracting structured data from CIOMS reports, and automatically filling database forms.

## Architecture

### Dual-Mode Operation

**Static Mode (GitHub Pages)**:
- Frontend-only operation using `main.html` + `script.js`
- Loads ASCII data files (`ascii-281/*.asc`) directly in browser
- No server required, fully client-side search and hierarchy resolution
- Deployed at: https://cjlee-cmd.github.io/MedDRA/

**Server Mode (Python Backend)**:
- Python HTTP server (`meddra_server.py`) with optional Gemini AI integration
- Provides `/search` API endpoint with AI-powered ranking
- Handles `/db-autofill` POST requests for Playwright automation
- Run with: `python3 meddra_server.py --host 127.0.0.1 --port 8000`

### Core Components

**Frontend (`main.html` + `script.js`)**:
- Single-page application with authentication (session/localStorage)
- MedDRA data loader: parses LLT, PT, and hierarchy files
- Search engine: exact and approximate matching with Levenshtein distance
- CIOMS PDF processor: extracts structured data using PDF.js
- Auto-search workflow: batch searches multiple symptoms from CIOMS reports
- Dark mode support with theme persistence

**Backend (`meddra_server.py`, `meddra_lookup.py`, `gemini_client.py`)**:
- `MeddraData` class: loads and searches `ascii-281/` data files
- Search methods: `search_llt()` for exact, `search_approximate_llt()` for fuzzy
- Gemini AI integration: re-ranks search results with contextual reasoning
- Scoring algorithm: position penalty + length penalty + inactive penalty
- File serving: static HTML, JS, and ASCII data files

**Automation (`db_autofill.js`)**:
- Playwright-based browser automation
- Navigates to MedDRA-DB site (https://cjlee-cmd.github.io/MedDRA-DB/)
- Auto-fills CIOMS data into database forms
- Handles login, form navigation, dynamic field creation
- Maps CIOMS structure to form fields with bilingual support (Korean/English)

## Data Architecture

### MedDRA Hierarchy (5 levels)
```
SOC (System Organ Class)
 └─ HLGT (High Level Group Term)
     └─ HLT (High Level Term)
         └─ PT (Preferred Term)
             └─ LLT (Lowest Level Term)
```

**File Format**:
- Delimiter: `$` (dollar sign)
- Encoding: UTF-8
- Line endings: CRLF
- Field counts: LLT=12, PT=12, MDHIER=13

**Key Files in `ascii-281/`**:
- `llt.asc`: LLT codes, names, PT mappings, active status (field 9)
- `pt.asc`: PT codes, names, primary SOC codes
- `mdhier.asc`: Complete hierarchy mappings with primary SOC flag (field 11)

**CIOMS Data Structure**:
```javascript
{
  기본_정보: { 제조업체_관리번호, 접수일 },
  환자_정보: { 환자_이니셜, 국가, 나이, 성별 },
  반응_정보: { Adverse_Reactions: [{ english, korean }] },
  의약품_정보: { 약물_목록: [{ 약물명, 적응증, 의심약물 }] },
  인과성_평가: { 평가방법, 평가결과, 평가근거 }
}
```

## Key Workflows

### Search Flow
1. User enters symptom/term → exact match in LLT names
2. If no results → approximate search using normalized text + Levenshtein
3. Match LLT → PT code → hierarchy lookup
4. Score results: position penalty + length difference + active status
5. Sort by score DESC, active first, then alphabetically
6. Optional: Gemini AI re-ranks with medical context

### CIOMS Extraction Flow
1. User uploads PDF → PDF.js extracts text
2. Pattern matching: patient info, reactions, drugs, dates
3. Bilingual mapping: English terms → Korean equivalents
4. Generate structured JSON with validation
5. Auto-download JSON file
6. Trigger auto-search for all reactions OR show modal

### DB Autofill Flow
1. User clicks "DB 자동 입력" button
2. Frontend POSTs CIOMS JSON to `/db-autofill`
3. Backend spawns `db_autofill.js` with data as CLI argument
4. Playwright launches browser, navigates to MedDRA-DB
5. Waits for database loading popup to disappear
6. Logs in with credentials (acuzen/acuzen)
7. Navigates to form-edit.html
8. Fills basic fields, adds reactions dynamically
9. Clicks save button
10. Browser remains open for manual verification

## Development Commands

### Running the Server
```bash
# Basic server
python3 meddra_server.py --host 127.0.0.1 --port 8000

# With Gemini AI (requires API key in .env or --gemini-key)
python3 meddra_server.py --gemini-key YOUR_KEY --gemini-model gemini-2.5-pro

# Custom UI path
python3 meddra_server.py --ui path/to/custom.html
```

### Testing
```bash
# Run Playwright E2E tests
npx playwright test test-cioms-popup.spec.js
npx playwright test test-cioms-json-download.spec.js
npx playwright test e2e-meddra-search.spec.js

# Manual DB autofill test
node db_autofill.js '{"환자_정보":{"환자_이니셜":"TEST"},...}'

# Python CLI search
python3 meddra_lookup.py "빈혈" --limit 5
python3 meddra_lookup.py  # Interactive mode
```

### Process Management
```bash
# Find and kill existing server
lsof -nP -iTCP:8000 | grep LISTEN
kill -9 <PID>

# Or use pkill
pkill -f meddra_server.py
```

## Important Patterns

### Data Loading Pattern
```javascript
// Frontend lazy loads data on first search
if (!dataset.loaded) {
  await ensureDataset();  // Loads LLT, PT, hierarchy
}
// Caches in memory for subsequent searches
```

### Search Scoring Algorithm
```python
# Python: meddra_lookup.py:276
score = 100 - position_penalty - length_penalty - inactive_penalty
position_penalty = min(position * 6, 45)
length_penalty = min(length_diff * 2, 35)
inactive_penalty = 20 if not active else 0
```

### Field Mapping Convention
```javascript
// CIOMS → Form field mapping pattern
formData.manufacturer_control_no = ciomsData.기본_정보?.제조업체_관리번호
formData.patient_initials = ciomsData.환자_정보?.환자_이니셜
formData.reactions = ciomsData.반응_정보?.Adverse_Reactions.map(...)
```

### Playwright Wait Strategy
```javascript
// Always wait for loading overlays to disappear
await page.waitForSelector('.loading-overlay', {
  state: 'hidden',
  timeout: 30000
});
await page.waitForTimeout(2000);  // Additional stability buffer
```

## Code Conventions

### File Naming
- Test files: `test-*.spec.js` for Playwright tests
- Documentation: `*_GUIDE.md`, `*_REPORT.md` uppercase with underscores
- Scripts: lowercase with underscores (`meddra_server.py`, `db_autofill.js`)

### Error Handling
- Python: Raise specific exceptions (`GeminiError`, `FileNotFoundError`)
- JavaScript: Try-catch with user-friendly alerts and console errors
- Server: Return JSON errors with appropriate HTTP status codes

### Security
- XSS prevention: `escapeHtml()` function for all user-generated content
- Path traversal: Use absolute paths only
- Authentication: Session + localStorage with 7-day token expiration
- Credentials: Never commit API keys (use `.env` file)

## Testing Strategy

**E2E Tests (Playwright)**:
- `test-cioms-popup.spec.js`: CIOMS modal display and data extraction
- `test-cioms-json-download.spec.js`: JSON file generation workflow
- `e2e-meddra-search.spec.js`: Complete search workflow with screenshots
- `test_e2e_with_screenshots.js`: Visual regression testing

**Integration Tests**:
- `test_integration.js`: Backend API + frontend interaction
- `analyze_form_fields.js`: MedDRA-DB form structure analysis
- `test_db_button.js`: DB autofill button functionality

## Common Operations

### Adding New CIOMS Fields
1. Update extraction patterns in `extractCIOMSData()` (script.js:223)
2. Add Korean/English mapping in `reactionMap` or `drugMatch` sections
3. Update `mapCiomsDataToFormFields()` (db_autofill.js:273)
4. Add form field selector in `dbAutoFill()` main loop

### Modifying Search Algorithm
1. Edit scoring in `meddra_lookup.py:_compute_score()` (Python)
2. Or `script.js:computeScore()` (JavaScript)
3. Adjust penalty weights for position, length, or active status
4. Test with: `python3 meddra_lookup.py "test term" --limit 10`

### Updating Gemini Prompts
1. Edit `gemini_client.py:44-55` for ranking instructions
2. Modify JSON schema in `generationConfig`
3. Test with `--gemini-model` flag to try different models
4. Default model: `gemini-2.5-pro` (defined in gemini_client.py:14)

## Deployment

**GitHub Pages (Static Mode)**:
- Source: `/ (root)` directory
- Entry point: `index.html` (login page)
- Main app: `main.html` (post-authentication)
- Data: `ascii-281/` served directly as static files
- No build step required

**Local Installation**:
- See `DEPLOYMENT_LOCAL_INSTALL.md` for detailed setup
- Python 3.7+ required for server mode
- Node.js + Playwright required for automation
- Windows users: see `WINDOWS11_INSTALL_GUIDE.md`

## Troubleshooting

**Database Loading Popup Won't Close**:
- Increase timeout in `page.waitForSelector('.loading-overlay', {timeout: 30000})`
- Check browser console for IndexedDB errors
- Clear browser cache and reload

**Playwright Automation Fails**:
- Verify Playwright installation: `npx playwright install`
- Check Node.js version: `node --version` (v14+ required)
- Review screenshots in `e2e-screenshots/` directory
- Check selector changes in MedDRA-DB site

**Search Returns No Results**:
- Verify `ascii-281/` directory exists and contains `.asc` files
- Check file encoding (must be UTF-8)
- Inspect delimiter (must be `$` not `,` or `;`)
- Test Python backend: `python3 meddra_lookup.py "빈혈"`

**Gemini AI Not Working**:
- Set `GEMINI_API_KEY` in `.env` file or environment variable
- Check API quota at Google AI Studio
- Verify model name: `gemini-2.5-pro` or `gemini-1.5-flash`
- Review error messages in server console output
