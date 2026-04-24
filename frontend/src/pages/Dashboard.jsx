import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { File as FileIcon, Lock, MessageCircle, ScrollText, FolderOpen, Share2, Users } from 'lucide-react';

import Navbar from '../components/Navbar';
import FileUpload from '../components/FileUpload';
import FileList from '../components/FileList';
import ShareModal from '../components/ShareModal';
import PrivacySettings from '../components/PrivacySettings';
import MessagePanel from '../components/MessagePanel';
import SecurityLogs from '../components/SecurityLogs';
import FriendsList from '../components/FriendsList';
import ProfileView from '../components/ProfileView';

const TABS = [
  { id: 'my-files', label: 'My Files', icon: FolderOpen },
  { id: 'shared', label: 'Shared', icon: Share2 },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'logs', label: 'Security', icon: ScrollText },
];

const API = import.meta.env.VITE_API_URL;

const Dashboard = ({ setIsAuthenticated }) => {
  const [activeTab, setActiveTab] = useState('my-files');
  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [privacy, setPrivacy] = useState(null);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatWith, setChatWith] = useState('');
  const [chatText, setChatText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shareFile, setShareFile] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const fetchData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const h = headers();
      const [filesRes, sharedRes, usersRes, privacyRes, logsRes, alertsRes] = await Promise.all([
        axios.get(`${API}/files`, { headers: h }),
        axios.get(`${API}/files/shared-with-me`, { headers: h }),
        axios.get(`${API}/files/users`, { headers: h }),
        axios.get(`${API}/privacy/settings`, { headers: h }),
        axios.get(`${API}/monitoring/logs`, { headers: h }),
        axios.get(`${API}/monitoring/security-alerts`, { headers: h }),
      ]);
      setFiles(filesRes.data);
      setSharedFiles(sharedRes.data);
      setUsers(usersRes.data.users || []);
      setPrivacy(privacyRes.data);
      setLogs(logsRes.data);
      setAlerts(alertsRes.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      if (!isBackground) setError('Failed to fetch dashboard data');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(false); }, [fetchData]);

  // ── Polling Hook ──
  useEffect(() => {
    const dataInterval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(dataInterval);
  }, [fetchData]);

  useEffect(() => {
    let msgInterval;
    if (activeTab === 'messages' && chatWith) {
      msgInterval = setInterval(() => loadMessages(chatWith, true), 3000);
    }
    return () => clearInterval(msgInterval);
  }, [activeTab, chatWith]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { headers: headers() });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    navigate('/login');
  };

  // ── File operations ──
  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API}/files/upload`, formData, {
      headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
    });
    setSuccess(`Securely uploaded. Hash: ${res.data.fileHash?.substring(0, 16)}…`);
    fetchData();
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const res = await axios.get(`${API}/files/download/${fileId}`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download file');
    }
  };

  const handleShare = async (fileId, receiverEmail) => {
    await axios.post(`${API}/files/share`, { fileId, receiverEmail }, { headers: headers() });
    setSuccess(`File shared with ${receiverEmail}`);
  };

  const handleDownloadCSV = async () => {
    try {
      const res = await axios.get(`${API}/monitoring/logs/csv`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'security_logs.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download CSV');
    }
  };

  // ── Privacy ──
  const updatePrivacy = async (patch) => {
    try {
      setError('');
      setSuccess('');
      const res = await axios.put(`${API}/privacy/settings`, patch, { headers: headers() });
      setPrivacy(res.data);
      setSuccess('Privacy settings updated');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update privacy settings');
    }
  };

  // ── E2EE Messaging helpers ──
  const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  const getMyId = () => {
    try {
      if (token) return JSON.parse(atob(token.split('.')[1])).id;
    } catch {}
    return localStorage.getItem('userId') || '0';
  };

  const getPrivKeyName = () => `e2ee:private_pkcs8_${getMyId()}`;
  const getPubKeyName = () => `e2ee:public_spki_${getMyId()}`;

  const ensureE2EEKeys = async () => {
    const storedPriv = localStorage.getItem(getPrivKeyName());
    const storedPub = localStorage.getItem(getPubKeyName());
    if (storedPriv && storedPub) return { private_pkcs8: storedPriv, public_spki: storedPub };

    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    );
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const pubB64 = bufToB64(spki);
    const privB64 = bufToB64(pkcs8);
    localStorage.setItem(getPubKeyName(), pubB64);
    localStorage.setItem(getPrivKeyName(), privB64);
    await axios.put(`${API}/messages/key`, { public_key_spki: pubB64 }, { headers: headers() });
    return { private_pkcs8: privB64, public_spki: pubB64 };
  };

  const importPrivateKey = async () => {
    const priv = localStorage.getItem(getPrivKeyName());
    if (!priv) return null;
    return crypto.subtle.importKey('pkcs8', b64ToBuf(priv), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  };

  const importPublicKey = async (spkiB64) =>
    crypto.subtle.importKey('spki', b64ToBuf(spkiB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);

  const loadMessages = async (withId, isBackground = false) => {
    try {
      if (!isBackground) setError('');
      const h = headers();
      const res = await axios.get(`${API}/messages/get?with=${withId}`, { headers: h });
      const privKey = await importPrivateKey();
      if (!privKey) {
        setMessages(res.data.map((m) => ({ ...m, plaintext: '[Generate keys to decrypt]' })));
        return;
      }
      const decoded = [];
      for (const m of res.data) {
        try {
          const myId = Number(getMyId());
          // IMPORTANT: Convert PostgreSQL BIGINT (string) to Number for exact matching!
          const isSender = myId === Number(m.sender_id);
          const encKeyB64 = isSender ? m.encrypted_key_for_sender : m.encrypted_key_for_receiver;
          
          if (!encKeyB64) throw new Error('missing key');
          const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, b64ToBuf(encKeyB64));
          const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt']);
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(m.iv) }, aesKey, b64ToBuf(m.encrypted_message));
          decoded.push({ ...m, plaintext: new TextDecoder().decode(pt) });
        } catch (decErr) {
          decoded.push({ ...m, plaintext: '[Unable to decrypt]' });
        }
      }
      setMessages(decoded);
    } catch (e) {
      if (!isBackground) setError(e.response?.data?.error || 'Failed to load messages');
    }
  };

  const sendMessage = async () => {
    const receiver = Number(chatWith);
    if (!receiver || !chatText.trim()) return;
    try {
      setError('');
      setSuccess('');
      const h = headers();
      await ensureE2EEKeys();
      
      const recvKeyRes = await axios.get(`${API}/messages/key/${receiver}`, { headers: h });
      const recvPub = await importPublicKey(recvKeyRes.data.public_key_spki);
      const myPubB64 = localStorage.getItem(getPubKeyName());
      const myPub = myPubB64 ? await importPublicKey(myPubB64) : null;
      if (!myPub) throw new Error('Missing sender key');

      const aesRaw = crypto.getRandomValues(new Uint8Array(32));
      const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(chatText.trim()));
      
      const encForReceiver = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recvPub, aesRaw);
      const encForSender = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, myPub, aesRaw);

      await axios.post(`${API}/messages/send`, {
        receiver_id: receiver,
        encrypted_message: bufToB64(ct),
        iv: bufToB64(iv),
        auth_tag: 'webcrypto',
        encrypted_key_for_sender: bufToB64(encForSender),
        encrypted_key_for_receiver: bufToB64(encForReceiver),
      }, { headers: h });
      
      setChatText('');
      setSuccess('Message sent securely');
      await loadMessages(receiver);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send message');
    }
  };

  // Auto-clear notifications
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const handleManualRefresh = async () => {
    await fetchData(false);
    if (activeTab === 'messages' && chatWith) {
      await loadMessages(chatWith, false);
    }
  };

  // If viewing a profile
  if (viewingProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar onLogout={handleLogout} onRefresh={handleManualRefresh} loading={loading} token={token} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <ProfileView
            userId={viewingProfile}
            token={token}
            onBack={() => setViewingProfile(null)}
            onViewProfile={setViewingProfile}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLogout={handleLogout} onRefresh={handleManualRefresh} loading={loading} token={token} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">Secure Vault</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Files encrypted at rest · Messages E2E encrypted · Privacy enforced server-side
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-sm animate-slide-up">
            {success}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                activeTab === id
                  ? 'bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]'
                  : 'bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
              }`}
              id={`tab-${id}`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'my-files' && (
            <div className="space-y-6">
              <FileUpload onUpload={handleUpload} />
              <FileList
                files={files}
                title="My Secure Files"
                emptyMsg="Your vault is empty. Upload a file above."
                onDownload={handleDownload}
                onShare={(file) => setShareFile(file)}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'shared' && (
            <FileList
              files={sharedFiles}
              title="Files Shared With Me"
              emptyMsg="No files have been shared with you yet."
              onDownload={handleDownload}
              showSender
              loading={loading}
            />
          )}

          {activeTab === 'friends' && (
            <FriendsList
              token={token}
              onViewProfile={setViewingProfile}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacySettings privacy={privacy} onUpdate={updatePrivacy} />
          )}

          {activeTab === 'messages' && (
            <MessagePanel
              users={users}
              messages={messages}
              chatWith={chatWith}
              setChatWith={setChatWith}
              chatText={chatText}
              setChatText={setChatText}
              onSend={sendMessage}
              onLoadMessages={loadMessages}
            />
          )}

          {activeTab === 'logs' && (
            <SecurityLogs logs={logs} alerts={alerts} onDownloadCSV={handleDownloadCSV} />
          )}
        </div>
      </main>

      {/* Share Modal */}
      {shareFile && (
        <ShareModal
          file={shareFile}
          users={users}
          onShare={handleShare}
          onClose={() => setShareFile(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
