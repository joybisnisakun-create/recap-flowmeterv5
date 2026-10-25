import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutGoogle
} from '../lib/googleAuth';
import {
  extractSpreadsheetId,
  createMasterSpreadsheetTemplate,
  pullDataFromSpreadsheet,
  pushDataToSpreadsheet,
  getSpreadsheetMeta,
  fetchLiveSpreadsheetData,
  DEFAULT_SHEET_NAMES,
  SheetSummary,
  STORAGE_KEYS,
  getMasterSpreadsheetId,
  setMasterSpreadsheetId,
  clearMasterSpreadsheet,
  LOCKED_MASTER_SPREADSHEET_ID,
  OWNER_EMAIL,
  OWNER_NAME,
  isOwnerUser
} from '../lib/googleSheets';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: {
    usageText: string;
    weeklyText: string;
    contractText: string;
    activeText: string;
  };
  onApplyData: (data: {
    usageText: string;
    weeklyText: string;
    contractText: string;
    activeText: string;
    summary: SheetSummary;
  }) => void;
  masterSheetId?: string;
  isMasterActive?: boolean;
  onMasterSheetChange?: (id: string, isMaster: boolean) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onApplyData,
  masterSheetId = '',
  isMasterActive = false,
  onMasterSheetChange
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const isOwner = isOwnerUser(user?.email);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>('');
  const [linkedId, setLinkedId] = useState<string>(masterSheetId || '');
  const [linkedTitle, setLinkedTitle] = useState<string>('');
  const [isMaster, setIsMaster] = useState<boolean>(isMasterActive);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);

  // Pull Preview state
  const [pulledData, setPulledData] = useState<{
    usageText: string;
    weeklyText: string;
    contractText: string;
    activeText: string;
    summary: SheetSummary;
  } | null>(null);

  // Push Confirmation dialog state
  const [showPushConfirm, setShowPushConfirm] = useState<boolean>(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false);

  // Load saved spreadsheet ID and master status from localStorage
  useEffect(() => {
    try {
      const savedMasterId = getMasterSpreadsheetId() || localStorage.getItem(STORAGE_KEYS.LINKED_SHEET_ID) || '';
      const savedIsMaster = localStorage.getItem(STORAGE_KEYS.IS_MASTER_ACTIVE) === 'true';
      if (savedMasterId) {
        setLinkedId(savedMasterId);
        setSpreadsheetInput(savedMasterId);
        setIsMaster(savedIsMaster);
      }
    } catch {}
  }, []);

  // Sync with prop changes
  useEffect(() => {
    if (masterSheetId) {
      setLinkedId(masterSheetId);
      setSpreadsheetInput(masterSheetId);
    }
    if (typeof isMasterActive === 'boolean') {
      setIsMaster(isMasterActive);
    }
  }, [masterSheetId, isMasterActive]);

  // Listen to Google Auth state
  useEffect(() => {
    const unsub = initAuth(
      (u, tok) => {
        setUser(u);
        setToken(tok);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsub();
  }, []);

  // Fetch title if linkedId and token are present
  useEffect(() => {
    if (linkedId && token) {
      getSpreadsheetMeta(token, linkedId)
        .then(meta => {
          setLinkedTitle(meta.properties?.title || 'Google Spreadsheet');
        })
        .catch(() => {
          setLinkedTitle('');
        });
    }
  }, [linkedId, token]);

  if (!isOpen) return null;

  // Handle Sign In (Google Account)
  const handleSignIn = async () => {
    setLoadingAction('Masuk dengan Google…');
    setStatusMsg(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setToken(res.accessToken);
      setStatusMsg({ text: `Berhasil masuk sebagai ${res.user.email}`, type: 'ok' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Gagal masuk dengan akun Google', type: 'err' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setStatusMsg({ text: 'Berhasil keluar dari akun Google', type: 'info' });
  };

  // Handle Test & Link as Master Database (Works without requiring viewer sign-in!)
  const handleTestAndLinkMaster = async () => {
    const id = extractSpreadsheetId(spreadsheetInput);
    if (!id) {
      setStatusMsg({ text: 'Masukkan URL atau ID Google Spreadsheet yang valid.', type: 'err' });
      return;
    }

    setLoadingAction('Menguji pembacaan 4 lembar kerja Google Sheets…');
    setStatusMsg(null);
    setPulledData(null);

    try {
      // 1. Test live reading via public/viewer endpoint
      const res = await fetchLiveSpreadsheetData(id);
      if (!res.ok || !res.summary) {
        throw new Error(
          res.error ||
          'Gagal membaca lembar kerja. Pastikan spreadsheet sudah dibagikan dengan akses "Siapa saja yang memiliki link: Pelihat (Viewer)".'
        );
      }

      // 2. If token exists, also fetch exact title
      let title = '';
      if (token) {
        try {
          const meta = await getSpreadsheetMeta(token, id);
          title = meta.properties?.title || '';
        } catch {}
      }

      // 3. Save as Master Database
      setLinkedId(id);
      setIsMaster(true);
      setLinkedTitle(title);
      setMasterSpreadsheetId(id);

      if (onMasterSheetChange) {
        onMasterSheetChange(id, true);
      }

      // 4. Apply freshly fetched data right into the dashboard
      onApplyData({
        usageText: res.usageText || '',
        weeklyText: res.weeklyText || '',
        contractText: res.contractText || '',
        activeText: res.activeText || '',
        summary: res.summary
      });

      setStatusMsg({
        text: `✓ Berhasil ditautkan sebagai Database Utama Permanen! Memuat ${res.summary.monthlyRows} baris bulanan, ${res.summary.weeklyRows} mingguan, ${res.summary.contractRows} kontrak, ${res.summary.activeRows} pelanggan aktif.`,
        type: 'ok'
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Gagal membaca spreadsheet. Pastikan link benar dan hak akses telah disetel ke Pelihat (Viewer).',
        type: 'err'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Disconnecting Master Spreadsheet
  const handleDisconnectMaster = () => {
    clearMasterSpreadsheet();
    setLinkedId('');
    setSpreadsheetInput('');
    setLinkedTitle('');
    setIsMaster(false);
    setShowDisconnectConfirm(false);
    if (onMasterSheetChange) {
      onMasterSheetChange('', false);
    }
    setStatusMsg({
      text: 'Tautan Google Spreadsheet dilepas. Dashboard kembali menggunakan sumber file bawaan.',
      type: 'info'
    });
  };

  // Handle Auto-creating Master Template in Google Drive (For Owner)
  const handleCreateTemplate = async () => {
    let currentTok = token;
    if (!currentTok) {
      try {
        const signRes = await googleSignIn();
        setUser(signRes.user);
        currentTok = signRes.accessToken;
        setToken(currentTok);
      } catch (err: any) {
        setStatusMsg({ text: err.message || 'Masuk dengan Google dibatalkan.', type: 'err' });
        return;
      }
    }

    setLoadingAction('Membuat template 4-tab di Google Drive Anda…');
    setStatusMsg(null);
    try {
      const created = await createMasterSpreadsheetTemplate(currentTok, currentData);
      setLinkedId(created.spreadsheetId);
      setSpreadsheetInput(created.spreadsheetId);
      setLinkedTitle(created.title);
      setIsMaster(true);
      setMasterSpreadsheetId(created.spreadsheetId);

      if (onMasterSheetChange) {
        onMasterSheetChange(created.spreadsheetId, true);
      }

      setStatusMsg({
        text: `Master Spreadsheet baru berhasil dibuat di Google Drive Anda! Buka berkas, klik "Bagikan" -> ubah ke "Siapa saja yang memiliki link: Pelihat", agar aplikasi dapat membaca otomatis.`,
        type: 'ok'
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Gagal membuat template di Google Drive',
        type: 'err'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Manual Pull from Sheets
  const handlePullData = async () => {
    if (!linkedId) {
      setStatusMsg({ text: 'Tautkan atau masukkan ID Google Spreadsheet terlebih dahulu.', type: 'err' });
      return;
    }

    setLoadingAction('Menarik data terbaru dari 4 lembar kerja Google Sheets…');
    setStatusMsg(null);
    setPulledData(null);
    try {
      // Use live viewer endpoint first, or official API if token present
      let res = await fetchLiveSpreadsheetData(linkedId);
      if (!res.ok && token) {
        res = await pullDataFromSpreadsheet(token, linkedId);
      }

      if (!res.ok || !res.summary) {
        throw new Error(res.error || 'Gagal menarik data');
      }

      setPulledData({
        usageText: res.usageText || '',
        weeklyText: res.weeklyText || '',
        contractText: res.contractText || '',
        activeText: res.activeText || '',
        summary: res.summary
      });

      setStatusMsg({
        text: `Data terbaru berhasil dibaca! Klik "Terapkan ke Dashboard Sekarang" di bawah.`,
        type: 'ok'
      });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Gagal menarik data dari Google Sheets', type: 'err' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Apply pulled data to App state
  const handleApplyPulledData = () => {
    if (!pulledData) return;
    onApplyData(pulledData);
    setStatusMsg({ text: 'Data dari Google Sheets berhasil diterapkan ke dashboard!', type: 'ok' });
    setPulledData(null);
  };

  // Handle Push (after confirmation)
  const handleConfirmPush = async () => {
    if (!linkedId) return;

    let currentTok = token;
    if (!currentTok) {
      try {
        const signRes = await googleSignIn();
        setUser(signRes.user);
        currentTok = signRes.accessToken;
        setToken(currentTok);
      } catch (err: any) {
        setStatusMsg({ text: 'Izin akun Google diperlukan untuk memperbarui data.', type: 'err' });
        setShowPushConfirm(false);
        return;
      }
    }

    setLoadingAction('Menyimpan data aktif ke 4 tab Google Sheets…');
    setShowPushConfirm(false);
    setStatusMsg(null);
    try {
      await pushDataToSpreadsheet(currentTok, linkedId, currentData);
      setStatusMsg({
        text: 'Data aktif berhasil diunggah dan disimpan ke seluruh tab Google Sheets!',
        type: 'ok'
      });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Gagal mengunggah data ke Google Sheets', type: 'err' });
    } finally {
      setLoadingAction(null);
    }
  };

  const sheetUrl = linkedId ? `https://docs.google.com/spreadsheets/d/${linkedId}/edit` : null;

  return (
    <div
      className="dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !loadingAction) onClose();
      }}
    >
      <div
        className="dlg"
        style={{
          background: 'var(--surface)',
          color: 'var(--fg)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          width: 'min(760px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 36px)',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#0F9D58">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
              </svg>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Google Sheets sebagai Database Utama Permanen</h2>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Data dibaca otomatis dari spreadsheet Anda setiap kali dashboard dibuka. Hanya akun Google Anda yang dapat mengedit lembar data.
            </p>
          </div>
          <button
            className="btn"
            style={{ minHeight: 28, padding: '4px 10px', fontSize: 13 }}
            onClick={onClose}
            disabled={!!loadingAction}
          >
            Tutup ✕
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background:
                statusMsg.type === 'ok'
                  ? 'var(--good-bg)'
                  : statusMsg.type === 'err'
                  ? 'var(--critical-bg)'
                  : 'var(--accent-soft)',
              color:
                statusMsg.type === 'ok'
                  ? 'var(--good-tx)'
                  : statusMsg.type === 'err'
                  ? 'var(--critical-tx)'
                  : 'var(--accent)',
              border: `1px solid ${
                statusMsg.type === 'ok'
                  ? 'var(--good)'
                  : statusMsg.type === 'err'
                  ? 'var(--critical)'
                  : 'var(--accent)'
              }`
            }}
          >
            <span>{statusMsg.type === 'ok' ? '✓' : statusMsg.type === 'err' ? '⚠️' : 'ℹ️'}</span>
            <span style={{ flex: 1 }}>{statusMsg.text}</span>
            <button
              onClick={() => setStatusMsg(null)}
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Master Spreadsheet Database Setup Card */}
        <div
          style={{
            border: isMaster && linkedId ? '1.5px solid #1baf7a' : '1px solid var(--line)',
            borderRadius: 10,
            padding: 18,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: isMaster && linkedId ? '#1baf7a' : '#888',
                  boxShadow: isMaster && linkedId ? '0 0 8px #1baf7a' : 'none',
                  display: 'inline-block'
                }}
              />
              <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: isMaster && linkedId ? '#1baf7a' : 'var(--muted)' }}>
                {isMaster && linkedId ? 'Database Utama: Aktif & Terhubung' : 'Pengaturan Database Utama'}
              </span>
            </div>

            {isMaster && linkedId && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'rgba(27,175,122,0.14)',
                  color: '#1baf7a'
                }}
              >
                Permanen di seluruh pengunjung
              </span>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                ID atau Tautan (URL) Google Spreadsheet Anda:
              </label>
              {!isOwner ? (
                <span
                  style={{
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(27,175,122,0.12)',
                    color: '#1baf7a',
                    fontWeight: 700
                  }}
                >
                  🔒 Terkunci Permanen (Hanya Pemilik)
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#1baf7a', fontWeight: 600 }}>
                  ✓ Mode Pemilik Terverifikasi
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={LOCKED_MASTER_SPREADSHEET_ID}
                value={spreadsheetInput || (linkedId || LOCKED_MASTER_SPREADSHEET_ID)}
                onChange={e => {
                  if (isOwner) setSpreadsheetInput(e.target.value);
                }}
                readOnly={!isOwner}
                disabled={!isOwner}
                style={{
                  flex: 1,
                  minWidth: 280,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: isOwner ? '1px solid var(--line)' : '1px solid rgba(27,175,122,0.3)',
                  background: isOwner ? 'var(--surface)' : 'rgba(27,175,122,0.04)',
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontFamily: 'var(--f-mono)',
                  cursor: isOwner ? 'text' : 'not-allowed'
                }}
                title={!isOwner ? `ID Spreadsheet telah dipatenkan permanen untuk Joy Felix (${OWNER_EMAIL}) dan tidak dapat diubah oleh pengunjung.` : ''}
              />
              {isOwner ? (
                <button
                  className="btn pri"
                  onClick={handleTestAndLinkMaster}
                  disabled={!!loadingAction || !spreadsheetInput.trim()}
                  style={{ fontWeight: 600, minWidth: 170 }}
                >
                  ⚡ Uji & Tautkan Sekarang
                </button>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    background: 'rgba(27,175,122,0.12)',
                    color: '#1baf7a',
                    fontWeight: 600,
                    fontSize: 12.5,
                    border: '1px solid rgba(27,175,122,0.25)'
                  }}
                >
                  🔒 Dipatenkan Pemilik
                </div>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
              {!isOwner
                ? `ID Spreadsheet telah dipatenkan permanen ke akun ${OWNER_EMAIL} (${OWNER_NAME}). Pengunjung hanya memiliki hak akses baca melalui dashboard.`
                : 'Anda masuk sebagai pemilik sah. Anda memiliki wewenang penuh untuk mengubah tautan spreadsheet jika diperlukan.'}
            </div>
          </div>

          {/* Connected Details Bar */}
          {linkedId && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1baf7a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓ Terhubung:</span>
                  <span>{linkedTitle || 'Google Spreadsheet Master'}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--muted)', marginTop: 2 }}>
                  Spreadsheet ID: {linkedId}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }}
                  >
                    Buka Spreadsheet ↗
                  </a>
                )}
                <button
                  className="btn"
                  onClick={handlePullData}
                  disabled={!!loadingAction}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  🔄 Segarkan
                </button>
                {/* Lepas is ONLY visible to the verified owner Joy Felix */}
                {isOwner && (
                  <button
                    className="btn"
                    onClick={() => setShowDisconnectConfirm(true)}
                    style={{ fontSize: 12, color: 'var(--critical)', padding: '4px 8px' }}
                    title="Lepas database ini dan kembali ke file lokal"
                  >
                    Lepas
                  </button>
                )}
              </div>
            </div>
          )}


        </div>

        {/* 2. Google Drive Owner Identity & Verification */}
        <div
          style={{
            border: isOwner ? '1.5px solid #1baf7a' : '1px solid var(--line)',
            borderRadius: 10,
            padding: 16,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600 }}>
                2. Pemilik Sah & Administrator Database
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#1baf7a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14
                  }}
                >
                  J
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{OWNER_NAME}</strong>
                    <span
                      style={{
                        fontSize: 10.5,
                        background: 'rgba(27,175,122,0.14)',
                        color: '#1baf7a',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 700
                      }}
                    >
                      ✓ Pemilik Terverifikasi
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--f-mono)' }}>
                    {OWNER_EMAIL}
                  </div>
                </div>
              </div>

              {user && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {isOwner ? (
                    <span style={{ color: '#1baf7a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ✓ Anda telah login sebagai Pemilik Resmi. Hak administratif penuh aktif.
                    </span>
                  ) : (
                    <span style={{ color: 'var(--warning-tx)', background: 'var(--warning-bg)', padding: '2px 8px', borderRadius: 4 }}>
                      ⚠️ Masuk sebagai {user.email} (Bukan Pemilik). Konfigurasi database terkunci.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              {user ? (
                <button
                  className="btn"
                  onClick={handleLogout}
                  style={{ fontSize: 12 }}
                  disabled={!!loadingAction}
                >
                  Keluar dari Akun Google
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={!!loadingAction}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#ffffff',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontWeight: 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>


        </div>

        {/* Contact Info */}
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 18,
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1baf7a, #0d8a5e)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0
            }}
          >
            JF
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Hubungi Joy Felix untuk update, revisi dan penjelasan jika diperlukan
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {OWNER_EMAIL}
            </div>
          </div>
        </div>

        {/* 4. Owner Push Option (Upload edited data back to Google Sheets) */}
        {user && linkedId && (
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 14,
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Simpan Data Dashboard ke Google Sheets (Push)</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Perbarui lembar spreadsheet dengan dataset aktif saat ini di dashboard.
              </div>
            </div>
            <button
              className="btn"
              onClick={() => setShowPushConfirm(true)}
              disabled={!!loadingAction}
              style={{ fontSize: 12.5 }}
            >
              ⬆️ Unggah ke Google Sheets
            </button>
          </div>
        )}

        {/* Pull Preview Card */}
        {pulledData && (
          <div
            style={{
              border: '1px solid var(--good)',
              background: 'var(--good-bg)',
              color: 'var(--good-tx)',
              padding: 14,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              ✓ Pratinjau Data Berhasil Ditarik ({pulledData.summary.lastUpdated})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12 }}>
              <div style={{ background: 'var(--surface)', padding: 8, borderRadius: 4, border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)' }}>Pemakaian Bulanan</div>
                <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{pulledData.summary.monthlyRows} baris</strong>
              </div>
              <div style={{ background: 'var(--surface)', padding: 8, borderRadius: 4, border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)' }}>Pemakaian Mingguan</div>
                <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{pulledData.summary.weeklyRows} meter</strong>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>({pulledData.summary.weeklyWeeks} pekan)</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: 8, borderRadius: 4, border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)' }}>Pelanggan Aktif</div>
                <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{pulledData.summary.activeRows} aktif</strong>
              </div>
              <div style={{ background: 'var(--surface)', padding: 8, borderRadius: 4, border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)' }}>Data Kontrak</div>
                <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{pulledData.summary.contractRows} kontrak</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                className="btn pri"
                onClick={handleApplyPulledData}
                style={{ fontWeight: 600 }}
              >
                Terapkan ke Dashboard Sekarang
              </button>
              <button
                className="btn"
                onClick={() => setPulledData(null)}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loadingAction && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <span className="beacon-ring-pulse" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
            <span>{loadingAction}</span>
          </div>
        )}

        {/* Disconnect Confirmation Modal */}
        {showDisconnectConfirm && (
          <div
            style={{
              border: '2px solid var(--critical)',
              background: 'var(--critical-bg)',
              color: 'var(--critical-tx)',
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Lepas Google Spreadsheet sebagai Database Utama?
            </div>
            <p style={{ margin: 0, fontSize: 12.5 }}>
              Aplikasi akan berhenti membaca data dari spreadsheet ini dan kembali ke file lokal bawaan.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="btn"
                onClick={handleDisconnectMaster}
                style={{ background: 'var(--critical)', color: '#fff', border: 0, fontWeight: 600 }}
              >
                Ya, Lepas Hubungan
              </button>
              <button
                className="btn"
                onClick={() => setShowDisconnectConfirm(false)}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Push Confirmation Modal */}
        {showPushConfirm && (
          <div
            style={{
              border: '2px solid var(--warning)',
              background: 'var(--warning-bg)',
              color: 'var(--warning-tx)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              ⚠️ Konfirmasi Perubahan Data Google Sheets
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>
              Tindakan ini akan menimpa isi 4 lembar kerja pada Google Spreadsheet:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
              <li><strong>{DEFAULT_SHEET_NAMES.monthly}</strong></li>
              <li><strong>{DEFAULT_SHEET_NAMES.weekly}</strong></li>
              <li><strong>{DEFAULT_SHEET_NAMES.contract}</strong></li>
              <li><strong>{DEFAULT_SHEET_NAMES.active}</strong></li>
            </ul>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                className="btn pri"
                onClick={handleConfirmPush}
                style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000', fontWeight: 600 }}
              >
                Ya, Lanjutkan Perbarui Google Sheets
              </button>
              <button
                className="btn"
                onClick={() => setShowPushConfirm(false)}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
