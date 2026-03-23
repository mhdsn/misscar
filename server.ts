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
    const { to, subject, text, userEmail, userPassword } = req.body;

    const emailUser = userEmail || process.env.GMAIL_USER;
    const emailPass = userPassword || process.env.GMAIL_APP_PASSWORD;

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: 'Configuration Gmail manquante. Veuillez utiliser un email et un mot de passe d\'application valides lors de la connexion.' });
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
        from: emailUser,
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
