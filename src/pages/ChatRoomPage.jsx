import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, increment, arrayUnion, setDoc, arrayRemove } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import "./ChatRoom.css";

import SettingsModal from "../components/SettingsModal";
import InviteModal from "../components/InviteModal";
import Sidebar from "../components/Sidebar";
import UserProfilePopover from "../components/UserProfilePopover";
import BlockListModal from "../components/BlockListModal"; // 💡 引入全新的封鎖名單元件
import { formatTime, renderAvatar, getFriendDynamicName, compressImage } from "../utils/chatHelpers";

const presetColors = ["#007aff", "#34c759", "#ff9500", "#ff453a", "#af52de"];

function ChatRoomPage({ user }) {
  const [showChat, setShowChat] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(""); 
  const [roomMembersInfo, setRoomMembersInfo] = useState([]);
  const [currentUserInfo, setCurrentUserInfo] = useState(null); 

  const [filterMode, setFilterMode] = useState("all"); 
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Modal 狀態
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showBlockListModal, setShowBlockListModal] = useState(false); // 💡 新增控制封鎖名單的狀態
  const [avatarPopover, setAvatarPopover] = useState({ show: false, x: 0, y: 0, user: null, isSelf: false });

  const [personalId, setPersonalId] = useState(""); 
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(""); 
  const [address, setAddress] = useState("");         
  const [nightMode, setNightMode] = useState(true);
  
  const [avatarBgColor, setAvatarBgColor] = useState("#8e8e93");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [avatarImage, setAvatarImage] = useState(""); 

  const [showSearch, setShowSearch] = useState(false);
  const [chatSearchText, setChatSearchText] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);

  const [chatImagePreview, setChatImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [msgMenuId, setMsgMenuId] = useState(null);
  const [editMsgData, setEditMsgData] = useState(null);

  const scrollRef = useRef();
  const msgRefs = useRef({}); 
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const logoColor = activeRoom?.themeColor || "#0a84ff";

  const hasStrangerMsgs = chatRooms.some(r => r.acceptedBy && !r.acceptedBy.includes(user.uid));

  const filteredRooms = chatRooms.filter(room => {
    const isStranger = room.acceptedBy && !room.acceptedBy.includes(user.uid);
    if (filterMode === 'stranger') return isStranger;
    if (isStranger) return false; 
    if (filterMode === 'unread') return room.unreadCount?.[user.uid] > 0;
    return true; 
  });

  const myFriends = chatRooms
    .filter(r => r.type === "private" || (!r.type && r.participants.length === 2))
    .map(r => ({ uid: r.participants.find(uid => uid !== user.uid), email: r.participantEmails.find(email => email !== user.email) }))
    .filter(f => f.uid && f.email); 

  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUserInfo(data);
        setPersonalId(data.personalId || "");
        setDisplayName(data.displayName || user.email.split('@')[0]);
        setPhoneNumber(data.phoneNumber || ""); setAddress(data.address || "");         
        if (data.avatarConfig) {
          setAvatarBgColor(data.avatarConfig.bgColor || "#8e8e93"); setAvatarEmoji(data.avatarConfig.emoji || ""); setAvatarImage(data.avatarConfig.image || "");
        } else if (user.photoURL) { setAvatarImage(user.photoURL); }
      }
    });

    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubChats = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rooms.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChatRooms(rooms);
    });
    return () => { unsubUser(); unsubChats(); };
  }, [user]);

  useEffect(() => {
    if (!activeRoomId) return;
    const q = query(collection(db, "chats", activeRoomId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      if (!showSearch) setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    updateDoc(doc(db, "chats", activeRoomId), { [`unreadCount.${user.uid}`]: 0, [`lastReadTime.${user.uid}`]: serverTimestamp() });
    setShowSearch(false); setChatSearchText(""); setChatImagePreview(null); setMsgMenuId(null); setEditMsgData(null);
    return () => unsubscribe();
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoom || !activeRoom.participants) return;
    const unsubscribes = activeRoom.participants.map(pid => {
      return onSnapshot(doc(db, "users", pid), (docSnap) => {
        if (docSnap.exists()) setRoomMembersInfo(prev => [...prev.filter(p => p.uid !== pid), docSnap.data()]);
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [activeRoomId, activeRoom?.participants]);

  useEffect(() => {
    if (!chatSearchText.trim()) { setSearchMatches([]); return; }
    const matches = messages.filter(m => !m.isSystem && m.text && m.text.toLowerCase().includes(chatSearchText.toLowerCase()));
    setSearchMatches(matches); setSearchIndex(matches.length > 0 ? matches.length - 1 : 0); 
  }, [chatSearchText, messages]);

  useEffect(() => {
    if (searchMatches.length > 0 && searchMatches[searchIndex]) {
      msgRefs.current[searchMatches[searchIndex].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchIndex, searchMatches]);

  const renderHighlightedText = (text) => {
    if (!chatSearchText.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${chatSearchText})`, 'gi'));
    return parts.map((part, i) => part.toLowerCase() === chatSearchText.toLowerCase() ? <mark key={i}>{part}</mark> : part);
  };

  const handleChatImageSelect = async (e) => { const file = e.target.files[0]; if (file) setChatImagePreview(await compressImage(file, 1000)); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e) => {
    e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) setChatImagePreview(await compressImage(file, 1000));
  };

  const sendSystemMessage = async (roomId, text) => {
    await addDoc(collection(db, "chats", roomId, "messages"), { text, isSystem: true, createdAt: serverTimestamp() });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !chatImagePreview) return;
    const txt = newMessage; const imgUrl = chatImagePreview;
    setNewMessage(""); setChatImagePreview(null);
    try {
        await addDoc(collection(db, "chats", activeRoomId, "messages"), { text: txt, imageUrl: imgUrl, senderId: user.uid, createdAt: serverTimestamp(), isEdited: false });
        const up = { lastMessageText: imgUrl ? "[圖片]" : txt, updatedAt: serverTimestamp() };
        activeRoom.participants.forEach(p => { if (p !== user.uid) up[`unreadCount.${p}`] = increment(1); });
        await updateDoc(doc(db, "chats", activeRoomId), up);
    } catch(err) { console.error("發送錯誤:", err); }
  };

  const submitEditMessage = async () => {
    if (!editMsgData.text.trim()) return;
    await updateDoc(doc(db, "chats", activeRoomId, "messages", editMsgData.id), { text: editMsgData.text, isEdited: true });
    setEditMsgData(null);
  };

  const handleImageUpload = async (e) => { if(e.target.files[0]) { setAvatarImage(await compressImage(e.target.files[0], 150)); setAvatarEmoji(""); } };
  const handleSaveProfile = async () => {
    await setDoc(doc(db, "users", user.uid), { displayName, personalId, uid: user.uid, email: user.email, phoneNumber, address, avatarConfig: { bgColor: avatarBgColor, emoji: avatarImage ? "" : avatarEmoji, image: avatarImage } }, { merge: true });
    setShowSettings(false); setShowAvatarPicker(false); setShowEmojiMenu(false);
  };
  
  const handleAddChat = async () => {
    const input = searchInput.trim().toLowerCase();
    if (!input || input === user.email?.toLowerCase() || input === personalId) return;
    try {
      // 1. 群組代碼搜尋邏輯
      if (/^\d{8}$/.test(input)) {
        const gSnap = await getDocs(query(collection(db, "chats"), where("groupId", "==", input)));
        if (!gSnap.empty) {
          await updateDoc(doc(db, "chats", gSnap.docs[0].id), { participants: arrayUnion(user.uid), participantEmails: arrayUnion(user.email), [`unreadCount.${user.uid}`]: 0, acceptedBy: arrayUnion(user.uid) });
          await sendSystemMessage(gSnap.docs[0].id, `${displayName} 加入了群組`);
          setActiveRoomId(gSnap.docs[0].id); setSearchInput(""); return;
        }
      }
      
      // 2. 用戶搜尋邏輯
      const [snapE, snapI] = await Promise.all([getDocs(query(collection(db, "users"), where("email", "==", input))), getDocs(query(collection(db, "users"), where("personalId", "==", input)))]);
      const targetDoc = snapE.docs[0] || snapI.docs[0];
      if (!targetDoc) return alert("找不到該使用者");
      
      const targetData = targetDoc.data();
      const targetUid = targetData.uid;

      // 🛑 狀態檢查 1：封鎖狀態
      const iBlockedThem = currentUserInfo?.blockedUsers?.includes(targetUid);
      const theyBlockedMe = targetData.blockedUsers?.includes(user.uid);
      if (iBlockedThem) return alert("你已封鎖此用戶，請先至設定解除封鎖。");
      if (theyBlockedMe) return alert("很抱歉，你無法新增此用戶。"); // 婉轉提示被對方封鎖

      // 🛑 狀態檢查 2：好友狀態 (檢查是否已存在私聊房間)
      const existingRoom = chatRooms.find(r => (r.type === "private" || (!r.type && r.participants.length === 2)) && r.participants.includes(targetUid));
      if (existingRoom) {
        alert("你們已經是好友囉！");
        setActiveRoomId(existingRoom.id); // 直接幫使用者跳轉到該聊天室
        setSearchInput("");
        return;
      }

      // 🛑 狀態檢查 3：非好友狀態 (建立新房間)
      const newRoom = await addDoc(collection(db, "chats"), {
        participants: [user.uid, targetUid], participantEmails: [user.email, targetData.email], themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), type: "private", unreadCount: { [user.uid]: 0, [targetUid]: 0 }, lastReadTime: { [user.uid]: serverTimestamp(), [targetUid]: serverTimestamp() },
        acceptedBy: [user.uid] 
      });
      setActiveRoomId(newRoom.id); setSearchInput("");
    } catch (e) { console.error(e); }
  };
  
  const handleCreateNewGroup = async () => {
    if (activeRoom.type === "group") return;
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const groupName = prompt("請輸入新群組名稱：", "新群組");
    if (!groupName) return;
    const newGroup = await addDoc(collection(db, "chats"), {
      type: "group", groupId: randomId, groupName, participants: activeRoom.participants, participantEmails: activeRoom.participantEmails, themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), unreadCount: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {}), lastReadTime: activeRoom.participants.reduce((acc, pid) => ({ ...acc, [pid]: serverTimestamp() }), {}),
      acceptedBy: [user.uid]
    });
    setActiveRoomId(newGroup.id); setShowThemePicker(false); alert(`全新群組已建立！群組 ID: ${randomId}`);
  };

  const handleRenameGroup = async () => {
    const newName = prompt("新名稱：", activeRoom.groupName || "");
    if(newName) {
      await updateDoc(doc(db, "chats", activeRoomId), { groupName: newName });
      await sendSystemMessage(activeRoomId, `${displayName} 更改了群組名稱為「${newName}」`);
    }
  };

  const handleInviteFriendToGroup = async (friend) => {
    if (activeRoom.participants.includes(friend.uid)) return;
    await updateDoc(doc(db, "chats", activeRoomId), { participants: arrayUnion(friend.uid), participantEmails: arrayUnion(friend.email), [`unreadCount.${friend.uid}`]: 0, [`lastReadTime.${friend.uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
    await sendSystemMessage(activeRoomId, `${displayName} 邀請了 ${friend.email.split('@')[0]} 加入群組`);
    alert(`已邀請 ${friend.email.split('@')[0]}`);
  };

  const handleLeaveGroup = async (roomId, groupName) => {
    if(window.confirm(`確定要退出「${groupName || "群組"}」嗎？`)) {
      await sendSystemMessage(roomId, `${displayName} 已退出群組`);
      await updateDoc(doc(db, "chats", roomId), { participants: arrayRemove(user.uid), participantEmails: arrayRemove(user.email) });
      if(activeRoomId === roomId) setActiveRoomId(null);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if(window.confirm("確定要刪除這個聊天室嗎？這將會從雙方的列表移除，並且不再將對方視為好友。")) {
      await deleteDoc(doc(db, "chats", roomId));
      if(activeRoomId === roomId) setActiveRoomId(null);
    }
  };
  
  const handleAddFriendFromList = async (target) => {
    if (target.uid === user.uid) return;

    // 🛑 狀態檢查 1：封鎖狀態
    const iBlockedThem = currentUserInfo?.blockedUsers?.includes(target.uid);
    const theyBlockedMe = target.blockedUsers?.includes(user.uid);
    if (iBlockedThem) return alert("你已封鎖此用戶，請先解除封鎖。");
    if (theyBlockedMe) return alert("很抱歉，你無法新增此用戶。");

    // 🛑 狀態檢查 2：好友狀態
    const existingRoom = chatRooms.find(r => (r.type === "private" || (!r.type && r.participants.length === 2)) && r.participants.includes(target.uid));
    if (existingRoom) {
      alert("你們已經是好友囉！");
      setActiveRoomId(existingRoom.id);
      return;
    }

    // 🛑 狀態檢查 3：非好友狀態 (建立新房間)
    const newRoom = await addDoc(collection(db, "chats"), { participants: [user.uid, target.uid], participantEmails: [user.email, target.email], themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), type: "private", unreadCount: { [user.uid]: 0, [target.uid]: 0 }, acceptedBy: [user.uid] });
    await addDoc(collection(db, "chats", newRoom.id, "messages"), { text: `我是來自 ${activeRoom.groupName || "群組"} 的 ${displayName || user.email.split('@')[0]}`, senderId: user.uid, createdAt: serverTimestamp() });
    alert("已發送私訊請求！");
  };

  const handleAcceptRequest = async () => { await updateDoc(doc(db, "chats", activeRoomId), { acceptedBy: arrayUnion(user.uid) }); };
  const handleDeclineRequest = async () => {
    if (window.confirm("確定要拒絕並刪除這個聊天室嗎？")) {
      await deleteDoc(doc(db, "chats", activeRoomId));
      setActiveRoomId(null);
    }
  };

  const handleAvatarClick = async (e, targetUid) => {
    e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.right + 15, y = rect.top;
    if (y + 350 > window.innerHeight) y = window.innerHeight - 380;
    if (x + 270 > window.innerWidth) x = rect.left - 280;
    let targetInfo = roomMembersInfo.find(m => m.uid === targetUid);
    if (!targetInfo) {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", targetUid)));
      targetInfo = snap.empty ? { uid: targetUid, email: "未知帳號", displayName: "未知" } : snap.docs[0].data();
    }
    setAvatarPopover({ show: true, x, y, user: targetInfo, isSelf: targetUid === user.uid });
  };

  const handleBlockUser = async (targetUid) => {
    const isCurrentlyBlocked = currentUserInfo?.blockedUsers?.includes(targetUid);
    if (isCurrentlyBlocked) {
      await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayRemove(targetUid) });
      alert("已解除封鎖");
    } else {
      if(window.confirm("確定要封鎖該用戶嗎？雙方將無法傳送訊息。")) {
        await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayUnion(targetUid) });
        alert("已封鎖該用戶");
      }
    }
    setAvatarPopover({show: false});
  };

  const isCurrentRoomStranger = activeRoom?.acceptedBy && !activeRoom.acceptedBy.includes(user.uid);
  
  let isBlocked = false;
  let blockMessage = "";
  if (activeRoom && activeRoom.type !== "group") {
    const friendUid = activeRoom.participants.find(uid => uid !== user.uid);
    const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
    const hasBlockedMe = friendInfo?.blockedUsers?.includes(user.uid);
    const iBlockedThem = currentUserInfo?.blockedUsers?.includes(friendUid);
    
    if (hasBlockedMe) { isBlocked = true; blockMessage = "你已被封鎖"; }
    else if (iBlockedThem) { isBlocked = true; blockMessage = "解除封鎖後即可傳送訊息"; }
  }

  return (
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`} onClick={() => setMsgMenuId(null)}>
      <UserProfilePopover popoverData={avatarPopover} setPopoverData={setAvatarPopover} nightMode={nightMode} handleAddFriendFromList={handleAddFriendFromList} handleCreateNewGroup={handleCreateNewGroup} myFriends={myFriends} handleBlockUser={handleBlockUser} currentUserInfo={currentUserInfo} />
      <SettingsModal showSettings={showSettings} setShowSettings={setShowSettings} showAvatarPicker={showAvatarPicker} setShowAvatarPicker={setShowAvatarPicker} showEmojiMenu={showEmojiMenu} setShowEmojiMenu={setShowEmojiMenu} nightMode={nightMode} setNightMode={setNightMode} personalId={personalId} setPersonalId={setPersonalId} displayName={displayName} setDisplayName={setDisplayName} phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} address={address} setAddress={setAddress} avatarImage={avatarImage} setAvatarImage={setAvatarImage} avatarBgColor={avatarBgColor} setAvatarBgColor={setAvatarBgColor} avatarEmoji={avatarEmoji} setAvatarEmoji={setAvatarEmoji} handleSaveProfile={handleSaveProfile} handleImageUpload={handleImageUpload} user={user} logoColor={logoColor} presetColors={presetColors} />
      <InviteModal showInviteModal={showInviteModal} setShowInviteModal={setShowInviteModal} activeRoom={activeRoom} myFriends={myFriends} handleInviteFriendToGroup={handleInviteFriendToGroup} nightMode={nightMode} />
      
      {/* 💡 導入 BlockListModal */}
      <BlockListModal showBlockListModal={showBlockListModal} setShowBlockListModal={setShowBlockListModal} nightMode={nightMode} currentUserInfo={currentUserInfo} user={user} />

      <Sidebar 
        showChat={showChat} user={user} logoColor={logoColor} setShowSettings={setShowSettings} avatarImage={avatarImage} avatarEmoji={avatarEmoji} displayName={displayName} searchInput={searchInput} setSearchInput={setSearchInput} handleAddChat={handleAddChat} 
        chatRooms={filteredRooms} activeRoomId={activeRoomId} setActiveRoomId={(id) => { setActiveRoomId(id); setShowChat(true); }} setShowThemePicker={setShowThemePicker} roomMembersInfo={roomMembersInfo} handleAvatarClick={handleAvatarClick}
        filterMode={filterMode} setFilterMode={setFilterMode} showSearchInput={showSearchInput} setShowSearchInput={setShowSearchInput}
        hasStrangerMsgs={hasStrangerMsgs} handleDeleteRoom={handleDeleteRoom} handleLeaveGroup={handleLeaveGroup} setShowBlockListModal={setShowBlockListModal}
      />

      <div className={`chat-area ${!showChat ? "hide-on-mobile" : ""}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{ position: 'relative' }}>
        {isDragging && <div className="drag-overlay">放開以上傳圖片至對話</div>}
        
        {activeRoom ? (
          <>
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mobile-only" onClick={() => setShowChat(false)} style={{ color: activeRoom.themeColor, border: 'none', background: 'transparent', fontSize: '16px' }}>&lt; 返回</button>
                <h3 style={{ margin: 0, color: nightMode ? "white" : "black" }}>{getFriendDynamicName(activeRoom, roomMembersInfo, user)}</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                <button className="btn-more" onClick={() => setShowSearch(!showSearch)} title="搜尋訊息">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
                <button className="btn-more" onClick={() => setShowThemePicker(!showThemePicker)}>⋯</button>
                {showThemePicker && (
                  <div className="theme-popover">
                    {activeRoom.type === "group" ? (
                      <>
                        <div className="menu-section">
                          <button className="popover-btn primary" onClick={() => { setShowInviteModal(true); setShowThemePicker(false); }}>+ 邀請目前好友</button>
                          <button className="popover-btn" onClick={() => { handleRenameGroup(); setShowThemePicker(false); }}>更改群組名稱</button>
                          <button className="popover-btn danger" onClick={() => { handleLeaveGroup(activeRoom.id, activeRoom.groupName); setShowThemePicker(false); }}>退出群組</button>
                        </div>
                        <div className="menu-section" style={{ borderBottom: 'none' }}>
                          <label className="menu-label">成員清單 ({roomMembersInfo.length})</label>
                          {roomMembersInfo.map(m => (
                            <div key={m.uid} className="member-item">
                              <div className="member-info"><span className="member-name">{m.displayName || m.email.split('@')[0]}</span><span className="member-email">{m.email}</span></div>
                              {m.uid !== user.uid && !myFriends.some(f => f.uid === m.uid) && <button className="btn-add-member" onClick={() => handleAddFriendFromList(m)}>+</button>}
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
                          </div>
                          <button className="popover-btn primary" onClick={handleCreateNewGroup}>建立新群組</button>
                        </div>
                        <button className="popover-btn danger" onClick={() => { handleDeleteRoom(activeRoom.id); setShowThemePicker(false); }}>刪除聊天室</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showSearch && (
              <div className="chat-search-bar">
                <input autoFocus placeholder="在對話中搜尋..." value={chatSearchText} onChange={e => setChatSearchText(e.target.value)} />
                {searchMatches.length > 0 && <span style={{color: '#8e8e93', fontSize: '13px'}}>{searchIndex + 1} / {searchMatches.length}</span>}
                <button className="search-nav-btn" onClick={() => setSearchIndex(Math.max(searchIndex - 1, 0))}>▲</button>
                <button className="search-nav-btn" onClick={() => setSearchIndex(Math.min(searchIndex + 1, searchMatches.length - 1))}>▼</button>
              </div>
            )}

            <div className="message-list">
              {messages.map(msg => {
                if (msg.isSystem) return <div key={msg.id} className="system-message" ref={el => msgRefs.current[msg.id] = el}>{msg.text}</div>;

                const senderInfo = roomMembersInfo.find(m => m.uid === msg.senderId);
                let fallbackName = "未知";
                const pIndex = activeRoom.participants.indexOf(msg.senderId);
                if (pIndex !== -1 && activeRoom.participantEmails[pIndex]) fallbackName = activeRoom.participantEmails[pIndex].split('@')[0];
                const isBlockedByThem = senderInfo?.blockedUsers?.includes(user.uid);
                
                const currentName = isBlockedByThem ? "未知" : (senderInfo?.displayName || fallbackName);
                const currentAvatarConfig = isBlockedByThem ? null : (senderInfo?.avatarConfig || null);
                const isEditing = editMsgData?.id === msg.id;

                let readCount = 0;
                if (msg.senderId === user.uid && msg.createdAt) {
                  activeRoom.participants.forEach(p => {
                    if (p !== user.uid) {
                      const readTime = activeRoom.lastReadTime?.[p];
                      if (readTime && readTime.toMillis() >= msg.createdAt.toMillis()) readCount++;
                    }
                  });
                }

                return (
                  <div key={msg.id} className={`message-with-avatar ${msg.senderId === user.uid ? "sent" : "received"}`} ref={el => msgRefs.current[msg.id] = el}>
                    
                    <div className="avatar-container" style={{cursor: isBlockedByThem ? 'default' : 'pointer'}} onClick={(e) => { if(!isBlockedByThem) handleAvatarClick(e, msg.senderId); }}>
                      <div className="msg-avatar" style={{backgroundColor: currentAvatarConfig?.image ? "transparent" : (currentAvatarConfig?.bgColor || "#007aff")}}>
                         {renderAvatar(currentAvatarConfig, currentName)}
                      </div>
                      <span className="avatar-subtext">{currentName}</span>
                    </div>

                    <div className="msg-hover-container">
                      <div style={{ display: "flex", flexDirection: "column", alignItems: msg.senderId === user.uid ? "flex-end" : "flex-start" }}>
                        <div className={`message ${msg.senderId === user.uid ? "sent" : "received"}`} style={msg.senderId === user.uid ? { backgroundColor: activeRoom.themeColor } : {}}>
                          {msg.imageUrl && <img src={msg.imageUrl} className="chat-message-image" alt="attachment" />}
                          {isEditing ? (
                            <div onClick={e => e.stopPropagation()}>
                              <input className="edit-msg-input" autoFocus value={editMsgData.text} onChange={e => setEditMsgData({...editMsgData, text: e.target.value})} onKeyDown={e => e.key === 'Enter' && submitEditMessage()} />
                              <div>
                                <button className="popover-btn" style={{padding:'4px', display:'inline', width:'auto', color:'#34c759'}} onClick={submitEditMessage}>儲存</button>
                                <button className="popover-btn" style={{padding:'4px', display:'inline', width:'auto'}} onClick={() => setEditMsgData(null)}>取消</button>
                              </div>
                            </div>
                          ) : (
                            msg.text && <p style={{ margin: 0 }}>
                              {renderHighlightedText(msg.text)}
                              {msg.isEdited && <span className="edited-tag">(已編輯)</span>}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                          <span className="message-time" style={{marginTop: 0}}>{formatTime(msg.createdAt)}</span>
                          {msg.senderId === user.uid && readCount > 0 && (
                            <span style={{ fontSize: '11px', color: '#8e8e93' }}>
                              {activeRoom.type === "group" ? `已讀 ${readCount}` : "已讀"}
                            </span>
                          )}
                        </div>
                      </div>

                      {msg.senderId === user.uid && !isEditing && (
                        <div style={{position: 'relative'}}>
                          <button className="btn-msg-more" onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                          </button>
                          {msgMenuId === msg.id && (
                            <div className="msg-action-popover" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEditMsgData({id: msg.id, text: msg.text || ""}); setMsgMenuId(null); }}>編輯</button>
                              <button className="danger" onClick={() => { deleteDoc(doc(db, "chats", activeRoomId, "messages", msg.id)); setMsgMenuId(null); }}>收回</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={scrollRef} />
            </div>

            {isCurrentRoomStranger ? (
              <div className="stranger-action-area">
                <p>對方傳送了訊息給您。接受後，雙方才能正常進行對話。</p>
                <div className="stranger-buttons">
                  <button className="btn-decline" onClick={handleDeclineRequest}>拒絕並刪除</button>
                  <button className="btn-accept" onClick={handleAcceptRequest}>接受</button>
                </div>
              </div>
            ) : isBlocked ? (
              <div className="blocked-input-area">{blockMessage}</div>
            ) : (
              <form className="chat-input-area" onSubmit={handleSendMessage} style={{ flexDirection: 'column' }}>
                {chatImagePreview && (
                  <div className="image-preview-container">
                    <img src={chatImagePreview} alt="preview" />
                    <button type="button" className="btn-remove-preview" onClick={() => setChatImagePreview(null)}>✕</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                  <label style={{ cursor: 'pointer', color: '#8e8e93', display: 'flex', alignItems: 'center', padding: '0 5px' }} title="附加圖片">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleChatImageSelect} />
                  </label>
                  <input placeholder="輸入訊息..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                  <button type="submit" className="btn-send" style={{ color: activeRoom.themeColor, background: 'none', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>送出</button>
                </div>
              </form>
            )}
          </>
        ) : <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#8e8e93" }}>選擇聊天室開始對話</div>}
      </div>
    </div>
  );
}

export default ChatRoomPage;