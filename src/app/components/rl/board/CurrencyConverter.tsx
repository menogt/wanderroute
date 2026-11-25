import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CONVERTER_CURRENCIES, convertAmount, FALLBACK_RATES, formatConverted, loadRates, type RateTable } from "../../../lib/currencyRates";
import "../../../../styles/currency-converter.css";

/** Quick conversion beside the budget. A guide only: it never changes the plan's own estimates. */
export function CurrencyConverter({ amount, currency }: { amount: number; currency: string }) {
  const [table, setTable] = useState<RateTable>(FALLBACK_RATES);
  const [value, setValue] = useState(String(amount));
  const [from, setFrom] = useState(currency);
  const [to, setTo] = useState(currency === "LKR" ? "USD" : "LKR");
  useEffect(() => { let active = true; loadRates().then(next => { if (active) setTable(next); }); return () => { active = false; }; }, []);
  const offered = CONVERTER_CURRENCIES.filter(code => table.rates[code] > 0 || code === from || code === to);
  const result = value.trim() === "" ? undefined : convertAmount(Number(value), from, to, table);
  const one = convertAmount(1, from, to, table);
  return <section className="wr-fx" aria-labelledby="wr-fx-title">
    <h3 id="wr-fx-title">Currency converter</h3>
    <div className="wr-fx__row">
      <label>Amount<input type="number" min="0" step="any" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} /></label>
      <label>From<select value={from} onChange={event => setFrom(event.target.value)}>{offered.map(code => <option key={code}>{code}</option>)}</select></label>
      <button type="button" className="wr-fx__swap" onClick={() => { setFrom(to); setTo(from); }} aria-label={`Swap: convert ${to} to ${from}`}><ArrowLeftRight size={17} aria-hidden="true" /></button>
      <label>To<select value={to} onChange={event => setTo(event.target.value)}>{offered.map(code => <option key={code}>{code}</option>)}</select></label>
    </div>
    <p className="wr-fx__result" role="status">{result !== undefined
      ? <><span>{formatConverted(Number(value), from)} {from} ≈</span> <strong>{formatConverted(result, to)} {to}</strong></>
      : value.trim() === "" ? "Enter an amount to convert." : "No rate available for this pair right now."}</p>
    <p className="wr-fx__note">{one !== undefined && from !== to && <>1 {from} ≈ {one >= 10 ? formatConverted(one, to) : one.toLocaleString("en-US", { maximumFractionDigits: 4 })} {to}. </>}
      {table.live ? <>Mid-market guide rate from {table.updated}; banks, cards and exchange counters charge more. <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates by Exchange Rate API</a>.</>
        : <>Live rates are unavailable, so this uses the plan's fixed rate from {table.updated} (US dollars and rupees only).</>}</p>
  </section>;
}
