import { useCallback, useEffect, useMemo, useState } from "react";
import { FILE_UPLOAD_CONSTANTS } from "../utils/constants";

export const MAX_FILES = FILE_UPLOAD_CONSTANTS.MAX_FILES;
export const MAX_FILE_SIZE_MB = FILE_UPLOAD_CONSTANTS.MAX_FILE_SIZE_MB;

const determineFileKind = (file: File): "image" | "pdf" | "file" => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "file";
};

export interface ItemFilePreview {
  name: string;
  url: string;
  size: number;
  type: string;
  kind: "image" | "pdf" | "file";
}

export const useItemFiles = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const filePreviews = useMemo<ItemFilePreview[]>(
    () =>
      files.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        kind: determineFileKind(file),
      })),
    [files],
  );

  useEffect(
    () => () => {
      filePreviews.forEach((preview) => {
        if (preview.url.startsWith("blob:")) URL.revokeObjectURL(preview.url);
      });
    },
    [filePreviews],
  );

  const handleSelectFiles = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const accepted: File[] = [];
    let rejected = false;
    Array.from(selectedFiles).forEach((file) => {
      const lowerName = file.name.toLowerCase();
      const withinSize = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
      const isImage =
        file.type.startsWith("image/") ||
        [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif", ".heic", ".heif"].some((extension) =>
          lowerName.endsWith(extension),
        );
      const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
      const validExtension = FILE_UPLOAD_CONSTANTS.ALLOWED_EXTENSIONS.some((extension) =>
        lowerName.endsWith(extension),
      );
      if ((isImage || isPdf) && withinSize && validExtension) accepted.push(file);
      else rejected = true;
    });

    if (accepted.length === 0) {
      if (rejected) {
        setFileFeedback(
          `Einige Dateien wurden ignoriert. Erlaubt sind nur Bild- oder PDF-Dateien bis ${MAX_FILE_SIZE_MB} MB.`,
        );
      }
      return;
    }

    setFiles((current) => {
      const existingNames = new Set(current.map((file) => file.name));
      const combined = [...current, ...accepted.filter((file) => !existingNames.has(file.name))];
      if (combined.length > MAX_FILES) {
        setFileFeedback(`Es sind maximal ${MAX_FILES} Dateien erlaubt.`);
        return combined.slice(0, MAX_FILES);
      }
      setFileFeedback(
        rejected
          ? `Einige Dateien wurden ignoriert. Erlaubt sind nur Bild- oder PDF-Dateien bis ${MAX_FILE_SIZE_MB} MB.`
          : null,
      );
      return combined;
    });
  }, []);

  const handleRemoveFile = useCallback((name: string) => {
    setFiles((current) => current.filter((file) => file.name !== name));
  }, []);

  const resetFiles = useCallback(() => {
    setFiles([]);
    setFileFeedback(null);
  }, []);

  return { files, fileFeedback, filePreviews, handleRemoveFile, handleSelectFiles, resetFiles };
};
