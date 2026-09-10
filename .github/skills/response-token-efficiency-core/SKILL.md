---
name: response-token-efficiency-core
description: Select the minimum-effective response mode to reduce output tokens without hiding risk, failure, or uncertainty.
---

# GCW Response Token Efficiency Core

Reference global policies in .github/copilot-instructions.md.

## Purpose

Apply the lightest response mode that still fits the task.

## Inputs

- task_type: action | reasoning | document | mixed
- user_style: terse | detailed
- clarification_needed: yes | no
- failure_state: none | partial | blocked

## Procedure

1. Use Action-Compressed for code edits, tools, file ops, fixes, installs, and repetitive execution.
2. Use Conversational for why/how questions, trade-offs, ambiguity, and debugging diagnosis.
3. Use Creative/Document only for explicit writing requests.
4. Mirror user style: terse user -> terse response; detailed user -> deeper response.
5. For mixed tasks, do action first, then explanation.
6. State uncertainty explicitly and explain failures at the shortest useful length.

## Output contract

Return:

- selected_mode
- response_shape
- clarification_question if needed
- failure_or_uncertainty_note if needed

## Guardrails

- No praise, filler, or preamble.
- No redundant recap when result is obvious.
- No default closing offer.
- Keep one mode per response unless the task is mixed.
