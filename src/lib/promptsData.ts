import type { PromptsConfig } from './types';

export const FIXED_QUESTIONS_SET: PromptsConfig = {
  type: 'fixed',
  questions: [
    "Pelo que estou grato(a) hoje?",
    "O que aprendi ou percebi hoje que me fez bem?",
    "Qual foi um pequeno gesto de gentileza que presenciei ou fiz hoje?"
  ]
};

export const ROTATING_QUESTIONS_POOL: string[] = [
  "Qual foi um pequeno detalhe do dia que me trouxe alegria?",
  "Que desafio superei recentemente e agradeço por isso?",
  "Que parte do meu corpo/sentido estou grato(a) hoje?",
  "Qual memória boa voltou à minha mente hoje?",
  "Quem me inspirou ou me apoiou recentemente?",
  "Qual habilidade minha sou grato(a) por ter?",
  "O que na natureza me trouxe paz ou admiração hoje?",
  "Por qual conforto em minha vida sou grato(a) hoje?"
];

export const HYBRID_QUESTIONS_SET: PromptsConfig = {
  type: 'hybrid',
  fixedQuestions: [
    "Pelo que estou grato(a) hoje?",
    "O que aprendi ou percebi hoje que me fez bem?"
  ],
  rotatingPool: ROTATING_QUESTIONS_POOL.slice(0, 5) // Take a subset for hybrid
};

export const DEFAULT_PROMPT_CONFIG: PromptsConfig = FIXED_QUESTIONS_SET;

export function getDailyPrompts(config: PromptsConfig): string[] {
  switch (config.type) {
    case 'fixed':
      return config.questions;
    case 'rotating':
      // Simple rotation: pick 3 unique random questions
      const shuffled = [...config.pool].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 3);
    case 'hybrid':
      const rotatingShuffled = [...config.rotatingPool].sort(() => 0.5 - Math.random());
      return [...config.fixedQuestions, rotatingShuffled[0]];
    default:
      return FIXED_QUESTIONS_SET.questions;
  }
}
