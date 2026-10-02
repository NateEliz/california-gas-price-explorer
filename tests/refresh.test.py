import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import io

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('refresh',ROOT/'scripts/refresh-data.py')
refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)
s=json.loads((ROOT/'data/snapshot.json').read_text())
fixture_id='eia-bls-512f94779b431ee3'
raw=ROOT/'data/raw'/fixture_id

class RefreshChecks(unittest.TestCase):
    def test_missing_cpi_is_unavailable(self):
        observations=refresh.cpi(raw/'bls-all-items.txt',refresh.dt.date(2026,10,1))
        self.assertNotIn('2025-10',observations)
        self.assertEqual(observations['2026-08'],334.980)

    def test_partial_month_and_common_endpoints(self):
        current=refresh.assemble(raw,refresh.dt.date(2026,10,1),s['retrievedAt'])
        self.assertEqual(current['monthly'][0]['period'],'2000-06')
        self.assertEqual(current['realEndpoint'],'2026-08')
        self.assertEqual(current['snapshotId'],fixture_id)
        self.assertEqual(current['cpiCoverage']['missingPeriods'],['2025-10'])

    def test_failed_refresh_preserves_last_valid_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            d=Path(directory);bad=d/'raw';shutil.copytree(raw,bad)
            f=bad/'bls-all-items.txt';f.write_text(f.read_text()+'\nCUUR0000SA0\t2026\tM08\t334.980\n')
            output=d/'snapshot.json';output.write_bytes((ROOT/'data/snapshot.json').read_bytes())
            before=hashlib.sha256(output.read_bytes()).hexdigest()
            run=subprocess.run([sys.executable,str(ROOT/'scripts/refresh-data.py'),'--replay',str(bad),'--output',str(output)],capture_output=True,text=True)
            self.assertNotEqual(run.returncode,0);self.assertIn('Duplicate/invalid CPI',run.stderr)
            self.assertEqual(before,hashlib.sha256(output.read_bytes()).hexdigest())

    def test_api_fallback_matches_archived_cpi_and_preserves_gaps(self):
        expected={p:v for p,v in refresh.cpi(raw/'bls-all-items.txt',refresh.dt.date(2026,10,1)).items() if p>='2000-01'}
        def response(request, timeout):
            query=json.loads(request.data)
            lo,hi=int(query['startyear']),int(query['endyear'])
            rows=[{'year':p[:4],'period':'M'+p[5:],'value':str(v)} for p,v in expected.items() if lo<=int(p[:4])<=hi]
            return io.BytesIO(json.dumps({'status':'REQUEST_SUCCEEDED','Results':{'series':[{'seriesID':'CUUR0000SA0','data':rows}]}}).encode())
        with tempfile.TemporaryDirectory() as directory:
            d=Path(directory)
            with patch.object(refresh.urllib.request,'urlopen',side_effect=response) as mocked:
                refresh.fetch_api_cpi(d,refresh.dt.date(2026,10,1))
            self.assertEqual(mocked.call_count,3)
            self.assertEqual(refresh.cpi(d/'bls-all-items.txt',refresh.dt.date(2026,10,1)),expected)
            self.assertNotIn('2025-10',expected)
            for source in json.loads((d/'bls-api-provenance.json').read_text()):
                self.assertEqual(hashlib.sha256((d/source['file']).read_bytes()).hexdigest(),source['sha256'])

    def test_api_rejects_failure_wrong_series_duplicates_and_invalid_values(self):
        row={'year':'2026','period':'M08','value':'334.980'}
        def payload(rows,series='CUUR0000SA0'):
            return {'status':'REQUEST_SUCCEEDED','Results':{'series':[{'seriesID':series,'data':rows}]}}
        for response in [{'status':'REQUEST_FAILED'},payload([row],'wrong'),payload([row,row]),payload([{**row,'value':'nan'}]),payload([])]:
            with self.assertRaises(ValueError):refresh.api_cpi_rows(response,2020,2026)

if __name__=='__main__':unittest.main()
