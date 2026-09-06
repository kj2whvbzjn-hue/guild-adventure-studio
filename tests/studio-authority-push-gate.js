'use strict';
const fs=require('fs'),assert=require('assert');const html=fs.readFileSync('studio/index.html','utf8');
const push=html.match(/async function pushToAuthority\(\)\{[\s\S]*?\n\}/)?.[0]||'';
for(const token of ['buildAuthorityPushCandidate','buildFullImportGateReport','remote.headSha!==base.commit_sha','node.sha!==base.blob_sha','candidate.gitBlobSha','confirm(','getGitHeadExplicit(c)','createGitBlobExplicit','createGitTreeExplicit','createGitCommitExplicit','updateGitRefExplicit','verifyAuthorityPostCommit(c,commit.sha,candidate.gitBlobSha)'])assert(push.includes(token),token);
assert(!push.includes('pushToGitHub('));
assert(html.includes("body:JSON.stringify({sha:commitSha,force:false})"));
const candidate=html.match(/async function buildAuthorityPushCandidate\(\)\{[\s\S]*?\n\}/)?.[0]||'';
assert((candidate.match(/JSON\.stringify/g)||[]).length===1,'candidate serialize must occur once');
console.log('STUDIO_AUTHORITY_PUSH_GATE_OK');
