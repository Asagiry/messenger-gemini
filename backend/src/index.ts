import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import path from 'path';
import { pool } from './db/index';

const app = express();
const server = http.createServer(app);

// Use standard JWT secret from environment or fallback
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-12345';

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static files from React build directory
const frontendBuildPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

// Auth Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    nickname: string;
  };
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded as AuthenticatedRequest['user'];
    next();
  });
};

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

// Register
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, nickname } = req.body;

  if (!email || !password || !nickname) {
    res.status(400).json({ error: 'All fields (email, password, nickname) are required' });
    return;
  }

  try {
    // Check if email or nickname already exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR nickname = $2',
      [email, nickname]
    );

    if (userCheck.rows.length > 0) {
      res.status(400).json({ error: 'Email or nickname already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      `INSERT INTO users (email, password_hash, nickname, presence_status)
       VALUES ($1, $2, $3, 'offline')
       RETURNING id, email, nickname, avatar_url, bio, presence_status`,
      [email, passwordHash, nickname]
    );

    const user = newUser.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        bio: user.bio,
        presence_status: user.presence_status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout (just returns success, client destroys token)
app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// Get current profile
app.get('/api/profile/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRes = await pool.query(
      'SELECT id, email, nickname, avatar_url, bio, presence_status, last_seen, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(userRes.rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// Update profile
app.put('/api/profile/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { nickname, password, avatar_url, bio } = req.body;

  if (!nickname) {
    res.status(400).json({ error: 'Nickname is required' });
    return;
  }

  try {
    // Check nickname uniqueness (excluding self)
    const nickCheck = await pool.query(
      'SELECT id FROM users WHERE nickname = $1 AND id != $2',
      [nickname, req.user!.id]
    );

    if (nickCheck.rows.length > 0) {
      res.status(400).json({ error: 'Nickname is already taken' });
      return;
    }

    let queryStr = `
      UPDATE users 
      SET nickname = $1, avatar_url = $2, bio = $3
    `;
    const queryParams: any[] = [nickname, avatar_url || '', bio || ''];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      queryStr += `, password_hash = $4 WHERE id = $5`;
      queryParams.push(passwordHash, req.user!.id);
    } else {
      queryStr += ` WHERE id = $4`;
      queryParams.push(req.user!.id);
    }

    queryStr += ' RETURNING id, email, nickname, avatar_url, bio, presence_status, last_seen, created_at';

    const updatedUser = await pool.query(queryStr, queryParams);

    // Update JWT token if nickname changed
    const user = updatedUser.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// User Directory
app.get('/api/users/directory', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const usersRes = await pool.query(
      'SELECT id, nickname, avatar_url, bio, presence_status, last_seen FROM users WHERE id != $1 ORDER BY nickname ASC',
      [req.user!.id]
    );
    res.json(usersRes.rows);
  } catch (err) {
    console.error('Directory error:', err);
    res.status(500).json({ error: 'Server error fetching directory' });
  }
});

// Search Users
app.get('/api/users/search', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const queryStr = req.query.q as string;

  if (!queryStr) {
    res.json([]);
    return;
  }

  try {
    const usersRes = await pool.query(
      `SELECT id, nickname, avatar_url, bio, presence_status, last_seen 
       FROM users 
       WHERE id != $1 AND nickname ILIKE $2 
       ORDER BY nickname ASC`,
      [req.user!.id, `%${queryStr}%`]
    );
    res.json(usersRes.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error searching users' });
  }
});

// Chats list
app.get('/api/chats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    // We want to fetch all dialog partners for the current user
    // A dialog partner is anyone they have exchanged messages with (and the message is not deleted for them).
    // We also want to include details of the last message and counts of unread messages.
    const queryStr = `
      WITH last_messages AS (
        SELECT DISTINCT ON (partner_id)
          id,
          partner_id,
          content,
          sender_id,
          status,
          created_at
        FROM (
          SELECT 
            id,
            receiver_id AS partner_id,
            content,
            sender_id,
            status,
            created_at
          FROM messages
          WHERE sender_id = $1 AND deleted_for_sender = FALSE
          UNION ALL
          SELECT 
            id,
            sender_id AS partner_id,
            content,
            sender_id,
            status,
            created_at
          FROM messages
          WHERE receiver_id = $1 AND deleted_for_receiver = FALSE
        ) sub
        ORDER BY partner_id, created_at DESC
      ),
      unread_counts AS (
        SELECT sender_id AS partner_id, COUNT(*) AS count
        FROM messages
        WHERE receiver_id = $1 AND status != 'read' AND deleted_for_receiver = FALSE
        GROUP BY sender_id
      )
      SELECT 
        u.id AS partner_id,
        u.nickname,
        u.avatar_url,
        u.presence_status,
        u.last_seen,
        lm.content AS last_message_content,
        lm.sender_id AS last_message_sender_id,
        lm.status AS last_message_status,
        lm.created_at AS last_message_time,
        COALESCE(uc.count, 0)::INTEGER AS unread_count
      FROM last_messages lm
      JOIN users u ON u.id = lm.partner_id
      LEFT JOIN unread_counts uc ON uc.partner_id = lm.partner_id
      ORDER BY lm.created_at DESC;
    `;

    const chatsRes = await pool.query(queryStr, [userId]);
    res.json(chatsRes.rows);
  } catch (err) {
    console.error('Fetch chats error:', err);
    res.status(500).json({ error: 'Server error fetching chats' });
  }
});

// Chat messages history (with pagination / lazy loading)
app.get('/api/chats/:partnerId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const partnerId = parseInt(req.params.partnerId as any, 10);
  const limit = parseInt(req.query.limit as any, 10) || 50;
  const offset = parseInt(req.query.offset as any, 10) || 0;

  if (isNaN(partnerId)) {
    res.status(400).json({ error: 'Invalid partner ID' });
    return;
  }

  try {
    const messagesRes = await pool.query(
      `SELECT id, sender_id, receiver_id, content, status, created_at, updated_at
       FROM messages
       WHERE (
         (sender_id = $1 AND receiver_id = $2 AND deleted_for_sender = FALSE)
         OR
         (sender_id = $2 AND receiver_id = $1 AND deleted_for_receiver = FALSE)
       )
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, partnerId, limit, offset]
    );

    // Return messages in chronological order (oldest first) for UI rendering
    res.json(messagesRes.rows.reverse());
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// Serve frontend index.html for all other routes (single page app)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(frontendBuildPath, 'index.html'));
});

