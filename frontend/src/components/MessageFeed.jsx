import { useEffect, useRef } from 'react';
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

export default function MessageFeed({ messages, groupName, loading, chatId, onLoadMore, hasMore }) {
  const feedRef = useRef(null);

  /* Auto-scroll to bottom when new messages arrive */
  useEffect(() => {
    if (feedRef.current && !loading) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <>
      <div className="message-feed-header">
        <h2>{groupName}</h2>
        <p>
          {loading
            ? 'Loading messages…'
            : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
        </p>
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
            <p>No messages in this group yet.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className="message"
              style={{ animationDelay: `${Math.min(index * 0.04, 1)}s` }}
            >
              {msg.senderName && (
                <div className="message-sender">{msg.senderName}</div>
              )}

              {msg.text && <div className="message-text">{msg.text}</div>}

              {/* Photo attachment */}
              {msg.photo && (
                <img
                  className="message-image"
                  src={getMediaUrl(chatId, msg.id)}
                  alt="Shared photo"
                  loading="lazy"
                />
              )}

              {/* Video attachment */}
              {msg.video && (
                <VideoPlayer
                  chatId={chatId}
                  messageId={msg.id}
                  caption={msg.caption}
                />
              )}

              <div className="message-meta">
                {msg.date && (
                  <span className="message-time">{formatTime(msg.date)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
