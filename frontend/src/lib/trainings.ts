/**
 * Training videos an annotator must watch before labelling (features/c-training-gate,
 * features/welcome-gate). The id carries a version: a new video gets a new id,
 * so everyone watches it again.
 */
export type Training = { id: string; video: string; title: string };

/** The welcome video about the app: required before labelling anything, not tied to a group. */
export const WELCOME_TRAINING: Training = { id: "WELCOME-v1", video: "welcome", title: "Video welcome: giới thiệu ứng dụng gán nhãn" };

const TRAININGS: Record<string, Training> = {
  C: { id: "C-v1", video: "C-training-full", title: "Video hướng dẫn nhóm C: kiểu xung đột và cách chọn chủ thể" },
  E: { id: "E-v1", video: "E-training-full", title: "Video hướng dẫn nhóm E: chọn bên, đặt tên A/B và chọn loại xe" },
};

/** The sections of the /huong-dan page, in order. */
export const GUIDE_TRAININGS: { heading: string; training: Training }[] = [
  { heading: "Video welcome (bắt buộc)", training: WELCOME_TRAINING },
  { heading: "Hướng dẫn nhóm C", training: TRAININGS.C },
  { heading: "Hướng dẫn nhóm E", training: TRAININGS.E },
];

/** The training a group requires, or null when it requires none. */
export function requiredTraining(qgroup: string): Training | null {
  return Object.hasOwn(TRAININGS, qgroup) ? TRAININGS[qgroup] : null;
}

/** Whether a training id is one this app knows. */
export function isTrainingId(id: string): boolean {
  return id === WELCOME_TRAINING.id || Object.values(TRAININGS).some((training) => training.id === id);
}

/** The trainings still missing before a save of this group: the welcome video first, then the group's own. */
export function missingForSave(qgroup: string, done: readonly string[]): Training[] {
  const group = requiredTraining(qgroup);
  return [WELCOME_TRAINING, ...(group ? [group] : [])].filter((training) => !done.includes(training.id));
}
