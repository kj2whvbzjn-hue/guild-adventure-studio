# BUILD442 GitHub Pages Package Generator

## Scope
Adds a deterministic, local-only generator for the files approved for GitHub Pages upload.

## Behavior
- Reads `shared/release/github-pages-package.json`.
- Includes only approved required files and roots.
- Rejects symlinks, unsafe paths, missing files, and excluded top-level paths.
- Can validate the package plan without writing a ZIP.
- Can generate and immediately integrity-test a GitHub Pages upload ZIP.
- Does not connect to or upload anything to GitHub.

## Compatibility
No runtime files were moved or deleted. Existing URLs and save-data keys are unchanged.
