export type Frequency = 'monthly' | 'weekly';
export type Basis = 'nominal' | 'real';
export type PriceRow = { period: string; ca: number | null; us: number | null };
export type Snapshot = {
  schemaVersion: number; snapshotId: string; retrievedAt: string;
  weekly: PriceRow[]; monthly: PriceRow[]; cpi: {period: string; value: number}[];
  sources: {file: string; url: string; sha256: string; retrievedAt: string}[];
  series: {ca: string; us: string; cpi: string};
  coverage: Record<Frequency, {first: string; last: string; rows: number; missingPeriods: string[]}>;
  cpiCoverage: {first: string; last: string; rows: number; missingPeriods: string[]};
};

export const METHOD_URL = 'https://www.eia.gov/petroleum/gasdiesel/gas_proc-methods.php';
export const CPI_URL = 'https://data.bls.gov/timeseries/CUUR0000SA0';
export const INFLATION_URL = 'https://www.bls.gov/cpi/factsheets/purchasing-power-constant-dollars.htm';
export const BREAK_NOTE = 'EIA changed gasoline-price methodology on May 14, 2018. Estimates across the transition are not directly comparable; May 2018 monthly data also include the transition.';
export const INTERPRETATION = 'The California–U.S. price gap is descriptive. It does not isolate the effect of a policy, tax, refinery, or administration.';

