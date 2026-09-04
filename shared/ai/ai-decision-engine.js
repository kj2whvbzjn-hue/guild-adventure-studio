(function (root, factory) {
  const trace = typeof module === 'object' && module.exports ? require('./ai-program-trace.js') : root && root.GKSAIProgramTrace;
  const validator = typeof module === 'object' && module.exports ? require('./ai-program-validator.js') : root && root.GKSAIProgramValidator;
  const api = factory(trace, validator);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIDecisionEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trace, Validator) {
  'use strict';
  if (!Trace || !Validator) throw new Error('GKSAIProgramTrace and GKSAIProgramValidator are required');

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function readonly(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(readonly);
      Object.freeze(value);
    }
    return value;
  }
  function traceMeta(runtime, instruction) {
    const mapped = runtime?.source_map?.[instruction?.instruction_id] || {};
    return {
      instruction_id: String(instruction?.instruction_id || ''),
      origin_part_id: String(instruction?.origin_part_id || mapped.origin_part_id || instruction?.instruction_id || ''),
      source_node_id: instruction?.source_node_id ?? mapped.source_node_id ?? null
    };
  }
  function actorOf(ctx) {
    return (Array.isArray(ctx?.units) ? ctx.units : []).find((row) => String(row?.id || '') === String(ctx?.actor_id || '')) || null;
  }
  function searchPopulation(ctx, scope) {
    const units = Array.isArray(ctx?.units) ? ctx.units : [];
    const actor = actorOf(ctx);
    if (!actor) return [];
    const actorSide = String(actor.side || '');
    if (scope === 'SELF') return [actor];
    if (scope === 'ALLY') return units.filter((row) => String(row?.side || '') === actorSide);
    if (scope === 'OTHER_ALLY') return units.filter((row) => String(row?.side || '') === actorSide && String(row?.id || '') !== String(actor?.id || ''));
    if (scope === 'ENEMY') return units.filter((row) => String(row?.side || '') !== actorSide);
    if (scope === 'ANY') return units.slice();
    return [];
  }
  function evaluatePredicateExpression(expression, subject, subjectKind, ctx, handlers) {
    const clauses = Array.isArray(expression?.clauses) ? expression.clauses : [];
    const logic = expression?.logic;
    const results = [];
    if (!['ALL', 'ANY'].includes(logic) || !clauses.length) return {passed: false, clause_results: results, reason: 'predicate_expression_invalid'};
    for (const clause of clauses) {
      let value = false;
      try {
        value = handlers?.predicate?.(String(clause.evaluator || ''), clone(clause.params || {}), subject, subjectKind, ctx) === true;
      } catch (error) {
        return {passed: false, clause_results: results, reason: `predicate_error:${String(error?.code || error?.message || 'error')}`};
      }
      if (clause.negate === true) value = !value;
      results.push({predicate_master_id: String(clause.predicate_master_id || ''), result: value});
      if (logic === 'ALL' && !value) return {passed: false, clause_results: results, reason: null};
      if (logic === 'ANY' && value) return {passed: true, clause_results: results, reason: null};
    }
    return {passed: logic === 'ALL', clause_results: results, reason: null};
  }
  function selectorMaster(binding, ctx, handlers) {
    const id = String(binding?.selector_id || '');
    const direct = handlers?.target_selector_master?.(id, ctx);
    if (direct && typeof direct === 'object') return direct;
    return (Array.isArray(ctx?.target_selectors) ? ctx.target_selectors : []).find((row) => String(row?.id || '') === id) || null;
  }
  function candidateId(row) { return String(row?.id ?? row?.unit_id ?? ''); }
  function hpRatio(row) {
    const max = Math.max(1, Number(row?.max_hp ?? row?.maxHp) || 1);
    return Number(row?.hp || 0) / max;
  }
  function deterministicPick(rows, score, descending) {
    const sorted = rows.slice().sort((a, b) => {
      const av = score(a), bv = score(b), diff = descending ? bv - av : av - bv;
      return diff || candidateId(a).localeCompare(candidateId(b));
    });
    return sorted[0] || null;
  }
  function selectTarget(binding, candidates, ctx, handlers) {
    const master = selectorMaster(binding, ctx, handlers);
    if (!master || master.enabled !== true) return {target_id: null, reason: 'selector_master_unavailable', evaluator: null, rng: null};
    const evaluator = String(master.evaluator || '');
    const rows = (Array.isArray(candidates) ? candidates : []).filter((row) => candidateId(row)).slice();
    if (!rows.length) return {target_id: null, reason: 'legal_target_not_found', evaluator, rng: null};
    if (evaluator === 'selector.lowest_hp_ratio') {
      const selected = deterministicPick(rows, hpRatio, false);
      return {target_id: candidateId(selected), reason: null, evaluator, rng: null};
    }
    if (evaluator === 'selector.highest_hp_ratio') {
      const selected = deterministicPick(rows, hpRatio, true);
      return {target_id: candidateId(selected), reason: null, evaluator, rng: null};
    }
    if (evaluator === 'selector.random') {
      const rng = handlers?.ai_decision_rng;
      if (typeof rng !== 'function') return {target_id: null, reason: 'ai_decision_rng_required', evaluator, rng: null};
      const stable = rows.slice().sort((a, b) => candidateId(a).localeCompare(candidateId(b)));
      const roll = Number(rng());
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return {target_id: null, reason: 'ai_decision_rng_invalid', evaluator, rng: roll};
      const selected = stable[Math.floor(roll * stable.length)];
      return {target_id: candidateId(selected), reason: null, evaluator, rng: roll};
    }
    if (typeof handlers?.selector === 'function') {
      let selected;
      try { selected = handlers.selector(evaluator, clone(binding?.params || {}), readonly(clone(rows)), ctx); }
      catch (error) { return {target_id: null, reason: `selector_error:${String(error?.code || error?.message || 'error')}`, evaluator, rng: null}; }
      const targetId = typeof selected === 'string' ? selected : selected?.target_id;
      if (!rows.some((row) => candidateId(row) === String(targetId || ''))) return {target_id: null, reason: 'selector_result_outside_legal_candidates', evaluator, rng: null};
      return {target_id: String(targetId), reason: null, evaluator, rng: null};
    }
    return {target_id: null, reason: 'selector_evaluator_unsupported', evaluator, rng: null};
  }
  function finishFailure(trace, reason, targetId) {
    return Trace.finish(trace, {status: 'failed', action_id: null, target_id: targetId ?? null, reason});
  }
  function execute(runtime, context, handlers) {
    const ctx = readonly(clone(context || {}));
    const instructions = new Map((runtime?.instructions || []).map((row) => [row.instruction_id, row]));
    const phase = ['reservation', 'execution', 'rethink'].includes(ctx.phase) ? ctx.phase : 'reservation';
    const tick = Math.max(0, Number(ctx.tick) || 0);
    const trace = Trace.create({data_version: runtime?.data_version, battle_id: ctx.battle_id, program_id: runtime?.program_id, program_version: runtime?.program_version, actor_id: ctx.actor_id, seed: ctx.seed});
    let current = runtime?.entry_instruction, step = 0;
    const stack = [];
    const resultSlots = new Map();
    const maxSteps = Math.max(1, Number(runtime?.limits?.max_steps) || 1);
    const maxDepth = Math.max(0, Number(runtime?.limits?.max_subroutine_depth) || 0);

    while (current && step < maxSteps) {
      step += 1;
      const instruction = instructions.get(current);
      if (!instruction) return finishFailure(trace, 'instruction_not_found', null);
      const meta = traceMeta(runtime, instruction);
      const baseEvent = {tick, phase, step, ...meta};

      if (instruction.op === 'SEARCH') {
        const population = searchPopulation(ctx, String(instruction.params?.scope || '')).slice().sort((a, b) => candidateId(a).localeCompare(candidateId(b)));
        const matched = [];
        let predicateError = null;
        for (const subject of population) {
          const result = evaluatePredicateExpression(instruction.params?.predicate, subject, 'UNIT', ctx, handlers);
          if (result.reason) { predicateError = result.reason; break; }
          if (result.passed) matched.push(candidateId(subject));
        }
        if (predicateError) {
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: predicateError}});
          return finishFailure(trace, predicateError, null);
        }
        const found = matched.length > 0;
        const resultSlotId = String(instruction.params?.result_slot_id || '').trim();
        if (resultSlotId) resultSlots.set(resultSlotId, matched.slice());
        Trace.event(trace, {...baseEvent, event_type: 'search', result: found ? 'found' : 'not_found', details: {scope: instruction.params?.scope, candidate_ids: matched, ...(resultSlotId ? {result_slot_id: resultSlotId} : {})}});
        current = found ? instruction.on_found : instruction.on_not_found;
        continue;
      }

      if (instruction.op === 'CONDITION') {
        const subjectScope = String(instruction.params?.subject_scope || ''), subject = subjectScope === 'SELF' ? actorOf(ctx) : subjectScope === 'BATTLE' ? ctx : null;
        if (!subject) {
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: 'condition_subject_unavailable', subject_scope: subjectScope}});
          return finishFailure(trace, 'condition_subject_unavailable', null);
        }
        const result = evaluatePredicateExpression(instruction.params?.predicate, subject, subjectScope, ctx, handlers);
        if (result.reason) {
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: result.reason}});
          return finishFailure(trace, result.reason, null);
        }
        Trace.event(trace, {...baseEvent, event_type: 'condition', result: result.passed ? 'true' : 'false', details: {subject_scope: subjectScope, clause_results: result.clause_results}});
        current = result.passed ? instruction.on_true : instruction.on_false;
        continue;
      }

      if (instruction.op === 'ACTION') {
        let selected;
        try { selected = handlers?.action?.(instruction.evaluator, clone(instruction.params || {}), ctx); }
        catch (error) {
          const reason = `action_error:${String(error?.code || error?.message || 'error')}`;
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason}});
          return finishFailure(trace, reason, null);
        }
        const actionId = typeof selected === 'string' ? selected : selected?.action_id;
        const wait = selected?.wait === true || instruction.evaluator === 'action.wait';
        const targetContract = selected?.target_contract || null;
        const requirement = Validator.selectorRequirement({actionEvaluator: instruction.evaluator, targetContract, wait});
        const binding = instruction.target_selector || null;
        const targetSource = instruction.target_source || null;
        if (requirement === 'UNRESOLVED' || (requirement === 'REQUIRED' && !binding) || (requirement === 'FORBIDDEN' && binding) || (targetSource && requirement !== 'REQUIRED')) {
          const reason = requirement === 'UNRESOLVED' ? 'selector_applicability_unresolved' : requirement === 'REQUIRED' && !binding ? 'target_selector_required' : targetSource && requirement !== 'REQUIRED' ? 'target_source_forbidden' : 'target_selector_forbidden';
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason}});
          return finishFailure(trace, reason, null);
        }
        if (wait) {
          Trace.event(trace, {...baseEvent, event_type: 'wait', result: 'completed', details: {evaluator: instruction.evaluator}});
          return Trace.finish(trace, {status: 'wait', action_id: null, target_id: null, reason: selected?.reason || null});
        }
        if (!actionId) {
          const reason = selected?.reason || 'action_unavailable';
          Trace.event(trace, {...baseEvent, event_type: 'action', result: 'failed', details: {evaluator: instruction.evaluator, reason}});
          return finishFailure(trace, reason, null);
        }

        let targetId = null;
        if (requirement === 'REQUIRED') {
          let legalCandidates = Array.isArray(selected?.legal_candidates) ? selected.legal_candidates : null;
          if (!legalCandidates && typeof handlers?.legal_candidates === 'function') legalCandidates = handlers.legal_candidates(selected, ctx);
          legalCandidates = Array.isArray(legalCandidates) ? legalCandidates : [];
          let sourceDetails = null;
          if (targetSource) {
            const kind = String(targetSource?.kind || ''), resultSlotId = String(targetSource?.result_slot_id || '').trim();
            if (kind !== 'SEARCH_RESULT' || !resultSlotId) {
              const reason = 'target_source_invalid';
              Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason}});
              return finishFailure(trace, reason, null);
            }
            if (!resultSlots.has(resultSlotId)) {
              const reason = 'target_source_uninitialized';
              Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason, result_slot_id: resultSlotId}});
              return finishFailure(trace, reason, null);
            }
            const storedIds = resultSlots.get(resultSlotId) || [], allowed = new Set(storedIds.map((id) => String(id || '')));
            legalCandidates = legalCandidates.filter((row) => allowed.has(candidateId(row)));
            sourceDetails = {kind, result_slot_id: resultSlotId, stored_candidate_ids: storedIds.slice(), legal_candidate_ids: legalCandidates.map(candidateId)};
            if (!legalCandidates.length) {
              const reason = 'target_source_no_legal_candidates';
              Trace.event(trace, {...baseEvent, event_type: 'selector', result: 'failed', details: {selector_id: binding.selector_id, evaluator: selectorMaster(binding, ctx, handlers)?.evaluator || null, target_id: null, reason, target_source: sourceDetails}});
              return finishFailure(trace, reason, null);
            }
          }
          const selection = selectTarget(binding, legalCandidates, ctx, handlers);
          if (selection.evaluator === 'selector.random' && selection.rng != null) Trace.event(trace, {...baseEvent, event_type: 'rng', result: 'completed', rng_stream: 'AI_DECISION', details: {selector_id: binding.selector_id, roll: selection.rng}});
          Trace.event(trace, {...baseEvent, event_type: 'selector', result: selection.target_id ? 'selected' : 'failed', details: {selector_id: binding.selector_id, evaluator: selection.evaluator, target_id: selection.target_id, reason: selection.reason, ...(sourceDetails ? {target_source: sourceDetails} : {})}});
          if (!selection.target_id) return finishFailure(trace, selection.reason || 'target_not_found', null);
          targetId = selection.target_id;
        }
        Trace.event(trace, {...baseEvent, event_type: 'action', result: 'selected', details: {evaluator: instruction.evaluator, action_id: actionId, target_id: targetId}});
        return Trace.finish(trace, {status: 'selected', action_id: actionId, target_id: targetId, reason: null});
      }

      if (instruction.op === 'CALL') {
        if (stack.length >= maxDepth) {
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: 'subroutine_depth_limit'}});
          return finishFailure(trace, 'subroutine_depth_limit', null);
        }
        stack.push(String(instruction.return_instruction_id || ''));
        Trace.event(trace, {...baseEvent, event_type: 'call', result: 'entered', details: {subroutine_id: instruction.subroutine_id, call_depth: stack.length, return_instruction_id: instruction.return_instruction_id}});
        current = instruction.entry_instruction;
        continue;
      }

      if (instruction.op === 'RETURN') {
        if (!stack.length) {
          Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: 'invalid_return'}});
          return finishFailure(trace, 'invalid_return', null);
        }
        const returnInstruction = stack.pop();
        Trace.event(trace, {...baseEvent, event_type: 'call', result: 'returned', details: {subroutine_id: instruction.subroutine_id || null, call_depth: stack.length, return_instruction_id: returnInstruction}});
        current = returnInstruction;
        continue;
      }

      if (instruction.op === 'WAIT' || instruction.op === 'END') {
        Trace.event(trace, {...baseEvent, event_type: instruction.op === 'WAIT' ? 'wait' : 'end', result: 'completed', details: {}});
        return Trace.finish(trace, {status: 'wait', action_id: null, target_id: null, reason: null});
      }

      Trace.event(trace, {...baseEvent, event_type: 'error', result: 'failed', details: {reason: 'unsupported_operation', op: instruction.op}});
      return finishFailure(trace, 'unsupported_operation', null);
    }
    if (current) return Trace.finish(trace, {status: 'step_limit', action_id: null, target_id: null, reason: 'max_steps'});
    return Trace.finish(trace, {status: 'failed', action_id: null, target_id: null, reason: 'path_ended'});
  }

  return Object.freeze({readonly, searchPopulation, evaluatePredicateExpression, selectTarget, execute});
});
