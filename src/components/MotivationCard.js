'use client';

import { useState, useEffect } from 'react';

/**
 * 동기부여 카드 - 대학 강의 훅 표시
 * Physics 과목용 파일럿
 */
export default function MotivationCard({ subject = 'physics', compact = false }) {
  const [clips, setClips] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch('/data/motivation_clips.json')
      .then(res => res.json())
      .then(data => {
        // subject 기반 필터링 (현재는 physics만)
        const filtered = data.filter(clip => {
          if (subject === 'physics') {
            return clip.course_id?.includes('8_0') ||
                   clip.course_id?.includes('CALTECH') ||
                   clip.course_id?.includes('STANFORD');
          }
          return false;
        });
        setClips(filtered);
      })
      .catch(err => console.error('Failed to load motivation clips:', err));
  }, [subject]);

  if (clips.length === 0) return null;

  const clip = clips[currentIndex];
  const youtubeUrl = `https://www.youtube.com/watch?v=${clip.video_id}&t=${Math.floor(clip.start_time)}s`;

  if (compact) {
    return (
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1 min-w-0">
            <div className="text-caption text-purple-700 font-medium mb-1">왜 물리학을 배워야 할까?</div>
            <div className="text-body text-text-primary line-clamp-2">{clip.hook}</div>
          </div>
          <span className="text-red-500 text-xl flex-shrink-0">▶️</span>
        </div>
      </a>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💡</span>
          <span className="text-subheading text-purple-700 font-semibold">왜 물리학을 배워야 할까?</span>
        </div>
        {clips.length > 1 && (
          <div className="flex items-center gap-1">
            {clips.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentIndex ? 'bg-purple-500' : 'bg-purple-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mb-3">
        <p className="text-body text-text-primary font-medium mb-2">"{clip.hook}"</p>
        <p className="text-caption text-text-secondary">{clip.why_cool}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-text-tertiary">
          {clip.course_title?.split(',')[0]}
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-caption rounded-lg hover:bg-red-600 transition-colors"
        >
          <span>▶️</span>
          <span>보기</span>
        </a>
      </div>

      {clip.quote && (
        <div className="mt-3 p-2 bg-white/50 rounded-lg">
          <p className="text-xs text-text-tertiary italic">"{clip.quote.slice(0, 150)}..."</p>
        </div>
      )}
    </div>
  );
}
