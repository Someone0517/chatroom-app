import React from "react";
import { renderAvatar } from "../utils/chatHelpers";

export default function UserProfilePopover({
  popoverData, setPopoverData, nightMode, handleAddFriendFromList, handleCreateNewGroup, myFriends
}) {
  if (!popoverData.show || !popoverData.user) return null;

  const { x, y, user: targetUser, isSelf } = popoverData;

  // 動態計算座標，確保不會超出螢幕
  const style = {
    left: x,
    top: y,
  };

  const isFriend = myFriends.some(f => f.uid === targetUser.uid);

  return (
    <>
      <div className="popover-backdrop" onClick={() => setPopoverData({show: false, user: null})}></div>
      <div className={`user-profile-popover ${nightMode ? 'night-mode' : ''}`} style={style}>
         
         <div className="popover-header">
            <div className="popover-avatar-large" style={{backgroundColor: targetUser.avatarConfig?.image ? "transparent" : (targetUser.avatarConfig?.bgColor || "#8e8e93")}}>
              {renderAvatar(targetUser.avatarConfig, targetUser.displayName || targetUser.email)}
            </div>
            <h3 style={{margin: '0 0 5px 0', fontSize: '18px'}}>{targetUser.displayName || targetUser.email.split('@')[0]}</h3>
            <span className="popover-info-text">✉️ {targetUser.email}</span>
            {targetUser.phoneNumber && <span className="popover-info-text">📞 {targetUser.phoneNumber}</span>}
            {targetUser.address && <span className="popover-info-text">🏠 {targetUser.address}</span>}
         </div>

         {/* 如果點擊的是別人，顯示動作按鈕 */}
         {!isSelf && (
           <div className="popover-actions">
             <div className="menu-section">
               {!isFriend && (
                 <button className="popover-btn primary" onClick={() => { handleAddFriendFromList(targetUser); setPopoverData({show: false}); }}>+ 新增為好友</button>
               )}
               <button className="popover-btn primary" onClick={() => { handleCreateNewGroup(); setPopoverData({show: false}); }}>發起群組聊天</button>
             </div>
             <button className="popover-btn danger" onClick={() => { alert("功能預留：刪除用戶"); setPopoverData({show: false}); }}>刪除該用戶</button>
             <button className="popover-btn danger" onClick={() => { alert("功能預留：封鎖用戶"); setPopoverData({show: false}); }}>封鎖該用戶</button>
           </div>
         )}

         {/* 如果點擊的是自己，顯示提示 */}
         {isSelf && (
            <div style={{textAlign: 'center', fontSize: '13px', color: '#8e8e93'}}>
              這是你的個人名片<br/>可在設定中更新資料
            </div>
         )}
      </div>
    </>
  )
}