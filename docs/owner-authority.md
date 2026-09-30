# Owner authority

Owner instruction, September 29, 2026: “the owner doesnt need permission ... everyone else does”.

The repository owner, `clearframeworks`, is CFH's final release authority. Their
explicit approval of a candidate is sufficient human authorization for that
release, including when they authored the pull request. This is not conditional
on a second reviewer being available. Other contributors require the owner's
approval or a reviewer explicitly delegated by the owner.

The earlier single-active-user request establishes the founding case: when only
the owner is active, the owner is the sole decider. The later clarification keeps
that authority when contributors join; it does not grant contributors the same
exception. Agents and bots are not additional human decision makers.

## Enforcement

- Keep automated checks (`secret-scan`, `dependency-audit`, `verify`) mandatory,
  including for the owner. Keep strict up-to-date checks, conversation resolution,
  and the prohibitions on force pushes and branch deletion.
- Give only the owner an exception to human pull-request review requirements.
  Everyone else remains subject to code-owner review by `@clearframeworks`.
- Do not grant apps, bots, or other contributors the owner review exception.
- Agents using the owner's credentials may perform only operations authorized by
  the owner's request. Possession of credentials is not approval.
- Record the approved candidate, successful checks, and rollback coordinate for
  production releases. Owner approval must not be reported as independent review.
- Recheck this mapping before transferring the repository to an organization or
  granting another person administrative access.

## Provider configuration

Verified provider configuration on September 29, 2026:

- Active ruleset [24219065](https://github.com/clearframeworks/coders-for-humanity/rules/24219065)
  requires fresh code-owner approval for `main`. Its only human-review exception
  is GitHub user ID `261966974` (`clearframeworks`), limited to pull-request merges.
- Required checks remain in separate classic branch protection with administrator
  enforcement enabled. The human-review exception cannot waive those checks.
- The former duplicate classic human-review rule is replaced by this ruleset;
  the code-owner review requirement for other people remains active.

Configuration uses GitHub's [repository rules API](https://docs.github.com/en/rest/repos/rules)
and [protected branch API](https://docs.github.com/en/rest/branches/branch-protection).

## Scope

This policy controls this repository and the dedicated CFH hosting project. It
does not change database roles, task acceptance rules, shared-account activation,
or the production lock for `clearframeworks.org`. Public users do not acquire
release authority by creating a profile or completing a task.

## Approved candidate

The owner approved preview deployment `dpl_36dphQ7somvQW8PNx4Afse9ayKtn`, source
`f5eb8a617c51174672cabbf9dc588b8076567f56`, before requesting this policy. The policy
change adds operational documentation only; the approved application files remain
unchanged. Required CI must pass on the final pull-request head before merging.
