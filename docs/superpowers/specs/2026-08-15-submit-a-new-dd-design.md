# Submit a New DD to the Library — Design

## Objective

Add a governed path for community members to submit due diligence that the July 21, 2026 review never saw, so the repository becomes a living audit layer rather than a fixed review of one FlipHTML5 bookcase.

Today the only contribution paths are `dispute-rating.yml` and `correction.yml`. Both operate on records that already exist. Nothing lets a reader say "this piece belongs in the library." This design adds that path end to end: an issue form, mechanically verifiable acceptance checks, an automated check-and-comment workflow, a maintainer-gated pull request workflow, an extended record schema, and split repository invariants that keep the preserved 250 provably intact.

## Scope

In scope:

- A `submit-dd.yml` issue form whose field identifiers are a stable machine contract.
- A `scripts/submission.mjs` module exposing three pure functions for parsing, checking, and record construction.
- Two GitHub Actions workflows: mechanical verification on issue open or edit, and pull request creation on maintainer acceptance.
- A four-branch `data/schema.json` that admits community records without loosening the preserved records.
- Extended repository invariants in `scripts/validate-repository.mjs`.
- Unit, schema, and repository tests.
- Contribution, README, and harness documentation updates.

Out of scope:

- The justthebros.co submission form. It is phase two and gets its own spec.
- Regenerating `justthebros/public/dd-library.json`. That lives in a different repository.
- Any change to `data/original-master.json`, `data/library_review.csv`, `reports/REPORT.md`, or `reports/BOOKS.md`.
- Automated rating of a submitted work. Accepting a submission and rating it are deliberately separate acts.
- Bundling a model invocation. The harness stays provider neutral.

## Corpus Scope

A submittable work is any publicly readable due diligence with a durable URL: a Reddit post, a Substack essay, a FlipHTML5 publication, a hosted PDF, or an independent researcher's page. The library's value is the audit layer, not the hosting platform.

Because non-FlipHTML5 sources have no extractor in `harness/`, text capture for those works is manual during the review stage. `harness/extract_book_text.mjs` is unchanged by this design.

Full source text is never committed. This is the same rule that keeps FlipHTML5 book text out of the repository, and it extends to submissions without exception.

## Record Model

`data/schema.json` currently expresses two record shapes through a two-branch `anyOf`: a metadata-only record and a reviewed record. It becomes four branches.

| Branch | `pos` bound | `review_status` | Community fields |
|---|---|---|---|
| Original metadata-only | 1–250 | forbidden | forbidden |
| Original reviewed | 1–250 | forbidden | forbidden |
| Community unrated | ≥ 251 | `pending` or `unreviewable` | required |
| Community reviewed | ≥ 251 | `reviewed` (const) | required, plus review provenance |

The unrated branch covers both `pending` and `unreviewable` because they share a shape: metadata, no rating. It permits an optional `summary`, which is how an `unreviewable` record explains why it cannot be judged. Splitting them into separate branches would duplicate an identical property list to encode a distinction the `review_status` value already carries.

Each branch keeps `additionalProperties: false` and declares its own `pos` bound. That is what prevents a community field from ever attaching to one of the preserved 250, and it prevents a community record from omitting them.

This four-branch structure exists because `scripts/schema-validator.mjs` is a hand-rolled validator that throws on any keyword outside its supported set. `if`, `then`, and `else` are not supported, so a conditional rule of the form "when `pos` exceeds 250, require these fields" cannot be expressed. `anyOf` and `const` are both supported and already used. Extending the validator with conditional keywords was considered and rejected: four explicit branches change no executable validation code, match the idiom the schema already uses, and are self-documenting to a reader.

The known cost is error-message quality. A record that matches no branch produces `must match at least one schema in anyOf`. This weakness already exists for the two current branches. It is acceptable because submitters never see it — `checkSubmission` produces the human-facing errors, and schema failures are a maintainer-time signal.

### Top-level changes

The shared `pos` definition relaxes from `{"minimum": 1, "maximum": 250}` to `{"minimum": 1}`. Two new definitions carry the bounds: `originalPos` (1–250) and `communityPos` (minimum 251). Every branch references the appropriate one.

A `pagesOrNull` definition permits `null` and is referenced only by the community branches. A Reddit post has no page count, and recording `1` would put a false value in the dataset. `pages` remains a required key on community records; its value may be `null`.

### Community fields

Community branches require three properties the original branches forbid:

