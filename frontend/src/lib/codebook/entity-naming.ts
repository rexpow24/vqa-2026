/**
 * Group E naming reminders (features/e-naming-hint): the rules annotators check
 * before saving A/B, and the lines that follow from what they declared. Only
 * the dashcam rule can be checked from the cells; position needs the video, so
 * it is a reminder, never a check. Nothing here blocks a save.
 */
type Party = { key: string; cells: Record<string, unknown> };

const option = (value: unknown) =>
  value && typeof value === "object" && "option" in value ? String((value as { option: unknown }).option) : undefined;
const isDashcamCar = (party: Party) => option(party.cells.type) === "type.car" && option(party.cells.dashcam) === "dashcam.yes";

/** What to check, from guideline E (docs/guidelines/E-thuc-the.md). */
export const NAMING_RULES = [
  "Hai bên là cặp của va chạm đầu tiên; không có va chạm thì cặp của lần suýt va chạm đầu tiên.",
  "Xe ghi hình (ô tô có camera hành trình) thuộc cặp chính thì là A.",
  "Không có xe ghi hình: dừng ở khung đầu tiên cả hai bên cùng xuất hiện, bên trái là A; cùng một cột thì bên trên là A.",
  "Tên giữ nguyên cả video, kể cả khi hai bên đổi chỗ hoặc bị che.",
];

/** Lines that follow from the declared parties, for the annotator to look at again. */
export function namingChecks(parties: Party[]): string[] {
  const dashcams = parties.filter(isDashcamCar);
  if (dashcams.length > 1) {
    return ["Cả 2 bên đều chọn có camera hành trình, nhưng video chỉ có một xe ghi hình: bạn có chọn nhầm ô camera không?"];
  }
  if (dashcams.length === 1 && dashcams[0].key !== "A") {
    return [`Bên ${dashcams[0].key} là xe ghi hình (ô tô có camera hành trình). Xe ghi hình thuộc cặp chính thì là A: bạn có đặt nhầm tên không?`];
  }
  return [];
}
