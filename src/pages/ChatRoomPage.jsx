import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, orderBy, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import "./ChatRoom.css";

function ChatRoomPage({ user }) {
  const [showChat, setShowChat] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  const [showSettings, setShowSettings] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [nightMode, setNightMode] = useState(true);

  const scrollRef = useRef();

  // 取得目前選中房間資料
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);

  // 動態決定 Logo 顏色 (沒選聊天室時預設橘色，選了就跟著聊天室主題走)
  const logoColor = activeRoom?.themeColor || "#ff9500";

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    return () => unsubscribe();
  }, [activeRoomId]);

  const handleUpdateRoomTheme = async (color) => {
    try {
      const roomRef = doc(db, "chats", activeRoomId);
      await updateDoc(roomRef, { themeColor: color });
      setShowThemePicker(false);
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoomId) return;
    await addDoc(collection(db, "chats", activeRoomId, "messages"), {
      text: newMessage, senderId: user.uid, senderEmail: user.email, createdAt: serverTimestamp(),
    });
    setNewMessage("");
  };

  const handleAddFriend = async () => {
    const targetEmail = searchInput.trim().toLowerCase();
    if (!targetEmail || targetEmail === user.email?.toLowerCase()) return;
    const qUser = query(collection(db, "users"), where("email", "==", targetEmail));
    const querySnapshot = await getDocs(qUser);
    if (querySnapshot.empty) { alert("找不到使用者"); return; }
    const friendData = querySnapshot.docs[0].data();
    if (chatRooms.find(r => r.participants.includes(friendData.uid))) { alert("已是好友"); return; }
    await addDoc(collection(db, "chats"), {
      participants: [user.uid, friendData.uid],
      participantEmails: [user.email, friendData.email],
      themeColor: "#007aff", // 初始預設藍
      createdAt: serverTimestamp(),
    });
    setSearchInput("");
  };

  return (
    // 最外層綁定 night-mode class，實現全域控色
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`}>
      
      {/* 個人設定 Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '25px', color: nightMode ? '#fff' : '#000' }}>
              App 設定
            </h3>
            
            {/* iOS 風格開關區域 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500', color: nightMode ? '#fff' : '#000' }}>
                夜晚模式
              </span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={nightMode} 
                  onChange={e => setNightMode(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ borderTop: nightMode ? '1px solid #333' : '1px solid #eee', paddingTop: '20px' }}>
              <button 
                onClick={() => signOut(auth)} 
                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'transparent', color: '#ff453a', border: '1px solid #ff453a', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
              >
                登出帳號
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 左側列表 */}
      <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
        <div className="sidebar-header">
          {/* Logo 顏色隨聊天室動態變化 */}
          <h3 style={{ margin: 0, color: logoColor, transition: 'color 0.3s ease' }}>
            Messages
          </h3>
          <div className="profile-icon" onClick={() => setShowSettings(true)}>
            {user.photoURL ? <img src={user.photoURL} alt="profile" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '20px'}}>👤</span>}
          </div>
        </div>

        <div className="search-bar">
          <input type="email" placeholder="搜尋 Email 新增好友..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleAddFriend} style={{background: 'transparent', border: 'none', color: logoColor, fontSize: '24px', cursor: 'pointer'}}>+</button>
        </div>

        <div className="friend-list">
          {chatRooms.map(room => {
            const friendEmail = room.participantEmails.find(e => e !== user.email);
            return (
              <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`}
                onClick={() => { setActiveRoomId(room.id); setShowChat(true); }}>
                <div className="avatar" style={{ backgroundColor: room.themeColor || "#007aff" }}>
                  {friendEmail?.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <h4>{friendEmail?.split('@')[0]}</h4>
                  <p>點擊開始對話</p>
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
                <button className="btn-back mobile-only" onClick={() => setShowChat(false)} style={{ color: activeRoom.themeColor }}>&lt; 返回</button>
                <h3 style={{ margin: 0, color: nightMode ? "#ffffff" : "#000000" }}>
                  {activeRoom.participantEmails.find(e => e !== user.email).split('@')[0]}
                </h3>
              </div>
              
              {/* 三點選單 */}
              <div style={{ position: 'relative' }}>
                <button className="btn-more" onClick={() => setShowThemePicker(!showThemePicker)}>⋯</button>
                {showThemePicker && (
                  <div className="theme-popover">
                    {["#007aff", "#c4001a", "#34c759", "#af52de", "#ff9500"].map(c => (
                      <div key={c} className="theme-dot" style={{ background: c }} 
                        onClick={() => handleUpdateRoomTheme(c)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="message-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.senderId === user.uid ? "sent" : "received"}`}
                  style={msg.senderId === user.uid ? { backgroundColor: activeRoom.themeColor } : {}}>
                  <p style={{ margin: 0 }}>{msg.text}</p>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input type="text" placeholder="iMessage" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              <button type="submit" className="btn-send" style={{ color: activeRoom.themeColor }}>送出</button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#666" }}>
            <p>請選擇左側好友開始聊天</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatRoomPage;