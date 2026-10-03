"""The nine drafting prompts, one per question group of `docs/DC.pdf`.

One group per request, never several. Measured 2026-10-03: asking a 2B model for
four or more groups at once makes it echo the question list back instead of
answering it, or loop a sentence until the budget runs out. Nine separate
requests cost almost nothing extra because llama.cpp's prefix cache serves the
2 700 image tokens again for ~57 ms -- what costs time is tokens generated, and
the grouped configurations were only faster because they skipped work.

The prompts are Vietnamese because the dataset is Vietnamese. They must carry
full diacritics: a prompt written without them ("anh sang") made the model reply
"Không có thông tin về anh sang trong ảnh" -- it could not read the word.

`max_tokens` is per group rather than shared. Narrative needs room to tell a
sequence; Outcome rarely needs half of it. A single shared budget either starves
N or lets the short groups ramble until they hit it.
"""

from __future__ import annotations

from typing import NamedTuple

# Bump when any prompt text below changes. Stored on every draft row, so drafts
# written by two different versions stay distinguishable instead of silently
# mixing -- and so a prompt can be improved without invalidating what exists.
PROMPT_VERSION = 2

PROMPT_NAME = "vnta-draft-9groups"

# Sampler-level guard against the degenerate loop described below. Prompt wording
# alone did not stop it: v1 already said "ngắn gọn" and group E still restated one
# clause seven times.
REPEAT_PENALTY = 1.15

# Prepended to every question. Each rule exists because of a failure that was
# observed, not as general advice:
#
#   v1 -> v2, after reading real output in the annotation UI:
#   - the anti-repetition rule, because group E emitted "Một phương tiện khác,
#     có thể là xe tải, đang di chuyển trên đường." seven consecutive times;
#   - the "một câu cho mỗi ý" rule, because the same loop presented itself as a
#     bullet list, which made it look deliberate rather than stuck;
#   - the hedging ban, because v1 output was mostly "có thể là" / "có vẻ".
#
# KHÔNG QUAN SÁT ĐƯỢC is kept and strengthened. It is the sentence that lets the
# model decline, and it maps one-to-one onto the NOT_ANSWERABLE verdict in
# vqa/annotations.py -- the annotator confirms a refusal instead of inventing a
# rejection reason for a hallucinated answer.
PREAMBLE = (
    "Bạn đang xem {n} khung hình trích đều từ một đoạn video giao thông Việt Nam, "
    "theo thứ tự thời gian. Hãy trả lời câu hỏi dựa CHỈ trên những gì nhìn thấy "
    "trong các khung hình đó.\n"
    "Quy tắc:\n"
    "- Trả lời ngắn gọn, đi thẳng vào nội dung, không mở bài, không kết luận thừa.\n"
    "- Chỉ mô tả điều quan sát được. Không suy đoán điều không nhìn thấy.\n"
    "- TUYỆT ĐỐI không lặp lại một ý đã nêu. Mỗi ý chỉ viết đúng một lần.\n"
    "- Nếu chỉ nhìn thấy một phương tiện thì nói một phương tiện. Không liệt kê "
    "thêm cho dài.\n"
    "- Hạn chế dùng 'có thể là', 'có vẻ'. Nếu không chắc thì nói thẳng là "
    "không rõ.\n"
    "- Nếu các khung hình không chứa thông tin để trả lời, hãy viết đúng một câu: "
    "KHÔNG QUAN SÁT ĐƯỢC.\n\n"
    "Câu hỏi: "
)


class Group(NamedTuple):
    code: str
    name: str
    question: str
    max_tokens: int


