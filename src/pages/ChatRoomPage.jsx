import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, increment, arrayUnion, setDoc, arrayRemove, deleteField } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import "./ChatRoom.css";

import SettingsModal from "../components/SettingsModal";
import InviteModal from "../components/InviteModal";
import Sidebar from "../components/Sidebar";
import UserProfilePopover from "../components/UserProfilePopover";
import BlockListModal from "../components/BlockListModal";
import { formatTime, renderAvatar, getFriendDynamicName, compressImage } from "../utils/chatHelpers";

const presetColors = ["#007aff", "#34c759", "#ff9500", "#ff453a", "#af52de"];
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"]; // Instagram 預設表情

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
  const [showBlockListModal, setShowBlockListModal] = useState(false); 
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
  
  // 💡 訊息操作狀態
  const [msgMenuId, setMsgMenuId] = useState(null);
  const [reactionMenuId, setReactionMenuId] = useState(null);
  const [editMsgData, setEditMsgData] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightMsgId, setHighlightMsgId] = useState(null);

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
      if (!showSearch && !replyingTo) setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    updateDoc(doc(db, "chats", activeRoomId), { [`unreadCount.${user.uid}`]: 0, [`lastReadTime.${user.uid}`]: serverTimestamp() });
    
    // 切換聊天室時重置所有操作
    setShowSearch(false); setChatSearchText(""); setChatImagePreview(null); 
    setMsgMenuId(null); setReactionMenuId(null); setEditMsgData(null); setReplyingTo(null);
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

  // 💡 點擊引用訊息進行跳轉與高亮
  const handleScrollToRepliedMessage = (msgId) => {
    if (msgRefs.current[msgId]) {
      msgRefs.current[msgId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightMsgId(msgId);
      setTimeout(() => setHighlightMsgId(null), 1500); // 動畫結束後移除
    }
  };

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

  // 💡 發送訊息時附加 replyTo 資料
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !chatImagePreview) return;
    const txt = newMessage; const imgUrl = chatImagePreview;
    
    // 建立引用快照
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text || "[圖片]",
      senderName: replyingTo.senderName
    } : null;

    setNewMessage(""); setChatImagePreview(null); setReplyingTo(null);
    
    try {
        await addDoc(collection(db, "chats", activeRoomId, "messages"), { 
          text: txt, imageUrl: imgUrl, senderId: user.uid, createdAt: serverTimestamp(), isEdited: false,
          replyTo: replyData
        });
        const up = { lastMessageText: imgUrl ? "[圖片]" : txt, updatedAt: serverTimestamp() };
        activeRoom.participants.forEach(p => { if (p !== user.uid) up[`unreadCount.${p}`] = increment(1); });
        await updateDoc(doc(db, "chats", activeRoomId), up);
    } catch(err) { console.error("發送錯誤:", err); }
  };

  // 💡 發送或收回表情符號
  const toggleReaction = async (msgId, emoji, currentReactions) => {
    const msgRef = doc(db, "chats", activeRoomId, "messages", msgId);
    const myCurrentReaction = currentReactions?.[user.uid];
    
    if (myCurrentReaction === emoji) {
      // 點擊相同的表情 -> 收回 (Unsend)
      await updateDoc(msgRef, { [`reactions.${user.uid}`]: deleteField() });
    } else {
      // 點擊新的表情 -> 覆蓋或發送
      await updateDoc(msgRef, { [`reactions.${user.uid}`]: emoji });
    }
    setReactionMenuId(null);
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
      if (/^\d{8}$/.test(input)) {
        const gSnap = await getDocs(query(collection(db, "chats"), where("groupId", "==", input)));
        if (!gSnap.empty) {
          await updateDoc(doc(db, "chats", gSnap.docs[0].id), { participants: arrayUnion(user.uid), participantEmails: arrayUnion(user.email), [`unreadCount.${user.uid}`]: 0, acceptedBy: arrayUnion(user.uid) });
          await sendSystemMessage(gSnap.docs[0].id, `${displayName} 加入了群組`);
          setActiveRoomId(gSnap.docs[0].id); setSearchInput(""); return;
        }
      }
      const [snapE, snapI] = await Promise.all([getDocs(query(collection(db, "users"), where("email", "==", input))), getDocs(query(collection(db, "users"), where("personalId", "==", input)))]);
      const targetDoc = snapE.docs[0] || snapI.docs[0];
      if (!targetDoc) return alert("找不到該使用者");
      const targetData = targetDoc.data();

      if (currentUserInfo?.blockedUsers?.includes(targetData.uid)) return alert("你已封鎖此用戶，請先至設定解除封鎖。");
      if (targetData.blockedUsers?.includes(user.uid)) return alert("很抱歉，你無法新增此用戶。");

      const existingRoom = chatRooms.find(r => (r.type === "private" || (!r.type && r.participants.length === 2)) && r.participants.includes(targetData.uid));
      if (existingRoom) { alert("你們已經是好友囉！"); setActiveRoomId(existingRoom.id); setSearchInput(""); return; }

      const newRoom = await addDoc(collection(db, "chats"), {
        participants: [user.uid, targetData.uid], participantEmails: [user.email, targetData.email], themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), type: "private", unreadCount: { [user.uid]: 0, [targetData.uid]: 0 }, lastReadTime: { [user.uid]: serverTimestamp(), [targetData.uid]: serverTimestamp() },
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
    if (currentUserInfo?.blockedUsers?.includes(target.uid)) return alert("你已封鎖此用戶，請先解除封鎖。");
    if (target.blockedUsers?.includes(user.uid)) return alert("很抱歉，你無法新增此用戶。");

    const existingRoom = chatRooms.find(r => (r.type === "private" || (!r.type && r.participants.length === 2)) && r.participants.includes(target.uid));
    if (existingRoom) { alert("你們已經是好友囉！"); setActiveRoomId(existingRoom.id); return; }

    const newRoom = await addDoc(collection(db, "chats"), { participants: [user.uid, target.uid], participantEmails: [user.email, target.email], themeColor: "#007aff", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), type: "private", unreadCount: { [user.uid]: 0, [target.uid]: 0 }, acceptedBy: [user.uid] });
    await addDoc(collection(db, "chats", newRoom.id, "messages"), { text: `我是來自 ${activeRoom.groupName || "群組"} 的 ${displayName || user.email.split('@')[0]}`, senderId: user.uid, createdAt: serverTimestamp() });
    alert("已發送私訊請求！");
  };

  const handleAcceptRequest = async () => { await updateDoc(doc(db, "chats", activeRoomId), { acceptedBy: arrayUnion(user.uid) }); };
  const handleDeclineRequest = async () => {
    if (window.confirm("確定要拒絕並刪除這個聊天室嗎？")) { await deleteDoc(doc(db, "chats", activeRoomId)); setActiveRoomId(null); }
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
      await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayRemove(targetUid) }); alert("已解除封鎖");
    } else {
      if(window.confirm("確定要封鎖該用戶嗎？雙方將無法傳送訊息。")) {
        await updateDoc(doc(db, "users", user.uid), { blockedUsers: arrayUnion(targetUid) }); alert("已封鎖該用戶");
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
    if (friendInfo?.blockedUsers?.includes(user.uid)) { isBlocked = true; blockMessage = "你已被封鎖"; }
    else if (currentUserInfo?.blockedUsers?.includes(friendUid)) { isBlocked = true; blockMessage = "解除封鎖後即可傳送訊息"; }
  }

  // 點擊背景收合所有選單
  const closeAllMenus = () => { setMsgMenuId(null); setReactionMenuId(null); };

  return (
    <div className={`chatroom-container ${nightMode ? "night-mode" : ""}`} onClick={closeAllMenus}>
      <UserProfilePopover popoverData={avatarPopover} setPopoverData={setAvatarPopover} nightMode={nightMode} handleAddFriendFromList={handleAddFriendFromList} handleCreateNewGroup={handleCreateNewGroup} myFriends={myFriends} handleBlockUser={handleBlockUser} currentUserInfo={currentUserInfo} />
      <SettingsModal showSettings={showSettings} setShowSettings={setShowSettings} showAvatarPicker={showAvatarPicker} setShowAvatarPicker={setShowAvatarPicker} showEmojiMenu={showEmojiMenu} setShowEmojiMenu={setShowEmojiMenu} nightMode={nightMode} setNightMode={setNightMode} personalId={personalId} setPersonalId={setPersonalId} displayName={displayName} setDisplayName={setDisplayName} phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} address={address} setAddress={setAddress} avatarImage={avatarImage} setAvatarImage={setAvatarImage} avatarBgColor={avatarBgColor} setAvatarBgColor={setAvatarBgColor} avatarEmoji={avatarEmoji} setAvatarEmoji={setAvatarEmoji} handleSaveProfile={handleSaveProfile} handleImageUpload={handleImageUpload} user={user} logoColor={logoColor} presetColors={presetColors} />
      <InviteModal showInviteModal={showInviteModal} setShowInviteModal={setShowInviteModal} activeRoom={activeRoom} myFriends={myFriends} handleInviteFriendToGroup={handleInviteFriendToGroup} nightMode={nightMode} />
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

                // 💡 計算表情回應
                const reactionEntries = Object.values(msg.reactions || {});
                const uniqueEmojis = [...new Set(reactionEntries)].slice(0, 3); // 最多顯示三種不重複表情

                return (
                  <div key={msg.id} className={`message-with-avatar ${msg.senderId === user.uid ? "sent" : "received"} ${highlightMsgId === msg.id ? 'highlight-flash' : ''}`} ref={el => msgRefs.current[msg.id] = el}>
                    
                    <div className="avatar-container" style={{cursor: isBlockedByThem ? 'default' : 'pointer'}} onClick={(e) => { if(!isBlockedByThem) handleAvatarClick(e, msg.senderId); }}>
                      <div className="msg-avatar" style={{backgroundColor: currentAvatarConfig?.image ? "transparent" : (currentAvatarConfig?.bgColor || "#007aff")}}>
                         {renderAvatar(currentAvatarConfig, currentName)}
                      </div>
                      <span className="avatar-subtext">{currentName}</span>
                    </div>

                    <div className="msg-hover-container">
                      <div style={{ display: "flex", flexDirection: "column", alignItems: msg.senderId === user.uid ? "flex-end" : "flex-start", position: 'relative' }}>
                        
                        <div className={`message ${msg.senderId === user.uid ? "sent" : "received"}`} style={msg.senderId === user.uid ? { backgroundColor: activeRoom.themeColor } : {}}>
                          
                          {/* 💡 渲染被引用的訊息區塊 */}
                          {msg.replyTo && (
                            <div className="replied-msg-box" onClick={() => handleScrollToRepliedMessage(msg.replyTo.id)}>
                              <span style={{fontWeight: 'bold', marginBottom: '2px'}}>{msg.replyTo.senderName}</span>
                              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px'}}>
                                {msg.replyTo.text}
                              </span>
                            </div>
                          )}

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

                        {/* 💡 渲染表情符號徽章 */}
                        {uniqueEmojis.length > 0 && (
                          <div className="reaction-badge">
                            {uniqueEmojis.join("")}
                            {reactionEntries.length > 1 && <span className="reaction-count">{reactionEntries.length}</span>}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: uniqueEmojis.length > 0 ? '16px' : '4px' }}>
                          <span className="message-time" style={{marginTop: 0}}>{formatTime(msg.createdAt)}</span>
                          {msg.senderId === user.uid && readCount > 0 && (
                            <span style={{ fontSize: '11px', color: '#8e8e93' }}>{activeRoom.type === "group" ? `已讀 ${readCount}` : "已讀"}</span>
                          )}
                        </div>
                      </div>

                      {/* 💡 訊息 Hover 工具列 (回覆、表情、更多) */}
                      {!isEditing && (
                        <div style={{position: 'relative', display: 'flex'}}>
                          
                          {/* 表情按鈕 */}
                          <button className="btn-msg-more" onClick={(e) => { e.stopPropagation(); setReactionMenuId(reactionMenuId === msg.id ? null : msg.id); setMsgMenuId(null); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                          </button>

                          {/* 回覆按鈕 */}
                          <button className="btn-msg-more" onClick={() => setReplyingTo({id: msg.id, text: msg.text || (msg.imageUrl && "[圖片]"), senderName: currentName})}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                          </button>

                          {/* 更多 (只有發送者能編輯與收回) */}
                          {msg.senderId === user.uid && (
                            <button className="btn-msg-more" onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); setReactionMenuId(null); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                            </button>
                          )}
                          
                          {/* 表情面板 Popover */}
                          {reactionMenuId === msg.id && (
                            <div className="reaction-popover" onClick={e => e.stopPropagation()}>
                              {QUICK_EMOJIS.map(emoji => (
                                <span key={emoji} onClick={() => toggleReaction(msg.id, emoji, msg.reactions)}>{emoji}</span>
                              ))}
                            </div>
                          )}

                          {/* 更多面板 Popover */}
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
              <div style={{display: 'flex', flexDirection: 'column'}}>
                
                {/* 💡 準備回覆的預覽框 (置於輸入框上方) */}
                {replyingTo && (
                  <div className="reply-preview-bar">
                    <div className="reply-preview-content">
                      <span className="reply-preview-name">正在回覆 {replyingTo.senderName}</span>
                      <span className="reply-preview-text">{replyingTo.text}</span>
                    </div>
                    <button className="btn-cancel-reply" onClick={() => setReplyingTo(null)}>✕</button>
                  </div>
                )}

                <form className="chat-input-area" onSubmit={handleSendMessage} style={{ flexDirection: 'column', borderTop: replyingTo ? 'none' : '' }}>
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
              </div>
            )}
          </>
        ) : <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#8e8e93" }}>選擇聊天室開始對話</div>}
      </div>
    </div>
  );
}

export default ChatRoomPage;