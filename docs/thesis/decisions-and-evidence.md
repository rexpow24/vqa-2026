# Decisions and evidence map

This page is a navigation aid, not a replacement for the dated decision history in feature documents.
Use the linked source as the authority when a summary here and the source differ.

## Annotation scheme and codebooks

- The phased migration from free text to versioned, structured codebooks, including the separation of codebook-building data from later agreement measurement, is documented in the [codebook migration plan](../../features/codebook-multiple-choice/plan.md).
- Group-level mapping coverage and accepted exceptions are reported in [P1 results](../../features/codebook-multiple-choice/p1-results.md).
- The multiple-choice V taxonomy and its stated source review status are in [v-taxonomy.md](../../features/codebook-multiple-choice/v-taxonomy.md).
- The slot storage and validation design is documented in the [slot data model](../../features/slot-data-model/overview.md) and its [architecture](../../features/slot-data-model/architecture.md).

## Agreement measurement

- The project plan describes agreement by coded field and names nominal Krippendorff's alpha, with thresholds and sample-size assumptions recorded alongside their evidence status: [plan, P5-P7 and evidence review](../../features/codebook-multiple-choice/plan.md).
- The same plan labels some choices as proposals, secondary-source summaries, or lacking a source. Preserve those qualifications in thesis writing rather than presenting every threshold as an established standard.
- The current scripts and reports are implementation artifacts: [iaa_round.py](../../scripts/iaa_round.py) and [audit_slot_disagreements.py](../../scripts/audit_slot_disagreements.py).
- The 2026-11-27 reporting decision is to publish nominal Krippendorff's alpha for each coded field as the primary result and nominal alpha for the exact whole-group answer as a supplementary result: [decision and C.K calibration proposal](../research/c-k-uncertainty-calibration-2026-11-27.md).
- Pooled per-cell group alpha is a third statistic and does not replace either result; the decision is not evidence that existing scripts already produce and verify both outputs.

## Animal-related V labels

- The legal basis, official source links, and limits on assigning a responsible person from video evidence are recorded in [v-animal-traffic-law.md](../research/v-animal-traffic-law.md).
- The corresponding annotation rule is in the [V guideline](../guidelines/V-vi-pham.md), while the codebook state is versioned in [`codebook/`](../../codebook/).

## Evidence and reproducibility notes

- Keep input data version, codebook version, command-line options, and output directory with each reported agreement result.
- Distinguish decisions grounded in a primary source from decisions based on a secondary summary or internal project convention; the [codebook plan's evidence review](../../features/codebook-multiple-choice/plan.md) already tracks this distinction.
- The administrative and product feature folders record implementation rationale and acceptance evidence. They are useful provenance but are not substitutes for literature citations.
