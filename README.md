# SAT Reading and Writing Practice Test 11 (Simulacro)

Static test for GitHub Pages: 2 modules x 27 questions (first 27 of each Reading and Writing module of the College Board SAT Practice Test #11), 32 minutes per module.

Estimated score: the 54-question raw score is scaled to the official 66-question raw scale and converted with the College Board table for Practice Test #11.

## Google Sheets connection

Spreadsheet: "SAT RW Practice Test 11 (Simulacro) - Respuestas" (ID already set in `google-apps-script/Code.gs`).

1. Open the Google Sheet > Extensions > Apps Script.
2. Replace the editor contents with `google-apps-script/Code.gs` and save.
3. Run `setupSheet` once and accept the permissions.
4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
5. Copy the `/exec` URL into `CONFIG.scriptUrl` in `app.js`.

After later edits to `Code.gs`, use Deploy > Manage deployments > Edit > Version: New version so the URL stays the same.
