import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { 
  collection, query, where, getDocs, addDoc, onSnapshot, 
  serverTimestamp, orderBy, doc, updateDoc, deleteDoc, 
  increment, arrayUnion, setDoc, arrayRemove 
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import "./ChatRoom.css";

const PRESET_EMOJIS = [
  "😀","😂","🥰","😍","😎","🤩","🤔","🤫","🙄","😴","🤤","😷",
  "🥳","🤓","🥺","😭","😱","😡","🤡","👽","👻","🤖","💩","💖","🔥","✨","🌟","💯"
];

function ChatRoomPage({ user }) {
  const [showChat, setShowChat] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(""); 
  const [roomMembersInfo, setRoomMembersInfo] = useState([]);

  // Modal 狀態控制
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [contextMenuMsgId, setContextMenuMsgId] = useState(null);

  // 用戶資料狀態
  const [personalId, setPersonalId] = useState(""); 
  const [displayName, setDisplayName] = useState("");
  const [nightMode, setNightMode] = useState(true);
  
  // 頭像組合狀態
  const [avatarBgColor, setAvatarBgColor] = useState("#8e8e93");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [avatarImage, setAvatarImage] = useState(""); 

  const scrollRef = useRef();
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const logoColor = activeRoom?.themeColor || "#ff9500";

  const presetColors = ["#007aff", "#34c759", "#ff9500", "#ff453a", "#af52de"];

  const myFriends = chatRooms
    .filter(r => r.type === "private" || (!r.type && r.participants.length === 2))
    .map(r => ({
      uid: r.participants.find(uid => uid !== user.uid),
      email: r.participantEmails.find(email => email !== user.email)
    }))
    .filter(f => f.uid && f.email); 

  useEffect(() => {
    if (!user) return;
    const fetchUser = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setPersonalId(data.personalId || "");
        setDisplayName(data.displayName || user.email.split('@')[0]);
        if (data.avatarConfig) {
          setAvatarBgColor(data.avatarConfig.bgColor || "#8e8e93");
          setAvatarEmoji(data.avatarConfig.emoji || "");
          setAvatarImage(data.avatarConfig.image || "");
        } else if (user.photoURL) {
          setAvatarImage(user.photoURL);
        }
      }
    };
    fetchUser();

    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rooms.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChatRooms(rooms);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeRoomId) return;
    const msgsRef = collection(db, "chats", activeRoomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    updateDoc(doc(db, "chats", activeRoomId), {
      [`unreadCount.${user.uid}`]: 0,
      [`lastReadTime.${user.uid}`]: serverTimestamp()
    });
    return () => unsubscribe();
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoom || !activeRoom.participants) return;
    const unsubscribes = activeRoom.participants.map(pid => {
      const userRef = doc(db, "users", pid);
      return onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setRoomMembersInfo(prev => {
            const updated = prev.filter(p => p.uid !== pid);
            return [...updated, docSnap.data()];
          });
        }
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [activeRoomId, activeRoom?.participants]);

  // --- 核心邏輯 ---

  // 💡 全新修復：圖片前端壓縮引擎
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // 使用 Canvas 進行影像壓縮
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 150; // 強制最大寬高為 150px
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // 將圖片轉為高品質 (0.7) 的小容量 JPEG Base64
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        
        setAvatarImage(compressedBase64); 
        setAvatarEmoji(""); 
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    const config = { bgColor: avatarBgColor, emoji: avatarImage ? "" : avatarEmoji, image: avatarImage };
    await setDoc(doc(db, "users", user.uid), { 
      displayName, personalId, uid: user.uid, email: user.email, avatarConfig: config
    }, { merge: true });
    setShowSettings(false);
    setShowAvatarPicker(false);
    setShowEmojiMenu(false);
  };

  const handleAddChat = async () => {
    const input = searchInput.trim().toLowerCase();
    if (!input || input === user.email?.toLowerCase() || input === personalId) return;
    try {
      if (/^\d{8}$/.test(input)) {
        const qGroup = query(collection(db, "chats"), where("groupId", "==", input));
        const groupSnap = await getDocs(qGroup);
        if (!groupSnap.empty) {
          const roomId = groupSnap.docs[0].id;
          await updateDoc(doc(db, "chats", roomId), {
            participants: arrayUnion(user.uid), participantEmails: arrayUnion(user.email), [`unreadCount.${user.uid}`]: 0
          });
          setActiveRoomId(roomId);
          setSearchInput("");
          return;
        }
      }
      const qEmail = query(collection(db, "users"), where("email", "==", input));
      const qId = query(collection(db, "users"), where("personalId", "==", input));
      const [snapE, snapI] = await Promise.all([getDocs(qEmail), getDocs(qId)]);
      const targetDoc = snapE.docs[0] || snapI.docs[0];
      if (!targetDoc) { alert("找不到該使用者"); return; }
      const targetData = targetDoc.data();

      const newRoom = await addDoc(collection(db, "chats"), {
        participants: [user.uid, targetData.uid], participantEmails: [user.email, targetData.email],
        themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), type: "private",
        unreadCount: { [user.uid]: 0, [targetData.uid]: 0 }, lastReadTime: { [user.uid]: serverTimestamp(), [targetData.uid]: serverTimestamp() }
      });
      setActiveRoomId(newRoom.id);
      setSearchInput("");
    } catch (e) { console.error(e); }
  };

  const handleCreateNewGroup = async () => {
    if (activeRoom.type === "group") return;
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const groupName = prompt("請輸入新群組名稱：", "新群組");
    if (!groupName) return;
    try {
      const newGroup = await addDoc(collection(db, "chats"), {
        type: "group", groupId: randomId, groupName: groupName,
        participants: activeRoom.participants, participantEmails: activeRoom.participantEmails,
        themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        unreadCount: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {}),
        lastReadTime: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: serverTimestamp() }), {})
      });
      setActiveRoomId(newGroup.id);
      setShowThemePicker(false);
      alert(`全新群組已建立！群組 ID: ${randomId}\n原有私訊已保留。`);
    } catch (e) { console.error(e); }
  };

  const handleInviteFriendToGroup = async (friend) => {
    if (activeRoom.participants.includes(friend.uid)) return;
    try {
      await updateDoc(doc(db, "chats", activeRoomId), {
        participants: arrayUnion(friend.uid), participantEmails: arrayUnion(friend.email),
        [`unreadCount.${friend.uid}`]: 0, [`lastReadTime.${friend.uid}`]: serverTimestamp(), updatedAt: serverTimestamp()
      });
      alert(`已邀請 ${friend.email.split('@')[0]} 加入群組！`);
    } catch (e) { console.error(e); }
  };

  const handleAddFriendFromList = async (target) => {
    if (target.uid === user.uid) return;

    const existingRoom = chatRooms.find(r => 
      (r.type === "private" || (!r.type && r.participants.length === 2)) && 
      r.participants.includes(target.uid)
    );

    if (existingRoom) {
      alert("你們已經是好友囉！");
      return;
    }

    try {
      const newRoom = await addDoc(collection(db, "chats"), {
        participants: [user.uid, target.uid], 
        participantEmails: [user.email, target.email],
        themeColor: "#007aff", 
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp(),
        type: "private", 
        unreadCount: { [user.uid]: 0, [target.uid]: 0 }
      });
      
      const myName = displayName || user.email.split('@')[0];
      const gName = activeRoom.groupName || "群組";
      
      await addDoc(collection(db, "chats", newRoom.id, "messages"), {
        text: `我是來自 ${gName} 的 ${myName}`, 
        senderId: user.uid, 
        createdAt: serverTimestamp() 
      });
      
      alert("已發送私訊請求！");
      // 💡 這裡移除了 setActiveRoomId，所以不會再自動切換畫面
    } catch (e) { 
      console.error(e); 
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate(), n = new Date(), diff = (n - d) / 60000;
    if (diff < 60 && diff >= 0) return diff < 1 ? "剛剛" : `${Math.floor(diff)}分鐘前`;
    if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoomId) return;
    const txt = newMessage; setNewMessage(""); 
    try {
        await addDoc(collection(db, "chats", activeRoomId, "messages"), {
            text: txt, senderId: user.uid, createdAt: serverTimestamp()
        });
        const up = { lastMessageText: txt, updatedAt: serverTimestamp() };
        activeRoom.participants.forEach(p => { if (p !== user.uid) up[`unreadCount.${p}`] = increment(1); });
        await updateDoc(doc(db, "chats", activeRoomId), up);
    } catch(err) { console.error("發送訊息錯誤:", err); }
  };

  const renderAvatar = (config, fallbackName) => {
    if (config?.image) return <img src={config.image} style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    if (config?.emoji) return <span style={{fontSize:'18px'}}>{config.emoji}</span>;
    return fallbackName?.charAt(0).toUpperCase() || "👤";
  };

  const getFriendDynamicName = (room) => {
    if (room.type === "group") return room.groupName || "群組";
    const friendUid = room.participants.find(uid => uid !== user.uid);
    const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
    if (friendInfo && friendInfo.displayName) return friendInfo.displayName;
    const friendEmail = room.participantEmails.find(e => e !== user.email);
    return friendEmail ? friendEmail.split('@')[0] : "未知";
  };

  return (
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`}>
      {/* 個人設定 Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => { setShowSettings(false); setShowAvatarPicker(false); setShowEmojiMenu(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {!showAvatarPicker ? (
              <>
                <h3 style={{ marginTop: 0, color: nightMode ? '#fff' : '#000', textAlign: 'center' }}>個人設定</h3>
                <div className="profile-header-box">
                  <div className="profile-avatar-wrapper">
                    <div className="profile-avatar-display" style={{backgroundColor: avatarImage ? "transparent" : avatarBgColor}}>
                      {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
                    </div>
                    <div className="btn-edit-avatar" onClick={() => setShowAvatarPicker(true)}>+</div>
                  </div>
                  <span className="profile-email-text">{user.email}</span>
                </div>
                <div className="id-setting-group">
                  <label className="menu-label" style={{paddingLeft:0}}>個人 ID</label>
                  <div className="id-input-wrapper"><input value={personalId} onChange={e => setPersonalId(e.target.value)} /></div>
                </div>
                <div className="id-setting-group">
                  <label className="menu-label" style={{paddingLeft:0}}>暱稱</label>
                  <div className="id-input-wrapper"><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
                  <span style={{ color: nightMode ? '#fff' : '#000' }}>夜晚模式</span>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={nightMode} onChange={e => setNightMode(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
                <button onClick={handleSaveProfile} style={{ width: '100%', padding: '12px', background: logoColor, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>儲存設定</button>
                <button onClick={() => signOut(auth)} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ff453a', border: '1px solid #ff453a', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>登出帳號</button>
              </>
            ) : (
              <div className="avatar-picker-modal">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                  <button onClick={() => { setShowAvatarPicker(false); setShowEmojiMenu(false); }} style={{ background:'none', border:'none', color: '#0a84ff', cursor:'pointer', fontSize:'16px' }}>&lt; 返回</button>
                  <h4 style={{ margin: '0 auto', color: nightMode ? '#fff' : '#000', paddingRight: '40px' }}>更改大頭貼</h4>
                </div>
                <div className="profile-avatar-wrapper" style={{ margin: '0 auto 25px auto' }}>
                  <div className="profile-avatar-display" style={{backgroundColor: avatarImage ? "transparent" : avatarBgColor}}>
                     {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
                  </div>
                </div>
                <label className="menu-label" style={{textAlign:'center'}}>選擇背景色</label>
                <div className="color-picker-grid">
                  {presetColors.map(c => (
                    <div key={c} className={`color-dot ${avatarBgColor === c && !avatarImage ? 'active' : ''}`} style={{background: c}} onClick={() => { setAvatarBgColor(c); setAvatarImage(""); }} />
                  ))}
                </div>
                
                <label className="menu-label" style={{textAlign:'center', marginTop:'15px'}}>自訂內容</label>
                <div className="emoji-upload-row">
                  <div className="action-btn-circle" onClick={() => setShowEmojiMenu(!showEmojiMenu)}>😀</div>
                  <label className="action-btn-circle" style={{color: '#0a84ff'}}>+<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} /></label>
                </div>

                {showEmojiMenu && (
                  <div className="emoji-picker-menu">
                    {PRESET_EMOJIS.map(emoji => (
                      <span key={emoji} className="emoji-item" onClick={() => {
                        setAvatarEmoji(emoji);
                        setAvatarImage("");
                        setShowEmojiMenu(false);
                      }}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 邀請好友 Modal */}
      {showInviteModal && activeRoom?.type === "group" && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: nightMode ? '#fff' : '#000' }}>邀請好友加入群組</h3>
            <div className="invite-list">
              {myFriends.filter(f => !activeRoom.participants.includes(f.uid)).length === 0 ? (
                <p style={{color: '#8e8e93', textAlign: 'center', margin: '20px 0'}}>沒有可邀請的好友</p>
              ) : (
                myFriends.filter(f => !activeRoom.participants.includes(f.uid)).map(friend => (
                  <div key={friend.uid} className="invite-item">
                    <div>
                      <div style={{color: nightMode ? '#fff' : '#000', fontSize: '14px'}}>{friend.email.split('@')[0]}</div>
                      <div style={{color: '#8e8e93', fontSize: '11px'}}>{friend.email}</div>
                    </div>
                    <button onClick={() => handleInviteFriendToGroup(friend)} style={{ background: '#0a84ff', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'}}>邀請</button>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowInviteModal(false)} style={{ width: '100%', padding: '10px', marginTop: '15px', background: 'rgba(120,120,128,0.2)', color: nightMode ? '#fff' : '#000', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>關閉</button>
          </div>
        </div>
      )}

      {/* 左側列表 */}
      <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
        <div className="sidebar-header">
          <h3 style={{ margin: 0, color: logoColor, transition: 'color 0.3s ease' }}>Messages</h3>
          <div className="profile-icon" onClick={() => setShowSettings(true)}>
             {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
          </div>
        </div>
        <div className="search-bar">
          <input placeholder="搜尋 ID, Email 或群組 ID..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleAddChat} style={{ color: logoColor, background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>+</button>
        </div>
        <div className="friend-list">
          {chatRooms.map(room => {
            const title = getFriendDynamicName(room);
            const isG = room.type === "group";
            const friendUid = room.participants.find(uid => uid !== user.uid);
            const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
            const friendAvatarConfig = friendInfo ? friendInfo.avatarConfig : null;

            return (
              <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`} onClick={() => { setActiveRoomId(room.id); setShowChat(true); setShowThemePicker(false); }}>
                <div className="avatar" style={{ backgroundColor: friendAvatarConfig?.image ? "transparent" : (friendAvatarConfig?.bgColor || room.themeColor || "#007aff") }}>
                  {isG ? "👥" : renderAvatar(friendAvatarConfig, title)}
                </div>
                <div className="friend-info">
                  <div className="friend-info-header">
                    <h4>{title}</h4>
                    {room.unreadCount?.[user.uid] > 0 && <span className="unread-badge">{room.unreadCount[user.uid]}</span>}
                  </div>
                  <p className="friend-preview">{room.lastMessageText || "點擊開始對話"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右側對話區 */}
      <div className={`chat-area ${!showChat ? "hide-on-mobile" : ""}`}>
        {activeRoom ? (
          <>
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mobile-only" onClick={() => setShowChat(false)} style={{ color: activeRoom.themeColor, border: 'none', background: 'transparent', fontSize: '16px' }}>&lt; 返回</button>
                <h3 style={{ margin: 0, color: nightMode ? "white" : "black" }}>{getFriendDynamicName(activeRoom)}</h3>
              </div>
              <div style={{ position: 'relative' }}>
                <button className="btn-more" onClick={() => setShowThemePicker(!showThemePicker)}>⋯</button>
                {showThemePicker && (
                  <div className="theme-popover">
                    {activeRoom.type === "group" ? (
                      <>
                        <div className="menu-section">
                          <button className="popover-btn primary" onClick={() => { setShowInviteModal(true); setShowThemePicker(false); }}>+ 邀請目前好友</button>
                          <button className="popover-btn" onClick={() => updateDoc(doc(db, "chats", activeRoomId), { groupName: prompt("新名稱：", activeRoom.groupName || "") })}>更改群組名稱</button>
                          <button className="popover-btn danger" onClick={async () => {
                            await updateDoc(doc(db, "chats", activeRoomId), { participants: arrayRemove(user.uid), participantEmails: arrayRemove(user.email) });
                            setActiveRoomId(null);
                          }}>退出群組</button>
                        </div>
                        <div className="menu-section" style={{ borderBottom: 'none' }}>
                          <label className="menu-label">成員清單 ({roomMembersInfo.length})</label>
                          {roomMembersInfo.map(m => (
                            <div key={m.uid} className="member-item">
                              <div className="member-info">
                                <span className="member-name">{m.displayName || m.email.split('@')[0]}</span>
                                <span className="member-email">{m.email}</span>
                              </div>
                              {m.uid !== user.uid && !myFriends.some(f => f.uid === m.uid) && (
                              <button className="btn-add-member" title="新增為好友" onClick={() => handleAddFriendFromList(m)}>+</button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="group-id-footer">群組 ID: {activeRoom.groupId}</div>
                      </>
                    ) : (
                      <>
                        <div className="menu-section">
                          <label className="menu-label">好友資訊</label>
                          <div className="friend-detail-box">
                            <div style={{fontSize:'12px', marginBottom:'6px', color: nightMode ? '#fff' : '#000'}}>Email: <span style={{color: '#8e8e93'}}>{activeRoom.participantEmails.find(e => e !== user.email)}</span></div>
                            <div style={{fontSize:'12px', color: nightMode ? '#fff' : '#000'}}>加入時間: <span style={{color: '#8e8e93'}}>{activeRoom.createdAt?.toDate().toLocaleDateString()}</span></div>
                          </div>
                          <button className="popover-btn primary" onClick={handleCreateNewGroup}>建立新群組</button>
                        </div>
                        <button className="popover-btn danger" onClick={() => alert("功能預留：刪除用戶")}>刪除該用戶</button>
                        <button className="popover-btn danger" onClick={() => alert("功能預留：封鎖用戶")}>封鎖該用戶</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="message-list">
              {messages.map(msg => {
                const senderInfo = roomMembersInfo.find(m => m.uid === msg.senderId);
                let fallbackName = "未知";
                const pIndex = activeRoom.participants.indexOf(msg.senderId);
                if (pIndex !== -1 && activeRoom.participantEmails[pIndex]) {
                  fallbackName = activeRoom.participantEmails[pIndex].split('@')[0];
                }
                
                const currentName = senderInfo?.displayName || fallbackName;
                const currentAvatarConfig = senderInfo?.avatarConfig || null;

                return (
                  <div key={msg.id} className={`message-with-avatar ${msg.senderId === user.uid ? "sent" : "received"}`}>
                    <div className="avatar-container">
                      <div className="msg-avatar" style={{backgroundColor: currentAvatarConfig?.image ? "transparent" : (currentAvatarConfig?.bgColor || "#007aff")}}>
                         {renderAvatar(currentAvatarConfig, currentName)}
                      </div>
                      <span className="avatar-subtext">{currentName}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: msg.senderId === user.uid ? "flex-end" : "flex-start", position: "relative" }}>
                      <div className={`message ${msg.senderId === user.uid ? "sent" : "received"}`}
                        style={msg.senderId === user.uid ? { backgroundColor: activeRoom.themeColor } : {}}
                        onDoubleClick={() => msg.senderId === user.uid && setContextMenuMsgId(msg.id)}>
                        <p style={{ margin: 0 }}>{msg.text}</p>
                      </div>
                      <span className="message-time">{formatTime(msg.createdAt)}</span>
                      {contextMenuMsgId === msg.id && (
                        <div className="message-context-menu">
                          <button className="danger" onClick={() => deleteDoc(doc(db, "chats", activeRoomId, "messages", msg.id))}>收回訊息</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={scrollRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input placeholder="iMessage" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              <button type="submit" className="btn-send" style={{ color: activeRoom.themeColor, background: 'none', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>送出</button>
            </form>
          </>
        ) : <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#8e8e93" }}>選擇聊天室開始對話</div>}
      </div>
    </div>
  );
}

export default ChatRoomPage;