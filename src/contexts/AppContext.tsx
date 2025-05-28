
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { JournalEntry, Reminder, AppSettings, PromptSetType, PromptsConfig } from '@/lib/types';
import { LOCAL_STORAGE_KEY_JOURNAL_ENTRIES, LOCAL_STORAGE_KEY_REMINDERS, LOCAL_STORAGE_KEY_APP_SETTINGS } from '@/lib/constants';
import { DEFAULT_PROMPT_CONFIG, FIXED_QUESTIONS_SET, ROTATING_QUESTIONS_POOL, HYBRID_QUESTIONS_SET } from '@/lib/promptsData';

interface AppState {
  journalEntries: JournalEntry[];
  reminders: Reminder[];
  settings: AppSettings;
  currentPromptsConfig: PromptsConfig;
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'ADD_JOURNAL_ENTRY'; payload: JournalEntry }
  | { type: 'UPDATE_JOURNAL_ENTRY'; payload: JournalEntry }
  | { type: 'DELETE_JOURNAL_ENTRY'; payload: string } // id
  | { type: 'ADD_REMINDER'; payload: Reminder }
  | { type: 'UPDATE_REMINDER'; payload: Reminder }
  | { type: 'DELETE_REMINDER'; payload: string } // id
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_PROMPT_SET_TYPE'; payload: PromptSetType };

const initialState: AppState = {
  journalEntries: [],
  reminders: [],
  settings: {
    theme: 'system',
    activePromptSet: 'fixed',
  },
  currentPromptsConfig: DEFAULT_PROMPT_CONFIG,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'ADD_JOURNAL_ENTRY':
      return { ...state, journalEntries: [...state.journalEntries, action.payload] };
    case 'UPDATE_JOURNAL_ENTRY':
      return {
        ...state,
        journalEntries: state.journalEntries.map(entry =>
          entry.id === action.payload.id ? action.payload : entry
        ),
      };
    case 'DELETE_JOURNAL_ENTRY':
      return {
        ...state,
        journalEntries: state.journalEntries.filter(entry => entry.id !== action.payload),
      };
    case 'ADD_REMINDER':
      return { ...state, reminders: [...state.reminders, action.payload] };
    case 'UPDATE_REMINDER':
      return {
        ...state,
        reminders: state.reminders.map(reminder =>
          reminder.id === action.payload.id ? action.payload : reminder
        ),
      };
    case 'DELETE_REMINDER':
      return {
        ...state,
        reminders: state.reminders.filter(reminder => reminder.id !== action.payload),
      };
    case 'UPDATE_SETTINGS':
      const newSettings = { ...state.settings, ...action.payload };
      let newPromptsConfig = state.currentPromptsConfig;
      if (action.payload.activePromptSet && action.payload.activePromptSet !== state.settings.activePromptSet) {
        newPromptsConfig = getPromptsConfigByType(action.payload.activePromptSet);
      }
      return { ...state, settings: newSettings, currentPromptsConfig: newPromptsConfig };
    case 'SET_PROMPT_SET_TYPE':
      const promptsConfig = getPromptsConfigByType(action.payload);
      return {
        ...state,
        settings: { ...state.settings, activePromptSet: action.payload },
        currentPromptsConfig: promptsConfig,
      };
    default:
      return state;
  }
}

function getPromptsConfigByType(type: PromptSetType): PromptsConfig {
  switch (type) {
    case 'fixed': return FIXED_QUESTIONS_SET;
    case 'rotating': return { type: 'rotating', pool: ROTATING_QUESTIONS_POOL };
    case 'hybrid': return HYBRID_QUESTIONS_SET;
    default: return DEFAULT_PROMPT_CONFIG;
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    // Load initial state from localStorage
    if (typeof window !== 'undefined') {
      const storedEntries = localStorage.getItem(LOCAL_STORAGE_KEY_JOURNAL_ENTRIES);
      const storedReminders = localStorage.getItem(LOCAL_STORAGE_KEY_REMINDERS);
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY_APP_SETTINGS);

      const payload: Partial<AppState> = {};
      if (storedEntries) payload.journalEntries = JSON.parse(storedEntries);
      if (storedReminders) payload.reminders = JSON.parse(storedReminders);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        payload.settings = parsedSettings;
        payload.currentPromptsConfig = getPromptsConfigByType(parsedSettings.activePromptSet || 'fixed');
      } else {
        payload.currentPromptsConfig = getPromptsConfigByType(initialState.settings.activePromptSet);
      }
      
      dispatch({ type: 'LOAD_STATE', payload });
    }
  }, []);

  useEffect(() => {
    // Persist state to localStorage whenever it changes
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_JOURNAL_ENTRIES, JSON.stringify(state.journalEntries));
      localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(state.reminders));
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_SETTINGS, JSON.stringify(state.settings));
    }
  }, [state.journalEntries, state.reminders, state.settings]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
