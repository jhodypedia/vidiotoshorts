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

// Upload config
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// SPA View
app.get('/', (req, res) => {
  res.render('index');
});

// API: Get all output videos
app.get('/api/videos', (req, res) => {
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4'));
  res.json(files);
});

// API: Cut video
app.post('/api/cut', upload.single('video'), (req, res) => {
  const episodes = parseInt(req.body.episodes || 10);
  const inputPath = path.join(uploadDir, req.file.filename);

  ffmpeg.ffprobe(inputPath, (err, metadata) => {
    if (err) return res.status(500).json({ error: 'Metadata error' });

    const totalDuration = Math.floor(metadata.format.duration);
    const perPart = Math.floor(totalDuration / episodes);
    let finished = 0;

    for (let i = 0; i < episodes; i++) {
      const outputFile = path.join(outputDir, `short_part_${Date.now()}_${i + 1}.mp4`);
      const start = i * perPart;

      ffmpeg(inputPath)
        .setStartTime(start)
        .duration(perPart)
        .output(outputFile)
        .on('end', () => {
          finished++;
          if (finished === episodes) {
            res.json({ success: true });
          }
        })
        .on('error', e => console.error(e.message))
        .run();
    }
  });
});

// API: Download ZIP
app.get('/api/download-all', (req, res) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('shorts.zip');

  archive.pipe(res);
  fs.readdirSync(outputDir).forEach(file => {
    archive.file(path.join(outputDir, file), { name: file });
  });
  archive.finalize();
});

app.listen(port, () => {
  console.log(`✅ Server running: http://localhost:${port}`);
});
