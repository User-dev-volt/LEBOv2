---
name: 'step-05-domain'
description: 'Explore domain-specific requirements for complex domains (optional step)'

# File References
nextStepFile: './step-06-innovation.md'
outputFile: '{planning_artifacts}/prd.md'
domainComplexityCSV: '../data/domain-complexity.csv'

# Task References
advancedElicitationTask: 'skill:bmad-advanced-elicitation'
partyModeWorkflow: 'skill:bmad-party-mode'
---

# Step 5: Domain-Specific Requirements (Optional)

**Progress: Step 5 of 13** - Next: Innovation Focus

## STEP GOAL:

For complex domains only that have a mapping in {domainComplexityCSV}, explore domain-specific constraints, compliance requirements, and technical considerations that shape the product.


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
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read
- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are a product-focused PM facilitator collaborating with an expert peer
- ✅ We engage in collaborative dialogue, not command-response
- ✅ You bring structured thinking and facilitation skills, while the user brings domain expertise

### Step-Specific Rules:

- 🎯 This step is OPTIONAL - only needed for complex domains
- 🚫 SKIP if domain complexity is "low" from step-02
- 💬 APPROACH: Natural conversation to discover domain-specific needs
- 🎯 Focus on constraints, compliance, and domain patterns

## EXECUTION PROTOCOLS:

- 🎯 Check domain complexity from step-02 classification first
- ⚠️ If complexity is "low", offer to skip this step
- ⚠️ Present A/P/C menu after domain requirements defined (or skipped)
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update output file frontmatter, adding this step name to the end of the list of stepsCompleted
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Domain classification from step-02 is available
- If complexity is low, this step may be skipped
- Domain CSV data provides complexity reference
- Focus on domain-specific constraints, not general requirements

## YOUR TASK:

For complex domains, explore what makes this domain special:
- **Compliance requirements** - regulations, standards, certifications
- **Technical constraints** - security, privacy, integration requirements
- **Domain patterns** - common patterns, best practices, anti-patterns
- **Risks and mitigations** - what could go wrong, how to prevent it

## DOMAIN DISCOVERY SEQUENCE:

### 1. Check Domain Complexity

**Review classification from step-02:**

- What's the domain complexity level? (low/medium/high)
- What's the specific domain? (healthcare, fintech, education, etc.)

**If complexity is LOW:**

Offer to skip:
"The domain complexity from our discovery is low. We may not need deep domain-specific requirements. Would you like to:
- [C] Skip this step and move to Innovation
- [D] Do domain exploration anyway"

**If complexity is MEDIUM or HIGH:**

Proceed with domain exploration.

### 2. Load Domain Reference Data

**Attempt subprocess data lookup:**

"Your task: Lookup data in {domainComplexityCSV}

**Search criteria:**
- Find row where domain matches {{domainFromStep02}}

**Return format:**
Return ONLY the matching row as a YAML-formatted object with these fields:
domain, complexity, typical_concerns, compliance_requirements

**Do NOT return the entire CSV - only the matching row.**"

**Graceful degradation (if Task tool unavailable):**
- Load the CSV file directly
- Find the matching row manually
- Extract required fields
- Understand typical concerns and compliance requirements

### 3. Explore Domain-Specific Concerns

**Start with what you know:**

Acknowledge the domain and explore what makes it complex:
- What regulations apply? (HIPAA, PCI-DSS, GDPR, SOX, etc.)
- What standards matter? (ISO, NIST, domain-specific standards)
- What certifications are needed? (security, privacy, domain-specific)
- What integrations are required? (EMR systems, payment processors, etc.)

**Explore technical constraints:**
- Security requirements (encryption, audit logs, access control)
- Privacy requirements (data handling, consent, retention)
- Performance requirements (real-time, batch, latency)
- Availability requirements (uptime, disaster recovery)

### 4. Document Domain Requirements

**Structure the requirements around key concerns:**

```markdown
### Compliance & Regulatory
- [Specific requirements]

### Technical Constraints
- [Security, privacy, performance needs]

### Integration Requirements
- [Required systems and data flows]

### Risk Mitigations
- [Domain-specific risks and how to address them]
```

### 5. Validate Completeness

**Check with the user:**

"Are there other domain-specific concerns we should consider? For [this domain], what typically gets overlooked?"

### N. Present MENU OPTIONS

Display: "**Select:** [A] Advanced Elicitation [P] Party Mode [C] Continue - Save and Proceed to Innovation (Step 6 of 13)"

#### Menu Handling Logic:
- IF A: Read fully and follow: {advancedElicitationTask}, and when finished redisplay the menu
- IF P: Read fully and follow: {partyModeWorkflow}, and when finished redisplay the menu
- IF C: Save content to {outputFile}, update frontmatter, then read fully and follow: {nextStepFile}
- IF Any other comments or queries: help user respond then [Redisplay Menu Options](#n-present-menu-options)

#### EXECUTION RULES:
- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed to next step when user selects 'C'
- After other menu items execution, return to this menu

## APPEND TO DOCUMENT

When user selects 'C', append to `{outputFile}`:

```markdown
## Domain-Specific Requirements

{{discovered domain requirements}}
```

If step was skipped, append nothing and proceed.

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [content saved or skipped], will you then read fully and follow: `{nextStepFile}` to explore innovation.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Domain complexity checked before proceeding
- Offered to skip if complexity is low
- Natural conversation exploring domain concerns
- Compliance, technical, and integration requirements identified
- Domain-specific risks documented with mitigations
- User validated completeness
- Content properly saved (or step skipped) when C selected

### ❌ SYSTEM FAILURE:

- Not checking domain complexity first
- Not offering to skip for low-complexity domains
- Missing critical compliance requirements
- Not exploring technical constraints
- Not asking about domain-specific risks
- Being generic instead of domain-specific
- Proceeding without user validation

**Master Rule:** This step is OPTIONAL for simple domains. For complex domains, focus on compliance, constraints, and domain patterns. Natural conversation, not checklists.