- `source_corpus`: `{"const": "community"}`. A consumer can partition the dataset on this field alone.
- `review_status`: one of `pending`, `reviewed`, `unreviewable`, constrained per branch as tabulated above. The third value mirrors the July run's handling of art and image-only publications and of text too fragmentary to judge fairly.
- `submission`: an object requiring `submitted_on` (ISO date), `submitted_by` (GitHub handle or the literal `anonymous`), `issue` (URL of the originating issue), `archive_url` (snapshot URL), and `platform` (one of `reddit`, `fliphtml5`, `substack`, `pdf`, `other`). `additionalProperties: false`.

The community reviewed branch additionally requires `review_provenance`: an object requiring `model`, `evaluated_on`, `hindsight_cutoff`, `prompt_revision`, and `reviewer`. The original 250 do not carry this because they came from one run under one rubric on one date, recorded in the report. Community reviews accumulate across models and dates, and a rating without this block is not reproducible. `harness/README.md` already instructs a re-runner to record exactly these five facts; this makes the instruction structural.

The original 250 gain no community fields whatsoever, and the schema's branch bounds enforce that. They remain subject to the existing dispute and correction workflow — `master.json` is the evolving dataset and three preserved records already carry `validity_rating_original` from the August 13, 2026 adjudication. What keeps the provenance claim true after `master.json` grows past 250 is the hash-pinned `data/original-master.json`, not a freeze on the preserved block.

### Existing fields reused unchanged

`type` already admits `original`, which covers a Reddit or Substack DD post. `content_type`, `topics`, `key_claims`, `evidence_quality`, `speculation_level`, `validity_rating`, `validity_rationale`, `quality_variance`, and `confidence` carry the same meaning for a community reviewed record as for an original one. `author_response` is already permitted on the metadata-only shape, so the unconditional right of reply extends to pending community records with no schema change.

## Lifecycle

A submission moves through four states.

**Submitted.** A reader opens a `submit-dd` issue. Nothing is in the dataset yet.

**Verified.** The check workflow runs the mechanical bar and comments a pass/fail checklist on the issue, applying `submission:passing` or `submission:failing`. Editing the issue re-runs the check.

**Pending.** A maintainer makes the one subjective scope call and applies the `accepted` label. The pull request workflow appends a community pending record and opens a pull request referencing the issue. Once merged, the work is publicly in the library, listed, and explicitly unrated.

**Reviewed or unreviewable.** A separate, separately-governed pull request runs the harness against the work and promotes the record, adding the review fields and `review_provenance`, or sets `review_status` to `unreviewable` with a `summary` explaining why.

Accepting a submission is not rating it, and merging a pending record commits the maintainer to nothing about its quality. A rating, once applied, is challenged through the existing dispute path — this design adds no second dispute mechanism.

The pending queue is public and may grow faster than it drains. That is the accepted cost of not blocking submissions on maintainer capacity, and it is visible rather than hidden in an inbox.

## The Published Bar

CONTRIBUTING.md publishes these checks verbatim so a submitter can self-assess before opening an issue and so a rejection is arguable against a written standard.

1. `url` is `http(s)` and resolves with a 2xx status.
2. `archive_url` is present, resolves, and its host is `web.archive.org` or an `archive.today` mirror (`archive.today`, `archive.ph`, `archive.is`). The accepted-host list is a named constant in `submission.mjs` so adding a host is a one-line change with a test.
3. The normalized `url` does not already appear in `data/master.json`. Normalization lowercases the scheme and host, drops a trailing slash, and strips a fixed list of tracking parameters — `utm_*`, `ref`, `ref_source`, `share_id`, `si`, and `fbclid` — also held as a named constant. Reddit's `context` parameter is deliberately preserved because it changes which comment a link resolves to.
4. `byline` is non-empty. Pseudonyms are explicitly acceptable.
5. `published` is a valid ISO date and is not in the future.
6. A one-line thesis is present and is at least forty characters.
7. The submitter affirms that no copyrighted full text has been pasted into the issue or the repository.

A near-match on title and byline against an existing record produces a warning, not a failure, because compilations and reposts legitimately share titles.

Quality, plausibility, credibility, and whether a maintainer finds the thesis absurd are deliberately **not** gates. The rating layer exists to make that judgment in public against a rubric. Filtering at intake would move that judgment somewhere unaccountable.

The maintainer adds exactly one subjective test: is this market-structure or due-diligence content at all. This is the sole discretionary gate, and CONTRIBUTING.md states so plainly.

## Components

