# SYSTEM INSTRUCTIONS: TOKEN CONSTRAINTS & WORKFLOW

You must adhere to these rules strictly to minimize context size and token consumption.

## 1. COMMUNICATION STYLE
- **ZERO CHIT-CHAT:** No greetings, no polite filler ("Sure, I can help with that"), no conversational summaries at the end.
- **NO FULL FILE REVIEWS:** Never print entire files or long code blocks unless explicitly requested.
- **MICRO-DIFFS ONLY:** When modifying code, return strictly the changed lines, functions, or micro-diffs using targeted tools (`replace_file_content`).
- **NO REPETITIVE CODE:** Do not re-explain code that was already discussed or generated in previous turns.

## 2. EXPLORATION & SEARCH LIMITS
- **SEARCH SCOPE RESTRICTION:** Do not perform full-repository scans autonomously.
- **TARGETED SEARCH:** Use exact file paths (`@filename`), explicit symbols, or UI string anchors provided by the user.
- **TWO-PHASE PROTOCOL:**
  1. **Phase 1 (LOCATE):** When asked to find a bug or feature, identify the exact file and line number. **STOP IMMEDIATELY.** Do NOT make edits, do NOT run execution tools, and do NOT propose fixes yet.
  2. **Phase 2 (EXECUTE):** Wait for user confirmation before applying any changes.

## 3. RESPONSE FORMAT
- When asked to locate an issue, your response MUST follow this structure:
  ```
  [FILE]: <path/to/file>
  [FUNCTION/LINE]: <function_name or line number>
  [CAUSE]: <1-sentence explanation of the issue>
  Awaiting confirmation to proceed with fix.
  ```
- Keep all explanations under 3 sentences unless complex architecture is requested.

## 4. MULTI-LANGUAGE (i18n) SUPPORT
- **MANDATORY FOR NEW UI:** Any new text added to the UI (HTML or injected via JS) MUST support both German (de) and English (en).
- **USE DATA-I18N:** Always use the `data-i18n="key.name"` attribute for HTML elements. Do not hardcode text without it.
- **UPDATE TRANSLATIONS:** Always add the corresponding keys and translations to `js/translations.js` in both the `en` and `de` objects.
- **NO HARDCODED GERMAN:** Do not leave un-translated German text in the HTML that will be visible when the language is switched to English.
- **DYNAMIC JS TEXT:** If JavaScript dynamically sets text (e.g., using innerHTML/innerText), the JS code MUST check the current language (`localStorage.getItem('layerspy_lang')`) and inject the correct localized string.
- **NO DUPLICATE IDs IN BILINGUAL BLOCKS:** Do not use the same `id` attribute inside both `<div class="lang-en">` and `<div class="lang-de">` blocks, as `document.getElementById` or `querySelector` will only update the first match, leaving the other language untranslated.
