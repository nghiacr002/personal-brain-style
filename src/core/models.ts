export const KINDS = ["preference", "skill", "example", "review", "tool"] as const;
export type Kind = (typeof KINDS)[number];
export type Status = "active" | "draft" | "archived";
export const DOMAINS = ["general", "thinking", "architecture", "diagrams", "writing", "coding", "technology", "reviews", "communication", "design", "tools"] as const;
export type Domain = string;
export type TestRule = { type: "contains" | "not_contains" | "max_length" | "min_length"; value: string | number; label?: string };
export type Requirement = {id:string;label:string;type:"artifact"|"manual";extension?:string;extensions?:string[];when?:Applicability};
export type ToolBackend = {
  command: string;
  args: string[];
  toolName: string;
  enabled: boolean;
  timeoutMs?: number;
};
export type Applicability = { activities?: string[]; formats?: string[]; languages?: string[]; frameworks?: string[]; targets?: string[] };
export type SkillBinding = { name:string; when?:Applicability; required:boolean; fallback:string };
export type PreferenceValue = { key:string; value:string };
export type TaskContext = { activity?:string; formats?:string[]; languages?:string[]; frameworks?:string[]; targets?:string[]; preferences?:PreferenceValue[] };
export type BrainRecord = {
  compatibility?: boolean;
  standardLanguage?: string;
  appliesWhen?: Applicability;
  supportingLinks?: Array<{recordId:string; when:Applicability}>;
  skillBindings?: SkillBinding[];
  preferences?: PreferenceValue[];
  sourceVersion?: number;
  id: string;
  keyId?: string;
  sourceStyleId?: string;
  kind: Kind;
  domain: Domain;
  projectId?: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  useWhen?: string;
  requiredIds?: string[];
  examples?: string[];
  principles?: string[];
  externalSkills?: string[];
  reviewCriteria?: string[];
  requirements?: Requirement[];
  priority: number;
  status: Status;
  version: number;
  createdAt: string;
  updatedAt: string;
  checks: TestRule[];
  backend: ToolBackend | null;
};
export type RecordInput = Omit<BrainRecord, "id" | "version" | "createdAt" | "updatedAt">;
export type Revision = {
  id: string;
  recordId: string;
  version: number;
  action: "create" | "update" | "restore";
  snapshot: BrainRecord;
  at: string;
};
export type Feedback = { id: string; recordId: string | null; rating: "accepted" | "rejected" | "correction"; note: string; createdAt: string };
export class BrainError extends Error {
  code: string; status: number;
  constructor(message: string, code: string = "INVALID_REQUEST", status: number = 400) { super(message); this.code=code; this.status=status; }
}
export const validKind = (v: unknown): v is Kind => KINDS.includes(v as Kind);
export const validDomain = (v: unknown): v is Domain => typeof v === "string" && /^[a-z][a-z0-9-]{0,59}$/.test(v);
export const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export type ProjectAssignment = {recordId:string; override:string|null};
export type Project = {id:string;name:string;description:string;assignments:ProjectAssignment[];version:number;updatedAt:string};
