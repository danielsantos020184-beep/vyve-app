const express = require('express');
const path = require('path');
const Stripe = require('stripe');
const app = express();

// IMPORTANT: Replace with your ACTUAL Stripe secret key from Live mode
// Your key should start with sk_live_ or rk_live_
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
app.use(express.json());
app.use(express.static('public'));

let users = {};

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

app.get('/api/users', (req, res) => {
    let list = Object.keys(users).map(u => ({ username: u, email: users[u].email, coins: users[u].coins }));
    res.json(list);
});

// STRIPE PAYMENT ENDPOINT
app.post('/api/create-payment', async (req, res) => {
    console.log('📦 Payment request received:', req.body);
    
    try {
        const { coins, amount, username } = req.body;
        
        if (!coins || !amount || !username) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${coins} Coins for Vyve`,
                        description: `Purchase ${coins} coins to use on Vyve`,
                    },
                    unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://vyve-app.onrender.com/payment-success.html?coins=${coins}&username=${username}`,
            cancel_url: `https://vyve-app.onrender.com/payment-cancel.html`,
            metadata: {
                username: username,
                coins: coins
            }
        });
        
        console.log('✅ Stripe session created:', session.id);
        res.json({ url: session.url });
        
    } catch (error) {
        console.error('❌ Stripe error:', error);
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
    console.log(`💳 Stripe configured: ${stripe.apiKey ? 'YES' : 'NO'}`);
});