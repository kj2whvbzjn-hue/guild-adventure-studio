#!/usr/bin/env python3
from __future__ import annotations
import fnmatch,json
from pathlib import Path,PurePosixPath
POLICY_REL='shared/integrity/system-file-policy.json'
def normalize(path:str)->str:return PurePosixPath(str(path).replace('\\','/').lstrip('/')).as_posix()
def load_policy(root:Path)->dict:
 d=json.loads((root/POLICY_REL).read_text(encoding='utf-8'))
 if d.get('schema_version')!=1:raise ValueError('unsupported system-file-policy schema')
 return d
def pattern_match(path:str,pattern:str)->bool:
 path,pattern=normalize(path),normalize(pattern)
 if pattern.startswith('**/'):
  return fnmatch.fnmatchcase(path,pattern) or fnmatch.fnmatchcase(path,pattern[3:])
 return fnmatch.fnmatchcase(path,pattern)
def classify(path:str,policy:dict)->str:
 rel=normalize(path);default=policy.get('default_class','persistent')
 for name,rule in policy.get('classes',{}).items():
  if name==default:continue
  if rel in {normalize(x) for x in rule.get('exact_paths',[])}:return name
  if any(pattern_match(rel,p) for p in rule.get('patterns',[])):return name
 return default
