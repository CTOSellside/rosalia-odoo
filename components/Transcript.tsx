import React, { useEffect, useRef } from 'react';
import { TranscriptItem, Speaker } from '../types';

interface TranscriptProps {
  items: TranscriptItem[];
}

const Transcript: React.FC<TranscriptProps> = ({ items }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="text-center text-slate-400 mt-8 italic">
        La conversación aparecerá aquí...
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4 pb-8 w-full max-w-md mx-auto overflow-y-auto h-64 bg-white/50 rounded-xl border border-slate-100 backdrop-blur-sm shadow-sm">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex w-full ${
            item.speaker === Speaker.USER ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
              item.speaker === Speaker.USER
                ? 'bg-odoo-teal text-white rounded-br-none'
                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
            }`}
          >
            <p className="font-semibold text-xs opacity-75 mb-1 block">
                {item.speaker === Speaker.USER ? 'Tú' : 'Rosa (Odoo)'}
            </p>
            {item.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default Transcript;