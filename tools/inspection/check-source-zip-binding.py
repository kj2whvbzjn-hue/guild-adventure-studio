#!/usr/bin/env python3
"""Prove that an extracted source tree exactly matches an input ZIP."""
from __future__ import annotations
import sys
sys.dont_write_bytecode = True
import argparse, hashlib, json
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evidence import zip_entries

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def common_top_level(names: list[str]) -> str|None:
    tops=[]
    for name in names:
        parts=PurePosixPath(name).parts
        if parts: tops.append(parts[0])
    return tops[0] if tops and len(set(tops))==1 else None

def strip_top(name: str, top: str|None) -> str:
    parts=PurePosixPath(name).parts
    if top and parts and parts[0]==top: parts=parts[1:]
    return PurePosixPath(*parts).as_posix() if parts else ""

def tree_records(root: Path) -> dict[str,dict]:
    out={}
    for p in sorted(root.rglob("*"), key=lambda x:x.relative_to(root).as_posix()):
        if p.is_file() and ".git" not in p.parts:
            rel=p.relative_to(root).as_posix()
            out[rel]={"path":rel,"size":p.stat().st_size,"sha256":sha256_file(p)}
    return out

def zip_records(zip_path: Path) -> tuple[dict[str,dict],dict]:
    ev=zip_entries(zip_path)
    file_names=[x["decoded_name"] for x in ev["entries"]
                if x.get("decoded_name") and not x["decoded_name"].endswith("/") and not x.get("decode_error")]
    top=common_top_level(file_names)
    records={}
    with ZipFile(zip_path) as zf:
        infos={i.filename:i for i in zf.infolist() if not i.is_dir()}
        for item in ev["entries"]:
            original=item.get("decoded_name")
            if not original or original.endswith("/") or item.get("decode_error"): continue
            rel=strip_top(original,top)
            if not rel: continue
            info=infos.get(item.get("library_name"))
            if info is None: raise ValueError(f"ZIP library entry not found for {original!r}")
            data=zf.read(info)
            if rel in records: raise ValueError(f"duplicate path after root removal: {rel}")
            records[rel]={
                "path":rel,"zip_path":original,"size":len(data),"sha256":sha256_bytes(data),
                "utf8_flag":item.get("utf8_flag"),"decode_source":item.get("decode_source"),
                "raw_name_bytes_hex":item.get("raw_name_bytes_hex")
            }
    return records,{
        "zip_sha256":ev["zip_sha256"],
        "central_directory_entries_sha256":ev["central_directory_entries_sha256"],
        "common_top_level":top
    }

def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("root",type=Path)
    ap.add_argument("--input-zip",type=Path,required=True)
    ap.add_argument("--json-output",type=Path)
    a=ap.parse_args()
    try:
        expected,meta=zip_records(a.input_zip.resolve())
        actual=tree_records(a.root.resolve())
    except Exception as exc:
        print("SOURCE_ZIP_BINDING_FAIL")
        print(f"BINDING_SETUP_ERROR {exc}")
        return 1
    ep,apaths=set(expected),set(actual)
    missing=sorted(ep-apaths); unexpected=sorted(apaths-ep)
    mismatched=[]
    for rel in sorted(ep&apaths):
        if expected[rel]["size"]!=actual[rel]["size"] or expected[rel]["sha256"]!=actual[rel]["sha256"]:
            mismatched.append({"path":rel,"expected":expected[rel],"actual":actual[rel]})
    ebh={}; abh={}
    for rel,item in expected.items(): ebh.setdefault((item["size"],item["sha256"]),[]).append(rel)
    for rel,item in actual.items(): abh.setdefault((item["size"],item["sha256"]),[]).append(rel)
    substitutions=[]
    for key in sorted(set(ebh)&set(abh)):
        e=sorted(set(ebh[key])&set(missing)); a2=sorted(set(abh[key])&set(unexpected))
        if e and a2:
            substitutions.append({
                "expected_paths":e,"actual_paths":a2,"size":key[0],"sha256":key[1],
                "classification":"extraction_or_path_translation"
            })
    status="pass" if not missing and not unexpected and not mismatched else "fail"
    report={"schema_version":1,"status":status,"root":str(a.root.resolve()),"input_zip":str(a.input_zip.resolve()),
            **meta,"expected_file_count":len(expected),"actual_file_count":len(actual),
            "missing_paths":missing,"unexpected_paths":unexpected,"content_mismatches":mismatched,
            "path_substitutions":substitutions}
    if a.json_output:
        a.json_output.parent.mkdir(parents=True,exist_ok=True)
        a.json_output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    if status=="pass":
        print(f"SOURCE_ZIP_BINDING_OK files={len(expected)} zip_sha256={meta['zip_sha256']} tree_matches_zip=true")
        return 0
    print("SOURCE_ZIP_BINDING_FAIL")
    for x in substitutions:
        print(f"EXTRACTED_PATH_SUBSTITUTION expected={x['expected_paths']} actual={x['actual_paths']} sha256={x['sha256']}")
    for rel in missing:
        if not any(rel in x["expected_paths"] for x in substitutions): print(f"ZIP_PATH_MISSING_FROM_TREE {rel}")
    for rel in unexpected:
        if not any(rel in x["actual_paths"] for x in substitutions): print(f"TREE_PATH_NOT_IN_ZIP {rel}")
    for x in mismatched: print(f"ZIP_TREE_CONTENT_MISMATCH {x['path']}")
    return 1
if __name__=="__main__": raise SystemExit(main())
