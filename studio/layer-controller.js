/* Studio common foreground-layer controller — GKS-B605 */
(function(global){
'use strict';

const stack=[];
const inertSnapshots=new Map();
const zIndexSnapshots=new Map();
const BASE_Z_INDEX=21000;

function doc(){return global.document||null;}
function body(){return doc()?.body||null;}
function nodeFor(id){return id?doc()?.getElementById?.(String(id))||null:null;}
function visible(node){return !!node&&!(node.classList?.contains?.('hidden'));}
function prune(){
 for(let i=stack.length-1;i>=0;i--){if(!visible(nodeFor(stack[i])))stack.splice(i,1);}
}
function restoreInert(){
 for(const [node,snap] of inertSnapshots.entries()){
  try{if(snap.hadAttribute)node.setAttribute?.('inert','');else node.removeAttribute?.('inert');}catch(e){}
  try{if(snap.hasProperty)node.inert=snap.propertyValue;}catch(e){}
 }
 inertSnapshots.clear();
}
function restoreZIndex(){
 for(const [node,value] of zIndexSnapshots.entries()){
  try{if(node?.style)node.style.zIndex=value;}catch(e){}
 }
 zIndexSnapshots.clear();
}
function rememberAndInert(node){
 if(!node||inertSnapshots.has(node))return;
 let hadAttribute=false,hasProperty=false,propertyValue=false;
 try{hadAttribute=!!node.hasAttribute?.('inert');}catch(e){}
 try{hasProperty='inert' in node;propertyValue=hasProperty?!!node.inert:false;}catch(e){}
 inertSnapshots.set(node,{hadAttribute,hasProperty,propertyValue});
 try{node.setAttribute?.('inert','');}catch(e){}
 try{if(hasProperty)node.inert=true;}catch(e){}
}
function rememberZIndex(node){
 if(!node||zIndexSnapshots.has(node))return;
 zIndexSnapshots.set(node,String(node?.style?.zIndex||''));
}
function topId(){prune();return stack.length?stack[stack.length-1]:'';}
function topRoot(){return nodeFor(topId());}
function sync(){
 const d=doc(),b=body();
 restoreInert();restoreZIndex();prune();
 const roots=stack.map(nodeFor).filter(Boolean);
 roots.forEach((node,index)=>{
  rememberZIndex(node);
  try{if(node.style)node.style.zIndex=String(BASE_Z_INDEX+index*10);}catch(e){}
 });
 const top=roots.length?roots[roots.length-1]:null;
 if(!b){return top;}
 if(!top){b.classList?.remove?.('studio-layer-open');return null;}
 b.classList?.add?.('studio-layer-open');
 let allowedChild=null;
 try{allowedChild=Array.from(b.children||[]).find(child=>child===top||child.contains?.(top))||null;}catch(e){}
 try{for(const child of Array.from(b.children||[])){if(child!==allowedChild)rememberAndInert(child);}}catch(e){}
 return top;
}
function blurBackground(nextRoot){
 const active=doc()?.activeElement;
 if(!active||active===body()||nextRoot?.contains?.(active))return;
 try{active.blur?.();}catch(e){}
}
function open(id){
 id=String(id||'');const node=nodeFor(id);if(!id||!node)return false;
 blurBackground(node);
 const existing=stack.indexOf(id);if(existing>=0)stack.splice(existing,1);
 stack.push(id);sync();return true;
}
function close(id){
 id=String(id||'');if(!id)return false;
 let changed=false;for(let i=stack.length-1;i>=0;i--){if(stack[i]===id){stack.splice(i,1);changed=true;}}
 sync();return changed;
}
function reset(){stack.length=0;sync();}
function stackIds(){prune();return stack.slice();}

global.GKSStudioLayerController={open,close,topId,topRoot,sync,reset,stackIds};
})(window);
