'use strict';
const $=id=>document.getElementById(id),B=Bouchon;
let result=null,params={...B.defaults},debugRows=[],debugOffset=0,separatorLayout=null,previewPage=0,exportPreviewPage=0,customVector=null;
const example='#include <Servo.h>\n\nServo s;\n\nvoid setup() {\n  s.attach(9);\n}\n\nvoid loop() {\n  s.write(180);\n  delay(1000);\n  s.write(0);\n  delay(1000);\n}\n';

const SVG_NS='http://www.w3.org/2000/svg';
const matI=()=>[1,0,0,1,0,0];
const matMul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function transformMatrix(value=''){
 let out=matI();const re=/([a-zA-Z]+)\s*\(([^)]*)\)/g;let m;
 while((m=re.exec(value))){const n=m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);if(n.some(x=>!Number.isFinite(x)))throw Error('SVG transform 값이 올바르지 않습니다.');let t=matI();
  if(m[1]==='matrix'&&n.length===6)t=n;
  else if(m[1]==='translate'&&(n.length===1||n.length===2))t=[1,0,0,1,n[0],n[1]||0];
  else if(m[1]==='scale'&&(n.length===1||n.length===2))t=[n[0],0,0,n.length===2?n[1]:n[0],0,0];
  else if(m[1]==='rotate'&&(n.length===1||n.length===3)){const a=n[0]*Math.PI/180,c=Math.cos(a),q=Math.sin(a),r=[c,q,-q,c,0,0];t=n.length===3?matMul(matMul([1,0,0,1,n[1],n[2]],r),[1,0,0,1,-n[1],-n[2]]):r;}
  else if(m[1]==='skewX'&&n.length===1)t=[1,0,Math.tan(n[0]*Math.PI/180),1,0,0];
  else if(m[1]==='skewY'&&n.length===1)t=[1,Math.tan(n[0]*Math.PI/180),0,1,0,0];
  else throw Error(`지원하지 않는 SVG transform: ${m[1]}`);
  out=matMul(out,t);
 }
 return out;
}
const svgNum=(el,name,def=0)=>{const raw=el.getAttribute(name);const v=raw===null?def:Number(raw);if(!Number.isFinite(v))throw Error(`SVG의 ${name} 값이 올바르지 않습니다.`);return v;};
const parsePoints=value=>{const n=String(value||'').trim().split(/[\s,]+/).filter(Boolean).map(Number);if(!n.length||n.length%2||n.some(v=>!Number.isFinite(v)))throw Error('SVG points 값이 올바르지 않습니다.');const out=[];for(let i=0;i<n.length;i+=2)out.push([n[i],n[i+1]]);return out;};
function pathLooksOpen(d){const moves=(String(d).match(/[Mm]/g)||[]).length,closes=(String(d).match(/[Zz]/g)||[]).length;return closes<moves;}
function parseCustomSvg(text,fileName){
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 if(root.tagName.toLowerCase()==='parsererror'||doc.querySelector('parsererror'))throw Error('SVG 파일을 해석할 수 없습니다.');
 if(root.localName!=='svg')throw Error('SVG 파일만 불러올 수 있습니다.');
 const dangerous=['script','image','text','tspan','use','foreignObject','filter','mask','clipPath','pattern','linearGradient','radialGradient','marker','symbol','iframe'];
 for(const tag of dangerous)if(root.getElementsByTagName(tag).length)throw Error(`지원하지 않는 SVG 요소 <${tag}>가 포함되어 있습니다. 원본 벡터를 임의 변환하지 않았습니다.`);
 for(const style of root.getElementsByTagName('style'))if(/transform\s*:|filter\s*:|mask\s*:|clip-path\s*:|url\s*\(/i.test(style.textContent||''))throw Error('CSS transform/effect를 사용하는 SVG는 현재 지원하지 않습니다. Illustrator에서 효과를 확장한 뒤 다시 저장하세요.');
 const allowed=new Set(['g','path','rect','circle','ellipse','line','polyline','polygon']),ignored=new Set(['title','desc','metadata','defs','style']);
 const wrapper=document.createElementNS(SVG_NS,'g'),primitives=[],warnings=[],fingerprints=new Set();let duplicateCount=0;
 function walk(src,dst,parentMatrix){
   for(const child of [...src.children]){
     const tag=child.localName;
     if(ignored.has(tag))continue;
     if(!allowed.has(tag))throw Error(`지원하지 않는 SVG 요소 <${tag}>가 포함되어 있습니다.`);
     for(const a of [...child.attributes]){
       if(/^on/i.test(a.name)||['href','xlink:href'].includes(a.name)||['filter','mask','clip-path','marker-start','marker-mid','marker-end'].includes(a.name))throw Error(`지원하지 않는 SVG 속성 ${a.name}이 포함되어 있습니다.`);
       if(a.name==='style'&&/transform\s*:|filter\s*:|mask\s*:|clip-path\s*:|url\s*\(/i.test(a.value))throw Error('지원하지 않는 CSS 효과/transform이 포함되어 있습니다.');
     }
     const local=transformMatrix(child.getAttribute('transform')||''),matrix=matMul(parentMatrix,local),clean=document.createElementNS(SVG_NS,tag);
     if(child.hasAttribute('transform'))clean.setAttribute('transform',child.getAttribute('transform'));
     if(tag==='g'){dst.append(clean);walk(child,clean,matrix);continue;}
     const attrs={};
     if(tag==='path'){const d=child.getAttribute('d')||'';if(!d.trim())throw Error('비어 있는 path가 있습니다.');if(/[Aa]/.test(d))throw Error('arc(A) 명령이 포함된 path는 PDF 벡터 출력을 위해 지원하지 않습니다. Illustrator에서 곡선을 일반 path로 확장한 뒤 다시 저장하세요.');attrs.d=d;clean.setAttribute('d',d);if(pathLooksOpen(d))warnings.push('열린 path가 포함되어 있습니다. 레이저커팅 전 닫힌 윤곽선인지 확인하세요.');}
     if(tag==='rect'){attrs.x=svgNum(child,'x');attrs.y=svgNum(child,'y');attrs.width=svgNum(child,'width');attrs.height=svgNum(child,'height');if(svgNum(child,'rx',0)||svgNum(child,'ry',0))throw Error('둥근 모서리 rect는 현재 지원하지 않습니다. Illustrator에서 path로 확장하세요.');for(const k of ['x','y','width','height'])clean.setAttribute(k,attrs[k]);}
     if(tag==='circle'){attrs.cx=svgNum(child,'cx');attrs.cy=svgNum(child,'cy');attrs.r=svgNum(child,'r');for(const k of ['cx','cy','r'])clean.setAttribute(k,attrs[k]);}
     if(tag==='ellipse'){attrs.cx=svgNum(child,'cx');attrs.cy=svgNum(child,'cy');attrs.rx=svgNum(child,'rx');attrs.ry=svgNum(child,'ry');for(const k of ['cx','cy','rx','ry'])clean.setAttribute(k,attrs[k]);}
     if(tag==='line'){attrs.x1=svgNum(child,'x1');attrs.y1=svgNum(child,'y1');attrs.x2=svgNum(child,'x2');attrs.y2=svgNum(child,'y2');for(const k of ['x1','y1','x2','y2'])clean.setAttribute(k,attrs[k]);warnings.push('열린 line이 포함되어 있습니다. 레이저커팅 전 의도한 절단선인지 확인하세요.');}
     if(tag==='polyline'||tag==='polygon'){attrs.points=parsePoints(child.getAttribute('points'));clean.setAttribute('points',attrs.points.map(p=>p.join(',')).join(' '));if(tag==='polyline')warnings.push('열린 polyline이 포함되어 있습니다. 레이저커팅 전 의도한 절단선인지 확인하세요.');}
     clean.setAttribute('vector-effect','non-scaling-stroke');clean.setAttribute('fill','none');
     const fp=tag+'|'+JSON.stringify(attrs)+'|'+matrix.map(v=>Number(v.toFixed(8))).join(',');
     if(fingerprints.has(fp))duplicateCount++;else fingerprints.add(fp);
     primitives.push({type:tag,attrs,matrix});dst.append(clean);
   }
 }
 walk(root,wrapper,matI());
 if(!primitives.length)throw Error('반복 배치할 벡터 경로가 없습니다.');
 if(duplicateCount)warnings.push(`완전히 동일한 중복 벡터 요소 ${duplicateCount}개가 감지되었습니다. 자동 삭제하지 않았습니다.`);
 const temp=document.createElementNS(SVG_NS,'svg');temp.setAttribute('xmlns',SVG_NS);temp.style.cssText='position:absolute;left:-100000px;top:-100000px;width:1000px;height:1000px;overflow:visible;visibility:hidden;pointer-events:none';const g=wrapper.cloneNode(true);temp.append(g);document.body.append(temp);
 let box;try{const b=g.getBBox();box={x:b.x,y:b.y,width:b.width,height:b.height};}finally{temp.remove();}
 if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)throw Error('SVG 도형의 실제 경계 영역을 계산할 수 없습니다.');
 if(root.querySelector('[class], [style]'))warnings.push('원본의 채움/스타일 정보는 레이저커팅 출력에서 제거되고 윤곽선만 사용됩니다.');
 return {fileName,markup:wrapper.innerHTML,bbox:box,primitives,warnings:[...new Set(warnings)]};
}
function customRenderData(){
 if(!customVector)throw Error('사용자 지정 SVG 도형을 먼저 불러오세요.');
 return {...customVector,size:Number($('customVectorSize').value),keepAspect:$('customVectorAspect').checked};
}
function renderCustomVectorSample(){
 const host=$('customVectorPreview');host.replaceChildren();
 if(!customVector){const span=document.createElement('span');span.className='muted';span.textContent='SVG를 불러오면 도형이 표시됩니다.';host.append(span);return;}
 const b=customVector.bbox,pad=Math.max(b.width,b.height)*.12||1,svg=document.createElementNS(SVG_NS,'svg');svg.setAttribute('viewBox',`${b.x-pad} ${b.y-pad} ${b.width+pad*2} ${b.height+pad*2}`);const g=document.createElementNS(SVG_NS,'g');g.setAttribute('fill','none');g.setAttribute('stroke','#444');g.setAttribute('stroke-width','0.8');g.innerHTML=customVector.markup;svg.append(g);host.append(svg);
}
function customCollisionMessage(layout){
 if(!customVector||!layout)return'';const q=B.customScale(customRenderData()),page=layout.pages?.[0]||layout,p=page.p;
 const xPitch=p.layoutMode==='column'?page.columnPitch:p.diameter+p.gap,yPitch=p.layoutMode==='column'?page.rowPitch:p.diameter+p.rowGap,warnings=[];
 if(q.width+p.stroke>=xPitch-1e-9)warnings.push(`가로 크기 ${q.width.toFixed(3)}mm가 중심 간격 ${xPitch.toFixed(3)}mm에 가까워 인접 도형이 겹칠 수 있습니다.`);
 if(q.height+p.stroke>=yPitch-1e-9)warnings.push(`세로 크기 ${q.height.toFixed(3)}mm가 중심 간격 ${yPitch.toFixed(3)}mm에 가까워 인접 도형이 겹칠 수 있습니다.`);
 return warnings.join('\n');
}
function updateCustomVectorStatus(layout=null){
 if(!customVector){$('customVectorStatus').textContent='SVG 파일을 불러오세요.';return;}
 const lines=[`${customVector.fileName} · 벡터 요소 ${customVector.primitives.length}개`,...customVector.warnings];const collision=customCollisionMessage(layout);if(collision)lines.push(collision);$('customVectorStatus').textContent=lines.join('\n');
}
function syncCustomVectorControls(){
 const custom=$('settingsForm').elements.shape.value==='custom';$('customVectorControls').hidden=!custom;
 if(custom&&!$('customVectorSize').value)$('customVectorSize').value=$('settingsForm').elements.diameter.value||B.defaults.diameter;
 if(custom)updateCustomVectorStatus();
}
async function loadCustomVectorFile(file){
 if(!file)return;if(!/\.svg$/i.test(file.name)&&file.type!=='image/svg+xml'){updateCustomVectorStatus();throw Error('SVG 파일만 불러올 수 있습니다.');}
 const parsed=parseCustomSvg(await file.text(),file.name);customVector=parsed;if(!$('customVectorSize').value)$('customVectorSize').value=$('settingsForm').elements.diameter.value||B.defaults.diameter;renderCustomVectorSample();updateCustomVectorStatus();marginPreview();
}
$('source').value=example;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function invalidate(){result=null;previewPage=0;debugRows=[];debugOffset=0;renderDebug();$('columnCheck').textContent='';$('export').disabled=true;$('stats').replaceChildren();$('pitchInfo').textContent='';$('bits').textContent='변환 후 표시됩니다.';$('preview').replaceChildren();const p=document.createElement('p');p.textContent='코드가 변경되었습니다. 다시 변환하세요.';$('preview').append(p);}
$('source').addEventListener('input',()=>{invalidate();$('corrected').value='';status('원본이 변경되었습니다. 다시 교정·변환하세요.');});
function correct(){const text=B.minify($('source').value);$('corrected').value=text;debugRows=B.characterTable(text);debugOffset=0;renderDebug();return text;}
$('correct').onclick=()=>{invalidate();try{const text=correct();status(`교정 완료 · ${$('source').value.length} → ${text.length}자\n실제 실행 여부는 Arduino IDE에서 컴파일해 확인하세요.`);}catch(e){$('corrected').value='';status(e.message,true);}};
$('example').onclick=()=>{if($('source').value!==example&&!confirm('현재 입력을 예제 코드로 바꿀까요?'))return;$('source').value=example;$('corrected').value='';invalidate();status('서보 예제를 불러왔습니다.');};
function formParams(){const f=$('settingsForm');return Object.fromEntries(Object.keys(B.defaults).map(k=>[k,typeof B.defaults[k]==='string'?f.elements[k].value:Number(f.elements[k].value)]));}
function syncPresets(){const f=$('settingsForm');const board=f.elements.width.value+','+f.elements.height.value;$('preset').value=['300,450','300,400','600,450'].includes(board)?board:'custom';const ms=['top','bottom','left','right'].map(k=>f.elements[k].value);$('marginPreset').value=ms.every(v=>v===ms[0])&&['10','20','40'].includes(ms[0])?ms[0]:'custom';}
function syncFields(){const f=$('settingsForm'),column=f.elements.layoutMode.value==='column';$('columnFields').hidden=!column;for(const n of $('columnFields').querySelectorAll('input,select'))n.disabled=!column;f.elements.columnPitch.disabled=!column||f.elements.columnSpacing.value==='auto';f.elements.rowPitch.disabled=!column||f.elements.rowSpacing.value==='auto';for(const label of document.querySelectorAll('.continuousField')){label.hidden=column;label.querySelector('input').disabled=column;}}
function spacingInfo(r){return r.p.layoutMode==='column'?`열 중심 간격 ${r.columnPitch.toFixed(4)} mm · 행 중심 간격 ${r.rowPitch.toFixed(4)} mm`:`가로 중심 간격 ${(r.p.diameter+r.p.gap).toFixed(4)} mm · 세로 중심 간격 ${(r.p.diameter+r.p.rowGap).toFixed(4)} mm`;}
function marginPreview(){
 syncFields();
 const p=formParams();
 if(![p.width,p.height,p.top,p.left,p.right,p.bottom].every(Number.isFinite)||p.width<=0||p.height<=0)return;
 const host=$('marginPreview'),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height}`);
 const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 el('rect',{width:p.width,height:p.height,fill:'#d8e2d2',stroke:'#4a6250','stroke-width':1});
 el('rect',{x:p.left,y:p.top,width:Math.max(0,p.width-p.left-p.right),height:Math.max(0,p.height-p.top-p.bottom),fill:'#fff',stroke:'#78927a','stroke-width':.5,'stroke-dasharray':'3 3'});
 try{
   const previewLayout=B.layout($('corrected').value,p);
   $('calculatedSpacing').textContent=spacingInfo(previewLayout);
   const page=previewLayout.pages[0]||previewLayout;
   for(const h of page.holes)shapeElement(el,h,p,{stroke:p.color,strokeWidth:Math.max(.35,p.stroke)});
 }catch(e){
   $('calculatedSpacing').textContent=e.message;
 }
 host.replaceChildren(svg);
}
$('convert').onclick=()=>{try{correct();B.ascii($('corrected').value);for(const [k,v]of Object.entries(params))$('settingsForm').elements[k].value=v;$('settingError').textContent='';syncFields();syncPresets();syncCustomVectorControls();marginPreview();$('settings').showModal();}catch(e){invalidate();status(e.message,true);}};
$('cancel').onclick=()=>$('settings').close();
$('preset').onchange=e=>{if(e.target.value!=='custom'){const [w,h]=e.target.value.split(',');$('settingsForm').elements.width.value=w;$('settingsForm').elements.height.value=h;marginPreview();}};
$('marginPreset').onchange=e=>{if(e.target.value!=='custom'){for(const k of ['top','bottom','left','right'])$('settingsForm').elements[k].value=e.target.value;marginPreview();}};
$('settingsForm').addEventListener('input',e=>{if(['width','height'].includes(e.target.name))$('preset').value='custom';if(['top','bottom','left','right'].includes(e.target.name))$('marginPreset').value='custom';marginPreview();});
$('settingsForm').elements.shape.addEventListener('change',()=>{syncCustomVectorControls();marginPreview();});
$('customVectorLoad').onclick=()=>$('customVectorFile').click();
$('customVectorFile').addEventListener('change',async e=>{try{$('settingError').textContent='';await loadCustomVectorFile(e.target.files?.[0]);}catch(error){customVector=null;renderCustomVectorSample();$('customVectorStatus').textContent=error.message;$('settingError').textContent=error.message;}finally{e.target.value='';}});
$('customVectorReset').onclick=()=>{customVector=null;$('customVectorSize').value=$('settingsForm').elements.diameter.value||B.defaults.diameter;renderCustomVectorSample();updateCustomVectorStatus();marginPreview();};
$('customVectorSize').addEventListener('input',()=>{updateCustomVectorStatus(result);marginPreview();if(result&&result.p.shape==='custom'){render();renderExportPreview();}});
$('customVectorAspect').addEventListener('change',()=>{updateCustomVectorStatus(result);marginPreview();if(result&&result.p.shape==='custom'){render();renderExportPreview();}});

$('settingsForm').onsubmit=e=>{e.preventDefault();try{const fp=formParams();if(fp.shape==='custom')customRenderData();const next=B.layout($('corrected').value,fp);params=next.p;result=next;previewPage=0;updateCustomVectorStatus(next);render();$('export').disabled=false;$('settings').close();status(`변환 완료 · ${result.bits.length.toLocaleString()}비트 · ${result.pageCount}페이지\n1값만 타공합니다. PDF는 여러 페이지, SVG는 모든 판을 하나의 파일에 판별 그룹으로 저장합니다.`);}catch(e){$('settingError').textContent=e.message;}};
function shapeElement(el,h,p,style={}) {
 const common={fill:'none',stroke:style.stroke||p.color,'stroke-width':style.strokeWidth??Math.max(.17,p.stroke),'stroke-linejoin':'round'};
 if(p.shape==='custom'){
   const custom=customRenderData(),q=B.customScale(custom),tx=h.x-q.cx*q.sx,ty=h.y-q.cy*q.sy,g=el('g',{transform:`matrix(${q.sx} 0 0 ${q.sy} ${tx} ${ty})`,...common});
   g.innerHTML=custom.markup;return g;
 }
 const r=p.diameter/2;
 if(p.shape==='circle')return el('circle',{cx:h.x,cy:h.y,r,...common});
 if(p.shape==='square')return el('rect',{x:h.x-r,y:h.y-r,width:p.diameter,height:p.diameter,...common});
 if(p.shape==='diamond')return el('path',{d:`M ${h.x} ${h.y-r} L ${h.x+r} ${h.y} L ${h.x} ${h.y+r} L ${h.x-r} ${h.y} Z`,...common});
 if(p.shape==='triangle')return el('path',{d:`M ${h.x} ${h.y-r} L ${h.x+r} ${h.y+r} L ${h.x-r} ${h.y+r} Z`,...common});
 return el('path',{d:`M ${h.x} ${h.y+r*.95} C ${h.x-r*.95} ${h.y+r*.25} ${h.x-r*.9} ${h.y-r*.65} ${h.x-r*.42} ${h.y-r*.65} C ${h.x-r*.14} ${h.y-r*.65} ${h.x} ${h.y-r*.42} ${h.x} ${h.y-r*.2} C ${h.x} ${h.y-r*.42} ${h.x+r*.14} ${h.y-r*.65} ${h.x+r*.42} ${h.y-r*.65} C ${h.x+r*.9} ${h.y-r*.65} ${h.x+r*.95} ${h.y+r*.25} ${h.x} ${h.y+r*.95} Z`,...common});
}
function render(){if(!result)return;B.validateColumns(result);debugRows=result.characters;renderDebug();$('columnCheck').textContent=result.p.layoutMode==='column'?'검증 통과 · 문자별 ASCII와 모든 타공 세로열 좌표가 일치합니다.':'연속 배치 모드 · 문자 세로열 검증은 적용하지 않습니다.';$('activeMode').textContent='현재 모드: '+(result.p.layoutMode==='column'?'7-bit Column Layout':'Continuous Bit Layout');
 const page=result.pages[previewPage]||result.pages[0],{p,bits,cols}=page,holes=page.holes;
 const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height}`);svg.setAttribute('aria-label',`타공 패턴 미리보기 ${previewPage+1}페이지`);
 const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 el('rect',{width:p.width,height:p.height,fill:'white'});
 if($('margins').checked){el('rect',{width:p.width,height:p.height,fill:'#e6eddf'});el('rect',{x:p.left,y:p.top,width:p.width-p.left-p.right,height:p.height-p.top-p.bottom,fill:'white',stroke:'#99ad92','stroke-width':.3,'stroke-dasharray':'2 2'});}
 if($('zero').checked)for(let i=0;i<bits.length;i++)if(bits[i]==='0'){const point=B.position(page,i);shapeElement(el,point,p,{stroke:'#d3d8d0',strokeWidth:.15});}
 for(const h of holes)shapeElement(el,h,p);
 $('preview').replaceChildren(svg);
 $('pageNav').hidden=result.pageCount<=1;$('pageLabel').textContent=`${previewPage+1} / ${result.pageCount} 페이지`;$('pagePrev').disabled=previewPage===0;$('pageNext').disabled=previewPage>=result.pageCount-1;
 $('stats').replaceChildren();for(const [label,value]of [['Characters',result.text.length],['ASCII bits',result.bits.length],['Holes',result.holes.length],['Pages',result.pageCount],['현재 페이지 문자/비트',p.layoutMode==='column'?`${page.text.length} / ${page.bits.length}`:`— / ${page.bits.length}`],['Board · mm',`${p.width} × ${p.height}`],[p.layoutMode==='column'?'문자 줄 × 문자 열':'Rows × Columns',`${page.rows} × ${cols}`],['Margin · 위/아래/좌/우',`${p.top} / ${p.bottom} / ${p.left} / ${p.right}`]]){const d=document.createElement('div');d.className='stat';const sm=document.createElement('small');sm.textContent=label;const v=document.createElement('strong');v.textContent=value;d.append(sm,v);$('stats').append(d);}
 $('layoutNote').textContent=p.layoutMode==='column'?`7-bit Column Layout · 상위 비트부터 위 → 아래로 배치하되 모든 타공 행의 중심 간격은 동일합니다. ${p.charactersPerRow}문자마다 다음 문자 줄로 이어지고, 7행마다 SVG 구분선을 넣을 수 있습니다.`:'Continuous Bit Layout · 왼쪽 → 오른쪽, 위 → 아래로 연속 배치하며, 판을 넘으면 다음 페이지가 자동 생성됩니다.';
 $('pitchInfo').textContent=spacingInfo(page);$('bits').textContent=result.bits.match(/.{1,7}/g).slice(0,2000).join(' ')+(result.bits.length>14000?' … (미리보기는 2,000자까지)':'');
}
$('pagePrev').onclick=()=>{if(previewPage>0){previewPage--;render();}};
$('pageNext').onclick=()=>{if(result&&previewPage<result.pageCount-1){previewPage++;render();}};
$('zero').onchange=render;$('margins').onchange=render;
$('export').onclick=()=>{if(!result)return;try{B.validateColumns(result);}catch(e){invalidate();status(e.message,true);return;}$('exportError').textContent='';if(separatorLayout!==result){$('separatorLength').value=result.p.width-result.p.left-result.p.right;separatorLayout=result;}exportPreviewPage=Math.min(previewPage,result.pageCount-1);syncSeparatorControls();renderExportPreview();$('exportDialog').showModal();};
$('exportCancel').onclick=()=>$('exportDialog').close();
$('exportForm').onsubmit=e=>{e.preventDefault();if(!result)return;
 const formats=[...($('saveSVG').checked?['svg']:[]),...($('savePDF').checked?['pdf']:[])];
 if(!formats.length){$('exportError').textContent='출력 형식을 하나 이상 선택하세요.';return;}
 let payloads;
 try{const custom=result.p.shape==='custom'?customRenderData():null;payloads=[];if(formats.includes('pdf'))payloads.push({format:'pdf',data:B.pdf(result,custom),page:null});if(formats.includes('svg'))payloads.push({format:'svg',data:B.svg(result,separatorOptions(),custom),page:null});}
 catch(error){$('exportError').textContent=error.message;return;}
 const date=new Date(),pad=n=>String(n).padStart(2,'0');const stamp=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
 for(const {format,data,page} of payloads){const url=URL.createObjectURL(new Blob([data],{type:format==='svg'?'image/svg+xml;charset=utf-8':'application/pdf'}));const a=document.createElement('a');a.href=url;const suffix=format==='svg'&&result.pageCount>1?'_all-boards_layers':'';a.download=`Min_Basile_Bouchon_${stamp}_Arduino_ASCII_${result.p.width}x${result.p.height}_${result.p.layoutMode}_${result.p.shape}${suffix}.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 $('exportDialog').close();status(`${formats.join(' / ').toUpperCase()} 다운로드를 요청했습니다. SVG는 ${result.pageCount}개 판이 하나의 파일에 포함됩니다.`);
};

function renderDebug(){
 $('debugBody').replaceChildren();
 const display=c=>c===' '?'␠ (space)':c==='\n'?'\\n (LF)':c==='\t'?'\\t (TAB)':c==='\r'?'\\r (CR)':c.charCodeAt(0)<32||c.charCodeAt(0)===127?'U+'+c.charCodeAt(0).toString(16).padStart(4,'0'):c;
 for(const entry of debugRows.slice(debugOffset,debugOffset+100)){const tr=document.createElement('tr');for(const value of [entry.index,display(entry.character),entry.decimal,entry.binary]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('debugBody').append(tr);}
 $('debugPage').textContent=debugRows.length?`${debugOffset+1}–${Math.min(debugOffset+100,debugRows.length)} / ${debugRows.length}문자`:'교정 후 표시';
 $('debugPrev').disabled=debugOffset===0;$('debugNext').disabled=debugOffset+100>=debugRows.length;
}
$('debugPrev').onclick=()=>{debugOffset=Math.max(0,debugOffset-100);renderDebug();};
$('debugNext').onclick=()=>{if(debugOffset+100<debugRows.length)debugOffset+=100;renderDebug();};

function separatorOptions(){return {enabled:$('separatorEnabled').checked,color:$('separatorColor').value,stroke:Number($('separatorStroke').value),length:Number($('separatorLength').value),offsetX:Number($('separatorX').value),offsetY:Number($('separatorY').value)};}
function renderExportPreview(){
 if(!result)return;
 const page=result.pages[exportPreviewPage]||result.pages[0],p=page.p,ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height}`);svg.setAttribute('aria-label',`출력 미리보기 ${exportPreviewPage+1}페이지`);
 const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 el('rect',{width:p.width,height:p.height,fill:'white'});
 for(const h of page.holes)shapeElement(el,h,p,{stroke:p.color,strokeWidth:Math.max(.17,p.stroke)});
 if(result.p.layoutMode==='column'&&$('saveSVG').checked&&$('separatorEnabled').checked){
   try{
     const sep=B.separators(page,separatorOptions());
     for(const line of sep.lines)el('line',{x1:line.x1,y1:line.y,x2:line.x2,y2:line.y,stroke:sep.settings.color,'stroke-width':Math.max(.17,sep.settings.stroke)});
   }catch(_){}
 }
 $('exportPreview').replaceChildren(svg);
 $('exportPageNav').hidden=result.pageCount<=1;
 $('exportPageLabel').textContent=`${exportPreviewPage+1} / ${result.pageCount} 페이지`;
 $('exportPagePrev').disabled=exportPreviewPage===0;
 $('exportPageNext').disabled=exportPreviewPage>=result.pageCount-1;
}
$('exportPagePrev').onclick=()=>{if(exportPreviewPage>0){exportPreviewPage--;renderExportPreview();syncSeparatorControls();}};
$('exportPageNext').onclick=()=>{if(result&&exportPreviewPage<result.pageCount-1){exportPreviewPage++;renderExportPreview();syncSeparatorControls();}};

function syncSeparatorControls(){
 const available=!!result&&result.p.layoutMode==='column'&&$('saveSVG').checked;
 $('separatorControls').disabled=!available;
 for(const n of $('separatorControls').querySelectorAll('.fields input'))n.disabled=!available||!$('separatorEnabled').checked;
 $('exportError').textContent='';
 if(!available){$('separatorStatus').textContent='SVG 출력과 7-bit Column Layout을 선택하면 사용할 수 있습니다.';return;}
 try{const s=B.separators(result.pages[exportPreviewPage]||result.pages[0],separatorOptions());$('separatorStatus').textContent=s.lines.length?`SVG 구분선 ${s.lines.length}개 · 별도 편집 그룹으로 저장`:'구분선 OFF · 타공만 저장';}
 catch(error){$('separatorStatus').textContent=error.message;}
}
$('saveSVG').addEventListener('change',()=>{syncSeparatorControls();renderExportPreview();});
$('savePDF').addEventListener('change',renderExportPreview);
$('separatorControls').addEventListener('input',()=>{syncSeparatorControls();renderExportPreview();});
