# Contributing

This repository is a community audit of a preserved assessment. `data/original-master.json` is the immutable baseline and must never be changed. `data/master.json` is the evolving canonical current dataset. Rating changes are evidence-led adjudications, not informal edits.

## Dispute a rating

Use the [rating dispute form](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=dispute-rating.yml). It requires these four fields:

- `book`: the canonical position, title, and primary URL from `data/master.json`.
- `dispute`: the specific rating, claim assessment, or rationale being challenged.
- `evidence`: links to the evidence that changes the assessment.
- `proposed_change`: the exact replacement rating, assessment, or wording and why it follows from that evidence.

Evidence capable of overturning an assessment must meet a primary-source standard: use a filing, regulator report, court or agency record, official dataset, or contemporaneous primary record. Commentary and secondary summaries can provide context, but they are not sufficient on their own to overturn a rating. Link the canonical publication's `url` field as well as the rebuttal evidence so maintainers can compare both records.

## Submit a new DD

The original review covered one FlipHTML5 bookcase as it stood on July 21, 2026. Use the [submission form](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=submit-dd.yml) to nominate due diligence it never saw: a Reddit post, a Substack essay, a FlipHTML5 publication, a hosted PDF, or an independent researcher's page. Any work with a durable public URL is eligible.

Do not paste the full text of the work anywhere in the issue or the repository. Link to it. This is the same rule that keeps the original FlipHTML5 book text out of this repository.

### What is checked

An automated comment runs these checks on every submission and re-runs them whenever you edit the issue. Before that: `Length in pages` may be left blank, which means the work is not paginated, but any value you do give must be a whole number of 1 or more — anything else means the issue can't be read, and it is rejected with an edit request before any of the checks below ever run.

- `url_resolves` — the source URL resolves.
- `archive_present` — an `archive_url` snapshot at `web.archive.org`, `archive.today`, `archive.ph`, or `archive.is` resolves, so the record survives deletion.
- `no_duplicate` — the normalized URL is not already in `data/master.json`. Normalization folds scheme, host case, `www.`, trailing slashes, and the tracking parameters `utm_*`, `ref`, `ref_source`, `share_id`, `si`, and `fbclid`. Path and query-value casing are deliberately left alone — some sources (a Reddit permalink, a video ID) are case-sensitive, and folding them would risk a false match against an unrelated URL.
- `byline_present` — an author is named. Pseudonyms and handles are fine.
- `published_valid` — the publication date is a real past date in `YYYY-MM-DD` form.
- `thesis_present` — a one-line thesis of at least forty characters.
- `copyright_ack` — the acknowledgement is ticked.
- `title_byline_near_match` — the title and byline are checked against existing records; a match doesn't block the submission, it's flagged as a warning so a maintainer can confirm the work is distinct.

This warns rather than blocks because compilations and reposts legitimately share titles. A link that cannot be reached at check time — a timeout, a host that blocks automated requests, anything short of a definitive "this page is gone" response — is reported as unverified rather than failed; only an explicit 404 or 410 marks a link dead, and a maintainer may accept anyway.

Quality, plausibility, credibility, and whether anyone finds the thesis absurd **is not a gate**. That judgment belongs to the rating, in public, against the [rubric](harness/rubric.md). Filtering at intake would move it somewhere unaccountable.

Maintainers apply exactly one discretionary test: is this market-structure or due-diligence content at all. That is the sole subjective gate.

### What acceptance means

A maintainer applies the `accepted` label, which opens a pull request adding a record at `pos 251` or above with `source_corpus: "community"` and `review_status: "pending"`.

**A pending record is unrated. It is not rated zero, and acceptance is not endorsement.** Rating it is a separate governed step: a later pull request runs the [harness](harness/README.md) against the work, records `review_provenance`, and sets `review_status` to `reviewed` or, where the text cannot support a fair judgment, `unreviewable`. Once a rating exists, challenge it through the dispute path above. The unconditional author right of reply applies to community records exactly as it does to the original 250.

