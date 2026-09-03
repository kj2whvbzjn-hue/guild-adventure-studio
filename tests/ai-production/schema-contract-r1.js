#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.join(__dirname,'ai-v2-schema-self-validation-r10-p1.py');
const run=spawnSync('python3',[script],{encoding:'utf8'});
if(run.stdout)process.stdout.write(run.stdout);
if(run.stderr)process.stderr.write(run.stderr);
assert.strictEqual(run.status,0,'AI V2 schema self-validation failed');
console.log('AI_SCHEMA_CONTRACT_R10_P1_OK');
