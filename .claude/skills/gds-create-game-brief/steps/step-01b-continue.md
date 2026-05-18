---
name: 'step-01b-continue'
description: 'Resume an interrupted Game Brief workflow from the last completed step'

# Path Definitions
workflow_path: '{installed_path}'

# File References
thisStepFile: './step-01b-continue.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/game-brief.md'
---

# Step 1B: Workflow Continuation

## STEP GOAL:

Resume the Game Brief workflow from where it was left off, ensuring smooth continuation with full context restoration.


## AUTONOMOUS MODE OVERRIDE (READ BEFORE ALL OTHER RULES -- NO EXCEPTIONS)

If `project-intent.md` exists anywhere in the project, **AUTONOMOUS MODE IS UNCONDITIONALLY ACTIVE**. This applies regardless of how this skill was invoked -- by the orchestrator, by the user directly, or any other means. There is no "interactive override" of this rule.

In AUTONOMOUS MODE:
- Immediately check for and read `project-intent.md`
- ALL "NEVER generate content without user input" directives are cancelled -- use project-intent.md as the source of user input
- ALL "halt and wait for user selection" directives are cancelled -- select the best option from project-intent.md and continue immediately
- ALL "Do NOT proceed until user explicitly selects [C]" directives are cancelled -- select C immediately and continue
- ALL "ALWAYS halt at menus" directives are cancelled -- process menus internally, never surface them to the human
- Execute this step fully, write all output, update frontmatter, then **immediately read and execute the next step file in the same response**
- **NEVER end your response at a [C] prompt, a confirmation checkpoint, or a menu.** These are not stopping points in autonomous mode -- they are auto-confirmed. Keep going.
- Only end your response when the FINAL step of the entire workflow is fully complete and all output files are written
- Complete the entire workflow to its final step in a single response

**Do NOT reason about whether this invocation is "interactive" -- if project-intent.md exists, autonomous mode is active, full stop.**

The MANDATORY EXECUTION RULES below are overridden by the above when project-intent.md is present.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure entire file is read
- YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- You are a veteran game designer facilitator collaborating with a creative peer
- We engage in collaborative dialogue, not command-response
- Resume workflow from exact point where it was interrupted

### Step-Specific Rules:

- FOCUS on understanding where we left off and continuing appropriately
- FORBIDDEN to modify content completed in previous steps
- Only reload documents that were already tracked in `inputDocuments`

## EXECUTION PROTOCOLS:

- Show your analysis of current state before taking action
- Keep existing frontmatter `stepsCompleted` values
- Only load documents that were already tracked in `inputDocuments`
- FORBIDDEN to discover new input documents during continuation

## Sequence of Instructions (Do not deviate, skip, or optimize)

### 1. Analyze Current State

**State Assessment:**
Review the frontmatter to understand:

- `stepsCompleted`: Which steps are already done
- `lastStep`: The most recently completed step number
- `inputDocuments`: What context was already loaded
- `documentCounts`: brainstorming, research, notes counts
- `game_name`: The game name (if set)
- All other frontmatter variables

### 2. Restore Context Documents

**Context Reloading:**

- For each document in `inputDocuments`, load the complete file
- This ensures you have full context for continuation
- Don't discover new documents - only reload what was previously processed

### 3. Present Current Progress

**Progress Report to User:**
"Welcome back {{user_name}}! I'm resuming our Game Brief collaboration for {{game_name or project_name}}.

**Current Progress:**

- Steps completed: {stepsCompleted}
- Last worked on: Step {lastStep}
- Context documents available: {len(inputDocuments)} files

**Document Status:**

- Current Game Brief is ready with all completed sections
- Ready to continue from where we left off

Does this look right, or do you want to make any adjustments before we proceed?"

### 4. Determine Continuation Path

**Next Step Logic:**
Based on `lastStep` value, determine which step to load next:

- If `lastStep = 1` -> Load `./step-02-vision.md`
- If `lastStep = 2` -> Load `./step-03-market.md`
- If `lastStep = 3` -> Load `./step-04-fundamentals.md`
- If `lastStep = 4` -> Load `./step-05-scope.md`
- If `lastStep = 5` -> Load `./step-06-references.md`
- If `lastStep = 6` -> Load `./step-07-content.md`
- If `lastStep = 7` -> Load `./step-08-complete.md`
- If `lastStep = 8` -> Workflow already complete

### 5. Handle Workflow Completion

**If workflow already complete (`lastStep = 8`):**
"Great news! It looks like we've already completed the Game Brief workflow for {{game_name}}.

The final document is ready at `{outputFile}` with all sections completed.

Would you like me to:

- Review the completed brief with you
- Suggest next workflow steps (like GDD creation)
- Start a new brief revision

What would be most helpful?"

### 6. Present MENU OPTIONS

**If workflow not complete:**
Display: "Ready to continue with Step {nextStepNumber}?

**Select an Option:** [C] Continue to next step"

#### Menu Handling Logic:

- IF C: Load, read entire file, then execute the appropriate next step file based on `lastStep`
- IF Any other comments or queries: respond and redisplay menu

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [current state confirmed], will you then load and read fully the appropriate next step file to resume the workflow.

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- All previous input documents successfully reloaded
- Current workflow state accurately analyzed and presented
- User confirms understanding of progress before continuation
- Correct next step identified and prepared for loading

### SYSTEM FAILURE:

- Discovering new input documents instead of reloading existing ones
- Modifying content from already completed steps
- Loading wrong next step based on `lastStep` value
- Proceeding without user confirmation of current state

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
