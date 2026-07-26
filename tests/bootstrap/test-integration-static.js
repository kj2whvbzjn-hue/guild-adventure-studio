const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('bootstrap-core.js?v=337'));
assert(html.indexOf('bootstrap-core.js?v=337')<html.indexOf('bootstrap-ui.js?v=337'));
assert(html.includes('bootstrap-ui.css?v=337'));
const ui=fs.readFileSync('bootstrap-ui.js','utf8');
assert(!ui.includes('onclick="GKBootstrap'));
assert(ui.includes('MAX_FILE_BYTES'));
console.log('PASS integration static tests: 5 checks');
