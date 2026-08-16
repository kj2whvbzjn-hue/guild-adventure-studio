(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAILayoutModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LAYOUT_VERSION = 1;
  const DEFAULT_WIDTH = 8;
  const DEFAULT_HEIGHT = 8;
  const LAYOUT_ID_PATTERN = /^AIL-([0-9]+)$/;
  const ROTATIONS = new Set([0, 90, 180, 270]);
  const EXTENSION_SHAPES = new Set(['straight', 'corner']);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
  const isGridInt = (value) => Number.isInteger(value) && value >= 0;
  const cellKey = (x, y) => `${x},${y}`;

  function validateLayout(value) {
    const errors = [];
    if (!isObject(value)) return ['layout must be an object'];
    if (value.layout_version !== LAYOUT_VERSION) errors.push(`layout_version must be ${LAYOUT_VERSION}`);
    if (!isNonEmptyString(value.layout_id) || !LAYOUT_ID_PATTERN.test(value.layout_id)) errors.push('layout_id must match AIL-0001');
    if (!isNonEmptyString(value.program_id)) errors.push('program_id is required');
    if (!Number.isInteger(value.width) || value.width < 1) errors.push('width must be a positive integer');
    if (!Number.isInteger(value.height) || value.height < 1) errors.push('height must be a positive integer');
    if (!Array.isArray(value.chips)) errors.push('chips must be an array');
    if (!Array.isArray(value.extensions)) errors.push('extensions must be an array');
    if (errors.length) return errors;

    const chipIds = new Set();
    const extensionIds = new Set();
    const occupied = new Map();

    for (let index = 0; index < value.chips.length; index += 1) {
      const chip = value.chips[index];
      const at = `chips[${index}]`;
      if (!isObject(chip)) { errors.push(`${at} must be an object`); continue; }
      if (!isNonEmptyString(chip.instance_id)) errors.push(`${at}.instance_id is required`);
      else if (chipIds.has(chip.instance_id)) errors.push(`${at}.instance_id is duplicated: ${chip.instance_id}`);
      else chipIds.add(chip.instance_id);
      if (!isGridInt(chip.x)) errors.push(`${at}.x must be a non-negative integer`);
      if (!isGridInt(chip.y)) errors.push(`${at}.y must be a non-negative integer`);
      if (!ROTATIONS.has(chip.rotation)) errors.push(`${at}.rotation must be 0,90,180,270`);
      if (isGridInt(chip.x) && isGridInt(chip.y)) {
        if (chip.x >= value.width || chip.y >= value.height) errors.push(`${at} is outside the board`);
        const key = cellKey(chip.x, chip.y);
        if (occupied.has(key)) errors.push(`${at} overlaps ${occupied.get(key)} at ${key}`);
        else occupied.set(key, at);
      }
    }

    for (let index = 0; index < value.extensions.length; index += 1) {
      const extension = value.extensions[index];
      const at = `extensions[${index}]`;
      if (!isObject(extension)) { errors.push(`${at} must be an object`); continue; }
      if (!isNonEmptyString(extension.id)) errors.push(`${at}.id is required`);
      else if (extensionIds.has(extension.id)) errors.push(`${at}.id is duplicated: ${extension.id}`);
      else extensionIds.add(extension.id);
      if (!isGridInt(extension.x)) errors.push(`${at}.x must be a non-negative integer`);
      if (!isGridInt(extension.y)) errors.push(`${at}.y must be a non-negative integer`);
      if (!EXTENSION_SHAPES.has(extension.shape)) errors.push(`${at}.shape must be straight or corner`);
      if (!ROTATIONS.has(extension.rotation)) errors.push(`${at}.rotation must be 0,90,180,270`);
      if (isGridInt(extension.x) && isGridInt(extension.y)) {
        if (extension.x >= value.width || extension.y >= value.height) errors.push(`${at} is outside the board`);
        const key = cellKey(extension.x, extension.y);
        if (occupied.has(key)) errors.push(`${at} overlaps ${occupied.get(key)} at ${key}`);
        else occupied.set(key, at);
      }
    }
    return errors;
  }

  function assertValidLayout(value) {
    const errors = validateLayout(value);
    if (errors.length) {
      const error = new Error(`Invalid AI layout:\n${errors.join('\n')}`);
      error.code = 'AI_LAYOUT_INVALID';
      error.errors = errors.slice();
      throw error;
    }
    return value;
  }

  function normalizeLayout(value) {
    const source = isObject(value) ? clone(value) : {};
    const normalized = {
      layout_version: source.layout_version === LAYOUT_VERSION ? LAYOUT_VERSION : LAYOUT_VERSION,
      layout_id: typeof source.layout_id === 'string' ? source.layout_id : '',
      program_id: typeof source.program_id === 'string' ? source.program_id : '',
      width: Number.isInteger(source.width) && source.width > 0 ? source.width : DEFAULT_WIDTH,
      height: Number.isInteger(source.height) && source.height > 0 ? source.height : DEFAULT_HEIGHT,
      chips: Array.isArray(source.chips) ? source.chips.map((chip) => ({
        instance_id: String(chip?.instance_id || ''),
        x: Number.isInteger(chip?.x) ? chip.x : -1,
        y: Number.isInteger(chip?.y) ? chip.y : -1,
        rotation: Number.isInteger(chip?.rotation) ? chip.rotation : 0
      })) : [],
      extensions: Array.isArray(source.extensions) ? source.extensions.map((extension) => ({
        id: String(extension?.id || ''),
        x: Number.isInteger(extension?.x) ? extension.x : -1,
        y: Number.isInteger(extension?.y) ? extension.y : -1,
        shape: String(extension?.shape || ''),
        rotation: Number.isInteger(extension?.rotation) ? extension.rotation : 0
      })) : []
    };
    return normalized;
  }

  function createLayout(layoutId, programId, width, height) {
    const layout = {
      layout_version: LAYOUT_VERSION,
      layout_id: String(layoutId || ''),
      program_id: String(programId || ''),
      width: Number.isInteger(width) && width > 0 ? width : DEFAULT_WIDTH,
      height: Number.isInteger(height) && height > 0 ? height : DEFAULT_HEIGHT,
      chips: [],
      extensions: []
    };
    return clone(assertValidLayout(layout));
  }

  function nextLayoutId(layouts) {
    const rows = Array.isArray(layouts) ? layouts : [];
    const used = new Set(rows.map((layout) => String(layout?.layout_id || '')));
    let max = 0;
    for (const id of used) {
      const match = LAYOUT_ID_PATTERN.exec(id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    let number = max + 1;
    let candidate = `AIL-${String(number).padStart(4, '0')}`;
    while (used.has(candidate)) {
      number += 1;
      candidate = `AIL-${String(number).padStart(4, '0')}`;
    }
    return candidate;
  }

  function replaceAtCell(layout, itemType, item) {
    const next = normalizeLayout(assertValidLayout(normalizeLayout(layout)));
    if (itemType === 'chip') {
      const candidate = {
        instance_id: String(item?.instance_id || ''),
        x: item?.x,
        y: item?.y,
        rotation: item?.rotation
      };
      next.chips = next.chips.filter((chip) => chip.instance_id !== candidate.instance_id);
      next.chips.push(candidate);
    } else if (itemType === 'extension') {
      const candidate = {
        id: String(item?.id || ''),
        x: item?.x,
        y: item?.y,
        shape: String(item?.shape || ''),
        rotation: item?.rotation
      };
      next.extensions = next.extensions.filter((extension) => extension.id !== candidate.id);
      next.extensions.push(candidate);
    } else {
      throw new Error(`Unsupported layout item type: ${itemType}`);
    }
    return clone(assertValidLayout(next));
  }

  function upsertChip(layout, chip) { return replaceAtCell(layout, 'chip', chip); }
  function upsertExtension(layout, extension) { return replaceAtCell(layout, 'extension', extension); }

  function removeChip(layout, instanceId) {
    const next = normalizeLayout(assertValidLayout(normalizeLayout(layout)));
    next.chips = next.chips.filter((chip) => chip.instance_id !== String(instanceId || ''));
    return clone(assertValidLayout(next));
  }

  function removeExtension(layout, extensionId) {
    const next = normalizeLayout(assertValidLayout(normalizeLayout(layout)));
    next.extensions = next.extensions.filter((extension) => extension.id !== String(extensionId || ''));
    return clone(assertValidLayout(next));
  }

  function resize(layout, width, height) {
    const next = normalizeLayout(assertValidLayout(normalizeLayout(layout)));
    next.width = width;
    next.height = height;
    return clone(assertValidLayout(next));
  }

  return Object.freeze({
    LAYOUT_VERSION,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    ROTATIONS: Object.freeze(Array.from(ROTATIONS)),
    EXTENSION_SHAPES: Object.freeze(Array.from(EXTENSION_SHAPES)),
    normalizeLayout,
    validateLayout,
    assertValidLayout,
    createLayout,
    nextLayoutId,
    upsertChip,
    removeChip,
    upsertExtension,
    removeExtension,
    resize,
    cellKey
  });
});
