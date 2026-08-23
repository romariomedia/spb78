import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Heart, MessageCircle, Share2, Send } from 'lucide-react';
import { FeedPost } from '../lib/types';
import { cldSrcSet, photoUrl, avatarUrl } from '../services/cloudinary';

interface PostCardProps {
  post: FeedPost;
  currentUserId: string;
  currentUserAvatar?: string;
  isCommentsOpen: boolean;
  commentDraft: string;
  onToggleLike: (post: FeedPost) => void;
  onToggleComments: (postId: string) => void;
  onShare: (post: FeedPost) => void;
  onCommentDraftChange: (text: string) => void;
  onSendComment: (postId: string) => void;
}

const PostCardInner: React.FC<PostCardProps> = ({
  post, currentUserId, currentUserAvatar, isCommentsOpen, commentDraft,
  onToggleLike, onToggleComments, onShare, onCommentDraftChange, onSendComment
}) => {
  const isLiked = post.likes.includes(currentUserId);
  const postComments = post.comments || [];

  return (
    <article className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Author header */}
      <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-800/60 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl(post.authorAvatar, 80)}
            alt={post.authorName}
            loading="lazy"
            className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow"
          />
          <div>
            <h4 className="font-extrabold text-sm text-white leading-tight flex items-center gap-1.5">
              {post.authorName}
              {post.authorPlan === 'premium' && (
                <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400 drop-shadow" />
              )}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{post.createdAt}</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {post.sportTag}
        </span>
      </div>

      {/* Text */}
      <div className="p-4 text-sm text-slate-200 leading-relaxed">{post.content}</div>

      {/* Media */}
      {post.mediaUrl && (
        <div className="relative w-full aspect-[4/3] max-h-[420px] overflow-hidden bg-slate-950 border-y border-slate-800/80">
          {post.mediaType === 'video' ? (
            <video
              src={post.mediaUrl}
              controls
              playsInline
              preload="none"
              className="w-full max-h-80 object-cover bg-black"
            />
          ) : (
            <img
              src={photoUrl(post.mediaUrl, 1080)}
              srcSet={cldSrcSet(post.mediaUrl)}
              sizes="(max-width: 640px) 100vw, 640px"
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain object-center"
            />
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="p-3.5 bg-slate-900/90 flex items-center justify-between border-t border-slate-800/80 text-xs font-bold">
        <button
          onClick={() => onToggleLike(post)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            isLiked
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span>{post.likes.length} Лайков</span>
        </button>

        <button
          onClick={() => onToggleComments(post.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            isCommentsOpen
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{postComments.length} Коммент.</span>
        </button>

        <button
          onClick={() => onShare(post)}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          title="Поделиться"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {isCommentsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-950 border-t border-slate-800 p-4 space-y-3"
          >
            <h5 className="text-xs font-bold text-slate-400">
              Обсуждение тренировки ({postComments.length})
            </h5>

            {postComments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Пока нет комментариев. Будьте первым, кто поддержит атлета!
              </p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {postComments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 text-xs">
                    <img
                      src={c.authorAvatar || currentUserAvatar}
                      alt=""
                      loading="lazy"
                      className="w-7 h-7 rounded-full object-cover mt-0.5 border border-slate-700 shrink-0"
                    />
                    <div className="bg-slate-900 p-2.5 rounded-2xl rounded-tl-none border border-slate-800 flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-emerald-400">{c.authorName}</span>
                        <span className="text-[10px] text-slate-500">{c.createdAt}</span>
                      </div>
                      <p className="text-slate-200 leading-snug">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Написать комментарий..."
                value={commentDraft}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSendComment(post.id); }}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => onSendComment(post.id)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-2 rounded-xl transition font-extrabold flex items-center justify-center shrink-0 shadow"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
};

/** Memoised: a like on one post never re-renders the whole feed */
export const PostCard = React.memo(
  PostCardInner,
  (prev, next) =>
    prev.post === next.post &&
    prev.isCommentsOpen === next.isCommentsOpen &&
    // The draft only matters for the post whose comments are open
    (prev.isCommentsOpen ? prev.commentDraft === next.commentDraft : true) &&
    prev.currentUserId === next.currentUserId
);
