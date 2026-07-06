import { forwardRef } from 'react';

import { formatDate } from '../services/tableUtils';
import type { SharedTable } from '../types/sharedTable';

type ShareableTableCardProps = {
  table: SharedTable;
};

export const ShareableTableCard = forwardRef<HTMLDivElement, ShareableTableCardProps>(({ table }, ref) => {
  const summaryCards = table.summaryCards.map((card) => {
    if (card.id !== 'profit') {
      return card;
    }

    return {
      ...card,
      label: 'Son tahmini değer',
      value: table.rows[table.rows.length - 1]?.cells.value ?? card.value
    };
  });

  return (
    <div className="share-card" ref={ref}>
      <div className="share-card__shine" />
      <div className="share-card__header">
        <span>Halka Arz Tabloları</span>
        <strong>{formatDate(table.updatedAt)}</strong>
      </div>
      <h3>{table.title}</h3>
      {table.subtitle && <p>{table.subtitle}</p>}

      <div className="share-card__summary">
        {summaryCards.map((card) => (
          <div className={`share-card__summary-item ${card.tone}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <table className="share-card__table">
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
  );
});

ShareableTableCard.displayName = 'ShareableTableCard';
