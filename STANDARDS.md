# Code Standards: The Waiting Game

## Error Handling
- **No "Pokemon" Catch Statements:** Never catch 'em all in silence. Every `try/catch` block MUST, at a minimum, log the error as a warning (`console.warn`), even if the error is expected to be rare or "impossible." We must hear the abyss when it screams.

## Naming Conventions
- **Underscore Indifference:** Variables that are intentionally unused (e.g., required by a signature but not employed in the body) MUST be named `_` or prefixed with an underscore (e.g., `_err`, `_ignored`). The linter has been instructed to show them mercy.
