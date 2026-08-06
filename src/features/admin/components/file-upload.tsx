"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Upload } from "lucide-react";

type Purpose = "HEAD_PHOTO" | "MEDIA";

type PresignResponse = { uploadUrl: string; objectKey: string; error?: string };

function putFile(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error("Не удалось передать файл в хранилище."));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Хранилище отклонило файл (${request.status}). Проверьте CORS бакета.`));
    request.send(file);
  });
}

export function FileUpload({ departmentId, purpose }: { departmentId: string; purpose: Purpose }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) return setMessage("Выберите файл.");
    const title = String(new FormData(form).get("title") || "").trim();
    const description = String(new FormData(form).get("description") || "").trim();

    setState("uploading");
    setProgress(0);
    setMessage("Подготавливаем загрузку...");
    try {
      const presign = await fetch("/api/uploads/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId, filename: file.name, contentType: file.type, fileSizeBytes: file.size }) });
      const presignBody = await presign.json() as PresignResponse;
      if (!presign.ok) throw new Error(presignBody.error || "Не удалось подготовить загрузку.");

      setMessage("Загружаем файл в Timeweb S3...");
      await putFile(presignBody.uploadUrl, file, setProgress);
      setMessage("Проверяем файл и сохраняем данные...");
      const complete = await fetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId, objectKey: presignBody.objectKey, filename: file.name, contentType: file.type, fileSizeBytes: file.size, purpose, title, description }) });
      const completeBody = await complete.json() as { error?: string };
      if (!complete.ok) throw new Error(completeBody.error || "Не удалось сохранить данные файла.");

      setProgress(100);
      setState("success");
      setMessage(purpose === "HEAD_PHOTO" ? "Фотография сохранена." : "Материал загружен как черновик.");
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить файл.");
    }
  }

  const isPhoto = purpose === "HEAD_PHOTO";
  return <form ref={formRef} className="upload-form" onSubmit={submit}>
    <div className="upload-heading">{isPhoto ? <ImageUp size={20} /> : <Upload size={20} />}<strong>{isPhoto ? "Фотография заведующего" : "Добавить видео или памятку"}</strong></div>
    {!isPhoto && <><label>Название материала<input name="title" required maxLength={180} placeholder="Например, Как безопасно вставать" /></label><label>Короткое описание<textarea name="description" maxLength={2000} placeholder="Что пациент увидит в материале" /></label></>}
    {isPhoto && <label>Описание фотографии<input name="title" maxLength={180} defaultValue="Фотография заведующего отделением" /></label>}
    <label>Файл<input name="file" type="file" required accept={isPhoto ? "image/jpeg,image/png,image/webp" : "video/mp4,application/pdf,image/jpeg,image/png,image/webp"} /></label>
    {state === "uploading" && <div className="upload-progress" aria-label={`Загрузка ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
    {message && <p className={`upload-message ${state}`} role={state === "error" ? "alert" : "status"}>{message}</p>}
    <button type="submit" disabled={state === "uploading"}>{state === "uploading" ? `Загрузка ${progress}%` : isPhoto ? "Загрузить фотографию" : "Загрузить материал"}</button>
  </form>;
}