export function sourceUrl(geo: 'ca' | 'us', frequency: Frequency) {
  return `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_${geo === 'ca' ? 'SCA' : 'NUS'}_DPG&f=${frequency === 'weekly' ? 'W' : 'M'}`;
}
export function label(period: string, frequency: Frequency) {
  return new Intl.DateTimeFormat('en-US', {timeZone:'UTC', month:'short', year:'numeric', ...(frequency === 'weekly' ? {day:'numeric'} : {})}).format(new Date(period + (frequency === 'monthly' ? '-01' : '') + 'T12:00:00Z'));
}
export const money = (n: number, digits = 3) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:digits, maximumFractionDigits:digits}).format(n);
export const signed = (n: number, digits = 3) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n), digits)}`;
export function validateSnapshot(input: unknown): asserts input is Snapshot {
  const s = input as Snapshot;
  if (!s || s.schemaVersion !== 1 || !s.snapshotId || !Number.isFinite(Date.parse(s.retrievedAt))) throw Error('Invalid snapshot identity/date.');
  if (s.series?.ca !== 'EMM_EPMR_PTE_SCA_DPG' || s.series?.us !== 'EMM_EPMR_PTE_NUS_DPG' || s.series?.cpi !== 'CUUR0000SA0') throw Error('Unexpected source series.');
  for (const f of ['monthly','weekly'] as Frequency[]) {
    if (!Array.isArray(s[f]) || !s[f].length) throw Error(`Missing ${f} history.`);
    const seen = new Set<string>(); let last = '';
    for (const r of s[f]) {
      const pattern = f === 'monthly' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
      if (!pattern.test(r.period) || seen.has(r.period) || r.period <= last) throw Error('Duplicate/invalid/unsorted period.');
      seen.add(r.period); last = r.period;
      for (const v of [r.ca,r.us]) if (v !== null && (!Number.isFinite(v) || v <= 0)) throw Error('Invalid source price.');
    }
    if (!s[f].some(valid)) throw Error(`No shared ${f} observations.`);
  }
  const seen = new Set<string>();
  if (!Array.isArray(s.cpi) || !s.cpi.length) throw Error('Missing CPI history.');
  for (const r of s.cpi) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period) || seen.has(r.period) || !Number.isFinite(r.value) || r.value <= 0) throw Error('Duplicate/invalid CPI.');
    seen.add(r.period);
  }
  if (!s.monthly.some(r=>valid(r)&&seen.has(r.period))) throw Error('No common price/CPI observations.');
}
export function valid(row: PriceRow): row is PriceRow & {ca: number; us: number} {return row.ca !== null && row.us !== null;}
export function eligible(s: Snapshot, frequency: Frequency, basis: Basis) {
  if (frequency === 'weekly' && basis === 'real') throw Error('Inflation adjustment requires monthly observations.');
  const cpi = new Map(s.cpi.map(r=>[r.period,r.value]));
  return s[frequency].filter(r=>valid(r) && (basis !== 'real' || cpi.has(r.period)));
}
export function transform(s: Snapshot, frequency: Frequency, basis: Basis, endpoint: string): PriceRow[] {
  const cpi = new Map(s.cpi.map(r=>[r.period,r.value]));
  const ref = cpi.get(endpoint);
  if (basis === 'real' && (!ref || frequency !== 'monthly')) throw Error('Missing inflation reference.');
  return s[frequency].filter(r=>r.period <= endpoint).map(r=>{
    const current = cpi.get(r.period);
    const factor = basis === 'real' ? (current ? ref! / current : null) : 1;
    return {...r, ca:r.ca === null || factor === null ? null : r.ca*factor, us:r.us === null || factor === null ? null : r.us*factor};
  });
}
export function compare(rows: PriceRow[], baseline: string, endpoint: string, gallons: number) {
  if (!Number.isFinite(gallons) || gallons < 1 || gallons > 100) throw Error('Enter 1–100 gallons.');
  if (baseline > endpoint) throw Error('Baseline must not follow the endpoint.');
  const a = rows.find(r=>r.period === baseline), b = rows.find(r=>r.period === endpoint);
  if (!a || !b || !valid(a) || !valid(b)) throw Error('Comparison observation is unavailable.');
  const delta = b.ca-a.ca, gapA = a.ca-a.us, gapB = b.ca-b.us;
  return {a, b, delta, percent:100*(b.ca/a.ca-1), gapA, gapB, gapDelta:gapB-gapA, fillup:gallons*delta};
}
export function anniversary(period: string, years: number, frequency: Frequency) {
  const year = Number(period.slice(0,4))-years;
  if (frequency === 'monthly') return `${year}${period.slice(4)}`;
  const month = Number(period.slice(5,7)), day = Number(period.slice(8,10));
  const capped = Math.min(day,new Date(Date.UTC(year,month,0)).getUTCDate());
  return `${year}-${String(month).padStart(2,'0')}-${String(capped).padStart(2,'0')}`;
}
export function preset(rows: PriceRow[], endpoint: string, years: number, frequency: Frequency): string | null {
  const target = anniversary(endpoint,years,frequency);
  if (frequency === 'monthly') return rows.find(r=>r.period === target && valid(r))?.period ?? null;
  const candidate = [...rows].reverse().find(r=>r.period <= target && valid(r));
  if (!candidate) return null;
  const offset = (Date.parse(target)-Date.parse(candidate.period))/86400000;
  return offset <= 7 ? candidate.period : null;
}
export function crossesBreak(a: string, b: string, f: Frequency) {
  return f === 'weekly' ? a < '2018-05-14' && b >= '2018-05-14' : a <= '2018-05' && b >= '2018-05';
}
export function stale(period: string, f: Frequency, now: Date, thresholds = {weekly:14,monthly:75}) {
  const date = f === 'weekly' ? new Date(period+'T00:00:00Z') : new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5)),0));
  return (now.getTime()-date.getTime())/86400000 > thresholds[f];
}
export type ExportContext = {s: Snapshot; frequency:Frequency; basis:Basis; baseline:string; endpoint:string; gallons:number; rows:PriceRow[]};
export function contextLines(c: ExportContext) {
  return [
    'California Gas Price Explorer',
    `Regular gasoline, all formulations; statewide/national estimates including taxes. USD per gallon.`,
    `${label(c.baseline,c.frequency)} compared with ${label(c.endpoint,c.frequency)}; ${c.frequency}.`,
    c.basis === 'real' ? `Inflation adjusted to ${label(c.endpoint,'monthly')} dollars, CPI-U all items (unadjusted).` : 'Nominal dollars; no inflation adjustment.',
    'U.S. average includes California. Gallons illustration holds consumption constant.',
    `Snapshot ${c.s.snapshotId}; retrieved ${c.s.retrievedAt}; fixed snapshot, manual refresh.`,
    `CA source: ${sourceUrl('ca',c.frequency)}`, `U.S. source: ${sourceUrl('us',c.frequency)}`,
    ...(c.basis === 'real' ? [`CPI: ${CPI_URL}`,`Inflation method: ${INFLATION_URL}`] : []),
    `Method: ${METHOD_URL}`,
    ...(crossesBreak(c.rows[0]?.period ?? c.baseline,c.endpoint,c.frequency) ? [BREAK_NOTE] : []),
    INTERPRETATION,
  ];
}
const csvEscape = (v: unknown) => '"'+String(v ?? '').replace(/"/g,'""')+'"';
export function buildCsv(c: ExportContext) {
  const result = compare(c.rows,c.baseline,c.endpoint,c.gallons);
  const metadata = contextLines(c).map(l=>["# metadata",l].map(csvEscape).join(','));
  const headers = ['period','frequency','dollar_basis','reference_month','ca_usd_per_gallon','us_usd_per_gallon','ca_minus_us','role','snapshot_id','ca_source','us_source','cpi_source'];
  const body = c.rows.map(r=>[r.period,c.frequency,c.basis,c.basis === 'real' ? c.endpoint : '',r.ca?.toFixed(3) ?? '',r.us?.toFixed(3) ?? '', valid(r) ? (r.ca-r.us).toFixed(3) : '',[r.period === c.baseline ? 'baseline' : '',r.period === c.endpoint ? 'endpoint' : ''].filter(Boolean).join(';'),c.s.snapshotId,sourceUrl('ca',c.frequency),sourceUrl('us',c.frequency),c.basis === 'real' ? CPI_URL : ''].map(csvEscape).join(','));
  const summary = [
    ['# result','ca_change_usd_per_gallon',result.delta.toFixed(3)],['# result','ca_change_percent',result.percent.toFixed(1)],
    ['# result','gap_change_usd_per_gallon',result.gapDelta.toFixed(3)],['# result','gallons',c.gallons],['# result','fillup_change_usd',result.fillup.toFixed(3)],
    ['# formula','ca_change','CA_endpoint - CA_baseline'],['# formula','ca_percent','100 * (CA_endpoint / CA_baseline - 1)'],
    ['# formula','gap_change','(CA_endpoint - US_endpoint) - (CA_baseline - US_baseline)'],
    ['# formula','fillup_change','gallons * ca_change'],['# formula','real_price','nominal_price * CPI_reference / CPI_period'],
  ].map(r=>r.map(csvEscape).join(','));
  return '\uFEFF'+[...metadata,...summary,headers.map(csvEscape).join(','),...body].join('\r\n');
}
