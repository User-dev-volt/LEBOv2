---
name: 'step-12-epics'
description: 'Define development epics and high-level story breakdown'

# Path Definitions
workflow_path: '{installed_path}'

# File References
thisStepFile: './step-12-epics.md'
nextStepFile: './step-13-metrics.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/gdd.md'
epicsOutputFile: '{output_folder}/epics.md'

# Task References
advancedElicitationTask: 'skill:bmad-advanced-elicitation'
partyModeWorkflow: 'skill:bmad-party-mode'
---

# Step 12: Epic Structure

**Progress: Step 12 of 14** - Next: Success Metrics

## STEP GOAL:

Translate the game features defined throughout the GDD into development epics, each with a clear scope and list of high-level stories. This provides the foundation for sprint planning.


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
- Epics bridge design (GDD) to implementation (sprints)
- Epic scope should be completable in 1-4 sprints

### Step-Specific Rules:

- Focus on feature groupings, not detailed task breakdowns
- FORBIDDEN to generate epics without user input
- Each epic should deliver playable value
- Stories are high-level here - detailed stories come in sprint planning

## EXECUTION PROTOCOLS:

- Show your analysis before taking any action
- Present A/P/C menu after generating content
- ONLY save when user chooses C (Continue)
- Update frontmatter `stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]` before loading next step
- FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Refine epic scopes and boundaries
- **P (Party Mode)**: Get perspectives on epic organization
- **C (Continue)**: Save the content to the document and proceed to next step

## CONTEXT BOUNDARIES:

- All GDD content from previous steps available
- Epics should map to game pillars and features
- This creates both GDD epic summary and detailed epics.md file

## Sequence of Instructions (Do not deviate, skip, or optimize)

### 1. Review Game Features for Epic Candidates

**Analyze the GDD content:**

"Let's organize {{game_name}}'s features into development epics.

Based on everything we've defined, here are the major feature areas I've identified:

**From Core Gameplay:** {{core_loop_features}}
**From Mechanics:** {{mechanics_features}}
**From Game Type Specifics:** {{game_type_features}}
**From Progression:** {{progression_features}}
**From Level Design:** {{level_features}}
**From Art/Audio:** {{art_audio_features}}
**From Technical:** {{technical_features}}

**Epic Organization Principles:**

1. **Playable Milestones:** Each epic should result in something playable
2. **Dependency Awareness:** Some epics must come before others
3. **Vertical Slices:** Early epics often prove core gameplay
4. **Scope Control:** 1-4 sprints per epic is ideal

How would you like to group these features into epics?"

### 2. Define Epic Structure

**For each epic, elicit:**

"Let's define **Epic {{number}}: {{epic_name}}**

**Epic Definition Questions:**

1. **Goal:** What does completing this epic achieve?
2. **Includes:** What features/systems are in this epic?
3. **Excludes:** What specifically is NOT in this epic?
4. **Dependencies:** What epics must come before this?
5. **Deliverable:** What's the playable result?

Describe this epic."

### 3. Generate High-Level Stories

**For each epic, generate story candidates:**

"For **Epic {{number}}: {{epic_name}}**, let's identify high-level stories.

**Story Principles:**

- Each story is independently valuable
- Stories should be completable in 1-3 days
- Use format: 'As a [player], I can [action] so that [benefit]'

What are the main stories in this epic?"

### 4. Determine Epic Order and Dependencies

**Guide user through sequencing:**

"Now let's determine the order for these epics.

**Common Epic Sequences:**

1. **Foundation First:** Core systems before content
2. **Vertical Slice Early:** Prove gameplay ASAP
3. **Polish Last:** Visual/audio polish after mechanics solid

**Your epics:**
{{list_of_epics}}

What order makes sense for {{game_name}}?"

### 5. Generate Epic Content

Based on the conversation, prepare two outputs:

**A. GDD Epic Summary (goes in gdd.md):**

```markdown
## Development Epics

### Epic Overview

| #   | Epic Name | Scope | Dependencies | Est. Stories |
| --- | --------- | ----- | ------------ | ------------ |

{{epic_table}}

### Recommended Sequence

{{epic_sequence_with_rationale}}

### Vertical Slice

**The first playable milestone:** {{vertical_slice_description}}
```

**B. Detailed Epics File (goes in epics.md):**

```markdown
# {{game_name}} - Development Epics

## Epic Overview

{{epic_overview_table}}

---

## Epic 1: {{epic_1_name}}

### Goal

{{epic_1_goal}}

### Scope

**Includes:**
{{epic_1_includes}}

**Excludes:**
{{epic_1_excludes}}

### Dependencies

{{epic_1_dependencies}}

### Deliverable

{{epic_1_deliverable}}

### Stories

{{epic_1_stories_list}}

---

{{repeat_for_each_epic}}
```

### 6. Present Content and Menu

Show the generated content to the user and present:

"I've drafted the Epic Structure based on our conversation.

**For the GDD (gdd.md):**
[Show GDD epic summary]

**For the Epics file (epics.md):**
[Show detailed epics structure]

**Validation Check:**

- Does each epic deliver playable value?
- Is the sequence achievable?
- Are dependencies clear?

**Select an Option:**
[A] Advanced Elicitation - Refine epic organization
[P] Party Mode - Get perspectives on epic structure
[C] Continue - Save this and move to Success Metrics (Step 13 of 14)"

### 7. Handle Menu Selection

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

- Append epic summary to `{outputFile}`
- Write detailed epics to `{epicsOutputFile}`
- Update frontmatter: `stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]`
- Load `{nextStepFile}`

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [both epic content files saved with frontmatter updated], will you then load and read fully `{nextStepFile}`.

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- Epics cover all major game features
- Each epic has clear scope and deliverable
- Dependencies identified and sequenced
- Both gdd.md and epics.md updated
- High-level stories drafted for each epic
- A/P/C menu presented and handled correctly
- Frontmatter updated with stepsCompleted

### SYSTEM FAILURE:

- Generating epics without user input
- Epics that don't deliver playable value
- Missing key features from GDD
- Not creating separate epics.md file
- Not presenting A/P/C menu after content generation
- Proceeding without user selecting 'C'

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
