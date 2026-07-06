import { useMemo, useState } from 'react';

type ToolTab = 'builder' | 'saved' | 'profit' | 'savedProfit';

type SavedTable = {
  id: number;
  name: string;
  initialAmount: number;
  rows: number[][];
  price: number | string;
};

type SavedProfitTable = {
  id: number;
  name: string;
  initialPrice: number;
  lots: number;
  values: number[];
};

const yPercentages = Array.from({ length: 13 }, (_, index) => 40 + index * 5);
const xValues = ['500k', '550k', '600k', '650k', '700k', '750k', '800k', '850k', '900k', '950k', '1M'];
const xAmounts = [500000, 550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000];

const parseIntegerValue = (value: string) => Number(value.replace(/\D/g, '')) || 0;

const sanitizeDecimalInput = (value: string) => {
  const cleaned = value.replace(/[^\d,.]/g, '');
  const commaIndex = cleaned.indexOf(',');

  if (commaIndex >= 0) {
    const integerPart = cleaned.slice(0, commaIndex).replace(/\D/g, '');
    const decimalPart = cleaned.slice(commaIndex + 1).replace(/\D/g, '');
    return `${integerPart},${decimalPart}`;
  }

  const dotMatches = cleaned.match(/\./g) ?? [];
  const dotIndex = cleaned.indexOf('.');

  if (dotMatches.length === 1 && dotIndex > 0 && cleaned.slice(dotIndex + 1).length <= 2) {
    const integerPart = cleaned.slice(0, dotIndex).replace(/\D/g, '');
    const decimalPart = cleaned.slice(dotIndex + 1).replace(/\D/g, '');
    return `${integerPart},${decimalPart}`;
  }

  return cleaned.replace(/\D/g, '');
};

const parseDecimalValue = (value: number | string) => {
  if (typeof value === 'number') return value;
  return Number(sanitizeDecimalInput(value).replace(',', '.')) || 0;
};

const formatIntegerValue = (value: number | string) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : String(Math.ceil(value));
  if (!digits) return '';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(digits));
};

const formatDecimalValue = (value: number | string) => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value);
  }

  const sanitized = sanitizeDecimalInput(value);
  if (!sanitized) return '';

  const hasDecimalSeparator = sanitized.includes(',');
  const [integerPart, decimalPart = ''] = sanitized.split(',');
  const formattedInteger = integerPart
    ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(integerPart))
    : '';

  return hasDecimalSeparator ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

const buildRows = (initialAmount: number) =>
  yPercentages.map((percent) => {
    const baseValue = (initialAmount * percent) / 100;
    return xAmounts.map((xValue) => Math.ceil(baseValue / xValue));
  });

const buildProfitValues = (lots: number, initialPrice: number) => {
  const startValue = lots * initialPrice;
  const values = [Math.ceil(startValue)];
  let currentValue = startValue;

  for (let index = 1; index <= 12; index += 1) {
    currentValue = Math.ceil(currentValue * 1.1);
    values.push(currentValue);
  }

  return values;
};

const buildProfitDetails = (values: number[]) => {
  const startValue = values[0] ?? 0;

  return values.map((value, index) => {
    const previousValue = values[index - 1] ?? value;
    return {
      label: index === 0 ? 'Başlangıç' : `Gün ${index}`,
      value,
      change: index === 0 ? 0 : Math.ceil(value - previousValue),
      totalProfit: index === 0 ? 0 : Math.ceil(value - startValue)
    };
  });
};

const formatNumber = (value: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(value));

