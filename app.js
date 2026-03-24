import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import multer from 'multer';

// 1. Configure storage: save to public/images/uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/images/uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        //  unique name: timestamp + original name
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 2. the Upload Route
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    
    // Sending back the URL so we can paste it into the markdown
    const imageUrl = `/images/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.urlencoded({ extended: true }));

const getWordCount = (text) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// HELPER: Parse metadata and body from MD file
const parseVibe = (content) => {
    const parts = content.split('---\n');
    const header = parts[0] || "";
    const body = parts[1] || "";
    const moodMatch = header.match(/MOOD: (.*)/);
    const dateMatch = header.match(/DATE: (.*)/);
    return {
        mood: moodMatch ? moodMatch[1].trim() : "chill",
        date: dateMatch ? dateMatch[1].trim() : "Recent",
        body: body.trim()
    };
};

// --- ROUTES ---
app.get('/', (req, res) => {
    const postsDir = path.join(__dirname, 'posts');
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    fs.readdir(postsDir, (err, files) => {
        if (err) return res.status(500).send("Error reading vibes.");
        
        const mdFiles = files.filter(file => file.endsWith('.md'));
        const postObjects = mdFiles.map(file => {
            const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
            const { mood, date, body } = parseVibe(content);

            return {
                fileName: file,
                displayTitle: file.replace('.md', '').split('-').join(' '),
                mood,
                date,
                words: getWordCount(body)
            };
        });
        res.render('index', { posts: postObjects });
    });
});

app.post('/submit', (req, res) => {
    const { title, content, mood } = req.body;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const slug = title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const fileName = `${slug}.md`;
    const fileContent = `MOOD: ${mood}\nDATE: ${date}\n---\n${content}`;

    fs.writeFile(path.join(__dirname, 'posts', fileName), fileContent, (err) => {
        if (err) return res.status(500).send("Error saving vibe.");
        res.redirect('/?msg=created'); 
    });
});

app.get('/edit/:slug', (req, res) => {
    const filePath = path.join(__dirname, 'posts', `${req.params.slug}.md`);
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) return res.status(404).send("Vibe not found!");
        const { mood, body } = parseVibe(content);
        res.render('edit', {
            title: req.params.slug.split('-').join(' '),
            content: body,
            mood: mood,
            slug: req.params.slug
        });
    });
});

app.post('/update/:slug', (req, res) => {
    const { content, mood } = req.body;
    const filePath = path.join(__dirname, 'posts', `${req.params.slug}.md`);
    
    fs.readFile(filePath, 'utf8', (err, original) => {
        if (err) return res.status(404).send("Vibe missing.");
        const { date } = parseVibe(original);
        const newContent = `MOOD: ${mood}\nDATE: ${date}\n---\n${content}`;

        fs.writeFile(filePath, newContent, (err) => {
            if (err) return res.status(500).send("Error updating.");
            res.redirect('/?msg=updated');
        });
    });
});

app.post('/delete', (req, res) => {
    const filePath = path.join(__dirname, 'posts', req.body.fileName);
    fs.unlink(filePath, () => res.redirect('/?msg=deleted'));
});

app.get('/post/:slug', (req, res) => {
    const filePath = path.join(__dirname, 'posts', `${req.params.slug}.md`);
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) return res.status(404).send("Vibe not found!");
        const { body } = parseVibe(content);
        res.render('post', { 
            title: req.params.slug.split('-').join(' '), 
            content: marked.parse(body) // Standardized marked usage
            
        });
    });
});

app.listen(port, () => console.log(`Vibe Check live at http://localhost:${port}`));