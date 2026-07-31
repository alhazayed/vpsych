export type UserRole = "therapist" | "admin";
export type SessionStatus = "active" | "completed" | "expired";
export type MessageRole = "user" | "assistant" | "system";

export type PreferredLanguage = "en" | "ar";

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
};

export type RubricItem = {
  id: string;
  label: string;
  weight: number;
  max: number;
};

export type Avatar = {
  id: string;
  name: string;
  disorder: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
  persona_prompt: string;
  ideal_guidelines: {
    session_goals?: string[];
    ideal_approach?: string;
  };
  rubric: RubricItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TherapySession = {
  id: string;
  therapist_id: string;
  avatar_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  max_duration_sec: number;
  created_at: string;
  avatars?: Avatar;
  profiles?: Profile;
};

export type SessionMessage = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type ScoreEntry = {
  id: string;
  label: string;
  score: number;
  max: number;
  weight: number;
  feedback: string;
};

export type SessionReport = {
  id: string;
  session_id: string;
  scores: {
    overall: number;
    items: ScoreEntry[];
  };
  narrative: string;
  excerpts: string[];
  created_at: string;
  sessions?: TherapySession;
};

export const MAX_SESSION_SECONDS = 40 * 60;
