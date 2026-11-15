import React, { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertTriangle, Scan, RefreshCw, FileImage, ShieldCheck } from "lucide-react";
import { API_URL } from "@/lib/live-api";

interface InspectionResult {
  batch_id: string;
  defect_present: boolean;
  confidence: number;
  defect_type: string;
  raw_score: number;
  image_path?: string;
  error?: string;
}

export function QualityInspectionUpload({ currentBatchId }: { currentBatchId?: string }) {
  const [batchId, setBatchId] = useState(currentBatchId || "BATCH-QC-001");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg"))) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleGenerateSample = () => {
    // Generate a synthetic industrial casting sample canvas and turn into a file
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Background metallic texture
      ctx.fillStyle = "#2a2d32";
      ctx.fillRect(0, 0, 224, 224);

      // Casting surface circle
      ctx.beginPath();
      ctx.arc(112, 112, 90, 0, Math.PI * 2);
      ctx.fillStyle = "#4a4f58";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#606773";
      ctx.stroke();

      // Industrial noise / texture
      for (let i = 0; i < 400; i++) {
        const x = 30 + Math.random() * 164;
        const y = 30 + Math.random() * 164;
        ctx.fillStyle = Math.random() > 0.5 ? "#3a3e44" : "#5a606b";
        ctx.fillRect(x, y, 2, 2);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], `sample_casting_${Date.now()}.png`, { type: "image/png" });
          setSelectedFile(sampleFile);
          setPreviewUrl(URL.createObjectURL(sampleFile));
          setResult(null);
          setErrorMsg(null);
        }
      });
    }
  };

  const handleInspect = async () => {
    if (!selectedFile) {
      setErrorMsg("Please upload an inspection image first.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("batch_id", batchId || "BATCH-QC-001");
      formData.append("file", selectedFile);

      const response = await fetch(`${API_URL}/api/quality/inspect`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Inference failed (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as InspectionResult;
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-panel mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Scan className="size-4 text-primary" />
            <h2 className="text-sm font-medium">ResNet-50 Visual QC Station (Task 2 Live Inspection)</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct multipart image upload to FastAPI backend. Runs deep learning defect classification in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            Load Sample Casting
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* Upload Zone & Inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Production Batch ID</label>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="e.g. BATCH-2026-X99"
              className="mt-1.5 w-full rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/30 p-6 text-center transition-colors hover:border-primary/60 hover:bg-background/60"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewUrl ? (
              <div className="space-y-3">
                <img
                  src={previewUrl}
                  alt="Inspection preview"
                  className="mx-auto max-h-40 rounded-md border border-border object-contain shadow-sm"
                />
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedFile?.name} ({(Number(selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                </p>
                <p className="text-[11px] text-primary">Click or drop to replace image</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-6" />
                </div>
                <p className="text-sm font-medium">Drop casting inspection image here</p>
                <p className="text-xs text-muted-foreground">Supports PNG, JPG, JPEG (auto-preprocessed to 224x224)</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleInspect}
            disabled={!selectedFile || loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Processing through ResNet-50...
              </>
            ) : (
              <>
                <Scan className="size-4" />
                Run ResNet-50 Defect Inspection
              </>
            )}
          </button>

          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Inference Results Card */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-surface/50 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Inference Diagnostic</span>
              {result && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    result.defect_present
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : "border border-green-500/40 bg-green-500/10 text-green-500"
                  }`}
                >
                  {result.defect_present ? (
                    <>
                      <AlertTriangle className="size-3.5" /> DEFECT DETECTED
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" /> CASTING PASSED (OK)
                    </>
                  )}
                </span>
              )}
            </div>

            {result ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Defect Type</p>
                    <p className="mt-1 font-mono text-base font-semibold uppercase">
                      {result.defect_type || (result.defect_present ? "Unknown Defect" : "None")}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Confidence Score</p>
                    <p className="mt-1 font-mono text-base font-semibold text-primary">
                      {result.confidence ? `${result.confidence}%` : "--"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sigmoid Activation:</span>
                    <span className="font-mono">{result.raw_score?.toFixed(4) ?? "--"}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full transition-all duration-500 ${result.defect_present ? "bg-destructive" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, result.confidence || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-background/40 p-3 font-mono text-xs space-y-1 text-muted-foreground">
                  <p>Batch ID: <span className="text-foreground">{result.batch_id}</span></p>
                  <p>Status: <span className="text-foreground">{result.defect_present ? "FLAGGED FOR REVIEW" : "ACCEPTED INTO PRODUCTION"}</span></p>
                  <p>Model Architecture: <span className="text-foreground">ResNet-50 (20.0M Params)</span></p>
                </div>
              </div>
            ) : (
              <div className="my-auto flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileImage className="size-12 stroke-[1.2] opacity-40" />
                <p className="mt-3 text-sm">No inspection completed yet</p>
                <p className="mt-1 text-xs">Upload an image or load a sample above to trigger ResNet-50 inference.</p>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> Connected to FastAPI /api/quality/inspect
            </span>
            <span>Keras 3 / TF 2.21</span>
          </div>
        </div>
      </div>
    </div>
  );
}
