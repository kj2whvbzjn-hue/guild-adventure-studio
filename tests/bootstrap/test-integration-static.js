const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync('index.html','utf8');
const studio=fs.readFileSync('studio/index.html','utf8');
const ui=fs.readFileSync('bootstrap-ui.js','utf8');

const legacyBootstrap=runtime.includes('bootstrap-core.js') || runtime.includes('bootstrap-ui.js');
if(legacyBootstrap){
  assert(runtime.includes('bootstrap-core.js'));
  assert(runtime.indexOf('bootstrap-core.js')<runtime.indexOf('bootstrap-ui.js'));
  assert(runtime.includes('bootstrap-ui.css'));
}else{
  assert(runtime.includes('BUILD424'));
  assert(runtime.includes('Mobile Runtime Cleanup'));
  assert(studio.includes('export-core.js'));
}
assert(!ui.includes('onclick="GKBootstrap'));
assert(ui.includes('MAX_FILE_BYTES'));
console.log(`PASS integration static tests: current ${legacyBootstrap?'bootstrap':'standalone runtime'} architecture`);
