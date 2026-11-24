// The subject role of each C conflict type, for asking the C subject in the
// words of the chosen K ("Bên nào là xe đổi làn?") instead of the abstract
// "Chủ thể" (features/c-role-question). Form text only: the stored slots and
// the frozen codebooks do not change.
//
// Source: annotator-guidelines/tham-khao-C/kieu-xung-dot.html, array TYPES,
// the 4th element of each row; c-roles.test.ts pins these values to that file.

export const C_SUBJECT_ROLES: Readonly<Record<string, string>> = {
  "conflict_type.k01": "xe phía sau",
  "conflict_type.k02": "xe phía trước",
  "conflict_type.k03": "xe phía sau",
  "conflict_type.k04": "xe đổi làn",
  "conflict_type.k05": "xe vượt hoặc len",
  "conflict_type.k06": "xe rẽ",
  "conflict_type.k07": "xe đỗ hoặc xe ra",
  "conflict_type.k08": "xe lấn làn",
  "conflict_type.k09": "xe đi ngược chiều",
  "conflict_type.k10": "xe rẽ",
  "conflict_type.k11": "bên vào giao lộ sau",
  "conflict_type.k12": "xe từ đường nhánh",
  "conflict_type.k13": "xe quay đầu",
  "conflict_type.k14": "xe băng ngang",
  "conflict_type.k15": "người đi bộ",
  "conflict_type.k16": "động vật",
  "conflict_type.k17": "xe lùi",
  "conflict_type.k18": "xe trượt, văng",
};

/** The C subject question for a conflict type, or null (no K, or "không rõ") to keep "Chủ thể". */
export function subjectRoleLabel(conflictType: string | undefined): string | null {
  if (!conflictType || !Object.hasOwn(C_SUBJECT_ROLES, conflictType)) return null;
  return `Bên nào là ${C_SUBJECT_ROLES[conflictType]}?`;
}
