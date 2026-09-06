'use strict';
const fs=require('fs'),assert=require('assert');const html=fs.readFileSync('studio/index.html','utf8');
const pull=html.match(/async function pullFromAuthority\(\)\{[\s\S]*?\n\}/)?.[0]||'';
for(const token of ['getGitHeadExplicit(c)','resolveAuthorityProjectDataBlob(remote)','getGitBlobBytesExplicit','buildFullImportGateReport','authorityNormalizationChanged','confirm(','createBackup','commitAuthorityWorkingCopyAtomic','saveAuthorityRevision'])assert(pull.includes(token),token);
assert(pull.includes('AUTHORITY_PULL_NORMALIZATION_REQUIRED'));
const commit=html.match(/async function commitAuthorityWorkingCopyAtomic\([\s\S]*?\n\}/)?.[0]||'';
assert(commit.includes('safeStorageSet(projectStorageKey(projectId),rawText'));
assert(!commit.includes("persist("));
console.log('STUDIO_AUTHORITY_PULL_GATE_OK');
