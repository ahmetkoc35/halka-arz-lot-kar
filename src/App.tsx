import { useEffect, useMemo, useState } from 'react';

import { PublicTables } from './components/PublicTables';
import { deleteSharedTable, fetchPublishedTables, saveSharedTable, verifyAdminSecret } from './services/tablesApi';
import type { SharedTable } from './types/sharedTable';

type TabName = 'published' | 'favorites' | 'profit' | 'myTables' | 'builder' | 'manage' | 'admin';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type StockDraft = {
  id: number;
  name: string;
  initialAmount: number;
  rows: number[][];
  price: number | string;
};

type ProfitDraft = {
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

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(value));
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
  const startValue = values[0] ?? 0;

  return values.map((value, index) => {
    if (index === 0) {
      return {
        label: 'Başlangıç',
        value,
        change: 0,
        totalProfit: 0
      };
    }

    const previousValue = values[index - 1] ?? 0;
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

const stockDraftToShareable = (table: StockDraft): SharedTable => {
  const selectedPrice = parseDecimalValue(table.price);

  return {
    id: String(table.id),
    title: table.name,
    subtitle: selectedPrice ? `Birim fiyat: ${formatDecimalValue(table.price)}` : 'Hisse tablosu',
    updatedAt: new Date().toISOString(),
    published: true,
    summaryCards: [
      { id: 'initial', label: 'Başlangıç', value: formatIntegerValue(table.initialAmount), tone: 'neutral' },
      { id: 'price', label: 'Birim fiyat', value: selectedPrice ? formatDecimalValue(table.price) : 'Ayarlanmadı', tone: 'positive' }
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

const profitDraftToShareable = (table: ProfitDraft): SharedTable => {
  const lastValue = table.values[table.values.length - 1] ?? 0;
  const lastPrice = table.lots ? lastValue / table.lots : 0;

  return {
    id: String(table.id),
    title: table.name,
    subtitle: `${formatIntegerValue(table.lots)} lot × ${formatDecimalValue(table.initialPrice)}`,
    updatedAt: new Date().toISOString(),
    published: true,
    summaryCards: [
      { id: 'start', label: 'Başlangıç', value: formatNumber(table.initialPrice * table.lots), tone: 'neutral' },
      { id: 'last-price', label: 'Son fiyat', value: formatDecimalValue(lastPrice), tone: 'positive' }
    ],
    columns: [
      { id: 'period', label: 'Dönem' },
      { id: 'value', label: 'Tahmini değer', highlight: true },
      { id: 'gain', label: 'Günlük kazanç' },
      { id: 'total', label: 'Toplam kâr', highlight: true }
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
  };
};

const App = () => {
  const canUseAdminOnThisPc = isThisPcAdmin();
  const [activeTab, setActiveTab] = useState<TabName>('published');
  const [initialAmount, setInitialAmount] = useState('2000000');
  const [tableName, setTableName] = useState('');
  const [price, setPrice] = useState('');
  const [profitName, setProfitName] = useState('');
  const [profitPrice, setProfitPrice] = useState('');
  const [profitLots, setProfitLots] = useState('');
  const [localProfitTables, setLocalProfitTables] = useState<ProfitDraft[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('localProfitTables');
    return stored ? JSON.parse(stored) : [];
  });
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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  const rows = useMemo(() => buildRows(parseIntegerValue(initialAmount)), [initialAmount]);
  const profitPreviewValues = useMemo(
    () => buildProfitValues(parseIntegerValue(profitLots), parseDecimalValue(profitPrice)),
    [profitLots, profitPrice]
  );
  const visibleFavoriteTables = publishedTables.filter((table) => favoriteIds.includes(table.id));
  const localProfitShareables = localProfitTables.map(profitDraftToShareable);

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

  const loadPublishedTables = async () => {
    setIsPublishedLoading(true);
    setPublishedError('');

    try {
      setPublishedTables(await fetchPublishedTables());
    } catch (error) {
      setPublishedError(error instanceof Error ? error.message : 'Yayınlanan tablolar alınamadı.');
    } finally {
      setIsPublishedLoading(false);
    }
  };

  useEffect(() => {
    void loadPublishedTables();
  }, []);

  useEffect(() => {
    if (activeTab === 'published' || activeTab === 'favorites' || activeTab === 'manage') {
      void loadPublishedTables();
    }
  }, [activeTab]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
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
      setAdminError(error instanceof Error ? error.message : 'Admin şifresi doğrulanamadı.');
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

  const publishTable = async (table: SharedTable) => {
    if (!canUseAdminOnThisPc || !adminSecret) return;
    setIsPublishing(true);
    setAdminError('');

    try {
      await saveSharedTable(table, adminSecret);
      await loadPublishedTables();
      setActiveTab('manage');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Tablo yayınlanamadı.');
    } finally {
      setIsPublishing(false);
    }
  };

  const publishStockTable = async () => {
    const stockDraft: StockDraft = {
      id: Date.now(),
      name: tableName.trim() || `Tablo ${publishedTables.length + 1}`,
      initialAmount: parseIntegerValue(initialAmount),
      rows,
      price: sanitizeDecimalInput(price)
    };

    await publishTable(stockDraftToShareable(stockDraft));
  };

  const publishProfitTable = async () => {
    const lotsValue = parseIntegerValue(profitLots);
    const priceValue = parseDecimalValue(profitPrice);
    const profitDraft: ProfitDraft = {
      id: Date.now(),
      name: profitName.trim() || `Kâr ${publishedTables.length + 1}`,
      initialPrice: priceValue,
      lots: lotsValue,
      values: buildProfitValues(lotsValue, priceValue)
    };

    await publishTable(profitDraftToShareable(profitDraft));
  };

  const saveLocalProfitTable = () => {
    const lotsValue = parseIntegerValue(profitLots);
    const priceValue = parseDecimalValue(profitPrice);
    const profitDraft: ProfitDraft = {
      id: Date.now(),
      name: profitName.trim() || `Kâr ${localProfitTables.length + 1}`,
      initialPrice: priceValue,
      lots: lotsValue,
      values: buildProfitValues(lotsValue, priceValue)
    };
    const nextTables = [profitDraft, ...localProfitTables];

    setLocalProfitTables(nextTables);
    window.localStorage.setItem('localProfitTables', JSON.stringify(nextTables));
    setActiveTab('myTables');
  };

  const deleteLocalProfitTable = (tableId: number) => {
    const nextTables = localProfitTables.filter((table) => table.id !== tableId);
    setLocalProfitTables(nextTables);
    window.localStorage.setItem('localProfitTables', JSON.stringify(nextTables));
  };

  const deletePublishedTable = async (tableId: string) => {
    if (!canUseAdminOnThisPc || !adminSecret || !window.confirm('Bu yayınlanan tablo silinsin mi?')) return;
    setIsPublishing(true);
    setAdminError('');

    try {
      await deleteSharedTable(tableId, adminSecret);
      setFavoriteIds((currentIds) => {
        const nextIds = currentIds.filter((id) => id !== tableId);
        window.localStorage.setItem('favoriteTableIds', JSON.stringify(nextIds));
        return nextIds;
      });
      await loadPublishedTables();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Tablo silinemedi.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div className="header-row">
          <div>
            <h1>Halka Arz Tabloları</h1>
            <p>Yayınlanan tabloları incele, favorilerine ekle ve paylaş.</p>
          </div>
          {canInstall && (
            <button onClick={handleInstallClick}>Uygulamayı yükle</button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="Uygulama bölümleri">
        <button className={activeTab === 'published' ? 'tab active' : 'tab'} onClick={() => setActiveTab('published')}>
          Yayında
        </button>
        <button className={activeTab === 'favorites' ? 'tab active' : 'tab'} onClick={() => setActiveTab('favorites')}>
          Favorilerim
        </button>
        <button className={activeTab === 'profit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('profit')}>
          Kâr Tablosu Oluştur
        </button>
        <button className={activeTab === 'myTables' ? 'tab active' : 'tab'} onClick={() => setActiveTab('myTables')}>
          Tablolarım
        </button>
        {canUseAdminOnThisPc && adminSecret && (
          <>
            <button className={activeTab === 'builder' ? 'tab active' : 'tab'} onClick={() => setActiveTab('builder')}>
              Tablo
            </button>
            <button className={activeTab === 'manage' ? 'tab active' : 'tab'} onClick={() => setActiveTab('manage')}>
              Yönet
            </button>
          </>
        )}
        {canUseAdminOnThisPc && (
          <button className={activeTab === 'admin' ? 'tab active' : 'tab'} onClick={() => setActiveTab('admin')}>
            Admin
          </button>
        )}
      </nav>

      {activeTab === 'published' && (
        <PublicTables
          error={publishedError}
          favoriteIds={favoriteIds}
          isLoading={isPublishedLoading}
          onRefresh={loadPublishedTables}
          onToggleFavorite={toggleFavorite}
          tables={publishedTables}
        />
      )}

      {activeTab === 'favorites' && (
        <PublicTables
          error={publishedError}
          favoriteIds={favoriteIds}
          isLoading={isPublishedLoading}
          onRefresh={loadPublishedTables}
          onToggleFavorite={toggleFavorite}
          tables={visibleFavoriteTables}
        />
      )}

      {activeTab === 'myTables' && (
        <PublicTables
          deleteLabel="Tabloyu sil"
          emptyMessage="Kâr Tablosu Oluştur sekmesinden kendi tablonu kaydedebilirsin."
          emptyTitle="Henüz kâr tablon yok"
          error=""
          isLoading={false}
          onDeleteTable={(tableId) => deleteLocalProfitTable(Number(tableId))}
          onRefresh={() => undefined}
          tables={localProfitShareables}
        />
      )}

      {activeTab === 'builder' && canUseAdminOnThisPc && adminSecret && (
        <>
          <section className="card">
            <h2>Tablo oluştur</h2>
            <div className="grid">
              <label>
                Tablo adı
                <input value={tableName} onChange={(event) => setTableName(event.target.value)} />
              </label>
              <label>
                Başlangıç hisse miktarı
                <input
                  inputMode="numeric"
                  type="text"
                  value={formatIntegerValue(initialAmount)}
                  onChange={(event) => setInitialAmount(event.target.value.replace(/\D/g, ''))}
                />
              </label>
              <label>
                Birim fiyatı
                <input
                  inputMode="decimal"
                  type="text"
                  value={formatDecimalValue(price)}
                  onChange={(event) => setPrice(sanitizeDecimalInput(event.target.value))}
                />
              </label>
            </div>
            <button onClick={publishStockTable} disabled={isPublishing}>
              {isPublishing ? 'Yayınlanıyor...' : 'Tabloyu yayınla'}
            </button>
            {adminError && <p className="error-text">{adminError}</p>}
          </section>

          <section className="card">
            <h2>Önizleme</h2>
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

      {activeTab === 'profit' && canUseAdminOnThisPc && adminSecret && (
        <>
          <section className="card">
            <h2>Kâr tablosu oluştur</h2>
            <div className="grid">
              <label>
                Kâr tablosu adı
                <input value={profitName} onChange={(event) => setProfitName(event.target.value)} />
              </label>
              <label>
                Başlangıç fiyatı
                <input
                  inputMode="decimal"
                  type="text"
                  value={formatDecimalValue(profitPrice)}
                  onChange={(event) => setProfitPrice(sanitizeDecimalInput(event.target.value))}
                />
              </label>
              <label>
                Toplam lot
                <input
                  inputMode="numeric"
                  type="text"
                  value={formatIntegerValue(profitLots)}
                  onChange={(event) => setProfitLots(event.target.value.replace(/\D/g, ''))}
                />
              </label>
            </div>
            <button onClick={canUseAdminOnThisPc && adminSecret ? publishProfitTable : saveLocalProfitTable} disabled={isPublishing}>
              {isPublishing ? 'Yayınlanıyor...' : canUseAdminOnThisPc && adminSecret ? 'Kâr tablosunu yayınla' : 'Kâr tablosunu kaydet'}
            </button>
            {adminError && <p className="error-text">{adminError}</p>}
          </section>

          <section className="card">
            <h2>Önizleme</h2>
            <p className="profit-summary"><strong>Başlangıç tutarı:</strong> {formatNumber(parseIntegerValue(profitLots) * parseDecimalValue(profitPrice))}</p>
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
                      <td>{row.change === 0 ? '-' : `+${formatNumber(row.change)}`}</td>
                      <td>{row.totalProfit === 0 ? '-' : `+${formatNumber(row.totalProfit)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'manage' && canUseAdminOnThisPc && adminSecret && (
        <section className="card">
          <h2>Yayınlanan tablolar</h2>
          {publishedTables.length === 0 ? (
            <p>Henüz yayınlanan tablo yok.</p>
          ) : (
            <div className="saved-list">
              {publishedTables.map((table) => (
                <div className="saved-item" key={table.id}>
                  <button className="saved-main" onClick={() => setActiveTab('published')}>
                    <strong>{table.title}</strong>
                    {table.subtitle && <span>{table.subtitle}</span>}
                  </button>
                  <div className="saved-actions">
                    <button className="danger" onClick={() => deletePublishedTable(table.id)} disabled={isPublishing}>
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adminError && <p className="error-text">{adminError}</p>}
        </section>
      )}

      {activeTab === 'admin' && canUseAdminOnThisPc && !adminSecret && (
        <section className="card empty-state">
          <h2>Admin girişi</h2>
          <p>Bu bölüm yalnızca bu PC'de görünür. Varsayılan şifre: local-dev-admin</p>
          <div className="action-row">
            <input
              type="password"
              value={adminSecretInput}
              onChange={(event) => setAdminSecretInput(event.target.value)}
              placeholder="Admin şifresi"
            />
            <button onClick={handleAdminSecretSubmit} disabled={isAdminLoading || !adminSecretInput.trim()}>
              {isAdminLoading ? 'Kontrol ediliyor...' : 'Admini aç'}
            </button>
          </div>
          {adminError && <p className="error-text">{adminError}</p>}
        </section>
      )}

      {activeTab === 'admin' && canUseAdminOnThisPc && adminSecret && (
        <section className="card empty-state">
          <h2>Admin açık</h2>
          <p>Tablo ve kâr tablolarını yalnızca bu PC'den oluşturabilirsin. Kaydettiğin tablolar otomatik olarak GitHub'a yayınlanır.</p>
          <button className="secondary" onClick={() => setActiveTab('builder')}>Tablo oluştur</button>
          <button className="secondary" onClick={() => setActiveTab('profit')}>Kâr tablosu oluştur</button>
          <button className="secondary" onClick={() => setActiveTab('manage')}>Yayınlananları yönet</button>
          <button className="danger" onClick={deactivateAdmin}>Admini kapat</button>
          {adminError && <p className="error-text">{adminError}</p>}
        </section>
      )}
    </div>
  );
};

export default App;
