
export interface GratitudePromptAnswer {
  question: string;
  answerText?: string;
  answerAudioUrl?: string; // Store as data URI or a path if files are handled
  transcribedText?: string;
  inputMethod?: 'text' | 'audio';
}

export interface JournalEntry {
  id: string;
  date: string; // ISO string format
  prompts: GratitudePromptAnswer[];
  tags: string[];
}

export interface Reminder {
  id: string;
  time: string; // "HH:MM"
  days: number[]; // 0 (Sunday) to 6 (Saturday)
  sound: string; // Name of sound or 'silent'
  enabled: boolean;
}

export type PromptSetType = 'fixed' | 'rotating' | 'hybrid';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  activePromptSet: PromptSetType;
  userName?: string; // Optional user name for personalization
  // Future settings can be added here
}

export interface FixedPrompts {
  type: 'fixed';
  questions: [string, string, string];
}

export interface RotatingPrompts {
  type: 'rotating';
  pool: string[]; // Pool of questions to pick from
}

export interface HybridPrompts {
  type: 'hybrid';
  fixedQuestions: [string, string];
  rotatingPool: string[];
}

export type PromptsConfig = FixedPrompts | RotatingPrompts | HybridPrompts;
