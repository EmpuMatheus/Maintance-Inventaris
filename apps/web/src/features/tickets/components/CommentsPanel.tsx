import { useState } from 'react';
import { Loader2, Lock, Send } from 'lucide-react';
import type { TicketComment } from '../types';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function CommentsPanel({
  comments,
  canComment,
  isSubmitting,
  onAddComment,
}: {
  comments: TicketComment[];
  canComment: boolean;
  isSubmitting: boolean;
  onAddComment: (comment: string, isInternal: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onAddComment(text.trim(), isInternal);
    setText('');
    setIsInternal(false);
  };

  return (
    <div className="flex flex-col">
      {canComment && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Write a comment..."
            className="block w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              <Lock className="h-3 w-3" /> Internal note
            </label>
            <button
              onClick={submit}
              disabled={!text.trim() || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Post
            </button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No activity yet.</p>
      ) : (
        <div>
          {comments.map((c) =>
            c.type === 'SYSTEM' ? (
              <div key={c.id} className="relative flex gap-3 pb-5 pl-1">
                <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{c.comment}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</p>
                </div>
              </div>
            ) : (
              <div key={c.id} className="mb-3 rounded-lg border border-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">{c.userName || 'Unknown'}</p>
                  <div className="flex items-center gap-2">
                    {c.isInternal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"><Lock className="h-2.5 w-2.5" /> Internal</span>
                    )}
                    <span className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-800">{c.comment}</p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
