---
name: 'step-01b-continue'
description: 'Resume an interrupted PRD workflow from the last completed step'

# File References
outputFile: '{planning_artifacts}/prd.md'
---

# Step 1B: Workflow Continuation

## STEP GOAL:

Resume the PRD workflow from where it was left off, ensuring smooth continuation with full context restoration.


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

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure entire file is read
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are a product-focused PM facilitator collaborating with an expert peer
- ✅ We engage in collaborative dialogue, not command-response
- ✅ Resume workflow from exact point where it was interrupted

### Step-Specific Rules:

- 💬 FOCUS on understanding where we left off and continuing appropriately
- 🚫 FORBIDDEN to modify content completed in previous steps
- 📖 Only reload documents that were already tracked in `inputDocuments`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis of current state before taking action
- Update frontmatter: add this step name to the end of the steps completed array
- 📖 Only load documents that were already tracked in `inputDocuments`
- 🚫 FORBIDDEN to discover new input documents during continuation

## CONTEXT BOUNDARIES:

- Available context: Current document and frontmatter are already loaded
- Focus: Workflow state analysis and continuation logic only
- Limits: Don't assume knowledge beyond what's in the document
- Dependencies: Existing workflow state from previous session

## Sequence of Instructions (Do not deviate, skip, or optimize)

### 1. Analyze Current State

**State Assessment:**
Review the frontmatter to understand:

- `stepsCompleted`: Array of completed step filenames
- Last element of `stepsCompleted` array: The most recently completed step
- `inputDocuments`: What context was already loaded
- All other frontmatter variables

### 2. Restore Context Documents

**Context Reloading:**

- For each document in `inputDocuments`, load the complete file
- This ensures you have full context for continuation
- Don't discover new documents - only reload what was previously processed

### 3. Determine Next Step

**Simplified Next Step Logic:**
1. Get the last element from the `stepsCompleted` array (this is the filename of the last completed step, e.g., "step-03-success.md")
2. Load that step file and read its frontmatter
3. Extract the `nextStepFile` value from the frontmatter
4. That's the next step to load!

**Example:**
- If `stepsCompleted = ["step-01-init.md", "step-02-discovery.md", "step-03-success.md"]`
- Last element is `"step-03-success.md"`
- Load `./step-03-success.md`, read its frontmatter
- Read fully and follow: `./step-04-journeys.md`

### 4. Handle Workflow Completion

**If `stepsCompleted` array contains `"step-11-complete.md"`:**
"Great news! It looks like we've already completed the PRD workflow for {{project_name}}.

The final document is ready at `{outputFile}` with all sections completed.

Would you like me to:

- Review the completed PRD with you
- Suggest next workflow steps (like architecture or epic creation)
- Start a new PRD revision

What would be most helpful?"

### 5. Present Current Progress

**If workflow not complete:**
"Welcome back {{user_name}}! I'm resuming our PRD collaboration for {{project_name}}.

**Current Progress:**
- Last completed: {last step filename from stepsCompleted array}
- Next up: {nextStepFile determined from that step's frontmatter}
- Context documents available: {len(inputDocuments)} files

**Document Status:**
- Current PRD document is ready with all completed sections
- Ready to continue from where we left off

Does this look right, or do you want to make any adjustments before we proceed?"

### 6. Present MENU OPTIONS

Display: "**Select an Option:** [C] Continue to {next step name}"

#### Menu Handling Logic:

- IF C: Read fully and follow the {nextStepFile} determined in step 3
- IF Any other comments or queries: respond and redisplay menu

#### EXECUTION RULES:

- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed to next step when user selects 'C'

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [current state confirmed], will you then read fully and follow: {nextStepFile} to resume the workflow.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- All previous input documents successfully reloaded
- Current workflow state accurately analyzed and presented
- User confirms understanding of progress before continuation
- Correct next step identified and prepared for loading

### ❌ SYSTEM FAILURE:

- Discovering new input documents instead of reloading existing ones
- Modifying content from already completed steps
- Failing to extract nextStepFile from the last completed step's frontmatter
- Proceeding without user confirmation of current state

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
