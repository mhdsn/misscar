import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  app.post('/api/send-reminder', async (req, res) => {
    const { to, subject, text } = req.body;

    const emailUser = process.env.VITE_GMAIL_USER;
    const emailPass = process.env.VITE_GMAIL_APP_PASSWORD;

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: 'Configuration Gmail manquante. Configurez VITE_GMAIL_USER et VITE_GMAIL_APP_PASSWORD dans le fichier .env.local' });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      await transporter.sendMail({
        from: `MissCarr <${emailUser}>`,
        to,
        subject,
        text,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erreur d\'envoi d\'email:', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email: ' + error.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
