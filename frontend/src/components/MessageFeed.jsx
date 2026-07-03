import { useState, useEffect, useRef } from 'react';
import { getMediaUrl } from '../api';
import VideoPlayer from './VideoPlayer';

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) return time;

    const day = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });

    return `${day}, ${time}`;
  } catch {
    return '';
  }
}

/**
 * Convert URLs inside text to clickable anchor links safely.
 */
function renderMessageText(text) {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+|t\.me\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('t.me') ? `https://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          {part} ↗
        </a>
      );
    }
    return part;
  });
}

function SkeletonMessages() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-message"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
          <div className="skeleton-line medium" />
        </div>
      ))}
    </>
  );
}

export default function MessageFeed({
  messages,
  groupName,
  chatId,
  groupInfo,
  loading,
  onLoadMore,
  hasMore,
}) {
  const feedRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  /* Auto-scroll to bottom when new messages arrive */
  useEffect(() => {
    if (feedRef.current && !loading && messages.length > 0) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length, loading]);



  const handleCopyText = (msgId, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <>
      {/* Group Header Info & Options */}
      <div className="message-feed-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>{groupName || 'Select a Group'}</h2>
            {(groupInfo?.inviteLink || groupInfo?.username) && (
              <a
                className="join-group-btn"
                href={groupInfo.inviteLink || `https://t.me/${groupInfo.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                🚀 Join Telegram
              </a>
            )}
          </div>
          <p>
            {loading
              ? 'Loading messages…'
              : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            {groupInfo?.username && ` • @${groupInfo.username}`}
          </p>
        </div>
      </div>

      <div className="message-feed" ref={feedRef}>
        {/* Load More button at the top */}
        {hasMore && !loading && (
          <div className="load-more-container">
            <button className="load-more-button" onClick={onLoadMore}>
              ↑ Load Older Messages
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonMessages />
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages available.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isPhoto = msg.hasPhoto || msg.photo || msg.mediaType === 'photo';
            const isVideo = msg.hasVideo || msg.video || msg.mediaType === 'video' || msg.mediaType === 'gif';
            const isAudio = msg.hasAudio || msg.mediaType === 'audio';
            const isDocument = msg.hasDocument || msg.mediaType === 'document';

            return (
              <div
                key={msg.id || index}
                className="message"
                style={{ animationDelay: `${Math.min(index * 0.03, 0.8)}s` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {msg.senderName && (
                    <div className="message-sender">{msg.senderName}</div>
                  )}
                  {msg.text && (
                    <button
                      className="copy-btn"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      title="Copy text"
                    >
                      {copiedId === msg.id ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>

                {msg.text && (
                  <div className="message-text">
                    {renderMessageText(msg.text)}
                  </div>
                )}

                {/* Photo attachment */}
                {isPhoto && (
                  <div className="media-container">
                    <a
                      href={getMediaUrl(chatId, msg.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full image"
                    >
                      <img
                        className="message-image"
                        src={getMediaUrl(chatId, msg.id)}
                        alt="Shared image"
                        loading="lazy"
                      />
                    </a>
                  </div>
                )}

                {/* Video attachment */}
                {isVideo && (
                  <div className="media-container">
                    <VideoPlayer
                      chatId={chatId}
                      messageId={msg.id}
                      caption={msg.caption}
                    />
                  </div>
                )}

                {/* Audio attachment */}
                {isAudio && (
                  <div className="media-container audio-container">
                    <audio
                      src={getMediaUrl(chatId, msg.id)}
                      controls
                      preload="metadata"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                    />
                  </div>
                )}

                {/* Document attachment */}
                {isDocument && !isPhoto && !isVideo && !isAudio && (
                  <div className="media-container document-container">
                    <a
                      className="document-download-btn"
                      href={getMediaUrl(chatId, msg.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      📁 Download File Attachment
                    </a>
                  </div>
                )}

                <div className="message-meta">
                  {msg.views !== null && msg.views !== undefined && (
                    <span className="message-views">👁️ {msg.views}</span>
                  )}
                  {msg.date && (
                    <span className="message-time">{formatTime(msg.date)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
