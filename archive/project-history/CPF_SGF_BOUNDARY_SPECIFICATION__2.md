# CPF / Scenario Support Framework Boundary Specification

Version: 2.0.0  
Build: 328  
Decisions: DEC-SGF-0001, DEC-SGF-0002, DEC-SGF-0003

## Purpose

This specification formalizes the Build 328 decision to freeze built-in automatic scenario generation while preserving and reusing the implemented SGF components as a scenario production support layer.

## CPF ownership

CPF owns source import, normalization, project locks, transactions and rollback, node/dependency synchronization, snapshots, milestones, protected fields, candidate Revision storage, comparison, impact analysis, validation, approval, merge, history, and export readiness.

## Scenario Support Framework ownership

The support framework owns:

- chapter, section, event, and dialogue design forms;
- prompt and writing-brief assembly;
- copy-ready output for external AI, writers, or manual drafting;
- pasted-result intake assistance;
- Story Preview linkage;
- consistency-check request assembly and result presentation;
- candidate rationale, source snapshot reference, and revision comparison metadata.

## Frozen ownership

The support framework does not execute built-in AI generation, call an external AI API, automatically regenerate content, automatically score final quality, or automatically approve/merge content.

## Integration contract

1. CPF provides an immutable snapshot and target scope to the support framework.
2. The support framework produces a prompt, writing brief, or candidate intake package.
3. Draft text is created manually or by an external tool and pasted/imported into Studio.
4. CPF validates and stores it as a candidate Revision.
5. Only explicit human approval may promote the candidate.
6. Neither the support framework nor an external AI may update current Nodes, locks, approvals, milestones, or Export directly.

## Migration mapping

- Story Importer and Story Structure Analyzer remain CPF functionality.
- Story Preview remains active under DEC-CPF-0002.
- CPF-002A remains the import-safety and non-destructive integration gate.
- Former generator input forms become scenario design forms.
- Former Prompt Builder becomes the official copy-ready instruction generator.
- Former generated candidate Revision storage becomes manual/external-AI candidate storage.
- Consistency checks remain active for all manually or externally produced scenarios.
- API connector, automatic regeneration, automatic scoring, and automatic approval remain frozen.

## Reactivation rule

Automatic generation may not be reactivated by configuration alone. Reactivation requires a new formal Decision, implementation plan, cost assessment, API/security review, compatibility review, and complete regression audit.