export const LocalTools = () => {
  const [activeTab, setActiveTab] = useState<ToolTab>('builder');
  const [initialAmount, setInitialAmount] = useState('2000000');
  const [tableName, setTableName] = useState('');
  const [price, setPrice] = useState('');
  const [savedTables, setSavedTables] = useState<SavedTable[]>(() => {
    const stored = window.localStorage.getItem('savedTables');
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [profitName, setProfitName] = useState('');
  const [profitPrice, setProfitPrice] = useState('');
  const [profitLots, setProfitLots] = useState('');
  const [savedProfitTables, setSavedProfitTables] = useState<SavedProfitTable[]>(() => {
    const stored = window.localStorage.getItem('savedProfitTables');
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedProfitId, setSelectedProfitId] = useState<number | null>(null);

  const rows = useMemo(() => buildRows(parseIntegerValue(initialAmount)), [initialAmount]);
  const profitPreviewValues = useMemo(() => buildProfitValues(parseIntegerValue(profitLots), parseDecimalValue(profitPrice)), [profitLots, profitPrice]);
  const selectedTable = savedTables.find((table) => table.id === selectedTableId) ?? savedTables[0] ?? null;
  const selectedProfitTable = savedProfitTables.find((table) => table.id === selectedProfitId) ?? savedProfitTables[0] ?? null;

  const saveTable = () => {
    const newTable: SavedTable = {
      id: Date.now(),
      name: tableName.trim() || `Tablo ${savedTables.length + 1}`,
      initialAmount: parseIntegerValue(initialAmount),
      rows,
      price: sanitizeDecimalInput(price)
    };
    const nextTables = [newTable, ...savedTables];
    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));
    setSelectedTableId(newTable.id);
    setActiveTab('saved');
  };

  const updateTablePrice = (tableId: number, nextPrice: string) => {
    const nextTables = savedTables.map((table) => (table.id === tableId ? { ...table, price: sanitizeDecimalInput(nextPrice) } : table));
    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));
  };

  const deleteTable = (tableId: number) => {
    const nextTables = savedTables.filter((table) => table.id !== tableId);
    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));
    setSelectedTableId(nextTables[0]?.id ?? null);
  };

  const saveProfitTable = () => {
    const lotsValue = parseIntegerValue(profitLots);
    const priceValue = parseDecimalValue(profitPrice);
    const newTable: SavedProfitTable = {
      id: Date.now(),
      name: profitName.trim() || `Kâr ${savedProfitTables.length + 1}`,
      initialPrice: priceValue,
      lots: lotsValue,
      values: buildProfitValues(lotsValue, priceValue)
    };
    const nextTables = [newTable, ...savedProfitTables];
    setSavedProfitTables(nextTables);
    window.localStorage.setItem('savedProfitTables', JSON.stringify(nextTables));
    setSelectedProfitId(newTable.id);
    setActiveTab('savedProfit');
  };

  const deleteProfitTable = (tableId: number) => {
    const nextTables = savedProfitTables.filter((table) => table.id !== tableId);
    setSavedProfitTables(nextTables);
    window.localStorage.setItem('savedProfitTables', JSON.stringify(nextTables));
    setSelectedProfitId(nextTables[0]?.id ?? null);
  };

  return (
    <section className="local-tools">
      <div className="tool-tabs">
        <button className={activeTab === 'builder' ? 'active' : ''} onClick={() => setActiveTab('builder')}>Tablo Oluştur</button>
        <button className={activeTab === 'saved' ? 'active' : ''} onClick={() => setActiveTab('saved')}>Tablolarım</button>
        <button className={activeTab === 'profit' ? 'active' : ''} onClick={() => setActiveTab('profit')}>Kâr</button>
        <button className={activeTab === 'savedProfit' ? 'active' : ''} onClick={() => setActiveTab('savedProfit')}>Kar Tablolarım</button>
      </div>

      {activeTab === 'builder' && (
        <>
          <section className="card">
            <h2>Yeni tablo oluştur</h2>
            <div className="grid">
              <label>Tablo adı<input value={tableName} onChange={(event) => setTableName(event.target.value)} /></label>
              <label>Başlangıç hisse miktarı<input inputMode="numeric" value={formatIntegerValue(initialAmount)} onChange={(event) => setInitialAmount(event.target.value.replace(/\D/g, ''))} /></label>
              <label>Birim fiyatı<input inputMode="decimal" value={formatDecimalValue(price)} onChange={(event) => setPrice(sanitizeDecimalInput(event.target.value))} /></label>
            </div>
            <button onClick={saveTable}>Tabloyu kaydet</button>
          </section>
          <section className="card">
            <h2>Oluşturulan tablo</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Y / X</th>{xValues.map((label) => <th key={label}>{label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={yPercentages[rowIndex]}>
                      <td>{yPercentages[rowIndex]}%</td>
                      {row.map((value, colIndex) => <td key={`${rowIndex}-${colIndex}`}>{formatIntegerValue(value)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'saved' && (
        <section className="card">
          <h2>Tablolarım</h2>
          {savedTables.length === 0 ? <p>Henüz kaydedilmiş tablo yok.</p> : (
            <div className="saved-list">
              {savedTables.map((table) => (
                <div className={selectedTable?.id === table.id ? 'saved-item selected' : 'saved-item'} key={table.id}>
                  <button className="saved-main" onClick={() => setSelectedTableId(table.id)}>
                    <strong>{table.name}</strong>
                    <span>Başlangıç: {formatIntegerValue(table.initialAmount)}</span>
                    <span>Fiyat: {parseDecimalValue(table.price) ? formatDecimalValue(table.price) : 'Ayarlanmadı'}</span>
                  </button>
                  <button className="danger" onClick={() => deleteTable(table.id)}>Sil</button>
                </div>
              ))}
            </div>
          )}
          {selectedTable && (
            <>
              <div className="editor-row">
                <label>Birim fiyatı<input inputMode="decimal" value={formatDecimalValue(selectedTable.price || '')} onChange={(event) => updateTablePrice(selectedTable.id, event.target.value)} /></label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Y / X</th>{xValues.map((label) => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {selectedTable.rows.map((row, rowIndex) => {
                      const selectedPrice = parseDecimalValue(selectedTable.price);
                      const multipliedRow = selectedPrice ? row.map((value) => Number((value * selectedPrice).toFixed(2))) : row;
                      return (
                        <tr key={yPercentages[rowIndex]}>
                          <td>{yPercentages[rowIndex]}%</td>
                          {multipliedRow.map((value, colIndex) => <td key={`${rowIndex}-${colIndex}`}>{formatIntegerValue(value)}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'profit' && (
        <>
          <section className="card">
            <h2>Yeni kâr büyüme tablosu oluştur</h2>
            <div className="grid">
              <label>Kâr tablosu adı<input value={profitName} onChange={(event) => setProfitName(event.target.value)} /></label>
              <label>Başlangıç fiyatı<input inputMode="decimal" value={formatDecimalValue(profitPrice)} onChange={(event) => setProfitPrice(sanitizeDecimalInput(event.target.value))} /></label>
              <label>Toplam lot<input inputMode="numeric" value={formatIntegerValue(profitLots)} onChange={(event) => setProfitLots(event.target.value.replace(/\D/g, ''))} /></label>
            </div>
            <button onClick={saveProfitTable}>Kâr tablosunu kaydet</button>
          </section>
          <section className="card">
            <h2>Tahmini büyüme</h2>
            <p className="profit-summary"><strong>Başlangıç tutarı:</strong> {formatNumber(parseIntegerValue(profitLots) * parseDecimalValue(profitPrice))}</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Dönem</th><th>Tahmini değer</th><th>Günlük kazanç</th><th>Toplam kâr</th></tr></thead>
                <tbody>
                  {buildProfitDetails(profitPreviewValues).map((row) => (
                    <tr key={row.label}><td>{row.label}</td><td>{formatNumber(row.value)}</td><td>{row.change === 0 ? '-' : `+${formatNumber(row.change)}`}</td><td>{row.totalProfit === 0 ? '-' : `+${formatNumber(row.totalProfit)}`}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'savedProfit' && (
        <section className="card">
          <h2>Kar Tablolarım</h2>
          {savedProfitTables.length === 0 ? <p>Henüz kaydedilmiş kâr tablosu yok.</p> : (
            <div className="saved-list">
              {savedProfitTables.map((table) => (
                <div className={selectedProfitTable?.id === table.id ? 'saved-item selected' : 'saved-item'} key={table.id}>
                  <button className="saved-main" onClick={() => setSelectedProfitId(table.id)}>
                    <strong>{table.name}</strong>
                    <span>Fiyat: {formatDecimalValue(table.initialPrice)}</span>
                    <span>Lot: {formatIntegerValue(table.lots)}</span>
                  </button>
                  <button className="danger" onClick={() => deleteProfitTable(table.id)}>Sil</button>
                </div>
              ))}
            </div>
          )}
          {selectedProfitTable && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Dönem</th><th>Tahmini değer</th><th>Günlük kazanç</th><th>Toplam kâr</th></tr></thead>
                <tbody>
                  {buildProfitDetails(selectedProfitTable.values).map((row) => (
                    <tr key={`${selectedProfitTable.id}-${row.label}`}><td>{row.label}</td><td>{formatNumber(row.value)}</td><td>{row.change === 0 ? '-' : `+${formatNumber(row.change)}`}</td><td>{row.totalProfit === 0 ? '-' : `+${formatNumber(row.totalProfit)}`}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
};
