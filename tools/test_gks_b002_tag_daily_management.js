const fs=require('fs');
const p=require('path').join(__dirname,'..','studio','index.html');
const s=fs.readFileSync(p,'utf8');
const required=['GKS-B002','tagCenterSearch','tagCenterCategoryFilter','tagCenterStateFilter','tagCenterTableWrap','selectTagFromCenter','登録済みタグ一覧','使用数'];
const missing=required.filter(x=>!s.includes(x));
if(missing.length){console.error('GKS-B002 FAIL:',missing);process.exit(1)}
console.log('GKS-B002 PASS');
