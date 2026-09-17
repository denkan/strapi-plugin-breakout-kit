# Releasing (maintainer runbook)

The pipeline is fully automated up to two human 2FA touches. No credentials exist anywhere
in CI (npm trusted publishing / OIDC; `ADAPT_PUSH_TOKEN` is a contents-only PAT for branch
pushes).

## Normal release flow ("merge = staged")

1. A PR lands on `main` with a bumped `packages/plugin/package.json` version
   (adaptation PRs bump automatically; feature PRs bump manually — patch = fixes,
   minor = features/Strapi adaptation).
2. On merge, **Publish** runs: full suite → `npm stage publish` (OIDC, provenance
   automatic). The run summary shows the stage id.
3. **You:** approve the staged version — npmjs.com UI works fine (despite docs saying
   CLI-only), or `npm stage approve <stage-id> --otp=<code>`.
4. **You:** move the Strapi-minor dist-tag:
   `npm dist-tag add strapi-plugin-breakout-kit@<version> strapi-5.<minor> --otp=<code>`
   (minor = the drift manifest's `strapiVersion`). CI cannot do this — dist-tags are
   2FA-gated writes. **post-release** nags in its run summary until it's done.
5. **post-release** auto-creates the GitHub release once the version is live
   (workflow_run after Publish + daily cron + manual dispatch).

## Strapi release → adaptation

Daily watcher compares npm's latest @strapi/strapi to the drift manifest. A newer v5
dispatches **strapi-adapt**: branch `strapi-<version>`, version bumps, drift check, full
suite, agent adaptation if needed (requires `ANTHROPIC_API_KEY` secret; skipped
gracefully without it), PR labeled `automated`. The PAT-pushed branch auto-triggers CI
and the **version matrix** (all minors floor→roof). A new Strapi major opens a
`needs-human` issue instead.

Merging an adaptation PR moves the support window roof and flows into the release
steps above.

## Repo/npm settings that make this work (change with care)

- **Trusted publisher** (npm package settings): GitHub Actions, `denkan/strapi-plugin-breakout-kit`,
  workflow `publish.yml` (filename only), **Environment EMPTY** (a value here breaks the
  OIDC exchange with "package not found"), stage-publish only ("Allow npm publish"
  unchecked). npm account requires 2FA for writes; no npm tokens exist.
- **Branch protection on `main`**: required check `test`, `enforce_admins: true` —
  nobody pushes directly; everything is branch → PR → green CI → merge.
- **Secrets/variables**: `ADAPT_PUSH_TOKEN` (fine-grained PAT, this repo, Contents RW —
  renew before expiry; lapse only degrades to manual workflow approval on adaptation
  PRs), optional `ANTHROPIC_API_KEY`, repo variable `ENABLE_AUTO_MERGE` (unset = off;
  set `true` to auto-merge green no-drift adaptation PRs).
- **OIDC workflow requirements** (each broke a run once): see the header comment in
  `.github/workflows/publish.yml`.

## Version policy (docs/decisions.md #7, #10)

Plugin-own semver, `0.x` while experimental → jump to `5.0.0` on stabilization.
Support window = manifest `strapiFloor`..`strapiVersion`, enforced by peer ranges and
verified per minor by `npm run matrix -- --window`. If a change can't stay green across
the window, raise the floor explicitly.
