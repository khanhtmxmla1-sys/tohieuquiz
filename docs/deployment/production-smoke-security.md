# Production smoke and rollout security runbook

This runbook describes the repository-side controls for the production smoke and staged rollout workflow. It does not configure GitHub environments, secrets, variables, or branch protection. A repository owner must complete those settings before enabling a production write operation.

## Target and credential boundaries

- Production targets are fixed to the canonical site, apex, API, and parent origins in `scripts/production-targets.mjs`.
- The production workflow does not accept URL inputs. The runner also rejects a non-canonical origin before its first request when protected smoke credentials are present.
- Requests use `redirect: 'manual'`; credentials must never be forwarded through a redirect.
- `public-smoke` runs public-only HTTP checks and Cypress in a job with no `SMOKE_*` environment variables or secrets. Public-only coverage reports `coverage: public` and never performs role logins or AI checks.
- The credentialed smoke job is manual-only from `main`, passes `--skip-browser`, and scopes the eight `SMOKE_*` values to its login step. The runner rejects credentialed invocation without `--skip-browser` before any request or browser spawn.
- Production smoke with credentials reports `coverage: public-and-authenticated`; missing credentials remain a blocked authentication result. Local mode is available only for non-credentialed test fixtures.

## Observed GitHub configuration and required owner work

The following repository metadata was observed while preparing this change; this package did not modify it:

- Historical preparation state before PR195 merged at `d6ca0fb8`: the `production-smoke` environment contained the eight existing smoke secret names and was not yet restricted to a selected branch.
- Post-merge owner verification confirms that `production-smoke` now allows only the `main` branch (no tags or wildcard patterns), has `can_admins_bypass=false`, and preserves those eight secret names. This verifies the environment policy; operational closure still requires the public-smoke correction to be merged, deployed, and verified.
- The `production-rollout` environment is absent, and `PRODUCTION_ROLLOUT_ENABLED` is absent/unset. The write job therefore remains dormant.
- No repository-wide `SMOKE_*` secrets were observed. Secret values are never copied into this runbook, reports, or command arguments.

The A2 environment-policy boundary is now verified for `production-smoke`: it allows `main` only (no tags or wildcard patterns), preserves the eight existing secrets, and disables administrator bypass. This policy is required even while the rollout writer is dormant: otherwise a feature-branch workflow could still reference the eight smoke secrets. The overall production-smoke security work remains open until the public-smoke correction is merged, deployed, and verified. The owner must separately create `production-rollout`, add dedicated credentials and required reviewers, restrict it to `main`, and then deliberately opt in with `PRODUCTION_ROLLOUT_ENABLED=true`. A missing environment is not a safety proof: GitHub can create an unprotected environment when referenced by a workflow. The repository variable is an explicit opt-in, not a substitute for environment protection or branch policy. Automatic public smoke and manual staff-smoke code paths do not substitute for retaining and periodically verifying this environment policy.

These requirements follow GitHub's deployment-status event payload and environment branch/tag policy behavior: [deployment status events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#deployment_status) and [deployment branches and tags](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags). The requirement to select `main` only is an operational security inference from those controls and must be verified by the repository owner; it is not established by this repository-side YAML alone.

## GitHub configuration required before writes

The owner must verify all of the following before setting the repository variable `PRODUCTION_ROLLOUT_ENABLED` to `true`:

1. Create or verify the `production-rollout` environment.
2. Add required reviewers, prevent self-review where supported, and restrict deployment branches to `main`.
3. Add only the staged-rollout admin credentials to that environment. Do not copy them into `production-smoke` or repository-wide variables.
4. Confirm branch protection and required CI checks for `main`.
5. Keep `PRODUCTION_ROLLOUT_ENABLED` absent or set to anything other than `true` until the preceding checks are approved.

The workflow write job is fail-closed: it runs only for a manual dispatch from `main`, when that repository variable is exactly `true`, and after the `production-rollout` environment gate has approved the job. A requested write with the wrong ref or disabled opt-in reaches an explicit blocked-feedback job and exits nonzero; it is not reported as a successful no-op. Do not bypass the gate by adding secrets to another environment.

## Operation matrix

| Operation | Job | Credentials | Gate |
| --- | --- | --- | --- |
| Automatic deployment-status public smoke | `public-smoke` | None | Successful `Production` deployment-status event; checks trusted `refs/heads/main` |
| Manual smoke | `smoke` | `production-smoke` read credentials | `workflow_dispatch`, `main`, `action=smoke` |
| Manual public smoke | `public-smoke` | None | Same manual smoke dispatch; public-only HTTP plus browser checks |
| `rollout-plan` | `rollout-readonly` | None | Manual dispatch |
| `rollout-evaluate` with `auto_rollback=false` | `rollout-readonly` | None | Manual dispatch |
| `rollout-apply`, `rollout-rollback`, or evaluate with auto rollback | `rollout-write` | Future `production-rollout` admin credentials | `main` + opt-in variable + required reviewers; dormant until separately approved |

## Dispatch and audit checklist

Before a write operation, record the GitHub run ID, time, requested stage, reason, and canonical target. Review the environment approval and the final report. Do not copy secret values, cookies, access codes, or full request payloads into an issue, artifact, or chat.

After the operation, retain the redacted report and review the audit log by run ID, time, action, stage, and target. If a credential may have been sent to an unapproved host, disable the workflow opt-in, stop further runs, and start the credential rotation/incident process with the owner. Do not attempt a compensating production write without a new approval.

## Maintenance and rollback

An intentional `503` always remains a blocked production smoke result. `X-Robots-Tag: noindex` is also blocked by default, including on the site homepage. The only intentional privacy exception is the canonical parent `/login` probe when it returns HTTP 200 with exact `private` and `no-store` cache-control directives, a valid application shell, and the expected security headers. Do not disable maintenance merely to make this workflow pass. Roll back this change only with a forward fix that preserves the canonical target allowlist; never restore arbitrary host inputs for credentialed jobs.