// ----------------------------------------------------
// WEBSOCKET SERVER
// ----------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

// Active connections: userId -> WebSocket
const activeConnections = new Map<number, WebSocket>();

// Helper to broadcast to all connected users
const broadcastPresence = (userId: number, status: string, lastSeen?: Date) => {
  const payload = JSON.stringify({
    type: 'presence',
    userId,
    status,
    lastSeen: lastSeen ? lastSeen.toISOString() : undefined,
  });

  activeConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
};

wss.on('connection', async (ws: WebSocket, userId: number) => {
  activeConnections.set(userId, ws);

  // Mark user as online in DB and broadcast
  try {
    await pool.query("UPDATE users SET presence_status = 'online' WHERE id = $1", [userId]);
    broadcastPresence(userId, 'online');
  } catch (err) {
    console.error('Error setting user online:', err);
  }

  // Handle incoming messages from the client
  ws.on('message', async (data: string) => {
    try {
      const payload = JSON.parse(data);

      switch (payload.type) {
        case 'send_message': {
          const { receiverId, content } = payload;
          if (!receiverId || !content) return;

          // Check if receiver is online
          const isReceiverOnline = activeConnections.has(receiverId);
          const initialStatus = isReceiverOnline ? 'delivered' : 'sent';

          // Save message to DB
          const msgRes = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, content, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id, sender_id, receiver_id, content, status, created_at, updated_at`,
            [userId, receiverId, content, initialStatus]
          );

          const message = msgRes.rows[0];

          // Send message back to sender (to confirm delivery & provide real ID/timestamp)
          ws.send(JSON.stringify({ type: 'message_sent_confirm', message }));

          // If online, deliver to receiver
          if (isReceiverOnline) {
            const receiverSocket = activeConnections.get(receiverId);
            if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
              receiverSocket.send(JSON.stringify({ type: 'new_message', message }));
            }
          }
          break;
        }

        case 'read_messages': {
          const { senderId } = payload; // The user whose messages we have read
          if (!senderId) return;

          // Update status of all sent/delivered messages between senderId and current user to 'read'
          await pool.query(
            `UPDATE messages 
             SET status = 'read' 
             WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`,
            [senderId, userId]
          );

          // Notify the sender that their messages were read
          const senderSocket = activeConnections.get(senderId);
          if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
            senderSocket.send(JSON.stringify({
              type: 'messages_read',
              senderId,
              receiverId: userId,
            }));
          }
          break;
        }

        case 'typing': {
          const { receiverId, isTyping } = payload;
          if (!receiverId) return;

          const receiverSocket = activeConnections.get(receiverId);
          if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
            receiverSocket.send(JSON.stringify({
              type: 'typing',
              senderId: userId,
              isTyping,
            }));
          }
          break;
        }

        case 'edit_message': {
          const { messageId, content } = payload;
          if (!messageId || !content) return;

          // Update in DB (verify ownership)
          const msgRes = await pool.query(
            `UPDATE messages 
             SET content = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND sender_id = $3
             RETURNING id, sender_id, receiver_id, content, status, created_at, updated_at`,
            [content, messageId, userId]
          );

          if (msgRes.rows.length > 0) {
            const updatedMsg = msgRes.rows[0];

            // Send confirmation to sender
            ws.send(JSON.stringify({ type: 'message_edited_confirm', message: updatedMsg }));

            // Notify receiver
            const receiverSocket = activeConnections.get(updatedMsg.receiver_id);
            if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
              receiverSocket.send(JSON.stringify({ type: 'message_edited', message: updatedMsg }));
            }
          }
          break;
        }

        case 'delete_message': {
          const { messageId, mode } = payload; // mode: 'me' | 'both'
          if (!messageId || !mode) return;

          // Fetch message to find partner
          const findRes = await pool.query(
            'SELECT sender_id, receiver_id FROM messages WHERE id = $1',
            [messageId]
          );

          if (findRes.rows.length === 0) return;

          const msg = findRes.rows[0];
          const isSender = msg.sender_id === userId;
          const isReceiver = msg.receiver_id === userId;

          if (!isSender && !isReceiver) return;

          if (mode === 'both') {
            // Delete for both is only allowed for the sender
            if (!isSender) return;

            await pool.query(
              'UPDATE messages SET deleted_for_sender = TRUE, deleted_for_receiver = TRUE WHERE id = $1',
              [messageId]
            );

            // Notify sender
            ws.send(JSON.stringify({ type: 'message_deleted_confirm', messageId, mode: 'both' }));

            // Notify receiver
            const receiverSocket = activeConnections.get(msg.receiver_id);
            if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
              receiverSocket.send(JSON.stringify({ type: 'message_deleted', messageId, mode: 'both' }));
            }
          } else {
            // Delete for me
            if (isSender) {
              await pool.query('UPDATE messages SET deleted_for_sender = TRUE WHERE id = $1', [messageId]);
            } else {
              await pool.query('UPDATE messages SET deleted_for_receiver = TRUE WHERE id = $1', [messageId]);
            }

            // Confirm to sender
            ws.send(JSON.stringify({ type: 'message_deleted_confirm', messageId, mode: 'me' }));
          }
          break;
        }

        default:
          console.warn('Unknown message type:', payload.type);
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  // Handle client disconnection
  ws.on('close', async () => {
    activeConnections.delete(userId);
    const lastSeen = new Date();

    try {
      await pool.query(
        "UPDATE users SET presence_status = 'offline', last_seen = $1 WHERE id = $2",
        [lastSeen, userId]
      );
      broadcastPresence(userId, 'offline', lastSeen);
    } catch (err) {
      console.error('Error setting user offline:', err);
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for user ${userId}:`, err);
  });
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
  const urlParams = new URLSearchParams(request.url?.split('?')[1] || '');
  const token = urlParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const userId = (decoded as any).id;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, userId);
    });
  });
});

// Serve and listen
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
