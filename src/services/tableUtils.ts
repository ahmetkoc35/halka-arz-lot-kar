import type { SharedTableDraft } from '../types/sharedTable';

export const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const formatDate = (value: string) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

export const createEmptyTableDraft = (): SharedTableDraft => {
  const firstColumnId = createId();
  const secondColumnId = createId();

  return {
    title: '',
    subtitle: '',
    published: false,
    summaryCards: [
      { id: createId(), label: 'Toplam Lot', value: '', tone: 'neutral' },
      { id: createId(), label: 'Tahmini Kazanç', value: '', tone: 'positive' }
    ],
    columns: [
      { id: firstColumnId, label: 'Başlık' },
      { id: secondColumnId, label: 'Değer', highlight: true }
    ],
    rows: [
      {
        id: createId(),
        cells: {
          [firstColumnId]: '',
          [secondColumnId]: ''
        },
        highlighted: true
      }
    ]
  };
};