If two submissions are accepted at once, both pull requests may claim the same position. Before merging the second, rebase it onto current `main`, update the new record's position to the next unused position, and rerun validation. Rebasing alone does not reassign the position.

## Maintainer setup

The submission workflows (`.github/workflows/submission-check.yml` and `.github/workflows/submission-open-pr.yml`) depend on five labels that must exist in the repository before either workflow can do anything. Nothing about the workflows creates these labels; they must be created once, by a maintainer with write access, with:

```bash
gh label create submission --color 0E8A16 --description "A new-DD submission" --repo ErranttVenture/superstonk-dd-library
gh label create accepted --color 5319E7 --description "Maintainer accepted a submission into the pending queue" --repo ErranttVenture/superstonk-dd-library
gh label create submission:passing --color C2E0C6 --description "All mechanical checks pass" --repo ErranttVenture/superstonk-dd-library
gh label create submission:failing --color E99695 --description "A mechanical check failed" --repo ErranttVenture/superstonk-dd-library
gh label create submission:unverified --color FEF2C0 --description "A link could not be reached at check time" --repo ErranttVenture/superstonk-dd-library
```

Without `submission` (auto-applied by the submission issue form), `submission-check.yml`'s `if:` condition never evaluates true and the check never runs. Without `accepted`, `submission:passing`, `submission:failing`, and `submission:unverified`, the `gh issue edit --add-label`/`--remove-label` calls inside the workflows fail outright.

### Authentication and PR creation

The submission workflow uses only the automatic `GITHUB_TOKEN`. There is no personal-token fallback or token to rotate. The former `SUBMISSION_PR_TOKEN` secret is unused; after this change is deployed, remove it and revoke its PAT if it has no other use. A few submissions a year do not justify keeping a personal write credential for unattended CI.

Before accepting the first submission, enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. The workflow's `pull-requests: write` permission does not override this repository setting. The workflow creates PRs but does not approve or merge them. This PR does not change repository settings for you. See [GitHub's repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

The maintainer permission guard runs first. Checkout uses `persist-credentials: false`; issue processing and tests receive no explicit token environment variable or persisted Git credential. The publishing step sets its own `GH_TOKEN` and runs `gh auth setup-git --hostname github.com`, so the Git credential helper authenticates the push with that step's job token. The generated commit uses `github-actions[bot]` metadata, and the PR is opened by GitHub Actions with a link to its workflow run. That metadata identifies automation; it is not a cryptographic signature or a rating decision.

### Start CI and sign the submission

