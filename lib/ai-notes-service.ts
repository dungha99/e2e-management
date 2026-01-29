import { e2eQuery } from "./db";
import { callGemini } from "./gemini";

export type FeedbackType = "text" | "positive" | "negative";

export async function getLatestAiNote(block: string): Promise<string | null> {
  const result = await e2eQuery(
    `SELECT note FROM ai_notes WHERE block = $1 ORDER BY created_at DESC LIMIT 1`,
    [block]
  );
  return result.rows[0]?.note || null;
}

export async function updateAiNoteFromFeedback(params: {
  block: string;
  aiResponse: string;
  userFeedback: string;
  feedbackType: FeedbackType;
  feedbackInsightId?: string;      // ID from old_ai_insights
  workflowAiMessageId?: string;    // ID from workflow_ai_messages
}) {
  const { block, aiResponse, userFeedback, feedbackType, feedbackInsightId, workflowAiMessageId } = params;

  const currentNote = await getLatestAiNote(block);
  const today = new Date().toISOString().split('T')[0];

  const prompt = `
You are an expert AI system prompt engineer. Your task is to maintain a "Knowledge Diary" for an AI assistant. This diary is a cumulative list of instructions, patterns, and lessons learned that are used in the AI's system prompt to make it smarter over time.

Today's Date: ${today}

DO NOT REPLACE the old instructions. Instead, you must ENRICH the Knowledge Diary by adding new "Entries" based on the latest interaction.

Current Knowledge Diary for this block ("${block}"):
${currentNote || "None - Initializing Diary"}

--- 
LATEST INTERACTION CONTEXT:
The AI recently gave this response:
${aiResponse}

The user gave this feedback (Type: ${feedbackType}):
${userFeedback}
---

Goal:
1. Review the Current Knowledge Diary.
2. **Extract the Generalized Pattern**: Look at the LATEST INTERACTION and find the underlying principle or heuristic that was missed. 
3. **Draft Reusable Instructions**: Do NOT focus on the specific names, IDs, or unique details of this case. Instead, describe the **Pattern** of the situation and the **Instruction** the AI should follow whenever that pattern occurs.
4. Output the ENTIRE updated Knowledge Diary, which includes previous content PLUS the new entry.
5. If the pattern is already in the diary, you should update the existing pattern instead of adding a new one.
6. Use a structured format like:
   **Entry [Date]**: 
   - **Pattern**: [Description of the general scenario/context]
   - **Instruction**: [Actionable, reusable rule for the AI to follow in the future]

The diary should track:
- Logic patterns for corrected mistakes.
- Heuristics for specific thresholds (e.g. price gaps, client sentiment).
- Component-level requirements (e.g. structural shifts, new fields).
- Strategic understanding of generalized user needs.

Output only the full text of the updated Knowledge Diary:
  `.trim();

  try {
    let newNote = "";
    try {
      newNote = await callGemini(prompt, "gemini-2.0-flash");
    } catch (e) {
      console.warn("Gemini 2.0 Flash failed, falling back to 1.5 Flash", e);
      newNote = await callGemini(prompt, "gemini-1.5-flash");
    }

    // Save to database using the correct specific column
    if (workflowAiMessageId) {
      await e2eQuery(
        `INSERT INTO ai_notes (note, block, workflow_ai_message_id, feedback_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [newNote.trim(), block, workflowAiMessageId, feedbackType]
      );
    } else {
      await e2eQuery(
        `INSERT INTO ai_notes (note, block, old_ai_insight_id, feedback_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [newNote.trim(), block, feedbackInsightId || null, feedbackType]
      );
    }

    return newNote.trim();
  } catch (error) {
    console.error(`[AI Notes Service] Error updating note for ${block}:`, error);
    throw error;
  }
}
