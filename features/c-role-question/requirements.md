# C role question - requirements

## Decision (owner, 2026-11-24)

Group C's form asks the conflict type K before the subject.
The subject is asked in the words of the chosen K instead of the abstract "Chủ thể", for example "Bên nào là xe đổi làn?" after K04, "Bên nào là xe từ đường nhánh?" after K12, "Bên nào là xe phía sau?" after K01 and "Bên nào là người đi bộ?" after K15.
Basis: SHRP 2 codes the precipitating event as an action of a party (Hankey, Perez & McClafferty 2016, VTTI), and dashcam datasets (DADA-2000, MM-AU) describe accidents by participant-relation categories, not by an abstract subject.

## Requirements

1. The C form shows its fields in this order: event type, conflict type (with its reference hint), action, subject, then the rest as before (object auto-filled, the two parties of "cả hai bên").
2. With "cả hai bên" the action stays one per party, after each party, as before.
3. The subject label is `Bên nào là <role>?`, where the role of each K comes from `annotator-guidelines/tham-khao-C/kieu-xung-dot.html` (array `TYPES`, 4th element), kept in `frontend/src/lib/codebook/c-roles.ts`.
4. With no K chosen yet, or with K "không rõ", the subject keeps today's label "Chủ thể" and today's note.
5. The subject options "cả hai bên" and "không rõ" stay exactly as today.
6. Changing K after the subject keeps the subject value and its auto-filled object; only the label changes.
7. Every existing cascade keeps working whatever the order of clicks: the object auto-fill from the subject, the two parties of "cả hai bên", the action filtered by K, and a K with one action taking it at once.

## Non-goals

The stored slots do not change: event_type, subject ({entity}, subject.both or subject.unclear), object, conflict_type, action and parties keep their shape and meaning.
The codebook JSON files are frozen and stay untouched.
Derived groups (V, Prev, R, O) and the C sentence templates do not change behaviour.