Current [GitHub token behavior](https://docs.github.com/en/actions/concepts/security/github_token) creates approval-required workflow runs for PRs opened or updated with `GITHUB_TOKEN`. On the PR page, a maintainer selects **Approve workflows to run**. If no CI run or approval banner appears, close and reopen the PR using the maintainer's own account to trigger `ci.yml`. Re-running `submission-open-pr.yml` is not a substitute for starting CI on the PR.

Keep the required `validate` check, strict up-to-date checking, admin enforcement, required signatures, and linear history on `main`. The local workflow validation does not satisfy the separate required PR check. The push to `submission/*` does not match CI's main-only push filter; the PR event starts CI. Neither operation matches the issue-event triggers of the submission workflows.

The generated commit is unsigned. A maintainer must inspect the PR diff and sign the submission commit using their own configured Git identity and a signing key registered with GitHub. Authentication with a token does not sign commits, and [GitHub's signing policy](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-signed-commits) can block an unsigned PR head even when the final squash commit would be signed.

For a generated PR that still contains exactly one new commit, use a clean checkout of its `submission/<issue-number>` branch (for example, `gh pr checkout <pr-number>`), inspect that commit, and then run:

```bash
git commit --amend --no-edit --reset-author -S
git push --force-with-lease
```

Run these commands only on the reviewed submission branch, never on `main`. Resetting authorship records the maintainer's attestation; the PR body and workflow run preserve the automation trail. If the branch has multiple new commits or needs a rebase, review and sign every resulting commit instead of amending only the tip. Confirm GitHub marks the commits **Verified**, CI passes on the new head, and the PR is up to date before merging with an allowed linear-history method. A maintainer's signed push to an open PR triggers CI normally.

### Recover a partial run

Runs for the same issue are serialized. A retry checks for an existing PR first, including closed and merged PRs, and leaves it alone. If the branch exists but no pull request exists, the workflow opens a PR for that existing remote branch without rewriting it, appending another record, or executing code from that branch. Inspect the recovered diff and require PR CI before merging; the retry does not revalidate the existing branch locally.

If PR creation failed because the repository setting was disabled, enable it and re-run the failed workflow. API and remote-lookup failures stop the run; they are not treated as proof that a branch or PR is absent. To reconsider a closed PR, reopen it explicitly after review. To change an existing submission branch, edit that PR explicitly; reapplying `accepted` does not replace its contents.

### First end-to-end check

After deployment and maintainer setup, submit one legitimate new publication, observe the checklist and status labels, and apply `accepted`. Verify one PR adds one pending, unrated community record while preserving the original 250 and the immutable baseline. Review and sign its commit, start CI through the PR page if needed, and verify required `validate` passes on the current head and branch protection permits merging. Retry the submission workflow and confirm it leaves the existing PR and branch unchanged. Local tests do not establish this end-to-end behavior.

## Review and accepted changes

Every pull request requires maintainer review. A data change requires an accepted rating dispute or an accepted correction issue; maintainers apply or explicitly approve the resulting patch to `data/master.json`. Rating, claim-assessment, and rationale changes require the dispute path. Metadata, link, transcription, and other factual corrections use the correction path. No drive-by rating edits are accepted, and pull requests that bypass the applicable issue record are closed.

No contribution may modify `data/original-master.json`. It is the permanent launch-state evidence, not a second editable copy of the canonical dataset.

An accepted change never erases the historical assessment. The affected rationale or claim note preserves the original assessment visibly inside an `ADJUDICATED` note, followed by the new conclusion, evidence, and adjudication date. This keeps the audit trail inspectable instead of rewriting history.

## Author right of reply

An author may always add a response to the canonical record's `author_response` field in `data/master.json`. This right is unconditional: the response is added whether the requested rating change is accepted, rejected, or still under review. A response is identified as the author's statement and does not silently alter the reviewer's assessment.

Authors can use the dispute form or a correction issue to provide their response and establish authorship. Maintainer review checks attribution and repository safety, not whether the maintainer agrees with the response.
When one issue contains both a rating dispute and an author response, the response is accepted independently of the rating decision.

## Corrections

Use the [correction form](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=correction.yml) for transcription errors, broken links, incorrect metadata, or documentation mistakes that do not dispute a rating. Identify the `location`, state the `correction`, and provide `evidence` that verifies it.

## Re-running the review

The [recovered harness](harness/README.md) supports one-book evaluation with another model using the same rubric and structured output contract. Record the model, evaluation date, hindsight version (the current facts block is assembled from [harness/hindsight.md](harness/hindsight.md); new facts or corrections go through [harness/ERRATA.md](harness/ERRATA.md)), prompt revision, and any adjudication so results can be compared responsibly. To challenge a hindsight fact, use the correction form citing `harness/hindsight.md` as the location, with primary-source evidence; accepted or rejected, the outcome is recorded as an ERRATA entry.

The published review data and reports use CC BY-SA 4.0. If you publish same-rubric re-ratings or an adapted dataset, share them back under the same license and include enough provenance to reproduce or audit the changes. Opening an issue or pull request with the resulting dataset is the preferred way to return that work to the community.
