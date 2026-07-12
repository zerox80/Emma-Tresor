import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useItemFiles } from "./useItemFiles";

const asFileList = (...files: File[]) => files as unknown as FileList;

describe("useItemFiles", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("accepts supported files, rejects invalid files and deduplicates names", () => {
    const image = new File(["image"], "photo.png", { type: "image/png" });
    const duplicate = new File(["other"], "photo.png", { type: "image/png" });
    const pdf = new File(["pdf"], "manual.pdf", { type: "application/pdf" });
    const invalid = new File(["text"], "notes.txt", { type: "text/plain" });
    const { result } = renderHook(() => useItemFiles());

    act(() => result.current.handleSelectFiles(asFileList(image, pdf, invalid)));
    expect(result.current.files.map((file) => file.name)).toEqual([
      "photo.png",
      "manual.pdf",
    ]);
    expect(result.current.filePreviews.map((preview) => preview.kind)).toEqual([
      "image",
      "pdf",
    ]);
    expect(result.current.fileFeedback).toContain("ignoriert");

    act(() => result.current.handleSelectFiles(asFileList(duplicate)));
    expect(result.current.files).toHaveLength(2);

    act(() => result.current.resetFiles());
    expect(result.current.files).toEqual([]);
    expect(result.current.fileFeedback).toBeNull();
  });
});
