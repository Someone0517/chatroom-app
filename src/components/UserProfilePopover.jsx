import React from "react";
import { renderAvatar } from "../utils/chatHelpers";

export default function UserProfilePopover({
  popoverData, setPopoverData, nightMode, handleAddFriendFromList, handleCreateNewGroup, myFriends,
  handleBlockUser, currentUserInfo
}) {
  if (!popoverData.show || !popoverData.user) return null;

  const { x, y, user: targetUser, isSelf } = popoverData;
  const style = { left: x, top: y };
  
  // 💡 三重狀態判斷
  const isFriend = myFriends.some(f => f.uid === targetUser.uid);
  const isBlockedByMe = currentUserInfo?.blockedUsers?.includes(targetUser.uid);
  const isBlockedByThem = targetUser.blockedUsers?.includes(currentUserInfo?.uid);

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

         {!isSelf && (
           <div className="popover-actions">
             <div className="menu-section">
               {/* 💡 根據狀態渲染不同按鈕 */}
               {!isFriend && !isBlockedByMe && !isBlockedByThem && (
                 <button className="popover-btn primary" onClick={() => { handleAddFriendFromList(targetUser); setPopoverData({show: false}); }}>+ 新增為好友</button>
               )}
               {isFriend && (
                 <button className="popover-btn" disabled style={{color: '#8e8e93', cursor: 'not-allowed', textAlign: 'center'}}>✓ 已為好友</button>
               )}
               {/* 若雙方任一方封鎖，隱藏發起群組 */}
               {!isBlockedByMe && !isBlockedByThem && (
                 <button className="popover-btn primary" onClick={() => { handleCreateNewGroup(); setPopoverData({show: false}); }}>發起群組聊天</button>
               )}
             </div>
             
             <button className="popover-btn danger" onClick={() => handleBlockUser(targetUser.uid)}>
               {isBlockedByMe ? "解除封鎖" : "封鎖該用戶"}
             </button>
           </div>
         )}

         {isSelf && (
            <div style={{textAlign: 'center', fontSize: '13px', color: '#8e8e93'}}>
              這是你的個人名片<br/>可在設定中更新資料
            </div>
         )}
      </div>
    </>
  )
}