GROUPS: tuple[Group, ...] = (
    Group("S", "Bối cảnh",
          "Bối cảnh của đoạn video ra sao? Nêu thời tiết, điều kiện ánh sáng, "
          "loại đường và tình trạng mặt đường.", 260),
    Group("E", "Thực thể",
          "Những phương tiện và người tham gia giao thông nào có liên quan? "
          "Nêu loại phương tiện và màu sắc của từng bên.", 260),
    Group("N", "Diễn biến",
          "Tóm tắt toàn bộ diễn biến sự kiện trong video theo đúng thứ tự thời gian, "
          "từ lúc bắt đầu đến lúc kết thúc.", 600),
    Group("C", "Nguyên nhân",
          "Nguyên nhân trực tiếp dẫn đến va chạm là gì, hoặc hành động nào xảy ra "
          "ngay trước va chạm?", 380),
    Group("V", "Vi phạm",
          "Có hành vi vi phạm quy tắc giao thông nào quan sát được không? "
          "Nếu có, nêu rõ bên nào vi phạm và vi phạm điều gì.", 340),
    Group("O", "Hậu quả",
          "Hậu quả của va chạm là gì? Nêu mức độ hư hỏng phương tiện và tình trạng "
          "người liên quan, chỉ trong phạm vi quan sát được.", 300),
    Group("R", "Ứng xử",
          "Sau sự việc, các bên liên quan hành xử ra sao: dừng lại, bỏ chạy, "
          "hay hỗ trợ nhau?", 300),
    Group("Attr", "Quy trách nhiệm",
          "Dựa trên bằng chứng thị giác trong các khung hình, bên nào đóng vai trò "
          "chính dẫn đến va chạm, và vì sao?", 380),
    Group("Prev", "Phòng tránh",
          "Người điều khiển phương tiện lẽ ra nên làm gì để phòng tránh va chạm này?",
          380),
)

BY_CODE = {g.code: g for g in GROUPS}


def render(group: Group, n_frames: int) -> str:
    """The full prompt text sent for one group."""
    return PREAMBLE.format(n=n_frames) + group.question


# ── judge prompts (docs/DC.pdf, "Xây dựng prompt đánh giá") ───────────────
#
# Not used yet -- the judge runs after a ground truth exists, which is what the
# annotation UI is currently producing. They live here so the prompt registry
# shows the whole inventory in one place, and so the grouping decision below is
# written down rather than re-derived later.
#
# DC.pdf is explicit that the nine groups do NOT share one judge prompt: an
# answer in group S is scored against a detailed reference, while group Prev
# legitimately has several right answers and must earn partial credit. One
# shared rubric would mark correct Prev answers wrong and inflate Attr.

JUDGE_VERSION = 1

JUDGE_NAME = "vnta-judge-4rubrics"


class Judge(NamedTuple):
    key: str
    groups: tuple[str, ...]
    title: str
    rubric: str


JUDGES: tuple[Judge, ...] = (
    Judge("J1", ("S", "E", "N", "O"), "Chấm chặt theo đáp án chuẩn",
          "Đáp án chuẩn đã đủ chi tiết. Chỉ cần so xem ý nghĩa của câu trả lời "
          "có trùng với đáp án chuẩn không. Khác cách diễn đạt nhưng cùng nội "
          "dung thì vẫn tính đúng. Thiếu hoặc sai một chi tiết quan sát được "
          "thì trừ điểm."),
    Judge("J2", ("C", "V", "R"), "Kiểm chuỗi nhân quả và thứ tự thời gian",
          "Chấm theo việc câu trả lời có dựng đúng chuỗi nguyên nhân - kết quả "
          "và đúng thứ tự thời gian của các sự kiện hay không. Đúng kết luận "
          "nhưng sai chuỗi dẫn tới kết luận thì không được điểm tối đa."),
    Judge("J3", ("Attr",), "Chấm theo đáp án đa số",
          "Chấm theo đáp án được đa số người gán nhãn chọn. Chấp nhận các cách "
          "diễn đạt khác nhau nếu cùng chỉ ra đúng bên đóng vai trò chính và "
          "đúng hành vi dẫn đến va chạm."),
    Judge("J4", ("Prev",), "Nhiều đáp án đúng, cho điểm từng phần",
          "Câu hỏi này có nhiều đáp án đúng. Chấp nhận mọi biện pháp phòng tránh "
          "hợp lý và khả thi trong tình huống. Trả lời đúng một phần thì được "
          "điểm một phần, không đánh trượt."),
)

JUDGE_BY_GROUP = {g: j for j in JUDGES for g in j.groups}
