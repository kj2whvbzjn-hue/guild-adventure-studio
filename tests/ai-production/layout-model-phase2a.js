#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Layout = require('../../shared/ai/ai-layout-model.js');

assert.strictEqual(Layout.LAYOUT_VERSION, 1);
assert.strictEqual(Layout.DEFAULT_WIDTH, 8);
assert.strictEqual(Layout.DEFAULT_HEIGHT, 8);
assert.strictEqual(Layout.nextLayoutId([]), 'AIL-0001');
assert.strictEqual(Layout.nextLayoutId([{layout_id:'AIL-0001'},{layout_id:'AIL-0010'}]), 'AIL-0011');

let layout = Layout.createLayout('AIL-0001', 'AIP-0001');
assert.deepStrictEqual(layout, {
  layout_version: 1,
  layout_id: 'AIL-0001',
  program_id: 'AIP-0001',
  width: 8,
  height: 8,
  chips: [],
  extensions: []
});

layout = Layout.upsertChip(layout, {instance_id:'AIN-0001',x:1,y:1,rotation:0});
layout = Layout.upsertExtension(layout, {id:'EXT-0001',x:2,y:1,shape:'straight',rotation:0});
layout = Layout.upsertChip(layout, {instance_id:'AIN-0002',x:3,y:1,rotation:90});
assert.strictEqual(Layout.validateLayout(layout).length, 0);
assert.strictEqual(Object.prototype.hasOwnProperty.call(layout, 'edges'), false, 'layout must not persist Formal Program edges');

const roundTrip = JSON.parse(JSON.stringify(layout));
assert.deepStrictEqual(Layout.normalizeLayout(roundTrip), layout, 'layout JSON roundtrip must be stable');

layout = Layout.upsertChip(layout, {instance_id:'AIN-0002',x:3,y:2,rotation:180});
assert.deepStrictEqual(layout.chips.find(x=>x.instance_id==='AIN-0002'), {instance_id:'AIN-0002',x:3,y:2,rotation:180});

assert.throws(
  () => Layout.upsertExtension(layout, {id:'EXT-0002',x:1,y:1,shape:'corner',rotation:90}),
  (error) => error && error.code === 'AI_LAYOUT_INVALID' && error.errors.some(x=>x.includes('overlaps')),
  'chip/extension cell overlap must fail closed'
);

assert.throws(
  () => Layout.resize(layout, 2, 2),
  (error) => error && error.code === 'AI_LAYOUT_INVALID' && error.errors.some(x=>x.includes('outside the board')),
  'resize must reject a board that would discard placed items'
);

layout = Layout.removeExtension(layout, 'EXT-0001');
layout = Layout.removeChip(layout, 'AIN-0001');
assert.strictEqual(layout.extensions.length, 0);
assert.strictEqual(layout.chips.length, 1);

const invalidRotation = Object.assign({}, layout, {chips:[{instance_id:'AIN-0002',x:1,y:1,rotation:45}]});
assert(Layout.validateLayout(invalidRotation).some(x=>x.includes('rotation')));

console.log('AI_LAYOUT_MODEL_PHASE2A_OK layout_version=1 default=8x8 separate_edges=1 collision_guard=1 roundtrip=1');
