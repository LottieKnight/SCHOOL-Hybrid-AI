// Shared (client + server safe) helpers for the study assistant's file
// attachment flow. Users can attach an image or PDF of their notes; the file
// is sent to /api/study-assistant/extract, which returns readable text. That
// text is then folded into the `material` string the assistant already expects.

// Keep the extracted text bounded so a large scan does not balloon the request
// body. The assistant route truncates to 8000 chars anyway, but trimming here
// keeps the payload (and the user-visible preview) reasonable.
export const STUDY_ATTACHMENT_MAX_TEXT_LENGTH = 12000;

export function clampExtractedText(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= STUDY_ATTACHMENT_MAX_TEXT_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, STUDY_ATTACHMENT_MAX_TEXT_LENGTH).trim();
}

/**
 * Combine the student's typed prompt with text extracted from an attached file
 * into a single `material` string for the study assistant.
 *
 * - Prompt only: the prompt is used as-is.
 * - Attachment only: the extracted text becomes the material.
 * - Both: the prompt leads, with the extracted text labelled below it so the
 *   model treats the question as the instruction and the file as the source.
 */
export function composeStudyMaterial(prompt: string, extractedText: string, fileName?: string) {
  const trimmedPrompt = prompt.trim();
  const trimmedText = clampExtractedText(extractedText);

  if (!trimmedText) {
    return trimmedPrompt;
  }

  if (!trimmedPrompt) {
    return trimmedText;
  }

  const label = fileName?.trim() ? `Material from ${fileName.trim()}` : "Attached material";
  return `${trimmedPrompt}\n\n${label}:\n${trimmedText}`;
}
