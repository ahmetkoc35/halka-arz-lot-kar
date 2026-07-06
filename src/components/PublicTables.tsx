import { useRef, useState } from 'react';

import { useShareTableImage } from '../hooks/useShareTableImage';
import { formatDate } from '../services/tableUtils';
import type { SharedTable } from '../types/sharedTable';
import { ShareableTableCard } from './ShareableTableCard';

type PublicTablesProps = {
  tables: SharedTable[];
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
};

type PublicTableItemProps = {
  table: SharedTable;
};

const PublicTableItem = ({ table }: PublicTableItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { downloadImage, isSharing, shareError, shareImage } = useShareTableImage(shareCardRef, table);

  return (
    <article className="published-table">
      <button className="published-table__head" onClick={() => setIsOpen((value) => !value)}>
        <span>
          <strong>{table.title}</strong>
          {table.subtitle && <small>{table.subtitle}</small>}
        </span>
        <em>{formatDate(table.updatedAt)}</em>
      </button>

      <div className="summary-grid">
        {table.summaryCards.map((card) => (
          <div className={`summary-card ${card.tone}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="table-wrap compact">
          <table>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th className={column.highlight ? 'highlight' : ''} key={column.id}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr className={row.highlighted ? 'highlight-row' : ''} key={row.id}>
                  {table.columns.map((column) => (
                    <td className={column.highlight ? 'highlight' : ''} key={column.id}>
                      {row.cells[column.id] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="action-row">
        <button onClick={shareImage} disabled={isSharing}>
          {isSharing ? 'Hazırlanıyor...' : 'Paylaş'}
        </button>
        <button className="secondary" onClick={downloadImage} disabled={isSharing}>
          PNG indir
        </button>
      </div>
      {shareError && <p className="error-text">{shareError}</p>}

      <div className="share-render-area" aria-hidden="true">
        <ShareableTableCard ref={shareCardRef} table={table} />
      </div>
    </article>
  );
};

export const PublicTables = ({ tables, isLoading, error, onRefresh }: PublicTablesProps) => {
  if (isLoading) {
    return (
      <section className="card">
        <p>Yayınlanan tablolar yükleniyor...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card empty-state">
        <h2>Tablolar alınamadı</h2>
        <p>{error}</p>
        <button onClick={onRefresh}>Tekrar dene</button>
      </section>
    );
  }

  if (tables.length === 0) {
    return (
      <section className="card empty-state">
        <h2>Henüz yayınlanmış tablo yok</h2>
        <p>Yayınlanan tablolar burada otomatik olarak görünecek.</p>
      </section>
    );
  }

  return (
    <section className="published-list">
      {tables.map((table) => (
        <PublicTableItem key={table.id} table={table} />
      ))}
    </section>
  );
};
