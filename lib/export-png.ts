import {compare, contextLines, crossesBreak, label, money, signed, type ExportContext} from './prices';
export function saveBlob(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function exportPng(c: ExportContext) {
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('PNG export is unavailable in this browser.');
  const text=(s:string,x:number,y:number,size=22,color='#152c45')=>{ctx.fillStyle=color;ctx.font=`${size}px Arial, sans-serif`;ctx.fillText(s,x,y);};
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1800,1350);
  text('California Gas Price Explorer',70,65,36);text(`${label(c.baseline,c.frequency)} compared with ${label(c.endpoint,c.frequency)}`,70,105,24);
  text(c.basis==='real'?`${label(c.endpoint,'monthly')} dollars · inflation adjusted`:'Nominal USD per gallon · including taxes',70,141);
  const r=compare(c.rows,c.baseline,c.endpoint,c.gallons);
  text(`California: ${money(r.a.ca)} to ${money(r.b.ca)} (${signed(r.delta)}; ${r.percent.toFixed(1)}%)`,70,180,25);
  text(`CA–U.S. gap: ${money(r.gapA)} to ${money(r.gapB)}; change ${signed(r.gapDelta)}`,70,217,25);
  text(`${c.gallons}-gallon illustration: ${signed(r.fillup,2)} per fill-up`,70,251,22);
  const x0=100,y0=310,w=1610,h=440,values=c.rows.flatMap(p=>[p.ca,p.us]).filter((n):n is number=>n!==null);
  const max=Math.ceil(Math.max(...values)*1.08),first=Date.parse(c.rows[0].period+(c.frequency==='monthly'?'-01':'')),last=Date.parse(c.endpoint+(c.frequency==='monthly'?'-01':''));
  const x=(p:string)=>x0+(Date.parse(p+(c.frequency==='monthly'?'-01':''))-first)/Math.max(1,last-first)*w,y=(n:number)=>y0+h-n/max*h;
  ctx.strokeStyle='#dce3eb';ctx.lineWidth=1;
  for(let i=0;i<=5;i++){const n=max*i/5;ctx.beginPath();ctx.moveTo(x0,y(n));ctx.lineTo(x0+w,y(n));ctx.stroke();text(money(n,2),15,y(n)+8,20,'#52657a');}
  for(const [geo,color] of [['ca','#087f86'],['us','#a95e10']] as const){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash(geo==='us'?[7,4]:[]);ctx.beginPath();let open=false;for(const p of c.rows){const n=p[geo];if(n===null){open=false;continue;}if(open)ctx.lineTo(x(p.period),y(n));else{ctx.moveTo(x(p.period),y(n));open=true;}}ctx.stroke();ctx.setLineDash([]);}
  for(let yr=Number(c.rows[0].period.slice(0,4));yr<=Number(c.endpoint.slice(0,4));yr+=5){const p=`${yr}-07${c.frequency==='weekly'?'-01':''}`;if(p>=c.rows[0].period&&p<=c.endpoint)text(String(yr),x(p)-20,y0+h+32,20,'#52657a');}
  text('California — solid teal',100,290,20,'#087f86');text('U.S. average — amber',400,290,20,'#a95e10');
  for(const [p,name] of [[c.baseline,'Baseline'],[c.endpoint,'Latest shared period']] as const){ctx.strokeStyle='#657587';ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(x(p),y0);ctx.lineTo(x(p),y0+h);ctx.stroke();ctx.setLineDash([]);text(`${name}: ${label(p,c.frequency)}`,name==='Baseline'?100:1110,817,20);}
  if(crossesBreak(c.rows[0].period,c.endpoint,c.frequency)){const p=c.frequency==='weekly'?'2018-05-14':'2018-05';ctx.strokeStyle='#77889a';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x(p),y0);ctx.lineTo(x(p),y0+h);ctx.stroke();ctx.setLineDash([]);text('2018 methodology change',x(p)-120,y0+25,18);}
  let yy=855;
  for(const line of contextLines(c).slice(1)){let current='';for(const word of line.split(' ')){const next=current?current+' '+word:word;ctx.font='18px Arial';if(ctx.measureText(next).width>1650&&current){text(current,70,yy,18,'#45576b');yy+=24;current=word;}else current=next;}text(current,70,yy,18,'#45576b');yy+=24;}
  if(yy>canvas.height-20)throw Error('Export notes exceed the image layout.');
  return new Promise<void>((resolve,reject)=>canvas.toBlob(blob=>{if(!blob){reject(Error('PNG export failed.'));return;}saveBlob(blob,`california-gas-${c.frequency}-${c.baseline}-${c.endpoint}-${c.basis}.png`);resolve();},'image/png'));
}
