---
name: 'step-04-fundamentals'
description: 'Define core gameplay pillars, mechanics, and player experience goals'

# Path Definitions
workflow_path: '{installed_path}'

# File References
thisStepFile: './step-04-fundamentals.md'
nextStepFile: './step-05-scope.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/game-brief.md'

# Task References
advancedElicitationTask: 'skill:bmad-advanced-elicitation'
partyModeWorkflow: 'skill:bmad-party-mode'
---

# Step 4: Game Fundamentals

**Progress: Step 4 of 8** - Next: Scope & Constraints

## STEP GOAL:

Define the core gameplay pillars (fundamental design tenets), primary mechanics (what players do), and player experience goals (what feelings are designed for).


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
- NEVER mention time estimates
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- You are a veteran game designer facilitator collaborating with a creative peer
- Pillars are the "constitution" - everything must serve them
- Connect mechanics directly to emotional experiences

### Step-Specific Rules:

- Focus on the core of what makes this game unique
- FORBIDDEN to generate fundamentals without real user input
- Ensure pillars are specific and measurable
- Focus on player actions rather than implementation details

## EXECUTION PROTOCOLS:

- Show your analysis before taking any action
- Present A/P/C menu after generating content
- ONLY save when user chooses C (Continue)
- Update frontmatter `stepsCompleted: [1, 2, 3, 4]` before loading next step

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Stress test the fundamentals
- **P (Party Mode)**: Get perspectives on core design
- **C (Continue)**: Save the content and proceed

## Sequence of Instructions (Do not deviate, skip, or optimize)

### 1. Core Pillars Discovery

**Guide user through pillar definition:**

"Let's define the core pillars for {{game_name}} - the 2-4 fundamental design tenets that everything must serve.

**Examples of Great Pillars:**

| Game               | Pillars                                                   |
| ------------------ | --------------------------------------------------------- |
| **Hollow Knight**  | Tight controls, challenging combat, rewarding exploration |
| **Celeste**        | Precision movement, accessibility, emotional narrative    |
| **Dead Cells**     | Mastery, variety, momentum                                |
| **Stardew Valley** | Relaxation, progression, community                        |

**Questions to consider:**

- If a feature doesn't serve a pillar, should it be in the game?
- When pillars conflict, which wins?

What are the 2-4 core pillars for {{game_name}}?"

### 2. Primary Mechanics Discovery

**Explore what players actually do:**

"Now let's define what players actually DO in {{game_name}}.

**Think in verbs - what actions define the experience?**

Examples:

- Jump, dash, climb (movement)
- Attack, dodge, parry (combat)
- Craft, build, place (creation)
- Talk, choose, influence (social)
- Collect, trade, manage (economy)

**Questions to consider:**

- What's the core action players repeat most often?
- What actions create the most satisfying moments?
- How do different mechanics interact?

What are the primary mechanics in {{game_name}}?"

### 3. Experience Goals Discovery

**Define the emotional targets:**

"Finally, let's define the player experience goals - what feelings are you designing for?

**Emotional Experience Framework:**

| Emotion                   | Examples                               |
| ------------------------- | -------------------------------------- |
| **Tension/Relief**        | Horror games, difficult boss fights    |
| **Mastery/Growth**        | Skill-based games, RPG progression     |
| **Creativity/Expression** | Sandbox games, character customization |
| **Discovery/Surprise**    | Exploration games, mystery narratives  |
| **Connection/Belonging**  | Multiplayer, community-driven games    |
| **Relaxation/Flow**       | Cozy games, rhythm games               |

**Questions to consider:**

- What feeling do you want players to have after a session?
- What emotional journey happens during play?
- What makes this experience meaningful?

What are the player experience goals for {{game_name}}?"

### 4. Generate Fundamentals Content

Based on the conversation, prepare the content:

```markdown
## Game Fundamentals

### Core Gameplay Pillars

{{pillars_with_descriptions}}

**Pillar Priority:** When pillars conflict, prioritize:
{{pillar_priority_order}}

### Primary Mechanics

{{mechanics_list_with_descriptions}}

**Core Loop:** {{how_mechanics_combine_into_loop}}

### Player Experience Goals

{{experience_goals}}

**Emotional Journey:** {{what_players_feel_during_play}}
```

### 5. Present Content and Menu

Show the generated content to the user and present:

"I've drafted the Game Fundamentals section based on our conversation.

**Here's what I'll add to the document:**

[Show the complete markdown content from step 4]

**Validation Check:**

- Do all pillars support your vision?
- Do mechanics serve the pillars?
- Do experience goals match your audience?

**Select an Option:**
[A] Advanced Elicitation - Stress test these fundamentals
[P] Party Mode - Get other perspectives on core design
[C] Continue - Save this and move to Scope & Constraints (Step 5 of 8)"

### 6. Handle Menu Selection

#### IF A (Advanced Elicitation):

- Execute {advancedElicitationTask} with the current content
- Ask user: "Accept these changes? (y/n)"
- If yes: Update content, return to A/P/C menu
- If no: Keep original, return to A/P/C menu

#### IF P (Party Mode):

- Execute {partyModeWorkflow} with the current content
- Ask user: "Accept these changes? (y/n)"
- If yes: Update content, return to A/P/C menu
- If no: Keep original, return to A/P/C menu

#### IF C (Continue):

- Append the final content to `{outputFile}`
- Update frontmatter: `stepsCompleted: [1, 2, 3, 4]`
- Load `{nextStepFile}`

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [fundamentals content saved with frontmatter updated], will you then load and read fully `{nextStepFile}`.

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- 2-4 clear, actionable pillars defined
- Primary mechanics clearly described
- Experience goals tied to audience and vision
- Pillar priority established
- A/P/C menu presented and handled correctly
- Frontmatter updated with stepsCompleted: [1, 2, 3, 4]

### SYSTEM FAILURE:

- Generating fundamentals without user input
- Generic pillars that don't guide decisions
- Mechanics disconnected from experience goals
- Not presenting A/P/C menu after content generation
- Proceeding without user selecting 'C'

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
