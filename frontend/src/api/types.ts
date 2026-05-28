export interface Topic {
  id: string;
  display_name: string;
}

/** Rich catalog row from GET /topics */
export interface TopicCatalogItem {
  id: string;
  display_name: string;
  concept_count: number;
  preview_concepts: string[];
  hook: string;
  started: boolean;
  mastered_count: number;
  avg_score_1_to_5: number;
  due_count: number;
  last_studied_at: string | null;
  enrolled?: boolean;
  archived?: boolean;
  pinned?: boolean;
  user_created?: boolean;
  deletable?: boolean;
}

export interface TopicCatalogResponse {
  user_id: string;
  topics: TopicCatalogItem[];
}

export interface Evaluation {
  score: number;
  gaps: string[];
  reasoning: string;
  gap_type?: string | null;
  expert_framing?: string | null;
  inferred_concept_id: string | null;
  inferred_concept_confidence: number;
}

export interface ConceptReportRow {
  concept_id: string;
  name: string;
  answer_turns: number;
  scores: number[];
  best_score: number;
  last_score: number;
  gaps: string[];
}

export interface SessionReport {
  session_id: string;
  topic_id: string;
  topic_display: string;
  total_turns: number;
  evaluated_answers: number;
  concept_count?: number;
  mastered_count?: number;
  topic_complete?: boolean;
  concepts: ConceptReportRow[];
  top_gaps: string[];
  narrative: string | null;
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
  report: SessionReport | null;
  ended_at: string | null;
}

export interface TurnItem {
  turn_idx: number;
  role: "tutor" | "user";
  content: string;
  evaluator_score: number | null;
  evaluator_gaps: string[];
  evaluator_reasoning: string | null;
  evaluator_gap_type?: string | null;
  evaluator_expert_framing?: string | null;
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

export interface DueItem {
  topic: string;
  concept_id: string;
  name: string;
  score_1_to_5: number;
  next_review_at: string | null;
  overdue: boolean;
}

export interface DueResponse {
  user_id: string;
  items: DueItem[];
}

export type StartMode = "resume" | "study" | "replay";

export interface GraphNode {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  score_1_to_5: number;
  num_evaluations: number;
}

export interface TopicGraph {
  topic_id: string;
  display_name: string;
  nodes: GraphNode[];
}

export interface TopicSummary {
  topic_id: string;
  display_name: string;
  concept_count: number;
  mastered_count: number;
  avg_score_1_to_5: number;
  due_count: number;
  started: boolean;
}

export interface TopicSummaryResponse {
  user_id: string;
  topics: TopicSummary[];
}

export interface TopicCreated {
  topic_id: string;
  display_name: string;
  concept_count: number;
  path: string;
}

export interface BaselineResultItem {
  concept_id: string;
  name: string;
  score: number;
  skipped_study: boolean;
}

export interface BaselineView {
  session_id: string;
  topic_id: string;
  topic_display: string;
  done: boolean;
  question: string | null;
  concept_name: string | null;
  step: number;
  total: number;
  results: BaselineResultItem[];
}
