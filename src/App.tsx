import { useEffect, useMemo, useState } from 'react';

type TabName = 'builder' | 'saved' | 'profit' | 'savedProfit';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

const buildRows = (initialAmount: number) => {
  return yPercentages.map((percent) => {
    const baseValue = (initialAmount * percent) / 100;
    return xAmounts.map((xValue) => Math.ceil(baseValue / xValue));
  });
};

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
  const startValue = values[0];

  return values.map((value, index) => {
    if (index === 0) {
      return {
        label: 'Başlangıç',
        value,
        change: 0,
        totalProfit: 0
      };
    }

    const previousValue = values[index - 1];
    const change = Math.ceil(value - previousValue);
    const totalProfit = Math.ceil(value - startValue);

    return {
      label: `Gün ${index}`,
      value,
      change,
      totalProfit
    };
  });
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(value));
};

const App = () => {
  const [activeTab, setActiveTab] = useState<TabName>('builder');
  const [initialAmount, setInitialAmount] = useState('2000000');
  const [tableName, setTableName] = useState('');
  const [price, setPrice] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [savedTables, setSavedTables] = useState<SavedTable[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('savedTables');
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [profitName, setProfitName] = useState('');
  const [profitPrice, setProfitPrice] = useState('');
  const [profitLots, setProfitLots] = useState('');
  const [editingProfitId, setEditingProfitId] = useState<number | null>(null);
  const [editProfitName, setEditProfitName] = useState('');
  const [editProfitPrice, setEditProfitPrice] = useState('');
  const [editProfitLots, setEditProfitLots] = useState('');
  const [savedProfitTables, setSavedProfitTables] = useState<SavedProfitTable[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('savedProfitTables');
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedProfitId, setSelectedProfitId] = useState<number | null>(null);

  useEffect(() => {
    const beforeInstallPromptHandler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const appInstalledHandler = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const rows = useMemo(() => buildRows(parseIntegerValue(initialAmount)), [initialAmount]);
  const profitPreviewValues = useMemo(() => buildProfitValues(parseIntegerValue(profitLots), parseDecimalValue(profitPrice)), [profitLots, profitPrice]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  const saveTable = () => {
    const cleanedName = tableName.trim() || `Tablo ${savedTables.length + 1}`;
    const newTable: SavedTable = {
      id: Date.now(),
      name: cleanedName,
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

  const startEditingTable = (table: SavedTable) => {
    setEditingTableId(table.id);
    setEditName(table.name);
    setEditAmount(String(table.initialAmount));
  };

  const saveEditedTable = (tableId: number) => {
    const nextTables = savedTables.map((table) => {
      if (table.id !== tableId) return table;
      return {
        ...table,
        name: editName.trim() || table.name,
        initialAmount: parseIntegerValue(editAmount) || table.initialAmount,
        rows: buildRows(parseIntegerValue(editAmount) || table.initialAmount)
      };
    });

    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));
    setEditingTableId(null);
    setEditName('');
    setEditAmount('');
  };

  const deleteTable = (tableId: number) => {
    const nextTables = savedTables.filter((table) => table.id !== tableId);
    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));

    if (selectedTableId === tableId) {
      const nextSelected = nextTables[0] ?? null;
      setSelectedTableId(nextSelected?.id ?? null);
    }

    if (editingTableId === tableId) {
      setEditingTableId(null);
      setEditName('');
      setEditAmount('');
    }
  };

  const selectedTable = savedTables.find((table) => table.id === selectedTableId) ?? savedTables[0] ?? null;

  const saveProfitTable = () => {
    const cleanedName = profitName.trim() || `Kâr ${savedProfitTables.length + 1}`;
    const lotsValue = Number(profitLots) || 0;
    const priceValue = parseDecimalValue(profitPrice);
    const newTable: SavedProfitTable = {
      id: Date.now(),
      name: cleanedName,
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

  const startEditingProfitTable = (table: SavedProfitTable) => {
    setEditingProfitId(table.id);
    setEditProfitName(table.name);
    setEditProfitPrice(String(table.initialPrice));
    setEditProfitLots(String(table.lots));
  };

  const saveEditedProfitTable = (tableId: number) => {
    const priceValue = parseDecimalValue(editProfitPrice);
    const lotsValue = Number(editProfitLots) || 0;
    const nextTables = savedProfitTables.map((table) => {
      if (table.id !== tableId) return table;
      return {
        ...table,
        name: editProfitName.trim() || table.name,
        initialPrice: priceValue,
        lots: lotsValue,
        values: buildProfitValues(lotsValue, priceValue)
      };
    });

    setSavedProfitTables(nextTables);
    window.localStorage.setItem('savedProfitTables', JSON.stringify(nextTables));
    setEditingProfitId(null);
    setEditProfitName('');
    setEditProfitPrice('');
    setEditProfitLots('');
  };

  const deleteProfitTable = (tableId: number) => {
    const nextTables = savedProfitTables.filter((table) => table.id !== tableId);
    setSavedProfitTables(nextTables);
    window.localStorage.setItem('savedProfitTables', JSON.stringify(nextTables));

    if (selectedProfitId === tableId) {
      const nextSelected = nextTables[0] ?? null;
      setSelectedProfitId(nextSelected?.id ?? null);
    }

    if (editingProfitId === tableId) {
      setEditingProfitId(null);
      setEditProfitName('');
      setEditProfitPrice('');
      setEditProfitLots('');
    }
  };

  const selectedProfitTable = savedProfitTables.find((table) => table.id === selectedProfitId) ?? savedProfitTables[0] ?? null;

  return (
    <div className="app-shell">
      <header>
        <div className="header-row">
          <div>
            <h1>Hisse Tablosu Planlayıcı</h1>
            <p>Başlangıç hisse miktarını girin, tabloyu oluşturun, kaydedin ve ardından kaydedilenler sekmesinde birim fiyatı uygulayın.</p>
          </div>
          {canInstall && (
            <button onClick={handleInstallClick}>Uygulamayı yükle</button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="Uygulama bölümleri">
        <button className={activeTab === 'builder' ? 'tab active' : 'tab'} onClick={() => setActiveTab('builder')}>
          Tablo Oluştur
        </button>
        <button className={activeTab === 'saved' ? 'tab active' : 'tab'} onClick={() => setActiveTab('saved')}>
          Tablolarım
        </button>
        <button className={activeTab === 'profit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('profit')}>
          Kâr
        </button>
        <button className={activeTab === 'savedProfit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('savedProfit')}>
          Kar Tablolarım
        </button>
      </nav>

      {activeTab === 'builder' && (
        <>
          <section className="card">
            <h2>Yeni tablo oluştur</h2>
            <div className="grid">
              <label>
                Tablo adı
                <input value={tableName} onChange={(e) => setTableName(e.target.value)} />
              </label>
              <label>
                Başlangıç hisse miktarı
                <input type="text" inputMode="numeric" value={formatIntegerValue(initialAmount)} onChange={(e) => setInitialAmount(e.target.value.replace(/\D/g, ''))} />
              </label>
              <label>
                Birim fiyatı
                <input type="text" inputMode="decimal" value={formatDecimalValue(price)} onChange={(e) => setPrice(sanitizeDecimalInput(e.target.value))} placeholder="İsteğe bağlı" />
              </label>
            </div>
            <button onClick={saveTable}>Tabloyu kaydet</button>
          </section>

          <section className="card">
            <h2>Oluşturulan tablo</h2>
            <p className="hint">Y ekseni değerleri: %40'tan %100'e 5 puan aralıklarla. X ekseni değerleri: 500k'den 1M'e 50k adımlarla. Her hücre başlangıç miktarı × y% ÷ x ekseni değeri olarak hesaplanır.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Y / X</th>
                    {xValues.map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td>{`${yPercentages[rowIndex]}%`}</td>
                      {row.map((value, colIndex) => (
                        <td key={`${rowIndex}-${colIndex}`}>{formatIntegerValue(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'saved' && (
        <>
          <section className="card">
            <h2>Tablolarım</h2>
            {savedTables.length === 0 ? (
              <p>Henüz kaydedilmiş tablo yok. Önce Tablo Oluştur sekmesinden bir tane kaydedin.</p>
            ) : (
              <div className="saved-list">
                {savedTables.map((table) => (
                  <div key={table.id} className={selectedTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedTableId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>Başlangıç: {formatIntegerValue(table.initialAmount)}</span>
                      <span>Fiyat: {parseDecimalValue(table.price) ? formatDecimalValue(table.price) : 'Ayarlanmadı'}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingTable(table)}>Düzenle</button>
                      <button className="danger" onClick={() => deleteTable(table.id)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedTable && (
            <section className="card">
              <h2>{selectedTable.name}</h2>
              <div className="editor-row">
                <label>
                  Birim fiyatı
                  <input type="text" inputMode="decimal" value={formatDecimalValue(selectedTable.price || '')} onChange={(e) => updateTablePrice(selectedTable.id, e.target.value)} />
                </label>
                <label>
                  Ad
                  <input value={editingTableId === selectedTable.id ? editName : selectedTable.name} onChange={(e) => setEditName(e.target.value)} />
                </label>
                <label>
                  Başlangıç miktarı
                  <input type="text" inputMode="numeric" value={editingTableId === selectedTable.id ? formatIntegerValue(editAmount) : formatIntegerValue(selectedTable.initialAmount)} onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ''))} />
                </label>
              </div>
              <div className="action-row">
                {editingTableId === selectedTable.id ? (
                  <button onClick={() => saveEditedTable(selectedTable.id)}>Değişiklikleri kaydet</button>
                ) : (
                  <button onClick={() => startEditingTable(selectedTable)}>Detayları düzenle</button>
                )}
                <button className="danger" onClick={() => deleteTable(selectedTable.id)}>Tabloyu sil</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Y / X</th>
                      {xValues.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTable.rows.map((row, rowIndex) => {
                      const selectedPrice = parseDecimalValue(selectedTable.price);
                      const multipliedRow = selectedPrice
                        ? row.map((value) => Number((value * selectedPrice).toFixed(2)))
                        : row;
                      return (
                        <tr key={rowIndex}>
                          <td>{`${yPercentages[rowIndex]}%`}</td>
                          {multipliedRow.map((value, colIndex) => (
                            <td key={`${rowIndex}-${colIndex}`}>{formatIntegerValue(value)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'profit' && (
        <>
          <section className="card">
            <h2>Yeni kâr büyüme tablosu oluştur</h2>
            <p className="hint">Başlangıç tutarı lot × başlangıç fiyatı olarak hesaplanır. Sonraki her gün %10 kümülatif olarak büyür.</p>
            <div className="grid">
              <label>
                Kâr tablosu adı
                <input value={profitName} onChange={(e) => setProfitName(e.target.value)} />
              </label>
              <label>
                Başlangıç fiyatı
                <input type="text" inputMode="decimal" value={formatDecimalValue(profitPrice)} onChange={(e) => setProfitPrice(sanitizeDecimalInput(e.target.value))} />
              </label>
              <label>
                Toplam lot
                <input type="text" inputMode="numeric" value={formatIntegerValue(profitLots)} onChange={(e) => setProfitLots(e.target.value.replace(/\D/g, ''))} />
              </label>
            </div>
            <button onClick={saveProfitTable}>Kâr tablosunu kaydet</button>
          </section>

          <section className="card">
            <h2>Tahmini büyüme</h2>
            <div className="profit-summary">
              <strong>Başlangıç tutarı:</strong> {formatNumber(parseIntegerValue(profitLots) * parseDecimalValue(profitPrice))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dönem</th>
                    <th>Tahmini değer</th>
                    <th>Günlük kazanç</th>
                    <th>Toplam kâr</th>
                  </tr>
                </thead>
                <tbody>
                  {buildProfitDetails(profitPreviewValues).map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{formatNumber(row.value)}</td>
                      <td>{row.change === 0 ? '—' : `+${formatNumber(row.change)}`}</td>
                      <td>{row.totalProfit === 0 ? '—' : `+${formatNumber(row.totalProfit)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'savedProfit' && (
        <>
          <section className="card">
            <h2>Kar Tablolarım</h2>
            {savedProfitTables.length === 0 ? (
              <p>Henüz kaydedilmiş kâr tablosu yok. Önce Kâr sekmesinden bir tane oluşturun.</p>
            ) : (
              <div className="saved-list">
                {savedProfitTables.map((table) => (
                  <div key={table.id} className={selectedProfitTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedProfitId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>Fiyat: {formatDecimalValue(table.initialPrice)}</span>
                      <span>Lot: {formatIntegerValue(table.lots)}</span>
                      <span>Başlangıç tutarı: {formatNumber(table.initialPrice * table.lots)}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingProfitTable(table)}>Düzenle</button>
                      <button className="danger" onClick={() => deleteProfitTable(table.id)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedProfitTable && (
            <section className="card">
              <h2>{selectedProfitTable.name}</h2>
              <div className="editor-row">
                <label>
                  Ad
                  <input value={editingProfitId === selectedProfitTable.id ? editProfitName : selectedProfitTable.name} onChange={(e) => setEditProfitName(e.target.value)} />
                </label>
                <label>
                  Başlangıç fiyatı
                  <input type="text" inputMode="decimal" value={editingProfitId === selectedProfitTable.id ? formatDecimalValue(editProfitPrice) : formatDecimalValue(selectedProfitTable.initialPrice)} onChange={(e) => setEditProfitPrice(sanitizeDecimalInput(e.target.value))} />
                </label>
                <label>
                  Toplam lot
                  <input type="text" inputMode="numeric" value={editingProfitId === selectedProfitTable.id ? formatIntegerValue(editProfitLots) : formatIntegerValue(selectedProfitTable.lots)} onChange={(e) => setEditProfitLots(e.target.value.replace(/\D/g, ''))} />
                </label>
              </div>
              <div className="action-row">
                {editingProfitId === selectedProfitTable.id ? (
                  <button onClick={() => saveEditedProfitTable(selectedProfitTable.id)}>Değişiklikleri kaydet</button>
                ) : (
                  <button onClick={() => startEditingProfitTable(selectedProfitTable)}>Detayları düzenle</button>
                )}
                <button className="danger" onClick={() => deleteProfitTable(selectedProfitTable.id)}>Tabloyu sil</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dönem</th>
                      <th>Tahmini değer</th>
                      <th>Günlük kazanç</th>
                      <th>Toplam kâr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildProfitDetails(selectedProfitTable.values).map((row) => (
                      <tr key={`${selectedProfitTable.id}-${row.label}`}>
                        <td>{row.label}</td>
                        <td>{formatNumber(row.value)}</td>
                        <td>{row.change === 0 ? '—' : `+${formatNumber(row.change)}`}</td>
                        <td>{row.totalProfit === 0 ? '—' : `+${formatNumber(row.totalProfit)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default App;
