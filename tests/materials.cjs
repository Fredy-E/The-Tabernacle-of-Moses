// Exercise the asynchronous texture-upload path without starting a browser.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.slice(0,source.indexOf('/* ---------- G. PAGE'));
source=source.replace('init:init,','testGL:function(g){gl=g;}, testLoad:loadMaterials, testStatus:function(){return {ready:materialsReady,means:Array.from(materialMeans)};}, init:init,');
let uploads=0,images=0,mipmap=0,events=0;
const ctx={console,window:{matchMedia:()=>({matches:false}),dispatchEvent(){events++;}},Event:function(){},
document:{getElementById:()=>({}),createElement:()=>({width:0,height:0,getContext(){return {drawImage(){},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(128)};}};}})},
Image:class{constructor(){images++;this.width=1536;this.height=1024;}set src(v){assert(v.startsWith('data:image/png;base64,'));this.onload();}}};
vm.createContext(ctx);vm.runInContext(source,ctx);assert.equal(images,0,'Low/Medium must not decode atlas');
const gl={TEXTURE2:2,TEXTURE_2D_ARRAY:3,RGBA8:4,RGBA:5,UNSIGNED_BYTE:6,MAX_TEXTURE_SIZE:7,
TEXTURE_MIN_FILTER:8,TEXTURE_MAG_FILTER:9,LINEAR:10,LINEAR_MIPMAP_LINEAR:11,TEXTURE_WRAP_S:12,TEXTURE_WRAP_T:13,REPEAT:14,
createTexture:()=>({}),activeTexture(){},bindTexture(){},texImage3D(){},texParameteri(){},isContextLost:()=>false,
getParameter:()=>512,getExtension:()=>null,generateMipmap(){mipmap++;},
texSubImage3D(target,level,x,y,layer,width,height,depth,format,type,data){
assert.equal(layer,uploads++);assert.equal(width,512);assert.equal(height,512);assert.equal(data.length,512*512*4);}};
ctx.GL.testGL(gl);ctx.GL.testLoad();ctx.GL.testLoad();
assert.equal(images,1);assert.equal(uploads,6);assert.equal(mipmap,1);assert.equal(events,1);
assert(ctx.GL.testStatus().ready);assert(ctx.GL.testStatus().means.every(n=>n>.49&&n<.51));
console.log('High texture loader: lazy decode, 6 layers, mipmaps, brightness normalization, single upload and redraw passed.');
