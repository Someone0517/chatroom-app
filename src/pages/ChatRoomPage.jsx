import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { 
  collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, orderBy 
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import "./ChatRoom.css";

function ChatRoomPage({ user }) {
  const [showChat, setShowChat] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null); // 當前選中的房間
  const [messages, setMessages] = useState([]);      // 當前房間的訊息
  const [newMessage, setNewMessage] = useState("");  // 輸入框文字
  
  const scrollRef = useRef(); // 用來讓訊息自動滾動到底部

  // 1. 監聽聊天室列表
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatRooms(rooms);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. 監聽特定房間的訊息 (當 activeRoom 改變時觸發)
  useEffect(() => {
    if (!activeRoom) return;

    // 進入該房間下的 messages 子集合，並按時間排序
    const msgsRef = collection(db, "chats", activeRoom.id, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      // 稍等一下讓 DOM 渲染後滾動到底部
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [activeRoom]);

  // 3. 發送訊息邏輯
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom) return;

    try {
      const msgsRef = collection(db, "chats", activeRoom.id, "messages");
      await addDoc(msgsRef, {
        text: newMessage,
        senderId: user.uid,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
      });
      setNewMessage(""); // 清空輸入框
    } catch (error) {
      console.error("傳送失敗：", error);
    }
  };

  // 4. 新增好友 (維持原本邏輯)
  const handleAddFriend = async () => {
    const targetEmail = searchInput.trim().toLowerCase();
    if (!targetEmail || targetEmail === user.email.toLowerCase()) return;
    try {
      const qUser = query(collection(db, "users"), where("email", "==", targetEmail));
      const querySnapshot = await getDocs(qUser);
      if (querySnapshot.empty) { alert("找不到使用者"); return; }
      const friendData = querySnapshot.docs[0].data();
      if (chatRooms.find(r => r.participants.includes(friendData.uid))) { alert("已是好友"); return; }
      
      await addDoc(collection(db, "chats"), {
        participants: [user.uid, friendData.uid],
        participantEmails: [user.email, friendData.email],
        createdAt: serverTimestamp(),
      });
      setSearchInput("");
    } catch (error) { console.error(error); }
  };

  return (
    <div className="chatroom-container">
      {/* 左側列表 */}
      <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
        <div className="sidebar-header">
          <h3 style={{ color: "#007aff" }}>Messages</h3>
          <button onClick={() => signOut(auth)} className="btn-logout" style={{ backgroundColor: "#333" }}>登出</button>
        </div>
        <div className="search-bar">
          <input type="email" placeholder="搜尋 Email 新增好友" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleAddFriend}>+</button>
        </div>
        <div className="friend-list">
          {chatRooms.map(room => {
            const friendEmail = room.participantEmails.find(e => e !== user.email);
            return (
              <div key={room.id} 
                className={`friend-item ${activeRoom?.id === room.id ? "active" : ""}`}
                onClick={() => { setActiveRoom(room); setShowChat(true); }}
              >
                <div className="avatar">{friendEmail?.charAt(0).toUpperCase()}</div>
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
              <button className="btn-back mobile-only" onClick={() => setShowChat(false)}>&lt; 返回</button>
              <h3>{activeRoom.participantEmails.find(e => e !== user.email).split('@')[0]}</h3>
            </div>
            <div className="message-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.senderId === user.uid ? "sent" : "received"}`}>
                  <p>{msg.text}</p>
                </div>
              ))}
              <div ref={scrollRef} /> {/* 滾動錨點 */}
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input type="text" placeholder="iMessage" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              <button type="submit" className="btn-send">送出</button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <p>請選擇左側好友開始聊天</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatRoomPage;