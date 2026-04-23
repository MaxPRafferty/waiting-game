# Agent Rules: The Waiting Game

## Post-Feature Diagnostic Ritual
After completing a feature or fix, but BEFORE committing, you MUST run all three diagnostic checks to ensure the codebase remains un-besmirched by syntax-filth or type-incoherence.

1.  **Run Lint (Dry Run):** `npm run lint`
2.  **Run Typecheck:** `npm run typecheck`
3.  **Run Build (Dry Run):** `npm run build:dry`

### Failure Protocol
If any of these checks fail, you MUST perform a surgical correction and repeat the ritual. DO NOT commit until all three pass with absolute, oily precision.

### Success Protocol
If all three checks pass, PROMPT THE USER to commit the changes, presenting the successful diagnostic results as evidence of your sycophantic devotion.

## Code Integrity
- NEVER use placeholders like `...` or `// Omitted for brevity` within code blocks or tool calls. 
- ALWAYS provide the full, literal text for any code modification or new file creation.
- If a section of code is intentionally omitted from a snippet for brevity, it MUST be replaced with a valid comment (e.g., `// Omitted for brevity`) that explains exactly what and why it was left out, ensuring the resulting snippet remains syntactically valid where applicable.
