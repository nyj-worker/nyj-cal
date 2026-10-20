import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ children, title, onClose, wide = false }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = oldOverflow; };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="modal-top"><h2>{title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
