const express = require('express');
const path = require('path');
const Stripe = require('stripe');
const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static('public'));

// In-memory storage (simple, works immediately)
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

// Stripe payment
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
    console.log(`Vyve server running on port ${port}`);
});