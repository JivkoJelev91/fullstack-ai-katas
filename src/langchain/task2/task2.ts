/**
 * LC-002: Tenant Retriever and Conversational RAG Chain
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:langchain:2
 *
 * Keep the exported types, constant, class and signatures unchanged; the tests depend on them.
 */
import { Document } from "@langchain/core/documents";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { BaseRetriever, type BaseRetrieverInterface } from "@langchain/core/retrievers";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export const NO_ANSWER = "I don't know based on the available documents.";

export interface SearchHit {
  id: string;
  text: string;
  score: number;
  source: string;
}

export type SearchFn = (query: string, options: { tenantId: string; k: number }) => Promise<SearchHit[]>;

export interface TenantRetrieverFields {
  search: SearchFn;
  tenantId: string;
  k?: number;
  minScore?: number;
}

export interface ConversationalInput {
  question: string;
  history: BaseMessage[];
}

export interface ConversationalOutput {
  answer: string;
  standaloneQuestion: string;
  sources: string[];
}

// ---------------------------------------------------------------------------
// Part A — retriever
// ---------------------------------------------------------------------------

export class TenantRetriever extends BaseRetriever {
  // TODO: lc_namespace
  override lc_namespace: string[] = [];

  constructor(fields: TenantRetrieverFields) {
    super();
    // TODO: see the specification
    throw new Error("LC-002 TenantRetriever is not implemented yet");
  }

  override async _getRelevantDocuments(query: string): Promise<Document[]> {
    // TODO: see the specification
    throw new Error("LC-002 TenantRetriever._getRelevantDocuments is not implemented yet");
  }
}

// ---------------------------------------------------------------------------
// Part B — conversational RAG chain
// ---------------------------------------------------------------------------

export function createConversationalRagChain(deps: {
  model: BaseChatModel;
  retriever: BaseRetrieverInterface;
}): Runnable<ConversationalInput, ConversationalOutput> {
  // TODO: validation
  // TODO: standalone question
  // TODO: retrieval and empty context
  // TODO: answer and result
  throw new Error("LC-002 createConversationalRagChain is not implemented yet");
}
