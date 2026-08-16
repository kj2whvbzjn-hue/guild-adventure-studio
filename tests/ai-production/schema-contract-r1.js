#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const fixtures = path.join(__dirname, 'fixtures');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveRef(schemaRoot, ref) {
  assert(ref.startsWith('#/'), `Only local schema refs are supported: ${ref}`);
  return ref.slice(2).split('/').reduce((value, key) => value[key], schemaRoot);
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validate(value, schema, schemaRoot, location = '$') {
  if (schema.$ref) return validate(value, resolveRef(schemaRoot, schema.$ref), schemaRoot, location);
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${location}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${location}: value is outside enum`);

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((type) => matchesType(value, type))) {
      errors.push(`${location}: expected ${allowed.join('|')}`);
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: string is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${location}: pattern mismatch`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${location}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: too few items`);
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => JSON.stringify(item)));
      if (unique.size !== value.length) errors.push(`${location}: items must be unique`);
    }
    if (schema.items) value.forEach((item, index) => errors.push(...validate(item, schema.items, schemaRoot, `${location}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push(`${location}.${required}: required`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (properties[key]) errors.push(...validate(item, properties[key], schemaRoot, `${location}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${location}.${key}: additional property`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validate(item, schema.additionalProperties, schemaRoot, `${location}.${key}`));
      }
    }
  }
  return errors;
}

function semanticErrors(kind, value) {
  const errors = [];
  if (kind === 'node') {
    const prefixes = {condition: 'AIC-', target: 'AIT-', action: 'AIA-'};
    if (prefixes[value.node_type] && !value.id.startsWith(prefixes[value.node_type])) errors.push('node id prefix does not match node_type');
    const inputs = Array.isArray(value.ports?.inputs) ? value.ports.inputs : [];
    const outputs = Array.isArray(value.ports?.outputs) ? value.ports.outputs : [];
    if (inputs.length !== 1 || inputs[0]?.id !== 'in') errors.push('node must have exactly one in port');
    if (value.node_type === 'condition' && (outputs.length !== 2 || outputs[0]?.id !== 'true' || outputs[1]?.id !== 'false')) errors.push('condition outputs must be true,false');
    if (value.node_type === 'target' && (outputs.length !== 1 || outputs[0]?.id !== 'next')) errors.push('target output must be next');
    if (value.node_type === 'action' && outputs.length !== 0) errors.push('action must have zero outputs');
  }
  if (kind === 'layout') {
    const occupied = new Set();
    const chipIds = new Set();
    const extensionIds = new Set();
    for (const chip of value.chips || []) {
      if (chipIds.has(chip.instance_id)) errors.push(`duplicate chip instance ${chip.instance_id}`);
      chipIds.add(chip.instance_id);
      if (chip.x >= value.width || chip.y >= value.height) errors.push(`chip ${chip.instance_id} is outside board`);
      const key = `${chip.x},${chip.y}`;
      if (occupied.has(key)) errors.push(`layout cell overlap ${key}`);
      occupied.add(key);
    }
    for (const extension of value.extensions || []) {
      if (extensionIds.has(extension.id)) errors.push(`duplicate extension ${extension.id}`);
      extensionIds.add(extension.id);
      if (extension.x >= value.width || extension.y >= value.height) errors.push(`extension ${extension.id} is outside board`);
      const key = `${extension.x},${extension.y}`;
      if (occupied.has(key)) errors.push(`layout cell overlap ${key}`);
      occupied.add(key);
    }
  }
  if (kind === 'program') {
    const ids = value.nodes.map((node) => node.instance_id);
    if (new Set(ids).size !== ids.length) errors.push('node instance ids must be unique');
    if (!ids.includes(value.entry_node_id)) errors.push('entry node must exist');
    const edgeIds = value.edges.map((edge) => edge.edge_id);
    if (new Set(edgeIds).size !== edgeIds.length) errors.push('edge ids must be unique');
    for (const edge of value.edges) {
      if (!ids.includes(edge.from.node_id) || !ids.includes(edge.to.node_id)) errors.push(`edge ${edge.edge_id} references an unknown node`);
    }
    for (const subroutine of value.subroutines) {
      if (!ids.includes(subroutine.entry_node_id)) errors.push(`subroutine ${subroutine.id} references an unknown node`);
    }
  }
  if (kind === 'runtime') {
    const ids = value.instructions.map((instruction) => instruction.instruction_id);
    if (new Set(ids).size !== ids.length) errors.push('instruction ids must be unique');
    if (!ids.includes(value.entry_instruction)) errors.push('entry instruction must exist');
    for (const instruction of value.instructions) {
      for (const key of ['next', 'on_true', 'on_false']) {
        if (instruction[key] != null && !ids.includes(instruction[key])) errors.push(`${instruction.instruction_id}.${key} references an unknown instruction`);
      }
    }
    for (const instructionId of Object.keys(value.source_map)) {
      if (!ids.includes(instructionId)) errors.push(`source_map references unknown instruction ${instructionId}`);
    }
  }
  return errors;
}

const contracts = [
  ['node', 'ai-node.schema.json'],
  ['program', 'ai-program.schema.json'],
  ['layout', 'ai-layout.schema.json'],
  ['runtime', 'ai-runtime.schema.json'],
  ['trace', 'ai-trace.schema.json']
];

for (const [kind, schemaFile] of contracts) {
  const schema = readJson(path.join(root, 'schemas/ai', schemaFile));
  const valid = readJson(path.join(fixtures, `valid-${kind}.json`));
  const invalid = readJson(path.join(fixtures, `invalid-${kind}.json`));
  const validErrors = [...validate(valid, schema, schema), ...semanticErrors(kind, valid)];
  const invalidErrors = [...validate(invalid, schema, schema), ...semanticErrors(kind, invalid)];
  assert.deepStrictEqual(validErrors, [], `${kind} valid fixture failed:\n${validErrors.join('\n')}`);
  assert(invalidErrors.length > 0, `${kind} invalid fixture unexpectedly passed`);
}


const actionSchema = readJson(path.join(root, 'schemas/ai', 'ai-node.schema.json'));
const validAction = readJson(path.join(fixtures, 'valid-action-node.json'));
const validActionErrors = [...validate(validAction, actionSchema, actionSchema), ...semanticErrors('node', validAction)];
assert.deepStrictEqual(validActionErrors, [], `action valid fixture failed:
${validActionErrors.join('\n')}`);

console.log('AI_SCHEMA_CONTRACT_R1_OK schemas=5 valid=6 invalid=5 action_terminal=1 layout_v1=1');
