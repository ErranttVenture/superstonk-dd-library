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

If two submissions are accepted at once, both pull requests may claim the same position and the second will fail validation — rebase it, and the position is reassigned from the merged state.

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

GitHub does not trigger workflow runs from events created using the automatic `GITHUB_TOKEN` — pushes and pull requests opened with it do not start a new `ci.yml` run. To work around this, `submission-open-pr.yml` pushes its branch and opens its pull request with the `SUBMISSION_PR_TOKEN` repository secret when it exists: a fine-grained personal access token scoped to only this repository, with Contents read/write and Pull requests read/write permissions, created by a maintainer and stored under Settings → Secrets and variables → Actions. Pull requests opened with that token trigger `ci.yml` normally, so a branch protection rule requiring the `validate` check works as intended.

If the secret is missing (or its token has expired), the workflow falls back to `GITHUB_TOKEN`. In that state the `npm test && npm run validate` step inside `submission-open-pr.yml` is the only automated gate these pull requests get, and a required `validate` check will block them from merging — close and reopen the pull request as a maintainer to trigger `ci.yml` by hand, and rotate the token.

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
