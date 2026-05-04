import React from "react";
import { renderAvatar, getFriendDynamicName } from "../utils/chatHelpers";

export default function Sidebar({
  showChat, user, logoColor, setShowSettings, avatarImage, avatarEmoji, displayName,
  searchInput, setSearchInput, handleAddChat, chatRooms, activeRoomId, setActiveRoomId, setShowThemePicker, roomMembersInfo,
  handleAvatarClick // 💡 接收點擊頭貼的處理函式
}) {
  return (
    <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`}>
      <div className="sidebar-header">
        <h3 style={{ margin: 0, color: logoColor, transition: 'color 0.3s ease' }}>Messages</h3>
        {/* 左上角自己的頭貼 */}
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
          const title = getFriendDynamicName(room, roomMembersInfo, user);
          const isG = room.type === "group";
          const friendUid = room.participants.find(uid => uid !== user.uid);
          const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
          const friendAvatarConfig = friendInfo ? friendInfo.avatarConfig : null;

          return (
            <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`} onClick={() => { setActiveRoomId(room.id); setShowThemePicker(false); }}>
              {/* 💡 加入 onClick 與 cursor pointer 觸發名片 */}
              <div className="avatar" style={{ cursor: 'pointer', backgroundColor: friendAvatarConfig?.image ? "transparent" : (friendAvatarConfig?.bgColor || room.themeColor || "#007aff") }}
                   onClick={(e) => { if(!isG) handleAvatarClick(e, friendUid); }}>
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
  );
}