### `scripts/submission.mjs`

Three exported functions, each pure and independently testable, with all I/O and clock access injected.

`parseSubmissionIssue(body)` maps a GitHub issue-form body to a payload object. Text in, object out — no network, no filesystem. Returns `{payload, errors}` where `errors` names every missing or malformed field rather than throwing on the first one, so a submitter gets one complete correction list.

`checkSubmission(payload, {resolveUrl, dataset})` runs the published bar and returns `{status, checks}` where each check is `{id, status, message}` and a check's status is `pass`, `fail`, `warn`, or `unknown`. The overall status is `blocked` if any check failed, `incomplete` if any check is unknown with no outright failure, and `pass` otherwise. The three states exist because an unreachable host at check time is not evidence of a dead link: `incomplete` must not read as a rejection, and must not read as a clean pass either. The URL resolver and the dataset are both parameters, so every rule is unit-testable without a network or a 1 MB fixture.

`resolveUrl(url)` resolves to the tri-state `ok`, `missing`, or `unknown` rather than throwing, so callers never distinguish a dead link from a transport failure by catching exceptions. The default implementation maps 2xx to `ok`, 4xx to `missing`, and 5xx, timeouts, and transport errors to `unknown`.

`buildPendingRecord(payload, {nextPos, submittedOn, issue, author})` returns a schema-valid community pending record. Position, date, originating issue, and issue author all arrive as parameters rather than being read from the environment, so the function is deterministic and its tests need no clock control.

The form-to-record mapping is fixed and total, so no field is left to interpretation at implementation time:

| Record field | Source |
|---|---|
| `pos` | injected `nextPos` |
| `title`, `byline`, `url` | same-named form fields, trimmed |
| `uploaded` | the form's `published` field |
| `pages` | the form's `length` field; blank maps to `null` |
| `type` | `compilation` when the compilation checkbox is ticked, otherwise `original` |
| `text_available` | the form's text-availability field |
| `source_corpus` | literal `community` |
| `review_status` | literal `pending` |
| `submission.platform` | the form's platform dropdown |
| `submission.submitted_by` | the issue author's handle, or `anonymous` when the attribution field requests it |
| `submission.issue`, `submission.archive_url` | the issue URL and the form's `archive_url` |
| `submission.submitted_on` | injected `submittedOn` |

The one-line thesis is a gate check and an aid to the maintainer's scope call, not a record field. It is not stored, because a pending record carries no `summary` and inventing one would put an unreviewed characterization into the dataset.

The workflows contain no logic beyond wiring these three functions to GitHub's API.

### `.github/ISSUE_TEMPLATE/submit-dd.yml`

Fields: title, byline, url, archive_url, published date, platform dropdown, length in pages (blank for non-paginated sources), a compilation checkbox, one-line thesis, text availability, a "related existing record" free-text field for self-declared duplicates, an attribution preference, and a required copyright acknowledgement checkbox. Labeled `submission`, titled `[Submission]: `, matching the concision of the two existing forms.

Two separate contracts run through this file, and conflating them is the likeliest way to break the feature silently. GitHub renders a submitted issue body as `### Label` headings followed by values — the field *identifiers do not appear in the body at all*. So `parseSubmissionIssue` keys off the **labels**, while the phase-two web form builds its prefilled-issue URL from the **identifiers**. Renaming a label breaks parsing; renaming an identifier breaks the web form. Both are public contracts and the template carries a comment saying so.

Unanswered optional fields render as the literal `_No response_`, which the parser treats as absence rather than as a value.

### `.github/workflows/submission-check.yml`

Triggers on `issues` `opened` and `edited`, filtered to the `submission` label. Runs parse and check, comments the checklist, and applies `submission:passing`, `submission:failing`, or `submission:unverified` to match the three overall states. Requires `issues: write` and nothing more.

### `.github/workflows/submission-open-pr.yml`

Triggers on `issues` `labeled`, and runs only when the applied label is `accepted` and the labeling actor holds write access, determined from the event's `author_association` being `OWNER`, `MEMBER`, or `COLLABORATOR`. Re-runs the check as a guard, computes `nextPos` as one above the highest `pos` in `data/master.json`, appends the record, and opens a pull request referencing the issue. Requires `contents: write` and `pull-requests: write`, scoped to this workflow alone.

It opens a pull request rather than committing to `main`, so the existing CI job validates the record and CODEOWNERS review still applies. No bot writes to the canonical dataset unreviewed.

### `scripts/validate-repository.mjs`

