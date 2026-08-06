#!/usr/bin/env python3
from __future__ import annotations
import shutil, subprocess, sys, tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT=Path(__file__).resolve().parents[1]
CHECKER=ROOT/"tools/inspection/check-source-zip-binding.py"
with tempfile.TemporaryDirectory(prefix="gk-binding-") as td:
    base=Path(td); zp=base/"source.zip"; good=base/"good"; bad=base/"bad"
    good.mkdir(); bad.mkdir()
    content=b"same-content\n"
    with ZipFile(zp,"w",ZIP_DEFLATED) as zf:
        zf.writestr("project/README_GITHUB反映.md",content)
        zf.writestr("project/package_manifest.json",b"{}\n")
    (good/"README_GITHUB反映.md").write_bytes(content)
    (good/"package_manifest.json").write_bytes(b"{}\n")
    shutil.copytree(good,bad,dirs_exist_ok=True)
    (bad/"README_GITHUB反映.md").rename(bad/"README_GITHUB#U53cd#U6620.md")
    ok=subprocess.run([sys.executable,"-B",str(CHECKER),str(good),"--input-zip",str(zp)],
                      text=True,capture_output=True)
    if ok.returncode or "SOURCE_ZIP_BINDING_OK" not in ok.stdout:
        print(ok.stdout); print(ok.stderr); raise SystemExit(1)
    ng=subprocess.run([sys.executable,"-B",str(CHECKER),str(bad),"--input-zip",str(zp)],
                      text=True,capture_output=True)
    if ng.returncode==0 or "EXTRACTED_PATH_SUBSTITUTION" not in ng.stdout:
        print(ng.stdout); print(ng.stderr); raise SystemExit(1)
print("SOURCE_ZIP_BINDING_TEST_OK")
