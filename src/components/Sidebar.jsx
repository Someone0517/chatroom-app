import React, { useState } from "react";
import { renderAvatar, getFriendDynamicName } from "../utils/chatHelpers";

export default function Sidebar({
  showChat, user, logoColor, setShowSettings, avatarImage, avatarEmoji, displayName,
  searchInput, setSearchInput, handleAddChat, chatRooms, activeRoomId, setActiveRoomId, setShowThemePicker, roomMembersInfo,
  handleAvatarClick, filterMode, setFilterMode, showSearchInput, setShowSearchInput,
  hasStrangerMsgs, handleDeleteRoom, handleLeaveGroup, setShowBlockListModal // 💡 接收 setShowBlockListModal
}) {
  const [roomMenuId, setRoomMenuId] = useState(null); 

  return (
    <div className={`sidebar ${showChat ? "hide-on-mobile" : ""}`} onClick={() => setRoomMenuId(null)}>
      <div className="sidebar-header">
        <h3 style={{ margin: 0, color: logoColor, transition: 'color 0.3s ease' }}>Messages</h3>
        <div className="profile-icon" onClick={() => setShowSettings(true)}>
            {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
        </div>
      </div>
      
      <div className="sidebar-filters">
        <button className={`filter-btn ${showSearchInput ? 'active' : ''}`} onClick={() => setShowSearchInput(!showSearchInput)} title="搜尋與新增">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <button className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')} title="全部訊息">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        </button>
        <button className={`filter-btn ${filterMode === 'unread' ? 'active' : ''}`} onClick={() => setFilterMode('unread')} title="未讀訊息">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><circle cx="18" cy="6" r="3.5" fill="#ff453a" stroke="none"></circle></svg>
        </button>
        
        <div className="stranger-dot-container">
          <button className={`filter-btn ${filterMode === 'stranger' ? 'active' : ''}`} onClick={() => setFilterMode('stranger')} title="陌生訊息">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          </button>
          {hasStrangerMsgs && <div className="stranger-dot"></div>}
        </div>
      </div>

      {showSearchInput && (
        <div className="search-bar">
          <input placeholder="搜尋 ID, Email 或群組 ID..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleAddChat} style={{ color: logoColor, background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>+</button>
        </div>
      )}

      <div className="friend-list">
        {/* 💡 只有在「陌生訊息」分頁時才顯示封鎖名單管理按鈕 */}
        {filterMode === 'stranger' && (
          <button className="btn-block-list-manage" onClick={() => setShowBlockListModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
            管理封鎖名單
          </button>
        )}

        {chatRooms.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '30px', color: '#8e8e93', fontSize: '13px' }}>沒有符合的對話</div>
        ) : (
          chatRooms.map(room => {
            const title = getFriendDynamicName(room, roomMembersInfo, user);
            const isG = room.type === "group";
            const friendUid = room.participants.find(uid => uid !== user.uid);
            const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
            const friendAvatarConfig = friendInfo ? friendInfo.avatarConfig : null;
            const isBlockedByThem = friendInfo?.blockedUsers?.includes(user.uid);

            return (
              <div key={room.id} className={`friend-item ${activeRoomId === room.id ? "active" : ""}`} onClick={() => { setActiveRoomId(room.id); setShowThemePicker(false); }}>
                <div className="avatar" style={{ cursor: 'pointer', backgroundColor: (friendAvatarConfig?.image && !isBlockedByThem) ? "transparent" : (friendAvatarConfig?.bgColor || room.themeColor || "#8e8e93") }}
                     onClick={(e) => { if(!isG && !isBlockedByThem) handleAvatarClick(e, friendUid); }}>
                  {isG ? "👥" : renderAvatar(isBlockedByThem ? null : friendAvatarConfig, title)}
                </div>
                
                <div className="friend-info">
                  <div className="friend-info-header">
                    <h4>{title}</h4>
                    <div style={{display:'flex', alignItems:'center'}}>
                      {room.unreadCount?.[user.uid] > 0 && <span className="unread-badge">{room.unreadCount[user.uid]}</span>}
                      <button className="sidebar-room-more-btn" onClick={(e) => { e.stopPropagation(); setRoomMenuId(roomMenuId === room.id ? null : room.id); }}>⋯</button>
                    </div>
                  </div>
                  <p className="friend-preview">{room.lastMessageText || "點擊開始對話"}</p>
                </div>

                {roomMenuId === room.id && (
                  <div className="sidebar-room-menu" onClick={(e) => e.stopPropagation()}>
                    {isG ? (
                      <button onClick={() => { handleLeaveGroup(room.id, room.groupName); setRoomMenuId(null); }}>退出群組</button>
                    ) : (
                      <button onClick={() => { handleDeleteRoom(room.id); setRoomMenuId(null); }}>刪除聊天室</button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}