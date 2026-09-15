import type { Role } from './domain';

/**
 * Shape of what `getState()` returns. Everything goes through JSON.stringify,
 * so dates arrive on the client as ISO strings and Decimals as numbers.
 */

export type FormField = {
  id: string;
  labelAr: string;
  labelEn: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'attachment';
  required: boolean;
  options?: string[];
};

export type RubricCriterion = { nameAr: string; nameEn: string; weight: number };

export type ActorState = {
  userId: string;
  tenantId: string;
  role: Role;
  programIds: string[];
  name: string;
  tenantStatus: string;
  correlationId: string;
  platformOperator?: boolean;
};

export type ActivityState = {
  id: string;
  tenantId: string;
  programId: string;
  nameAr: string;
  nameEn: string;
  startsAt: string;
  endsAt: string;
  location: string;
  required: boolean;
  type: string;
  capacity: number | null;
  status: string;
};

export type IndicatorState = {
  id: string;
  tenantId: string;
  programId: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  target: number;
  direction: 'Higher' | 'Lower';
  aggregation: string;
  source: string;
  period: string;
  ownerId: string | null;
};

export type ProgramState = {
  id: string;
  tenantId: string;
  initiativeId: string | null;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: string;
  status: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
  registrationStart: string;
  registrationEnd: string;
  completionThreshold: number;
  requireEndline: boolean;
  form: FormField[];
  rubric: RubricCriterion[];
  privacyAr: string;
  privacyEn: string;
  ownerId: string | null;
  ownerActive: boolean;
  version: number;
  createdAt: string;
  activities: ActivityState[];
  indicators: IndicatorState[];
};

export type EvaluationState = {
  id: string;
  applicationId: string;
  reviewerId: string;
  score: number;
  scores: number[];
  comment: string;
  conflict: boolean;
  createdAt: string;
};

export type AttendanceState = {
  id: string;
  activityId: string;
  enrollmentId: string;
  status: 'Present' | 'Absent' | 'Excused' | 'NotRecorded';
  reason: string | null;
};

export type MeasurementState = {
  id: string;
  indicatorId: string;
  enrollmentId: string;
  period: 'Baseline' | 'Endline';
  value: number;
  status: 'Draft' | 'Verified' | 'Returned';
  source: string;
  measuredAt: string;
  evidenceId: string | null;
  revision: number;
  reason: string | null;
  createdAt: string;
};

export type EnrollmentState = {
  id: string;
  applicationId: string;
  status: string;
  previousStatus: string | null;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
  attendance: AttendanceState[];
  measurements: MeasurementState[];
};

export type ApplicationState = {
  id: string;
  tenantId: string;
  programId: string;
  beneficiaryId: string;
  status: string;
  answers: Record<string, string | number | string[]>;
  formSnapshot: FormField[];
  privacySnapshot: string;
  reviewerIds: string[];
  reference: string;
  infoFields: string[];
  needsInfo: string | null;
  infoDue: string | null;
  decisionReason: string | null;
  submittedAt: string | null;
  firstDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  beneficiary: { id: string; name: string; email: string; userId: string; status?: string };
  evaluations: EvaluationState[];
  enrollment: EnrollmentState | null;
  revisions: RevisionState[];
};

export type RevisionState = {
  id: string;
  revision: number;
  answers: Record<string, string | number | string[]>;
  actorId: string;
  reason: string;
  createdAt: string;
};

export type IndicatorResult = IndicatorState & {
  pairs: number;
  change: number | null;
  coverage: number | null;
  actual: number | null;
  achievement: { percent: number | null; gap: number | null };
};

export type KpiState = {
  submitted: number;
  pending: number;
  decided: number;
  acceptanceRate: number | null;
  decisionHours: number | null;
  occupied: number;
  capacity: number;
  fill: number | null;
  enrollments: number;
  completed: number;
  withdrawn: number;
  completionRate: number | null;
};

export type ExportState = {
  id: string;
  userId: string;
  type: string;
  status: string;
  filters: { programId?: string | null; locale?: string; requestId?: string };
  rows: number;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
};

export type FailedMailState = { id: string; recipient: string; subject: string; attempts: number; createdAt: string };

export type DeletionCandidateState = {
  id: string;
  beneficiaryId: string;
  reason: string;
  dueAt: string;
  status: string;
  createdAt: string;
  beneficiary: { id: string; name: string; email: string } | null;
};

export type ConsentState = {
  id: string;
  beneficiaryId: string;
  applicationId: string;
  noticeVersion: number;
  purpose: string;
  givenAt: string;
  withdrawnAt: string | null;
};

export type MembershipState = {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  active: boolean;
  programIds: string[];
  tenant: { id: string; slug: string; nameAr: string; nameEn: string; status: string };
};

export type MemberState = {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  active: boolean;
  programIds: string[];
  expiresAt: string | null;
  supportGrant: boolean;
  user: { id: string; name: string; email: string };
};

export type NotificationState = {
  id: string;
  userId: string;
  titleAr: string;
  titleEn: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type AuditState = {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type PrivacyState = {
  id: string;
  userId: string;
  type: 'Access' | 'Copy' | 'Correction' | 'Erasure' | 'WithdrawConsent';
  status: string;
  reason: string | null;
  dueAt: string;
  fulfilledAt: string | null;
  createdAt: string;
};

export type SnapshotState = {
  id: string;
  userId: string;
  title: string;
  data: unknown;
  createdAt: string;
};

export type InitiativeState = {
  id: string;
  nameAr: string;
  nameEn: string;
  objective: string;
  createdAt: string;
};

export type AppState = {
  notes: {id:string;programId:string;beneficiaryId:string;body:string;createdAt:string}[];
  actor: ActorState;
  asOf: string;
  cutoffAt: string;
  kpis: Record<string, KpiState>;
  exports: ExportState[];
  failedMail: FailedMailState[];
  deletionCandidates: DeletionCandidateState[];
  profile: { name: string; email: string; phone: string | null; status: string } | null;
  consents: ConsentState[];
  programs: ProgramState[];
  applications: ApplicationState[];
  indicators: IndicatorResult[];
  totals: { programs: number; applications: number; enrolled: number; completed: number };
  memberships: MembershipState[];
  notifications: NotificationState[];
  members: MemberState[];
  audit: AuditState[];
  privacy: PrivacyState[];
  snapshots: SnapshotState[];
  initiatives: InitiativeState[];
};
