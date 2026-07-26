const assert=require('assert');
const Core=require('../../bootstrap-core.js');
const fs=require('fs'),path=require('path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8'));
let v=load('valid-ready.json');assert.equal(Core.validate(v).length,0);assert.equal(Core.summary(v).valid,true);assert.equal(Core.readiness(v),'IMPLEMENTATION_READY');
v=load('valid-blocked.json');assert.equal(Core.validate(v).length,0);assert.equal(Core.blockers(v).length,1);
v=load('invalid-authority.json');const codes=Core.validate(v).map(x=>x.code);['REPOSITORY_WRITE_NOT_HUMAN_ONLY','AI_SELF_APPROVAL_FORBIDDEN','WARNINGS_NOT_ARRAY','READY_WITH_BLOCKERS'].forEach(c=>assert(codes.includes(c),c));
assert(Core.LEVELS.includes('SUBMISSION_READY'));
console.log('PASS bootstrap-core tests: 4 scenarios');
