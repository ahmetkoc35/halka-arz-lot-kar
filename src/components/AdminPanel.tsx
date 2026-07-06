import { useEffect, useMemo, useState } from 'react';

import { createEmptyTableDraft, createId } from '../services/tableUtils';
import type { SharedTable, SharedTableDraft, SummaryCard, TableColumn, TableRow } from '../types/sharedTable';

type AdminPanelProps = {
  tables: SharedTable[];
  isLoading: boolean;
  error: string;
  isSaving: boolean;
  onSave: (table: SharedTableDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
  onDeactivate: () => void;
};

const cloneTable = (table: SharedTable): SharedTableDraft => ({
  id: table.id,
  title: table.title,
  subtitle: table.subtitle,
  summaryCards: table.summaryCards,
  columns: table.columns,
  rows: table.rows,
  published: table.published
});

const duplicateTable = (table: SharedTable): SharedTableDraft => ({
  title: `${table.title} Kopya`,
  subtitle: table.subtitle,
  summaryCards: table.summaryCards.map((card) => ({ ...card, id: createId() })),
  columns: table.columns.map((column) => ({ ...column, id: createId() })),
  rows: [],
  published: false
});

const remapDuplicate = (table: SharedTable): SharedTableDraft => {
  const columnPairs = table.columns.map((column) => [column.id, createId()] as const);
  const columnMap = Object.fromEntries(columnPairs);

  return {
    ...duplicateTable(table),
    columns: table.columns.map((column) => ({ ...column, id: columnMap[column.id] })),
    rows: table.rows.map((row) => ({
      id: createId(),
      highlighted: row.highlighted,
      cells: Object.fromEntries(table.columns.map((column) => [columnMap[column.id], row.cells[column.id] ?? '']))
    }))
  };
};

const ensureRowCells = (row: TableRow, columns: TableColumn[]) => ({
  ...row,
  cells: {
    ...Object.fromEntries(columns.map((column) => [column.id, ''])),
    ...row.cells
  }
});

export const AdminPanel = ({ tables, isLoading, error, isSaving, onDelete, onDeactivate, onRefresh, onSave }: AdminPanelProps) => {
  const [draft, setDraft] = useState<SharedTableDraft>(() => createEmptyTableDraft());
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!selectedId) return;
    const selected = tables.find((table) => table.id === selectedId);
    if (selected) setDraft(cloneTable(selected));
  }, [selectedId, tables]);

  const sortedTables = useMemo(
    () => [...tables].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [tables]
  );

  const updateDraft = (nextDraft: Partial<SharedTableDraft>) => {
    setDraft((current) => ({ ...current, ...nextDraft }));
  };

  const updateSummaryCard = (cardId: string, nextCard: Partial<SummaryCard>) => {
    updateDraft({
      summaryCards: draft.summaryCards.map((card) => (card.id === cardId ? { ...card, ...nextCard } : card))
    });
  };

  const updateColumn = (columnId: string, nextColumn: Partial<TableColumn>) => {
    updateDraft({
      columns: draft.columns.map((column) => (column.id === columnId ? { ...column, ...nextColumn } : column))
    });
  };

  const updateRowCell = (rowId: string, columnId: string, value: string) => {
    updateDraft({
      rows: draft.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [columnId]: value
              }
            }
          : row
      )
    });
  };

  const addColumn = () => {
    const column = { id: createId(), label: 'Yeni Kolon' };
    updateDraft({
      columns: [...draft.columns, column],
      rows: draft.rows.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          [column.id]: ''
        }
      }))
    });
  };

  const removeColumn = (columnId: string) => {
    if (draft.columns.length <= 1) return;

    updateDraft({
      columns: draft.columns.filter((column) => column.id !== columnId),
      rows: draft.rows.map((row) => {
        const { [columnId]: _removed, ...cells } = row.cells;
        return { ...row, cells };
      })
    });
  };

  const addRow = () => {
    updateDraft({
      rows: [
        ...draft.rows,
        ensureRowCells(
          {
            id: createId(),
            cells: {},
            highlighted: false
          },
          draft.columns
        )
      ]
    });
  };

  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const nextIndex = rowIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.rows.length) return;
    const nextRows = [...draft.rows];
    [nextRows[rowIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[rowIndex]];
    updateDraft({ rows: nextRows });
  };

  const resetDraft = () => {
    setSelectedId('');
    setDraft(createEmptyTableDraft());
  };

  const submit = async () => {
    await onSave({
      ...draft,
      rows: draft.rows.map((row) => ensureRowCells(row, draft.columns))
    });
    resetDraft();
  };

  return (
    <section className="admin-layout">
      <div className="card admin-toolbar">
        <div>
          <h2>Yönetim</h2>
          <p>Bu bölüm yalnızca admin cihazında görünür.</p>
        </div>
        <div className="action-row">
          <button onClick={resetDraft}>Yeni tablo</button>
          <button className="secondary" onClick={onRefresh}>Yenile</button>
          <button className="danger" onClick={onDeactivate}>Admin çıkışı</button>
        </div>
      </div>

      {error && (
        <div className="card error-panel">
          <p>{error}</p>
        </div>
      )}

      <div className="admin-grid">
        <aside className="card table-picker">
          <h3>Tablolar</h3>
          {isLoading && <p>Yükleniyor...</p>}
          {!isLoading && sortedTables.length === 0 && <p>Henüz tablo yok.</p>}
          {sortedTables.map((table) => (
            <button className={selectedId === table.id ? 'picker-item active' : 'picker-item'} key={table.id} onClick={() => setSelectedId(table.id)}>
              <span>{table.title || 'Adsız tablo'}</span>
              <small>{table.published ? 'Yayında' : 'Taslak'}</small>
            </button>
          ))}
        </aside>

        <div className="card admin-editor">
          <div className="editor-header">
            <h3>{draft.id ? 'Tabloyu düzenle' : 'Yeni tablo'}</h3>
            <label className="inline-toggle">
              <input checked={draft.published} type="checkbox" onChange={(event) => updateDraft({ published: event.target.checked })} />
              Yayında
            </label>
          </div>

          <div className="grid">
            <label>
              Başlık
              <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
            </label>
            <label>
              Alt başlık
              <input value={draft.subtitle} onChange={(event) => updateDraft({ subtitle: event.target.value })} />
            </label>
          </div>

          <div className="editor-block">
            <div className="block-head">
              <h4>Özet kartları</h4>
              <button
                className="secondary"
                onClick={() => updateDraft({ summaryCards: [...draft.summaryCards, { id: createId(), label: '', value: '', tone: 'neutral' }] })}
              >
                Kart ekle
              </button>
            </div>
            {draft.summaryCards.map((card) => (
              <div className="summary-editor" key={card.id}>
                <input placeholder="Etiket" value={card.label} onChange={(event) => updateSummaryCard(card.id, { label: event.target.value })} />
                <input placeholder="Değer" value={card.value} onChange={(event) => updateSummaryCard(card.id, { value: event.target.value })} />
                <select value={card.tone} onChange={(event) => updateSummaryCard(card.id, { tone: event.target.value as SummaryCard['tone'] })}>
                  <option value="neutral">Normal</option>
                  <option value="positive">Pozitif</option>
                  <option value="warning">Uyarı</option>
                </select>
                <button className="danger" onClick={() => updateDraft({ summaryCards: draft.summaryCards.filter((item) => item.id !== card.id) })}>Sil</button>
              </div>
            ))}
          </div>

          <div className="editor-block">
            <div className="block-head">
              <h4>Kolonlar</h4>
              <button className="secondary" onClick={addColumn}>Kolon ekle</button>
            </div>
            <div className="column-editor">
              {draft.columns.map((column) => (
                <div className="column-pill" key={column.id}>
                  <input value={column.label} onChange={(event) => updateColumn(column.id, { label: event.target.value })} />
                  <label className="mini-toggle">
                    <input checked={Boolean(column.highlight)} type="checkbox" onChange={(event) => updateColumn(column.id, { highlight: event.target.checked })} />
                    Vurgu
                  </label>
                  <button className="danger" onClick={() => removeColumn(column.id)}>Sil</button>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-block">
            <div className="block-head">
              <h4>Satırlar</h4>
              <button className="secondary" onClick={addRow}>Satır ekle</button>
            </div>
            {draft.rows.map((row, rowIndex) => (
              <div className="row-editor" key={row.id}>
                <div className="row-editor__cells">
                  {draft.columns.map((column) => (
                    <label key={column.id}>
                      {column.label}
                      <input value={row.cells[column.id] ?? ''} onChange={(event) => updateRowCell(row.id, column.id, event.target.value)} />
                    </label>
                  ))}
                </div>
                <div className="row-editor__actions">
                  <label className="mini-toggle">
                    <input
                      checked={Boolean(row.highlighted)}
                      type="checkbox"
                      onChange={(event) =>
                        updateDraft({
                          rows: draft.rows.map((item) => (item.id === row.id ? { ...item, highlighted: event.target.checked } : item))
                        })
                      }
                    />
                    Vurgu
                  </label>
                  <button className="secondary" onClick={() => moveRow(rowIndex, -1)}>Yukarı</button>
                  <button className="secondary" onClick={() => moveRow(rowIndex, 1)}>Aşağı</button>
                  <button className="danger" onClick={() => updateDraft({ rows: draft.rows.filter((item) => item.id !== row.id) })}>Sil</button>
                </div>
              </div>
            ))}
          </div>

          <div className="action-row sticky-actions">
            <button onClick={submit} disabled={isSaving || !draft.title.trim()}>
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            {draft.id && (
              <>
                <button className="secondary" onClick={() => setDraft(remapDuplicate(draft as SharedTable))}>Kopyala</button>
                <button className="danger" onClick={() => draft.id && onDelete(draft.id)}>Sil</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
