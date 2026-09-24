# quotebook — task runner. Run `just` to list recipes.
# Install just: `brew install just`

set shell := ["bash", "-uc"]

# Show available recipes (default).
default:
    @just --list

# --- Develop -------------------------------------------------------------

# Run the test suite.
test *ARGS:
    npm test -- {{ARGS}}

# Type-check sources.
typecheck:
    npm run typecheck

# Build the package into dist/.
build:
    npm run build

# Build and serve the example site locally.
example:
    npm run example

# --- Release -------------------------------------------------------------

# Bump the version, commit, tag, and push — triggers the Release workflow.
# Optional notes (Markdown) go into the annotated tag and appear at the top of
# the GitHub Release, above the auto-generated changelog.
# Usage: just tag 1.1.0
#        just tag 1.1.0 "Adds dark mode."
#        just tag 1.1.0 "$(cat notes.md)"
tag version $notes="":
    #!/usr/bin/env bash
    set -euo pipefail
    ver="{{version}}"
    if ! [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "✗ version must look like 1.1.0 (got '$ver')" >&2; exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "✗ working tree not clean — commit or stash first." >&2; exit 1
    fi
    if git rev-parse "v$ver" >/dev/null 2>&1; then
        echo "✗ tag v$ver already exists." >&2; exit 1
    fi
    # Pre-flight: the same checks CI runs, before anything is tagged or pushed.
    npm run typecheck
    npm test
    npm run build
    # Updates package.json and package-lock.json together; tagging is done below.
    npm version "$ver" --no-git-tag-version >/dev/null
    git add package.json package-lock.json
    git commit -m "Release v$ver"
    # `notes` arrives as an environment variable (the `$` on the parameter), so
    # quotes, backticks, and newlines in it pass through untouched.
    if [[ -n "${notes//[[:space:]]/}" ]]; then
        git tag -a "v$ver" --cleanup=verbatim -m "$notes"
    else
        git tag "v$ver"
    fi
    git push origin HEAD
    git push origin "v$ver"
    echo "✓ Pushed v$ver — CI will test, create the GitHub Release and publish to npm."

# --- Housekeeping --------------------------------------------------------

# Remove build output.
clean:
    rm -rf dist
    @echo "✓ Cleaned dist/"
