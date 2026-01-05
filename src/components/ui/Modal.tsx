import { ReactNode, useEffect } from "react";
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
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          "glass-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-border/60 animate-scale-in",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border/60 bg-muted/30">
          <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

