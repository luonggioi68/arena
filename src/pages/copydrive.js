import { useState } from 'react';
import Head from 'next/head';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// Mã Client ID của Thầy (Giữ nguyên)
const GOOGLE_CLIENT_ID = "150254325152-ut43v9fl40h1s8lv2o4ao45q5tp91t0f.apps.googleusercontent.com";

export default function CopyDrivePage() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="arena-bg">
        <Head>
          <title>Arena Copy Google Drive</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* Import Font chữ mang phong cách Game/Sci-fi */}
          <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@400;700&display=swap" rel="stylesheet" />
        </Head>
        
        {/* CSS Tùy chỉnh cho phong cách Neon Rực Lửa */}
        <style dangerouslySetInnerHTML={{__html: `
          body { 
            margin: 0; 
            background-color: #050505; 
            background-image: radial-gradient(circle at center, #1a0500 0%, #000000 100%);
          }
          .arena-bg {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Roboto', sans-serif;
            padding: 20px;
            box-sizing: border-box;
          }
          .arena-container {
            background: rgba(10, 10, 12, 0.85);
            backdrop-filter: blur(8px);
            padding: 40px;
            border-radius: 15px;
            border: 2px solid #ff3300;
            box-shadow: 0 0 20px rgba(255, 51, 0, 0.5), inset 0 0 20px rgba(255, 51, 0, 0.2);
            width: 100%;
            max-width: 650px;
            position: relative;
          }
          /* Tiêu đề rực cháy */
          .fire-title {
            font-family: 'Orbitron', sans-serif;
            font-weight: 900;
            color: #ffffff;
            text-align: center;
            margin-bottom: 30px;
            text-transform: uppercase;
            font-size: 28px;
            letter-spacing: 2px;
            animation: fire-flicker 1.5s infinite alternate;
          }
          @keyframes fire-flicker {
            0% { text-shadow: 0 0 4px #fff, 0 0 10px #ffcc00, 0 0 20px #ff6600, 0 0 40px #ff3300, 0 0 80px #ff0000; }
            100% { text-shadow: 0 0 2px #fff, 0 0 5px #ffcc00, 0 0 15px #ff6600, 0 0 30px #ff3300, 0 0 60px #ff0000; }
          }
          /* Ô nhập liệu Neon */
          .neon-input {
            width: 100%;
            padding: 15px;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid #441100;
            color: #ffddaa;
            border-radius: 8px;
            outline: none;
            box-sizing: border-box;
            font-family: 'Orbitron', sans-serif;
            font-size: 14px;
            transition: all 0.3s ease;
          }
          .neon-input:focus {
            border-color: #ff6600;
            box-shadow: 0 0 15px rgba(255, 102, 0, 0.5);
            background: rgba(20, 5, 0, 0.9);
          }
          .neon-input::placeholder {
            color: #663322;
            font-family: 'Roboto', sans-serif;
          }
          /* Nút bấm Rực lửa */
          .neon-button {
            width: 100%;
            padding: 16px;
            font-size: 18px;
            font-family: 'Orbitron', sans-serif;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #fff;
            border: none;
            border-radius: 8px;
            background: linear-gradient(90deg, #cc0000, #ff6600, #cc0000);
            background-size: 200% auto;
            cursor: pointer;
            transition: 0.5s;
            box-shadow: 0 0 20px rgba(255, 51, 0, 0.6);
          }
          .neon-button:hover:not(:disabled) {
            background-position: right center;
            transform: scale(1.02);
            box-shadow: 0 0 30px rgba(255, 102, 0, 0.9);
          }
          .neon-button:disabled {
            background: #333;
            box-shadow: none;
            color: #777;
            cursor: not-allowed;
            transform: none;
          }
          /* Thông báo trạng thái */
          .status-box {
            margin-top: 25px;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
            white-space: pre-line;
            font-family: 'Roboto', sans-serif;
            animation: fadeIn 0.5s ease;
          }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        `}} />
        <ArenaApp />
      </div>
    </GoogleOAuthProvider>
  );
}

