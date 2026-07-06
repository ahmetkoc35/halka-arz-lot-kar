import { RefObject, useState } from 'react';
import { toBlob } from 'html-to-image';

import type { SharedTable } from '../types/sharedTable';

const createFileName = (table: SharedTable) => {
  const normalized = table.title
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ğüşöçıİ-]/gi, '');

  return `${normalized || 'halka-arz-tablosu'}.png`;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const useShareTableImage = (cardRef: RefObject<HTMLElement>, table: SharedTable) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  const createImageBlob = async () => {
    if (!cardRef.current) {
      throw new Error('Paylaşım kartı hazırlanamadı.');
    }

    const blob = await toBlob(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: '#020617'
    });

    if (!blob) {
      throw new Error('Görsel üretilemedi.');
    }

    return blob;
  };

  const downloadImage = async () => {
    setIsSharing(true);
    setShareError('');

    try {
      const blob = await createImageBlob();
      downloadBlob(blob, createFileName(table));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Görsel indirilemedi.');
    } finally {
      setIsSharing(false);
    }
  };

  const shareImage = async () => {
    setIsSharing(true);
    setShareError('');

    try {
      const blob = await createImageBlob();
      const file = new File([blob], createFileName(table), { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: table.title,
          text: table.subtitle || table.title,
          files: [file]
        });
        return;
      }

      downloadBlob(blob, createFileName(table));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Paylaşım tamamlanamadı.');
    } finally {
      setIsSharing(false);
    }
  };

  return {
    isSharing,
    shareError,
    downloadImage,
    shareImage
  };
};
