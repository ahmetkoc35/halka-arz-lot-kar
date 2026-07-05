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
  price: number;
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

const buildRows = (initialAmount: number) => {
  return yPercentages.map((percent) => {
    const baseValue = (initialAmount * percent) / 100;
    return xAmounts.map((xValue) => Number((baseValue / xValue).toFixed(2)));
  });
};

const buildProfitValues = (lots: number, initialPrice: number) => {
  const startValue = lots * initialPrice;
  const values = [Number(startValue.toFixed(2))];
  let currentValue = startValue;

  for (let index = 1; index <= 12; index += 1) {
    currentValue = Number((currentValue * 1.1).toFixed(2));
    values.push(currentValue);
  }

  return values;
};

const buildProfitDetails = (values: number[]) => {
  const startValue = values[0];

  return values.map((value, index) => {
    if (index === 0) {
      return {
        label: 'Start',
        value,
        change: 0,
        totalProfit: 0
      };
    }

    const previousValue = values[index - 1];
    const change = Number((value - previousValue).toFixed(2));
    const totalProfit = Number((value - startValue).toFixed(2));

    return {
      label: `Day ${index}`,
      value,
      change,
      totalProfit
    };
  });
};

const formatNumber = (value: number) => {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const App = () => {
  const [activeTab, setActiveTab] = useState<TabName>('builder');
  const [initialAmount, setInitialAmount] = useState('2000000');
  const [tableName, setTableName] = useState('My Stock Table');
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

  const [profitName, setProfitName] = useState('My Profit Table');
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

  const rows = useMemo(() => buildRows(Number(initialAmount) || 0), [initialAmount]);
  const profitPreviewValues = useMemo(() => buildProfitValues(Number(profitLots) || 0, Number(profitPrice) || 0), [profitLots, profitPrice]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  const saveTable = () => {
    const cleanedName = tableName.trim() || `Table ${savedTables.length + 1}`;
    const newTable: SavedTable = {
      id: Date.now(),
      name: cleanedName,
      initialAmount: Number(initialAmount) || 0,
      rows,
      price: Number(price) || 0
    };

    const nextTables = [newTable, ...savedTables];
    setSavedTables(nextTables);
    window.localStorage.setItem('savedTables', JSON.stringify(nextTables));
    setSelectedTableId(newTable.id);
    setActiveTab('saved');
  };

  const updateTablePrice = (tableId: number, nextPrice: string) => {
    const nextTables = savedTables.map((table) => (table.id === tableId ? { ...table, price: Number(nextPrice) || 0 } : table));
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
        initialAmount: Number(editAmount) || table.initialAmount,
        rows: buildRows(Number(editAmount) || table.initialAmount)
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
    const cleanedName = profitName.trim() || `Profit ${savedProfitTables.length + 1}`;
    const lotsValue = Number(profitLots) || 0;
    const priceValue = Number(profitPrice) || 0;
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
    const priceValue = Number(editProfitPrice) || 0;
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
            <h1>Stock Table Planner</h1>
            <p>Enter the initial stock amount, generate the table, save it, and then apply a unit price in the saved tab.</p>
          </div>
          {canInstall && (
            <button onClick={handleInstallClick}>Install app</button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="App sections">
        <button className={activeTab === 'builder' ? 'tab active' : 'tab'} onClick={() => setActiveTab('builder')}>
          Builder
        </button>
        <button className={activeTab === 'saved' ? 'tab active' : 'tab'} onClick={() => setActiveTab('saved')}>
          Saved tables
        </button>
        <button className={activeTab === 'profit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('profit')}>
          Profit
        </button>
        <button className={activeTab === 'savedProfit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('savedProfit')}>
          Saved profits
        </button>
      </nav>

      {activeTab === 'builder' && (
        <>
          <section className="card">
            <h2>Create new table</h2>
            <div className="grid">
              <label>
                Table name
                <input value={tableName} onChange={(e) => setTableName(e.target.value)} />
              </label>
              <label>
                Initial stock amount
                <input type="number" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} />
              </label>
              <label>
                Price per unit
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Optional" />
              </label>
            </div>
            <button onClick={saveTable}>Save table</button>
          </section>

          <section className="card">
            <h2>Generated table</h2>
            <p className="hint">Y-axis values: 40% to 100% in 5% steps. X-axis values: 500k to 1M in 50k steps. Each cell is calculated as initial amount × y% ÷ x-axis value.</p>
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
                        <td key={`${rowIndex}-${colIndex}`}>{value.toLocaleString()}</td>
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
            <h2>Saved tables</h2>
            {savedTables.length === 0 ? (
              <p>No saved tables yet. Save one from the builder tab first.</p>
            ) : (
              <div className="saved-list">
                {savedTables.map((table) => (
                  <div key={table.id} className={selectedTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedTableId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>Initial: {table.initialAmount.toLocaleString()}</span>
                      <span>Price: {table.price || 'Not set'}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingTable(table)}>Edit</button>
                      <button className="danger" onClick={() => deleteTable(table.id)}>Delete</button>
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
                  Unit price
                  <input type="number" value={selectedTable.price || ''} onChange={(e) => updateTablePrice(selectedTable.id, e.target.value)} />
                </label>
                <label>
                  Name
                  <input value={editingTableId === selectedTable.id ? editName : selectedTable.name} onChange={(e) => setEditName(e.target.value)} />
                </label>
                <label>
                  Initial amount
                  <input type="number" value={editingTableId === selectedTable.id ? editAmount : selectedTable.initialAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </label>
              </div>
              <div className="action-row">
                {editingTableId === selectedTable.id ? (
                  <button onClick={() => saveEditedTable(selectedTable.id)}>Save changes</button>
                ) : (
                  <button onClick={() => startEditingTable(selectedTable)}>Edit details</button>
                )}
                <button className="danger" onClick={() => deleteTable(selectedTable.id)}>Delete table</button>
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
                      const multipliedRow = selectedTable.price
                        ? row.map((value) => Number((value * selectedTable.price).toFixed(2)))
                        : row;
                      return (
                        <tr key={rowIndex}>
                          <td>{`${yPercentages[rowIndex]}%`}</td>
                          {multipliedRow.map((value, colIndex) => (
                            <td key={`${rowIndex}-${colIndex}`}>{value.toLocaleString()}</td>
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
            <h2>Create new profit growth table</h2>
            <p className="hint">The starting amount is calculated as lots × initial price. Each following day grows by 10% cumulatively.</p>
            <div className="grid">
              <label>
                Profit table name
                <input value={profitName} onChange={(e) => setProfitName(e.target.value)} />
              </label>
              <label>
                Initial price
                <input type="number" value={profitPrice} onChange={(e) => setProfitPrice(e.target.value)} />
              </label>
              <label>
                Total lots
                <input type="number" value={profitLots} onChange={(e) => setProfitLots(e.target.value)} />
              </label>
            </div>
            <button onClick={saveProfitTable}>Save profit table</button>
          </section>

          <section className="card">
            <h2>Projected growth</h2>
            <div className="profit-summary">
              <strong>Start amount:</strong> {formatNumber((Number(profitLots) || 0) * (Number(profitPrice) || 0))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Projected value</th>
                    <th>Daily gain</th>
                    <th>Total profit</th>
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
            <h2>Saved profit tables</h2>
            {savedProfitTables.length === 0 ? (
              <p>No saved profit tables yet. Create one from the Profit tab first.</p>
            ) : (
              <div className="saved-list">
                {savedProfitTables.map((table) => (
                  <div key={table.id} className={selectedProfitTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedProfitId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>Price: {table.initialPrice}</span>
                      <span>Lots: {table.lots}</span>
                      <span>Start amount: {formatNumber(table.initialPrice * table.lots)}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingProfitTable(table)}>Edit</button>
                      <button className="danger" onClick={() => deleteProfitTable(table.id)}>Delete</button>
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
                  Name
                  <input value={editingProfitId === selectedProfitTable.id ? editProfitName : selectedProfitTable.name} onChange={(e) => setEditProfitName(e.target.value)} />
                </label>
                <label>
                  Initial price
                  <input type="number" value={editingProfitId === selectedProfitTable.id ? editProfitPrice : selectedProfitTable.initialPrice} onChange={(e) => setEditProfitPrice(e.target.value)} />
                </label>
                <label>
                  Total lots
                  <input type="number" value={editingProfitId === selectedProfitTable.id ? editProfitLots : selectedProfitTable.lots} onChange={(e) => setEditProfitLots(e.target.value)} />
                </label>
              </div>
              <div className="action-row">
                {editingProfitId === selectedProfitTable.id ? (
                  <button onClick={() => saveEditedProfitTable(selectedProfitTable.id)}>Save changes</button>
                ) : (
                  <button onClick={() => startEditingProfitTable(selectedProfitTable)}>Edit details</button>
                )}
                <button className="danger" onClick={() => deleteProfitTable(selectedProfitTable.id)}>Delete table</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Projected value</th>
                      <th>Daily gain</th>
                      <th>Total profit</th>
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
