"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { addNote, toggleNotePin } from "@/app/admin/members/[id]/actions";
import { Pin, PinOff, Monitor } from "lucide-react";

interface NoteData {
  id: string;
  content: string;
  isPinned: boolean;
  isSystem: boolean;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

interface NotesCardProps {
  memberId: string;
  notes: NoteData[];
}

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function NotesCard({ memberId, notes }: NotesCardProps) {
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await addNote(memberId, content);
      if (result?.success) {
        setContent("");
      }
    });
  };

  const handleTogglePin = (noteId: string) => {
    startTransition(async () => {
      await toggleNotePin(noteId);
    });
  };

  // Sort: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <CollapsibleCard
      title="Notes"
      badge={<Badge variant="secondary">{notes.length}</Badge>}
    >
      <div className="space-y-4">
        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !content.trim()}>
              {isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </form>

        {/* Notes List */}
        <div className="space-y-2">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border p-3 ${
                note.isSystem
                  ? "border-muted bg-muted/50 italic"
                  : note.isPinned
                    ? "border-primary/20 bg-primary/5"
                    : ""
              }`}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {note.isSystem && <Monitor className="size-3" />}
                  <span className="font-medium">
                    {note.author.firstName} {note.author.lastName}
                  </span>
                  <span>{formatTimestamp(note.createdAt)}</span>
                  {note.isPinned && (
                    <Badge variant="secondary" className="text-[10px]">
                      Pinned
                    </Badge>
                  )}
                </div>
                {!note.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTogglePin(note.id)}
                    disabled={isPending}
                    className="h-6 w-6 p-0"
                  >
                    {note.isPinned ? (
                      <PinOff className="size-3" />
                    ) : (
                      <Pin className="size-3" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No notes yet</p>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}
