import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = "hidden";
      
      // Remove any margins/padding that might cause gaps
      const html = document.documentElement;
      const body = document.body;
      const originalHtmlMargin = html.style.margin;
      const originalBodyMargin = body.style.margin;
      const originalHtmlPadding = html.style.padding;
      const originalBodyPadding = body.style.padding;
      const originalHtmlOverflow = html.style.overflow;
      
      html.style.margin = "0";
      html.style.padding = "0";
      html.style.overflow = "hidden";
      body.style.margin = "0";
      body.style.padding = "0";
      
      return () => {
        document.body.style.overflow = "";
        html.style.margin = originalHtmlMargin;
        html.style.padding = originalHtmlPadding;
        html.style.overflow = originalHtmlOverflow;
        body.style.margin = originalBodyMargin;
        body.style.padding = originalBodyPadding;
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed flex items-center justify-center backdrop-blur-md animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      }}
      onClick={onClose}
    >
      <div
        className={cn(
          "glass-card rounded-lg shadow-xl w-full mx-4 sm:mx-6 md:mx-auto max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto border-2 border-border/60 animate-scale-in",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'calc(100vw - 2rem)',
        }}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/60 bg-muted/30">
          <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

