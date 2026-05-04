import React from "react";

export default function InviteModal({ 
  showInviteModal, setShowInviteModal, activeRoom, myFriends, handleInviteFriendToGroup, nightMode 
}) {
  if (!showInviteModal || activeRoom?.type !== "group") return null;

  return (
    <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: nightMode ? '#fff' : '#000' }}>邀請好友加入群組</h3>
        <div className="invite-list">
          {myFriends.filter(f => !activeRoom.participants.includes(f.uid)).length === 0 ? (
            <p style={{color: '#8e8e93', textAlign: 'center', margin: '20px 0'}}>沒有可邀請的好友</p>
          ) : (
            myFriends.filter(f => !activeRoom.participants.includes(f.uid)).map(friend => (
              <div key={friend.uid} className="invite-item">
                <div>
                  <div style={{color: nightMode ? '#fff' : '#000', fontSize: '14px'}}>{friend.email.split('@')[0]}</div>
                  <div style={{color: '#8e8e93', fontSize: '11px'}}>{friend.email}</div>
                </div>
                <button onClick={() => handleInviteFriendToGroup(friend)} style={{ background: '#0a84ff', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'}}>邀請</button>
              </div>
            ))
          )}
        </div>
        <button onClick={() => setShowInviteModal(false)} style={{ width: '100%', padding: '10px', marginTop: '15px', background: 'rgba(120,120,128,0.2)', color: nightMode ? '#fff' : '#000', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>關閉</button>
      </div>
    </div>
  );
}