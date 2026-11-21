# VQA-VN-Traffic thesis workspace

## Quy tắc N tự tổng hợp

Trong bài gán nhãn dạng ô, hệ thống tự tạo nội dung nhóm N sau khi cả tám nhóm S, E, C, V, O, R, Attr và Prev đã được lưu.
N ghép câu trả lời đã lưu theo thứ tự nhóm và được đánh dấu hoàn tất tự động.
N là dẫn xuất từ các nhóm đó, vì vậy không được tính như một nhãn độc lập trong phân tích độ đồng thuận.
Nội dung dẫn xuất được lưu riêng trong `qa_annotations.generated_answer`; câu trả lời gốc từ mô hình không bị ghi đè.

This folder is the starting point for finding project material that may support the thesis.
The documents linked here remain the authoritative sources; this index does not replace their history or operational locations.

## Suggested reading order

1. [Project design and codebook migration plan](../../features/codebook-multiple-choice/plan.md) describes the motivation, phases, measurement thresholds, risks, and the evidence status of methodological choices.
2. [Codebook mapping results](../../features/codebook-multiple-choice/p1-results.md) reports the P1 mapping coverage by group and field.
3. [Slot data model overview](../../features/slot-data-model/overview.md) and [architecture](../../features/slot-data-model/architecture.md) describe how structured answers are stored and validated.
4. [Group annotation guidelines](../guidelines/) define the annotation scheme. The annotator-facing copies are in [`annotator-guidelines/`](../../annotator-guidelines/).
5. [Animal and traffic-law research note](../research/v-animal-traffic-law.md) records the legal basis and limits for assigning violation labels when animals are involved.
6. [C, V, and Prev label-dependency research note](../research/label-dependencies-c-v-prev.md) summarizes the evidence and limits for deriving violations and preventive actions from other annotation groups.
7. [V and Prev derivation evidence](../research/v-prev-derivation-evidence.md) records the legal and research basis for the conservative C-to-V and V-to-Prev rules.
8. [Decision and evidence map](decisions-and-evidence.md) points to decision records and records unresolved or implementation-dependent details.

## Topic map

| Thesis topic | Main source | Supporting sources |
| --- | --- | --- |
| Research pipeline and study phases | [Codebook migration plan](../../features/codebook-multiple-choice/plan.md) | [Project architecture](../../architecture.md), [project README](../../README.md) |
| Questions and annotation groups | [Questions by group](../../csvs/questions_by_qgroup.md) | [Question split](../../csvs/questions_split.md), [group guidelines](../guidelines/) |
| Codebook construction and coverage | [P1 results](../../features/codebook-multiple-choice/p1-results.md) | [Codebook plan](../../features/codebook-multiple-choice/plan.md), [`codebook/`](../../codebook/) |
| Inter-annotator agreement | [Codebook plan, measurement and thresholds](../../features/codebook-multiple-choice/plan.md) | [Agreement queue design](../../features/annotator-agreement-queue/overview.md), [agreement analysis script](../../scripts/iaa_round.py), [slot disagreement audit](../../scripts/audit_slot_disagreements.py) |
| Structured annotation storage | [Slot data model overview](../../features/slot-data-model/overview.md) | [Slot data model architecture](../../features/slot-data-model/architecture.md), [answer adjudication](../../features/answer-adjudication/overview.md) |
| Violation taxonomy | [V taxonomy proposal](../../features/codebook-multiple-choice/v-taxonomy.md) | [V guideline](../guidelines/V-vi-pham.md), [MMUCC comparison](../../annotator-guidelines/tham-khao-V/doi-chieu-MMUCC.md) |
| Animal-related violation decisions | [Legal research note](../research/v-animal-traffic-law.md) | [V/Prev derivation evidence](../research/v-prev-derivation-evidence.md), [V.v8](../../codebook/V.v8.json) |
| Dependencies among C, V, and Prev labels | [V/Prev derivation evidence](../research/v-prev-derivation-evidence.md) | [C/V/Prev research note](../research/label-dependencies-c-v-prev.md), [V.v8](../../codebook/V.v8.json), [Prev.v3](../../codebook/Prev.v3.json) |
| Study protocol source document | [DC.pdf](../DC.pdf) | Design implications are cross-referenced in [draft annotation requirements](../../features/qa-draft-annotation/requirements.md) |

## Keeping this workspace useful

Add thesis-facing summaries and citation records under `docs/thesis/`.
Keep implementation specifications in `features/`, legal and literature reviews in `docs/research/`, codebooks in `codebook/`, and annotator instructions in their existing directories.
When a thesis claim relies on a decision in a feature document, cite that source directly and record whether it is a user-approved decision, a project proposal, or an implementation detail.

The audit CSVs and generated analysis directories are working outputs, not canonical documentation.
Their paths and contents may change between runs; preserve the command, input data version, and output version when preparing a thesis result.
