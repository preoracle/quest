export interface Topic {
  id: string;
  display_name: string;
}

export interface Evaluation {
  score: number;
  gaps: string[];
  reasoning: string;
  inferred_concept_id: string | null;
  inferred_concept_confidence: number;
}

export interface SessionView {
  session_id: string;
  user_id: string;
  topic_id: string;
  topic_display: string;
  done: boolean;
  waiting_for_answer: boolean;
  focus: string | null;
  focus_scope: string | null;
  tutor_message: string | null;
  last_evaluation: Evaluation | null;
  summary: string | null;
  ended_at: string | null;
}

export interface MasteryItem {
  concept_id: string;
  topic: string;
  kind: string;
  name: string;
  score: number;
  score_1_to_5: number;
  num_evaluations: number;
}

export interface MasteryResponse {
  user_id: string;
  items: MasteryItem[];
}
