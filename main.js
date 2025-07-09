const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = 3000;

const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

app.use(express.static('public'));
app.use('/output', express.static('output'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Multer config
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// SPA page
app.get('/', (req, res) => {
  res.render('index');
});

// API: Proses video
app.post('/api/cut', upload.single('video'), (req, res) => {
  const episodes = parseInt(req.body.episodes || 10);
  const inputPath = path.join(uploadDir, req.file.filename);
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const userFolder = path.join(outputDir, id);

  fs.mkdirSync(userFolder);

  ffmpeg.ffprobe(inputPath, (err, metadata) => {
    if (err) return res.status(500).json({ error: 'Metadata error' });

    const totalDuration = Math.floor(metadata.format.duration);
    const perPart = Math.floor(totalDuration / episodes);
    let finished = 0;

    for (let i = 0; i < episodes; i++) {
      const outputFile = path.join(userFolder, `part_${i + 1}.mp4`);
      const start = i * perPart;

      ffmpeg(inputPath)
        .setStartTime(start)
        .duration(perPart)
        .output(outputFile)
        .on('end', () => {
          finished++;
          if (finished === episodes) {
            res.json({ success: true, id });
            scheduleAutoDelete(userFolder); // Auto delete after 1h
          }
        })
        .on('error', e => console.error(e.message))
        .run();
    }
  });
});

// API: Ambil hasil video berdasarkan ID
app.get('/api/videos/:id', (req, res) => {
  const folder = path.join(outputDir, req.params.id);
  if (!fs.existsSync(folder)) return res.json([]);
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.mp4'));
  res.json(files.map(f => `/output/${req.params.id}/${f}`));
});

// API: Download ZIP hasil user
app.get('/api/download-all/:id', (req, res) => {
  const folder = path.join(outputDir, req.params.id);
  if (!fs.existsSync(folder)) return res.status(404).send('Not found');

  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment(`shorts_${req.params.id}.zip`);
  archive.pipe(res);

  fs.readdirSync(folder).forEach(file => {
    archive.file(path.join(folder, file), { name: file });
  });
  archive.finalize();
});

// ⏱️ Auto delete folder setelah 1 jam
function scheduleAutoDelete(folderPath, delayMs = 3600000) {
  setTimeout(() => {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`🗑️ Folder "${folderPath}" dihapus otomatis setelah 1 jam`);
    }
  }, delayMs);
}

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
