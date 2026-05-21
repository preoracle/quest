import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface ConceptDraft {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
}

export interface TopicDraft {
  topic: string;
  display_name: string;
  concepts: ConceptDraft[];
}

export interface ParseResult {
  draft: TopicDraft | null;
  errors: string[];
  warnings: string[];
}

const TOPIC_ID = /^[a-z][a-z0-9_]{0,47}$/;
const CONCEPT_ID = /^[a-z][a-z0-9_]{0,63}$/;

function emptyDraft(): TopicDraft {
  return {
    topic: "",
    display_name: "",
    concepts: [
      { id: "", name: "", description: "", prerequisites: [] },
      { id: "", name: "", description: "", prerequisites: [] },
      { id: "", name: "", description: "", prerequisites: [] },
      { id: "", name: "", description: "", prerequisites: [] },
      { id: "", name: "", description: "", prerequisites: [] },
    ],
  };
}

export function parseTopicYaml(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text.trim()) {
    return { draft: emptyDraft(), errors, warnings };
  }

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (e) {
    return {
      draft: null,
      errors: [e instanceof Error ? e.message : "Invalid YAML"],
      warnings,
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { draft: null, errors: ["YAML root must be a mapping"], warnings };
  }

  const obj = data as Record<string, unknown>;
  const draft = emptyDraft();

  if (typeof obj.topic === "string") draft.topic = obj.topic.trim();
  else errors.push("Missing field: topic (snake_case id)");

  if (typeof obj.display_name === "string") draft.display_name = obj.display_name.trim();
  else errors.push("Missing field: display_name");

  const conceptsRaw = obj.concepts;
  if (!Array.isArray(conceptsRaw)) {
    errors.push("Missing field: concepts (list of 5–10 items)");
  } else {
    draft.concepts = conceptsRaw.map((c, i) => {
      if (!c || typeof c !== "object" || Array.isArray(c)) {
        errors.push(`concepts[${i}] must be an object`);
        return { id: "", name: "", description: "", prerequisites: [] };
      }
      const row = c as Record<string, unknown>;
      const prereqs = Array.isArray(row.prerequisites)
        ? row.prerequisites.filter((p): p is string => typeof p === "string")
        : [];
      return {
        id: typeof row.id === "string" ? row.id.trim() : "",
        name: typeof row.name === "string" ? row.name.trim() : "",
        description: typeof row.description === "string" ? row.description.trim() : "",
        prerequisites: prereqs,
      };
    });
    if (draft.concepts.length < 5) {
      warnings.push(`Need at least 5 concepts (have ${draft.concepts.length})`);
      while (draft.concepts.length < 5) {
        draft.concepts.push({ id: "", name: "", description: "", prerequisites: [] });
      }
    }
    if (draft.concepts.length > 10) {
      warnings.push("Maximum 10 concepts; extras will be trimmed");
      draft.concepts = draft.concepts.slice(0, 10);
    }
  }

  validateDraft(draft, errors, warnings);
  return { draft, errors, warnings };
}

function validateDraft(draft: TopicDraft, errors: string[], warnings: string[]) {
  if (draft.topic && !TOPIC_ID.test(draft.topic)) {
    errors.push("topic must be snake_case, start with a letter, max 48 chars");
  }
  if (!draft.display_name) errors.push("display_name is required");

  const ids = new Set<string>();
  draft.concepts.forEach((c, i) => {
    if (!c.id) errors.push(`Concept ${i + 1}: id required`);
    else if (!CONCEPT_ID.test(c.id)) errors.push(`Concept ${i + 1}: invalid id "${c.id}"`);
    else if (ids.has(c.id)) errors.push(`Duplicate concept id: ${c.id}`);
    else ids.add(c.id);

    if (!c.name) errors.push(`Concept ${i + 1}: name required`);
    c.prerequisites.forEach((p) => {
      if (!CONCEPT_ID.test(p)) errors.push(`Concept ${c.id || i}: invalid prerequisite "${p}"`);
    });
  });

  draft.concepts.forEach((c) => {
    c.prerequisites.forEach((p) => {
      if (p && !ids.has(p)) errors.push(`Concept ${c.id}: unknown prerequisite "${p}"`);
    });
  });

  if (draft.concepts.filter((c) => c.id && c.name).length < 5) {
    warnings.push("At least 5 complete concepts required to import");
  }
}

export function draftToYaml(draft: TopicDraft): string {
  const payload = {
    topic: draft.topic,
    display_name: draft.display_name,
    concepts: draft.concepts
      .filter((c) => c.id || c.name)
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || undefined,
        prerequisites: c.prerequisites.length ? c.prerequisites : [],
      })),
  };
  return stringifyYaml(payload, { lineWidth: 0 });
}

export function isDraftReady(draft: TopicDraft): boolean {
  const { errors } = parseTopicYaml(draftToYaml(draft));
  return errors.length === 0 && draft.concepts.filter((c) => c.id && c.name).length >= 5;
}

export { emptyDraft };
