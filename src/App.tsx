import { useEffect, useMemo, useRef, useState } from 'react';

import { PublicTables } from './components/PublicTables';
import { ShareableTableCard } from './components/ShareableTableCard';
import { useShareTableImage } from './hooks/useShareTableImage';
import { fetchPublishedTables, saveSharedTable, verifyAdminSecret } from './services/tablesApi';
import type { SharedTable } from './types/sharedTable';

type TabName = 'published' | 'favorites' | 'builder' | 'saved' | 'profit' | 'savedProfit' | 'admin';

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

const isThisPcAdmin = () => {
  const host = window.location.hostname;
  return (host === 'localhost' || host === '127.0.0.1') && window.location.port === '5173';
};

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
        label: 'BaÅŸlangÄ±Ã§',
        value,
        change: 0,
        totalProfit: 0
      };
    }

    const previousValue = values[index - 1];
    const change = Math.ceil(value - previousValue);
    const totalProfit = Math.ceil(value - startValue);

    return {
      label: `GÃ¼n ${index}`,
      value,
      change,
      totalProfit
    };
  });
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(value));
};

const savedTableToShareable = (table: SavedTable): SharedTable => {
  const selectedPrice = parseDecimalValue(table.price);
  return {
    id: String(table.id),
    title: table.name,
    subtitle: selectedPrice ? `Birim fiyat: ${formatDecimalValue(table.price)}` : 'Hisse tablosu',
    updatedAt: new Date().toISOString(),
    published: true,
    summaryCards: [
      { id: 'initial', label: 'BaÅŸlangÄ±Ã§', value: formatIntegerValue(table.initialAmount), tone: 'neutral' },
      { id: 'price', label: 'Birim fiyat', value: selectedPrice ? formatDecimalValue(table.price) : 'AyarlanmadÄ±', tone: 'positive' }
    ],
    columns: [{ id: 'percent', label: 'Y / X' }, ...xValues.map((value) => ({ id: value, label: value, highlight: value === '1M' }))],
    rows: table.rows.map((row, rowIndex) => ({
      id: `${table.id}-${rowIndex}`,
      highlighted: yPercentages[rowIndex] === 100,
      cells: {
        percent: `${yPercentages[rowIndex]}%`,
        ...Object.fromEntries(
          row.map((value, colIndex) => [
            xValues[colIndex],
            formatIntegerValue(selectedPrice ? Number((value * selectedPrice).toFixed(2)) : value)
          ])
        )
      }
    }))
  };
};

const profitTableToShareable = (table: SavedProfitTable): SharedTable => ({
  id: String(table.id),
  title: table.name,
  subtitle: `${formatIntegerValue(table.lots)} lot Ã— ${formatDecimalValue(table.initialPrice)}`,
  updatedAt: new Date().toISOString(),
  published: true,
  summaryCards: [
    { id: 'start', label: 'BaÅŸlangÄ±Ã§', value: formatNumber(table.initialPrice * table.lots), tone: 'neutral' },
    { id: 'profit', label: 'Toplam kÃ¢r', value: formatNumber(Math.max(...table.values) - table.values[0]), tone: 'positive' }
  ],
  columns: [
    { id: 'period', label: 'DÃ¶nem' },
    { id: 'value', label: 'Tahmini deÄŸer', highlight: true },
    { id: 'gain', label: 'GÃ¼nlÃ¼k kazanÃ§' },
    { id: 'total', label: 'Toplam kÃ¢r', highlight: true }
  ],
  rows: buildProfitDetails(table.values).map((row) => ({
    id: `${table.id}-${row.label}`,
    highlighted: row.totalProfit > 0,
    cells: {
      period: row.label,
      value: formatNumber(row.value),
      gain: row.change === 0 ? '-' : `+${formatNumber(row.change)}`,
      total: row.totalProfit === 0 ? '-' : `+${formatNumber(row.totalProfit)}`
    }
  }))
});

type ShareActionsProps = {
  table: SharedTable;
};

