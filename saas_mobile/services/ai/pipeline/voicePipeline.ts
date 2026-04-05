/**
 * Main Voice Pipeline — orchestrates the full voice agent on mobile.
 *
 * Flow:
 * 1. Extract intent (gpt-4o-mini)
 * 2. Create plan (deterministic step mapping)
 * 3. Check guardrails per step
 * 4. Execute tools (Supabase)
 * 5. Retrieve context (Supabase RAG)
 * 6. Retrieve memories (Supermemory)
 * 7. Generate response (gpt-4o-mini)
 * 8. Store memories (Supermemory)
 */

import { extractIntent, ExtractedIntent } from './intent';
import { createPlan, Plan, StepResult } from './planner';
import { checkGuardrails, sanitizeInput, GuardrailContext } from './guardrails';
import { retrieveContext, formatRetrievalContext } from './retrieval';
import { VoiceContext, HistoryEntry } from './types';
import { generateResponse } from './responseGenerator';
import {
  listTicketsTool,
  getTicketStatusTool,
  createTicketTool,
  listRoomsTool,
  bookRoomTool,
  listVisitorsTool,
  getPropertyInfoTool,
} from './tools';
import {
  retrieveMemories,
  storeMemories,
  formatMemoryContext,
} from '../supermemoryService';

export interface VoicePipelineResult {
  transcript: string;
  intent: ExtractedIntent;
  plan: Plan;
  response: string;
  steps: StepResult[];
  status: 'success' | 'error' | 'partial' | 'clarification';
}

export async function runVoicePipeline(
  transcript: string,
  ctx: VoiceContext,
  history: HistoryEntry[],
  sessionId: string
): Promise<VoicePipelineResult> {
  try {
    // Step 1: Extract intent
    const intent = await extractIntent(transcript, history);

    // Step 2: Create plan
    const plan = createPlan(intent);

    // Step 3: Retrieve RAG context (real-time Supabase data)
    const retrieval = await retrieveContext(ctx.propertyId, ctx.userId, transcript);
    const ragContextStr = formatRetrievalContext(retrieval);

    // Step 3b: Retrieve memory context (Supermemory)
    let memoryContextStr = '';
    try {
      const memoryCtx = await retrieveMemories({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        sessionId,
        query: transcript,
      });
      memoryContextStr = formatMemoryContext(memoryCtx);
    } catch (memErr) {
      console.warn('[voicePipeline] Memory fetch failed:', memErr);
    }

    // Combined context string for the LLM
    const contextStr = memoryContextStr
      ? `## Learned Memory\n${memoryContextStr}\n\n## Real-time Data\n${ragContextStr}`
      : ragContextStr;

    // Step 4: Execute plan steps
    const steps: StepResult[] = [];
    const toolResults: Record<string, unknown> = {};

    const guardrailCtx: GuardrailContext = {
      userId: ctx.userId,
      userRole: ctx.userRole,
      propertyId: ctx.propertyId,
      organizationId: ctx.organizationId,
    };

    for (const step of plan.steps) {
      const guardrail = checkGuardrails(transcript, step.step, guardrailCtx);
      if (!guardrail.allowed) {
        steps.push({ step: step.step, success: false, error: guardrail.reason });
        continue;
      }

      const result = await executeStep(step.step, step.params, ctx);
      steps.push({ step: step.step, success: result.success, data: result.data, error: result.error });
      if (result.success && result.data) {
        toolResults[step.step] = result.data;
      }
    }

    // Step 5: Generate response
    const { response, status } = await generateResponse(
      transcript,
      intent,
      plan,
      steps,
      toolResults,
      contextStr,
      ctx
    );

    // Step 5b: Store memories from this interaction
    try {
      await storeMemories({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        sessionId,
        transcript,
        response,
        intent: intent.intent,
      });
    } catch (memErr) {
      console.warn('[voicePipeline] Memory store failed:', memErr);
    }

    return { transcript, intent, plan, response, steps, status };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown pipeline error';
    return {
      transcript,
      intent: { intent: 'unknown', entities: {}, confidence: 0, reasoning: errorMsg },
      plan: { steps: [], estimatedSteps: 0, canProceed: false, reason: errorMsg },
      response: `I encountered an error: ${errorMsg}. Please try again.`,
      steps: [],
      status: 'error',
    };
  }
}

// ---------------------------------------------------------------------------
// Execute a single step
// ---------------------------------------------------------------------------
async function executeStep(
  step: string,
  params: Record<string, unknown>,
  ctx: VoiceContext
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const sanitized = sanitizeInput(params);

  switch (step) {
    case 'create_ticket':
      return createTicketTool(
        ctx.propertyId,
        ctx.organizationId,
        ctx.userId,
        sanitized
      );

    case 'get_ticket_status':
      return getTicketStatusTool(ctx.propertyId, sanitized);

    case 'list_tickets':
      return listTicketsTool(ctx.propertyId, sanitized);

    case 'get_property_info':
      return getPropertyInfoTool(ctx.propertyId);

    case 'list_visitors':
      return listVisitorsTool(ctx.propertyId, sanitized);

    case 'list_meeting_rooms':
      return listRoomsTool(ctx.propertyId, sanitized);

    case 'book_meeting_room':
      return bookRoomTool(ctx.propertyId, ctx.userId, sanitized);

    case 'respond_greeting':
      return { success: true, data: { response: 'Hello! How can I help you today?' } };

    case 'respond_small_talk':
      return { success: true, data: { response: "I'm doing great, thanks for asking! What can I help you with?" } };

    case 'clarify_intent':
      return { success: true, data: { response: "I'm not sure I understood that. Could you please rephrase?" } };

    default:
      return { success: false, error: `Unknown step: ${step}` };
  }
}
