// src/services/TextModerationService.ts

const BadWordsNode = require('bad-words');

// FIX: Explicitly look for '.Filter' or '.default'
// This handles the mismatch that caused "constructor is not callable"
const FilterConstructor = BadWordsNode.Filter || BadWordsNode.default || BadWordsNode;

let filter: any;

try {
  filter = new FilterConstructor();
} catch (e) {
  console.warn("TextModerationService: Failed to initialize bad-words library. Using fallback.");
  // Fallback dummy filter to prevent app crash
  filter = {
    isProfane: (t: string) => false,
    clean: (t: string) => t
  };
}

export const TextModerationService = {
  /**
   * Returns true if the text contains profanity
   */
  hasProfanity: (text: string): boolean => {
    if (!text) return false;
    try {
        return filter.isProfane(text);
    } catch (e) {
        return false;
    }
  },

  /**
   * Returns a clean version of the text (e.g., "Don't be a ****")
   */
  cleanText: (text: string): string => {
    if (!text) return "";
    try {
        return filter.clean(text);
    } catch (e) {
        return text;
    }
  },

  /**
   * Validates profile text fields
   * Returns error message if invalid, null if valid
   */
  validateProfileFields: (displayName: string, bio: string): string | null => {
    if (TextModerationService.hasProfanity(displayName)) {
      return "Please choose an appropriate Display Name.";
    }
    if (TextModerationService.hasProfanity(bio)) {
      return "Your bio contains inappropriate language.";
    }
    return null;
  }
};