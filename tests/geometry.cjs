const fs=require('fs'),vm=require('vm'),assert=require('assert');
const updated=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const script=updated.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
assert.equal((updated.match(/<blockquote\b/g)||[]).length,33);
assert.equal((updated.match(/data-step="[1-9]"/g)||[]).length,9);
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script),'Runtime must not call network APIs');
const atlas=fs.readFileSync(require('path').join(__dirname,'../assets/material-atlas.png'));
const embedded=updated.match(/var MATERIAL_ATLAS = "data:image\/png;base64,([^"]+)"/);
assert(embedded,'High-quality atlas must be embedded for offline use');
assert(Buffer.from(embedded[1],'base64').equals(atlas));
assert.equal(atlas.readUInt32BE(16)%3,0);assert.equal(atlas.readUInt32BE(20)%2,0);
console.log('Embedded atlas verified:',atlas.readUInt32BE(16),'×',atlas.readUInt32BE(20));
const ctx={window:{matchMedia:()=>({matches:false})},document:{getElementById:()=>({})},console};vm.createContext(ctx);
vm.runInContext(script.slice(0,script.indexOf('/* ---------- G. PAGE')),ctx);
const scene=ctx.buildScene();assert(scene.v.length>0);assert(scene.i.length>0);
assert(Array.from(scene.v).every(Number.isFinite));assert(Array.from(scene.i).every(n=>n<scene.v.length/15));
assert.equal(scene.motion.length,scene.v.length/15*4);
assert(Array.from(scene.motion).every(Number.isFinite));
const groups=[0,0,0,0,0];
for(let i=0;i<scene.motion.length;i+=4)groups[scene.motion[i]]++;
assert(groups.every(n=>n>0));
// Curtain panels must not share triangles across the opening, and their
// original texture coordinates must stay within the corresponding half.
for(let t=0;t<scene.i.length;t+=3){
 const ids=Array.from(scene.i.slice(t,t+3));
 const tag=scene.motion[ids[0]*4];
 if(tag>0&&tag<4){
  const side=scene.motion[ids[0]*4+1];
  assert(ids.every(i=>scene.motion[i*4]===tag&&scene.motion[i*4+1]===side));
  assert(ids.every(i=>side<0?scene.v[i*15+6]<=.50001:scene.v[i*15+6]>=.49999));
 }
}
assert.equal(ctx.POSES.length,12);assert(ctx.POSES[9].eye[1]>ctx.POSES[8].eye[1]);
assert(updated.includes('var VS_DEPTH = HEAD + DEFORM'));
assert(updated.includes('var VS_MAIN = HEAD + DEFORM'));
console.log('Animation groups:',groups,'— split curtains and shared shadow deformation passed.');
console.log('JavaScript syntax and geometry buffers passed.',scene.v.length/15,'vertices',scene.i.length/3,'triangles');
for(const name of ['box','cyl','sphere','torus','lathe']){
 ctx.V=[];ctx.IDX=[];ctx.XF=[ctx.mIdent()];
 if(name==='box')ctx.box(-1,1,0,1,-1,1);
 if(name==='cyl')ctx.cyl(1,1,1,16,true,true);
 if(name==='sphere')ctx.sphere(1,16,8);
 if(name==='torus')ctx.torus(1,.2,16,8);
 if(name==='lathe')ctx.lathe([[1,0],[1,1]],16);
 let reversed=0,total=0;
 for(let j=0;j<ctx.IDX.length;j+=3){
  const v=ctx.IDX.slice(j,j+3).map(i=>ctx.V.slice(i*15,i*15+6));
  const ab=ctx.vsub(v[1],v[0]),ac=ctx.vsub(v[2],v[0]),n=ctx.vcross(ab,ac);
  if(ctx.vlen(n)<1e-8)continue;
  const normal=v[0].slice(3);if(n.reduce((s,x,i)=>s+x*normal[i],0)<0)reversed++;total++;
 }
 assert.equal(reversed,0,name+' has reversed faces');
 console.log(name,{reversed,total});
}
ctx.XF=[ctx.S(2,3,4)];
const transformed=ctx.tn(1,1,1),expected=ctx.vnorm([.5,1/3,.25]);
assert(transformed.every((v,i)=>Math.abs(v-expected[i])<1e-6));
// Run page setup with a minimal DOM: navigation must survive without WebGL.
function element(id){return {id,dataset:{},children:[],style:{},attrs:{},scrollWidth:0,clientWidth:100,
 classList:{toggle(){},add(){},contains(){return false;}},
 setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},
 appendChild(el){this.children.push(el);},addEventListener(){},querySelectorAll(){return this.children;},
 getBoundingClientRect(){return {top:0,height:100};},scrollIntoView(){}};}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
ctx.document={getElementById:get,createElement:()=>element(''),createElementNS:()=>element(''),
 querySelectorAll:()=>[],querySelector:()=>get('page'),addEventListener(){},readyState:'complete',documentElement:{style:{setProperty(){}}},body:{classList:{toggle(){}}}};
Object.assign(ctx,{innerHeight:900,innerWidth:1440,scrollY:0,pageYOffset:0,navigator:{hardwareConcurrency:4},
 performance:{now:()=>0},requestAnimationFrame:()=>0,addEventListener(){},setTimeout(){},devicePixelRatio:1});
get('quality-select').value='auto';
vm.runInContext(script.slice(script.indexOf('/* ---------- G. PAGE')),ctx);
assert.equal(get('pills').children.length,9);assert.equal(get('legend').children.length,9);assert.equal(get('markers').children.length,8);
assert.equal(get('prev').disabled,true);assert.equal(get('next').disabled,false);
console.log('Normal transforms and page initialization passed: 9 steps, 8 map markers.');
