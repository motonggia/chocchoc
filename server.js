require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// Tai khoan trang admin — lay tu file .env, co gia tri mac dinh du phong
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'doi-mat-khau-nay';

if (!DEEPSEEK_API_KEY) {
  console.warn('[CANH BAO] Chua co DEEPSEEK_API_KEY trong file .env — /api/chat se bao loi cho toi khi ban khai bao key.');
}

if (!process.env.ADMIN_PASS) {
  console.warn('[CANH BAO] Chua co ADMIN_PASS trong file .env — dang dung mat khau mac dinh khong an toan cho trang /admin.html. Hay khai bao ADMIN_USER va ADMIN_PASS trong .env.');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

  if (!auth || auth !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Yeu cau dang nhap');
  }
  next();
}

// Route co bao ve dat TRUOC express.static de chan truy cap admin.html truc tiep
app.get(['/admin', '/admin.html'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Prompt he thong dinh danh tinh cach & pham vi tra loi cua tro ly tu van
const SYSTEM_PROMPT = `Ban la tro ly tu van tuyen sinh cua "Choc Choc Cooking Center" — trung tam day nau an va tu van khoi nghiep am thuc tai Ha Dong, Ha Noi.

Thong tin trung tam:
- Trieu ly: "Hoc lam chu — khong hoc lam thue".
- Cac khoa hoc: Banh my kep Viet Nam, Banh my hien dai, Do an vat tong hop, My cay, Nem nuong Nha Trang, Lau & Do nuong, Com tam, Chuyen de tu chon - Tu van theo mo hinh kinh doanh.
- Diem manh: giang vien tren 15 nam kinh nghiem thuc chien, dong hanh setup - van hanh - cai tien menu sau khoa hoc, noi dung linh hoat theo von va mat bang cua hoc vien.
- Dia chi: Tang 3, KDT Geleximco, Ha Dong. Hotline: 0944 080 015. Email: chocchoccookingcenter@gmail.com.

Nhiem vu: tra loi ngan gon, than thien, dung trong tam cau hoi, giup nguoi nhan tin hieu ro khoa hoc phu hop va khuyen khich de lai thong tin hoac goi hotline de duoc tu van sau. Neu khong chac chan thong tin cu the (hoc phi, lich khai giang chinh xac...), hay thanh that noi minh se de doi ngu tu van lien he lai, dung bia so lieu.
Luon tra loi bang tieng Viet, giong dieu gan gui, khong qua dai (uu tien duoi 120 tu moi luot tra loi).`;

app.post('/api/chat', async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'Server chua cau hinh DEEPSEEK_API_KEY.' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Thieu truong messages (mang cac tin nhan hoi thoai).' });
    }

    // Chi giu toi da 12 tin nhan gan nhat de tiet kiem token
    const trimmedHistory = messages.slice(-12).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || '').slice(0, 2000)
    }));

    const payload = {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...trimmedHistory
      ],
      temperature: 0.6,
      max_tokens: 500,
      stream: false
    };

    const dsRes = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error('DeepSeek API loi:', dsRes.status, errText);
      return res.status(502).json({ error: 'Loi tu DeepSeek API.' });
    }

    const data = await dsRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Khong nhan duoc noi dung tra loi tu DeepSeek.' });
    }

    return res.json({ reply });
  } catch (err) {
    console.error('Loi /api/chat:', err);
    return res.status(500).json({ error: 'Loi may chu noi bo.' });
  }
});

// health check don gian cho VPS / uptime monitor
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Choc Choc server dang chay tai http://localhost:${PORT}`);
});