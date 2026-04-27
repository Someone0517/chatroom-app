import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, increment } from "firebase/firestore";
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

  const [contextMenuMsgId, setContextMenuMsgId] = useState(null);

  const scrollRef = useRef();
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const logoColor = activeRoom?.themeColor || "#ff9500";

  // 1. 監聽聊天室列表
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rooms.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChatRooms(rooms);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. 監聽特定房間訊息
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

  // 3. 進入聊天室或收到新訊息時，自動將自己的未讀歸零，並更新最後閱讀時間
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const clearUnread = async () => {
      try {
        await updateDoc(doc(db, "chats", activeRoomId), {
          [`unreadCount.${user.uid}`]: 0,
          [`lastReadTime.${user.uid}`]: serverTimestamp()
        });
      } catch (e) { console.error("更新已讀狀態失敗", e); }
    };
    clearUnread();
  }, [activeRoomId, messages.length, user]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenuMsgId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleUpdateRoomTheme = async (color) => {
    try {
      await updateDoc(doc(db, "chats", activeRoomId), { themeColor: color });
      setShowThemePicker(false);
    } catch (e) { console.error(e); }
  };

  // 4. 發送訊息 (同步增加對方的未讀數量)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoomId) return;
    
    const msgText = newMessage;
    setNewMessage("");

    try {
      // 找出對方的 UID
      const receiverUid = activeRoom.participants.find(uid => uid !== user.uid);

      await addDoc(collection(db, "chats", activeRoomId, "messages"), {
        text: msgText, 
        senderId: user.uid, 
        senderEmail: user.email, 
        createdAt: serverTimestamp(),
      });

      // 更新房間資訊：最後訊息、時間、並利用 increment(1) 增加對方的未讀數字
      await updateDoc(doc(db, "chats", activeRoomId), {
        lastMessageText: msgText,
        updatedAt: serverTimestamp(),
        [`unreadCount.${receiverUid}`]: increment(1)
      });
    } catch (e) { console.error(e); }
  };

  const handleDeleteForEveryone = async (msgId) => {
    try {
      await deleteDoc(doc(db, "chats", activeRoomId, "messages", msgId));
      setContextMenuMsgId(null);
    } catch (error) { console.error("刪除失敗：", error); }
  };

  const handleDeleteForMe = () => {
    // 未來實作
    alert("「對自己刪除」功能較複雜，目前為無用按鈕，未來會補上邏輯！");
    setContextMenuMsgId(null);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAddFriend = async () => {
    const targetEmail = searchInput.trim().toLowerCase();
    if (!targetEmail || targetEmail === user.email?.toLowerCase()) return;
    const qUser = query(collection(db, "users"), where("email", "==", targetEmail));
    const querySnapshot = await getDocs(qUser);
    if (querySnapshot.empty) { alert("找不到使用者"); return; }
    const friendData = querySnapshot.docs[0].data();
    if (chatRooms.find(r => r.participants.includes(friendData.uid))) { alert("已是好友"); return; }
    
    // 初始化新房間時，設定雙方的 unreadCount 與 lastReadTime
    await addDoc(collection(db, "chats"), {
      participants: [user.uid, friendData.uid],
      participantEmails: [user.email, friendData.email],
      themeColor: "#007aff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadCount: {
        [user.uid]: 0,
        [friendData.uid]: 0
      },
      lastReadTime: {
        [user.uid]: serverTimestamp(),
        [friendData.uid]: serverTimestamp()
      }
    });
    setSearchInput("");
  };

  return (
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`}>
      {/* 設定 Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '25px', color: nightMode ? '#fff' : '#000' }}>App 設定</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500', color: nightMode ? '#fff' : '#000' }}>夜晚模式</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={nightMode} onChange={e => setNightMode(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div style={{ borderTop: nightMode ? '1px solid #333' : '1px solid #eee', paddingTop: '20px' }}>
              <button onClick={() => signOut(auth)} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'transparent', color: '#ff453a', border: '1px solid #ff453a', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>登出帳號</button>
            </div>
          </div>
        </div>
      )}

      {/* 左側列表 */}
      <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
        <div className="sidebar-header">
          <h3 style={{ margin: 0, color: logoColor, transition: 'color 0.3s ease' }}>Messages</h3>
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
            // 動態取得自己的未讀數量
            const unreadCount = room.unreadCount?.[user.uid] || 0; 

            return (
              <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`}
                onClick={() => { setActiveRoomId(room.id); setShowChat(true); }}>
                <div className="avatar" style={{ backgroundColor: room.themeColor || "#007aff" }}>
                  {friendEmail?.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info" style={{ width: '100%' }}>
                  <div className="friend-info-header">
                    <h4 style={{ color: nightMode ? 'white' : 'black' }}>{friendEmail?.split('@')[0]}</h4>
                    {/* 真實未讀紅點 */}
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                  </div>
                  <div className="friend-preview">
                    <p style={{ color: '#8e8e93' }}>{room.lastMessageText || "點擊開始對話"}</p>
                  </div>
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
              <div style={{ position: 'relative' }}>
                <button className="btn-more" onClick={() => setShowThemePicker(!showThemePicker)}>⋯</button>
                {showThemePicker && (
                  <div className="theme-popover">
                    {["#007aff", "#c4001a", "#34c759", "#af52de", "#ff9500"].map(c => (
                      <div key={c} className="theme-dot" style={{ background: c }} onClick={() => handleUpdateRoomTheme(c)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="message-list">
              {messages.map(msg => {
                // 判斷是否已讀：如果對方的 lastReadTime 大於這則訊息的發送時間，就算已讀
                const receiverUid = activeRoom.participants.find(uid => uid !== user.uid);
                const receiverReadTime = activeRoom.lastReadTime?.[receiverUid]?.toMillis() || 0;
                const msgTime = msg.createdAt?.toMillis() || 0;
                const isRead = msgTime > 0 && msgTime <= receiverReadTime;

                return (
                  <div key={msg.id} className={`message-wrapper ${msg.senderId === user.uid ? "sent" : "received"}`}>
                    
                    {/* 修復：把 received / sent 放到 .message 裡面 */}
                    <div 
                      className={`message ${msg.senderId === user.uid ? "sent" : "received"}`}
                      style={msg.senderId === user.uid ? { backgroundColor: activeRoom.themeColor } : {}}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setContextMenuMsgId(msg.id);
                      }}
                    >
                      <p style={{ margin: 0 }}>{msg.text}</p>
                    </div>

                    <div className="message-time">
                      {formatTime(msg.createdAt)}
                      {/* 如果是我發送的，且對方已讀，就顯示已讀標記 */}
                      {msg.senderId === user.uid && isRead && (
                        <span style={{ marginLeft: '6px', color: activeRoom.themeColor, fontWeight: 'bold' }}>已讀</span>
                      )}
                    </div>

                    {contextMenuMsgId === msg.id && (
                    <div className="message-context-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={handleDeleteForMe}>對自己刪除</button>
    
                    {/* 💡 關鍵修復：只有自己發送的訊息，才渲染「收回訊息」按鈕 */}
                    {msg.senderId === user.uid && (
                    <button className="danger" onClick={() => handleDeleteForEveryone(msg.id)}>收回訊息</button>
                    )}
                    </div>
                )}
                  </div>
                )
              })}
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