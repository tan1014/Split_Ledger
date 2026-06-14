import express from 'express';
import prisma from '../db/prisma.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { ImportService } from '../services/import.service.js';

const router = express.Router({ mergeParams: true });

// Upload and analyze CSV (Step 1 & 2)
router.post('/upload', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { fileName, csvText } = req.body;

    if (!fileName || !csvText) {
      return res.status(400).json({ error: 'fileName and csvText are required in body.' });
    }

    const result = await ImportService.uploadAndAnalyzeCSV(groupId, req.user.id, fileName, csvText);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List import jobs for a group
router.get('/jobs', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const jobs = await prisma.importJob.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

// Get import job details and anomalies (Step 3)
router.get('/jobs/:jobId', authenticateToken, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        anomalies: true
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Import job not found.' });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Resolve anomalies and import cleaned data (Step 4 & 5)
router.post('/jobs/:jobId/resolve', authenticateToken, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { decisions, parsedRows } = req.body;

    if (!decisions || !parsedRows) {
      return res.status(400).json({ error: 'decisions array and parsedRows array are required.' });
    }

    const result = await ImportService.resolveAndImport(jobId, { decisions, parsedRows }, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
