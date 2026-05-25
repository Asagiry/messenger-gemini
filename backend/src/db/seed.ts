import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './index';

async function runMigrationAndSeed() {
  console.log('Starting migration and seeding...');

  try {
    // 1. Read schema.sql and execute it
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schemaSql);
    console.log('Schema tables created successfully.');

    // Ensure reactions column exists if the table was created in an older run
    await pool.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
    `);

    // 2. Check if users already exist
    const { rows: existingUsers } = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(existingUsers[0].count, 10);

    if (userCount > 0) {
      console.log('Database already has users. Skipping seeding.');
      return;
    }

    console.log('Seeding 10 test users...');

    const testUsers = [
      { email: 'alice@example.com', nickname: 'alice', password: 'alice', bio: 'Hello! I am Alice. Love reading books and coding.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      { email: 'bob@example.com', nickname: 'bob', password: 'bob', bio: 'Hey, Bob is here. Football fan & developer.', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
      { email: 'charlie@example.com', nickname: 'charlie', password: 'charlie', bio: 'Coffee lover and designer. Let\'s chat!', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150' },
      { email: 'david@example.com', nickname: 'david', password: 'david', bio: 'Traveler and photographer. Capturing the world.', avatar: 'https://images.unsplash.com/photo-1527983359383-4758693f760c?w=150' },
      { email: 'eve@example.com', nickname: 'eve', password: 'eve', bio: 'Software Architect. Passionate about system design.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
      { email: 'frank@example.com', nickname: 'frank', password: 'frank', bio: 'Crypto enthusiast and gamer.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
      { email: 'grace@example.com', nickname: 'grace', password: 'grace', bio: 'Artist and music listener. Always creative.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
      { email: 'heidi@example.com', nickname: 'heidi', password: 'heidi', bio: 'Cybersecurity student. Keep it secure!', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
      { email: 'ivan@example.com', nickname: 'ivan', password: 'ivan', bio: 'No bio yet.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
      { email: 'judy@example.com', nickname: 'judy', password: 'judy', bio: 'Hello world, Judy is in the house.', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' },
    ];

    const insertedUsers: any[] = [];

    for (const u of testUsers) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const res = await pool.query(
        `INSERT INTO users (email, nickname, password_hash, bio, avatar_url, presence_status)
         VALUES ($1, $2, $3, $4, $5, 'offline') RETURNING id, nickname`,
        [u.email, u.nickname, passwordHash, u.bio, u.avatar]
      );
      insertedUsers.push(res.rows[0]);
    }

    console.log('Seeded 10 test users.');

    // 3. Seed message history
    console.log('Seeding chat history between test users...');
    
    const userMap: { [key: string]: number } = {};
    insertedUsers.forEach(u => {
      userMap[u.nickname] = u.id;
    });

    const messages = [
      // Alice <-> Bob
      { from: 'alice', to: 'bob', content: 'Hi Bob! How are you doing?', status: 'read', timeOffset: -60 * 10 }, // 10 mins ago
      { from: 'bob', to: 'alice', content: 'Hey Alice! I am doing great, working on some React stuff. What about you?', status: 'read', timeOffset: -60 * 9 },
      { from: 'alice', to: 'bob', content: 'Same here, building a messenger backend in Express. Pretty fun!', status: 'read', timeOffset: -60 * 8 },
      { from: 'bob', to: 'alice', content: 'Awesome! Let me know when it\'s ready. We should test the real-time websocket connections together.', status: 'read', timeOffset: -60 * 7 },
      { from: 'alice', to: 'bob', content: 'Sure, will do!', status: 'delivered', timeOffset: -60 * 6 },

      // Charlie <-> David
      { from: 'charlie', to: 'david', content: 'Hey David, did you check out the new design drafts?', status: 'read', timeOffset: -60 * 20 },
      { from: 'david', to: 'charlie', content: 'Hey Charlie, yes! They look clean. I really like the dark mode aesthetic.', status: 'read', timeOffset: -60 * 18 },
      { from: 'charlie', to: 'david', content: 'Perfect! I will polish the UI elements and start implementing them today.', status: 'read', timeOffset: -60 * 15 },
      { from: 'david', to: 'charlie', content: 'Great, can\'t wait to see the final product.', status: 'delivered', timeOffset: -60 * 12 },

      // Alice <-> Eve
      { from: 'alice', to: 'eve', content: 'Hey Eve, do you have a minute? Need help with database indexing for messages.', status: 'read', timeOffset: -60 * 40 },
      { from: 'eve', to: 'alice', content: 'Hi Alice! Sure. You should index on both sender_id and receiver_id, and maybe create a composite index if you query them together frequently.', status: 'read', timeOffset: -60 * 35 },
      { from: 'alice', to: 'eve', content: 'Got it, makes total sense. Thanks a lot!', status: 'read', timeOffset: -60 * 30 },
      { from: 'eve', to: 'alice', content: 'No problem! Anytime.', status: 'read', timeOffset: -60 * 25 },

      // Bob <-> Charlie
      { from: 'bob', to: 'charlie', content: 'Hey man, up for some football tonight?', status: 'read', timeOffset: -60 * 50 },
      { from: 'charlie', to: 'bob', content: 'Oh, absolutely! What time?', status: 'read', timeOffset: -60 * 48 },
      { from: 'bob', to: 'charlie', content: 'Around 7 PM at the usual spot.', status: 'read', timeOffset: -60 * 45 },
      { from: 'charlie', to: 'bob', content: 'See you there!', status: 'read', timeOffset: -60 * 40 },
    ];

    for (const msg of messages) {
      const sender_id = userMap[msg.from];
      const receiver_id = userMap[msg.to];
      const timestamp = new Date(Date.now() + msg.timeOffset * 1000);

      await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [sender_id, receiver_id, msg.content, msg.status, timestamp]
      );
    }

    console.log('Seeded initial messages history.');
    console.log('Database initialized successfully.');

  } catch (err) {
    console.error('Error during database migration/seeding:', err);
    throw err;
  }
}

// Support running directly as CLI script
if (require.main === module) {
  runMigrationAndSeed()
    .then(() => {
      console.log('Migration and seeding script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration and seeding script failed:', err);
      process.exit(1);
    });
}

export { runMigrationAndSeed };
