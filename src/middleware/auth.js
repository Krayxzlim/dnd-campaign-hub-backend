const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dnd-companion-secret-2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Formato de token inválido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

function dmOnly(req, res, next) {
  if (req.user.role !== 'dm') {
    return res.status(403).json({ error: 'Acceso restringido al Dungeon Master' });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authMiddleware, dmOnly, generateToken };
