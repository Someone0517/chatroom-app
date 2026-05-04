import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { renderAvatar } from "../utils/chatHelpers";

export default function BlockListModal({ showBlockListModal, setShowBlockListModal, nightMode, currentUserInfo, user }) {
  const [blockEmailInput, setBlockEmailInput] = useState("");
  const [blockedUsersDetails, setBlockedUsersDetails] = useState([]);

  // 當 modal 打開或封鎖名單變動時，抓取被封鎖者的詳細資料 (名字、頭像)
  useEffect(() => {
    if (!showBlockListModal || !currentUserInfo?.blockedUsers?.length) {
      setBlockedUsersDetails([]);
      return;
    }
    const fetchBlockedUsers = async () => {
      const details = [];
      await Promise.all(currentUserInfo.blockedUsers.map(async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) details.push(snap.data());
      }));
      setBlockedUsersDetails(details);
    };
    fetchBlockedUsers();
  }, [showBlockListModal, currentUserInfo?.blockedUsers]);

  // 💡 用 Email 封鎖功能
  const handleBlockByEmail = async (e) => {
    e.preventDefault();
    const targetEmail = blockEmailInput.trim().toLowerCase();
    if(!targetEmail) return;
    if(targetEmail === user.email.toLowerCase()) return alert("不能封鎖自己");

    try {
      // 搜尋信箱
      const q = query(collection(db, "users"), where("email", "==", targetEmail));
      const snap = await getDocs(q);
      if(snap.empty) {
         alert("找不到此信箱對應的使用者");
         return;
      }
      
      const targetUid = snap.docs[0].data().uid;
      // 檢查是否已經封鎖
      if (currentUserInfo?.blockedUsers?.includes(targetUid)) {
         alert("該使用者已經在封鎖名單中");
         setBlockEmailInput("");
         return;
      }
      
      // 更新到封鎖陣列
      await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayUnion(targetUid) });
      setBlockEmailInput("");
      alert("已成功封鎖該使用者");
    } catch(err) {
      console.error("封鎖失敗", err);
    }
  };

  // 💡 解除封鎖功能
  const handleUnblock = async (targetUid) => {
    try {
      await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayRemove(targetUid) });
    } catch(err) {
      console.error("解除封鎖失敗", err);
    }
  };

  if (!showBlockListModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowBlockListModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: nightMode ? '#fff' : '#000' }}>封鎖名單管理</h3>

        {/* 用 Email 封鎖的輸入框 */}
        <form onSubmit={handleBlockByEmail} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            type="email"
            placeholder="輸入 Email 提前封鎖..."
            value={blockEmailInput}
            onChange={e => setBlockEmailInput(e.target.value)}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px',
              border: `1px solid ${nightMode ? '#444' : '#ccc'}`,
              background: nightMode ? '#2c2c2e' : '#f9f9f9',
              color: nightMode ? '#fff' : '#000',
              outline: 'none'
            }}
          />
          <button type="submit" style={{ background: '#ff453a', color: 'white', border: 'none', padding: '0 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            封鎖
          </button>
        </form>

        <div className="menu-label">目前已封鎖的使用者</div>
        
        {/* 封鎖名單列表 */}
        <div className="invite-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {blockedUsersDetails.length === 0 ? (
            <p style={{color: '#8e8e93', textAlign: 'center', margin: '20px 0'}}>目前沒有封鎖任何使用者</p>
          ) : (
            blockedUsersDetails.map(bu => (
              <div key={bu.uid} className="blocked-user-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: bu.avatarConfig?.image ? 'transparent' : (bu.avatarConfig?.bgColor || '#8e8e93'), display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', overflow: 'hidden' }}>
                    {renderAvatar(bu.avatarConfig, bu.displayName || bu.email)}
                  </div>
                  <div>
                    <div style={{color: nightMode ? '#fff' : '#000', fontSize: '14px', fontWeight: '500'}}>{bu.displayName || bu.email.split('@')[0]}</div>
                    <div style={{color: '#8e8e93', fontSize: '11px'}}>{bu.email}</div>
                  </div>
                </div>
                <button className="btn-unblock" onClick={() => handleUnblock(bu.uid)}>解除</button>
              </div>
            ))
          )}
        </div>

        <button onClick={() => setShowBlockListModal(false)} style={{ width: '100%', padding: '10px', marginTop: '15px', background: 'rgba(120,120,128,0.2)', color: nightMode ? '#fff' : '#000', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>關閉</button>
      </div>
    </div>
  );
}