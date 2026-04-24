/**
 * seed.js — Demo Data Seeder
 * Inserts 10 verified users, profiles, 3 posts each,
 * friend connections, comments, likes & notifications.
 *
 * Run: node seed.js
 * Password for ALL demo accounts: Demo@1234
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'secure_file_storage',
    password: process.env.DB_PASSWORD || '',
    port:     process.env.DB_PORT     || 5432,
});

// ─── Demo Users ───────────────────────────────────────────────────────────────
const USERS = [
    { email: 'alice.morgan@demo.com',   display_name: 'Alice Morgan',   bio: 'Full-stack developer 🚀 | Coffee addict ☕ | Open-source enthusiast' },
    { email: 'bob.hayes@demo.com',      display_name: 'Bob Hayes',      bio: 'Cybersecurity researcher 🔐 | CTF player | Breaking things responsibly' },
    { email: 'clara.sun@demo.com',      display_name: 'Clara Sun',      bio: 'UI/UX designer 🎨 | Figma wizard | Making the web beautiful' },
    { email: 'david.kim@demo.com',      display_name: 'David Kim',      bio: 'Backend engineer 🛠️ | Rust & Go lover | Distributed systems nerd' },
    { email: 'emma.ross@demo.com',      display_name: 'Emma Ross',      bio: 'Machine learning engineer 🤖 | PhD candidate | Python all day' },
    { email: 'frank.diaz@demo.com',     display_name: 'Frank Diaz',     bio: 'DevOps guru ☁️ | Kubernetes whisperer | 12-factor app believer' },
    { email: 'grace.lee@demo.com',      display_name: 'Grace Lee',      bio: 'Product manager 📋 | Agile advocate | Building things users love' },
    { email: 'henry.patel@demo.com',    display_name: 'Henry Patel',    bio: 'Blockchain developer ⛓️ | Web3 builder | DeFi explorer' },
    { email: 'isabella.chen@demo.com',  display_name: 'Isabella Chen',  bio: 'Mobile dev 📱 | React Native & Flutter | Coffee + code = life' },
    { email: 'jack.wilson@demo.com',    display_name: 'Jack Wilson',    bio: 'Security analyst 🛡️ | Threat hunter | SIEM enthusiast' },
];

// ─── 3 Posts per User ────────────────────────────────────────────────────────
const POSTS = [
    // Alice
    [
        { content: '🚀 Just shipped my first open-source library! It\'s a lightweight state manager for React with zero dependencies. Check it out and let me know what you think! #OpenSource #React #JavaScript', visibility: 'PUBLIC' },
        { content: 'Hot take: TypeScript strict mode should be the default, not opt-in. If you\'re still writing plain JS for large projects, you\'re living dangerously 😅 #TypeScript #WebDev', visibility: 'PUBLIC' },
        { content: 'Spent the weekend refactoring our monolith into microservices. The performance gains are insane — response times dropped by 60%! Sometimes the boring architectural work pays off 💪', visibility: 'FRIENDS_ONLY' },
    ],
    // Bob
    [
        { content: '🔐 Just published a write-up on a critical SSRF vulnerability I found in a popular SaaS platform. Responsibly disclosed, patched, and rewarded. Bug bounty hunting is wild! #BugBounty #SSRF', visibility: 'PUBLIC' },
        { content: 'Reminder: if your app stores passwords in plain text in 2026, you deserve to be on the wall of shame. Use bcrypt, argon2, or scrypt. There\'s no excuse. #Security #Passwords', visibility: 'PUBLIC' },
        { content: 'CTF weekend recap: solved 12/15 challenges, got first blood on the web exploitation category. The SSTI in Jinja2 challenge was beautifully crafted. Shoutout to the organizers! 🏆', visibility: 'FRIENDS_ONLY' },
    ],
    // Clara
    [
        { content: '🎨 New design trend I\'m loving: glassmorphism with variable blur. Subtle frost-glass effects add so much depth without overwhelming the UI. Sharing a Figma template in my next post!', visibility: 'PUBLIC' },
        { content: 'Accessibility is not an afterthought. Every designer should run their work through a screen reader at least once. You\'ll be humbled by what you discover. #A11y #UX #InclusiveDesign', visibility: 'PUBLIC' },
        { content: 'Dark mode vs light mode debate is pointless — just support both and let users decide. What IS worth debating: which neutral palette to use as your base. I\'m a warm-gray convert 🤍', visibility: 'FRIENDS_ONLY' },
    ],
    // David
    [
        { content: 'Benchmark results for my new Rust HTTP server: 450k req/s on a single core. No GC pauses, zero memory leaks, predictable latency. The systems programming renaissance is real. 🦀', visibility: 'PUBLIC' },
        { content: 'PostgreSQL window functions are criminally underused. Just replaced 3 application-layer aggregation loops with a single SQL query using LAG() and PARTITION BY. 10x faster. #Postgres #SQL', visibility: 'PUBLIC' },
        { content: 'Hot take: Go is the perfect language for infrastructure tooling. Not because it\'s elegant (it\'s not), but because any new hire can read and understand it in 30 minutes. #Golang #Engineering', visibility: 'FRIENDS_ONLY' },
    ],
    // Emma
    [
        { content: '🤖 Fine-tuned a small language model on domain-specific security documentation. It now outperforms GPT-4 on our internal threat classification task at 1/100th the inference cost. The era of specialised small models is here.', visibility: 'PUBLIC' },
        { content: 'Reminder: "more data always helps" is a myth. Cleaning your existing training data properly often beats collecting 10x more dirty data. Garbage in, garbage out — even at scale. #ML #DataScience', visibility: 'PUBLIC' },
        { content: 'Defended my PhD proposal today! 3 hours of grilling from the committee and I made it through. Topic: adversarial robustness in multimodal security classification systems. The real work begins now 🎓', visibility: 'FRIENDS_ONLY' },
    ],
    // Frank
    [
        { content: '☁️ Just migrated our entire infrastructure to GitOps. Every change is a PR, every deployment is reproducible, rollback takes 30 seconds. This is how infrastructure should be managed. #GitOps #Kubernetes', visibility: 'PUBLIC' },
        { content: 'If your deployment pipeline takes more than 10 minutes, you have a problem. Our CI/CD went from 45 min to 6 min after parallelising test suites and caching dependencies properly. #DevOps #CICD', visibility: 'PUBLIC' },
        { content: 'Chaos engineering session today: randomly killed 30% of our pods. Zero downtime. The Kubernetes setup is finally resilient. All those late nights configuring health checks paid off 🔥', visibility: 'FRIENDS_ONLY' },
    ],
    // Grace
    [
        { content: '📋 Launched our new feature with a phased rollout to 5% of users. Already seeing a 23% improvement in task completion rate. Data-driven product decisions > gut feelings, every time. #ProductManagement #Growth', visibility: 'PUBLIC' },
        { content: 'The best product decisions I\'ve made came from watching real users struggle with the product, not from reading analytics. Go talk to your users. Seriously. #UXResearch #ProductDiscovery', visibility: 'PUBLIC' },
        { content: 'Sprint retrospective insight: our team\'s velocity doubled when we reduced meeting time by 40% and switched to async standups. Protect your engineers\' deep work time. #Agile #RemoteWork', visibility: 'FRIENDS_ONLY' },
    ],
    // Henry
    [
        { content: '⛓️ Just audited a DeFi protocol\'s smart contracts and found a reentrancy vulnerability that could have drained $2M in liquidity. Always get your contracts audited, people. #Web3 #SmartContracts #Security', visibility: 'PUBLIC' },
        { content: 'The future of identity is self-sovereign. Verifiable credentials on a decentralised ledger will replace passwords, government IDs, and even OAuth tokens within the decade. Change my mind. #DID #Web3', visibility: 'PUBLIC' },
        { content: 'Zero-knowledge proofs explained simply: prove you know a secret without revealing the secret itself. The cryptographic magic behind privacy-preserving blockchains. This technology will be everywhere soon. 🔮', visibility: 'FRIENDS_ONLY' },
    ],
    // Isabella
    [
        { content: '📱 React Native vs Flutter in 2026: I\'ve shipped production apps in both. Flutter wins on performance and consistency, RN wins on web code sharing. My verdict: Flutter for pure mobile, RN for cross-platform teams. Thoughts?', visibility: 'PUBLIC' },
        { content: 'Mobile app optimisation tip: lazy-load your heavy screens, pre-fetch data before navigation, and always profile on a low-end device before shipping. Your p95 users will thank you. #MobileDev #Performance', visibility: 'PUBLIC' },
        { content: 'Hit 100k downloads on my side project app today 🎉 Built it in 6 weekends with React Native. No marketing, no ads — purely word of mouth. Solve a real problem and the users will come.', visibility: 'FRIENDS_ONLY' },
    ],
    // Jack
    [
        { content: '🛡️ Threat hunting session: found a dormant C2 beacon that had been sitting in the environment for 6 weeks undetected. The attacker was practicing LOTL (Living off the Land). Sigma rules saved the day! #ThreatHunting #SIEM', visibility: 'PUBLIC' },
        { content: 'Security teams: your biggest risk isn\'t zero-days, it\'s misconfigured cloud storage buckets and default credentials left on internal services. Do your basics before chasing exotic threats. #SecOps #CloudSecurity', visibility: 'PUBLIC' },
        { content: 'SIEM alert tuning is an art. Spent 3 hours reducing false positives by 70% by adding exclusions for known-good admin scripts. Signal-to-noise ratio is everything in SOC work. 📊', visibility: 'FRIENDS_ONLY' },
    ],
];

// ─── Comments ─────────────────────────────────────────────────────────────────
const COMMENT_POOL = [
    'Great post! Really insightful 👏',
    'Totally agree with this take 🙌',
    'This is exactly what I needed to read today!',
    'Mind blown 🤯 Thanks for sharing!',
    'Can you share more details on how you achieved this?',
    'Following this space closely. Keep it up!',
    'This just convinced me to try this approach.',
    'Bookmarked! Will come back to this later.',
    'The industry really needs to hear this more often.',
    'Saved! This is gold 💎',
    'Hot take but I\'m here for it 🔥',
    'First blood on this topic. Well done!',
];

async function seed() {
    const client = await pool.connect();
    const PASSWORD_HASH = await bcrypt.hash('Demo@1234', 10);

    try {
        await client.query('BEGIN');

        console.log('🌱 Starting seed...\n');

        // ── 1. Insert Users ──────────────────────────────────────────────────
        const userIds = [];
        for (const u of USERS) {
            const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
            if (existing.rows.length > 0) {
                console.log(`  ⚠️  User ${u.email} already exists — skipping`);
                userIds.push(existing.rows[0].id);
                continue;
            }
            const res = await client.query(
                `INSERT INTO users (email, password_hash, is_verified, twofa_enabled, totp_enabled)
                 VALUES ($1, $2, TRUE, FALSE, FALSE) RETURNING id`,
                [u.email, PASSWORD_HASH]
            );
            userIds.push(res.rows[0].id);
            console.log(`  ✅ Created user: ${u.display_name} <${u.email}> (id=${res.rows[0].id})`);
        }

        // ── 2. Insert Privacy Settings ───────────────────────────────────────
        for (const uid of userIds) {
            await client.query(
                `INSERT INTO privacy_settings (user_id, profile_visibility, post_visibility, contact_visibility)
                 VALUES ($1, 'PUBLIC', 'PUBLIC', 'FRIENDS_ONLY')
                 ON CONFLICT (user_id) DO NOTHING`,
                [uid]
            );
        }
        console.log('\n  ✅ Privacy settings configured for all users');

        // ── 3. Insert Profiles ───────────────────────────────────────────────
        for (let i = 0; i < USERS.length; i++) {
            await client.query(
                `INSERT INTO user_profiles (user_id, display_name, bio)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id) DO UPDATE SET display_name = $2, bio = $3`,
                [userIds[i], USERS[i].display_name, USERS[i].bio]
            );
        }
        console.log('  ✅ Profiles created for all users');

        // ── 4. Insert Posts ──────────────────────────────────────────────────
        const postIds = [];
        for (let i = 0; i < USERS.length; i++) {
            for (const p of POSTS[i]) {
                const res = await client.query(
                    `INSERT INTO posts (author_id, content, visibility, created_at)
                     VALUES ($1, $2, $3, NOW() - (random() * interval '7 days')) RETURNING id`,
                    [userIds[i], p.content, p.visibility]
                );
                postIds.push({ id: res.rows[0].id, author_id: userIds[i] });
            }
        }
        console.log(`  ✅ Inserted ${postIds.length} posts (3 per user)`);

        // ── 5. Friend Connections (chain + some cross-links) ─────────────────
        const friendPairs = [];
        for (let i = 0; i < userIds.length - 1; i++) {
            friendPairs.push([userIds[i], userIds[i + 1]]);
        }
        // Extra cross-links for a richer social graph
        friendPairs.push([userIds[0], userIds[4]]);
        friendPairs.push([userIds[1], userIds[5]]);
        friendPairs.push([userIds[2], userIds[7]]);
        friendPairs.push([userIds[3], userIds[9]]);
        friendPairs.push([userIds[6], userIds[8]]);

        for (const [uid, fid] of friendPairs) {
            await client.query(
                `INSERT INTO friends (user_id, friend_id, status)
                 VALUES ($1, $2, 'ACCEPTED'), ($2, $1, 'ACCEPTED')
                 ON CONFLICT DO NOTHING`,
                [uid, fid]
            );
        }
        console.log(`  ✅ Created ${friendPairs.length} friend connections`);

        // ── 6. Likes ─────────────────────────────────────────────────────────
        let likeCount = 0;
        for (const post of postIds) {
            // Random subset of other users like each post
            const likers = userIds
                .filter(uid => uid !== post.author_id)
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * 5) + 2);

            for (const liker of likers) {
                await client.query(
                    `INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [liker, post.id]
                );
                likeCount++;
            }
        }
        console.log(`  ✅ Added ${likeCount} likes across all posts`);

        // ── 7. Comments ──────────────────────────────────────────────────────
        let commentCount = 0;
        for (const post of postIds) {
            const commenters = userIds
                .filter(uid => uid !== post.author_id)
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * 3) + 1);

            for (const commenter of commenters) {
                const text = COMMENT_POOL[Math.floor(Math.random() * COMMENT_POOL.length)];
                await client.query(
                    `INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3)`,
                    [post.id, commenter, text]
                );
                commentCount++;
            }
        }
        console.log(`  ✅ Added ${commentCount} comments across all posts`);

        // ── 8. Notifications ─────────────────────────────────────────────────
        let notifCount = 0;
        for (const [uid, fid] of friendPairs.slice(0, 5)) {
            await client.query(
                `INSERT INTO notifications (user_id, type, from_user_id, message)
                 VALUES ($1, 'FRIEND_REQUEST_ACCEPTED', $2, 'accepted your friend request')`,
                [uid, fid]
            );
            notifCount++;
        }
        // Like notifications for first post of each user
        for (let i = 0; i < 5; i++) {
            const post = postIds[i * 3]; // first post per user
            const liker = userIds[(i + 3) % userIds.length];
            await client.query(
                `INSERT INTO notifications (user_id, type, from_user_id, reference_id, reference_type, message)
                 VALUES ($1, 'POST_LIKED', $2, $3, 'post', 'liked your post')`,
                [post.author_id, liker, post.id]
            );
            notifCount++;
        }
        console.log(`  ✅ Created ${notifCount} notifications`);

        await client.query('COMMIT');

        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║           ✅  SEED COMPLETE — DEMO DATA READY        ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        console.log('║  10 users  │  30 posts  │  friends  │  likes         ║');
        console.log('║  Password for all accounts:  Demo@1234               ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        USERS.forEach(u => console.log(`║  📧 ${u.email.padEnd(46)}║`));
        console.log('╚══════════════════════════════════════════════════════╝');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Seed failed — rolled back:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(() => process.exit(1));
