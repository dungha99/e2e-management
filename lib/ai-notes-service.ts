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
You are an expert AI system prompt engineer. Your task is to maintain a "Knowledge Diary" for an AI assistant. This diary is a cumulative list of instructions and lessons learned that are used in the AI's system prompt to make it smarter over time.

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
2. Identify what new lesson, rule, or instruction should be added based on the LATEST INTERACTION.
3. Output the ENTIRE updated Knowledge Diary, which includes all previous content PLUS the new entry.
4. Use a format like "**Entry [Date]**: [Description of lesson/instruction]" or "**New Instruction**: [Details]" to keep it organized like a diary.

The diary should track:
- Corrected mistakes.
- Specific thresholds to watch (e.g. price gaps).
- New output requirements (e.g. "recommended_actions").
- Nuanced understanding of user needs.

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
