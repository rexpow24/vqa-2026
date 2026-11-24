/**
 * Training videos an annotator must watch before labelling a group
 * (features/c-training-gate). The id carries a version: a new video gets a new
 * id, so everyone watches it again.
 */
export type Training = { id: string; video: string; title: string };

const TRAININGS: Record<string, Training> = {
  C: { id: "C-v1", video: "C-training-full", title: "Video hướng dẫn nhóm C: kiểu xung đột và cách chọn chủ thể" },
  E: { id: "E-v1", video: "E-training-full", title: "Video hướng dẫn nhóm E: chọn bên, đặt tên A/B và chọn loại xe" },
};

/** The training a group requires, or null when it requires none. */
export function requiredTraining(qgroup: string): Training | null {
  return Object.hasOwn(TRAININGS, qgroup) ? TRAININGS[qgroup] : null;
}

/** Whether a training id is one this app knows. */
export function isTrainingId(id: string): boolean {
  return Object.values(TRAININGS).some((training) => training.id === id);
}
