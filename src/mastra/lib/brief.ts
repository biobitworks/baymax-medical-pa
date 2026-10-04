// Dependency-free helpers shared by the Mastra tools, the travel routes, and
// the frontend fallback.

export type BriefInput = {
  reason: string;
  medications?: string[];
  allergies?: string[];
  history?: string[];
  questions?: string[];
  /** Pre-formatted blocks (web advisories, activity data) placed before the questions. */
  extraSections?: string[];
};

export const DEFAULT_TRAVEL_CHECKLIST = [
  "Confirm remaining supply with your clinician",
  "Bring prescription and medication packaging",
  "Ask a local pharmacist about refill requirements",
  "Prepare a doctor brief",
];

export function formatDoctorBrief({
  reason,
  medications = [],
  allergies = [],
  history = [],
  questions = [],
  extraSections = [],
}: BriefInput): string {
  const list = (items: string[], fallback: string) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : fallback;

  return [
    "MY HEALTH BRIEF (review and complete before sharing)",
    "",
    `Reason for visit: ${reason}`,
    "",
    "Medications:",
    list(medications, "- [Add your prescribed medication and dose.]"),
    "",
    "Allergies:",
    list(allergies, "- Not yet confirmed."),
    "",
    "Relevant history:",
    list(history, "- Not yet confirmed."),
    ...extraSections,
    "",
    "Questions for the doctor:",
    list(questions, "- What records do you need?"),
  ].join("\n");
}
