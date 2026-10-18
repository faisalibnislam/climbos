/** Content languages ClimbOS writes in (names as the models expect them). */
export const CONTENT_LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Polish", "Swedish", "Danish", "Norwegian", "Finnish",
  "Turkish", "Arabic", "Hebrew", "Hindi", "Bengali", "Urdu", "Indonesian", "Malay", "Vietnamese", "Thai", "Japanese", "Korean",
  "Chinese (Simplified)", "Chinese (Traditional)", "Greek", "Czech", "Romanian", "Hungarian", "Ukrainian", "Russian",
] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
export function isContentLanguage(s: string): s is ContentLanguage {
  return (CONTENT_LANGUAGES as readonly string[]).includes(s);
}