function ArenaApp() {
  const [accessToken, setAccessToken] = useState(null);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState({ loading: false, type: '', text: '' });

  // 1. ĐĂNG NHẬP LẤY CHÌA KHÓA
  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive',
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      setStatus({ loading: false, type: 'success', text: '✅ MỞ KHÓA THÀNH CÔNG! HÃY NẠP LINK VẬN TIÊU.' });
    },
    onError: () => setStatus({ loading: false, type: 'error', text: '❌ KẾT NỐI THẤT BẠI. HÃY THỬ LẠI.' }),
  });

  // --- CÁC HÀM XỬ LÝ LÕI ---
  const extractId = (url) => {
    if (!url) return "";
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : url.trim();
  };

  const fetchDrive = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const copyFolderRecursive = async (srcId, dstParentId, folderName) => {
    const newFolder = await fetchDrive(`https://www.googleapis.com/drive/v3/files`, {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [dstParentId]
      })
    });

    let pageToken = null;
    do {
      const query = encodeURIComponent(`'${srcId}' in parents and trashed = false`);
      const listRes = await fetchDrive(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=nextPageToken,files(id,name,mimeType)&pageToken=${pageToken || ''}`);

      for (const child of listRes.files) {
        if (child.mimeType === 'application/vnd.google-apps.folder') {
          await copyFolderRecursive(child.id, newFolder.id, child.name);
        } else {
          await fetchDrive(`https://www.googleapis.com/drive/v3/files/${child.id}/copy`, {
            method: 'POST',
            body: JSON.stringify({ name: child.name, parents: [newFolder.id] })
          });
        }
      }
      pageToken = listRes.nextPageToken;
    } while (pageToken);
  };

  // 2. HÀM CHÍNH
  const handleCopy = async (e) => {
    e.preventDefault();
    if (!source) return setStatus({ loading: false, type: 'error', text: '⚠️ CẢNH BÁO: CHƯA NHẬP LINK NGUỒN!' });

    setStatus({ loading: true, type: 'info', text: '🔥 ĐANG VẬN TIÊU TRỰC TIẾP... \n🛡️ KHÔNG ĐÓNG TRÌNH DUYỆT LÚC NÀY!' });

    try {
      const sourceId = extractId(source);
      const destId = extractId(destination);
      const parentArr = destId ? [destId] : ["root"];

      const sourceMeta = await fetchDrive(`https://www.googleapis.com/drive/v3/files/${sourceId}?fields=id,name,mimeType`);
      const isFolder = sourceMeta.mimeType === 'application/vnd.google-apps.folder';

      if (!isFolder) {
        await fetchDrive(`https://www.googleapis.com/drive/v3/files/${sourceId}/copy`, {
          method: 'POST',
          body: JSON.stringify({ name: `${sourceMeta.name} (Bản sao)`, parents: parentArr })
        });
        setStatus({ loading: false, type: 'success', text: `🏆 ĐÃ COPY FILE THÀNH CÔNG:\n[ ${sourceMeta.name} ]` });
      } else {
        await copyFolderRecursive(sourceId, destId || "root", `${sourceMeta.name} (Bản sao)`);
        setStatus({ loading: false, type: 'success', text: `🏆 ĐÃ COPY THƯ MỤC THÀNH CÔNG:\n[ ${sourceMeta.name} ]` });
      }

      setSource(''); setDestination('');
    } catch (error) {
      console.error(error);
      setStatus({ loading: false, type: 'error', text: '💀 NHIỆM VỤ THẤT BẠI:\nBạn không có quyền truy cập, hoặc Kho chứa đã đầy!' });
    }
  };

  // 3. GIAO DIỆN
  return (
    <div className="arena-container">
      <h1 className="fire-title">
        🔥 ARENA COPY G_DRIVE 🔥
      </h1>

      {!accessToken ? (
        <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
          <p style={{ color: '#ffddaa', marginBottom: '25px', lineHeight: '1.6', fontSize: '15px' }}>
            Hệ thống yêu cầu xác thực người chơi. <br/>
            Dữ liệu vận tiêu sẽ tự động dịch chuyển về căn cứ Drive của chính bạn!
          </p>
          <button 
            onClick={() => login()} 
            style={{ 
              padding: '12px 25px', fontSize: '15px', fontWeight: 'bold', background: '#fff', color: '#000', 
              border: 'none', borderRadius: '50px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', 
              gap: '12px', boxShadow: '0 0 15px rgba(255,255,255,0.4)', transition: '0.3s', fontFamily: 'Orbitron, sans-serif'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="20" />
            ĐĂNG NHẬP HỆ THỐNG
          </button>
        </div>
      ) : (
        <form onSubmit={handleCopy}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#ff3300', fontFamily: 'Orbitron, sans-serif', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '1px' }}>
              🎯 LINK NGUỒN(FILE HOẶC FOLDER) (TARGET):
            </label>
            <input 
              className="neon-input"
              type="text" 
              placeholder="Dán link mục tiêu (File/Folder) vào đây..." 
              value={source} 
              onChange={(e) => setSource(e.target.value)} 
              disabled={status.loading} 
            />
          </div>

          <div style={{ marginBottom: '35px' }}>
            <label style={{ display: 'block', color: '#ff9900', fontFamily: 'Orbitron, sans-serif', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '1px' }}>
              ⛺ ĐÍCH THƯ MỤC CẦN COPY ĐẾN (BASE):
            </label>
            <input 
              className="neon-input"
              type="text" 
              placeholder="Bỏ trống = Trả đồ về sảnh chính Drive..." 
              value={destination} 
              onChange={(e) => setDestination(e.target.value)} 
              disabled={status.loading} 
            />
          </div>

          <button type="submit" className="neon-button" disabled={status.loading}>
            {status.loading ? '⏳ ĐANG COPY NGỒI CAFE ĐI...' : '⚡ KHỞI ĐỘNG SAO CHÉP ⚡'}
          </button>
        </form>
      )}

      {status.text && (
        <div className="status-box" style={{ 
          color: status.type === 'error' ? '#ff4d4d' : status.type === 'success' ? '#00ffcc' : '#ffc107', 
          background: status.type === 'error' ? 'rgba(255,0,0,0.1)' : status.type === 'success' ? 'rgba(0, 255, 204, 0.1)' : 'rgba(255, 193, 7, 0.1)',
          border: `1px solid ${status.type === 'error' ? '#ff4d4d' : status.type === 'success' ? '#00ffcc' : '#ffc107'}`,
          boxShadow: `0 0 10px ${status.type === 'error' ? 'rgba(255,0,0,0.3)' : status.type === 'success' ? 'rgba(0, 255, 204, 0.3)' : 'rgba(255, 193, 7, 0.3)'}`
        }}>
          {status.text}
        </div>
      )}
    </div>
  );
}