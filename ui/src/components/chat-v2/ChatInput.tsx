import { useRef, useEffect, useCallback } from "react";
import { ArrowUp, Square, Plus, X, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLASS } from "./glass";

export interface AttachedFile {
  file: File;
  preview?: string;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  attachments?: AttachedFile[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (index: number) => void;
}

export function ChatInputV2({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Type a message to CEO...",
  attachments = [],
  onAttach,
  onRemoveAttachment,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus after streaming ends
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      textareaRef.current?.focus();
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming]);

  // Auto-resize textarea (44 → 200)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSubmit();
      }
    }
  }

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0 && onAttach) {
        onAttach(files);
      }
      e.target.value = "";
    },
    [onAttach],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && onAttach) {
        onAttach(files);
      }
    },
    [onAttach],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const hasContent = value.trim() || attachments.length > 0;

  return (
    <div className="px-3 pb-3 pt-2">
      <div
        className={cn(
          "relative mx-auto max-w-3xl overflow-hidden rounded-[16px]",
          GLASS.tile,
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Specular highlight across top */}
        <div className={GLASS.specular} />

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-white/40 px-3 py-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="group relative flex shrink-0 items-center gap-2 rounded-lg border border-white/50 bg-white/60 px-2.5 py-1.5"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : att.file.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate text-xs text-foreground/80">
                  {att.file.name}
                </span>
                {onRemoveAttachment && (
                  <button
                    onClick={() => onRemoveAttachment(i)}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 transition-colors hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Remove attachment"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          style={{ minHeight: "44px", maxHeight: "200px" }}
        />

        {/* Bottom row: + on left, stop/send on right */}
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <div className="flex items-center">
            {onAttach && (
              <>
                <button
                  type="button"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 disabled:opacity-40",
                    GLASS.interactive,
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || disabled}
                  aria-label="Attach file"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-foreground/70",
                  GLASS.interactive,
                )}
                onClick={onStop}
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-opacity hover:opacity-95 disabled:opacity-30"
                disabled={!hasContent || disabled}
                onClick={onSubmit}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-foreground/30">
        Aygency is AI and can make mistakes. Please verify important information.
      </p>
    </div>
  );
}
