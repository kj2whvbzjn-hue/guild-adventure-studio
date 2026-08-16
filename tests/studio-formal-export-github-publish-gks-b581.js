const assert=require('node:assert/strict');
const fs=require('node:fs');
const Export=require('../studio/export-core.js');
const html=fs.readFileSync('studio/index.html','utf8');

assert(html.includes('onclick="openGameDataDeployFromExport()"'),'Formal Export must route to dedicated Game data deployment window');
assert(html.includes('id="view-gamedatadeploy"'),'Dedicated Game data deployment view missing');
assert(html.includes('async function publishPhpExportToGitHub()'),'B581 compatibility publisher entry missing');
const start=html.indexOf('async function publishPhpExportToGitHub()');
const end=html.indexOf('\nfunction openGameDataDeployFromExport()',start);
const body=html.slice(start,end);
assert(body.includes('openGameDataDeployFromExport()'),'Legacy publisher must forward to dedicated Game window');
assert(!body.includes('ghRequest('),'Legacy publisher must no longer write GitHub directly');
assert(Export.EXPORT_PATHS.includes('event/flags.json'),'Formal Export contract must contain flags.json');
const out=Export.buildData({chapters:[],quests:[],events:[],flags:[{id:'FLAG-A',name:'A',default_value:true}],masters:{}});
assert.deepEqual(out['event/flags.json'],[{id:'FLAG-A',name:'A',default_value:true}]);
console.log('PASS B581 compatibility: formal Export still contains Flag data while GitHub write is routed to B582 dedicated Game deployment window');
