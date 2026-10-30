/**
 * AGENT-002: Guarded Tool Execution: Permissions, Approvals, Audit
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:agents:2
 *
 * Keep the exported types, class and signature unchanged; the tests depend on them.
 */
import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type RiskLevel = "read" | "write" | "destructive";

export interface CallerContext {
  userId: string;
  scopes: string[];
  sessionMode?: "normal" | "read_only";
}

export type ToolArgs = Record<string, unknown>;
export type ToolImplementation = (args: ToolArgs, caller: CallerContext) => Promise<unknown>;

export interface ToolPolicy {
  tool: string;
  risk: RiskLevel;
  requiredScopes: string[];
  requiresApproval?: boolean;
  /** Returns a reason string to deny the call, or null to allow it. */
  guard?: (args: ToolArgs, caller: CallerContext) => string | null;
}

export interface ToolInvocation {
  callId: string;
  tool: string;
  args: ToolArgs;
  approvalId?: string;
}

export type DenyReason = "no_policy" | "read_only_session" | "missing_scope" | "guard_rejected" | "approval_invalid";

export type GuardedOutcome =
  | { status: "executed"; result: unknown }
  | { status: "denied"; reason: DenyReason; detail?: string }
  | { status: "pending_approval"; approvalId: string; expiresAt: number }
  | { status: "failed"; error: string };

export interface ApprovalRecord {
  id: string;
  tool: string;
  argsHash: string;
  requesterId: string;
  status: "pending" | "approved" | "rejected" | "used";
  createdAt: number;
  expiresAt: number;
  approverId?: string;
}

export interface AuditEntry {
  at: number;
  userId: string;
  tool: string;
  callId: string;
  decision: "executed" | "denied" | "pending_approval" | "failed" | "approved" | "rejected";
  reason?: string;
}

export interface GuardedExecutorConfig {
  tools: Record<string, ToolImplementation>;
  policies: ToolPolicy[];
  now?: () => number;
  approvalTtlMs?: number;
  generateId?: () => string;
}

export interface GuardedExecutor {
  execute(invocation: ToolInvocation, caller: CallerContext): Promise<GuardedOutcome>;
  decide(approvalId: string, decision: { approverId: string; approverScopes: string[]; approve: boolean }): ApprovalRecord;
  getAudit(): AuditEntry[];
}

export type ApprovalErrorCode = "not_found" | "not_pending" | "expired" | "self_approval" | "not_authorized";

export class ApprovalError extends Error {
  constructor(readonly code: ApprovalErrorCode) {
    super(`Approval error: ${code}`);
    this.name = "ApprovalError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createGuardedExecutor(config: GuardedExecutorConfig): GuardedExecutor {
  // TODO: defaults

  return {
    async execute(invocation, caller) {
      // TODO: ordered checks
      // TODO: approvals
      // TODO: execution
      // TODO: audit
      throw new Error("AGENT-002 execute is not implemented yet");
    },

    decide(approvalId, decision) {
      // TODO: see the specification
      throw new Error("AGENT-002 decide is not implemented yet");
    },

    getAudit() {
      // TODO: see the specification
      throw new Error("AGENT-002 getAudit is not implemented yet");
    },
  };
}
