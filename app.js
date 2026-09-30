'use strict';
const $=id=>document.getElementById(id),B=Bouchon;
let result=null,params={...B.defaults},debugRows=[],debugOffset=0,separatorLayout=null;
const example='#include <Servo.h>\n\nServo s;\n\nvoid setup() {\n  s.attach(9);\n}\n\nvoid loop() {\n  s.write(180);\n  delay(1000);\n  s.write(0);\n  delay(1000);\n}\n';
$('source').value=example;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function invalidate(){result=null;debugRows=[];debugOffset=0;renderDebug();$('columnCheck').textContent='';$('export').disabled=true;$('stats').replaceChildren();$('pitchInfo').textContent='';$('bits').textContent='변환 후 표시됩니다.';$('preview').replaceChildren();const p=document.createElement('p');p.textContent='코드가 변경되었습니다. 다시 변환하세요.';$('preview').append(p);}
$('source').addEventListener('input',()=>{invalidate();$('corrected').value='';status('원본이 변경되었습니다. 다시 교정·변환하세요.');});
function correct(){const text=B.minify($('source').value);$('corrected').value=text;debugRows=B.characterTable(text);debugOffset=0;renderDebug();return text;}
$('correct').onclick=()=>{invalidate();try{const text=correct();status(`교정 완료 · ${$('source').value.length} → ${text.length}자\n실제 실행 여부는 Arduino IDE에서 컴파일해 확인하세요.`);}catch(e){$('corrected').value='';status(e.message,true);}};
$('example').onclick=()=>{if($('source').value!==example&&!confirm('현재 입력을 예제 코드로 바꿀까요?'))return;$('source').value=example;$('corrected').value='';invalidate();status('서보 예제를 불러왔습니다.');};
function formParams(){const f=$('settingsForm');return Object.fromEntries(Object.keys(B.defaults).map(k=>[k,typeof B.defaults[k]==='string'?f.elements[k].value:Number(f.elements[k].value)]));}
function syncPresets(){const f=$('settingsForm');const board=f.elements.width.value+','+f.elements.height.value;$('preset').value=['300,450','300,400','600,450'].includes(board)?board:'custom';const ms=['top','bottom','left','right'].map(k=>f.elements[k].value);$('marginPreset').value=ms.every(v=>v===ms[0])&&['10','20','40'].includes(ms[0])?ms[0]:'custom';}
function syncFields(){const f=$('settingsForm'),column=f.elements.layoutMode.value==='column';$('columnFields').hidden=!column;for(const n of $('columnFields').querySelectorAll('input,select'))n.disabled=!column;f.elements.columnPitch.disabled=!column||f.elements.columnSpacing.value==='auto';f.elements.rowGroupPitch.disabled=!column||f.elements.rowGroupSpacing.value==='auto';for(const label of document.querySelectorAll('.continuousField')){label.hidden=column;label.querySelector('input').disabled=column;}}
function spacingInfo(r){return r.p.layoutMode==='column'?`열 중심 간격 ${r.columnPitch.toFixed(4)} mm · 비트 중심 간격 ${r.p.bitPitch.toFixed(4)} mm · 행 그룹 시작 중심 간격 ${r.rowGroupPitch.toFixed(4)} mm`:`가로 중심 간격 ${(r.p.diameter+r.p.gap).toFixed(4)} mm · 세로 중심 간격 ${(r.p.diameter+r.p.rowGap).toFixed(4)} mm`;}
function marginPreview(){syncFields();try{$('calculatedSpacing').textContent=spacingInfo(B.layout($('corrected').value,formParams()));}catch(e){$('calculatedSpacing').textContent=e.message;}const p=formParams();if(![p.width,p.height,p.top,p.left,p.right,p.bottom].every(Number.isFinite)||p.width<=0||p.height<=0)return;$('marginPreview').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}"><rect width="${p.width}" height="${p.height}" fill="#d8e2d2" stroke="#4a6250" stroke-width="1"/><rect x="${p.left}" y="${p.top}" width="${Math.max(0,p.width-p.left-p.right)}" height="${Math.max(0,p.height-p.top-p.bottom)}" fill="#fff" stroke="#78927a" stroke-dasharray="3 3"/></svg>`;}
$('convert').onclick=()=>{try{correct();B.ascii($('corrected').value);for(const [k,v]of Object.entries(params))$('settingsForm').elements[k].value=v;$('settingError').textContent='';syncFields();syncPresets();marginPreview();$('settings').showModal();}catch(e){invalidate();status(e.message,true);}};
$('cancel').onclick=()=>$('settings').close();
$('preset').onchange=e=>{if(e.target.value!=='custom'){const [w,h]=e.target.value.split(',');$('settingsForm').elements.width.value=w;$('settingsForm').elements.height.value=h;marginPreview();}};
$('marginPreset').onchange=e=>{if(e.target.value!=='custom'){for(const k of ['top','bottom','left','right'])$('settingsForm').elements[k].value=e.target.value;marginPreview();}};
$('settingsForm').addEventListener('input',e=>{if(['width','height'].includes(e.target.name))$('preset').value='custom';if(['top','bottom','left','right'].includes(e.target.name))$('marginPreset').value='custom';marginPreview();});
$('settingsForm').onsubmit=e=>{e.preventDefault();try{const next=B.layout($('corrected').value,formParams());params=next.p;result=next;render();$('export').disabled=false;$('settings').close();status(`변환 완료 · ${result.bits.length.toLocaleString()}비트 / 수용 ${result.capacity.toLocaleString()}비트\n타공은 1만 출력합니다. SVG 구분선은 출력창에서 설정하세요.`);}catch(e){$('settingError').textContent=e.message;}};
function render(){if(!result)return;B.validateColumns(result);debugRows=result.characters;renderDebug();$('columnCheck').textContent=result.p.layoutMode==='column'?'검증 통과 · 문자별 ASCII와 모든 타공 세로열 좌표가 일치합니다.':'연속 배치 모드 · 문자 세로열 검증은 적용하지 않습니다.';$('activeMode').textContent='현재 모드: '+(result.p.layoutMode==='column'?'7-bit Column Layout':'Continuous Bit Layout');const {p,holes,bits,cols}=result,outer=p.diameter+p.stroke;const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height}`);svg.setAttribute('aria-label','타공 패턴 미리보기');
 const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 el('rect',{width:p.width,height:p.height,fill:'white'});
 if($('margins').checked){el('rect',{width:p.width,height:p.height,fill:'#e6eddf'});el('rect',{x:p.left,y:p.top,width:p.width-p.left-p.right,height:p.height-p.top-p.bottom,fill:'white',stroke:'#99ad92','stroke-width':.3,'stroke-dasharray':'2 2'});}
 if($('zero').checked)for(let i=0;i<bits.length;i++)if(bits[i]==='0'){const point=B.position(result,i);el('circle',{cx:point.x,cy:point.y,r:p.diameter/2,fill:'none',stroke:'#d3d8d0','stroke-width':.15});}
 for(const h of holes)el('circle',{cx:h.x,cy:h.y,r:p.diameter/2,fill:'none',stroke:p.color,'stroke-width':Math.max(.17,p.stroke)});
 $('preview').replaceChildren(svg);$('stats').replaceChildren();for(const [label,value]of [['Characters',result.text.length],['ASCII bits',bits.length],['Holes',holes.length],['Board · mm',`${p.width} × ${p.height}`],[p.layoutMode==='column'?'행 그룹 × 문자 열':'Rows × Columns',`${result.rows} × ${cols}`],['Margin · 위/아래/좌/우',`${p.top} / ${p.bottom} / ${p.left} / ${p.right}`]]){const d=document.createElement('div');d.className='stat';const s=document.createElement('small');s.textContent=label;const v=document.createElement('strong');v.textContent=value;d.append(s,v);$('stats').append(d);}
 $('layoutNote').textContent=p.layoutMode==='column'?`7-bit Column Layout · 상위 비트부터 위 → 아래로 7비트. ${p.charactersPerRow}문자마다 다음 행 그룹으로 이동합니다.`:'Continuous Bit Layout · 왼쪽 → 오른쪽, 위 → 아래로 연속 배치합니다. 문자는 행 경계에서 나뉠 수 있습니다.';$('pitchInfo').textContent=spacingInfo(result);
 $('bits').textContent=bits.match(/.{1,7}/g).slice(0,2000).join(' ')+(bits.length>14000?' … (미리보기는 2,000자까지)':'');
}
$('zero').onchange=render;$('margins').onchange=render;
$('export').onclick=()=>{if(!result)return;try{B.validateColumns(result);}catch(e){invalidate();status(e.message,true);return;}$('exportError').textContent='';if(separatorLayout!==result){$('separatorLength').value=result.p.width-result.p.left-result.p.right;separatorLayout=result;}syncSeparatorControls();$('exportDialog').showModal();};
$('exportCancel').onclick=()=>$('exportDialog').close();
$('exportForm').onsubmit=e=>{e.preventDefault();if(!result)return;
 const formats=[...($('saveSVG').checked?['svg']:[]),...($('savePDF').checked?['pdf']:[])];
 if(!formats.length){$('exportError').textContent='출력 형식을 하나 이상 선택하세요.';return;}
 let payloads;
 try{payloads=formats.map(format=>({format,data:format==='svg'?B.svg(result,separatorOptions()):B.pdf(result)}));}
 catch(error){$('exportError').textContent=error.message;return;}
 const date=new Date(),pad=n=>String(n).padStart(2,'0');const stamp=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
 for(const {format,data} of payloads){const url=URL.createObjectURL(new Blob([data],{type:format==='svg'?'image/svg+xml;charset=utf-8':'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=`Min_Basile_Bouchon_${stamp}_Arduino_ASCII_${result.p.width}x${result.p.height}_${result.p.layoutMode}.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 $('exportDialog').close();status(`${formats.join(' / ').toUpperCase()} 다운로드를 요청했습니다. 저장 위치는 브라우저의 다운로드 설정을 따릅니다.`);
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
function syncSeparatorControls(){
 const available=!!result&&result.p.layoutMode==='column'&&$('saveSVG').checked;
 $('separatorControls').disabled=!available;
 for(const n of $('separatorControls').querySelectorAll('.fields input'))n.disabled=!available||!$('separatorEnabled').checked;
 $('exportError').textContent='';
 if(!available){$('separatorStatus').textContent='SVG 출력과 7-bit Column Layout을 선택하면 사용할 수 있습니다.';return;}
 try{const s=B.separators(result,separatorOptions());$('separatorStatus').textContent=s.lines.length?`SVG 구분선 ${s.lines.length}개 · 별도 편집 그룹으로 저장`:'구분선 OFF · 타공 원만 저장';}
 catch(error){$('separatorStatus').textContent=error.message;}
}
$('saveSVG').addEventListener('change',syncSeparatorControls);
$('separatorControls').addEventListener('input',syncSeparatorControls);
