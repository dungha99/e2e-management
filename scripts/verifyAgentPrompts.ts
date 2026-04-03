import { getPicAgentConfig, getActiveAgentNote } from "@/lib/ai-agent-service";

const AGENTS = [
  "Worker (Parameter/Rule)",
  "Review Messages Scheduled",
  "Evaluate-step",
];

// Use a dummy picId that doesn't exist — should fall back to global prompt
const TEST_PIC_ID = "__verify_test__";

async function verifyAgentPrompts() {
  console.log("=== Verifying agent prompts from database ===\n");

  let allOk = true;

  for (const agentName of AGENTS) {
    console.log(`--- ${agentName} ---`);

    const globalPrompt = await getPicAgentConfig(agentName, TEST_PIC_ID);
    const agentNote = await getActiveAgentNote(agentName);

    if (!globalPrompt) {
      console.error(`  [FAIL] No prompt found (global or PIC-specific)`);
      allOk = false;
    } else {
      console.log(`  [OK] Prompt loaded (${globalPrompt.length} chars)`);
      console.log(`  Preview: ${globalPrompt.slice(0, 120).replace(/\n/g, " ")}...`);
    }

    if (agentNote) {
      console.log(`  [OK] Agent note loaded (${agentNote.length} chars)`);
    } else {
      console.log(`  [INFO] No agent note (ai_agent_notes) — not required`);
    }

    console.log();
  }

  if (allOk) {
    console.log("All agents have prompts. Ready for production.");
  } else {
    console.error("Some agents are missing prompts. Run the seed script first:");
    console.error("  npx tsx --env-file=.env scripts/createAgentPicConfigsTable.ts");
    process.exit(1);
  }

  process.exit(0);
}

verifyAgentPrompts().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