The current check — exactly 250 records with `pos` equal to index plus one, applied identically to both datasets — splits in two.

The baseline keeps the existing rule: exactly 250 records, `pos` 1 through 250 complete. It is hash-locked and must never grow.

`data/master.json` gains three rules. Its first 250 records must still be positions 1 through 250 in order, and none of them may carry `source_corpus` — that is what stops a community record from occupying a preserved slot. Community records must begin at 251 and be contiguous with no gaps. No `pos` may repeat.

The preserved block is deliberately **not** required to deep-equal the baseline. `master.json` is the evolving dataset: accepted disputes, corrections, and author replies change it, and three records already diverge from the baseline by carrying `validity_rating_original` from the August 13, 2026 adjudication. A deep-equal rule would freeze the file and break the governance workflow this repository exists to serve. Byte-level provenance is guaranteed where it belongs — by the SHA-256 pin on `data/original-master.json` in `tests/repository.test.mjs`, which is what proves the launch state.

### Documentation

`CONTRIBUTING.md` gains a "Submit a new DD" section stating the seven mechanical checks verbatim, the single discretionary scope test, the four lifecycle states, and the fact that pending records are unrated. It also states that a submitted work's rating, once applied, uses the existing dispute path.

`README.md` gains submission alongside "Dispute a rating", an updated provenance paragraph explaining that `master.json` now holds the preserved 250 plus a community block while `original-master.json` remains the launch-state proof, and an explicit sentence that **pending means unrated, not rated zero**. Without that sentence a reader scanning the validity distribution will read an absent rating as a failing one.

`harness/README.md` gains a note that community records from non-FlipHTML5 sources require manual text capture, that the capture method and date must be recorded, and that promoting a pending record requires populating `review_provenance`.

## Error Handling

A network failure or timeout during URL or archive resolution reports `unknown`, never `fail`, producing an overall `incomplete` rather than a rejection. An unreachable host at check time is not evidence that a link is dead. The check re-runs when the issue is edited, and a maintainer may accept an `incomplete` submission at their discretion; only `blocked` stops the pull request workflow.

A malformed or hand-written issue body returns a structured list of every missing field. The workflow comments that list. It does not crash, and it does not stop at the first problem.

Two accepted issues can both compute `nextPos` as 251. The second pull request fails the contiguity and uniqueness rules in CI. The fix is a rebase, documented in CONTRIBUTING.md rather than engineered around; the collision is rare and the failure is loud.

A submitter who pastes the full text of a copyrighted work into an issue is handled by maintainer redaction. The template warns against it and the acknowledgement checkbox records the warning. This is a policy control, not a code control.

An `accepted` label applied by an account without write access is ignored by the pull request workflow.

## Testing

Unit tests in `tests/submission.test.mjs` cover parsing (well-formed bodies, each missing required field, surrounding whitespace, unicode in titles and bylines, unexpected extra sections), checking (each of the seven rules passing and failing, an injected resolver returning success, failure, and timeout, duplicate detection across scheme differences, trailing slashes, and tracking parameters, and the title-and-byline near-match warning), and record construction (resulting shape validates against the schema, `pos` assignment, injected date stamping).

Schema tests extend `tests/schema.test.mjs`: a community pending record validates, a community reviewed record validates, a record with `pos` at or below 250 carrying a `submission` block is rejected, a record with `pos` at or above 251 lacking `source_corpus` is rejected, a community reviewed record lacking `review_provenance` is rejected, `pages: null` is accepted on a community record and rejected on an original one, and `source_corpus: "original_250"` is not a valid value anywhere.

Repository tests extend `tests/repository.test.mjs` for the split invariants: baseline still exactly 250, master's preserved block still positions 1 through 250 in order, a gap in the community block fails, a duplicate `pos` fails, and a `source_corpus` inside the first 250 fails.

`tests/repository.test.mjs` currently asserts that the canonical dataset holds exactly 250 records. That assertion changes as a direct and intended consequence of this design. Every other existing test must continue to pass unmodified; any other test requiring a change is a signal that this design has broken an invariant it did not intend to.

## Phase Two Note

The justthebros.co form needs no backend. It can collect the same fields client-side and build a GitHub prefilled-issue URL against `submit-dd.yml`, landing the reader on a populated issue they submit under their own account. That keeps attribution honest, adds no token storage, and adds no spam surface beyond what GitHub already handles. This is recorded here only because it is the reason the issue template's field identifiers are treated as a contract.
