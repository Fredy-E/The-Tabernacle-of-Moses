const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.slice(0,source.indexOf('/* ---------- G. PAGE'));
source=source.replace('return { visibility:',`return { testSetup:function(fake,g){
gl=fake;ok=true;nIdx=g.i.length;sceneBatches=g.batches;W=1440;H=1000;vao={};vaoP={};vaoQ={};
var u=new Proxy({},{get:function(t,p){return p;}});
progMain={u:u};progSky={u:u};progPart={u:u};progDepth={u:u};shadowEnabled=true;
initParts(260);
}, visibility:`);
const ctx={window:{matchMedia:()=>({matches:false})},document:{getElementById:()=>({})},console};
vm.createContext(ctx);vm.runInContext(source,ctx);const scene=ctx.buildScene();
assert.equal(scene.batches.reduce((sum,b)=>sum+b.count,0),scene.i.length);
let offset=0;for(const b of scene.batches){assert.equal(b.offset,offset);assert(b.mask>0&&b.mask<8);offset+=b.count*4;}
function vp(eye,at,fov=42){return ctx.mMul(ctx.mPersp(fov*Math.PI/180,1.44,.06,420),ctx.mLook(eye,at,[0,1,0]));}
function visible(eye,at,open=[0,0,0,0]){return ctx.roomVisibility(eye,vp(eye,at),open);}
assert.equal(visible([52,20.5,31],[-6,3.2,0]),1);
assert.equal(visible([-13,1.5,0],[-14,1.5,1]),2);
assert.equal(visible([-19,1.5,0],[-21,1.0,0],[1,1,1,1]),4);
assert.equal(visible([ctx.TX1+1,1.5,0],[ctx.TX1-3,1.5,0],[1,1,0,0]),3);
assert.equal(visible([ctx.VX+1,1.5,0],[ctx.VX-2,1.5,0],[1,1,1,0]),6);
assert.equal(visible([-20,1.5,0],[-10,1.5,0],[1,1,1,1]),7,'Looking back through both doors keeps exterior visible');
assert.equal(visible([-20,1.5,0],[-10,1.5,0],[1,1,0,1]),4,'Closed veil blocks adjacent rooms');
assert.equal(visible([ctx.TX0-3,1.5,0],[ctx.TX1,1.5,0],[1,1,1,0]),1,'Back wall blocks doorway visibility');
for(const x of [ctx.TX1+.16,ctx.VX])for(const dx of [-.64,-.1,0,.1,.64]){
 const mask=visible([x+dx,1.5,0],[x-2,1.5,0],[1,1,1,0]);
 assert(mask&(x===ctx.VX?4:1));assert(mask&2);
}
assert.equal(ctx.portalRect(vp([0,2,0],[1,2,0]),-5,2,4),null,'Portal behind camera is clipped');
const log=[];const gl=new Proxy({}, {get(t,key){
 if(key==='drawElements')return (type,count,indexType,offset)=>log.push({count,offset});
 if(/^[A-Z_0-9]+$/.test(key))return key;
 return ()=>{};
}});
ctx.GL.testSetup(gl,scene);
for(const i of [0,4,5,6,7,8,9]){
 const p=ctx.POSES[i];log.length=0;
 ctx.GL.draw({eye:p.eye,at:p.at,fov:p.fov,indoor:p.ind,expo:p.ex,progress:i},1,.016,null,1);
 const state=ctx.GL.visibility();
 const ranges=scene.batches.filter(b=>b.mask&state.mask);
 const cameraDraws=log.slice(-ranges.length);
 assert.equal(state.triangles,ranges.reduce((s,b)=>s+b.count/3,0));
 assert.deepEqual(cameraDraws,ranges.map(b=>({count:b.count,offset:b.offset})));
 if(i===0)assert.equal(log[0].count,scene.i.length,'Shadow pass retains all casters');
 console.log('Pose',i,'room mask',state.mask,'triangles',state.triangles+'/'+scene.i.length/3,'particles',state.particles);
 if(i===8)assert.equal(state.mask,6,'Ark pose is still within the veil transition margin');
 if(i===9)assert.equal(state.mask,4);
}
console.log('Room/portal transitions, backwards views, batch coverage, draw offsets and shadow preservation passed.');
