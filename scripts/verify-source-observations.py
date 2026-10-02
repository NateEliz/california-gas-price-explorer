"""Independently compare ten imported price observations to official HTML tables."""
import concurrent.futures
import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.request import urlopen

class Rows(HTMLParser):
    def __init__(self):
        super().__init__();self.rows=[];self.row=[];self.parts=[];self.inside=False
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row=[]
        if tag in ('td','th'):self.inside=True;self.parts=[]
    def handle_data(self,data):
        if self.inside:self.parts.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th'):self.row.append(''.join(self.parts).strip());self.inside=False
        if tag=='tr' and self.row:self.rows.append(self.row)

ROOT=Path(__file__).resolve().parent.parent
s=json.loads((ROOT/'data/snapshot.json').read_text())
latest={f:max(r['period'] for r in s[f] if r['ca'] is not None and r['us'] is not None) for f in ('weekly','monthly')}
targets=[('ca','weekly','2000-05-22'),('us','weekly','2000-05-22'),('ca','weekly','2018-05-07'),('us','weekly','2018-05-21'),('ca','weekly',latest['weekly']),('us','weekly',latest['weekly']),('ca','monthly','2000-06'),('us','monthly','2000-06'),('ca','monthly',latest['monthly']),('us','monthly',latest['monthly'])]
def fetch(key):
    geo,f=key;url=f'https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_{"SCA" if geo=="ca" else "NUS"}_DPG&f={"W" if f=="weekly" else "M"}'
    p=Rows();p.feed(urlopen(url,timeout=45).read().decode());observed={}
    for r in p.rows:
        if f=='monthly' and len(r)==13 and r[0].isdigit():
            for m,v in enumerate(r[1:],1):
                if v and v not in ('NA','N/A','--'):observed[f'{r[0]}-{m:02d}']=float(v)
        elif f=='weekly' and len(r)==11:
            try:year_month=dt.datetime.strptime(r[0],'%Y-%b')
            except ValueError:continue
            for i in range(1,11,2):
                if r[i] and r[i+1] and r[i+1] not in ('NA','N/A','--'):observed[str(year_month.year)+'-'+r[i].replace('/','-')]=float(r[i+1])
    return key,(url,observed)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    downloaded=dict(pool.map(fetch,sorted({(g,f) for g,f,_ in targets})))
checks=[]
for geo,f,period in targets:
    url,values=downloaded[(geo,f)];imported=next(r for r in s[f] if r['period']==period)[geo];official=values[period]
    if imported!=official:raise AssertionError((geo,f,period,imported,official))
    checks.append({'geography':geo,'frequency':f,'period':period,'imported':imported,'officialTable':official,'sourceUrl':url,'status':'passed'})
report={'snapshotId':s['snapshotId'],'verifiedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':checks}
(ROOT/'data/source-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'status':'passed','independentOfficialTableChecks':len(checks),'snapshotId':s['snapshotId']}))
