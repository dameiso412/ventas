import { Router, Request, Response } from "express";
import multer from "multer";
import { authService } from "./_core/auth-service";
import { uploadRecording, ensureBucket } from "./_core/storage";
import { transcribeAndAnalyze } from "./_core/transcription";
import { createCallAudit, getLeadById } from "./db";

const ALLOWED_MIMES = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-wav",
  "audio/x-m4a", "audio/m4a", "audio/webm", "video/mp4", "video/webm",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (Whisper limit)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no soportado: ${file.mimetype}. Usa mp3, mp4, wav, m4a o webm.`));
    }
  },
});

// Ensure the storage bucket exists on first import
let bucketReady = false;
async function initBucket() {
  if (bucketReady) return;
  try {
    await ensureBucket();
    bucketReady = true;
  } catch (err) {
    console.warn("[Upload] Could not ensure bucket:", err);
  }
}

export const uploadRouter = Router();

uploadRouter.post(
  "/api/upload/recording",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Auth check
      const user = await authService.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "No autorizado" });
        return;
      }

      // Validate file
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No se recibio ningun archivo" });
        return;
      }

      // Validate leadId
      const leadId = parseInt(req.body.leadId);
      if (!leadId || isNaN(leadId)) {
        res.status(400).json({ error: "leadId es requerido" });
        return;
      }

      const closer = req.body.closer || null;
      const fechaLlamada = req.body.fechaLlamada
        ? new Date(req.body.fechaLlamada)
        : new Date();

      // Ensure bucket exists
      await initBucket();

      // Upload to Supabase Storage
      const publicUrl = await uploadRecording(
        file.buffer,
        file.originalname,
        file.mimetype,
        leadId,
      );

      // Get lead info for the audit record
      const lead = await getLeadById(leadId);

      // Create callAudit record
      const audit = await createCallAudit({
        leadId,
        closer,
        fechaLlamada,
        linkGrabacion: publicUrl,
        leadName: lead?.nombre || null,
        leadEmail: lead?.correo || null,
      });

      if (!audit) {
        res.status(500).json({ error: "Error creando registro de auditoria" });
        return;
      }

      // Fire-and-forget: transcribe + analyze in background
      transcribeAndAnalyze(audit.id, file.buffer, file.mimetype, {
        leadName: lead?.nombre || undefined,
        closer: closer || undefined,
      }).catch((err) => {
        console.error(`[Upload] Background transcription failed for audit #${audit.id}:`, err);
      });

      res.json({
        success: true,
        auditId: audit.id,
        linkGrabacion: publicUrl,
      });
    } catch (err: any) {
      console.error("[Upload] Error:", err);

      // Multer file size error
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Archivo muy grande. Maximo 25MB." });
        return;
      }

      res.status(500).json({ error: err.message || "Error subiendo archivo" });
    }
  },
);
