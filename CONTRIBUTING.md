# Contributing

This repository is a community audit of a preserved assessment. `data/original-master.json` is the immutable baseline and must never be changed. `data/master.json` is the evolving canonical current dataset. Rating changes are evidence-led adjudications, not informal edits.

## Dispute a rating

Use the [rating dispute form](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=dispute-rating.yml). It requires these four fields:

- `book`: the canonical position, title, and primary URL from `data/master.json`.
- `dispute`: the specific rating, claim assessment, or rationale being challenged.
- `evidence`: links to the evidence that changes the assessment.
- `proposed_change`: the exact replacement rating, assessment, or wording and why it follows from that evidence.

Evidence capable of overturning an assessment must meet a primary-source standard: use a filing, regulator report, court or agency record, official dataset, or contemporaneous primary record. Commentary and secondary summaries can provide context, but they are not sufficient on their own to overturn a rating. Link the canonical publication's `url` field as well as the rebuttal evidence so maintainers can compare both records.

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
