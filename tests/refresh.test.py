import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

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

if __name__=='__main__':unittest.main()