const ShareActions = ({ table }: ShareActionsProps) => {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { downloadImage, isSharing, shareError, shareImage, shareStatus } = useShareTableImage(shareCardRef, table);

  return (
    <>
      <div className="action-row">
        <button onClick={shareImage} disabled={isSharing}>{isSharing ? 'HazÄ±rlanÄ±yor...' : 'PaylaÅŸ'}</button>
        <button className="secondary" onClick={downloadImage} disabled={isSharing}>PNG indir</button>
      </div>
      {shareStatus && <p className="success-text">{shareStatus}</p>}
      {shareError && <p className="error-text">{shareError}</p>}
      <div className="share-render-area" aria-hidden="true">
        <ShareableTableCard ref={shareCardRef} table={table} />
      </div>
    </>
  );
};

const App = () => {
  const canUseAdminOnThisPc = isThisPcAdmin();
  const [activeTab, setActiveTab] = useState<TabName>('published');
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
  const [publishedTables, setPublishedTables] = useState<SharedTable[]>([]);
  const [publishedError, setPublishedError] = useState('');
  const [isPublishedLoading, setIsPublishedLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('favoriteTableIds');
    return stored ? JSON.parse(stored) : [];
  });
  const [adminError, setAdminError] = useState('');
  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('pcAdminSecret') ?? '';
  });
  const [adminSecretInput, setAdminSecretInput] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

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

  const saveTable = async () => {
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

    if (canUseAdminOnThisPc && adminSecret) {
      setIsPublishing(true);
      setAdminError('');

      try {
        await saveSharedTable(savedTableToShareable(newTable), adminSecret);
        await loadPublishedTables();
      } catch (error) {
        setAdminError(error instanceof Error ? error.message : 'Tablo yayÄ±nlanamadÄ±.');
      } finally {
        setIsPublishing(false);
      }
    }
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
    const cleanedName = profitName.trim() || `KÃ¢r ${savedProfitTables.length + 1}`;
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

  const loadPublishedTables = async () => {
    setIsPublishedLoading(true);
    setPublishedError('');

    try {
      setPublishedTables(await fetchPublishedTables());
    } catch (error) {
      setPublishedError(error instanceof Error ? error.message : 'YayÄ±nlanan tablolar alÄ±namadÄ±.');
    } finally {
      setIsPublishedLoading(false);
    }
  };

  const handleAdminSecretSubmit = async () => {
    if (!canUseAdminOnThisPc || !adminSecretInput.trim()) return;
    setIsAdminLoading(true);
    setAdminError('');

    try {
      const nextSecret = adminSecretInput.trim();
      await verifyAdminSecret(nextSecret);
      setAdminSecret(nextSecret);
      window.localStorage.setItem('pcAdminSecret', nextSecret);
      setAdminSecretInput('');
      setActiveTab('builder');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Admin ÅŸifresi doÄŸrulanamadÄ±.');
    } finally {
      setIsAdminLoading(false);
    }
  };

  const deactivateAdmin = () => {
    setAdminSecret('');
    setAdminSecretInput('');
    setActiveTab('published');
    window.localStorage.removeItem('pcAdminSecret');
  };

  const toggleFavorite = (tableId: string) => {
    const nextFavoriteIds = favoriteIds.includes(tableId)
      ? favoriteIds.filter((id) => id !== tableId)
      : [...favoriteIds, tableId];

    setFavoriteIds(nextFavoriteIds);
    window.localStorage.setItem('favoriteTableIds', JSON.stringify(nextFavoriteIds));
  };
  useEffect(() => {
    void loadPublishedTables();
  }, []);

  useEffect(() => {
    if (activeTab === 'published') {
      void loadPublishedTables();
    }
  }, [activeTab]);

  return (
    <div className="app-shell">
      <header>
        <div className="header-row">
          <div>
            <h1>Hisse Tablosu PlanlayÄ±cÄ±</h1>
            <p>BaÅŸlangÄ±Ã§ hisse miktarÄ±nÄ± girin, tabloyu oluÅŸturun, kaydedin ve paylaÅŸÄ±n.</p>
          </div>
          {canInstall && (
            <button onClick={handleInstallClick}>UygulamayÄ± yÃ¼kle</button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="Uygulama bölümleri">
        <button className={activeTab === 'published' ? 'tab active' : 'tab'} onClick={() => setActiveTab('published')}>
          Yayın
        </button>
        <button className={activeTab === 'favorites' ? 'tab active' : 'tab'} onClick={() => setActiveTab('favorites')}>
          Favoriler
        </button>
        {canUseAdminOnThisPc && adminSecret && (
          <>
            <button className={activeTab === 'builder' ? 'tab active' : 'tab'} onClick={() => setActiveTab('builder')}>
              Tablo Oluştur
            </button>
            <button className={activeTab === 'saved' ? 'tab active' : 'tab'} onClick={() => setActiveTab('saved')}>
              Tablolarım
            </button>
          </>
        )}
        {canUseAdminOnThisPc && (
          <button className={activeTab === 'admin' ? 'tab active' : 'tab'} onClick={() => setActiveTab('admin')}>
            Yönetim
          </button>
        )}
      </nav>
      {activeTab === 'published' && (
        <PublicTables
          error={publishedError}
          isLoading={isPublishedLoading}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onRefresh={loadPublishedTables}
          tables={publishedTables}
        />
      )}

      {activeTab === 'favorites' && (
        <PublicTables
          error={publishedError}
          isLoading={isPublishedLoading}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onRefresh={loadPublishedTables}
          tables={publishedTables.filter((table) => favoriteIds.includes(table.id))}
        />
      )}

      {activeTab === 'builder' && canUseAdminOnThisPc && adminSecret && (
        <>
          <section className="card">
            <h2>Yeni tablo oluÅŸtur</h2>
            <div className="grid">
              <label>
                Tablo adÄ±
                <input value={tableName} onChange={(e) => setTableName(e.target.value)} />
              </label>
              <label>
                BaÅŸlangÄ±Ã§ hisse miktarÄ±
                <input type="text" inputMode="numeric" value={formatIntegerValue(initialAmount)} onChange={(e) => setInitialAmount(e.target.value.replace(/\D/g, ''))} />
              </label>
              <label>
                Birim fiyatÄ±
                <input type="text" inputMode="decimal" value={formatDecimalValue(price)} onChange={(e) => setPrice(sanitizeDecimalInput(e.target.value))} placeholder="Ä°steÄŸe baÄŸlÄ±" />
              </label>
            </div>
            <button onClick={saveTable} disabled={isPublishing}>{isPublishing ? 'Yayınlanıyor...' : 'Tabloyu yayınla'}</button>
            {adminError && <p className="error-text">{adminError}</p>}
          </section>

          <section className="card">
            <h2>OluÅŸturulan tablo</h2>
            <p className="hint">Y ekseni deÄŸerleri: %40'tan %100'e 5 puan aralÄ±klarla. X ekseni deÄŸerleri: 500k'den 1M'e 50k adÄ±mlarla.</p>
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

      {activeTab === 'saved' && canUseAdminOnThisPc && adminSecret && (
        <>
          <section className="card">
            <h2>TablolarÄ±m</h2>
            {savedTables.length === 0 ? (
              <p>HenÃ¼z kaydedilmiÅŸ tablo yok. Ã–nce Tablo OluÅŸtur sekmesinden bir tane kaydedin.</p>
            ) : (
              <div className="saved-list">
                {savedTables.map((table) => (
                  <div key={table.id} className={selectedTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedTableId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>BaÅŸlangÄ±Ã§: {formatIntegerValue(table.initialAmount)}</span>
                      <span>Fiyat: {parseDecimalValue(table.price) ? formatDecimalValue(table.price) : 'AyarlanmadÄ±'}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingTable(table)}>DÃ¼zenle</button>
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
                  Birim fiyatÄ±
                  <input type="text" inputMode="decimal" value={formatDecimalValue(selectedTable.price || '')} onChange={(e) => updateTablePrice(selectedTable.id, e.target.value)} />
                </label>
                <label>
                  Ad
                  <input value={editingTableId === selectedTable.id ? editName : selectedTable.name} onChange={(e) => setEditName(e.target.value)} />
                </label>
                <label>
                  BaÅŸlangÄ±Ã§ miktarÄ±
                  <input type="text" inputMode="numeric" value={editingTableId === selectedTable.id ? formatIntegerValue(editAmount) : formatIntegerValue(selectedTable.initialAmount)} onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ''))} />
                </label>
              </div>
              <div className="action-row">
                {editingTableId === selectedTable.id ? (
                  <button onClick={() => saveEditedTable(selectedTable.id)}>DeÄŸiÅŸiklikleri kaydet</button>
                ) : (
                  <button onClick={() => startEditingTable(selectedTable)}>DetaylarÄ± dÃ¼zenle</button>
                )}
                <button className="danger" onClick={() => deleteTable(selectedTable.id)}>Tabloyu sil</button>
              </div>
              <ShareActions table={savedTableToShareable(selectedTable)} />
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
            <h2>Yeni kÃ¢r bÃ¼yÃ¼me tablosu oluÅŸtur</h2>
            <p className="hint">BaÅŸlangÄ±Ã§ tutarÄ± lot Ã— baÅŸlangÄ±Ã§ fiyatÄ± olarak hesaplanÄ±r. Sonraki her gÃ¼n %10 kÃ¼mÃ¼latif olarak bÃ¼yÃ¼r.</p>
            <div className="grid">
              <label>
                KÃ¢r tablosu adÄ±
                <input value={profitName} onChange={(e) => setProfitName(e.target.value)} />
              </label>
              <label>
                BaÅŸlangÄ±Ã§ fiyatÄ±
                <input type="text" inputMode="decimal" value={formatDecimalValue(profitPrice)} onChange={(e) => setProfitPrice(sanitizeDecimalInput(e.target.value))} />
              </label>
              <label>
                Toplam lot
                <input type="text" inputMode="numeric" value={formatIntegerValue(profitLots)} onChange={(e) => setProfitLots(e.target.value.replace(/\D/g, ''))} />
              </label>
            </div>
            <button onClick={saveProfitTable}>KÃ¢r tablosunu kaydet</button>
          </section>

          <section className="card">
            <h2>Tahmini bÃ¼yÃ¼me</h2>
            <div className="profit-summary">
              <strong>BaÅŸlangÄ±Ã§ tutarÄ±:</strong> {formatNumber(parseIntegerValue(profitLots) * parseDecimalValue(profitPrice))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>DÃ¶nem</th>
                    <th>Tahmini deÄŸer</th>
                    <th>GÃ¼nlÃ¼k kazanÃ§</th>
                    <th>Toplam kÃ¢r</th>
                  </tr>
                </thead>
                <tbody>
                  {buildProfitDetails(profitPreviewValues).map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{formatNumber(row.value)}</td>
                      <td>{row.change === 0 ? 'â€”' : `+${formatNumber(row.change)}`}</td>
                      <td>{row.totalProfit === 0 ? 'â€”' : `+${formatNumber(row.totalProfit)}`}</td>
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
            <h2>Kar TablolarÄ±m</h2>
            {savedProfitTables.length === 0 ? (
              <p>HenÃ¼z kaydedilmiÅŸ kÃ¢r tablosu yok. Ã–nce KÃ¢r sekmesinden bir tane oluÅŸturun.</p>
            ) : (
              <div className="saved-list">
                {savedProfitTables.map((table) => (
                  <div key={table.id} className={selectedProfitTable?.id === table.id ? 'saved-item selected' : 'saved-item'}>
                    <button className="saved-main" onClick={() => setSelectedProfitId(table.id)}>
                      <strong>{table.name}</strong>
                      <span>Fiyat: {formatDecimalValue(table.initialPrice)}</span>
                      <span>Lot: {formatIntegerValue(table.lots)}</span>
                      <span>BaÅŸlangÄ±Ã§ tutarÄ±: {formatNumber(table.initialPrice * table.lots)}</span>
                    </button>
                    <div className="saved-actions">
                      <button className="secondary" onClick={() => startEditingProfitTable(table)}>DÃ¼zenle</button>
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
                  BaÅŸlangÄ±Ã§ fiyatÄ±
                  <input type="text" inputMode="decimal" value={editingProfitId === selectedProfitTable.id ? formatDecimalValue(editProfitPrice) : formatDecimalValue(selectedProfitTable.initialPrice)} onChange={(e) => setEditProfitPrice(sanitizeDecimalInput(e.target.value))} />
                </label>
                <label>
                  Toplam lot
                  <input type="text" inputMode="numeric" value={editingProfitId === selectedProfitTable.id ? formatIntegerValue(editProfitLots) : formatIntegerValue(selectedProfitTable.lots)} onChange={(e) => setEditProfitLots(e.target.value.replace(/\D/g, ''))} />
                </label>
              </div>
              <div className="action-row">
                {editingProfitId === selectedProfitTable.id ? (
                  <button onClick={() => saveEditedProfitTable(selectedProfitTable.id)}>DeÄŸiÅŸiklikleri kaydet</button>
                ) : (
                  <button onClick={() => startEditingProfitTable(selectedProfitTable)}>DetaylarÄ± dÃ¼zenle</button>
                )}
                <button className="danger" onClick={() => deleteProfitTable(selectedProfitTable.id)}>Tabloyu sil</button>
              </div>
              <ShareActions table={profitTableToShareable(selectedProfitTable)} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>DÃ¶nem</th>
                      <th>Tahmini deÄŸer</th>
                      <th>GÃ¼nlÃ¼k kazanÃ§</th>
                      <th>Toplam kÃ¢r</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildProfitDetails(selectedProfitTable.values).map((row) => (
                      <tr key={`${selectedProfitTable.id}-${row.label}`}>
                        <td>{row.label}</td>
                        <td>{formatNumber(row.value)}</td>
                        <td>{row.change === 0 ? 'â€”' : `+${formatNumber(row.change)}`}</td>
                        <td>{row.totalProfit === 0 ? 'â€”' : `+${formatNumber(row.totalProfit)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'admin' && canUseAdminOnThisPc && !adminSecret && (
        <section className="card empty-state">
          <h2>Admin giriÅŸi</h2>
          <p>Bu bÃ¶lÃ¼m yalnÄ±zca bu PC'de gÃ¶rÃ¼nÃ¼r. VarsayÄ±lan ÅŸifre: local-dev-admin</p>
          <div className="action-row">
            <input
              type="password"
              value={adminSecretInput}
              onChange={(event) => setAdminSecretInput(event.target.value)}
              placeholder="Admin ÅŸifresi"
            />
            <button onClick={handleAdminSecretSubmit} disabled={isAdminLoading || !adminSecretInput.trim()}>
              {isAdminLoading ? 'Kontrol ediliyor...' : 'Admini aÃ§'}
            </button>
          </div>
          {adminError && <p className="error-text">{adminError}</p>}
        </section>
      )}

      {activeTab === 'admin' && canUseAdminOnThisPc && adminSecret && (
        <section className="card empty-state">
          <h2>Admin açık</h2>
          <p>Tablo oluşturmak için alttaki Tablo Oluştur sekmesini kullan. Kaydettiğin tablo otomatik olarak yayınlanır.</p>
          <button className="secondary" onClick={() => setActiveTab('builder')}>Tablo Oluştur</button>
          <button className="danger" onClick={deactivateAdmin}>Admini kapat</button>
          {adminError && <p className="error-text">{adminError}</p>}
        </section>
      )}
    </div>
  );
};

export default App;
