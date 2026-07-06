import { useEffect, useState } from 'react';

import { AdminPanel } from './components/AdminPanel';
import { LocalTools } from './components/LocalTools';
import { PublicTables } from './components/PublicTables';
import { useAdminMode } from './hooks/useAdminMode';
import { deleteSharedTable, fetchAdminTables, fetchPublishedTables, saveSharedTable } from './services/tablesApi';
import type { SharedTable, SharedTableDraft } from './types/sharedTable';

type AppTab = 'published' | 'tools' | 'admin';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const App = () => {
  const { activateAdmin, activationError, adminToken, deactivateAdmin, isAdmin } = useAdminMode();
  const [activeTab, setActiveTab] = useState<AppTab>('published');
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [adminSecretInput, setAdminSecretInput] = useState('');
  const [showAdminActivation, setShowAdminActivation] = useState(false);
  const [publishedTables, setPublishedTables] = useState<SharedTable[]>([]);
  const [adminTables, setAdminTables] = useState<SharedTable[]>([]);
  const [publicError, setPublicError] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isPublicLoading, setIsPublicLoading] = useState(true);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  const loadPublishedTables = async () => {
    setIsPublicLoading(true);
    setPublicError('');

    try {
      setPublishedTables(await fetchPublishedTables());
    } catch (error) {
      setPublicError(error instanceof Error ? error.message : 'Yayınlanan tablolar alınamadı.');
    } finally {
      setIsPublicLoading(false);
    }
  };

  const loadAdminTables = async () => {
    if (!adminToken) return;
    setIsAdminLoading(true);
    setAdminError('');

    try {
      setAdminTables(await fetchAdminTables(adminToken));
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Admin tabloları alınamadı.');
    } finally {
      setIsAdminLoading(false);
    }
  };

  useEffect(() => {
    void loadPublishedTables();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadAdminTables();
    } else if (activeTab === 'admin') {
      setActiveTab('published');
    }
  }, [adminToken, isAdmin]);

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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  const handleTitleTap = () => {
    if (isAdmin) return;
    const nextCount = adminTapCount + 1;
    setAdminTapCount(nextCount);

    if (nextCount >= 7) {
      setShowAdminActivation(true);
      setAdminTapCount(0);
    }
  };

  const handleHiddenAdminActivation = async () => {
    try {
      await activateAdmin(adminSecretInput.trim());
      setAdminSecretInput('');
      setShowAdminActivation(false);
      setActiveTab('admin');
    } catch {
      setAdminSecretInput('');
    }
  };

  const handleSave = async (table: SharedTableDraft) => {
    setIsSaving(true);
    setAdminError('');

    try {
      await saveSharedTable(table, adminToken);
      await Promise.all([loadAdminTables(), loadPublishedTables()]);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Tablo kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu tablo silinsin mi?')) return;
    setIsSaving(true);
    setAdminError('');

    try {
      await deleteSharedTable(id, adminToken);
      await Promise.all([loadAdminTables(), loadPublishedTables()]);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Tablo silinemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div className="header-row">
          <div>
            <h1 onClick={handleTitleTap}>Halka Arz Tabloları</h1>
            <p>Yayınlanan tabloları görüntüleyin, paylaşın ve admin cihazından güncel tutun.</p>
          </div>
          {canInstall && <button onClick={handleInstallClick}>Uygulamayı yükle</button>}
        </div>
        {showAdminActivation && !isAdmin && (
          <div className="hidden-admin-panel">
            <input
              autoFocus
              placeholder="Admin sırrı"
              type="password"
              value={adminSecretInput}
              onChange={(event) => setAdminSecretInput(event.target.value)}
            />
            <button onClick={handleHiddenAdminActivation}>Admini etkinleştir</button>
            <button className="secondary" onClick={() => setShowAdminActivation(false)}>Vazgeç</button>
          </div>
        )}
        {activationError && <p className="error-text">{activationError}</p>}
      </header>

      {activeTab === 'published' && (
        <PublicTables error={publicError} isLoading={isPublicLoading} onRefresh={loadPublishedTables} tables={publishedTables} />
      )}
      {activeTab === 'tools' && <LocalTools />}
      {activeTab === 'admin' && isAdmin && (
        <AdminPanel
          error={adminError}
          isLoading={isAdminLoading}
          isSaving={isSaving}
          onDeactivate={deactivateAdmin}
          onDelete={handleDelete}
          onRefresh={loadAdminTables}
          onSave={handleSave}
          tables={adminTables}
        />
      )}

      <nav className="tabs" aria-label="Uygulama bölümleri">
        <button className={activeTab === 'published' ? 'tab active' : 'tab'} onClick={() => setActiveTab('published')}>
          Yayınlananlar
        </button>
        <button className={activeTab === 'tools' ? 'tab active' : 'tab'} onClick={() => setActiveTab('tools')}>
          Araçlar
        </button>
        {isAdmin && (
          <button className={activeTab === 'admin' ? 'tab active' : 'tab'} onClick={() => setActiveTab('admin')}>
            Yönetim
          </button>
        )}
      </nav>
    </div>
  );
};

export default App;
