"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@takaki/go-design-system";

export function ProfileDialog({
  open,
  onClose,
  displayName,
  avatarUrl,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  avatarUrl: string;
  onSaved: (newDisplayName: string, newAvatarUrl: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editName, setEditName] = useState(displayName);
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (open) {
      setEditName(displayName);
      setPreviewUrl(avatarUrl);
      setPendingFile(null);
      setUploadError("");
    }
  }, [open, displayName, avatarUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError("");
  }

  async function handleSave() {
    setSaving(true);
    setUploadError("");
    try {
      let finalUrl = avatarUrl;
      if (pendingFile) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        finalUrl = urlData.publicUrl;
      }
      const { error } = await supabase.auth.updateUser({
        data: { display_name: editName.trim(), avatar_url: finalUrl },
      });
      if (error) throw error;
      onSaved(editName.trim() || displayName, finalUrl);
      onClose();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  const initials = (displayName || "U").charAt(0).toUpperCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full overflow-hidden shrink-0 bg-primary flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="avatar"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-white text-lg font-medium">
                  {initials}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{editName || "—"}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-auto p-0 text-xs text-primary hover:underline"
              >
                Change photo
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter a display name"
            />
          </div>
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
