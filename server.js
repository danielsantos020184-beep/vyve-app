const express = require('express');
const path = require('path');
const Stripe = require('stripe');
const app = express();

// For Daily.co API calls
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const DAILY_API_KEY = process.env.DAILY_API_KEY;

app.use(express.json());
app.use(express.static('public'));

// In-memory storage
let users = {};

// Save user data
app.post('/api/save-user', (req, res) => {
    const { username, email, coins, giftsReceived } = req.body;
    if(!users[username]) {
        users[username] = { username, email, coins: 100, giftsReceived: 0 };
    } else {
        users[username].coins = coins;
        users[username].giftsReceived = giftsReceived;
    }
    res.json({ success: true });
});

// Get all users
app.get('/api/users', (req, res) => {
    let list = Object.keys(users).map(u => ({ username: u, email: users[u].email, coins: users[u].coins }));
    res.json(list);
});

// Follow user
app.post('/api/follow', (req, res) => {
    const { follower, following } = req.body;
    if(!users[follower]) users[follower] = { username: follower, followers: [], following: [] };
    if(!users[following]) users[following] = { username: following, followers: [], following: [] };
    if(!users[follower].following) users[follower].following = [];
    if(!users[following].followers) users[following].followers = [];
    if(!users[follower].following.includes(following)) {
        users[follower].following.push(following);
        users[following].followers.push(follower);
    }
    res.json({ success: true });
});

// Get followers
app.get('/api/followers/:username', (req, res) => {
    const user = users[req.params.username];
    res.json(user?.followers || []);
});

// Get following
app.get('/api/following/:username', (req, res) => {
    const user = users[req.params.username];
    res.json(user?.following || []);
});

// ==================== VIDEO CALL API ====================
app.post('/api/create-video-room', async (req, res) => {
    try {
        const { roomName, username } = req.body;
        
        console.log('Creating video room:', roomName);
        
        const response = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: roomName,
                privacy: 'public',
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    start_video_off: false,
                    start_audio_off: false,
                    lang: 'en'
                }
            })
        });
        
        const data = await response.json();
        console.log('Room created:', data.url);
        res.json({ url: data.url });
        
    } catch (error) {
        console.error('Video room error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== STRIPE PAYMENT ====================
app.post('/api/create-payment', async (req, res) => {
    try {
        const { coins, amount, username } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `${coins} Coins for Vyve` },
                    unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://vyve-app.onrender.com/payment-success.html?coins=${coins}&username=${username}`,
            cancel_url: `https://vyve-app.onrender.com/payment-cancel.html`,
            metadata: { username, coins }
        });
        
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Vyve is running!' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vyve.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Vyve server running on port ${port}`);
    console.log(`💳 Stripe ready`);
    console.log(`📹 Video calls ready (Daily.co)`);
});