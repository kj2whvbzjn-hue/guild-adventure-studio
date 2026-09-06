'use strict';
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('studio/index.html','utf8');
assert(html.includes("const SYSTEM_AUTHORITY_PROJECT_DATA_PATH='project-data.json'"));
assert(!html.includes('id="authorityProjectDataPath"'));
assert(html.includes('id="authorityGhBranch" type="text" name="gk-authority-branch" autocomplete="username"'));
assert(html.includes('id="authorityGhToken" type="password" name="gk-authority-token" autocomplete="current-password"'));
assert(html.includes("localStorage.setItem(AUTHORITY_CONNECTION_KEY,JSON.stringify({owner,repository}))"));
assert(html.includes('function ghRequestWithExplicitConfig('));
const body=name=>{const m=html.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));assert(m,`missing ${name}`);let i=m.index+m[0].length-1,d=0,q=null,e=false;for(;i<html.length;i++){const c=html[i];if(q){if(e)e=false;else if(c==='\\\\')e=true;else if(c===q)q=null;continue;}if("'\"`".includes(c)){q=c;continue;}if(c==='{')d++;if(c==='}'&&--d===0)return html.slice(m.index,i+1)}throw new Error('unclosed '+name)};
for(const name of ['getAuthorityGitConfig','ghRequestWithExplicitConfig','getGitHeadExplicit','pullFromAuthority','pushToAuthority']){
 const src=body(name);for(const forbidden of ['getGhRequestConfig(','ghRequest(','syncGameDeployGitHubSettings','syncDeployGitHubSettings'])assert(!src.includes(forbidden),`${name} ambient/cross-copy ${forbidden}`);
}
console.log('STUDIO_AUTHORITY_GIT_ISOLATION_OK');
