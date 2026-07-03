import { getMediaUrl } from '../api';

export default function VideoPlayer({ chatId, messageId, caption }) {
  const src = getMediaUrl(chatId, messageId);

  return (
    <div className="video-player">
      <video
        src={src}
        controls
        preload="metadata"
        playsInline
      >
        Your browser does not support the video element.
      </video>
      {caption && <div className="video-caption">{caption}</div>}
    </div>
  );
}
