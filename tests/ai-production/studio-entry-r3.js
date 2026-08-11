#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const UI = require('../../studio/ai-production/ai-production-ui.js');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'studio/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'studio/ai-production/ai-production.css'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'studio/ai-production/ai-production-ui.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'studio/ai-production/manifest.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'studio/sw.js'), 'utf8');

assert(html.includes(`runLauncherAction('ai-production')">AI制作</button>`), 'creation launcher must expose AI production');
assert(html.includes('data-view="ai-production">AI制作</button>'), 'hidden navigation must own the AI production label');
assert(html.includes('id="view-ai-production" class="view hidden"'), 'AI production view must start hidden');
assert(html.includes('id="aiProductionRoot"'), 'AI production view must expose its module root');
assert(html.includes("'ai-production':'ai-production'"), 'launcher action must route directly to AI production');
assert(html.includes('./ai-production/ai-production.css?v=1'));
assert(html.includes('./ai-production/ai-production-ui.js?v=1'));

const showViewStart = html.indexOf('function showView(name){');
const targetCheck = html.indexOf("const target=document.getElementById('view-'+name);if(!target)return false;", showViewStart);
const hideViews = html.indexOf("document.querySelectorAll('.view').forEach", showViewStart);
assert(targetCheck > showViewStart && targetCheck < hideViews, 'invalid view names must be rejected before hiding the current view');
assert(html.includes("if(name==='ai-production')window.GKSAIProductionUI?.render();"));

const rootElement = {innerHTML: ''};
const fakeDocument = {getElementById: (id) => id === 'aiProductionRoot' ? rootElement : null};
assert.strictEqual(UI.render(fakeDocument), true);
assert(rootElement.innerHTML.includes('AI部品パレット'));
assert(rootElement.innerHTML.includes('一致するAI部品がありません'));
assert.strictEqual(UI.render({getElementById: () => null}), false);

assert(css.includes('@media(max-width:700px)'), 'AI production entry must have a mobile layout');
assert(!uiSource.includes('localStorage'), 'R3 UI must not create an independent storage path');
assert(uiSource.includes('GKSAIProgramStore'), 'evolved UI must connect R5 editing through the R2 project store');
assert(!uiSource.includes('localStorage'), 'AI UI must retain the Studio persistence boundary');
assert.strictEqual(manifest.entrypoints.ui, 'ai-production-ui.js');
assert(manifest.public_globals.includes('GKSAIProductionUI'));
assert(sw.includes('./ai-production/ai-production-ui.js?v=1'), 'PWA shell must include the AI production UI');
assert(sw.includes('./ai-production/ai-production.css?v=1'), 'PWA shell must include the AI production CSS');

console.log('AI_STUDIO_ENTRY_R3_OK launcher=1 navigation=1 recent=1 mobile=1 invalid_view_guard=1');
