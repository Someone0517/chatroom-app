import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { 
  collection, query, where, getDocs, addDoc, onSnapshot, 
  serverTimestamp, orderBy, doc, updateDoc, deleteDoc, 
  increment, arrayUnion, setDoc, arrayRemove 
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import "./ChatRoom.css";

function ChatRoomPage({ user }) {
  const [showChat, setShowChat] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [roomMembersInfo, setRoomMembersInfo] = useState([]);

  const [showSettings, setShowSettings] = useState(false);
  const [personalId, setPersonalId] = useState(""); 
  const [displayName, setDisplayName] = useState("");
  const [nightMode, setNightMode] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [contextMenuMsgId, setContextMenuMsgId] = useState(null);

  const scrollRef = useRef();
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const logoColor = activeRoom?.themeColor || "#ff9500";

  // 1. 初始化資料與監聽房間
  useEffect(() => {
    if (!user) return;
    const fetchUser = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setPersonalId(data.personalId || "");
        setDisplayName(data.displayName || user.email.split('@')[0]);
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

  // 2. 監聽訊息與自動已讀
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

  // 3. 抓取目前聊天室成員詳細資料
  useEffect(() => {
    if (!activeRoom) return;
    const fetchMembers = async () => {
      const members = await Promise.all(
        activeRoom.participants.map(async (pid) => {
          const snap = await getDocs(query(collection(db, "users"), where("uid", "==", pid)));
          return snap.docs[0]?.data();
        })
      );
      setRoomMembersInfo(members.filter(Boolean));
    };
    fetchMembers();
  }, [activeRoom]);

  // --- 核心邏輯 ---

  // 新增聊天室邏輯
  const handleAddChat = async () => {
    const input = searchInput.trim().toLowerCase();
    if (!input || input === user.email?.toLowerCase() || input === personalId) return;

    try {
      // 檢查是否為 8 位數群組 ID
      if (/^\d{8}$/.test(input)) {
        const qGroup = query(collection(db, "chats"), where("groupId", "==", input));
        const groupSnap = await getDocs(qGroup);
        if (!groupSnap.empty) {
          const roomId = groupSnap.docs[0].id;
          await updateDoc(doc(db, "chats", roomId), {
            participants: arrayUnion(user.uid),
            participantEmails: arrayUnion(user.email),
            [`unreadCount.${user.uid}`]: 0
          });
          setActiveRoomId(roomId);
          setSearchInput("");
          return;
        }
      }

      // 一般使用者搜尋 (Email 或 個人 ID)
      const qEmail = query(collection(db, "users"), where("email", "==", input));
      const qId = query(collection(db, "users"), where("personalId", "==", input));
      const [snapE, snapI] = await Promise.all([getDocs(qEmail), getDocs(qId)]);
      const targetDoc = snapE.docs[0] || snapI.docs[0];

      if (!targetDoc) { alert("找不到該使用者"); return; }
      const targetData = targetDoc.data();

      // 建立全新的一對一聊天室
      const newRoom = await addDoc(collection(db, "chats"), {
        participants: [user.uid, targetData.uid],
        participantEmails: [user.email, targetData.email],
        themeColor: "#007aff",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: "private",
        unreadCount: { [user.uid]: 0, [targetData.uid]: 0 },
        lastReadTime: { [user.uid]: serverTimestamp(), [targetData.uid]: serverTimestamp() }
      });
      setActiveRoomId(newRoom.id);
      setSearchInput("");
    } catch (e) { console.error(e); }
  };

  // 建立全新群組（不變更原聊天室）
  const handleCreateNewGroup = async () => {
    if (activeRoom.type === "group") return;
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const groupName = prompt("請輸入新群組名稱：", "新群組");
    if (!groupName) return;

    try {
      const newGroup = await addDoc(collection(db, "chats"), {
        type: "group",
        groupId: randomId,
        groupName: groupName,
        participants: activeRoom.participants, // 初始包含目前對話的兩個人
        participantEmails: activeRoom.participantEmails,
        themeColor: "#007aff",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadCount: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {}),
        lastReadTime: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: serverTimestamp() }), {})
      });
      setActiveRoomId(newGroup.id);
      setShowThemePicker(false);
      alert(`全新群組已建立！群組 ID: ${randomId}\n原有私訊已保留。`);
    } catch (e) { console.error(e); }
  };

  // 群組成員互加好友
  const handleAddFriendFromList = async (target) => {
    if (target.uid === user.uid) return;
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
        senderName: myName,
        createdAt: serverTimestamp()
      });
      alert("已發送私訊請求！");
    } catch (e) { console.error(e); }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate(), n = new Date(), diff = (n - d) / 60000;
    if (diff < 60 && diff >= 0) return diff < 1 ? "剛剛" : `${Math.floor(diff)}分鐘前`;
    if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`}>
      {/* 設定 Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>個人設定</h3>
            <div className="id-setting-group">
              <label className="menu-label">個人 ID</label>
              <div className="id-input-wrapper"><input value={personalId} onChange={e => setPersonalId(e.target.value)} /></div>
            </div>
            <div className="id-setting-group">
              <label className="menu-label">暱稱</label>
              <div className="id-input-wrapper"><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
              <span>夜晚模式</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={nightMode} onChange={e => setNightMode(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <button onClick={async () => {
              await setDoc(doc(db, "users", user.uid), { displayName, personalId, uid: user.uid, email: user.email }, { merge: true });
              setShowSettings(false);
            }} style={{ width: '100%', padding: '12px', background: logoColor, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>儲存設定</button>
          </div>
        </div>
      )}

      {/* 左側列表 */}
      <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
        <div className="sidebar-header">
          <h3 style={{ color: logoColor }}>Messages</h3>
          <div className="profile-icon" onClick={() => setShowSettings(true)}>
            {user.photoURL ? <img src={user.photoURL} alt="p" style={{width:'100%'}} /> : "👤"}
          </div>
        </div>
        <div className="search-bar">
          <input placeholder="搜尋 ID, Email 或群組 ID..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleAddChat} style={{ color: logoColor, background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>+</button>
        </div>
        <div className="friend-list">
          {chatRooms.map(room => {
            const isG = room.type === "group";
            const title = isG ? (room.groupName || "群組") : room.participantEmails.find(e => e !== user.email).split('@')[0];
            return (
              <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`} onClick={() => { setActiveRoomId(room.id); setShowChat(true); }}>
                <div className="avatar" style={{ backgroundColor: room.themeColor || "#007aff" }}>{isG ? "👥" : title.charAt(0).toUpperCase()}</div>
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
                <button className="mobile-only" onClick={() => setShowChat(false)} style={{ color: activeRoom.themeColor }}>&lt; 返回</button>
                <h3 style={{ margin: 0, color: nightMode ? "white" : "black" }}>
                  {activeRoom.type === "group" ? (activeRoom.groupName || "群組") : activeRoom.participantEmails.find(e => e !== user.email).split('@')[0]}
                </h3>
              </div>
              <div style={{ position: 'relative' }}>
                <button className="btn-more" onClick={() => setShowThemePicker(!showThemePicker)}>⋯</button>
                {showThemePicker && (
                  <div className="theme-popover">
                    {activeRoom.type === "group" ? (
                      <>
                        <div className="menu-section">
                          <button onClick={() => updateDoc(doc(db, "chats", activeRoomId), { groupName: prompt("新名稱：") })}>更改群組名稱</button>
                          <button onClick={async () => {
                            await updateDoc(doc(db, "chats", activeRoomId), { participants: arrayRemove(user.uid), participantEmails: arrayRemove(user.email) });
                            setActiveRoomId(null);
                          }} style={{ color: '#ff453a' }}>退出群組</button>
                        </div>
                        <div className="menu-section">
                          <label className="menu-label">成員清單 ({roomMembersInfo.length})</label>
                          {roomMembersInfo.map(m => (
                            <div key={m.uid} className="member-item">
                              <div className="member-info">
                                <span className="member-name">{m.displayName || m.email.split('@')[0]}</span>
                                <span className="member-email">{m.email}</span>
                              </div>
                              {m.uid !== user.uid && <button className="btn-add-member" onClick={() => handleAddFriendFromList(m)}>+</button>}
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
                            <div style={{fontSize:'12px', marginBottom:'4px'}}>Email: {activeRoom.participantEmails.find(e => e !== user.email)}</div>
                            <div style={{fontSize:'12px'}}>加入時間: {activeRoom.createdAt?.toDate().toLocaleDateString()}</div>
                          </div>
                          <button onClick={handleCreateNewGroup} style={{ width: '100%', padding: '10px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>發起群組聊天</button>
                        </div>
                        <button style={{ color: '#ff453a', background: 'none', border: '1px solid #ff453a', padding: '8px', borderRadius: '8px', marginBottom: '5px' }} onClick={() => alert("功能預留：刪除用戶")}>刪除該用戶</button>
                        <button style={{ color: '#ff453a', background: 'none', border: '1px solid #ff453a', padding: '8px', borderRadius: '8px' }} onClick={() => alert("功能預留：封鎖用戶")}>封鎖該用戶</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="message-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message-with-avatar ${msg.senderId === user.uid ? "sent" : "received"}`}>
                  <div className="avatar-container">
                    <div className="msg-avatar">{msg.senderName?.charAt(0).toUpperCase()}</div>
                    {msg.senderName && <span className="avatar-subtext">{msg.senderName}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.senderId === user.uid ? "flex-end" : "flex-start" }}>
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
              ))}
              <div ref={scrollRef} />
            </div>

            <form className="chat-input-area" onSubmit={async (e) => {
              e.preventDefault();
              if (!newMessage.trim()) return;
              const txt = newMessage; setNewMessage("");
              await addDoc(collection(db, "chats", activeRoomId, "messages"), {
                text: txt, senderId: user.uid, senderName: displayName, createdAt: serverTimestamp()
              });
              const up = { lastMessageText: txt, updatedAt: serverTimestamp() };
              activeRoom.participants.forEach(p => { if (p !== user.uid) up[`unreadCount.${p}`] = increment(1); });
              updateDoc(doc(db, "chats", activeRoomId), up);
            }}>
              <input placeholder="iMessage" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              <button type="submit" className="btn-send" style={{ color: activeRoom.themeColor }}>送出</button>
            </form>
          </>
        ) : <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#666" }}>選擇聊天室開始對話</div>}
      </div>
    </div>
  );
}

export default ChatRoomPage;