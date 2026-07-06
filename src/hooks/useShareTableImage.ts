import { RefObject, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';

import type { SharedTable } from '../types/sharedTable';

const createFileName = (table: SharedTable) => {
  const normalized = table.title
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ğüşöçıİ-]/gi, '');

  return `${normalized || 'halka-arz-tablosu'}.png`;
};

const waitForRender = async () => {
  await document.fonts?.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const dataUrlToFile = async (dataUrl: string, fileName: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: 'image/png' });
};

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] ?? '';

export const useShareTableImage = (cardRef: RefObject<HTMLElement>, table: SharedTable) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareStatus, setShareStatus] = useState('');

  const createImageDataUrl = async () => {
    if (!cardRef.current) {
      throw new Error('Paylaşım kartı hazırlanamadı.');
    }

    await waitForRender();

    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#020617',
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
      style: {
        transform: 'none'
      }
    });
  };

  const writeNativeFile = async (dataUrl: string, fileName: string) => {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: dataUrlToBase64(dataUrl),
      directory: Directory.Cache,
      recursive: true
    });

    return result.uri;
  };

  const downloadImage = async () => {
    setIsSharing(true);
    setShareError('');
    setShareStatus('');

    try {
      const fileName = createFileName(table);
      const dataUrl = await createImageDataUrl();

      if (Capacitor.isNativePlatform()) {
        const uri = await writeNativeFile(dataUrl, fileName);
        await Share.share({
          title: table.title,
          text: 'PNG hazır. Kaydetmek için paylaşım menüsünden uygun uygulamayı seçebilirsiniz.',
          url: uri,
          dialogTitle: 'PNG indir veya paylaş'
        });
        setShareStatus('PNG hazırlandı.');
        return;
      }

      downloadDataUrl(dataUrl, fileName);
      setShareStatus('PNG indirildi.');
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Görsel indirilemedi.');
    } finally {
      setIsSharing(false);
    }
  };

  const shareImage = async () => {
    setIsSharing(true);
    setShareError('');
    setShareStatus('');

    try {
      const fileName = createFileName(table);
      const dataUrl = await createImageDataUrl();

      if (Capacitor.isNativePlatform()) {
        const uri = await writeNativeFile(dataUrl, fileName);
        await Share.share({
          title: table.title,
          text: table.subtitle || table.title,
          url: uri,
          dialogTitle: 'Tabloyu paylaş'
        });
        setShareStatus('Paylaşım hazırlandı.');
        return;
      }

      const file = await dataUrlToFile(dataUrl, fileName);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: table.title,
          text: table.subtitle || table.title,
          files: [file]
        });
        setShareStatus('Paylaşım hazırlandı.');
        return;
      }

      downloadDataUrl(dataUrl, fileName);
      setShareStatus('Paylaşım desteklenmediği için PNG indirildi.');
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Paylaşım tamamlanamadı.');
    } finally {
      setIsSharing(false);
    }
  };

  return {
    isSharing,
    shareError,
    shareStatus,
    downloadImage,
    shareImage
  };
};
